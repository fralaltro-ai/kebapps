# Cloudflare Turnstile — Guida alla Configurazione

Questa guida spiega come configurare **Cloudflare Turnstile** per proteggere gli endpoint proxy stateless di `kebapps-local` (`/api/shops`, `/api/geocode-search`) contro abusi automatizzati e consumo anomalo delle quote Google Maps.

---

## 1. Creazione delle Chiavi nella Dashboard Cloudflare

1. Accedi alla [Cloudflare Dashboard](https://dash.cloudflare.com/) e seleziona **Turnstile** nel menu laterale.
2. Clicca su **Add Widget**.
3. Configura:
   - **Widget Name:** `KebApps Local`
   - **Hostnames:** inserisci il dominio di produzione (es. `kebapps.app`) e, se vuoi testare un widget reale in locale, `localhost`.
   - **Widget Mode:** **Invisible** (consigliato per non introdurre popup o attriti sulla mappa mobile).
4. Copia **Site Key** e **Secret Key**.

---

## 2. Variabili d'Ambiente

In `.env.local` (sviluppo) e come configurazione/Secret del Worker su Cloudflare (produzione):

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="tua-site-key"
TURNSTILE_SECRET_KEY="tua-secret-key"
```

> In ambiente locale `npm run dev` / test con `NODE_ENV !== "production"`, se `TURNSTILE_SECRET_KEY` non è impostata `validateTurnstileToken` registra un warning e consente il bypass; con la chiave di test ufficiale Cloudflare (`1x0000000000000000000000000000000AA`) è ammesso il bypass locale `dev-turnstile-bypass`. In produzione (`NODE_ENV === "production"`), sia l'assenza della secret sia l'uso della chiave di test dummy vengono bloccati (fail-closed).

---

## 3. Integrazione nel Codice

### Client-Side (`src/hooks/useTurnstile.ts`)
- L'hook condiviso `useTurnstile` carica on-demand lo script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` solo quando necessario (su `/map`), evitando di appesantire tutte le rotte.
- Gestisce `execution: "execute"` (usato in `KebabMap.tsx`), timeout (`15000 ms`), retry trasparente su errore/scadenza e pulizia al unmount.
- Ogni chiamata ai proxy associa un `action` dedicato al token generato:
  - `shops_search` → `GET /api/shops`
  - `geocode_search` → `GET /api/geocode-search`

### Server-Side (`src/lib/turnstile.ts`)
`validateTurnstileToken(token, ip, expectedAction)`:
1. Invia `secret`, `response` e `remoteip` a `https://challenges.cloudflare.com/turnstile/v0/siteverify` con `AbortSignal.timeout(8000)`.
2. Verifica `res.ok` e `data.success === true`.
3. Impone la corrispondenza esatta `data.action === expectedAction` (fail-closed se assente).
4. In `NODE_ENV === "production"`, verifica che `data.hostname` rientri nell'allowlist (`kebapps.app`, `www.kebapps.app`, `staging.kebapps.app` e l'hostname di `NEXT_PUBLIC_SITE_URL`).

---

## 4. Risoluzione Problemi Comuni

- **Errore `110200` in locale:** l'hostname `localhost` non è autorizzato nel widget Turnstile della Dashboard Cloudflare, oppure stai usando chiavi di produzione su `localhost:8787`. Usa le chiavi di test Cloudflare in `.env.local` (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) o aggiungi `LOCAL_TURNSTILE_SITE_KEY` e `LOCAL_TURNSTILE_SECRET_KEY` per `scripts/cf-local.mjs`.
- **403 `Verifica anti-bot fallita` su `/api/shops` o `/api/geocode-search`:** verifica che l'header `x-turnstile-token` sia valorizzato e che `TURNSTILE_SECRET_KEY` corrisponda alla `NEXT_PUBLIC_TURNSTILE_SITE_KEY` usata dal browser.
