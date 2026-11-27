# KebApps

**KebApps** è una Web App Progressiva (PWA) Open Source (**Licenza MIT**), mobile-first e **100% local-first**: zero database remoto, zero account utente, zero pubblicità e zero tracker.

I tuoi dati personali (**Profilo locale**, **Diario delle degustazioni**, **Wishlist**, punteggi XP e badge) restano esclusivamente nella memoria del tuo dispositivo (`IndexedDB`) e sono esportabili/reimportabili in qualsiasi momento tramite **Backup JSON**.

- **Istanza pubblica ufficiale:** [`https://kebapps.app`](https://kebapps.app)
- **Licenza codice sorgente:** [MIT License](LICENSE) (*"AS IS"*; vedi [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) per font SIL OFL 1.1 ed esclusioni marchi Google)
- **Contatto ufficiale:** `support@kebapps.app`

---

## Guida "Uso a Casa" (Local / Self-Hosting)

Puoi eseguire KebApps direttamente sul tuo computer (Windows, macOS, Linux) o sulla tua rete Wi-Fi domestica in **due modalità**:

1. **[Modalità 1 — "Casa / Zero-Cost"](#modalita-1--casa--zero-cost-100-gratuita-senza-account-google-cloud):** 100% gratuita, pronta in 2 minuti, senza carte di credito né chiavi Google Cloud.
2. **[Modalità 2 — "Mappa Live Personale" (BYOK)](#modalita-2--mappa-live-personale-byok---bring-your-own-keys):** con le tue chiavi Google Maps Platform e Cloudflare Turnstile protette da quote giornaliere e budget alert.

---

### Modalità 1 — "Casa / Zero-Cost" (100% Gratuita, senza account Google Cloud)

Ideale per usare l'app subito sul proprio dispositivo o nella rete locale di casa senza registrare alcun servizio esterno.

#### Prerequisiti
- **Node.js 20+** e **npm** installati ([nodejs.org](https://nodejs.org/)).
- **Git** (oppure scarica lo ZIP del repository).

#### Avvio in 4 comandi

```bash
# 1. Clona il repository (sostituisci con l'URL del tuo repository)
git clone <URL_DEL_REPOSITORY> kebapps
cd kebapps

# 2. Installa le dipendenze
npm install

# 3. Crea la configurazione locale sicura (Zero-Cost attivo di default)
cp .env.example .env.local

# 4. Avvia KebApps in locale
npm run dev
```

Apri il browser su **[`http://localhost:3000`](http://localhost:3000)**.

> **Vuoi usarla anche dal telefono sulla stessa rete Wi-Fi di casa?**
> Avvia Next.js in ascolto sulla LAN con `npx next dev --webpack -H 0.0.0.0 -p 3000`, aggiungi il tuo IP locale in `ALLOWED_DEV_ORIGINS` (es. `ALLOWED_DEV_ORIGINS="localhost,127.0.0.1,192.168.1.50"` dentro `.env.local`) e apri `http://<TUO_IP_LOCALE>:3000` dal browser dello smartphone.

#### Cosa funziona subito a Costo Zero (`0,00 €`)
Con `NEXT_PUBLIC_DISABLE_PAID_APIS="1"` e `DISABLE_PAID_APIS="1"` (impostati di default in `.env.example`):
- **Home (`/`):** riepilogo profilo, XP, livelli, Kebab Index e ultimi locali salvati.
- **Esplorazione Locale (`/map`):** quando clicchi *"Attiva Google Maps"* senza una chiave live configurata, l'app attiva automaticamente la **Vista Esplorazione Locale Zero-Cost** con le fixture dimostrative e ricerca offline, senza chiamare alcuna API a pagamento.
- **Diario Personale (`/diary`):** aggiunta manuale illimitata di kebab shop, valutazioni a 5 dimensioni (Carne, Pane, Salse, Qualità/Prezzo, Location), note fino a 280 caratteri, ricerca e filtri.
- **Wishlist (`/wishlist`):** lista desideri con aggiunta manuale, note inline, ordinamento per distanza GPS **100% offline** (formula di Haversine) e conversione 1-tap nel Diario.
- **Profilo & Backup (`/profile`):** nickname, 5 avatar SVG, tema Chiaro/Scuro/Sistema, Export/Import **Backup JSON** (`replace` / `merge`) e reset totale dei dati locali.

---

### Modalità 2 — "Mappa Live Personale" (BYOK - Bring Your Own Keys)

Se vuoi abilitare la mappa interattiva Google Maps e la ricerca live dei kebab shop nella tua istanza personale, segui tutti gli step di sicurezza per evitare qualsiasi addebito imprevisto.

#### Passo 1 — Progetto Google Cloud e sole 4 API
1. Accedi alla [Google Cloud Console](https://console.cloud.google.com/) e crea un nuovo progetto (es. `kebapps-personal`).
2. Nella sezione **APIs & Services > Library**, abilita **solo** queste 4 API:
   - **Maps JavaScript API** (per la mappa sul browser)
   - **Places API (New)** (per la ricerca `places:searchText` con soli ID e coordinate, zero `types` e zero testo descrittivo)
   - **Places UI Kit** (per renderizzare nome/indirizzo dei locali direttamente via Web Component ufficiale Google esentato dai limiti EEA)
   - **Geocoding API** (per la barra di ricerca città/indirizzi *On-Submit*)

#### Passo 2 — Crea e separa le 2 Chiavi API (Obbligatorio)
In **APIs & Services > Credentials**, crea **due chiavi distinte** (non usare mai una chiave unica senza restrizioni):

1. **Chiave Frontend (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`):**
   - **Application restrictions:** seleziona **Websites** (HTTP referrers) e aggiungi solo gli indirizzi della tua istanza (es. `http://localhost:3000/*`, `http://localhost:8787/*`, oppure `https://tuodominio.tld/*`).
   - **API restrictions:** limita **esclusivamente** a **Maps JavaScript API** e **Places UI Kit**.
2. **Chiave Backend (`GOOGLE_PLACES_BACKEND_KEY`):**
   - **Application restrictions:** restrizioni lato server/IP (questa chiave resta solo lato server e **non** deve mai avere il prefisso `NEXT_PUBLIC_`).
   - **API restrictions:** limita **esclusivamente** a **Places API (New)** e **Geocoding API**.

#### Passo 3 — Imposta Hard Quotas e Budget Alert (Protezione Anti-Addebito)
Prima di attivare le API live:
1. Vai in **APIs & Services > Enabled APIs & services** → **Quotas** e imposta **Hard Quotas giornaliere** basse su tutte le 4 API per restare ampiamente nelle soglie gratuite mensili (es. `300` richieste/giorno su Maps JS, Places UI Kit e Geocoding, `150` richieste/giorno su Places Text Search). **Questo è l'unico vero blocco tecnico che ferma le chiamate a pagamento.**
2. Vai in **Billing > Budgets & alerts** e crea un budget mensile di **`1,00 €`** con soglie di notifica al `50%`, `90%` e `100%`. **Attenzione:** i Budget Alert di Google Cloud inviano solo email informative ma **non bloccano automaticamente le API né la fatturazione** — in caso di allarme, attiva subito il kill-switch (`DISABLE_PAID_APIS=1`).

#### Passo 4 — Configura Cloudflare Turnstile
- **Solo su `localhost` per sviluppo:** puoi lasciare le chiavi di test ufficiali Cloudflare già presenti in `.env.example` (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
- **Per un'istanza pubblica online (`NODE_ENV=production`):** le chiavi dummy vengono bloccate automaticamente (`fail-closed`). Crea dalla [Cloudflare Dashboard](https://dash.cloudflare.com/) un widget **Turnstile Invisible** per la mappa e un widget **Turnstile Managed** dedicato per lo sblocco anti-spam del contatto supporto, inserendo il tuo dominio negli *Hostname* autorizzati.

#### Passo 5 — Aggiorna `.env.local` e riavvia

```env
NEXT_PUBLIC_DISABLE_PAID_APIS="0"
DISABLE_PAID_APIS="0"

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSy...tua-chiave-frontend..."
# Solo sviluppo/test locale ("DEMO_MAP_ID" e' bloccato in produzione)
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="DEMO_MAP_ID"
GOOGLE_PLACES_BACKEND_KEY="AIzaSy...tua-chiave-backend..."

NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAAAAAA...site-key-invisible..."
TURNSTILE_SECRET_KEY="0x4AAAAAAA...secret-key-invisible..."

NEXT_PUBLIC_TURNSTILE_SUPPORT_SITE_KEY="0x4AAAAAAA...site-key-managed-supporto..."
TURNSTILE_SUPPORT_SECRET_KEY="0x4AAAAAAA...secret-key-managed-supporto..."

NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SUPPORT_EMAIL="support@kebapps.app"
NEXT_PUBLIC_DATA_CONTROLLER_NAME=""
NEXT_PUBLIC_DATA_CONTROLLER_LOCATION="Italia"
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=""

# Opzionale: inserisci qui l'URL del tuo repository pubblico per mostrarlo nel Profilo
NEXT_PUBLIC_REPOSITORY_URL=""
```

> **Deploy su dominio pubblico:** in produzione è obbligatorio valorizzare `NEXT_PUBLIC_DATA_CONTROLLER_NAME` (nome e cognome reali o ragione sociale del titolare dell'istanza, Art. 13 GDPR) e `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION`. `scripts/cf-deploy-guard.mjs` blocca il deploy se il titolare è mancante o generico.

> **Collegare l'URL del Repository in un secondo momento:**
> Quando pubblicherai il repository online, potrai inserire il link in:
> 1. `NEXT_PUBLIC_REPOSITORY_URL` (mostra il pulsante **Repository** in `/profile`).
> 2. Campo `"repository.url"` in `package.json`.

---

## Cloudflare + Google Search Console (Indicizzazione & Hardening Privacy)

Per pubblicare l'app online su un dominio pubblico riducendo al minimo le superfici di tracciamento infrastrutturale:

1. **Imposta l'URL canonico di produzione (`NEXT_PUBLIC_SITE_URL`):**
   - Imposta `NEXT_PUBLIC_SITE_URL="https://<tuo-dominio>"` (senza trailing slash) in `.env.production.local` prima di `npm run build:cf`.
   - I domini tecnici temporanei `*.workers.dev` e `*.pages.dev` ricevono automaticamente l'header `X-Robots-Tag: noindex` da Cloudflare (disattiva la route `*.workers.dev` se non necessaria): l'indicizzazione organica richiede un **Custom Domain** collegato al Worker.
2. **Hardening Cloudflare Free Privacy & Custom Domain:**
   - Associa il Custom Domain pubblico al Worker `kebapps`, attiva **Always Use HTTPS** e **Full (strict)** SSL/TLS (il **Cloudflare DPA** standard è già incorporato automaticamente nel *Self-Serve Subscription Agreement* dell'account Cloudflare Free, senza flag da attivare).
   - Mantieni disattivati **Cloudflare Web Analytics / RUM**, **Email Address Obfuscation** (Scrape Shield, per evitare iniezioni `/cdn-cgi/scripts/`) e **Bot Fight Mode** (che può iniettare challenge JS o bloccare bot verificati come `Googlebot` e `Google-InspectionTool`); applica invece una regola WAF *Custom Rate Limit* su `/api/*`.
   - Configura un unico redirect canonico `301` (`www` → apex oppure apex → `www`, coerente con `NEXT_PUBLIC_SITE_URL`).
3. **Verifica e Sitemap su Google Search Console:**
   - Registra una proprietà **Dominio** su Google Search Console tramite record **TXT DNS** direttamente nella zona DNS di Cloudflare (oppure usa il meta tag opzionale impostando `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`).
   - Dopo il deploy sul Custom Domain, invia `https://<tuo-dominio>/sitemap.xml` e verifica `/robots.txt` e la resa HTML delle rotte pubbliche (`/`, `/map`, `/diary`, `/wishlist`, `/profile`).

---

## Architettura & Privacy by Design

- **Frontend & PWA:** Next.js 16 (App Router, Webpack), React 19, TypeScript (Strict Mode) e `@ducanh2912/next-pwa` con service worker custom (`worker/index.ts`), isolamento `NetworkOnly` per richieste cross-origin (`!sameOrigin`) e vista offline (`/~offline`). Design System **"Flat-Smussato 2D"** basato sul font **Quicksand** con Light/Dark Mode.
- **Storage Locale (`src/lib/local-storage/`):**
  - `IndexedDB` (`kebapps_local_db` v1) con 4 object store (`profile`, `diary`, `wishlist`, `map_cache`) e fallback in-memory (`MemoryStorageAdapter`).
  - Scadenza automatica a 30 giorni (`GOOGLE_COORDS_TTL_MS`) per coordinate Google in `diary` e `wishlist`, con validazione Zod `.strict()` ed export/import **Backup JSON** (*replace* / *merge*, con **esclusione di `map_cache` e delle coordinate Google**).
- **Proxy Stateless Edge (`src/app/api/`):**
  - Zero database server-side, zero autenticazione, zero Server Actions.
  - Tre sole route `GET` in sola lettura (`/api/shops`, `/api/geocode-search`, `/api/support-contact`) con `Cache-Control: no-store, max-age=0`, protette da **Cloudflare Turnstile** (`validateTurnstileToken` fail-closed) e rate limiting in-memory per IP.
- **Politica Zero-Cost, Sensori & Google Maps EEA:**
  - Blocco preventivo di Google Maps SDK, Places UI Kit e Turnstile tramite `<MapConsentGate />` su `/map` (consenso versionato a TTL 180 giorni, nessun consenso salvato in Zero-Cost, scorciatoia revoca 1-tap con icona scudo), e sensori bussola/GPS (`useCompass` + `watchPosition`) vincolati a `hasGpsConsent()` con pulizia `sessionStorage` alla revoca.
  - `<GoogleAttribution />` (`google_on_white.png` / `google_on_dark.png`) visibile sulle schede mappa live (assente su demo locale `ZeroCostLocalMapView`) e `<AppFooter />` / `<ControllerIdentityNotice />` per l'accesso immediato a informative e dati del Titolare.
  - Header `X-Goog-FieldMask` limitato esclusivamente a `places.id,places.location` (zero `types`, zero campi testuali/descrittivi Google in proxy e cache `map_cache`) con bounding box quantizzato a `~550 m` senza prefetch 9x; dettagli luogo visivi su `/map` delegati al widget **Places UI Kit** (`GooglePlaceDetailsWidget.tsx`).
  - Ricerca rigorosamente **On-Submit**, calcolo distanze/ETA **100% offline** via Haversine (`src/lib/geoUtils.ts`) e cache effimera `map_cache <= 24h`.

---

## Indice della Documentazione

### Architettura, Design & Funzionamento
- [**Funzionamento Core**](docs/FUNZIONAMENTO.md) — Mappa con consenso, Discovery euristica, calcoli Haversine, Diario, Wishlist, Gamification e Backup JSON.
- [**API Reference**](docs/API.md) — Documentazione dei 3 proxy stateless (`GET /api/shops`, `GET /api/geocode-search`, `GET /api/support-contact`) e policy Zero-Cost.
- [**Design System Flat-Smussato 2D**](DESIGN.md) — Token cromatici, tipografia *Quicksand*, Dark Mode e stati pin personali.
- [**Engineering Context (GEMINI.md)**](GEMINI.md) · [**Engineering Reference (CLAUDE.md)**](CLAUDE.md)

### Deploy, Infrastruttura & Sicurezza
- [**Deploy su Cloudflare Workers**](docs/PRE_CLOUDFLARE_DEPLOY.md) — Test locale Wrangler (`scripts/cf-local.mjs`), secrets produzione e guardia pre-deploy (`scripts/cf-deploy-guard.mjs`).
- [**Setup Google Maps Platform**](docs/setup/google_maps.md) — Chiavi separate, `X-Goog-FieldMask` Basic, quote giornaliere e Kill Switch.
- [**Guida Cloudflare Turnstile**](docs/TURNSTILE.md) — Protezione anti-bot invisibile (`useTurnstile`).
- [**Security Policy**](SECURITY.md) · [**Contributing Guide**](CONTRIBUTING.md)

### Legal & Privacy
- [**Privacy Policy**](docs/PRIVACY_POLICY.md) — Informativa local-first e distinzione istanza ufficiale / codice Open Source.
- [**Cookie Policy & Storage Locale**](docs/COOKIE_POLICY.md) — IndexedDB, Web Storage, cache `<= 24h` e blocco preventivo script esterni.
- [**Termini di Servizio**](docs/TERMS_OF_SERVICE.md) — Strumento personale offline-first, clausola `"AS IS"` (MIT) e Termini Google Maps.
- [**Matrice Contenuti Google Maps (EEA)**](docs/legal/google/MATRICE_CONTENUTI_GOOGLE.md) — Conformità contrattuale EEA senza database server-side.
- [**Changelog**](CHANGELOG.md)

---

## Sviluppo, Testing & Release Gate

```bash
# Avvio sviluppo locale (esegue predev generate-docs.mjs)
npm run dev

# Pipeline completa di qualità e sicurezza
npm run lint
npm run typecheck
npm run test
npm run verify:compliance:repo
npm run build

# Emulazione e build produzione Cloudflare Workers (OpenNext + Wrangler)
npm run build:cf:local
npm run dev:cf
npm run build:cf
npm run deploy:cf

# Test End-to-End Playwright
npx playwright test
```
