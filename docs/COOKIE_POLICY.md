# Informativa Cookie, Storage Locale e Strumenti di Tracciamento (ePrivacy)

**Versione:** 2.6
**Data ultimo aggiornamento:** 27 Novembre 2026

La presente Informativa integra l'Informativa Privacy e descrive l'uso di cookie, archivi locali del browser (`IndexedDB`, `localStorage`, `sessionStorage`, Cache API del Service Worker) e verifiche anti-bot in **KebApps**, ai sensi dell'Art. 122 del D.Lgs. 196/2003 (Codice Privacy), della Direttiva 2002/58/CE (ePrivacy) e delle *Linee guida cookie e altri strumenti di tracciamento* del Garante per la protezione dei dati personali (Provvedimento 10 giugno 2021, n. 231).

---

## 1. Zero Cookie di Profilazione e Zero Analytics

**KebApps non utilizza alcun cookie o identificatore per finalità pubblicitarie, di marketing, di analytics o di profilazione comportamentale cross-site**, né propri né di terze parti.

L'applicazione non imposta alcun cookie HTTP lato server per sessioni utente, autenticazione o tracciamento della navigazione.

---

## 2. Archivi Locali Tecnici e Consensi (Solo Dispositivo Utente)

Gli strumenti di memorizzazione locale utilizzati dall'applicazione sono esclusivamente i seguenti:

| Strumento / Chiave | Tipologia | Finalità | Durata | Base / Controllo |
| :--- | :--- | :--- | :--- | :--- |
| `kebapps_local_db` (`profile`, `diary`, `wishlist`) | `IndexedDB` | Salvataggio locale (lazy write sul profilo) dei dati creati dall'utente | Persistente fino a eliminazione utente (coord. Google max **30 gg**) | Strettamente necessario a funzioni richieste dall'utente |
| `kebapps_local_db` (`map_cache`) | `IndexedDB` | Cache effimera di soli `place_id` + coordinate per evitare chiamate duplicate | Max **24 ore** (max 150 voci LRU) | Tecnico / efficienza cache locale |
| `kebapp_maps_consent` | `localStorage` | Registrazione JSON della scelta consenso Google Maps + Turnstile (`policyVersion: "2.6"`) | Max **180 giorni** (auto-invalidato se scaduto o obsoleto) | Tecnico (prova scelta utente); **non salvato in Zero-Cost** |
| `kebapp_gps_consent` | `localStorage` | Registrazione JSON della scelta consenso GPS/bussola (`policyVersion: "2.6"`) | Max **180 giorni** (auto-invalidato se scaduto o obsoleto) | Tecnico (prova scelta utente) |
| `kebapp-theme`, `kebapp_onboarding_done`, `kebapp_pwa_dismissed`, `kebapp_ios_pwa_dismissed`, `kebapp_sessions` | `localStorage` | Preferenze interfaccia e soglia tecnica banner installazione PWA (escluso su pagine legali e `/~offline`) | Persistente fino a reset browser o sezione Dati | Tecnico / UX locale |
| `kebapp_cached_pos` | `sessionStorage` | Cache temporanea della posizione GPS in scheda attiva | Chiusura scheda o revoca immediata | Tecnico di sessione previo consenso GPS |
| Service Worker Cache (Workbox) | Cache API | Asset statici UI (`same-origin`) per vista `/~offline`; tutte le richieste esterne sono strictly `NetworkOnly` | Fino a pulizia cache o reset app | Tecnico PWA offline |

---

## 3. Servizi di Terze Parti Attivati Solo Previo Consenso o per Sicurezza Tecnica

### A. Google Maps Platform (Maps JS SDK e Places UI Kit) — **Consenso Preventivo Bloccante**
Nessuno script di Google Maps viene scaricato o eseguito prima che l'utente clicchi su **"Accetta e carica mappa"** all'interno del banner bloccante **`MapConsentGate`** su `/map`.
Una volta espresso il consenso, il browser carica direttamente da Google le risorse necessarie per mostrare la mappa interattiva e il widget Places UI Kit (`<gmp-place-details-compact>`), nel rispetto delle informative cookie e privacy di Google LLC / Google Ireland Ltd.
- In modalità **Zero-Cost Demo** (sviluppo o istanze senza chiave Google Maps configurata), il gate non viene mostrato e nessuna scelta viene scritta in `kebapp_maps_consent`.

### B. Cloudflare Turnstile (Anti-Bot su Mappa e Contatto Supporto) — **Sicurezza Tecnica & Caricamento On-Demand**
Il servizio Cloudflare Turnstile protegge da traffico automatizzato e scraping esclusivamente i 3 endpoint API stateless (`/api/shops`, `/api/geocode-search` e `/api/support-contact`):
- **Ricerca Mappa (`/api/shops`, `/api/geocode-search`):** utilizza un widget in modalità invisibile caricato sulla pagina mappa soltanto dopo l'attivazione tramite consenso mappa (`MapConsentGate`).
- **Contatto Supporto (`/api/support-contact`):** utilizza un widget dedicato in modalità visibile (*Managed*) in **Profilo → Supporto, Info & Documenti** e nel riquadro informativo Titolare delle pagine legali; lo script `challenges.cloudflare.com` viene scaricato ed eseguito **rigorosamente on-demand** solo dopo clic esplicito dell'utente sul pulsante di sblocco dell'email (mai durante la normale visita delle pagine). Nessun indirizzo email né token viene salvato in `localStorage` o `IndexedDB`.

L'eventuale token di verifica e il cookie tecnico di sicurezza (`cf_clearance`) impostato da Cloudflare sul proprio dominio / contesto anti-bot seguono rigorosamente gli attributi e i termini indicati nel *Cloudflare Turnstile Privacy Addendum* e nella *Cloudflare Privacy Policy*, esclusivamente per prevenzione abusi e sicurezza informatica.

---

## 4. Come Gestire, Rifiutare o Revocare i Consensi

1. **Rifiuto iniziale:** nel gate `MapConsentGate` o nel prompt GPS puoi chiudere o negare in qualsiasi momento; nessun consenso al caricamento Google Maps viene attivato e puoi continuare a usare il resto dell'app senza limitazioni sulle funzioni locali.
2. **Revoca con 1 tap in qualsiasi momento:**
   - direttamente sulla pagina **Mappa (`/map`)** tramite il pulsante **Privacy / Revoca Consensi** (icona scudo);
   - nella sezione **Profilo → Preferenze** tramite i toggle **Mappa Google** e **Accesso GPS**.
   La revoca disattiva immediatamente la mappa / i sensori, invalida lo stato precedente e pulisce `sessionStorage`.
3. **Pulizia integrale del dispositivo:** nella sezione **Profilo → Gestione Dati → Cancella tutti i dati locali** puoi azzerare IndexedDB, preferenze onboarding, consensi, sessionStorage e cache private PWA (restando eventualmente gestibili dal browser solo il tema UI e i file statici della shell applicazione).
