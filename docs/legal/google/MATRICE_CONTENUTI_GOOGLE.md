# Contenuti Google Maps Platform: Matrice di Conformità Contrattuale (EEA)

**Ultimo aggiornamento:** 18 Novembre 2026  
**Architettura valutata:** `kebapps-local` v2.0.0 (**100% Local-First**, conformità EEA *No Use With any Map*, zero database server-side, zero classifiche pubbliche di terzi).  
*Nota: documento tecnico-fattuale di tracciamento interno; non costituisce parere legale formale.*

---

## 1. Evoluzione Architetturale rispetto alla v1 (Risoluzione del Rischio Storico)

Nella precedente architettura social v1, il server salvava in modo persistente i campi `name`, `address`, `city`, `region`, `country` e `types` provenienti da Google Places API e li mostrava in classifiche pubbliche accessibili a tutti gli utenti, generando una non conformità rispetto ai **Google Maps Platform EEA Terms** (in vigore dall'8 luglio 2025).

Con l'architettura local-first e il successivo hardening EEA (**v2.0.0**):
- **Eliminazione integrale del database server-side:** nessun dato proveniente da Google Places o Geocoding API viene memorizzato su server, database o file di sistema.
- **Eliminazione di testi descrittivi Places/Geocoding su mappa e proxy:** `/api/shops` richiede e restituisce esclusivamente `place_id`, `latitude` e `longitude` (zero `types`, zero dati descrittivi server-side), e `/api/geocode-search` restituisce in modalità live solo le coordinate principali (`place_id`, `lat`, `lon`).
- **Rendering dettagli tramite Places UI Kit & Label utente:** su `/map`, i dettagli visivi dei locali Google vengono mostrati esclusivamente tramite `<GooglePlaceDetailsWidget />` (`<gmp-place-details-compact>`), mentre qualsiasi nome salvato in `diary` o `wishlist` nasce da inserimento manuale dell'utente.

---

## 2. Regole Contrattuali EEA Rilevanti

1. **Divieto *No Use With any Map* & Conservazione (`Places` / `Geocoding` EEA Terms):** al di fuori di `place_id`, `latitude` e `longitude` (queste ultime limitate al massimo a 30 giorni solari consecutivi, `GOOGLE_COORDS_TTL_MS`), nessun contenuto testuale o attributo restituito da Places API / Geocoding API viene conservato, cachato o re-iniettato nella mappa.
2. **Solo Field Mask Minimo (`X-Goog-FieldMask`):** `PLACES_BASIC_FIELD_MASK = "places.id,places.location"`, con divieto assoluto di richiedere `types`, `primaryType`, `displayName`, `formattedAddress`, `addressComponents`, `reviews`, `photos`, `rating`, `userRatingCount`, `openingHours` o `priceLevel`.
3. **Attribuzione, UI Kit e Termini Utente Finale:** `<GoogleAttribution />` visibile sulle schede Google (`ShopInfoCard`, `UnverifiedShopCard`, `RoutingPanel`), con asset ufficiali `/images/google_on_white.png` in Light Mode e `/images/google_on_dark.png` in Dark Mode, assente nella vista demo non-Google `ZeroCostLocalMapView`; Places UI Kit con attribuzione nativa; richiamo espresso ai *Termini aggiuntivi di Google Maps/Google Earth*, alle *Norme sulla privacy di Google* e alle esclusioni marchi (`THIRD_PARTY_NOTICES.md`) nelle Sezioni 4 e 5 di `docs/TERMS_OF_SERVICE.md`.

---

## 3. Matrice dei Flussi e Dati Google nell'Architettura Attuale (`kebapps-local` v2.0.0)

| Origine / Flusso | Dove Transita o Risiede | Durata / TTL | Finalità & Controllo | Stato Conformità |
|---|---|---|---|---|
| **Maps JavaScript API** (`KebabMap.tsx`) | Solo browser utente | Solo sessione di rendering mappa | Caricata **esclusivamente dopo consenso esplicito** (`MapConsentGate`, con chiave API live e `Map ID` reale in produzione mai `DEMO_MAP_ID`); Service Worker con regola `NetworkOnly` su richieste `!sameOrigin` | Conforme |
| **Places UI Kit (`<gmp-place-details-compact>`)** (`GooglePlaceDetailsWidget.tsx`) | Solo browser utente (Shadow DOM Google) | Solo sessione di visualizzazione scheda | Mostra nome, indirizzo e attribuzione nativa Google senza estrarre né salvare testi Google nel codice/storage applicativo | Conforme (widget esentato EEA) |
| **Proxy Stateless `/api/shops`** (`places.googleapis.com`) | Solo RAM del Worker durante la richiesta HTTP | **0 ms** di persistenza server (`Cache-Control: no-store, max-age=0`) | `X-Goog-FieldMask` limitato a `places.id,places.location` (zero `types`, zero dati descrittivi; o fixture dimostrative locali con `DISABLE_PAID_APIS=1`); bounding box quantizzato `~550 m`; tutti i campi testuali a `null` in live | Conforme |
| **Proxy Stateless `/api/geocode-search`** (`maps/api/geocode/json`) | Solo RAM del Worker durante la richiesta HTTP | **0 ms** di persistenza server (`Cache-Control: no-store, max-age=0`) | Ricerca esplicita *On-Submit Only* per centrare la mappa; restituisce al massimo `1` match con soli `place_id`, `lat`, `lon` in live | Conforme |
| **Cache Tecnica Mappa Client (`map_cache` in IndexedDB)** (`src/lib/local-storage/db.ts`) | Solo browser dell'utente | **≤ 24 ore** (`MAP_CACHE_TTL_MS = 86_400_000`), cap LRU `150` voci, purga automatica | Conserva **solo** `place_id`, `latitude` e `longitude` (nessun testo descrittivo); **esclusa dai Backup JSON** (`backup.ts`) e cancellata al reset | Conforme |
| **Diario e Wishlist Personali (`diary`, `wishlist` in IndexedDB)** | Solo dispositivo dell'utente (mai su server, mai visibili a terzi) | Testo utente fino a cancellazione; **coordinate Google ≤ 30 giorni** (`GOOGLE_COORDS_TTL_MS`) | Note e etichette personali inserite dall'utente; azzeramento automatico di `latitude`/`longitude` alla scadenza di 30 giorni (`db.ts`), esclusione delle coordinate Google da `exportBackupData` (`backup.ts`) e link esterni via `getGoogleMapsPlaceLink(..., query_place_id)` | Conforme |

---

## 4. Presidi Automatici di Verifica

Lo script `scripts/verify-compliance.mjs --repo-only` (`npm run verify:compliance:repo`) verifica ad ogni rilascio tutti gli 8 presidi:
1. Assenza di dipendenze, directory, import o segreti legacy per database remoti, cache KV, email transazionali o autenticazione (`no_legacy_dependencies`, `no_legacy_imports_in_src`).
2. Endpoint proxy esclusivamente `GET` stateless senza persistenza server o Server Actions (`stateless_get_only_api`).
3. `X-Goog-FieldMask` privo di campi Enterprise/Atmosphere e di campi testuali `displayName`, `formattedAddress`, `addressComponents` (`google_places_zero_cost_fieldmask`).
4. `MAP_CACHE_TTL_MS <= 24 ore` (`86_400_000 ms`), `MapCacheEntrySchema` privo di campi testuali, `GOOGLE_COORDS_TTL_MS` (30 giorni) su `diary`/`wishlist` ed esclusione da `exportBackupData` (`ephemeral_map_cache_and_backup_isolation`).
5. `<MapConsentGate />` e `<GoogleAttribution />` sulle schede mappa live (`ShopInfoCard`, `UnverifiedShopCard`, `RoutingPanel`), assenza watermark su `ZeroCostLocalMapView` (`map_consent_gate_and_google_attribution`).
6. Documenti legali e `src/lib/docs-generated.ts` allineati e privi di simboli di marchio registrato o domini obsoleti (`legal_and_technical_docs_aligned`).
7. Consenso `hasGpsConsent` su `useCompass.ts`, presenza `<AppFooter />`, regola Workbox `!sameOrigin -> NetworkOnly` in `next.config.mjs` e `<ControllerIdentityNotice />` sulle pagine legali (`consent_and_transparency_guards`).
