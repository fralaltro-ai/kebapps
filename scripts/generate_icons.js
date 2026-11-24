/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="#ea580c"/>
  <rect x="246" y="80" width="20" height="352" rx="10" fill="#332D2D"/>
  <rect x="126" y="145" width="260" height="55" rx="27.5" fill="#FFFDF7"/>
  <rect x="171" y="225" width="170" height="90" rx="25" fill="#664D00"/>
  <rect x="206" y="340" width="100" height="50" rx="25" fill="#FEF9CD"/>
</svg>
`;

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: transparent; overflow: hidden; }
  svg { width: 100vw; height: 100vh; }
</style>
</head>
<body>
  ${svgContent}
</body>
</html>
`;

(async () => {
  console.log('Avvio browser Playwright...');
  const browser = await chromium.launch();
  
  console.log('Generazione icon-512x512.png...');
  const page512 = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page512.setContent(htmlContent);
  await page512.screenshot({ path: path.join(__dirname, '../public/icons/icon-512x512.png'), omitBackground: true });
  
  console.log('Generazione icon-192x192.png...');
  const page192 = await browser.newPage({ viewport: { width: 192, height: 192 } });
  await page192.setContent(htmlContent);
  await page192.screenshot({ path: path.join(__dirname, '../public/icons/icon-192x192.png'), omitBackground: true });

  console.log('Generazione favicon.ico...');
  const page64 = await browser.newPage({ viewport: { width: 64, height: 64 } });
  await page64.setContent(htmlContent);
  // Salviamo come PNG ma lo rinominiamo .ico. I browser moderni sanno leggere un PNG rinominato.
  await page64.screenshot({ path: path.join(__dirname, '../src/app/favicon.ico'), type: 'png', omitBackground: true });

  await browser.close();
  console.log('Fatto! Tutte le icone generate.');
})();
