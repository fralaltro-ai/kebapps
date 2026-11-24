# Changelog — KebApps

## [Unreleased] - 2026-11-18

### Compliance Audit Hardening (Google Maps Platform EEA, GDPR, ePrivacy & Sensori)
- **Conformità Google Maps Platform EEA (*No Use With any Map*):**
  - Ridotto `PLACES_BASIC_FIELD_MASK` a `places.id,places.location,places.types` (rimossi `displayName`, `formattedAddress`, `addressComponents` dai proxy server `/api/shops` e `/api/geocode-search`); aggiunti `Cache-Control: no-store, max-age=0` sulle risposte live e ridotto `/api/geocode-search` live a un solo match di coordinate.
  - Rimosso il modulo orfano `src/lib/geoTranslation.ts` (`normalizeGeographicInfo`) e i filtri testuali su nomi/indirizzi Places lato server.
  - Introdotto `<GooglePlaceDetailsWidget />` (`src/components/map/GooglePlaceDetailsWidget.tsx`) basato su **Places UI Kit** (`<gmp-place-details-compact>`, esentato EEA), separato dal salvataggio manuale dell'etichetta locale su Diario/Wishlist e aggiornato `GoogleAttribution` per conformità di contrasto in Dark Mode (`>= 4.5:1`).
  - Aggiunta scadenza automatica a 30 giorni (`GOOGLE_COORDS_TTL_MS` / `coords_expires_at`) per coordinate derivate da Google in `diary` e `wishlist`, azzeramento automatico su lettura (`db.ts`), esclusione dai backup JSON (`exportBackupData`) e fallback link esterni via `getGoogleMapsPlaceLink(..., query_place_id)`.
  - Limitata la cache effimera `map_cache` (TTL `24h`, max 150 voci LRU) a soli `place_id`, `latitude` e `longitude`.
- **Sensori Device, Service Worker & Reset Locale:**
  - Vincolato `useCompass` (`deviceorientation`) al consenso esplicito `hasGpsConsent()` con pulizia automatica di `sessionStorage` (`kebapp_last_user_pos`) e arresto di `watchPosition` alla revoca.
  - Isolato il Service Worker Workbox (`next.config.mjs`) con regola prioritaria `NetworkOnly` su tutte le richieste cross-origin (`!sameOrigin`) per prevenire caching involontario di risposte Google/Turnstile; estesa la pulizia `clearLocalUserState` a chiavi PWA/onboarding e messaggio `KEBAPPS_PURGE_PRIVATE_CACHES`.
- **Trasparenza GDPR & Hardening Deploy (`Art. 12–13 GDPR`):**
  - Ripristinato `<AppFooter />` globale (`src/components/layout/AppFooter.tsx`, nascosto su `/map` per non ostacolare la mappa full-screen) con collegamenti immediati da qualsiasi pagina a Privacy Policy, Cookie Policy, Termini di Servizio e contatto diretto.
  - Aggiunto `<ControllerIdentityNotice />` sulle pagine legali tramite `NEXT_PUBLIC_DATA_CONTROLLER_NAME` e `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION`, con blocco automatico pre-deploy in `scripts/cf-deploy-guard.mjs` e verifica CI `consent_and_transparency_guards` in `scripts/verify-compliance.mjs` (8/8 controlli).
  - Aggiornate `docs/PRIVACY_POLICY.md`, `docs/COOKIE_POLICY.md` e `docs/TERMS_OF_SERVICE.md` (v2.3) e rimosso il file `.env` duplicato nella root.

## [2.0.0] - 2026-11-16

### Architettura 100% Local-First, Sicurezza & Rilascio Open Source
- **Zero database remoto, zero account, zero UGC pubblici:** tutti i dati personali (Profilo locale, Diario, Wishlist) sono salvati esclusivamente nel browser tramite IndexedDB (`kebapps_local_db` v1) con fallback in-memory, validazione Zod `.strict()` ed export/import Backup JSON (`replace` / `merge`).
- **Solo 2 proxy `GET` stateless:** `GET /api/shops` e `GET /api/geocode-search`, protetti da Cloudflare Turnstile (`shops_search`, `geocode_search`) e rate limiting in-memory per IP. Rimosso l'endpoint inutilizzato `/api/shops/refresh`.
- **Strict Zero-Cost & Google Maps EEA Compliance:** `X-Goog-FieldMask` Basic (`PLACES_BASIC_FIELD_MASK`), ricerca solo *On-Submit*, Kill Switch locale (`DISABLE_PAID_APIS=1`) con vista locale Zero-Cost utilizzabile anche senza API key Google, gate di consenso preventivo `<MapConsentGate />`, `<GoogleAttribution />`, cache effimera mappa `<= 24h` (max 150 voci LRU) esclusa dai backup, e calcoli distanze/ETA 100% offline con formula di Haversine.
- **Razionalizzazione UX Supporto & Documentazione:** rimossi il footer globale, le rotte duplicate e i componenti/font morti ereditati dalla v1; unificati supporto statico (`mailto:` / repository opzionale) e documenti legali (`/privacy-policy`, `/cookie-policy`, `/terms`) nella sezione **"Supporto, Info & Documenti"** in `/profile`.
- **Rilascio Open Source (Licenza MIT):** aggiunti `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, guida passo-passo "Uso a Casa" (`Zero-Cost` e `BYOK` in `README.md`), allineamento dominio/contatti (`kebapps.app`, `support@kebapps.app`), rimozione simbolo di marchio registrato e disattivazione invocation logs IP in `wrangler.jsonc`.
