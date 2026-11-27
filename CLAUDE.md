# KebApps Local — Engineering Reference (`CLAUDE.md`)

Questo documento è allineato a `GEMINI.md` e descrive l'architettura **100% local-first** di `kebapps-local` (v2.0.0).

---

## 1. Panoramica & Architettura Local-First

**KebApps** è una PWA mobile-first **100% local-first**:
- **Zero Database Remoto & Zero Autenticazione:** nessuna tabella server, nessun login, nessun dato personale o UGC conservato o pubblicato lato server.
- **Stack Core:**
  - **Framework:** Next.js 16 (App Router, `--webpack`), React 19, TypeScript (Strict Mode).
  - **PWA:** `@ducanh2912/next-pwa` con service worker custom (`worker/index.ts`), isolamento Workbox `NetworkOnly` per richieste cross-origin (`!sameOrigin`), vista offline interattiva (`src/app/~offline/page.tsx`) e header di sicurezza su asset statici in `public/_headers`.
  - **Mappe:** Google Maps Platform (`@react-google-maps/api` + Places UI Kit `<gmp-place-details-compact>` via `GooglePlaceDetailsWidget.tsx`) protetta da consenso esplicito (`MapConsentGate`).
  - **Runtime Edge:** Cloudflare Workers tramite `@opennextjs/cloudflare` (`open-next.config.ts`, `wrangler.jsonc`).

### Rotte & Layout Principali dell'App
- **Footer & Trasparenza (`AppFooter`, `ControllerIdentityNotice`):** footer globale (`src/components/layout/AppFooter.tsx`, nascosto su `/map`) con link diretti alle policy legali e contatto diretto; `ControllerIdentityNotice` (`src/components/legal/ControllerIdentityNotice.tsx`) espone sulle pagine legali il Titolare del Trattamento configurato via `NEXT_PUBLIC_DATA_CONTROLLER_NAME` / `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION` (Art. 13 GDPR).
- `/` (`src/app/page.tsx`): Dashboard locale con riepilogo profilo, XP, Kebab Index, ultime visite del Diario e Wishlist.
- `/map` (`src/app/map/page.tsx`): Mappa interattiva protetta da `MapConsentGate`, barra ricerca On-Submit, discovery POI (Place Details renderizzati lato client tramite widget ufficiale Google Places UI Kit) e azioni su Diario/Wishlist con etichetta definita dall'utente sui pin Google.
- `/diary` (`src/app/diary/page.tsx`): Diario personale delle degustazioni (5 dimensioni, ricerca, filtri, ordinamento, modifica ed eliminazione).
- `/wishlist` (`src/app/wishlist/page.tsx`): Lista desideri locale con aggiunta manuale, note inline, ordinamento per data o distanza Haversine offline e conversione 1-tap in Diario.
- `/profile` (`src/app/profile/page.tsx`): Identità locale (nickname + 5 avatar SVG), progressione XP/livelli/badge, tema Chiaro/Scuro/Sistema, toggle consensi Google Maps / GPS, stima spazio occupato, Export/Import Backup JSON (`replace` / `merge`), cancellazione integrale dati locali (incluse chiavi onboarding/PWA e cache SW `KEBAPPS_PURGE_PRIVATE_CACHES`) e sezione unificata **"Supporto, Info & Documenti"**.
- `/privacy-policy`, `/cookie-policy`, `/terms`, `/~offline`.

---

## 2. Storage Locale Client-Side (`src/lib/local-storage/`)

- **`schema.ts`**: definisce gli schemi Zod `.strict()` e le costanti di integrità:
  - `LocalProfileSchema` (`id: "local_user"`, `nickname`, `avatar_id` tra 5 mascotte SVG).
  - `DiaryEntrySchema` (voti interi `1..5` su carne, pane, salse, qualità/prezzo + `score_location` opzionale, nota max 280 char, `visited_at`, `coords_expires_at` opzionale).
  - `WishlistEntrySchema` (`place_id`, `shop_label`, nota max 200 char, coordinate opzionali + `coords_expires_at` opzionale, `sort_order`, `added_at`).
  - `GOOGLE_COORDS_TTL_MS = 30 * 24 * 60 * 60 * 1000` (30 giorni solari max per coordinate derivate da Google Maps Platform).
  - `MapCacheEntrySchema` con **`MAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000` (24h)** e **`MAP_CACHE_MAX_ENTRIES = 150`**: conserva esclusivamente `place_id`, `latitude`, `longitude`, `cached_at`, `expires_at` (nessun nome/indirizzo Google).
  - `BackupBundleSchema` (`schema_version: 1`, `app: "kebapps-local"`, max `2 MB`, max `2000` voci per collezione) che include **esclusivamente** `profile`, `diary` e `wishlist` (mai `map_cache`).
