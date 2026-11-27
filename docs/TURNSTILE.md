# Cloudflare Turnstile — Guida alla Configurazione

Questa guida spiega come configurare **Cloudflare Turnstile** per proteggere i 3 endpoint proxy stateless di `kebapps-local` (`/api/shops`, `/api/geocode-search`, `/api/support-contact`) contro abusi automatizzati, consumo anomalo delle quote Google Maps e scraping del recapito email di assistenza.

---

## 1. Architettura a Due Widget (Dashboard Cloudflare)

In Cloudflare Turnstile la modalità del widget (*Invisible* vs *Managed*) è legata in modo esclusivo alla coppia **Site Key / Secret Key**. Pertanto `kebapps-local` usa **due widget separati**:

1. **Widget Mappa (`Invisible`):** protegge `/api/shops` e `/api/geocode-search` senza introdurre box o attriti sulla mappa mobile.
   - **Hostnames:** dominio di produzione (es. `kebapps.app`, `www.kebapps.app`) e opzionalmente `localhost`.
   - **Widget Mode:** **Invisible**.
2. **Widget Supporto (`Managed`, visibile):** protegge `GET /api/support-contact` con box visibile/interattivo caricato **solo su clic esplicito** in `/profile/info` e nel riquadro Titolare sulle pagine legali.
   - **Widget Name:** `KebApps Support Contact`
   - **Hostnames:** dominio di produzione (es. `kebapps.app`, `www.kebapps.app`) e opzionalmente `localhost`.
   - **Widget Mode:** **Managed**.

---

## 2. Variabili d'Ambiente

In `.env.local` (sviluppo) e come configurazione/Secret del Worker su Cloudflare (produzione):

```env
# Widget 1: Invisible (Mappa)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="site-key-invisible"
TURNSTILE_SECRET_KEY="secret-key-invisible"

# Widget 2: Managed visibile (Supporto email)
NEXT_PUBLIC_TURNSTILE_SUPPORT_SITE_KEY="site-key-managed"
TURNSTILE_SUPPORT_SECRET_KEY="secret-key-managed"

# Recapito supporto (SOLO SERVER, mai NEXT_PUBLIC_)
SUPPORT_EMAIL="support@kebapps.app"
```

> In ambiente locale `npm run dev` / test con `NODE_ENV !== "production"`, se la rispettiva secret non è impostata `validateTurnstileToken` registra un warning e consente il bypass; con le chiavi di test ufficiali Cloudflare (`1x00000000000000000000AA` sempre PASS oppure `3x00000000000000000000FF` per forzare la checkbox visibile insieme alla secret `1x0000000000000000000000000000000AA`) è ammesso il bypass locale `dev-turnstile-bypass`. In produzione (`NODE_ENV === "production"`), sia l'assenza della secret sia l'uso delle chiavi di test dummy (`1x...`, `2x...`, `3x...`) vengono bloccati (`fail-closed`).

---

## 3. Integrazione nel Codice

### Client-Side (`src/hooks/useTurnstile.ts` & `src/components/support/SupportEmailGate.tsx`)
- L'hook condiviso `useTurnstile` carica on-demand lo script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` solo quando un widget viene montato realmente (su `/map` dietro `MapConsentGate`, oppure su clic esplicito in `SupportEmailGate`), evitando di appesantire o tracciare le altre rotte.
- Su `/map` (`KebabMap.tsx`) usa `execution: "execute"`, timeout (`15000 ms`), retry trasparente e pulizia al unmount.
- In `SupportEmailGate.tsx` usa `execution: "render"`, `size: "flexible"`, `appearance: "always"`, sincronizzazione tema Chiaro/Scuro, rilevamento offline preventivo e sblocco temporaneo in memoria React (zero salvataggi in `localStorage`/`IndexedDB`).
- Ogni chiamata ai proxy associa un `action` dedicato al token generato:
  - `shops_search` → `GET /api/shops` (`TURNSTILE_SECRET_KEY`)
  - `geocode_search` → `GET /api/geocode-search` (`TURNSTILE_SECRET_KEY`)
  - `support_contact` → `GET /api/support-contact` (`TURNSTILE_SUPPORT_SECRET_KEY`)

### Server-Side (`src/lib/turnstile.ts`)
`validateTurnstileToken(token, ip, expectedAction, { secretKey, secretEnvName })`:
1. Invia `secret`, `response` e `remoteip` a `https://challenges.cloudflare.com/turnstile/v0/siteverify` con `AbortSignal.timeout(8000)`.
2. Verifica `res.ok` e `data.success === true`.
3. Impone la corrispondenza esatta `data.action === expectedAction` (fail-closed se assente).
4. In `NODE_ENV === "production"`, verifica che `data.hostname` rientri nell'allowlist (`kebapps.app`, `www.kebapps.app`, `staging.kebapps.app` e l'hostname di `NEXT_PUBLIC_SITE_URL`).

---

## 4. Risoluzione Problemi Comuni

- **Errore `110200` in locale:** l'hostname `localhost` non è autorizzato nel widget Turnstile della Dashboard Cloudflare, oppure stai usando chiavi di produzione su `localhost:8787`. Usa le chiavi di test Cloudflare in `.env.local` (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) o aggiungi `LOCAL_TURNSTILE_SITE_KEY` / `LOCAL_TURNSTILE_SECRET_KEY` (e `LOCAL_TURNSTILE_SUPPORT_SITE_KEY` / `LOCAL_TURNSTILE_SUPPORT_SECRET_KEY`) per `scripts/cf-local.mjs`.
- **403 `Verifica anti-bot fallita` su `/api/shops`, `/api/geocode-search` o `/api/support-contact`:** verifica che l'header `x-turnstile-token` sia valorizzato e che `TURNSTILE_SECRET_KEY` (mappa) o `TURNSTILE_SUPPORT_SECRET_KEY` (supporto) corrisponda alla rispettiva `Site Key` usata dal browser.
