import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { V2Data, defaultCatalog, publicCatalog } from './v2-data.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'boccantina-grid-chrome-'));
const adminStoreDir = await mkdtemp(join(tmpdir(), 'boccantina-grid-admin-'));
const adminStore = await new V2Data(adminStoreDir).init();
const adminPassword = `Qa-${randomBytes(16).toString('base64url')}`;
await adminStore.createFirstAdmin('gridqa', 'Administrador QA', adminPassword);
const portProbe = createNetServer();
await new Promise((done) => portProbe.listen(0, '127.0.0.1', done));
const adminPort = portProbe.address().port;
const localBase = `http://127.0.0.1:${adminPort}`;
await new Promise((done) => portProbe.close(done));
const adminServer = spawn(process.execPath, ['scripts/serve-v2.mjs'], {
  cwd:root, env:{ ...process.env, BOCCANTINA_V2_DATA_DIR:adminStoreDir, BOCCANTINA_V2_PORT:String(adminPort) }, stdio:'ignore', windowsHide:true
});
const scriptAtHead = execFileSync('git', ['show', 'HEAD:preview-src/v2/carta.js'], { cwd:root });
const cssAtHead = execFileSync('git', ['show', 'HEAD:preview-src/v2/carta.css'], { cwd:root });
const fixtureCatalog = defaultCatalog();
fixtureCatalog.categories[1].es = 'Hamburguesas artesanales con ingredientes de temporada';
fixtureCatalog.categories[1].en = 'Artisan burgers with seasonal ingredients and special recipes';
const fixtureNeeded = 20 - publicCatalog(fixtureCatalog).categories.length;
for (let index = 0; index < fixtureNeeded; index++) {
  const id = `qa-category-${index}`;
  fixtureCatalog.categories.push({ id, es:`Categoría de prueba ${index + 1}`, en:`Test category ${index + 1}`, esDescription:'', enDescription:'', image:'', position:fixtureCatalog.categories.length, visible:true });
  fixtureCatalog.products.push({ ...fixtureCatalog.products[0], id:`qa-product-${index}`, category:id, image:'', position:0 });
}
fixtureCatalog.categories.push({ id:'qa-hidden', es:'Oculta QA', en:'Hidden QA', esDescription:'', enDescription:'', image:'', position:0, visible:false });
fixtureCatalog.products.push({ ...fixtureCatalog.products[0], id:'qa-hidden-product', category:'qa-hidden' });
let fixturePublicCatalog = publicCatalog(fixtureCatalog);
if (fixturePublicCatalog.categories.length !== 20 || fixturePublicCatalog.categories.some((item) => item.id === 'qa-hidden')) throw new Error('El catálogo QA no tiene 20 categorías públicas.');
const proxy = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path.startsWith('/boccantina-preview/')) {
    const relative = path.slice('/boccantina-preview/'.length) + (path.endsWith('/') ? 'index.html' : '');
    const target = resolve(root, 'docs-v2', relative);
    if (!target.startsWith(resolve(root, 'docs-v2') + '\\')) { response.writeHead(403); response.end(); return; }
    try {
      const extension = target.split('.').at(-1).toLowerCase();
      response.setHeader('content-type', ({ html:'text/html', js:'text/javascript', css:'text/css', png:'image/png', jpg:'image/jpeg', webp:'image/webp', woff2:'font/woff2', svg:'image/svg+xml' })[extension] || 'application/octet-stream');
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end(); }
    return;
  }
  if (path === '/fixture/carta/') {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(await readFile(join(root, 'preview-src/v2/carta.html')));
    return;
  }
  if (path === '/api/v2/catalog' && request.headers.referer?.includes('/fixture/carta/')) {
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(fixturePublicCatalog));
    return;
  }
  if (path === '/before/v2/carta.js' || path === '/before/v2/carta.css') {
    response.setHeader('content-type', path.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(path.endsWith('.js') ? scriptAtHead : cssAtHead);
    return;
  }
  if (path === '/before/carta/') {
    const page = await readFile(join(root, 'preview-src/v2/carta.html'), 'utf8');
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(page.replaceAll('/v2/carta.js', '/before/v2/carta.js').replaceAll('/v2/carta.css', '/before/v2/carta.css'));
    return;
  }
  try {
    const upstream = await fetch(`${localBase}${request.url}`);
    response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) { response.writeHead(502); response.end(error.message); }
});
await new Promise((done) => proxy.listen(0, '127.0.0.1', done));
const proxyPort = proxy.address().port;
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio:'ignore', windowsHide:true });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let socket, sequence = 0;
const pending = new Map();
async function send(method, params = {}) {
  const id = ++sequence;
  const response = new Promise((done, fail) => pending.set(id, { done, fail }));
  socket.send(JSON.stringify({ id, method, params }));
  return response;
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function capture(name, width, height, url, action = '') {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:width < 600 });
  await send('Page.navigate', { url });
  await pause(700);
  if (action) { await evaluate(action); await pause(180); }
  const metrics = await evaluate(`({innerWidth, scrollWidth:document.documentElement.scrollWidth, tiles:document.querySelectorAll('.category-tile').length, picker:!!document.querySelector('#category-picker'), language:document.documentElement.lang, category:document.querySelector('#category-title')?.textContent})`);
  const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false, fromSurface:true });
  await writeFile(join(output, name), Buffer.from(shot.data, 'base64'));
  console.log(name, JSON.stringify(metrics));
  if (metrics.scrollWidth > metrics.innerWidth) throw new Error(`Desbordamiento horizontal en ${name}`);
  return metrics;
}
async function assertInPage(expression, message) {
  if (!await evaluate(expression)) throw new Error(message);
}
try {
  await mkdir(output, { recursive:true });
  let ready = false;
  for (let tries = 0; tries < 80; tries++) {
    try { ready = (await fetch(`${localBase}/api/v2/health`)).ok; if (ready) break; } catch {}
    await pause(100);
  }
  if (!ready) throw new Error('No inició el servidor aislado de QA.');
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await pause(100); }
  }
  if (!port) throw new Error('Chrome no inició DevTools.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { done, fail } = pending.get(payload.id);
    pending.delete(payload.id);
    payload.error ? fail(new Error(payload.error.message)) : done(payload.result);
  });
  await new Promise((done, fail) => { socket.addEventListener('open', done, { once:true }); socket.addEventListener('error', fail, { once:true }); });
  await send('Page.enable'); await send('Runtime.enable');
  const beforeUrl = `http://127.0.0.1:${proxyPort}/before/carta/`;
  await capture('menu-before-390.png', 390, 844, beforeUrl);
  for (const width of [320,390,430,768,1024,1440]) {
    const metrics = await capture(`menu-after-${width}.png`, width, 844, `${localBase}/carta/`);
    if (!metrics.tiles || metrics.picker) throw new Error(`La cuadrícula no reemplazó el selector a ${width}px`);
  }
  await capture('menu-category-390.png', 390, 844, `${localBase}/carta/`, "document.querySelector('.category-tile').click()");
  await capture('menu-category-1440.png', 1440, 900, `${localBase}/carta/`, "document.querySelector('.category-tile').click()");
  const fullFixture = fixturePublicCatalog;
  for (const count of [2,5,10,15]) {
    const ids = new Set(fullFixture.categories.slice(0,count).map((item) => item.id));
    fixturePublicCatalog = { ...fullFixture, categories:fullFixture.categories.slice(0,count), products:fullFixture.products.filter((item) => ids.has(item.category)) };
    const metrics = await capture(`menu-${count}-categories-390.png`, 390, 844, `http://127.0.0.1:${proxyPort}/fixture/carta/`);
    if (metrics.tiles !== count) throw new Error(`No se muestran ${count} categorías QA.`);
  }
  fixturePublicCatalog = fullFixture;
  for (const width of [320,390,768,1440]) {
    const metrics = await capture(`menu-20-categories-${width}.png`, width, 844, `http://127.0.0.1:${proxyPort}/fixture/carta/`);
    if (metrics.tiles !== 20) throw new Error(`Faltan categorías QA a ${width}px`);
  }
  await capture('menu-20-categories-en-390.png', 390, 844, `http://127.0.0.1:${proxyPort}/fixture/carta/`, "document.querySelector('[data-language=en]').click()");
  const staticMetrics = await capture('menu-static-demo-390.png', 390, 844, `http://127.0.0.1:${proxyPort}/boccantina-preview/carta/`);
  if (staticMetrics.tiles !== 13) throw new Error('La demo estática no muestra las categorías de la carta.');
  await send('Page.navigate', { url:`http://127.0.0.1:${proxyPort}/fixture/carta/` }); await pause(500);
  await evaluate("document.querySelector('[data-language=en]').click()");
  await assertInPage("document.querySelector('[data-language=en]').getAttribute('aria-pressed') === 'true'", 'El idioma EN no quedó seleccionado.');
  await evaluate("document.querySelector('.category-tile').click()");
  await assertInPage("!!document.querySelector('#category-title') && !!document.querySelector('[data-open-categories]') && !document.querySelector('.category-grid')", 'La categoría no se abrió.');
  await evaluate("document.querySelector('[data-open-categories]').click()");
  await assertInPage("document.querySelectorAll('.category-tile').length === 20 && !!document.querySelector('.category-tile[aria-current=true]')", 'No se pudo volver a la cuadrícula con la selección visible.');
  const searchTarget = fixturePublicCatalog.products.find((item) => item.category !== fixturePublicCatalog.categories[0].id && !fixturePublicCatalog.products.some((other) => other.category === fixturePublicCatalog.categories[0].id && other.nameEs === item.nameEs));
  if (!searchTarget) throw new Error('Falta un plato QA para comprobar la búsqueda global.');
  await evaluate(`(() => { const input=document.querySelector('#menu-search'); input.value=${JSON.stringify(searchTarget.nameEs)}; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await assertInPage(`document.querySelector('.dish-list')?.textContent.includes(${JSON.stringify(searchTarget.nameEn || searchTarget.nameEs)})`, 'La búsqueda no encuentra un plato de otra categoría.');
  await evaluate("document.querySelector('[data-clear-search]').click()");
  await assertInPage("document.querySelectorAll('.category-tile').length === 20", 'Limpiar búsqueda no restauró la cuadrícula.');
  await send('Page.reload'); await pause(500);
  await assertInPage("document.documentElement.lang === 'en' && document.querySelectorAll('.category-tile').length === 20", 'La elección EN o la cuadrícula no persisten tras recargar.');
  await evaluate("document.querySelectorAll('.category-tile')[1].focus()");
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, nativeVirtualKeyCode:13, text:'\r' });
  await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, nativeVirtualKeyCode:13 });
  await assertInPage("document.querySelector('#category-title')?.textContent.includes('Artisan burgers')", 'El teclado no puede elegir una categoría.');
  const userAgent = await evaluate('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent, acceptLanguage:'en-US,en;q=0.9' });
  await evaluate("localStorage.removeItem('boccantina-v2-menu-language')");
  await send('Page.reload'); await pause(500);
  await assertInPage("document.documentElement.lang === 'en' && navigator.language.startsWith('en')", 'No se detecta inglés del navegador.');
  await send('Emulation.setUserAgentOverride', { userAgent, acceptLanguage:'es-CR,es;q=0.9' });
  await send('Page.reload'); await pause(500);
  await assertInPage("document.documentElement.lang === 'es' && navigator.language.startsWith('es')", 'No se detecta español del navegador.');
  await send('Page.navigate', { url:`http://127.0.0.1:${adminPort}/admin/login/` }); await pause(350);
  const login = await evaluate(`fetch('/api/v2/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'gridqa',password:${JSON.stringify(adminPassword)}})}).then(r=>r.status)`);
  if (login !== 200) throw new Error(`Falló el login aislado QA: ${login}`);
  for (const width of [320,390,768,1440]) {
    const metrics = await capture(`admin-${width}.png`, width, 844, `http://127.0.0.1:${adminPort}/admin/`);
    if (metrics.scrollWidth > metrics.innerWidth) throw new Error(`Desbordamiento administrativo a ${width}px`);
    await evaluate("document.querySelector('#sidebar-toggle').click()");
    await assertInPage("document.querySelector('#sidebar-toggle').getAttribute('aria-expanded') === 'true' && !document.querySelector('#admin-sidebar').inert", 'No abrió el menú administrativo.');
    if (width === 390) {
      const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false, fromSurface:true });
      await writeFile(join(output, 'admin-menu-390.png'), Buffer.from(shot.data, 'base64'));
      await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8 });
      await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8 });
      await assertInPage("document.activeElement === document.querySelector('.admin-sidebar .main-nav a')", 'El foco no se mantiene dentro del menú.');
    }
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await assertInPage("document.querySelector('#admin-sidebar').inert && document.querySelector('#sidebar-toggle').getAttribute('aria-expanded') === 'false'", 'Escape no cerró el menú administrativo.');
  }
  await evaluate("document.querySelector('#sidebar-toggle').click(); document.querySelector('[data-view=categories]').click()");
  await pause(180);
  await assertInPage("document.querySelector('#page-title').textContent === 'Categorías' && document.querySelector('#admin-sidebar').inert", 'La navegación administrativa no cambió de sección o dejó el menú abierto.');
  await evaluate("document.querySelector('[data-new-category]').click(); const form=document.querySelector('#category-form'); form.elements.es.value='Categoría QA desde Central'; form.elements.en.value='QA category from Central'; form.requestSubmit()");
  await pause(300);
  await assertInPage("document.querySelector('#feedback').textContent.toLowerCase().includes('categoría') && [...document.querySelectorAll('[data-select-category]')].some(b=>b.textContent.includes('Categoría QA desde Central'))", 'La Central no creó la categoría QA.');
  const newCategoryId = await evaluate("fetch('/api/v2/admin/catalog').then(r=>r.json()).then(c=>c.categories.find(x=>x.es==='Categoría QA desde Central')?.id)");
  if (!newCategoryId) throw new Error('Falta la categoría creada desde la interfaz.');
  await evaluate("document.querySelector('#sidebar-toggle').click(); document.querySelector('[data-view=products]').click()");
  await pause(180);
  await evaluate(`(() => { document.querySelector('[data-new-product]').click(); const form=document.querySelector('#product-form'); form.elements.nameEs.value='Plato QA visible'; form.elements.nameEn.value='Visible QA dish'; form.elements.category.value=${JSON.stringify(newCategoryId)}; form.elements.price.value='5000'; form.requestSubmit(); })()`);
  await pause(300);
  await assertInPage(`fetch('/api/v2/catalog').then(r=>r.json()).then(c=>c.categories.some(x=>x.id===${JSON.stringify(newCategoryId)}) && c.products.some(x=>x.category===${JSON.stringify(newCategoryId)}))`, 'El nuevo plato y su categoría no llegaron a la API pública.');
  await capture('menu-new-category-from-admin-390.png', 390, 844, `http://127.0.0.1:${adminPort}/carta/`);
  await assertInPage("[...document.querySelectorAll('.category-tile')].some(b=>b.textContent.includes('Categoría QA desde Central'))", 'La cuadrícula no refleja la categoría creada en la Central.');
  await send('Page.navigate', { url:`http://127.0.0.1:${adminPort}/admin/` }); await pause(350);
  await evaluate("document.querySelector('#theme-button').click()");
  await assertInPage("document.body.dataset.theme === 'gold'", 'No cambió el estilo dorado.');
  await capture('admin-gold-390.png', 390, 844, `http://127.0.0.1:${adminPort}/admin/`);
  await capture('admin-gold-1440.png', 1440, 900, `http://127.0.0.1:${adminPort}/admin/`);
} finally {
  socket?.close(); chrome.kill(); adminServer.kill(); proxy.close();
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:200 });
  await rm(adminStoreDir, { recursive:true, force:true, maxRetries:5, retryDelay:200 });
}
