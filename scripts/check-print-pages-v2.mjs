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
  const admin = await page.evaluate(() => ({ message:document.querySelector('.print-state')?.textContent, generate:document.querySelector('[data-generate-print]')?.disabled, width:document.documentElement.scrollWidth }));
  assert(admin.message.includes('desde el navegador') && admin.generate && admin.width <= 391, JSON.stringify(admin));
  await page.evaluate(() => {
    const key = 'boccantina-v2-public-demo-catalog';
    const catalog = JSON.parse(localStorage.getItem(key) || JSON.stringify(window.BoccV2DemoSeed));
    catalog.products.find((item) => item.id === 'cachapa-v2').price = 5150;
    localStorage.setItem(key, JSON.stringify(catalog));
  });
  await page.goto(`${base}/imprimir/?lang=es`, { waitUntil:'networkidle0' });
  await page.waitForSelector('html[data-ready=true]');
  const print = await page.evaluate(() => ({ price:/₡5\s?150/.test(document.body.textContent), products:document.querySelectorAll('.print-product').length, width:document.documentElement.scrollWidth }));
  assert(print.price && print.products > 40 && print.width <= 391, JSON.stringify(print));
  console.log('Pages V2: login demo, menú imprimible, catálogo local actualizado y móvil 390 px verificados.');
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
