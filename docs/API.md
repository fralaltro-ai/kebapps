# KebApps Local — API Reference & External Services Policy (v2.0)

Questo documento descrive esclusivamente gli endpoint API esistenti in `kebapps-local` (**3 proxy HTTP `GET` stateless** senza persistenza server-side) e l'interfaccia di archiviazione client-side che ha sostituito database e Server Actions.

---

## 1. Google Maps Platform & Strict Zero-Cost Policy

### Servizi Esterni Utilizzati
1. **Maps JavaScript API & Places UI Kit (Client Browser):** rendering mappa (con `Map ID` reale obbligatorio in produzione, mai `DEMO_MAP_ID`), marker avanzati (`KebabMap.tsx`) e scheda dettagli luogo ufficiale (`GooglePlaceDetailsWidget.tsx` via `<gmp-place-details-compact>`), caricati **solo previo consenso esplicito** tramite `<MapConsentGate />`.
2. **Places API (New) (Server Proxy):** interrogazione `places:searchText` su `/api/shops` con i soli campi consentiti (`places.id,places.location`, zero `types`).
3. **Geocoding API (Server Proxy):** ricerca indirizzi/città **On-Submit Only** (`/api/geocode-search`, con restituzione live del solo match di coordinate principale).

### Regole Vincolanti
- **EEA "No Use With any Map" & NO SKU Enterprise/Atmosphere:** vietato richiedere `displayName`, `formattedAddress`, `addressComponents`, `reviews`, `photos`, `rating`, `userRatingCount`, `openingHours`, `priceLevel`.
- **On-Submit Only:** nessun autocomplete lettera-per-lettera.
- **Zero Persistenza Server-Side:** il Worker Cloudflare non salva né indicizza alcun risultato su database o storage remoto (`Cache-Control: no-store, max-age=0`).
- **Kill Switch (`NEXT_PUBLIC_DISABLE_PAID_APIS=1` / `DISABLE_PAID_APIS=1`):** restituisce fixture deterministiche locali (`LOCAL_DEV_SHOP_FIXTURES` e `LOCAL_DEV_GEOCODE_FIXTURES` in `src/lib/map-proxy-config.ts`) senza chiamare Google API.
- **Distanze & ETA 100% Offline:** calcolati sul browser con formula di Haversine (`src/lib/geoUtils.ts`).

---

## 2. Endpoint Proxy REST (`GET` Stateless, Zero-DB)

Tutte le route in `src/app/api/` sono **esclusivamente in lettura (`GET`)**, protette da:
1. **Rate limiting per-isolate in-memory** (`checkRateLimitFallback` in `src/lib/rate-limit-fallback.ts`) indicizzato per IP (`getClientIp`).
2. **Cloudflare Turnstile** (`validateTurnstileToken` in `src/lib/turnstile.ts`) con controllo obbligatorio di `expectedAction`.

Nessun endpoint accetta `POST`, `PUT`, `PATCH` o `DELETE`, né riceve o conserva coordinate GPS dell'utente.

### 2.1 `GET /api/shops` (`src/app/api/shops/route.ts`)
Restituisce l'elenco dei locali kebab rilevati all'interno di un bounding box geografico, filtrati dal motore euristico.

- **Rate Limit:** `30` richieste / `60s` per IP (`ratelimit_shops`).
- **Turnstile Action:** `shops_search` (header `x-turnstile-token` o query `turnstileToken`, obbligatorio; `403` se invalido).
- **Parametri Query (Zod `boundsSchema`):**
  - `northeastLat`, `northeastLng`, `southwestLat`, `southwestLng`: bounding box valido con `neLat > swLat`, `neLng > swLng` e span massimo **`MAX_BOUNDS_SPAN_DEG = 1.2`** gradi (`400` se superato).
  - `zoom`: zoom mappa >= **`MIN_MAP_ZOOM = 13`** (`400` se inferiore).
  - `q` *(opzionale)*: filtro testuale (`2..64` caratteri). Se passato senza bounds ritorna `{ shops: [], source: "local_only" }`.
- **Modalità Kill Switch (`paidApisDisabled()` o `GOOGLE_PLACES_BACKEND_KEY` assente):**
  - Ritorna `{ shops: ProxyShopResult[], source: "paid_apis_disabled" }` filtrando `LOCAL_DEV_SHOP_FIXTURES`.
