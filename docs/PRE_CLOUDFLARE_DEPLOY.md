# KebApps Local — Guida Deploy Cloudflare (OpenNext & Wrangler)

Questa guida descrive la procedura completa per testare localmente e pubblicare **KebApps Local** su Cloudflare Workers / Pages tramite `@opennextjs/cloudflare` (`wrangler.jsonc`, worker `kebapps`).

Con l'architettura **100% local-first**, non esistono database remoti, store KV esterni, provider email né cron worker esterni: l'unico runtime da configurare sono le chiavi **Google Maps Platform** e **Cloudflare Turnstile**.

---

## 1. Emulazione Locale su Runtime Cloudflare Workers

Prima di pubblicare, testa il bundle reale OpenNext in locale con Wrangler:

```bash
# 1. Prepara .dev.vars e costruisce il bundle locale su http://localhost:8787
npm run build:cf:local

# 2. Avvia Wrangler dev in locale
npm run dev:cf
```

Cosa fa `scripts/cf-local.mjs`:
- Legge `.env.local` e genera `.dev.vars` (con permessi `0600`, ignorato da git).
- Imposta `NEXT_PUBLIC_SITE_URL=http://localhost:8787` e applica il kill-switch locale (`NEXT_PUBLIC_DISABLE_PAID_APIS=1`, `DISABLE_PAID_APIS=1` se non diversamente specificato).
- Supporta opzionalmente `LOCAL_TURNSTILE_SITE_KEY` e `LOCAL_TURNSTILE_SECRET_KEY` in `.env.local` per usare un widget Turnstile dedicato allo sviluppo locale.
- Si rifiuta di eseguire `build:cf:local` se `.env.production.local` è presente nella root, per evitare di mescolare segreti di produzione in un bundle locale.

> Il bundle prodotto da `build:cf:local` incorpora `localhost:8787` e **non deve mai essere deployato** in produzione (`scripts/cf-deploy-guard.mjs` blocca il deploy).

---

## 2. Variabili d'Ambiente e Segreti per la Produzione

### Variabili pubbliche (`NEXT_PUBLIC_*`, incorporate al build time)
Devono essere definite in `.env.production.local` (file temporaneo, escluso da git) al momento di eseguire `npm run build:cf`. **Lascia sempre vuote (`""`) le chiavi server-only** `GOOGLE_PLACES_BACKEND_KEY` e `TURNSTILE_SECRET_KEY` dentro `.env.production.local`, affinché `@opennextjs/cloudflare` non le incorpori in chiaro in `.open-next/cloudflare/next-env.mjs` e il Worker le legga esclusivamente dai Cloudflare Encrypted Secrets:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSy...chiave-frontend-produzione..."
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="tuo-map-id-reale-google-cloud" # Obbligatorio in produzione ("DEMO_MAP_ID" bloccato)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAAAAAA...site-key-produzione..."
NEXT_PUBLIC_SITE_URL="https://kebapps.app"
NEXT_PUBLIC_DISABLE_PAID_APIS="0"
DISABLE_PAID_APIS="0"
GOOGLE_PLACES_BACKEND_KEY=""
TURNSTILE_SECRET_KEY=""
ENABLE_PWA_DEV="false"
NEXT_PUBLIC_SUPPORT_EMAIL="support@kebapps.app"
NEXT_PUBLIC_DATA_CONTROLLER_NAME="Nome Cognome Reali del Titolare"
NEXT_PUBLIC_DATA_CONTROLLER_LOCATION="Italia"
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=""
NEXT_PUBLIC_REPOSITORY_URL=""
```

### Segreti server-side del Worker Cloudflare (runtime)
Carica i segreti crittografati sul Worker `kebapps` (da Dashboard Cloudflare o via Wrangler CLI):

```bash
npx wrangler secret put GOOGLE_PLACES_BACKEND_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put DISABLE_PAID_APIS
```

> Imposta `DISABLE_PAID_APIS` su `0` in produzione per abilitare le chiamate ai proxy Google Places / Geocoding, oppure su `1` come kill-switch di emergenza immediato senza dover ricostruire il bundle.

---

## 3. Procedura di Release in Produzione

1. Verifica che i gate di qualità siano tutti verdi:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run verify:compliance:repo
   ```
