import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';
import { V2Data } from './v2-data.mjs';
import { printProjection } from '../preview-src/v2/print-layout.js';

const repo = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'boccantina-print-check-'));
const data = await new V2Data(directory).init();
const hidden = structuredClone(data.value.catalog);
hidden.products[0].visible = false;
assert(!printProjection(hidden).some((group) => group.products.some((item) => item.id === hidden.products[0].id)));
const unavailable = structuredClone(data.value.catalog);
unavailable.products[0].available = false;
assert(printProjection(unavailable).some((group) => group.products.some((item) => item.id === unavailable.products[0].id)));
const password = `PrintQA-${randomBytes(18).toString('base64url')}`;
await data.createFirstAdmin('printqa', 'Administrador QA', password);
const port = await new Promise((done, fail) => {
  const server = createServer();
  server.once('error', fail);
  server.listen(0, '127.0.0.1', () => { const freePort = server.address().port; server.close(() => done(freePort)); });
});
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['scripts/serve-v2.mjs'], { cwd:repo,
  env:{ ...process.env, BOCCANTINA_V2_DATA_DIR:directory, BOCCANTINA_V2_PORT:String(port) }, stdio:['ignore','pipe','pipe'] });
let stderr = '';
child.stderr.on('data', (part) => { stderr += part; });
let cookie = '', csrf = '', browser;
const call = async (path, method = 'GET', payload, authenticated = true) => {
  const headers = {};
  if (authenticated && cookie) headers.cookie = cookie;
  if (method !== 'GET') { headers.origin = base; if (authenticated) headers['x-csrf-token'] = csrf; }
  if (payload !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body:payload === undefined ? undefined : JSON.stringify(payload), redirect:'manual' });
  const body = await response.arrayBuffer();
  let json; try { json = JSON.parse(Buffer.from(body).toString()); } catch { json = null; }
  return { response, body:Buffer.from(body), json };
};
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { ready = (await call('/api/v2/health')).response.status === 200; if (ready) break; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(ready, `No inició el servidor V2: ${stderr}`);
  assert.equal((await call('/imprimir/', 'GET', undefined, false)).response.status, 303);
  assert.equal((await call('/api/v2/admin/print/status', 'GET', undefined, false)).response.status, 401);
  const login = await call('/api/v2/admin/login', 'POST', { username:'printqa', password }, false);
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get('set-cookie').split(';')[0];
  csrf = login.json.csrf;
  const initial = (await call('/api/v2/admin/catalog')).json;
  const status = (await call('/api/v2/admin/print/status?lang=es')).json;
  assert.equal(status.current, false);
  assert(status.changes.added > 0);
  assert.equal((await call('/api/v2/admin/print/editions', 'POST', { revision:initial.revision, language:'es' }, false)).response.status, 401);
  const badCsrf = await fetch(`${base}/api/v2/admin/print/editions`, { method:'POST', headers:{ cookie, origin:base, 'content-type':'application/json', 'x-csrf-token':'incorrecto' }, body:JSON.stringify({ revision:initial.revision, language:'es' }) });
  assert.equal(badCsrf.status, 403);
  assert.equal((await call('/api/v2/admin/print/editions', 'POST', { revision:initial.revision - 1, language:'es' })).response.status, 409);
  const first = await call('/api/v2/admin/print/editions', 'POST', { revision:initial.revision, language:'es' });
  assert.equal(first.response.status, 201, `${first.json?.error || 'Error de PDF'}\n${stderr}`);
  assert.equal(first.json.revision, initial.revision);
  const pdf = await call(`/api/v2/admin/print/${first.json.id}.pdf`);
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  assert(pdf.body.length > 30000);
  const pages = (pdf.body.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert(pages >= 2 && pages <= 10, `El PDF contiene ${pages} páginas; revisa la paginación A4.`);
  assert.equal((await call('/api/v2/admin/print/status?lang=es')).json.current, true);
  assert.equal((await call('/api/v2/admin/print/editions', 'POST', { revision:initial.revision, language:'es' })).json.id, first.json.id);
  const original = initial.products.find((item) => item.id === 'cachapa-v2');
  const changed = await call(`/api/v2/admin/products/${original.id}`, 'PATCH', { ...original, revision:initial.revision, price:5100 });
  assert.equal(changed.response.status, 200, changed.json?.error);
  const stale = (await call('/api/v2/admin/print/status?lang=es')).json;
  assert.equal(stale.current, false);
  assert(stale.changes.changed > 0);
  const second = await call('/api/v2/admin/print/editions', 'POST', { revision:changed.json.catalog.revision, language:'es' });
  assert.equal(second.response.status, 201, `${second.json?.error || 'Error de PDF'}\n${stderr}`);
  assert.notEqual(first.json.id, second.json.id);
  assert.equal((await call('/api/v2/admin/print/status?lang=es')).json.editions.length, 2);
  assert.equal((await call(`/api/v2/admin/print/${first.json.id}.pdf`)).response.status, 200);
  const english = await call('/api/v2/admin/print/editions', 'POST', { revision:changed.json.catalog.revision, language:'en' });
  assert.equal(english.response.status, 201, `${english.json?.error || 'Error de PDF'}\n${stderr}`);
  assert.equal((await call('/api/v2/admin/print/status?lang=en')).json.current, true);
  assert.equal((await call(`/api/v2/admin/print/${english.json.id}.pdf`)).body.subarray(0, 4).toString(), '%PDF');
  const chrome = [process.env.CHROME_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'].find((path) => path && existsSync(path));
  browser = await puppeteer.launch({ executablePath:chrome, headless:true, args:process.env.CI ? ['--disable-gpu', '--no-sandbox'] : ['--disable-gpu'] });
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height:900, deviceScaleFactor:1 });
    await page.setCookie({ name:'boccantina_v2', value:cookie.split('=')[1], domain:'127.0.0.1', path:'/' });
    await page.goto(`${base}/admin/`, { waitUntil:'networkidle0' });
    if (await page.evaluate(() => document.body.dataset.theme) !== 'blue') await page.click('#theme-button');
    await page.click('#sidebar-toggle');
    await page.click('[data-view="print"]');
    await page.waitForSelector('.print-workspace');
    await page.waitForFunction(() => document.querySelectorAll('.print-editions a[href$=".pdf"]').length === 3);
    const adminResult = await page.evaluate(() => ({ width:document.documentElement.scrollWidth, viewport:innerWidth, preview:document.querySelector('.print-controls a')?.href, archived:document.querySelectorAll('.print-editions li').length }));
    assert(adminResult.width <= width + 1 && adminResult.preview?.includes('/imprimir/') && adminResult.archived === 3, JSON.stringify(adminResult));
    if ([1440, 390].includes(width)) await page.screenshot({ path:join(directory, `print-admin-${width}.png`) });
    await page.click('#theme-button');
    assert.equal(await page.evaluate(() => document.body.dataset.theme), 'gold');
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width + 1);
    if ([1440, 390].includes(width)) await page.screenshot({ path:join(directory, `print-admin-gold-${width}.png`) });
    await page.goto(`${base}/imprimir/?lang=es`, { waitUntil:'networkidle0' });
    await page.waitForSelector('html[data-ready="true"]');
    const result = await page.evaluate(() => ({ width:document.documentElement.scrollWidth, viewport:innerWidth, products:document.querySelectorAll('.print-product').length, price:/₡5\s?100/.test(document.body.textContent) }));
    assert(result.width <= width + 1, `Desbordamiento en la vista de impresión ${width}px: ${JSON.stringify(result)}`);
    assert(result.products > 40 && result.price, JSON.stringify(result));
    if ([1440, 390].includes(width)) await page.screenshot({ path:join(directory, `print-${width}.png`), fullPage:true });
    if (width === 390) await page.screenshot({ path:join(directory, 'print-390-viewport.png') });
    await page.close();
  }
  console.log(`Impresión V2: auth/CSRF, PDF A4 de ${pages} páginas, revisión, historial, catálogo y vistas 1440/768/390/320 verificados. Capturas: ${directory}`);
} finally {
  await browser?.close();
  child.kill();
  const absolute = resolve(directory);
  if (absolute.startsWith(resolve(tmpdir()) + sep) && absolute.includes('boccantina-print-check-') && !process.env.BOCC_PRINT_KEEP_QA) await rm(absolute, { recursive:true, force:true, maxRetries:5, retryDelay:150 });
}
