# Contribuire a KebApps

Grazie per l'interesse nel contribuire a **KebApps**, rilasciato sotto **Licenza MIT**.

---

## 1. Principi Architetturali Inderogabili

Ogni modifica o Pull Request deve rispettare rigorosamente i seguenti vincoli:

1. **100% Local-First & Zero Server Database:**
   - Nessun database remoto, nessun sistema di autenticazione, nessuna Server Action (`"use server"`), nessun analytics/tracker di terze parti.
   - Tutti i dati utente (Profilo, Diario, Wishlist) restano sul dispositivo (`IndexedDB` + Backup JSON validato con Zod `.strict()`).
2. **Strict Zero-Cost & Google Maps EEA Compliance:**
   - `X-Goog-FieldMask` su `/api/shops` deve contenere **solo** `places.id,places.location` (`PLACES_BASIC_FIELD_MASK`): è vietato richiedere `types`, `displayName`, `formattedAddress`, `addressComponents`, `reviews`, `photos`, `rating`, `userRatingCount`, `openingHours` o `priceLevel` via proxy server. I dettagli luogo su `/map` devono usare esclusivamente `<GooglePlaceDetailsWidget />` (Places UI Kit).
   - Ricerca **On-Submit Only**: mai introdurre autocomplete lettera-per-lettera.
   - Cache mappa (`map_cache`, soli `place_id` e coordinate) effimera con TTL `<= 24h` (`MAP_CACHE_TTL_MS`), **sempre esclusa dai Backup JSON**.
   - Le coordinate derivate da Google in `diary`/`wishlist` devono rispettare il TTL massimo di 30 giorni (`GOOGLE_COORDS_TTL_MS` / `coords_expires_at`) ed essere escluse da `exportBackupData`.
   - `<MapConsentGate />` obbligatorio davanti a Google Maps/Turnstile (consensi versionati 180gg), `deviceorientation`/GPS dietro `hasGpsConsent()`, `<GoogleAttribution />` ufficiale sulle viste/schede mappa live (mai su demo offline), richieste cross-origin del Service Worker su `NetworkOnly`, `<AppFooter />`, `<ControllerIdentityNotice />` e avvisi `THIRD_PARTY_NOTICES.md` sempre presenti.
3. **Design System Flat-Smussato 2D (`DESIGN.md`):**
   - Font **Quicksand**, bordi solidi `1px`, classe `.flat-press` sui pulsanti, icone esclusivamente `lucide-react`, supporto Light/Dark Mode.
4. **Niente marchi o segreti:**
   - Non usare il simbolo di marchio (`TM`) accanto al nome del progetto, non inserire email personali o chiavi API reali.

---

## 2. Setup Locale Rapido (Modalità Casa / Zero-Cost)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Con le impostazioni predefinite di `.env.example` (`DISABLE_PAID_APIS="1"`), l'app funziona interamente in locale senza chiavi a pagamento.

---

## 3. Checklist Pre-PR (Quality & Compliance Gate)

Prima di aprire una Pull Request, verifica che tutti i controlli passino con zero errori:

```bash
npm run lint
npm run typecheck
npm run test
npm run verify:compliance:repo
npm run build
```

Se modifichi `docs/PRIVACY_POLICY.md`, `docs/COOKIE_POLICY.md` o `docs/TERMS_OF_SERVICE.md`, rigenera `src/lib/docs-generated.ts` (eseguito automaticamente da `npm run prebuild` / `npm run predev`).