- **`db.ts`**: adapter asincrono su `IndexedDB` (`kebapps_local_db` v1) con fallback automatico trasparente in memoria (`MemoryStorageAdapter`) quando IndexedDB non è disponibile (es. SSR o test Node). Gestisce purga automatica record scaduti, policy LRU su `map_cache` e azzeramento automatico di `latitude`/`longitude`/`coords_expires_at` alla scadenza dei 30 giorni su `diary` e `wishlist`.
- **`backup.ts`**: `exportBackupData` (rimuove automaticamente `latitude`, `longitude` e `coords_expires_at` dalle voci con coordinate soggette a scadenza Google `coords_expires_at !== null`), `serializeBackupJson`, `parseAndValidateBackupJson`, `importBackupData` (`replace` / `merge`), `estimateLocalStorageUsage`, `resetAllLocalData`.

---

## 3. Proxy API Stateless & Sicurezza (`src/app/api/`)

Il backend espone **esclusivamente 3 endpoint `GET` stateless** (nessuna mutazione `POST`/`PUT`/`DELETE`, nessuna Server Action, nessuna persistenza server):
1. `GET /api/shops` (`src/app/api/shops/route.ts`):
   - Rate limit in-memory per IP: `30 req / 60s` (`checkRateLimitFallback`).
   - Verifica Turnstile obbligatoria (`validateTurnstileToken`, action `shops_search`).
   - Validazione bounding box (`MAX_BOUNDS_SPAN_DEG = 1.2`, `MIN_MAP_ZOOM = 13`).
   - Se `paidApisDisabled()` o chiave assente, restituisce le fixture di `LOCAL_DEV_SHOP_FIXTURES`.
   - Altrimenti interroga `https://places.googleapis.com/v1/places:searchText` con `X-Goog-FieldMask: places.id,places.location` (`PLACES_BASIC_FIELD_MASK`, conformità EEA *No Use With any Map*: zero campi testuali/descrittivi né `types`) e restituisce esclusivamente `place_id`, `latitude`, `longitude` (`name`, `address`, `city`, `region`, `country` a `null`) con header `Cache-Control: no-store, max-age=0`.
2. `GET /api/geocode-search` (`src/app/api/geocode-search/route.ts`):
   - Rate limit `10 req / 10s`, Turnstile action `geocode_search`, query `2..200` char.
   - Interroga Google Geocoding API (in modalità live restituisce al massimo `1` risultato ridotto a `place_id`, `lat`, `lon` con campi testuali `null` e header `Cache-Control: no-store, max-age=0`) o restituisce `LOCAL_DEV_GEOCODE_FIXTURES` se `paidApisDisabled()`.
3. `GET /api/support-contact` (`src/app/api/support-contact/route.ts`):
   - Rate limit `5 req / 60s`, Turnstile action `support_contact` su widget dedicato *Managed* (`TURNSTILE_SUPPORT_SECRET_KEY`).
   - Sblocca on-demand il recapito server-only `SUPPORT_EMAIL` senza esporlo staticamente nei bundle client (`Cache-Control: no-store, max-age=0`).

Nessun file `middleware.ts` / `proxy.ts` è presente: l'app è 100% stateless e priva di sessioni o redirect di autenticazione.

---

## 4. Algoritmi Client-Side

- **Valutazione Esperienziale (`src/lib/ratingLabels.ts`):** media aritmetica dei 4 voti base (`score_meat`, `score_bread`, `score_sauces`, `score_value`) più `score_location` (se assente, viene usata la media dei 4 base per mantenere la divisione su 5); mappatura sui 5 livelli (*Da Sogno*, *Garanzia*, *Buon Alleato*, *Spuntino Smart*, *In Esplorazione*).
- **Gamification Personale (`src/lib/gamification.ts`):**
  - XP: `+10` per locale unico nel diario (`XP_PER_DIARY_ENTRY`), `+15` per città unica (`XP_PER_UNIQUE_CITY`), `+25` per nazione unica (`XP_PER_UNIQUE_COUNTRY`).
  - 5 livelli: `PIVELLO DELLO SPIEDO` (0–99), `ESPLORATORE DELLA PITA` (100–249), `CAVALIERE DELLA CIPOLLA` (250–499), `GURU DELLA SALSA PICCANTE` (500–999), `MAESTRO DELLO SPIEDO` (1000+).
  - **Kebab Index (`calculateKebabIndex`):** percentuale media di completezza delle schede Diario (`50` pt per i 4 voti base + `25` pt per `score_location` + `25` pt per `note` non vuota).
  - 4 badge personali: *Pioniere* (1 locale), *Esploratore* (5 città), *Gourmet* (15 città), *Globetrotter* (3 nazioni).
