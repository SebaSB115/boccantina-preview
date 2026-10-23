import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { normalizeExtras } from './catalog-ops.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(resolve(tmpdir(), 'bocc-catalog-qa-'));
const port = await new Promise((done, reject) => {
  const socket = createServer(); socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => { const number = socket.address().port; socket.close(() => done(number)); });
});
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(32).toString('hex');
const params = { N:1 << 14, r:8, p:5 };
const scrypt = promisify(scryptCallback);
await writeFile(resolve(temp, 'admin-auth.json'), JSON.stringify({ username:'boccantina-admin', algorithm:'scrypt', params, salt, hash:(await scrypt(password, Buffer.from(salt,'hex'),64,{ ...params, maxmem:64 * 1024 * 1024 })).toString('hex') }));
const request = (path, options = {}) => fetch(`${base}${path}`, { redirect:'manual', ...options });
let server;
try {
  server = spawn(process.execPath, [resolve(repo,'scripts/serve.mjs')], { cwd:repo, env:{ ...process.env, BOCCANTINA_DATA_DIR:temp, BOCCANTINA_PREVIEW_PORT:String(port), BOCCANTINA_PREVIEW_HOST:'127.0.0.1' }, stdio:'ignore' });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('El servidor terminó antes de iniciar.');
    try { if ((await request('/api/health')).ok) break; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal((await request('/admin/disponibilidad/')).status, 303);
  const login = await request('/api/admin/login', { method:'POST', headers:{ origin:base, 'content-type':'application/json' }, body:JSON.stringify({ username:'boccantina-admin', password }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/admin/disponibilidad/', { headers:{ cookie } })).status, 200);
  const put = (config) => request('/api/config/extras', { method:'PUT', headers:{ cookie, origin:base, 'content-type':'application/json' }, body:JSON.stringify(config) });
  const post = (items, clientRequestId = randomUUID()) => request('/api/orders', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ channel:'takeaway', customerName:'Cliente QA', phone:'88888888', clientRequestId, items }) });
  const historicItems = [{ productId:'bocca-burger', name:'Hamburguesa Bocca', quantity:1, unitPrice:8600, extras:[{ id:'extra-bacon', name:'Tocineta extra', price:550 }] }];
  assert.equal((await post(historicItems)).status, 201);
  const v1 = { version:1, products:{ 'bocca-burger':{ enabled:true, type:'burger', extras:[{ id:'extra-bacon', nameEs:'Tocineta extra', nameEn:'Extra bacon', price:550 }] } } };
  assert.equal((await put(v1)).status, 200);
  let config = await (await request('/api/config/extras')).json();
  assert.equal(config.products['bocca-burger'].extras[0].price, 550);
  assert.ok(config.library.some((extra) => extra.id === 'extra-bacon'));
  config = normalizeExtras(config);
  config.library.push({ id:'extra-qa', nameEs:'Aceite de trufa', nameEn:'Truffle oil', price:450, active:true });
  config.products['bocca-burger'].extras.push({ id:'extra-qa', nameEs:'Aceite de trufa', nameEn:'Truffle oil', price:450, useLibraryPrice:true });
  config.products['pizza-toscana'].extras.push({ id:'extra-qa', nameEs:'Aceite de trufa', nameEn:'Truffle oil', price:450, useLibraryPrice:true });
  const customId = `custom-${randomUUID()}`;
  config.customProducts.push({ id:customId, category:'entradas', nameEs:'Plato QA', nameEn:'QA plate', descEs:'Prueba', descEn:'Test', price:2000, image:'wp-content/uploads/2026/05/BURGUER.webp', tags:[], visible:true });
  config.products[customId] = { enabled:true, type:'other', extras:[{ id:'extra-qa', nameEs:'Aceite de trufa', nameEn:'Truffle oil', price:450, useLibraryPrice:true }] };
  assert.equal((await put(config)).status, 200);
  config = await (await request('/api/config/extras')).json();
  assert.equal(config.products['bocca-burger'].extras[0].price, 550);
  assert.equal(config.products['pizza-toscana'].extras.find((extra) => extra.id === 'extra-qa').price, 450);
  config.products['pizza-toscana'].extras = config.products['pizza-toscana'].extras.filter((extra) => extra.id !== 'extra-qa');
  config.library.find((extra) => extra.id === 'extra-qa').price = 600;
  assert.equal((await put(config)).status, 200);
  config = await (await request('/api/config/extras')).json();
  assert.equal(config.products['pizza-toscana'].extras.some((extra) => extra.id === 'extra-qa'), false);
  assert.equal(config.products['bocca-burger'].extras.find((extra) => extra.id === 'extra-qa').price, 600);
  assert.equal(config.products['bocca-burger'].extras[0].price, 550);
  assert.equal((await post([{ productId:customId, name:'Plato QA', quantity:1, unitPrice:2000, extras:[{ id:'extra-qa', name:'Aceite de trufa', price:450 }] }])).status, 201);
  config.availability['bocca-burger'] = { status:'sold-out-today', updatedAt:new Date().toISOString() };
  assert.equal((await put(config)).status, 200);
  const blocked = await post(historicItems);
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /Hamburguesa Bocca/);
  config.availability['bocca-burger'] = { status:'available', updatedAt:new Date().toISOString() };
  assert.equal((await put(config)).status, 200);
  assert.equal((await post(historicItems)).status, 201);
  config.library.find((extra) => extra.id === 'extra-bacon').active = false;
  assert.equal((await put(config)).status, 200);
  assert.equal((await post(historicItems)).status, 409);
  const orders = (await (await request('/api/orders', { headers:{ cookie } })).json()).orders;
  assert.equal(orders.length, 3);
  assert.equal(orders.find((order) => order.items[0].productId === 'bocca-burger').items[0].extras[0].price, 550);
  console.log('Catálogo: migración v1, biblioteca compartida, producto nuevo, disponibilidad, bloqueo servidor y precios históricos OK.');
} finally {
  server?.kill();
  if (!resolve(temp).startsWith(resolve(tmpdir()) + sep)) throw new Error('Ruta temporal fuera del directorio esperado.');
  await rm(temp, { recursive:true, force:true });
}
