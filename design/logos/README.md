# KebApps Logo History & Generation

Questa cartella (`design/logos`) contiene la storia e gli script necessari per generare il logo ufficiale dell'app KebApps.

## Script di Generazione: `build-logo-with-fonts.js`

Il logo (`public/logo.svg`) non è un semplice file vettoriale statico disegnato a mano.
Al fine di garantire che la scritta **KebApps** venga renderizzata ovunque in modo perfetto, questo script scarica dinamicamente il font vettoriale **Quicksand** da Google Fonts (pesi 500 e 700), lo converte in stringhe Base64 e lo inietta direttamente all'interno dell'SVG generato in un blocco `<style>`.

### Come utilizzarlo

Se hai bisogno di modificare le dimensioni, i colori o il testo del logo, procedi così:

1. Apri `build-logo-with-fonts.js` con un editor.
2. Cerca la variabile testuale definita all'interno del blocco `Promise.all` (intorno alla riga 38), in cui viene creato il template letterale `` const svg = `<svg...` ``.
3. Modifica i parametri `fill`, `width`, `height` o `rx` (smussatura) dei vari "salsicciotti".
4. Apri il terminale in questa cartella (`design/logos`) e lancia:
   ```bash
   node build-logo-with-fonts.js
   ```
5. Lo script rigenererà e sovrascriverà direttamente il file in `../../public/logo.svg`.
6. Successivamente, per propagare il nuovo logo a tutte le icone PWA e Splash Screen, usa dalla root del progetto il tool `pwa-asset-generator`.

## Colori Ufficiali Usati
- Sfondo: `#ea580c` (Orange-600)
- Spiedo: `#332D2D`
- Pane in alto e Salsa in basso: `#FEF9CD`
- Carne: `#664D00`
- Testo "Keb": `#111827` (Gray-900)
- Testo "Apps": `#ea580c`