- **Motore Geodetico Offline (`src/lib/geoUtils.ts`, `src/lib/wishlistSort.ts`):**
  - Distanza con formula di Haversine (`R = 6371 km`).
  - Stima tempi di percorrenza (`estimateTravelTime`): tortuosità `1.3x` a piedi (`5 km/h`) e `1.4x` in auto (`30 km/h`).
  - Link esterni Google Maps senza costi API (`getGoogleMapsDeepLink` su coordinate disponibili; `getGoogleMapsPlaceLink` con fallback a `query_place_id` / query testuale dopo scadenza dei 30 giorni o ripristino backup).

---

## 5. Regole Vincolanti: Zero-Cost, Google Maps EEA & Privacy

1. **NO SKU Enterprise/Atmosphere & EEA "No Use With any Map":** `PLACES_BASIC_FIELD_MASK` può richiedere esclusivamente `places.id,places.location` (zero `types`). È vietato richiedere `displayName`, `formattedAddress`, `addressComponents`, `reviews`, `photos`, `rating`, `userRatingCount`, `openingHours` o `priceLevel` via server proxy. I dettagli luogo visivi su `/map` usano solo il widget Google **Places UI Kit** (`GooglePlaceDetailsWidget.tsx`) esentato EEA. In produzione `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` non può essere `"DEMO_MAP_ID"`.
2. **Ricerca On-Submit Only:** vietato introdurre autocomplete lettera-per-lettera su mappa o barra di ricerca.
3. **Kill Switch in Sviluppo e Test:** mantenere `NEXT_PUBLIC_DISABLE_PAID_APIS=1` e `DISABLE_PAID_APIS=1` in `.env.local` per evitare addebiti accidentali.
4. **Consenso Preventivo, Sensori & Attribuzione:** mappa e Turnstile mappa devono restare dietro `<MapConsentGate />` (consensi versionati TTL 180gg, scorciatoia scudo revoca su `/map`), mentre la verifica Turnstile del contatto supporto (`<SupportEmailGate />`) deve caricare lo script esterno rigorosamente on-demand solo dopo clic esplicito dell'utente; `useCompass` (`deviceorientation`) e `watchPosition` devono essere vincolati a `hasGpsConsent()` con pulizia `sessionStorage` alla revoca; `<GoogleAttribution />` (`google_on_white.png` / `google_on_dark.png`) deve essere visibile su `ShopInfoCard`, `UnverifiedShopCard` e `RoutingPanel` (mai su `ZeroCostLocalMapView`); le richieste cross-origin del Service Worker devono restare `NetworkOnly`.
5. **Cache Effimera & Scadenza Coordinate (`<= 24h` / `<= 30gg`):** `map_cache` (solo `place_id` + coordinate) ha TTL massimo `24h` (`MAP_CACHE_TTL_MS`); le coordinate derivate da Google in `diary`/`wishlist` scadono automaticamente dopo `30 giorni` (`GOOGLE_COORDS_TTL_MS`) e vengono sempre rimosse in `exportBackupData`.
6. **Zero Dati Server-Side & Identità Titolare Pubblica:** non introdurre database, cookie di sessione, analytics o invio di coordinate GPS utente verso endpoint proprietari; in deploy pubblico è obbligatorio configurare `NEXT_PUBLIC_DATA_CONTROLLER_NAME` e `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION` (verificati da `scripts/cf-deploy-guard.mjs`), rendendo sempre raggiungibili `<AppFooter />` e `<ControllerIdentityNotice />`.

---

## 6. Design System & Quality Gate

- **Design System Flat-Smussato 2D (`DESIGN.md`):** font obbligatorio **Quicksand**, `.flat-press` sui pulsanti, bordi solidi 1px, token semantici Light/Dark Mode, icone esclusivamente `lucide-react`.
- **Pipeline Legale (`scripts/generate-docs.mjs`):** eseguito automaticamente in `predev`, `prebuild` e `prebuild:cf`; compila `docs/{COOKIE_POLICY,PRIVACY_POLICY,TERMS_OF_SERVICE}.md` in `src/lib/docs-generated.ts`.
- **Release Gate Obbligatorio dopo ogni modifica:**
  1. `npm run lint`
  2. `npm run typecheck`
  3. `npm run test`
  4. `npm run verify:compliance:repo`
  5. `npm run build`
  6. `npm run build:cf`
