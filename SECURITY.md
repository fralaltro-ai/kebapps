# Security Policy — KebApps Local

## 1. Modello di Sicurezza & Architettura

**KebApps** è progettata secondo principi *100% local-first* e *zero-server-persistence*:
- **Zero database remoti e zero account:** tutti i dati personali (Profilo, Diario, Wishlist) risiedono esclusivamente su `IndexedDB` / `Web Storage` del dispositivo dell'utente.
- **Solo 2 proxy `GET` stateless:** `GET /api/shops` e `GET /api/geocode-search`, protetti da rate limiting in-memory per IP e verifica **Cloudflare Turnstile** *fail-closed* in produzione.
- **Zero Server Actions & Zero Upload Server-Side:** nessuna rotta di scrittura HTTP (`POST`/`PUT`/`PATCH`/`DELETE`), nessun import/export verso il server.

---

## 2. Segnalazione di Vulnerabilità

Se individui una vulnerabilità di sicurezza, un bypass delle protezioni anti-bot o una perdita involontaria di dati:
- **Non aprire issue pubbliche** con dettagli sfruttabili o chiavi esposte.
- Scrivi in privato a **`support@kebapps.app`** includendo:
  1. Descrizione tecnica del problema e superficie interessata (file/rotta).
  2. Passi minimi riproducibili o Proof of Concept locale.
  3. Impatto stimato.

---

## 3. Regole di Sicurezza per Self-Hosting & Contributor

Chi clona o ospita una propria istanza di KebApps deve attenersi scrupolosamente a queste regole:

1. **Mai committare segreti o file `.env*`:**
   - `.gitignore` blocca `.env`, `.env.*` (eccetto `.env.example`), `.dev.vars`, `*.pem`, `*.key`, `*.crt`, `*.p12`.
   - Non inserire mai chiavi reali Google Cloud, secret Turnstile o dati personali in codice, test o commit.
2. **Separazione e Restrizione delle 2 Chiavi Google Cloud:**
   - **Chiave Frontend (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`):** ristretta per *HTTP Referrer* al solo dominio esatto dell'istanza e limitata esclusivamente a **Maps JavaScript API** e **Places UI Kit**.
   - **Chiave Backend (`GOOGLE_PLACES_BACKEND_KEY`):** **mai** esposta con prefisso `NEXT_PUBLIC_`, limitata esclusivamente a **Places API (New)** e **Geocoding API**.
3. **Protezione Anti-Addebito & EEA Compliance Obbligatoria:**
   - Impostare sempre **Hard Quotas giornaliere** bloccanti su Google Cloud Console prima di disattivare il kill-switch (`Maps JS`, `Places API (New)`, `Places UI Kit`, `Geocoding`); i soli **Budget Alert** inviano email di avviso ma **non** interrompono automaticamente la fatturazione.
   - Mantenere `NEXT_PUBLIC_DISABLE_PAID_APIS="1"` e `DISABLE_PAID_APIS="1"` in sviluppo locale e CI.
   - Rispettare sempre il field mask `places.id,places.location` (zero `types`), il blocco produzione di `DEMO_MAP_ID`, i `30 giorni` massimi per coordinate Google (`GOOGLE_COORDS_TTL_MS`), i controlli di consenso preventivo versionato (`MapConsentGate`, `hasGpsConsent`) e l'isolamento `NetworkOnly` cross-origin del Service Worker.
4. **Cloudflare Turnstile & Identità Titolare GDPR in Produzione:**
   - Non usare mai le chiavi dummy di test (`1x0000...`) in produzione (`src/lib/turnstile.ts` e `scripts/cf-deploy-guard.mjs` le bloccano automaticamente).
   - Impostare `NEXT_PUBLIC_SITE_URL` sull'URL HTTPS finale dell'istanza affinché la verifica `hostname` resti valida.
   - Impostare `NEXT_PUBLIC_DATA_CONTROLLER_NAME` (nome e cognome reali o ragione sociale) e `NEXT_PUBLIC_DATA_CONTROLLER_LOCATION` prima del deploy pubblico (`scripts/cf-deploy-guard.mjs` rifiuta il deploy in assenza di un titolare reale).
