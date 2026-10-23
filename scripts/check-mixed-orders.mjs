import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = await mkdtemp(resolve(tmpdir(), 'bocc-mixed-orders-'));
const port = await new Promise((resolvePort, reject) => {
  const socket = createServer();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => { const selectedPort = socket.address().port; socket.close(() => resolvePort(selectedPort)); });
});
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(32).toString('hex');
const params = { N: 1 << 14, r: 8, p: 5 };
const hash = (await scrypt(password, Buffer.from(salt, 'hex'), 64, { ...params, maxmem: 64 * 1024 * 1024 })).toString('hex');
await writeFile(resolve(dataDir, 'admin-auth.json'), JSON.stringify({ username: 'boccantina-admin', algorithm: 'scrypt', params, salt, hash }));

const legacyItem = { productId: 'legacy', name: 'Plato anterior', quantity: 1, unitPrice: 1000, extras: [], note: '' };
const legacyOrders = ['takeaway', 'counter'].map((channel, index) => ({
  id: randomUUID(), code: `BOC-00${index + 1}`, channel, table: null,
  customerName: channel === 'takeaway' ? 'Cliente anterior' : '', phone: channel === 'takeaway' ? '88888888' : '',
  items: [{ ...legacyItem }], total: 1000, status: 'delivered', paymentStatus: 'paid', paymentMethod: 'cash',
  pickupCode: '4100', trackingToken: randomUUID(), note: '', createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z'
}));
const todayInCostaRica = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const reservation = { id: randomUUID(), code: 'RES-QA', table: 9, date: todayInCostaRica, time: '20:00', guests: '2', name: 'Mesa reservada', phone: '88888888', status: 'confirmed' };
await writeFile(resolve(dataDir, 'restaurant-system.json'), JSON.stringify({ counter: 2, orders: legacyOrders, reservations: [reservation] }));

let server;
const request = (path, options = {}) => fetch(`${base}${path}`, { redirect: 'manual', ...options });
const postOrder = (payload, cookie) => request('/api/orders', {
  method: 'POST', headers: { origin: base, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(payload)
});

try {
  server = spawn(process.execPath, [resolve(repo, 'scripts/serve.mjs')], {
    cwd: repo, env: { ...process.env, BOCCANTINA_DATA_DIR: dataDir, BOCCANTINA_PREVIEW_PORT: String(port), BOCCANTINA_PREVIEW_HOST:'127.0.0.1' }, stdio: 'ignore'
  });
  let healthy = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('El servidor de prueba terminó inesperadamente.');
    try { healthy = (await request('/api/health')).ok; } catch { /* Waiting for local server. */ }
    if (healthy) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(healthy, 'El servidor de prueba no inició.');

  const login = await request('/api/admin/login', {
    method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ username: 'boccantina-admin', password })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const stored = await (await request('/api/orders', { headers: { cookie } })).json();
  assert.equal(stored.orders.length, 2);
  assert.ok(stored.orders.every((order) => !('destination' in order.items[0])), 'Los pedidos antiguos no deben reescribirse.');

  const mixedPayload = {
    clientRequestId: randomUUID(), channel: 'table', table: 7,
    items: [
      { productId: 'plato-1', name: 'Plato de prueba', quantity: 2, unitPrice: 1000, destination: 'dine-in', extras: [{ id: 'extra-1', name: 'Extra', price: 300 }], note: 'Sin salsa' },
      { productId: 'plato-1', name: 'Plato de prueba', quantity: 1, unitPrice: 1000, destination: 'takeaway', extras: [], note: 'Empacar aparte' }
    ]
  };
  const created = await postOrder(mixedPayload);
  assert.equal(created.status, 201);
  const mixed = (await created.json()).order;
  assert.equal(mixed.total, 3600);
  assert.equal(mixed.table, 7);
  assert.deepEqual(mixed.items.map((item) => item.destination), ['dine-in', 'takeaway']);
  assert.equal(mixed.items[0].quantity, 2);
  assert.equal(mixed.items[0].extras[0].price, 300);
  assert.equal(mixed.items[1].note, 'Empacar aparte');
  const repeated = await postOrder(mixedPayload);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).order.id, mixed.id);
  assert.equal((await postOrder({ ...mixedPayload, items: mixedPayload.items.slice(0, 1) })).status, 409);

  const legacyPayload = { channel: 'table', table: 7, items: [{ productId: 'plato-2', name: 'Plato simple', quantity: 1, unitPrice: 900 }] };
  const simple = await postOrder(legacyPayload);
  assert.equal(simple.status, 201);
  assert.equal((await simple.json()).order.items[0].destination, 'dine-in');
  const takeawayPayload = { channel: 'takeaway', customerName: 'Cliente de prueba', phone: '88888888', items: [{ productId: 'plato-2', name: 'Plato simple', quantity: 1, unitPrice: 900, destination: 'takeaway' }] };
  const takeaway = await postOrder(takeawayPayload);
  assert.equal(takeaway.status, 201);
  assert.equal((await takeaway.json()).order.table, null);
  assert.equal((await postOrder({ ...takeawayPayload, items: [{ ...takeawayPayload.items[0], destination: 'dine-in' }] })).status, 400);
  assert.equal((await postOrder({ ...legacyPayload, items: [{ ...legacyPayload.items[0], destination: 'invalid' }] })).status, 400);
  assert.equal((await postOrder({ ...mixedPayload, clientRequestId: randomUUID(), channel: 'counter', table: 8 }, null)).status, 401);

  const counter = await postOrder({ ...mixedPayload, clientRequestId: randomUUID(), channel: 'counter', table: 8 }, cookie);
  assert.equal(counter.status, 201);
  assert.equal((await counter.json()).order.table, 8);
  assert.equal((await postOrder({ ...mixedPayload, clientRequestId: randomUUID(), channel: 'counter', table: 9 }, cookie)).status, 409);
  const tables = await (await request('/api/tables?count=8', { headers: { cookie } })).json();
  assert.equal(tables.tables[7].status, 'occupied');
  const status = await request(`/api/orders/${mixed.id}`, { method: 'PATCH', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) });
  assert.equal(status.status, 200);
  const payment = await request(`/api/orders/${mixed.id}/payment`, { method: 'PATCH', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ paymentStatus: 'paid', paymentMethod: 'cash' }) });
  assert.equal(payment.status, 200);
  const all = (await (await request('/api/orders', { headers: { cookie } })).json()).orders;
  assert.equal(all.length, 6);
  assert.equal(all.find((order) => order.id === mixed.id).status, 'confirmed');
  assert.equal(all.find((order) => order.id === mixed.id).paymentStatus, 'paid');
  const persisted = JSON.parse(await readFile(resolve(dataDir, 'restaurant-system.json'), 'utf8'));
  assert.ok(persisted.orders.slice(0, 2).every((order) => !('destination' in order.items[0])));
  console.log('Pedidos mixtos: una orden y subtotal, destinos, mesa, caja, retiro, historial, cobro, estados e idempotencia OK.');
} finally {
  server?.kill();
  await rm(dataDir, { recursive: true, force: true });
}
