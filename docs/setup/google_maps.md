# Configurazione Google Maps Platform — KebApps Local

KebApps Local utilizza le API **Google Maps Platform** in modalità stateless e sotto rigida **Strict Zero-Cost Policy** ed **EEA Terms compliance** (*No Use With any Map*) tramite field mask senza testi descrittivi lato server, widget **Places UI Kit** lato client e ricerca esclusivamente *On-Submit*.

---

## 1. API da Abilitare in Google Cloud Console

Nella sezione **APIs & Services > Library** del progetto Google Cloud abilita esclusivamente:
1. **Maps JavaScript API:** rendering della mappa interattiva client-side su `/map` (caricata solo dopo il consenso in `MapConsentGate`).
2. **Places API (New):** interrogata dal proxy stateless `/api/shops` (`places:searchText`) per ottenere esclusivamente `id`, `location` e `types`.
3. **Places UI Kit:** rendering lato client dei dettagli testuali dei luoghi su `/map` tramite `<gmp-place-details-compact>` (`GooglePlaceDetailsWidget.tsx`), esentato dalle restrizioni EEA sul riutilizzo con mappe.
4. **Geocoding API:** interrogata dal proxy `/api/geocode-search` solo su invio esplicito dell'utente (*On-Submit*) per centrare la mappa tramite coordinate.

---

## 2. Sicurezza e Restrizioni delle Chiavi API

Utilizzare **due chiavi distinte** in Google Cloud Console:

### A. Chiave Frontend (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- **Application restrictions:** `Websites` (HTTP referrers), limitata ai domini esatti dell'app (es. `https://kebapps.app/*`, `http://localhost:3000/*`, `http://localhost:8787/*`).
- **API restrictions:** limitata esclusivamente a `Maps JavaScript API` e `Places UI Kit`.

### B. Chiave Backend (`GOOGLE_PLACES_BACKEND_KEY`)
- **Application restrictions:** restrizioni server/IP o assenza di esecuzione lato browser (mai esposta con prefisso `NEXT_PUBLIC_`).
- **API restrictions:** limitata esclusivamente a `Places API (New)` e `Geocoding API`.

---

## 3. Regole Vincolanti di Ottimizzazione Costi, EEA Terms & Field Masking

- **EEA "No Use With any Map" & NO SKU Enterprise/Atmosphere:** nelle chiamate server-side a Google Places API (New) è **severamente vietato** richiedere `displayName`, `formattedAddress`, `addressComponents`, `reviews`, `photos`, `rating`, `userRatingCount`, `openingHours`, `priceLevel` o campi equivalenti.
- **`PLACES_BASIC_FIELD_MASK` (`src/lib/map-proxy-config.ts`):**
  - `/api/shops` invia esclusivamente `X-Goog-FieldMask: places.id,places.location` (zero `types` e zero testo descrittivo). In produzione `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` non può essere `"DEMO_MAP_ID"`.
- **Scadenza Coordinate a 30 Giorni (`GOOGLE_COORDS_TTL_MS`):**
  - La cache mappa effimera `map_cache` (`<= 24h`) salva solo `place_id` e coordinate (`latitude`, `longitude`); le coordinate derivate da Google salvate in `diary`/`wishlist` scadono automaticamente dopo 30 giorni solari e non vengono esportate nei Backup JSON.
- **On-Submit Search Only:** nessun autocomplete lettera-per-lettera nella barra di ricerca mappa (`MapSearchBar.tsx`).
- **Calcoli Geodetici Offline:** distanze Haversine e stime tempi di percorrenza sono calcolati lato client in `src/lib/geoUtils.ts` senza Google Distance Matrix / Routes API.
- **Hard Quotas giornaliere consigliate su Google Cloud Console (unico tetto bloccante):**
  - Maps JavaScript API: ~`330` caricamenti/giorno (per restare entro la soglia gratuita mensile).
  - Places UI Kit: ~`330` rendering dettagli/giorno.
  - Geocoding API: ~`330` richieste/giorno.
  - Places API (New) Text Search: ~`165` richieste/giorno, più budget alert a `0,01 €` / `1,00 €` (**nota:** i Budget Alert di Google Cloud inviano solo notifiche email e **non** fermano la fatturazione senza Hard Quotas giornaliere).

---

## 4. Kill Switch per Sviluppo Locale e Emergenze

Impostando in `.env.local` (e/o nei secrets Cloudflare):

```env
NEXT_PUBLIC_DISABLE_PAID_APIS="1"
DISABLE_PAID_APIS="1"
```

La funzione `paidApisDisabled()` (`src/lib/cost-guard.ts`) blocca ogni chiamata esterna verso `places.googleapis.com` e `maps.googleapis.com/maps/api/geocode/json`, servendo invece le fixture deterministiche `LOCAL_DEV_SHOP_FIXTURES` e `LOCAL_DEV_GEOCODE_FIXTURES` a costo `0,00 €`.
