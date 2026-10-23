import { createServer } from 'node:http';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { readFile, stat, mkdir, writeFile, rename, appendFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import QRCode from 'qrcode';
import { allPermissions, effectivePermissions, hashCentralPassword, operationLabels, operationPermissions, permissionLabels, publicCentralUser, readCentralUsers, roleDefinitions, updateCentralUsers, verifyCentralUser, viewPermissions } from './central-users.mjs';
import { normalizeExtras, unavailableItems } from './catalog-ops.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const publicRoot = resolve(repoRoot, 'snapshot', new URL(config.origin).hostname);
const dataRoot = resolve(process.env.BOCCANTINA_DATA_DIR || join(repoRoot, '.preview-data'));
const adminAuthFile = join(dataRoot, 'admin-auth.json');
const previewPort = Number(process.env.BOCCANTINA_PREVIEW_PORT) || config.localPort;
const previewHost = process.env.BOCCANTINA_PREVIEW_HOST === '127.0.0.1' ? '127.0.0.1' : '0.0.0.0';
const scrypt = promisify(scryptCallback);
const adminSessions = new Map();
const auditFile = join(dataRoot, 'security-audit.jsonl');
let auditQueue = Promise.resolve();
function audit(session, action, resource, result = 'ok') {
  const entry = { at:new Date().toISOString(), actor:session?.role === 'owner' ? 'owner' : session?.userId || 'anonymous', action, resource, result };
  auditQueue = auditQueue.then(() => appendFile(auditFile, `${JSON.stringify(entry)}\n`, { mode:0o600 })).catch(error => { console.error('No se pudo registrar auditoría:', error); });
  return auditQueue;
}
const loginFailures = new Map();
const dataFile = join(dataRoot, 'restaurant-system.json');
const dataTemp = join(dataRoot, 'restaurant-system.tmp');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.woff':'font/woff', '.woff2':'font/woff2', '.pdf':'application/pdf' };
const allowedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['delivered'], delivered: [], cancelled: [] };
const paymentStatuses = ['unpaid', 'paid'];
const paymentMethods = ['cash', 'card', 'sinpe', 'other'];
const reservationStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled'];
const reservationTransitions = { pending: ['confirmed', 'cancelled'], confirmed: ['seated', 'cancelled'], seated: ['completed'], completed: [], cancelled: [] };
const cleanText = (value, maximum = 240) => String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maximum);

await mkdir(dataRoot, { recursive: true });
let store = { counter: 0, reservationCounter: 0, tableCount: 12, orders: [], requests: [], reservations: [], extras: null, tables: {}, waiters: [], assignments: {} };
try {
  const saved = JSON.parse(await readFile(dataFile, 'utf8'));
  store = {
    counter: Number.isInteger(saved.counter) ? saved.counter : 0,
    reservationCounter: Number.isInteger(saved.reservationCounter) ? saved.reservationCounter : 0,
    tableCount: Number.isInteger(saved.tableCount) && saved.tableCount >= 1 && saved.tableCount <= 100 ? saved.tableCount : 12,
    orders: Array.isArray(saved.orders) ? saved.orders : [],
    requests: Array.isArray(saved.requests) ? saved.requests : [],
    reservations: Array.isArray(saved.reservations) ? saved.reservations : [],
    extras: saved.extras && typeof saved.extras === 'object' ? saved.extras : null,
    tables: saved.tables && typeof saved.tables === 'object' && !Array.isArray(saved.tables) ? saved.tables : {},
    waiters: Array.isArray(saved.waiters) ? saved.waiters : [],
    assignments: saved.assignments && typeof saved.assignments === 'object' && !Array.isArray(saved.assignments) ? saved.assignments : {}
  };
} catch {
  // The first run starts with an empty local test database.
}

let storeNeedsMigration = false;
store.orders = store.orders.map((order) => {
  const migrated = {
    ...order,
    channel: order.channel || (order.table ? 'table' : 'counter'),
    paymentStatus: paymentStatuses.includes(order.paymentStatus) ? order.paymentStatus : 'unpaid',
    paymentMethod: paymentMethods.includes(order.paymentMethod) ? order.paymentMethod : null,
    paidAt: order.paidAt || null,
    pickupCode: /^\d{4}$/.test(String(order.pickupCode || '')) ? String(order.pickupCode) : String(Math.floor(1000 + Math.random() * 9000)),
    trackingToken: order.trackingToken || crypto.randomUUID()
  };
  if (JSON.stringify(migrated) !== JSON.stringify(order)) storeNeedsMigration = true;
  return migrated;
});

store.reservations = store.reservations.map((reservation) => {
  const migrated = {
    ...reservation,
    table: Number.isInteger(Number(reservation.table)) && Number(reservation.table) > 0 ? Number(reservation.table) : null,
    durationMinutes: Number.isInteger(Number(reservation.durationMinutes)) && Number(reservation.durationMinutes) > 0 ? Number(reservation.durationMinutes) : 120
  };
  if (JSON.stringify(migrated) !== JSON.stringify(reservation)) storeNeedsMigration = true;
  return migrated;
});

let saveQueue = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(store, null, 2);
  saveQueue = saveQueue.then(async () => {
    await writeFile(dataTemp, snapshot, 'utf8');
    await rename(dataTemp, dataFile);
  });
  return saveQueue;
}

if (storeNeedsMigration) await persist();

async function fileFor(requestPath) {
  const clean = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const candidate = resolve(publicRoot, normalize(clean || 'index.html'));
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${sep}`)) return null;
  try { const info = await stat(candidate); return info.isDirectory() ? join(candidate, 'index.html') : candidate; }
  catch { const withIndex = join(candidate, 'index.html'); try { await stat(withIndex); return withIndex; } catch { return null; } }
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  response.end(JSON.stringify(body));
}

async function adminSession(request) {
  const token = /(?:^|;\s*)boccantina_admin=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
  const session = token && adminSessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) { adminSessions.delete(token); return null; }
  session.expires = Date.now() + 8 * 60 * 60 * 1000;
  if (session.role === 'staff') {
    const user = (await readCentralUsers()).find(item => item.id === session.userId && item.active);
    if (!user) { adminSessions.delete(token); return null; }
    const assignedTables = user.waiterId ? Object.entries(store.assignments).filter(([,waiterId]) => waiterId === user.waiterId).map(([table]) => Number(table)) : [];
    return { token, ...session, name:user.name, roles:user.roles || [], waiterId:user.waiterId || null, assignedTables, permissions:viewPermissions(user), operations:effectivePermissions(user) };
  }
  let ownerAuth;
  try { ownerAuth = JSON.parse(await readFile(adminAuthFile, 'utf8')); }
  catch { adminSessions.delete(token); return null; }
  if (ownerAuth.hash !== session.ownerHash) { adminSessions.delete(token); return null; }
  return { token, ...session, name:'Superadministrador', roles:['owner'], permissions:[...allPermissions,'boccantina.availability'], operations:operationPermissions };
}
const allowed = (session, permission) => session?.role === 'owner' || session?.operations?.includes(permission);
const recentlyAuthenticated = session => Number.isFinite(session?.authenticatedAt) && Date.now() - session.authenticatedAt < 15 * 60 * 1000;
function revokeUserSessions(userId) {
  for (const [token, session] of adminSessions) if (session.userId === userId) adminSessions.delete(token);
}
function waiterScope(session) { return Boolean(session?.role === 'staff' && allowed(session,'orders.view_assigned') && !allowed(session,'orders.view')); }
function orderInScope(session, order) {
  return !waiterScope(session) || Boolean(session.waiterId && order.table && store.assignments[String(order.table)] === session.waiterId);
}
function kitchenSafeOrder(order) {
  const { total, paymentStatus, paymentMethod, paidAt, phone, customerName, pickupCode, trackingToken, ...safe } = order;
  return { ...safe, items:(order.items || []).map(({ unitPrice, price, subtotal, total:itemTotal, extras, ...item }) => ({ ...item, extras:(extras || []).map(({ price:extraPrice, unitPrice:extraUnitPrice, ...extra }) => extra) })) };
}
function orderForSession(session, order) {
  if (allowed(session,'payments.view')) return order;
  if (!allowed(session,'orders.view')) return kitchenSafeOrder(order);
  const { total, paymentMethod, paidAt, trackingToken, ...safe } = order;
  return { ...safe, items:(order.items || []).map(({ unitPrice, price, subtotal, total:itemTotal, extras, ...item }) => ({ ...item, extras:(extras || []).map(({ price:extraPrice, unitPrice:extraUnitPrice, ...extra }) => extra) })) };
}

function validOrigin(request) {
  const origin = request.headers.origin;
  return origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`;
}

