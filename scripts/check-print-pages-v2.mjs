import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '../docs-v2');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith('/boccantina-preview/')) throw new Error('Fuera de la demo.');
    const relative = path.slice('/boccantina-preview/'.length);
    let file = resolve(root, relative);
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Ruta no válida.');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    response.writeHead(200, { 'content-type':mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('No encontrado'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/boccantina-preview`;
const chrome = [process.env.CHROME_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'].find((path) => path && existsSync(path));
let browser;
try {
  browser = await puppeteer.launch({ executablePath:chrome, headless:true, args:process.env.CI ? ['--disable-gpu', '--no-sandbox'] : ['--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width:390, height:844 });
  await page.goto(`${base}/admin/login/`, { waitUntil:'networkidle0' });
  await page.type('#username', 'demo-boccantina');
  await page.type('#password', 'vista2026');
  await Promise.all([page.waitForNavigation({ waitUntil:'networkidle0' }), page.click('[type=submit]')]);
  assert(page.url().endsWith('/admin/'));
  await page.click('#sidebar-toggle');
  await page.click('[data-view=print]');
  await page.waitForSelector('.print-workspace');
  await page.waitForFunction(() => !document.querySelector('[data-generate-print]').disabled);
  const admin = await page.evaluate(() => ({ message:document.querySelector('.print-state')?.textContent, generate:document.querySelector('[data-generate-print]')?.disabled, width:document.documentElement.scrollWidth }));
  assert(admin.message.includes('Pendiente de generar') && !admin.generate && admin.width <= 391, JSON.stringify(admin));
  await page.click('[data-generate-print]');
  await page.waitForSelector('[data-edition]', {timeout:60000});
  assert(await page.$eval('.print-state', element => element.textContent.includes('coincide')));
  await page.evaluate(() => {
    const key = 'boccantina-v2-public-demo-catalog';
    const catalog = JSON.parse(localStorage.getItem(key) || JSON.stringify(window.BoccV2DemoSeed));
    catalog.products.find((item) => item.id === 'cachapa-v2').price = 5150;
    localStorage.setItem(key, JSON.stringify(catalog));
  });
  const printPage = await browser.newPage();
  await printPage.setViewport({ width:390, height:844 });
  await printPage.goto(`${base}/imprimir/?lang=es`, { waitUntil:'networkidle0' });
  await printPage.waitForSelector('html[data-ready=true]');
  const print = await printPage.evaluate(() => ({ price:/₡5\s?150/.test(document.body.textContent), products:document.querySelectorAll('.print-product').length, width:document.documentElement.scrollWidth }));
  assert(print.price && print.products > 40 && print.width <= 391, JSON.stringify(print));
  // Fixtures exist only in this isolated browser; they never update catalog storage.
  const fixtures = await printPage.evaluate(async () => {
    const {renderPrintBody,paginatePrint,fitPrintPreview} = await import('../v2/print-layout.js');
    const observations = [];
    for (const language of ['es','en']) {
      for (const count of [0,1,5,45]) {
        const catalog = {revision:1,categories:[{id:'qa',es:'Categoría de prueba',en:'Test category',position:0}],
          products:Array.from({length:count}, (_,i) => ({
            id:'qa-'+i,category:'qa',position:i,nameEs:'Producto '+i,nameEn:'Dish '+i,
            descEs:i === 0 ? 'Descripción extensa con ingredientes. '.repeat(180)+'FIN-DE-TEXTO' : 'Descripción del plato.',
            descEn:i === 0 ? 'Long description with ingredients. '.repeat(180)+'END-OF-TEXT' : 'Dish description.',
            price:i%2 ? 5000 : null
          }))};
        const host=document.createElement('div');host.innerHTML=renderPrintBody(catalog,language);
        const menu=host.firstElementChild;document.body.replaceChildren(menu);
        await paginatePrint(menu);const dispose=fitPrintPreview(menu);
        const articles=[...menu.querySelectorAll('.print-product')];
        observations.push({
          language,count,ids:new Set(articles.map(a=>a.dataset.productId)).size,
          columnsFit:[...menu.querySelectorAll('.print-column')].every(c=>c.scrollHeight<=c.clientHeight+1),
          complete:count===0 || menu.textContent.includes(language==='es'?'FIN-DE-TEXTO':'END-OF-TEXT'),
          empty:count!==0 || Boolean(menu.querySelector('.print-empty')),
          width:document.documentElement.scrollWidth
        });
        dispose();
      }
    }
    return observations;
  });
  assert(fixtures.every(f=>f.ids===f.count && f.columnsFit && f.complete && f.empty && f.width<=391), JSON.stringify(fixtures));
  console.log('Pages V2: login demo, menú imprimible, catálogo local actualizado y móvil 390 px verificados.');
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
