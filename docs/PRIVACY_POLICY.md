# Informativa sulla Privacy (GDPR) — KebApps (Versione Local-First)

**Versione:** 2.5
**Data ultimo aggiornamento:** 24 Novembre 2026

La presente Informativa descrive in modo trasparente le modalità di funzionamento di **KebApps** (di seguito, il **"Servizio"**), applicazione web progressiva (PWA) con archiviazione locale dei dati personali dell'utente, ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 (**GDPR**), del D.Lgs. 196/2003 (Codice Privacy come modificato dal D.Lgs. 101/2018) e della normativa ePrivacy (Direttiva 2002/58/CE / art. 122 Codice Privacy).

---

## 1. Titolare del Trattamento e Contatti

I riferimenti completi del Titolare del Trattamento per l'istanza pubblica (nome e cognome, luogo di residenza completo di città e provincia e recapito email dedicato **`support@kebapps.app`**) sono sempre esposti nel riquadro informativo pubblico in calce a questa pagina e nelle pagine legali del Servizio.

---

## 2. Architettura "Dati sul Dispositivo & Zero Database Server"

**KebApps** non dispone di un database remoto applicativo, non prevede registrazione o account utente e non archivia sui propri server né profili, né recensioni, né liste desideri.

I contenuti che inserisci volontariamente nell'app (nickname locale, avatar scelto, valutazioni nel Diario, note personali, luoghi salvati nella Wishlist) rimangono esclusivamente nella memoria del tuo browser/dispositivo tramite **IndexedDB** e **localStorage**.

**Distinzione giuridica importante:** l'assenza di un database server non esclude che la navigazione web e le funzioni opzionali comportino trattamenti di dati tecnici di rete (come l'indirizzo IP pubblico, gli header HTTP, le coordinate dell'area di mappa consultata o i parametri delle ricerche inviate) da parte dell'infrastruttura CDN/edge e dei fornitori esterni descritti alla Sezione 5.

---

## 3. Dati Conservati Localmente sul Tuo Dispositivo

Quando utilizzi l'app, i seguenti dati sono salvati solo nel tuo browser:

1. **Database locale IndexedDB (`kebapps_local_db`):**
   - `profile`: scritto in modo **differito (lazy)** esclusivamente quando salvi una modifica al profilo locale (nickname e scelta fra 5 mascotte SVG predefinite) o aggiungi una voce al Diario/Wishlist; la semplice consultazione iniziale dell'app non crea alcun record persistente di profilo;
   - `diary`: schede personali delle degustazioni (etichetta testuale scelta dall'utente, voti da 1 a 5, eventuale nota fino a 280 caratteri, data visita, eventuale nome/luogo inserito o confermato dall'utente); le eventuali coordinate associate derivate da Google Maps vengono azzerate automaticamente dopo **30 giorni solari** (`GOOGLE_COORDS_TTL_MS`) e sono sempre escluse dall'esportazione JSON;
   - `wishlist`: locali da provare inseriti o salvati dall'utente (etichetta, eventuale nota fino a 200 caratteri, ordinamento personalizzato, data di aggiunta), anch'essi soggetti all'azzeramento automatico dopo **30 giorni solari** per eventuali coordinate derivate da Google Maps ed esclusi dal backup JSON;
   - `map_cache`: cache tecnica effimera delle sole coppie `place_id` + coordinate (`latitude`, `longitude`) con scadenza automatica massima di **24 ore** (`MAP_CACHE_TTL_MS`) e tetto massimo di **150 voci** con rimozione LRU; non contiene nomi né indirizzi di locali forniti da Google e non viene mai esportata nei backup.
2. **`localStorage` e `sessionStorage`:**
   - Consensi versionati (`kebapp_maps_consent`, `kebapp_gps_consent`) salvati in formato JSON con versione policy corrente (`2.5`) e durata massima di **180 giorni**; in modalità dimostrativa Zero-Cost (senza chiave Google Maps attiva) nessun consenso Google Maps viene richiesto o memorizzato;
   - Preferenze UI e contatore tecnico onboarding/installazione PWA (`kebapp-theme`, `kebapp_onboarding_done`, `kebapp_pwa_dismissed`, `kebapp_ios_pwa_dismissed`, `kebapp_sessions`), senza attivazione né incremento di `kebapp_sessions` sulle pagine legali (`/privacy-policy`, `/cookie-policy`, `/terms`) né sulla vista `/~offline`;
   - Posizione GPS effimera solo di scheda (`sessionStorage` chiave `kebapp_cached_pos`), cancellata alla chiusura della scheda o immediatamente alla revoca del consenso GPS.