function adminCookie(request, token, age) {
  return `boccantina_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${request.socket.encrypted ? '; Secure' : ''}`;
}

function protectedApi(request, path) {
  const method = request.method;
  return (path === '/api/waiters')
    || /^\/api\/waiters\//.test(path)
    || (path === '/api/reservations' && method === 'GET')
    || /^\/api\/reservations\//.test(path)
    || path === '/api/tables'
    || (/^\/api\/tables\//.test(path) && !/\/open$/.test(path))
    || (path === '/api/orders' && method === 'GET')
    || (/^\/api\/orders\//.test(path) && path !== '/api/orders/track')
    || (path === '/api/service-requests' && method === 'GET')
    || /^\/api\/service-requests\//.test(path)
    || (path === '/api/config/extras' && method !== 'GET')
    || path === '/api/qr';
}
function apiAccessAllowed(session, request, path) {
  if (session.role === 'owner') return true;
  if (path === '/api/orders' && request.method === 'GET') return allowed(session,'orders.view') || allowed(session,'orders.view_assigned') || allowed(session,'kitchen.view');
  if (/^\/api\/orders\//.test(path)) return /\/payment$/.test(path) ? allowed(session,'payments.collect') || allowed(session,'payments.refund') : allowed(session,'orders.view') || allowed(session,'orders.view_assigned') || allowed(session,'kitchen.view');
  if (path.startsWith('/api/reservations')) return request.method === 'GET' ? allowed(session,'reservations.view') : allowed(session,'reservations.manage');
  if (path.startsWith('/api/waiters')) return request.method === 'GET' ? allowed(session,'orders.view') || allowed(session,'orders.view_assigned') || allowed(session,'tables.assign') : allowed(session,'tables.manage');
  if (path === '/api/tables' && request.method === 'GET') return allowed(session,'tables.view');
  if (path === '/api/tables/config') return allowed(session,'tables.manage');
  if (/^\/api\/tables\/\d+\/claim$/.test(path)) return allowed(session,'tables.claim');
  if (/^\/api\/tables\/\d+\/assignment$/.test(path)) return session.roles?.includes('reception') && allowed(session,'tables.assign');
  if (/^\/api\/tables\/\d+$/.test(path) && request.method === 'PATCH') return allowed(session,'tables.release');
  if (path.startsWith('/api/tables')) return allowed(session,'tables.manage');
  if (path.startsWith('/api/service-requests')) return request.method === 'GET' ? allowed(session,'orders.view') || allowed(session,'orders.view_assigned') || allowed(session,'tables.assign') : allowed(session,'orders.cancel') || allowed(session,'payments.collect') || allowed(session,'tables.assign');
  if (path === '/api/config/extras') return allowed(session,'extras.manage') || allowed(session,'availability.manage');
  if (path === '/api/qr') return allowed(session,'tables.manage');
  return false;
}

function pagePermission(path, url) {
  if (path === '/admin/pedidos/' || path === '/admin/pedidos/index.html') return 'boccantina.orders';
  if (path === '/admin/cocina/' || path === '/admin/cocina/index.html') return 'boccantina.kitchen';
  if (path === '/admin/reservaciones/' || path === '/admin/reservaciones/index.html') return 'boccantina.reservations';
  if (path === '/admin/extras/' || path === '/admin/extras/index.html') return 'boccantina.extras';
  if (path === '/admin/disponibilidad/' || path === '/admin/disponibilidad/index.html') return 'boccantina.availability';
  if (path === '/qr-mesas/' || path === '/qr-mesas/index.html' || path === '/qr-mesas') return 'boccantina.tables';
  if (path === '/' && url.searchParams.get('admin') === 'extras') return 'boccantina.extras';
  if ((path === '/pedido' || path.startsWith('/pedido/')) && (url.searchParams.get('modo') === 'interno' || url.searchParams.get('tipo') === 'counter')) return 'boccantina.new-order';
  return null;
}
function firstAllowedPath(permissions, roles = []) {
  if (roles.includes('waiter') && !roles.some(role => ['cashier','reception'].includes(role)) && permissions.includes('boccantina.tables')) return '/qr-mesas/';
  return [
    ['boccantina.orders','/admin/pedidos/'], ['boccantina.kitchen','/admin/cocina/'],
    ['boccantina.reservations','/admin/reservaciones/'], ['boccantina.tables','/qr-mesas/'],
    ['boccantina.new-order','/pedido/?modo=interno'], ['boccantina.extras','/admin/extras/'], ['boccantina.availability','/admin/disponibilidad/']
  ].find(([permission]) => permissions.includes(permission))?.[1] || '/admin/login/';
}
function restrictedPage(response, permissions) {
  response.writeHead(403, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
  response.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso restringido · Boccantina</title><body style="font:16px/1.5 system-ui;background:#0d1b22;color:#f8f2e9;max-width:42rem;margin:5rem auto;padding:1.5rem"><h1>Acceso restringido</h1><p>Tu cuenta no tiene permiso para abrir esta sección de Boccantina.</p><a style="color:#f0d39a" href="${firstAllowedPath(permissions)}">Ir a mi vista disponible</a></body></html>`);
}

async function manageStaff(request, response, path) {
  const session = await adminSession(request);
  if (!session) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
  if (session.role !== 'owner') { await audit(session, 'access.denied', path, 'denied'); return json(response, 403, { error:'Solo el superadministrador puede gestionar el personal.' }); }
  if (request.method === 'GET' && path === '/api/admin/audit') {
    let entries = [];
    try { entries = (await readFile(auditFile, 'utf8')).trim().split('\n').filter(Boolean).slice(-200).reverse().map(line => JSON.parse(line)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return json(response, 200, { entries });
  }
  if (request.method === 'GET' && path === '/api/admin/users') {
    const owner = JSON.parse(await readFile(adminAuthFile, 'utf8'));
    return json(response, 200, { owner:{ username:owner.username }, users:(await readCentralUsers()).map(publicCentralUser), permissions:permissionLabels, operations:operationLabels, roles:roleDefinitions, waiters:store.waiters.map(({ id,name,active }) => ({ id,name,active })) });
  }
  if (!['POST','PATCH'].includes(request.method)) return json(response, 405, { error:'Método no permitido.' });
  if (!validOrigin(request)) return json(response, 403, { error:'Origen no permitido.' });
  if (!recentlyAuthenticated(session)) return json(response, 403, { error:'Vuelve a iniciar sesión para modificar cuentas y permisos.' });
  if ((request.method === 'POST' && path !== '/api/admin/users') || (request.method === 'PATCH' && !/^\/api\/admin\/users\/[0-9a-f-]{36}$/i.test(path))) return json(response, 404, { error:'Usuario no encontrado.' });
  const input = await jsonBody(request);
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const modern = Array.isArray(input.roles);
  const roles = modern ? input.roles : null;
  const grants = modern ? input.grants || [] : null;
  const denies = modern ? input.denies || [] : null;
  const permissions = modern ? [] : input.permissions;
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) || name.length < 2 || name.length > 80 || (input.active !== undefined && typeof input.active !== 'boolean')) return json(response, 400, { error:'Revisa el nombre, el usuario y el estado de cuenta.' });
  if (modern && (!roles.length && !grants.length || roles.some(role => !roleDefinitions[role]) || new Set(roles).size !== roles.length || !Array.isArray(grants) || grants.some(value => !operationPermissions.includes(value) || ['users.view','users.manage','roles.manage','audit.view','settings.manage','tables.manage'].includes(value)) || new Set(grants).size !== grants.length || !Array.isArray(denies) || denies.some(value => !operationPermissions.includes(value)) || new Set(denies).size !== denies.length || !effectivePermissions({roles,grants,denies}).length)) return json(response, 400, { error:'Selecciona un puesto válido y revisa los permisos avanzados.' });
  if (!modern && (!Array.isArray(permissions) || !permissions.length || permissions.some(value => !allPermissions.includes(value)) || new Set(permissions).size !== permissions.length)) return json(response, 400, { error:'Selecciona al menos una vista permitida.' });
  const waiterId = modern && input.waiterId ? String(input.waiterId) : null;
  if (waiterId && !store.waiters.some(waiter => waiter.id === waiterId && waiter.active)) return json(response, 400, { error:'Selecciona un mesero registrado y activo.' });
  const ownerAuth = JSON.parse(await readFile(adminAuthFile, 'utf8'));
  if (username.toLowerCase() === ownerAuth.username.toLowerCase()) return json(response, 409, { error:'Este usuario está reservado para la cuenta propietaria.' });
  let secret = null;
  if (request.method === 'POST' || input.password) {
    try { secret = await hashCentralPassword(input.password); }
    catch (error) { return json(response, 400, { error:error.message }); }
  }
  try {
    let previousAccess = null;
    const saved = await updateCentralUsers(users => {
      const existing = request.method === 'PATCH' ? users.find(user => user.id === path.slice('/api/admin/users/'.length)) : null;
      if (request.method === 'PATCH' && !existing) { const error = new Error('Usuario no encontrado.'); error.status = 404; throw error; }
      if (users.some(user => user.id !== existing?.id && user.username.toLowerCase() === username.toLowerCase())) { const error = new Error('Ese usuario ya existe.'); error.status = 409; throw error; }
      if (existing) previousAccess = { active:existing.active, roles:existing.roles || [], operations:effectivePermissions(existing) };
      const now = new Date().toISOString();
      const next = existing || { id:randomUUID(), createdAt:now };
      Object.assign(next, { username, name, permissions, ...(modern ? { roles, grants, denies, waiterId } : {}), active:input.active !== false, updatedAt:now, ...(secret || {}) });
      if (!existing) users.push(next);
      return publicCentralUser(next);
    });
    if (request.method === 'PATCH') revokeUserSessions(saved.id);
    await audit(session, request.method === 'POST' ? 'user.create' : 'user.update', `user:${saved.id}`);
    if (previousAccess?.active && !saved.active) await audit(session, 'user.deactivate', `user:${saved.id}`);
    if (previousAccess && JSON.stringify(previousAccess.roles.slice().sort()) !== JSON.stringify(saved.roles.slice().sort())) await audit(session, 'user.roles.update', `user:${saved.id}`);
    if (previousAccess && JSON.stringify(previousAccess.operations.slice().sort()) !== JSON.stringify(saved.operations.slice().sort())) await audit(session, 'user.permissions.update', `user:${saved.id}`);
    if (previousAccess && secret) await audit(session, 'user.password.change', `user:${saved.id}`);
    return json(response, request.method === 'POST' ? 201 : 200, { user:saved });
  } catch (error) { return json(response, error.status || 500, { error:error.status ? error.message : 'No se pudo guardar el usuario.' }); }
}

async function adminLogin(request, response) {
  const ip = request.socket.remoteAddress || 'local';
  const recent = (loginFailures.get(ip) || []).filter((time) => Date.now() - time < 15 * 60 * 1000);
  if (recent.length >= 8) return json(response, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
  let auth = null;
  try { auth = JSON.parse(await readFile(adminAuthFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { username, password } = await jsonBody(request);
  if (typeof username !== 'string' || username.length > 80 || typeof password !== 'string' || password.length > 256) return json(response, 400, { error: 'Usuario o contraseña inválidos.' });
  let owner = false;
  if (auth && username === auth.username) {
    const params = auth.params?.N === (1 << 14) && auth.params?.r === 8 && auth.params?.p === 5 ? { N:1 << 14, r:8, p:5, maxmem:64 * 1024 * 1024 } : {};
    const candidate = await scrypt(password, Buffer.from(auth.salt, 'hex'), 64, params);
    const expected = Buffer.from(auth.hash, 'hex');
    owner = expected.length === candidate.length && timingSafeEqual(candidate, expected);
  }
  const user = owner ? null : await verifyCentralUser(username, password);
  if (!owner && (!user || !effectivePermissions(user).length)) {
    recent.push(Date.now()); loginFailures.set(ip, recent);
    return json(response, 401, { error: 'Usuario o contraseña incorrectos.' });
  }
  loginFailures.delete(ip);
  const token = randomBytes(32).toString('hex');
  adminSessions.set(token, { role:owner ? 'owner' : 'staff', userId:user?.id || null, ownerHash:owner ? auth.hash : null, authenticatedAt:Date.now(), expires: Date.now() + 8 * 60 * 60 * 1000 });
  if (user) await updateCentralUsers(users => { const entry = users.find(item => item.id === user.id); if (entry) entry.lastLoginAt = new Date().toISOString(); });
  const permissions = owner ? [...allPermissions,'boccantina.availability'] : viewPermissions(user);
  response.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff', 'set-cookie':adminCookie(request, token, 28800) });
  response.end(JSON.stringify({ authenticated:true, role:owner ? 'owner' : 'staff', name:owner ? 'Superadministrador' : user.name, roles:owner ? ['owner'] : user.roles || [], permissions, operations:owner ? operationPermissions : effectivePermissions(user) }));
}

async function jsonBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 262144) throw new Error('La solicitud supera el tamaño permitido.');
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw new Error('La solicitud no contiene JSON válido.'); }
}

function normalizeOrder(payload) {
  const channel = ['table', 'takeaway', 'counter'].includes(payload.channel) ? payload.channel : 'table';
  const hasTable = channel === 'table' || (channel === 'counter' && payload.table !== null && payload.table !== undefined && payload.table !== '');
  const table = hasTable ? Number(payload.table) : null;
  if (hasTable && (!Number.isInteger(table) || table < 1 || table > 100)) throw new Error('Número de mesa inválido.');
  const customerName = cleanText(payload.customerName, 100);
  const phone = cleanText(payload.phone, 40);
  if (channel === 'takeaway' && (customerName.length < 2 || phone.replace(/\D/g, '').length < 8)) throw new Error('Para llevar requiere nombre y teléfono válidos.');
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 60) throw new Error('El pedido no contiene productos válidos.');
  const items = payload.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Uno de los productos es inválido.');
    const name = cleanText(item.name, 100);
    if (!name) throw new Error('Uno de los productos no tiene nombre.');
    const destination = item.destination == null ? (channel === 'takeaway' ? 'takeaway' : 'dine-in') : cleanText(item.destination, 20);
    if (!['dine-in', 'takeaway'].includes(destination) || (channel === 'takeaway' && destination !== 'takeaway')) throw new Error('El destino de uno de los productos es inválido.');
    return {
      productId: cleanText(item.productId, 80), name, quantity, unitPrice: Math.round(unitPrice), destination, note: cleanText(item.note, 180),
      extras: Array.isArray(item.extras) ? item.extras.slice(0, 20).map((extra) => ({ id: cleanText(extra.id, 80), name: cleanText(extra.name, 100), price: extra.price === null ? null : Math.max(0, Math.round(Number(extra.price) || 0)) })).filter((extra) => extra.name) : []
    };
  });
  const calculatedTotal = items.reduce((sum, item) => sum + item.quantity * (item.unitPrice + item.extras.reduce((extraSum, extra) => extraSum + (Number(extra.price) || 0), 0)), 0);
  const clientRequestId = /^[0-9a-f-]{36}$/i.test(String(payload.clientRequestId || '')) ? String(payload.clientRequestId) : null;
  return { channel, table, customerName, phone, items, note: cleanText(payload.note, 240), total: calculatedTotal, clientRequestId };
}

function normalizeReservationFields(payload) {
  const date = cleanText(payload.date, 10);
  const time = cleanText(payload.time, 5);
  const guests = cleanText(payload.guests, 8);
  const name = cleanText(payload.name, 100);
  const phone = cleanText(payload.phone, 40);
  const email = cleanText(payload.email, 120);
  const source = ['web', 'phone', 'whatsapp', 'walk-in', 'manual'].includes(payload.source) ? payload.source : 'manual';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !guests || name.length < 2 || phone.replace(/\D/g, '').length < 8) throw new Error('La reservación requiere fecha, hora, personas, nombre y teléfono válidos.');
  return { date, time, guests, name, phone, email, source, occasion: cleanText(payload.occasion, 80), preferences: cleanText(payload.preferences, 300) };
}

function normalizeReservation(payload) {
  return { ...normalizeReservationFields(payload), table: null, durationMinutes: 120 };
}

function reservationStartMinutes(reservation) {
  const [hours, minutes] = String(reservation.time || '').split(':').map(Number);
  return (hours * 60) + minutes;
}

function reservationsOverlap(first, second) {
  if (first.date !== second.date) return false;
  const firstStart = reservationStartMinutes(first);
  const secondStart = reservationStartMinutes(second);
  const firstEnd = firstStart + (Number(first.durationMinutes) || 120);
  const secondEnd = secondStart + (Number(second.durationMinutes) || 120);
  return firstStart < secondEnd && secondStart < firstEnd;
}

function conflictingReservation(candidate, ignoredId = '') {
  return store.reservations.find((reservation) => reservation.id !== ignoredId
    && !['cancelled', 'completed'].includes(reservation.status)
    && reservation.table === candidate.table
    && reservationsOverlap(reservation, candidate));
}

function localAddresses(port) {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) if (entry.family === 'IPv4' && !entry.internal) addresses.push(`http://${entry.address}:${port}/`);
  }
  return addresses;
}

function validTable(value) {
  const table = Number(value);
  if (!Number.isInteger(table) || table < 1 || table > 100) throw new Error('Número de mesa inválido.');
  return table;
}

function ordersForCurrentSession(table) {
  const current = store.tables[String(table)];
  const openedAt = current?.openedAt;
  return store.orders.filter((order) => order.table === table && (openedAt
    ? (current.accountId && order.accountId ? order.accountId === current.accountId : order.createdAt >= openedAt)
    : order.status !== 'cancelled' && (order.status !== 'delivered' || order.paymentStatus !== 'paid')));
}

function activeOrdersForTable(table) {
  return ordersForCurrentSession(table).filter((order) => !['delivered', 'cancelled'].includes(order.status));
}

function unpaidOrdersForTable(table) {
  return ordersForCurrentSession(table).filter((order) => order.status !== 'cancelled' && order.paymentStatus !== 'paid');
}

function businessDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function activeReservationForTable(table) {
  return store.reservations
    .filter((reservation) => reservation.table === table
      && !['cancelled', 'completed'].includes(reservation.status)
      && reservation.date === businessDate())
    .sort((first, second) => first.time.localeCompare(second.time))[0] || null;
}

function publicOrder(order) {
  return {
    id: order.id,
    code: order.code,
    channel: order.channel || 'table',
    table: order.table || null,
    customerName: order.customerName || '',
    status: order.status,
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentMethod: order.paymentMethod || null,
    pickupCode: order.pickupCode,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items
  };
}

function tableSnapshot(table) {
  const session = store.tables[String(table)];
  const sessionOrders = ordersForCurrentSession(table).filter((order) => order.status !== 'cancelled');
  const activeOrders = activeOrdersForTable(table);
  const unpaidOrders = unpaidOrdersForTable(table);
  const reservation = activeReservationForTable(table);
  const occupied = session?.status === 'occupied' || activeOrders.length > 0 || unpaidOrders.length > 0 || reservation?.status === 'seated';
  const reserved = !occupied && reservation && ['pending', 'confirmed'].includes(reservation.status);
  const waiterId = cleanText(store.assignments[String(table)], 80);
  const waiter = store.waiters.find((item) => item.id === waiterId);
  return {
    table,
    status: occupied ? 'occupied' : reserved ? 'reserved' : 'available',
    openedAt: session?.openedAt || null,
    accountId: session?.accountId || null,
    serviceStartedAt: session?.serviceStartedAt || null,
    assignedAt: session?.assignedAt || null,
    updatedAt: session?.updatedAt || reservation?.updatedAt || null,
    activeOrders: activeOrders.length,
    unpaidOrders: unpaidOrders.length,
    totalOrders: sessionOrders.length,
    canRelease: !reserved && activeOrders.length === 0 && unpaidOrders.length === 0,
    waiterId: waiter?.id || null,
    waiterName: waiter?.name || null,
    reservationId: cleanText(session?.reservationId, 80) || reservation?.id || null,
    reservation: reservation ? {
      id: reservation.id, code: reservation.code, date: reservation.date, time: reservation.time,
      status: reservation.status, guests: reservation.guests
    } : null
  };
}

function occupyTable(table, reservationId = null) {
  const current = store.tables[String(table)];
  const timestamp = new Date().toISOString();
  const continuing = current?.status === 'occupied' && current.openedAt;
  store.tables[String(table)] = {
    ...current,
    status: 'occupied',
    openedAt: continuing ? current.openedAt : timestamp,
    accountId: continuing && current.accountId ? current.accountId : randomUUID(),
    serviceStartedAt: current?.serviceStartedAt || null,
    updatedAt: timestamp,
    reservationId: reservationId || current?.reservationId || null
  };
}

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, orders: store.orders.length, networkUrls: previewHost === '127.0.0.1' ? [] : localAddresses(previewPort) });

  if (request.method === 'GET' && url.pathname === '/api/waiters') {
    const users = await readCentralUsers();
    return json(response, 200, { waiters:store.waiters.map(waiter => ({ ...waiter, authorized:users.some(user => user.active && user.waiterId === waiter.id && effectivePermissions(user).includes('orders.create_for_table')) })) });
  }
  if (request.method === 'POST' && url.pathname === '/api/waiters') {
    const payload = await jsonBody(request);
    const name = cleanText(payload.name, 80);
    if (name.length < 2) return json(response, 400, { error: 'Escribe el nombre del mesero.' });
    const waiter = { id: crypto.randomUUID(), name, active: true, createdAt: new Date().toISOString() };
    store.waiters.push(waiter); await persist(); return json(response, 201, { waiter });
  }
  const waiterMatch = url.pathname.match(/^\/api\/waiters\/([0-9a-f-]+)$/i);
  if (request.method === 'DELETE' && waiterMatch) {
    if (Object.values(store.assignments).includes(waiterMatch[1])) return json(response, 409, { error: 'El mesero está asignado a una mesa activa.' });
    const index = store.waiters.findIndex((item) => item.id === waiterMatch[1]);
    if (index < 0) return json(response, 404, { error: 'Mesero no encontrado.' });
    store.waiters.splice(index, 1); await persist(); return json(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/reservations') return json(response, 200, { reservations: [...store.reservations].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)) });
  if (request.method === 'POST' && url.pathname === '/api/reservations') {
    const submitted = await jsonBody(request);
    const actingSession = await adminSession(request);
    if (actingSession?.role === 'staff' && !allowed(actingSession,'reservations.manage')) return json(response, 403, { error:'Tu cuenta no puede crear reservaciones.' });
    if (submitted.source !== 'web') {
      const session = actingSession;
      if (!session || !validOrigin(request)) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      if (session.role !== 'owner' && !session.permissions.includes('boccantina.reservations')) return json(response, 403, { error:'Sin acceso a Reservaciones.' });
    }
    const payload = normalizeReservation(submitted);
    store.reservationCounter += 1;
    const createdAt = new Date().toISOString();
    const reservation = { id: crypto.randomUUID(), code: `RES-${String(store.reservationCounter).padStart(3, '0')}`, status: 'pending', createdAt, updatedAt: createdAt, ...payload };
    store.reservations.push(reservation); await persist();
    if (submitted.source !== 'web') await audit(await adminSession(request), 'reservation.create', `reservation:${reservation.id}`);
    return json(response, 201, { reservation });
  }
  const reservationMatch = url.pathname.match(/^\/api\/reservations\/([0-9a-f-]+)$/i);
  if (request.method === 'PATCH' && reservationMatch) {
    const reservation = store.reservations.find((item) => item.id === reservationMatch[1]);
    if (!reservation) return json(response, 404, { error: 'Reservación no encontrada.' });
    const payload = await jsonBody(request);
    const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'status');
    const hasTable = Object.prototype.hasOwnProperty.call(payload, 'table');
    const editableFields = ['date', 'time', 'guests', 'name', 'phone', 'email', 'source', 'occasion', 'preferences'];
    const hasDetails = editableFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (!hasStatus && !hasTable && !hasDetails) return json(response, 400, { error: 'Indica los datos, el estado o la mesa que deseas actualizar.' });
    const nextStatus = hasStatus ? cleanText(payload.status, 20) : reservation.status;
    if (!reservationStatuses.includes(nextStatus)) return json(response, 400, { error: 'Estado de reservación inválido.' });
    if (hasStatus && nextStatus !== reservation.status && !reservationTransitions[reservation.status]?.includes(nextStatus)) return json(response, 409, { error: 'Ese cambio de estado ya no está disponible para esta reservación.' });
    if (hasDetails && !['pending', 'confirmed'].includes(reservation.status)) return json(response, 409, { error: 'Solo puedes modificar una reservación antes de registrar la llegada.' });
    const nextDetails = hasDetails ? normalizeReservationFields({ ...reservation, ...payload }) : null;
    let nextTable = reservation.table || null;
    if (hasTable) {
      if (payload.table === null || payload.table === '') nextTable = null;
      else nextTable = validTable(payload.table);
    }
    if (nextStatus === 'seated' && !nextTable) return json(response, 409, { error: 'Asigna una mesa antes de registrar la llegada.' });
    if (nextStatus === 'confirmed' && !nextTable && (hasStatus || hasTable)) return json(response, 409, { error: 'Asigna una mesa antes de confirmar la reservación.' });
    if (nextStatus !== 'cancelled' && nextTable) {
      const conflict = conflictingReservation({ ...reservation, ...(nextDetails || {}), status: nextStatus, table: nextTable }, reservation.id);
      if (conflict) return json(response, 409, { error: `La mesa ${nextTable} ya está asignada a ${conflict.code} a las ${conflict.time}. Elige otra mesa u otro horario.` });
    }
    if (nextStatus === 'seated' && reservation.status !== 'seated') {
      const session = store.tables[String(nextTable)];
      if (tableSnapshot(nextTable).status === 'occupied' && session?.reservationId !== reservation.id) return json(response, 409, { error: `La mesa ${nextTable} está ocupada. Libérala o asigna otra mesa antes de registrar la llegada.` });
      occupyTable(nextTable, reservation.id);
      reservation.seatedAt = new Date().toISOString();
    }
    if (nextStatus === 'completed' && reservation.status !== 'completed') {
      if (activeOrdersForTable(nextTable).length) return json(response, 409, { error: 'La mesa tiene pedidos activos. Finalízalos antes de completar la reservación.' });
      if (unpaidOrdersForTable(nextTable).length) return json(response, 409, { error: 'La mesa tiene consumos pendientes de pago. Registra el cobro antes de liberarla.' });
      const timestamp = new Date().toISOString();
      store.tables[String(nextTable)] = { status: 'available', openedAt: null, accountId: null, serviceStartedAt: null, updatedAt: timestamp, reservationId: null };
      delete store.assignments[String(nextTable)];
      reservation.completedAt = timestamp;
    }
    if (nextDetails) Object.assign(reservation, nextDetails);
    reservation.status = nextStatus;
    reservation.table = nextTable;
    reservation.updatedAt = new Date().toISOString();
    await persist(); await audit(await adminSession(request), 'reservation.update', `reservation:${reservation.id}`);
    return json(response, 200, { reservation });
  }
  if (request.method === 'DELETE' && reservationMatch) {
    const index = store.reservations.findIndex((item) => item.id === reservationMatch[1]);
    if (index < 0) return json(response, 404, { error: 'Reservación no encontrada.' });
    if (!['cancelled', 'completed'].includes(store.reservations[index].status)) return json(response, 409, { error: 'Solo se pueden eliminar reservaciones canceladas o cumplidas.' });
    const removedId = store.reservations[index].id;
    store.reservations.splice(index, 1); await persist(); await audit(await adminSession(request), 'reservation.delete', `reservation:${removedId}`); return json(response, 200, { ok: true });
  }

  if (request.method === 'PUT' && url.pathname === '/api/tables/config') {
    const payload = await jsonBody(request);
    const count = Number(payload.count);
    if (!Number.isInteger(count) || count < 1 || count > 100) return json(response, 400, { error:'La cantidad de mesas debe estar entre 1 y 100.' });
    const inUse = [
      ...Object.keys(store.assignments).map(Number),
      ...Object.entries(store.tables).filter(([,value]) => value.status === 'occupied').map(([number]) => Number(number)),
      ...store.reservations.filter(item => !['cancelled','completed'].includes(item.status)).map(item => Number(item.table)),
      ...store.orders.filter(item => item.status !== 'cancelled' && (item.status !== 'delivered' || item.paymentStatus !== 'paid')).map(item => Number(item.table))
    ].filter(Number.isInteger);
    if (inUse.some(number => number > count)) return json(response, 409, { error:'Hay mesas superiores a ese número con atención, pedidos o reservaciones activas.' });
    store.tableCount = count;
    await persist(); await audit(await adminSession(request), 'tables.config.update', 'salon:table-count');
    return json(response, 200, { count });
  }
  if (request.method === 'GET' && url.pathname === '/api/tables') {
    const session = await adminSession(request);
    const requested = Number(url.searchParams.get('count'));
    const count = Number.isInteger(requested) && requested > 0 ? Math.min(requested, session?.role === 'owner' ? 100 : store.tableCount) : store.tableCount;
    const tables = Array.from({ length: count }, (_, index) => tableSnapshot(index + 1));
    return json(response, 200, { count:store.tableCount, tables });
  }
  const tableMatch = url.pathname.match(/^\/api\/tables\/(\d+)(?:\/(open))?$/);
  if (tableMatch) {
    const table = validTable(tableMatch[1]);
    if (request.method === 'POST' && tableMatch[2] === 'open') {
      if (table > store.tableCount) return json(response, 404, { error:'Esa mesa no está configurada en el salón.' });
      const snapshot = tableSnapshot(table);
      if (snapshot.status === 'reserved') return json(response, 409, { error: `La mesa ${table} está reservada para las ${snapshot.reservation.time}. Administración debe registrar la llegada antes de abrir el pedido.` });
      occupyTable(table);
      await persist();
      return json(response, 200, { table: tableSnapshot(table) });
    }
    if (request.method === 'PATCH' && !tableMatch[2]) {
      if (table > store.tableCount) return json(response, 404, { error:'Esa mesa no está configurada en el salón.' });
      const payload = await jsonBody(request);
      if (payload.status !== 'available') return json(response, 400, { error: 'Estado de mesa inválido.' });
      if (tableSnapshot(table).status === 'reserved') return json(response, 409, { error: 'Esta mesa tiene una reservación activa. Cancela o cambia la reservación desde la agenda.' });
      if (tableSnapshot(table).status !== 'occupied') return json(response, 409, { error:'Esta mesa no tiene una atención abierta. Revisa su asignación desde el salón.' });
      if (activeOrdersForTable(table).length) return json(response, 409, { error: 'La mesa tiene pedidos activos. Finalízalos antes de liberarla.' });
      if (unpaidOrdersForTable(table).length) return json(response, 409, { error: 'La mesa tiene consumos pendientes de pago. Registra el cobro antes de liberarla.' });
      const timestamp = new Date().toISOString();
      const linkedReservation = store.reservations.find((item) => item.id === store.tables[String(table)]?.reservationId && item.status === 'seated');
      if (linkedReservation) { linkedReservation.status = 'completed'; linkedReservation.completedAt = timestamp; linkedReservation.updatedAt = timestamp; }
      store.tables[String(table)] = { status: 'available', openedAt: null, accountId: null, serviceStartedAt: null, updatedAt: timestamp, reservationId: null };
      delete store.assignments[String(table)];
      await persist(); await audit(await adminSession(request), 'table.release', `table:${table}`);
      return json(response, 200, { table: tableSnapshot(table) });
    }
  }
  const claimMatch = url.pathname.match(/^\/api\/tables\/(\d+)\/claim$/);
  if (request.method === 'POST' && claimMatch) {
    const table = validTable(claimMatch[1]);
    const session = await adminSession(request);
    if (table > store.tableCount) return json(response, 404, { error:'Esa mesa no está configurada en el salón.' });
    if (!session?.waiterId || !store.waiters.some(item => item.id === session.waiterId && item.active)) return json(response, 409, { error:'Tu cuenta necesita un perfil de mesero activo. Solicita la vinculación al propietario.' });
    const current = tableSnapshot(table);
    const assignedTo = store.assignments[String(table)];
    if (assignedTo && assignedTo !== session.waiterId) return json(response, 409, { error:'Otro mesero ya atiende esta mesa.' });
    if (current.status === 'reserved' || (current.reservationId && assignedTo !== session.waiterId)) return json(response, 409, { error:'Recepción debe registrar la llegada o asignarte esta mesa reservada.' });
    if (!assignedTo) store.assignments[String(table)] = session.waiterId;
    if (current.status === 'available') occupyTable(table);
    const now = new Date().toISOString();
    store.tables[String(table)] = { ...store.tables[String(table)], assignedAt:store.tables[String(table)]?.assignedAt || now, serviceStartedAt:store.tables[String(table)]?.serviceStartedAt || now, updatedAt:now };
    await persist(); await audit(session, 'table.claim', `table:${table}`);
    return json(response, 200, { table: tableSnapshot(table) });
  }
  const assignmentMatch = url.pathname.match(/^\/api\/tables\/(\d+)\/assignment$/);
  if (request.method === 'PUT' && assignmentMatch) {
    const table = validTable(assignmentMatch[1]);
    if (table > store.tableCount) return json(response, 404, { error:'Esa mesa no está configurada en el salón.' });
    const payload = await jsonBody(request); const waiterId = cleanText(payload.waiterId, 80);
    if (waiterId && !store.waiters.some((item) => item.id === waiterId && item.active)) return json(response, 400, { error: 'Mesero no disponible.' });
    const session = await adminSession(request);
    if (waiterId && session?.role !== 'owner' && !(await readCentralUsers()).some(user => user.active && user.waiterId === waiterId && effectivePermissions(user).includes('orders.create_for_table'))) return json(response, 409, { error:'El mesero debe tener una cuenta activa vinculada antes de asignarle una mesa.' });
    if (!waiterId && tableSnapshot(table).status === 'occupied') return json(response, 409, { error:'Reasigna esta mesa a otro mesero antes de dejarla sin responsable.' });
    if (waiterId) store.assignments[String(table)] = waiterId; else delete store.assignments[String(table)];
    store.tables[String(table)] = { ...store.tables[String(table)], assignedAt:waiterId ? new Date().toISOString() : null, updatedAt:new Date().toISOString() };
    await persist(); await audit(session, 'table.assign', `table:${table}`);
    return json(response, 200, { table: tableSnapshot(table) });
  }

  if (request.method === 'GET' && url.pathname === '/api/orders/track') {
    const code = cleanText(url.searchParams.get('code'), 30).toUpperCase();
    const token = cleanText(url.searchParams.get('token'), 80);
    const pickupCode = cleanText(url.searchParams.get('pickupCode'), 10);
    const order = store.orders.find((item) => item.code === code);
    if (!order || !((token && token === order.trackingToken) || (pickupCode && pickupCode === order.pickupCode))) return json(response, 404, { error: 'No encontramos un pedido con esos datos.' });
    return json(response, 200, { order: publicOrder(order) });
  }

  if (request.method === 'GET' && url.pathname === '/api/orders') {
    const session = await adminSession(request);
    return json(response, 200, { orders:store.orders.filter(order => orderInScope(session, order)).map(order => orderForSession(session, order)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }
  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const payload = normalizeOrder(await jsonBody(request));
    const staffSession = await adminSession(request);
    const assignedOrder = staffSession && allowed(staffSession,'orders.create_for_table') && payload.channel === 'counter' && payload.table && staffSession.waiterId && store.assignments[String(payload.table)] === staffSession.waiterId;
    if (staffSession?.role === 'staff' && !allowed(staffSession,'orders.create') && !assignedOrder) return json(response, 403, { error:'Solo puedes crear pedidos para una mesa que atiendes.' });
    if (payload.table && payload.table > store.tableCount) return json(response, 404, { error:'Esa mesa no está configurada en el salón.' });
    if (payload.table && tableSnapshot(payload.table).status === 'reserved') return json(response, 409, { error:'La mesa tiene una reservación activa. Registra la llegada antes de asignarle un pedido.' });
    if (payload.channel === 'counter') {
      const session = staffSession;
      if (!session || !validOrigin(request)) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      if (!allowed(session, 'orders.create') && !assignedOrder) return json(response, 403, { error:'Sin acceso a Nuevo pedido.' });
    }
    const existing = payload.clientRequestId && store.orders.find((order) => order.clientRequestId === payload.clientRequestId);
    if (existing) {
      if (existing.channel !== payload.channel || existing.table !== payload.table || existing.total !== payload.total || JSON.stringify(existing.items) !== JSON.stringify(payload.items)) return json(response, 409, { error: 'Esta solicitud ya registró una orden diferente. Revisa la central antes de reenviarla.' });
      return json(response, 200, { order: { ...publicOrder(existing), trackingToken: existing.trackingToken } });
    }
    if (store.extras) {
      const unavailable = unavailableItems(payload.items, normalizeExtras(store.extras));
      if (unavailable.length) return json(response, 409, {
        error: `Revisa ${unavailable.map((item) => item.name).join(', ')}: ${unavailable[0].reason} Los demás productos siguen en tu pedido.`,
        unavailable
      });
    }
    if (payload.table) occupyTable(payload.table);
    store.counter += 1;
    const createdAt = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      code: `BOC-${String(store.counter).padStart(3, '0')}`,
      pickupCode: String(Math.floor(1000 + Math.random() * 9000)),
      trackingToken: crypto.randomUUID(),
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: null,
      paidAt: null,
      createdAt,
      updatedAt: createdAt,
      ...payload,
      accountId: payload.table ? store.tables[String(payload.table)]?.accountId || null : null,
      createdByUserId: staffSession?.userId || null,
      createdByName: staffSession?.name || (payload.channel === 'table' ? 'QR de mesa' : null)
    };
    store.orders.push(order);
    await persist();
    if (payload.channel === 'counter') await audit(await adminSession(request), 'order.create', `order:${order.id}`);
    return json(response, 201, { order: { ...publicOrder(order), trackingToken: order.trackingToken } });
  }

  const paymentMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)\/payment$/i);
  if (request.method === 'PATCH' && paymentMatch) {
    const session = await adminSession(request);
    const order = store.orders.find((item) => item.id === paymentMatch[1]);
    if (!order) return json(response, 404, { error: 'Pedido no encontrado.' });
    if (!orderInScope(session, order)) return json(response, 403, { error:'Pedido fuera de tu área de trabajo.' });
    const payload = await jsonBody(request);
    const paymentStatus = cleanText(payload.paymentStatus, 20);
    const paymentMethod = cleanText(payload.paymentMethod, 20);
    if (!paymentStatuses.includes(paymentStatus)) return json(response, 400, { error: 'Estado de pago invÃ¡lido.' });
    if (paymentStatus === 'paid' && !paymentMethods.includes(paymentMethod)) return json(response, 400, { error: 'Selecciona un mÃ©todo de pago vÃ¡lido.' });
    if (!allowed(session, paymentStatus === 'paid' ? 'payments.collect' : 'payments.refund')) return json(response, 403, { error:'No tienes autorización para esta operación de cobro.' });
    if (paymentStatus === 'unpaid' && !recentlyAuthenticated(session)) return json(response, 403, { error:'Vuelve a iniciar sesión para corregir un cobro.' });
    order.paymentStatus = paymentStatus;
    order.paymentMethod = paymentStatus === 'paid' ? paymentMethod : null;
    order.paidAt = paymentStatus === 'paid' ? new Date().toISOString() : null;
    order.updatedAt = new Date().toISOString();
    await persist(); await audit(session, paymentStatus === 'paid' ? 'payment.collect' : 'payment.correct', `order:${order.id}`);
    return json(response, 200, { order });
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)$/i);
  if (orderMatch) {
    const session = await adminSession(request);
    const order = store.orders.find((item) => item.id === orderMatch[1]);
    if (!order) return json(response, 404, { error: 'Pedido no encontrado.' });
    if (!orderInScope(session, order)) return json(response, 403, { error:'Pedido fuera de tu área de trabajo.' });
    if (request.method === 'GET') return json(response, 200, { order:orderForSession(session, order) });
    if (request.method === 'PATCH') {
      const payload = await jsonBody(request);
      const next = cleanText(payload.status, 20);
      if (!allowedStatuses.includes(next) || !transitions[order.status]?.includes(next)) return json(response, 409, { error: `No se puede cambiar de ${order.status} a ${next}.` });
      const permission = next === 'cancelled' ? 'orders.cancel' : ['preparing','ready'].includes(next) ? 'kitchen.update' : 'orders.edit';
      if (!allowed(session, permission)) return json(response, 403, { error:'No tienes autorización para este cambio de estado.' });
      order.status = next; order.updatedAt = new Date().toISOString(); await persist(); await audit(session, next === 'cancelled' ? 'order.cancel' : 'order.status', `order:${order.id}`);
      return json(response, 200, { order });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/service-requests') {
    const session = await adminSession(request);
    return json(response, 200, { requests:store.requests.filter(item => !waiterScope(session) || (item.table && store.assignments[String(item.table)] === session.waiterId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }
  if (request.method === 'POST' && url.pathname === '/api/service-requests') {
    const payload = await jsonBody(request); const table = Number(payload.table); const type = cleanText(payload.type, 20);
    if (['assignment-request','close-request'].includes(type)) {
      const session = await adminSession(request);
      if (!session || !validOrigin(request)) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      if (!allowed(session,'tables.view') || !session.roles?.includes('waiter')) return json(response, 403, { error:'Solo un mesero puede solicitar atención o cierre de mesa.' });
      if (type === 'close-request' && (!Number.isInteger(table) || store.assignments[String(table)] !== session.waiterId || tableSnapshot(table).status !== 'occupied')) return json(response, 403, { error:'Solo puedes solicitar el cierre de una mesa que atiendes.' });
      const existing = store.requests.find(item => item.type === type && item.status === 'pending' && item.createdByUserId === session.userId && (type !== 'close-request' || item.table === table));
      if (existing) return json(response, 200, { request:existing });
      const serviceRequest = { id:randomUUID(), type, table:type === 'close-request' ? table : null, waiterId:session.waiterId || null, waiterName:session.name, createdByUserId:session.userId, status:'pending', createdAt:new Date().toISOString() };
      store.requests.push(serviceRequest); await persist(); await audit(session, type === 'close-request' ? 'table.close.request' : 'table.assignment.request', type === 'close-request' ? `table:${table}` : `user:${session.userId}`);
      return json(response, 201, { request:serviceRequest });
    }
    if (['cancel-request','staff-help'].includes(type)) {
      const session = await adminSession(request);
      if (!session || !validOrigin(request)) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      if (!allowed(session,'orders.view') && !allowed(session,'orders.view_assigned')) return json(response, 403, { error:'Sin acceso a este pedido.' });
      const order = store.orders.find(item => item.id === cleanText(payload.orderId, 80));
      if (!order || !orderInScope(session, order)) return json(response, 403, { error:'Pedido fuera de tu área de trabajo.' });
      if (type === 'cancel-request' && !['pending','confirmed'].includes(order.status)) return json(response, 409, { error:'Este pedido ya no puede solicitarse para cancelación.' });
      const serviceRequest = { id:randomUUID(), table:order.table || null, orderId:order.id, orderCode:order.code, channel:order.channel, type, status:'pending', createdAt:new Date().toISOString() };
      store.requests.push(serviceRequest); await persist(); await audit(session, type === 'cancel-request' ? 'order.cancel.request' : 'order.help.request', `order:${order.id}`);
      return json(response, 201, { request:serviceRequest });
    }
    if (['remote-help', 'payment-review'].includes(type)) {
      const orderId = cleanText(payload.orderId, 80);
      const order = store.orders.find((item) => item.id === orderId);
      if (!order) return json(response, 400, { error: 'El pedido asociado a la ayuda no es vÃ¡lido.' });
      const serviceRequest = {
        id: crypto.randomUUID(), table: null, orderId: order.id, orderCode: order.code, channel: order.channel,
        type, message: cleanText(payload.message, 180), status: 'pending', createdAt: new Date().toISOString()
      };
      store.requests.push(serviceRequest); await persist(); return json(response, 201, { request: serviceRequest });
    }
    if (!Number.isInteger(table) || table < 1 || table > store.tableCount || !['waiter', 'help'].includes(type)) return json(response, 400, { error: 'Solicitud de mesa inválida.' });
    const serviceRequest = { id: crypto.randomUUID(), table, type, status: 'pending', createdAt: new Date().toISOString() };
    store.requests.push(serviceRequest); occupyTable(table); await persist(); return json(response, 201, { request: serviceRequest });
  }
  const requestMatch = url.pathname.match(/^\/api\/service-requests\/([0-9a-f-]+)$/i);
  if (request.method === 'PATCH' && requestMatch) {
    const serviceRequest = store.requests.find((item) => item.id === requestMatch[1]);
    if (!serviceRequest) return json(response, 404, { error: 'Solicitud no encontrada.' });
    const session = await adminSession(request);
    if (waiterScope(session) && serviceRequest.table && store.assignments[String(serviceRequest.table)] !== session.waiterId) return json(response, 403, { error:'Solicitud fuera de tu área de trabajo.' });
    serviceRequest.status = 'resolved'; serviceRequest.updatedAt = new Date().toISOString(); await persist(); return json(response, 200, { request: serviceRequest });
  }

  if (request.method === 'GET' && url.pathname === '/api/config/extras') return json(response, 200, store.extras || {});
  if (request.method === 'PUT' && url.pathname === '/api/config/extras') {
    const session = await adminSession(request);
    const payload = await jsonBody(request);
    if (!payload || typeof payload !== 'object' || !payload.products || typeof payload.products !== 'object') return json(response, 400, { error: 'Configuración de extras inválida.' });
    if (Array.isArray(payload.library) && payload.library.length > 300) return json(response, 400, { error: 'Demasiados extras en la biblioteca.' });
    if (Array.isArray(payload.customProducts) && payload.customProducts.length > 100) return json(response, 400, { error: 'Demasiados productos personalizados.' });
    // A legacy v1 client must not erase library, availability or new products.
    const incoming = payload.version === 1 && store.extras?.version === 2
      ? { ...store.extras, products: { ...store.extras.products, ...payload.products } }
      : payload;
    const next = normalizeExtras(incoming);
    const previous = store.extras ? normalizeExtras(store.extras) : normalizeExtras({ products:{} });
    const changed = key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]);
    const prices = config => JSON.stringify({
      library:(config.library || []).map(item => [item.id,item.price]).sort(([a],[b]) => a.localeCompare(b)),
      products:Object.entries(config.products || {}).map(([id,item]) => [id,(item.extras || []).map(extra => [extra.id,extra.price]).sort(([a],[b]) => a.localeCompare(b))]).sort(([a],[b]) => a.localeCompare(b)),
      custom:(config.customProducts || []).map(item => [item.id,item.price]).sort(([a],[b]) => a.localeCompare(b))
    });
    if (changed('availability') && !allowed(session,'availability.manage')) return json(response, 403, { error:'Sin permiso para cambiar disponibilidad.' });
    if (['products','library','customProducts'].some(changed) && !allowed(session,'extras.manage')) return json(response, 403, { error:'Sin permiso para modificar la carta o los extras.' });
    const priceChanged = prices(previous) !== prices(next);
    if (priceChanged && !allowed(session,'menu.price.edit')) return json(response, 403, { error:'Sin permiso para modificar precios.' });
    if (priceChanged && !recentlyAuthenticated(session)) return json(response, 403, { error:'Vuelve a iniciar sesión para cambiar precios.' });
    store.extras = next; await persist(); await audit(session, priceChanged ? 'menu.price.update' : changed('availability') ? 'availability.update' : 'extras.update', 'catalog:extras'); return json(response, 200, store.extras);
  }

  if (request.method === 'GET' && url.pathname === '/api/qr') {
    const value = url.searchParams.get('url');
    let target;
    try { target = new URL(value); } catch { return json(response, 400, { error: 'URL de QR inválida.' }); }
    if (!['http:', 'https:'].includes(target.protocol) || target.toString().length > 500) return json(response, 400, { error: 'URL de QR inválida.' });
    const svg = await QRCode.toString(target.toString(), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); response.end(svg); return;
  }

  return json(response, 404, { error: 'Ruta API no encontrada.' });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      if (!validOrigin(request)) return json(response, 403, { error:'Origen no permitido.' });
      return await adminLogin(request, response);
    }
    if (url.pathname === '/api/admin/session' && request.method === 'GET') {
      const session = await adminSession(request);
      return session ? json(response, 200, { authenticated:true, role:session.role, name:session.name, roles:session.roles, waiterId:session.waiterId || null, assignedTables:session.assignedTables || [], permissions:session.permissions, operations:session.operations }) : json(response, 401, { error:'Inicia sesión en Boccantina.' });
    }
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      if (!validOrigin(request)) return json(response, 403, { error:'Origen no permitido.' });
      const session = await adminSession(request);
      if (!session) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      adminSessions.delete(session.token);
      response.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'set-cookie':adminCookie(request, '', 0) });
      response.end(JSON.stringify({ ok:true })); return;
    }
    if (url.pathname === '/api/admin/users' || url.pathname.startsWith('/api/admin/users/') || url.pathname === '/api/admin/audit') return await manageStaff(request, response, url.pathname);
    if (url.pathname.startsWith('/api/') && protectedApi(request, url.pathname)) {
      const session = await adminSession(request);
      if (!session) return json(response, 401, { error:'Inicia sesión en Boccantina.' });
      if (!apiAccessAllowed(session, request, url.pathname)) { await audit(session, 'access.denied', url.pathname, 'denied'); return json(response, 403, { error:'Tu cuenta no tiene acceso a esta función.' }); }
      if (!['GET', 'HEAD'].includes(request.method) && !validOrigin(request)) return json(response, 403, { error:'Origen no permitido.' });
    }
    if (url.pathname.startsWith('/api/')) return await api(request, response, url);
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) return json(response, 405, { error: 'Método no permitido.' });
    if (pathname === '/admin/') {
      const session = await adminSession(request);
      response.writeHead(303, { location:session ? firstAllowedPath(session.permissions, session.roles) : '/admin/login/', 'cache-control':'no-store' }); response.end(); return;
    }
    if (['/admin/pedidos','/admin/cocina','/admin/reservaciones','/admin/personal'].includes(pathname)) {
      response.writeHead(308, { location:`${pathname}/${url.search}`, 'cache-control':'no-store' }); response.end(); return;
    }
    if (pathname === '/admin/login') {
      response.writeHead(308, { location:`/admin/login/${url.search}`, 'cache-control':'no-store' }); response.end(); return;
    }
    if (pathname === '/admin/extras') {
      response.writeHead(308, { location:`/admin/extras/${url.search}`, 'cache-control':'no-store' }); response.end(); return;
    }
    if (pathname === '/admin/disponibilidad') {
      response.writeHead(308, { location:`/admin/disponibilidad/${url.search}`, 'cache-control':'no-store' }); response.end(); return;
    }
    if (pathname === '/admin/login/' || pathname === '/admin/login/index.html' || pathname === '/admin/login/style.css' || pathname === '/admin/login/app.js') {
      const asset = pathname.endsWith('.css') ? 'style.css' : pathname.endsWith('.js') ? 'app.js' : 'index.html';
      const file = resolve(repoRoot, 'preview-src/admin-login', asset);
      response.writeHead(200, { 'content-type':mime[extname(file)], 'cache-control':'no-store', 'x-content-type-options':'nosniff', 'content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'" });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file)); return;
    }
    if (pathname === '/admin/personal' || pathname === '/admin/personal/' || pathname === '/admin/personal/index.html' || pathname === '/admin/personal/staff.css') {
      const session = await adminSession(request);
      if (!session) { response.writeHead(303, { location:'/admin/login/?next=%2Fadmin%2Fpersonal%2F', 'cache-control':'no-store' }); response.end(); return; }
      if (session.role !== 'owner') return restrictedPage(response, session.permissions);
      if (pathname === '/admin/personal') { response.writeHead(308, { location:'/admin/personal/' }); response.end(); return; }
      const file = resolve(repoRoot, pathname.endsWith('.css') ? 'preview-src/staff-admin.css' : 'preview-src/order-pages/admin-personal.html');
      response.writeHead(200, { 'content-type':mime[extname(file)], 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file)); return;
    }
    const internalPage = pathname.startsWith('/admin/') || pathname === '/qr-mesas' || pathname.startsWith('/qr-mesas/')
      || pathname === '/admin/disponibilidad/'
      || (pathname === '/' && url.searchParams.get('admin') === 'extras')
      || ((pathname === '/pedido' || pathname.startsWith('/pedido/')) && (url.searchParams.get('modo') === 'interno' || url.searchParams.get('tipo') === 'counter'));
    const session = internalPage ? await adminSession(request) : null;
    if (internalPage && !session) {
      const next = encodeURIComponent(pathname + url.search);
      response.writeHead(303, { location:`/admin/login/?next=${next}`, 'cache-control':'no-store' }); response.end(); return;
    }
    const needed = pagePermission(pathname, url);
    if (needed && session.role !== 'owner' && !session.permissions.includes(needed)) {
      restrictedPage(response, session.permissions); return;
    }
    const file = await fileFor(url.pathname);
    if (!file) { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('No encontrado en el preview local.'); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else response.end(body);
  } catch (error) {
    json(response, /inválid|tamaño|contiene|producto|mesa|reservación|teléfono|nombre/i.test(error.message) ? 400 : 500, { error: error.message || 'Error interno del preview.' });
  }
});

server.listen(previewPort, previewHost, () => {
  console.log(`${config.name}: http://localhost:${previewPort}/ · Admin: http://localhost:${previewPort}/admin/login/`);
  if (previewHost === '0.0.0.0') for (const address of localAddresses(previewPort)) console.log(`Red local: ${address}`);
});