- **Modalità Live Google Places API New:**
  - `POST https://places.googleapis.com/v1/places:searchText` con `X-Goog-FieldMask: places.id,places.location` (`PLACES_BASIC_FIELD_MASK`).
  - Valida esclusivamente `place_id` e coordinate finite valide (`hasValidPlaceLocation`) senza richiedere `types`, nomi o indirizzi sul server, ricevendo bounding box quantizzato a griglia `~550 m`.
  - Ritorna `{ shops: ProxyShopResult[], source: "google", saturated: boolean }` (solo `place_id`, `latitude`, `longitude`; tutti i campi testuali a `null`; `saturated: true` se Google ha restituito `>= 20` risultati grezzi) con header `Cache-Control: no-store, max-age=0`.

### 2.2 `GET /api/geocode-search` (`src/app/api/geocode-search/route.ts`)
Proxy stateless verso Google Geocoding API (tier Essentials) per spostare la mappa verso una città o un indirizzo su invio esplicito dell'utente.

- **Rate Limit:** `10` richieste / `10s` per IP (`ratelimit_geocode_search`).
- **Turnstile Action:** `geocode_search` (header `x-turnstile-token` o query `turnstileToken`, obbligatorio; `403` se invalido).
- **Parametri Query:** `q` (trim, min 2 caratteri, troncata a max 200 caratteri; se `< 2` ritorna `{ results: [] }`).
- **Modalità Kill Switch:** ritorna `{ results: GeocodeProxyResult[], source: "paid_apis_disabled" }` filtrando `LOCAL_DEV_GEOCODE_FIXTURES`.
- **Modalità Live:** chiama `https://maps.googleapis.com/maps/api/geocode/json` con timeout `5000 ms`, restituisce al massimo `1` match ridotto a `{ place_id, display_name: null, lat, lon, city: null, country: null, data_source: "google" }` con header `Cache-Control: no-store, max-age=0`.

### 2.3 `GET /api/support-contact` (`src/app/api/support-contact/route.ts`)
Endpoint stateless per rivelare il recapito email di assistenza esclusivamente dopo verifica visibile Cloudflare Turnstile (*Managed*) attivata su richiesta dall'utente, evitando l'esposizione statica in chiaro nel bundle JavaScript o nell'HTML.

- **Rate Limit:** `5` richieste / `60s` per IP (`ratelimit_support_contact`).
- **Turnstile Action:** `support_contact` (header `x-turnstile-token` o query `turnstileToken`, obbligatorio; validato con `TURNSTILE_SUPPORT_SECRET_KEY`; `403` se invalido).
- **Modalità Live:** restituisce `{ email, subject, source: "live" }` leggendo la variabile server-only `SUPPORT_EMAIL` con header `Cache-Control: no-store, max-age=0` (`503` fail-closed in produzione se `SUPPORT_EMAIL` manca o non è valida).
- **Modalità Dev (`NODE_ENV !== "production"`):** restituisce `SUPPORT_EMAIL` (o fallback locale sicuro) come `{ email, subject, source: "dev_fallback" }`.

---

## 3. Architettura Client-Side (Zero Server Actions)

Non esistono Server Actions (`"use server"`) né API di scrittura lato server. Tutte le operazioni utente avvengono sul browser tramite `src/lib/local-storage/`:
- **Profilo (`db.ts`):** `getLocalProfile`, `saveLocalProfile`, `replaceLocalProfile`
- **Diario (`db.ts`):** `listDiaryEntries`, `getDiaryEntry`, `upsertDiaryEntry`, `deleteDiaryEntry`, `clearDiaryEntries` (con azzeramento automatico su lettura di coordinate Google scadute oltre `GOOGLE_COORDS_TTL_MS = 30 giorni`)
- **Wishlist (`db.ts`):** `listWishlistEntries`, `getWishlistEntry`, `upsertWishlistEntry`, `reorderWishlistEntries`, `deleteWishlistEntry` (con azzeramento automatico di `latitude`/`longitude`/`coords_expires_at` oltre 30 giorni)
- **Cache Effimera Mappa (`db.ts`):** `upsertMapCacheEntries`, `getMapCacheEntries`, `getMapCacheEntry`, `purgeExpiredMapCache`, `clearMapCache` (soli `place_id`, `latitude`, `longitude`, TTL `<= 24h`, LRU max 150)
- **Portabilità & Reset (`backup.ts`):** `exportBackupData` (rimuove le coordinate con `coords_expires_at !== null`), `serializeBackupJson`, `parseAndValidateBackupJson`, `importBackupData`, `estimateLocalStorageUsage`, `resetAllLocalData` (inclusa pulizia chiavi PWA/onboarding e cache SW `KEBAPPS_PURGE_PRIVATE_CACHES`)