Puoi esportare il backup JSON locale (privo di `map_cache` e di coordinate derivate da Google soggette a scadenza), importarlo o cancellare integralmente tutti i dati applicativi locali dalla sezione **Profilo → Gestione Dati**. Il tema grafico (`kebapp-theme`) e le risorse statiche pre-scaricate dal browser restano gestibili dalle impostazioni del browser stesso.

---

## 4. Ricerca Luoghi, Bounding Box Quantizzato e Geolocalizzazione

- **Mappa Google e Place Details (solo previo consenso):** l'SDK di Google Maps (`@react-google-maps/api`) e il widget ufficiale Google Places UI Kit (`<gmp-place-details-compact>`) vengono caricati sul tuo browser **solo dopo consenso esplicito** nel gate `MapConsentGate`. Una volta accettato, il caricamento delle tile di mappa e delle schede dettaglio avviene direttamente dal tuo browser verso i server Google in base all'area geografica visualizzata (viewport).
- **Proxy API Stateless `/api/shops` e `/api/geocode-search`:**
  - `/api/shops` trasmette ai server Google Places API (New) una **bounding box quantizzata a griglia di `0,005°` (~550 m × 550 m)** centrata sull'area di mappa visibile (con un margine minimo del `5%` per evitare richieste ridondanti ai micro-spostamenti), senza utilizzare le coordinate GPS grezze esatte del singolo utente. L'endpoint richiede esclusivamente `places.id` e `places.location` (zero campi descrittivi, zero `types`, zero dati personali).
  - `/api/geocode-search` si attiva esclusivamente su invio esplicito (**On-Submit**, nessun completamento automatico lettera per lettera) per tradurre un indirizzo o località digitata in una coppia di coordinate per centrare la mappa, restituendo al massimo 1 risultato (`place_id`, `lat`, `lon`).
  - Entrambi gli endpoint sono 100% **stateless** e restituiscono header `Cache-Control: no-store, max-age=0`.
- **Geolocalizzazione GPS e Bussola (`deviceorientation`):** l'accesso al GPS del dispositivo e all'eventuale orientamento bussola avviene solo dopo tua azione e consenso esplicito (`GeoPermissionPrompt` o toggle in **Profilo → Preferenze** + permesso del sistema operativo). Le coordinate GPS vengono elaborate localmente nel browser per calcolare distanze e centrare la mappa e **non vengono inviate ad alcun database o API proprietaria del Titolare**.

---

## 5. Infrastruttura di Rete, Destinatari, Basi Giuridiche e Trasferimenti Extra-UE

Per ciascun trattamento esterno si applica **una singola base giuridica determinata** (nessuna sovrapposizione ambigua):

1. **Cloudflare, Inc. — Hosting Edge, CDN, WAF, Network Error Logging e Cloudflare Turnstile (USA / Rete Globale):**
   - **Dati trattati:** indirizzo IP, header HTTP/TLS, telemetria tecnica anti-bot di Cloudflare Turnstile (validata sugli endpoint `/api/shops` e `/api/geocode-search` dietro caricamento post-consenso in mappa) e contatori effimeri di rate-limiting in memoria RAM sui nodi edge (`10s` per `/api/geocode-search`, `60s` per `/api/shops`).
   - **Finalità e base giuridica:** sicurezza informatica, prevenzione abusi/DDoS, protezione da traffico automatizzato e continuità tecnica del Servizio ai sensi dell'**Art. 6(1)(f) GDPR** (legittimo interesse del Titolare alla sicurezza e integrità dei sistemi esposti in rete, che non prevale sui diritti dell'interessato trattandosi di controlli tecnici minimi e non profilazione pubblicitaria).
   - **Conservazione:** contatori rate-limit effimeri in RAM (`10s` / `60s`); eventuali log operativi tecnici di edge/WAF gestiti da Cloudflare secondo la finestra operativa applicabile al piano gratuito Workers/Pages e le politiche Cloudflare.
   - **Trasferimento Extra-UE:** Cloudflare, Inc. aderisce all'**EU-US Data Privacy Framework (DPF)** (Decisione di adeguatezza della Commissione Europea del 10 luglio 2023) e alle Clausole Contrattuali Standard (SCC) nel proprio Data Processing Addendum.
