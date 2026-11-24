/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700';
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  }
};

console.log('Downloading fonts...');

https.get(url, options, (res) => {
  let css = '';
  res.on('data', (chunk) => css += chunk);
  res.on('end', () => {
    const fontFaces = css.split('@font-face');
    let targetUrl700 = '';
    let targetUrl500 = '';
    
    for (const ff of fontFaces) {
      if (ff.includes('font-weight: 700')) {
        const match = ff.match(/url\((https:\/\/[^)]+)\)/);
        if (match) targetUrl700 = match[1];
      }
      if (ff.includes('font-weight: 500')) {
        const match = ff.match(/url\((https:\/\/[^)]+)\)/);
        if (match) targetUrl500 = match[1];
      }
    }
    
    const fetchBase64 = (fontUrl) => {
      return new Promise((resolve) => {
        https.get(fontUrl, (res2) => {
          const chunks = [];
          res2.on('data', (chunk) => chunks.push(chunk));
          res2.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('base64'));
          });
        });
      });
    };
    
    Promise.all([fetchBase64(targetUrl700), fetchBase64(targetUrl500)]).then(([b64_700, b64_500]) => {
      const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Embedded Font Software: Quicksand (Copyright 2011 The Quicksand Project Authors), licensed under SIL Open Font License v1.1 (see THIRD_PARTY_NOTICES.md). -->
  <defs>
    <style>
      @font-face {
        font-family: 'Quicksand';
        font-style: normal;
        font-weight: 700;
        src: url(data:font/woff2;charset=utf-8;base64,${b64_700}) format('woff2');
      }
      @font-face {
        font-family: 'Quicksand';
        font-style: normal;
        font-weight: 500;
        src: url(data:font/woff2;charset=utf-8;base64,${b64_500}) format('woff2');
      }
    </style>
  </defs>

  <!-- Background Squircle (orange-600) -->
  <rect width="512" height="512" rx="128" fill="#ea580c"/>

  <!-- Vertical Skewer -->
  <rect x="244" y="55" width="24" height="415" rx="12" fill="#332D2D"/>

  <!-- Elemento 4 (top) - Colore uguale a quello in basso -->
  <rect x="120" y="95" width="272" height="56" rx="28" fill="#FEF9CD"/>

  <!-- Elemento 3 (bianco) - Perfetta forma a pillola (rx=36) -->
  <rect x="108" y="178" width="296" height="72" rx="36" fill="#FFFFFF"/>

  <!-- Testo KebApps con Quicksand incorporato e allineamento inline -->
  <text
    x="256" y="228"
    font-family="'Quicksand', sans-serif"
    font-weight="700"
    font-size="48"
    letter-spacing="-1.5"
    text-anchor="middle"
  >
    <tspan fill="#111827">Keb</tspan><tspan fill="#ea580c">Apps</tspan>
  </text>

  <!-- Elemento 2 (carne) - Forma semi-rettangolare come richiesto (rx=25) -->
  <rect x="158" y="277" width="196" height="92" rx="25" fill="#664D00"/>

  <!-- Elemento 1 (bottom) -->
  <rect x="196" y="396" width="120" height="50" rx="25" fill="#FEF9CD"/>
</svg>`;
      
      const outputPath = path.resolve(__dirname, '../../public/logo.svg');
      fs.writeFileSync(outputPath, svg, 'utf8');
      console.log('SVG generato con successo in', outputPath);
    });
  });
});
