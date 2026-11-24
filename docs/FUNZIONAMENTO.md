# KebApps Local — Funzionamento Core dell'Applicazione

Questo documento descrive il funzionamento reale di **KebApps Local (`kebapps-local` v2.0.0)**: un'applicazione **100% local-first** senza account, senza database remoto e senza contenuti pubblici generati dagli utenti.

---

## 1. Mappa Interattiva, Consenso e Ricerca Geografica

La vista `/map` integra Google Maps Platform rispettando la privacy dell'utente e la **Strict Zero-Cost Policy**:

1. **Consenso Preventivo (`MapConsentGate`, GPS & Sensori):** l'SDK di Google Maps e il widget Turnstile non vengono caricati finché l'utente non clicca *"Accetta e carica mappa"*. Il rifiuto o consenso viene salvato in `localStorage` con versione policy e TTL di 180 giorni (`kebapp_maps_consent`, senza salvataggio in modalità dimostrativa Zero-Cost), lasciando pienamente usabili Home, Diario, Wishlist e Profilo. Analogamente, GPS (`navigator.geolocation`) e bussola (`useCompass` via `deviceorientation`) restano inattivi senza consenso esplicito `hasGpsConsent()`; la revoca (anche via pulsante scudo in `/map`) arresta `watchPosition` e pulisce `sessionStorage`. Quando l'utente centra la mappa live sulla propria posizione GPS, le coordinate restano sul dispositivo e viene inviato a `GET /api/shops` il riquadro visibile quantizzato a griglia `~550 m` (`0.005°`).
2. **Scoperta POI Live (`GET /api/shops`) & Places UI Kit:** al movimento o ricerca sulla mappa (con `zoom >= 13` e span <= `1.2°`), il browser invia il token Turnstile (`shops_search`) al proxy stateless che interroga Google Places API (New) con `PLACES_BASIC_FIELD_MASK` (`places.id,places.location`, zero `types`, o fixture dimostrative locali se `DISABLE_PAID_APIS=1`). I dettagli visivi di un pin Google vengono renderizzati lato client tramite il componente ufficiale **Places UI Kit** (`GooglePlaceDetailsWidget.tsx`), mentre al salvataggio in Diario/Wishlist l'utente assegna manualmente una propria etichetta testuale personale.
3. **Ricerca Indirizzi On-Submit (`GET /api/geocode-search`):** nessun autocomplete lettera-per-lettera; la ricerca parte solo all'invio esplicito da `MapSearchBar.tsx` (action Turnstile `geocode_search`) e in modalità live restituisce esclusivamente le coordinate del miglior match per centrare la viewport.
4. **Pin Dinamici Personali (`DynamicShopPin`):** i marker sulla mappa riflettono esclusivamente lo stato personale locale dell'utente:
   - **Visitato (nel Diario):** anello verde smeraldo + pillola con il voto personale.
   - **In Wishlist:** anello ambra + icona segnalibro.
   - **Non visitato:** marker kebab standard.

---

## 2. Filtro POI Deterministico Server-Side

L'endpoint `GET /api/shops` applica una validazione deterministica minima sui risultati Google Places senza acquisire né trattare `types`, nomi o indirizzi testuali lato server:
1. Verifica che `id` sia una stringa non vuota e che `latitude`/`longitude` siano numeri finiti validi (`hasValidPlaceLocation`).
2. Restituisce esclusivamente identificativo `place_id` e coordinate finite valide (senza richiedere `types` né dati descrittivi al server).

---

## 3. Routing e Stime 100% Offline (Haversine)

In `src/lib/geoUtils.ts`, distanze e tempi stimati sono calcolati esclusivamente sul dispositivo dell'utente a costo zero:
- **Distanza (`calculateHaversineDistance`):** formula geodetica di Haversine con raggio terrestre `R = 6371 km`.
- **Stima ETA (`estimateTravelTime`):** fattori di tortuosità `1.3x` a piedi (`5 km/h`) e `1.4x` in auto (`30 km/h`).
- **Navigazione Esterna (`getGoogleMapsDeepLink`, `getGoogleMapsPlaceLink`):** apre Google Maps usando le coordinate se ancora valide, oppure facendo fallback automatico a `query_place_id` / query testuale dopo la scadenza a 30 giorni (`GOOGLE_COORDS_TTL_MS`) o il ripristino di un backup JSON.

---

## 4. Diario Personale (`/diary`) & Valutazione a 5 Dimensioni

L'utente registra e aggiorna sul proprio dispositivo le proprie degustazioni (`DiaryEntry` in IndexedDB, store `diary`):
- **4 dimensioni obbligatorie (1–5):** Carne, Pane/Piadina, Salse, Prezzo/Qualità.
- **1 dimensione opzionale (1–5):** Location (`score_location`).
- **Nota testuale:** fino a `280` caratteri (`MAX_DIARY_NOTE_LENGTH`).
- **Calcolo Media (`calculateReviewAverage`):** media aritmetica dei 4 voti base più `score_location` (o media dei 4 base se non compilata).
- **Etichette Esperienziali (`ratingLabels.ts`):** `5` *Da Sogno*, `4` *Garanzia*, `3` *Buon Alleato*, `2` *Spuntino Smart*, `1` *In Esplorazione*.
- **Filtri e Ricerca Client-Side:** ricerca istantanea per nome, città, nazione o nota, filtro per voto (`Tutti`, `Voto 4+`, `Solo Da Sogno 4.5+`) e ordinamento (`Più recenti`, `Voto più alto`, `Nome A-Z`).