2. **Google LLC / Google Ireland Limited — Google Maps Platform (Maps JS SDK, Places UI Kit, Places API New, Geocoding API):**
   - **Dati trattati:** indirizzo IP, user-agent/parametri SDK nel browser dell'utente (caricamento diretto di mappa e Places UI Kit) e bounding box quantizzata (`~550 m`) / stringa di ricerca indirizzo inviata tramite proxy stateless.
   - **Finalità e base giuridica:** visualizzazione interattiva della mappa, ricerca geografica On-Submit e consultazione delle schede Google Places solo su richiesta esplicita dell'utente ai sensi dell'**Art. 6(1)(a) GDPR** (consenso preventivo espresso tramite `MapConsentGate`, revocabile in qualsiasi momento).
   - **Ruolo e Trasferimento Extra-UE:** per i servizi Google Maps Platform Google agisce secondo i termini contrattuali EEA Google Maps Platform (e relative informative privacy Google); eventuali trasferimenti verso gli USA sono presidiati dall'**EU-US Data Privacy Framework (DPF)** e dalle Clausole Contrattuali Standard (SCC).

---

## 6. Natura del Conferimento (Art. 13(2)(e) GDPR)

- I dati tecnici di connessione HTTP verso l'edge Cloudflare sono necessari per l'erogazione tecnica della pagina web e la sicurezza di rete: il rifiuto o il blocco lato browser impedisce il caricamento del Servizio.
- Il consenso al caricamento di Google Maps / Turnstile e il consenso alla geolocalizzazione GPS sono **pienamente facoltativi**: puoi negarli o revocarli in qualunque momento continuando a usare liberamente Dashboard, Diario locale, Wishlist e gestione backup sul tuo dispositivo.

---

## 7. Diritti dell'Interessato (Artt. 15–22, 7(3) e 11 GDPR)

In ogni momento puoi esercitare i seguenti diritti:

- **Accesso, rettifica, cancellazione, limitazione e portabilità (Artt. 15–20 GDPR):** per tutti i dati salvati sul tuo dispositivo puoi consultarli, modificarli, esportarli in JSON ed eliminarli autonomamente in locale tramite **Profilo → Gestione Dati** o cancellando i dati del sito dal browser. Poiché il Titolare non conserva database applicativi né profili lato server, ai sensi dell'**Art. 11 GDPR** il Titolare non è in grado di identificare né estrarre autonomamente i dati locali presenti sul tuo dispositivo senza una tua collaborazione diretta, fermo restando il riscontro trasparente per eventuali richieste scritte indirizzate a **`support@kebapps.app`**.
- **Revoca del consenso in ogni momento (Art. 7(3) GDPR):** senza pregiudicare la liceità del trattamento precedente alla revoca, puoi revocare i consensi Google Maps o GPS con 1 tap tramite l'icona scudo presente nella pagina **Mappa** oppure in **Profilo → Preferenze**, con effetto immediato e pulizia di `sessionStorage`.
- **Reclamo all'Autorità di Controllo (Art. 77 GDPR):** se ritieni che il trattamento violi il GDPR, hai diritto di proporre reclamo al **Garante per la protezione dei dati personali** (`www.garanteprivacy.it`) o all'autorità competente nello Stato membro UE di residenza o lavoro.

> **Diritto di Opposizione (Art. 21(1) e Art. 21(4) GDPR):** per i trattamenti tecnici basati sul legittimo interesse del Titolare (Art. 6(1)(f) GDPR — sicurezza di rete Cloudflare, mitigazione DDoS e protezione anti-bot Turnstile su richieste di ricerca), hai il diritto di opporti in qualsiasi momento, per motivi connessi alla tua situazione particolare, scrivendo a **`support@kebapps.app`**. In caso di opposizione, il Titolare si asterrà dal trattamento salvo dimostrare motivi legittimi cogenti prevalenti (es. difesa da attacchi o integrità dell'infrastruttura).

---

## 8. Tutela dei Minori (Art. 8 GDPR e Art. 2-quinquies D.Lgs. 196/2003)

In Italia l'età minima per prestare autonomamente il consenso digitale all'attivazione di servizi esterni come Google Maps o la geolocalizzazione è fissata a **14 anni** (Art. 2-quinquies D.Lgs. 196/2003, come modificato dal D.Lgs. 101/2018). Se hai meno di 14 anni, il consenso per i servizi esterni richiede l'autorizzazione di chi esercita la responsabilità genitoriale. Il Servizio non raccoglie intenzionalmente dati di minori su alcun server.

---

## 9. Calcoli e Elaborazioni Locali (Art. 22 GDPR)

Tutte le metriche mostrate nell'app (punteggi esperienza, indice Kebab Index, XP, badge personali, distanze geodetiche Haversine e stime indicative dei tempi di percorrenza) sono calcolate esclusivamente lato client sul tuo dispositivo mediante formule deterministiche e non costituiscono profilazione né processi decisionali automatizzati capaci di produrre effetti giuridici ai sensi dell'Art. 22 GDPR.