2. Crea `.env.production.local` ridefinendo **tutte** le chiavi presenti in `.env.local` con i valori di produzione (anche quelle lasciate vuote, come `NEXT_PUBLIC_REPOSITORY_URL=""`).
3. Costruisci il bundle OpenNext di produzione:
   ```bash
   npm run build:cf
   ```
4. Esegui il deploy **esclusivamente** con lo script protetto:
   ```bash
   npm run deploy:cf
   ```
   `scripts/cf-deploy-guard.mjs` controlla automaticamente che:
   - `.open-next/worker.js` esista;
   - nessun file `.env` residuo sia presente nella root;
   - `localhost:8787` e `NEXT_PUBLIC_SITE_URL=localhost` non siano presenti nel bundle;
   - `NEXT_PUBLIC_DISABLE_PAID_APIS` e `DISABLE_PAID_APIS` non siano bloccati sul kill-switch `1`;
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` siano presenti in `.open-next/cloudflare/next-env.mjs` e quest'ultima non usi la chiave dummy di test Cloudflare;
   - `GOOGLE_PLACES_BACKEND_KEY` e `TURNSTILE_SECRET_KEY` **non** siano incorporati in chiaro in `.open-next/cloudflare/next-env.mjs` (devono essere gestiti solo tramite `wrangler secret put`);
   - `NEXT_PUBLIC_DATA_CONTROLLER_NAME` sia valorizzato con nome e cognome reali o ragione sociale (bloccando valori mancanti o generici come `KebApps` / `Team KebApps` ex Art. 13 GDPR);
   - tutte le variabili di `.env.local` siano ridefinite in `.env.production.local`.
5. Rimuovi o sposta `.env.production.local` fuori dalla cartella del progetto a deploy completato.

---

## 4. Configurazione Dominio, Hardening Privacy & Restrizioni Post-Deploy

1. **Cloudflare Custom Domain, SSL & `workers.dev`:** collega il dominio di produzione al Worker `kebapps` (es. `kebapps.app`), imposta SSL/TLS su **Full (strict)**, attiva **Always Use HTTPS** e un redirect canonico 301 unico (`www` ↔ apex coerente con `NEXT_PUBLIC_SITE_URL`). Disattiva se non necessaria la route `*.workers.dev` (che comunque emette `X-Robots-Tag: noindex`).
2. **Hardening Privacy Cloudflare Free (Zero Script Iniettati & DPA):**
   - **Cloudflare Data Processing Addendum (DPA):** nei piani Self-Serve (incluso Cloudflare Free) il DPA standard (con SCC ed EU-US DPF) è **incorporato automaticamente per riferimento** nel *Cloudflare Self-Serve Subscription Agreement* accettato alla creazione dell'account; non esiste né serve alcun flag o pulsante separato nella dashboard ([Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)).
   - Mantieni disattivati **Cloudflare Web Analytics (RUM)**, **Email Address Obfuscation** (Scrape Shield, che inietta `/cdn-cgi/scripts/email-decode.min.js`), **Rocket Loader** e qualsiasi banner/tag manager third-party.
   - Mantieni disattivato **Bot Fight Mode** (che può servire script di challenge JS fuori consenso o bloccare `Googlebot` / `Google-InspectionTool`) e proteggi invece `/api/*` con una regola **WAF Custom Rate Limiting** (piano Free: limite es. 30 req/min per IP) affiancata a Turnstile.
3. **Google Search Console:** verifica la proprietà Dominio tramite record TXT DNS su Cloudflare (o con `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) e invia `https://<tuo-dominio>/sitemap.xml`.
4. **Google Cloud Console:** aggiorna le restrizioni *HTTP Referrers* su `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` aggiungendo il dominio di produzione (es. `https://kebapps.app/*`) e verifica che la chiave frontend sia limitata esclusivamente a **Maps JavaScript API** e **Places UI Kit**.
5. **Cloudflare Turnstile:** aggiungi il dominio di produzione agli hostname autorizzati del widget Turnstile.
6. **Hard Quotas Google Cloud, Identità Titolare & Allineamento Contatti:** prima di disattivare `DISABLE_PAID_APIS=1`, configura sempre **Hard Quotas giornaliere** e **Budget Alert** in Google Cloud Console sulle 4 API abilitate, verifica la proprietà operativa di `kebapps.app`, `support@kebapps.app` e del repository GitHub collegato e assicurati che `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION` includa città e provincia reali (es. `"Milano (MI), Italia"`).