---

## 5. Wishlist Locale (`/wishlist`)

La lista desideri (`WishlistEntry` in IndexedDB, store `wishlist`) consente di:
- Salvare locali dalla mappa oppure aggiungerli manualmente da `/wishlist` (`shop_label` + `note` max 200 char).
- Modificare le note inline in qualsiasi momento.
- Ordinare per **Data Aggiunta** o per **Distanza GPS (Offline)** tramite `sortWishlistByDistance` e `navigator.geolocation` (previo consenso `useGpsConsent`).
- **Convertire con 1 tap in visita del Diario:** apre `DiaryEntryModal` precompilato e, al salvataggio, rimuove automaticamente il locale dalla Wishlist.

---

## 6. Gamification Personale Locale (`src/lib/gamification.ts`)

Tutta la progressione viene ricalcolata istantaneamente sul client leggendo le voci del Diario personale:
- **Punti Esperienza (XP):**
  - `+10 XP` per ogni locale unico nel Diario (`XP_PER_DIARY_ENTRY`)
  - `+15 XP` per ogni città distinta (`XP_PER_UNIQUE_CITY`)
  - `+25 XP` per ogni nazione distinta (`XP_PER_UNIQUE_COUNTRY`)
- **Livelli:**
  1. `0–99 XP`: *PIVELLO DELLO SPIEDO*
  2. `100–249 XP`: *ESPLORATORE DELLA PITA*
  3. `250–499 XP`: *CAVALIERE DELLA CIPOLLA*
  4. `500–999 XP`: *GURU DELLA SALSA PICCANTE*
  5. `1000+ XP`: *MAESTRO DELLO SPIEDO*
- **Kebab Index (`0–100%`):** metrica media di completezza delle schede del Diario (`50` punti per i 4 voti base + `25` punti per Location + `25` punti per nota compilata).
- **4 Badge Personali:** *Pioniere* (1 locale), *Esploratore* (5 città), *Gourmet* (15 città), *Globetrotter* (3 nazioni).

---

## 7. IndexedDB, Cache Effimera Mappa & Portabilità Backup JSON

- **Database Locale (`kebapps_local_db` v1 in `src/lib/local-storage/db.ts`):** 4 object store (`profile`, `diary`, `wishlist`, `map_cache`) con fallback automatico in memoria (`MemoryStorageAdapter`) in ambienti privi di IndexedDB. Le coordinate derivate da Google salvate in `diary` o `wishlist` includono `coords_expires_at` (`GOOGLE_COORDS_TTL_MS = 30 giorni`) e vengono azzerate automaticamente in lettura alla scadenza.
- **Cache Effimera Mappa (`map_cache`):** conserva esclusivamente `place_id`, `latitude` e `longitude` per velocizzare l'apertura della mappa (nessun testo descrittivo Google); applica **TTL massimo 24 ore** (`MAP_CACHE_TTL_MS = 86_400_000`) e limite LRU a **150 voci** (`MAP_CACHE_MAX_ENTRIES`), con purga automatica dei record scaduti.
- **Backup JSON & Reset (`src/lib/local-storage/backup.ts`, `src/lib/local-user-state.ts`):**
  - `exportBackupData` esporta in un file `.json` versionato (`schema_version: 1`, `app: "kebapps-local"`, max `2 MB`) esclusivamente `profile`, `diary` e `wishlist` (mai `map_cache` e senza esportare coordinate Google con `coords_expires_at !== null`).
  - L'importazione valida rigorosamente il payload con `BackupBundleSchema` e consente la scelta esplicita tra **Sovrascrivi Tutto (`replace`)** e **Unisci ai Dati (`merge`)**.
  - Il reset completo rimuove anche chiavi PWA/onboarding e invia al Service Worker il comando `KEBAPPS_PURGE_PRIVATE_CACHES`.
- **Funzionamento Offline (`/~offline`) & Service Worker (`next.config.mjs`):** le richieste cross-origin (`!sameOrigin`) verso Google Maps o Cloudflare Turnstile sono forzate su `NetworkOnly` in Workbox per evitare caching offline indesiderato, mentre in assenza di rete la PWA mostra profilo, Diario e Wishlist già salvati sul dispositivo.
- **Trasparenza GDPR:** `<AppFooter />` (nascosto su `/map`) espone su tutte le viste informative e contatto; `<ControllerIdentityNotice />` mostra sulle pagine legali il Titolare configurato via `NEXT_PUBLIC_DATA_CONTROLLER_NAME` e `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION`.
