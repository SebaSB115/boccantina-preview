import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const publicRoot = resolve(repoRoot, 'snapshot', new URL(config.origin).hostname);
const dataRoot = join(repoRoot, '.preview-data');
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
let store = { counter: 0, reservationCounter: 0, orders: [], requests: [], reservations: [], extras: null, tables: {}, waiters: [], assignments: {} };
try {
  const saved = JSON.parse(await readFile(dataFile, 'utf8'));
  store = {
    counter: Number.isInteger(saved.counter) ? saved.counter : 0,
    reservationCounter: Number.isInteger(saved.reservationCounter) ? saved.reservationCounter : 0,
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
  const table = channel === 'table' ? Number(payload.table) : null;
  if (channel === 'table' && (!Number.isInteger(table) || table < 1 || table > 100)) throw new Error('Número de mesa inválido.');
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
    return {
      productId: cleanText(item.productId, 80), name, quantity, unitPrice: Math.round(unitPrice), note: cleanText(item.note, 180),
      extras: Array.isArray(item.extras) ? item.extras.slice(0, 20).map((extra) => ({ id: cleanText(extra.id, 80), name: cleanText(extra.name, 100), price: extra.price === null ? null : Math.max(0, Math.round(Number(extra.price) || 0)) })).filter((extra) => extra.name) : []
    };
  });
  const calculatedTotal = items.reduce((sum, item) => sum + item.quantity * (item.unitPrice + item.extras.reduce((extraSum, extra) => extraSum + (Number(extra.price) || 0), 0)), 0);
  return { channel, table, customerName, phone, items, note: cleanText(payload.note, 240), total: calculatedTotal };
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
  const openedAt = store.tables[String(table)]?.openedAt;
  return store.orders.filter((order) => order.table === table && (!openedAt || order.createdAt >= openedAt));
}

function activeOrdersForTable(table) {
  return ordersForCurrentSession(table).filter((order) => !['delivered', 'cancelled'].includes(order.status));
}

function unpaidOrdersForTable(table) {
  return ordersForCurrentSession(table).filter((order) => order.status !== 'cancelled' && order.paymentStatus !== 'paid');
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
  const occupied = session?.status === 'occupied' || activeOrders.length > 0;
  const waiterId = cleanText(store.assignments[String(table)], 80);
  const waiter = store.waiters.find((item) => item.id === waiterId);
  return {
    table,
    status: occupied ? 'occupied' : 'available',
    openedAt: session?.openedAt || null,
    updatedAt: session?.updatedAt || null,
    activeOrders: activeOrders.length,
    unpaidOrders: unpaidOrders.length,
    totalOrders: sessionOrders.length,
    canRelease: activeOrders.length === 0 && unpaidOrders.length === 0,
    waiterId: waiter?.id || null,
    waiterName: waiter?.name || null,
    reservationId: cleanText(session?.reservationId, 80) || null
  };
}

function occupyTable(table, reservationId = null) {
  const current = store.tables[String(table)];
  const timestamp = new Date().toISOString();
  store.tables[String(table)] = {
    status: 'occupied',
    openedAt: current?.status === 'occupied' && current.openedAt ? current.openedAt : timestamp,
    updatedAt: timestamp,
    reservationId: reservationId || current?.reservationId || null
  };
}

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, orders: store.orders.length, networkUrls: localAddresses(config.localPort) });

  if (request.method === 'GET' && url.pathname === '/api/waiters') return json(response, 200, { waiters: store.waiters });
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
    const payload = normalizeReservation(await jsonBody(request));
    store.reservationCounter += 1;
    const createdAt = new Date().toISOString();
    const reservation = { id: crypto.randomUUID(), code: `RES-${String(store.reservationCounter).padStart(3, '0')}`, status: 'pending', createdAt, updatedAt: createdAt, ...payload };
    store.reservations.push(reservation); await persist(); return json(response, 201, { reservation });
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
      store.tables[String(nextTable)] = { status: 'available', openedAt: null, updatedAt: timestamp, reservationId: null };
      delete store.assignments[String(nextTable)];
      reservation.completedAt = timestamp;
    }
    if (nextDetails) Object.assign(reservation, nextDetails);
    reservation.status = nextStatus;
    reservation.table = nextTable;
    reservation.updatedAt = new Date().toISOString();
    await persist();
    return json(response, 200, { reservation });
  }
  if (request.method === 'DELETE' && reservationMatch) {
    const index = store.reservations.findIndex((item) => item.id === reservationMatch[1]);
    if (index < 0) return json(response, 404, { error: 'Reservación no encontrada.' });
    store.reservations.splice(index, 1); await persist(); return json(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/tables') {
    const count = Math.max(1, Math.min(100, Number(url.searchParams.get('count')) || 12));
    return json(response, 200, { tables: Array.from({ length: count }, (_, index) => tableSnapshot(index + 1)) });
  }
  const tableMatch = url.pathname.match(/^\/api\/tables\/(\d+)(?:\/(open))?$/);
  if (tableMatch) {
    const table = validTable(tableMatch[1]);
    if (request.method === 'POST' && tableMatch[2] === 'open') {
      occupyTable(table);
      await persist();
      return json(response, 200, { table: tableSnapshot(table) });
    }
    if (request.method === 'PATCH' && !tableMatch[2]) {
      const payload = await jsonBody(request);
      if (payload.status !== 'available') return json(response, 400, { error: 'Estado de mesa inválido.' });
      if (activeOrdersForTable(table).length) return json(response, 409, { error: 'La mesa tiene pedidos activos. Finalízalos antes de liberarla.' });
      if (unpaidOrdersForTable(table).length) return json(response, 409, { error: 'La mesa tiene consumos pendientes de pago. Registra el cobro antes de liberarla.' });
      const timestamp = new Date().toISOString();
      const linkedReservation = store.reservations.find((item) => item.id === store.tables[String(table)]?.reservationId && item.status === 'seated');
      if (linkedReservation) { linkedReservation.status = 'completed'; linkedReservation.completedAt = timestamp; linkedReservation.updatedAt = timestamp; }
      store.tables[String(table)] = { status: 'available', openedAt: null, updatedAt: timestamp, reservationId: null };
      delete store.assignments[String(table)];
      await persist();
      return json(response, 200, { table: tableSnapshot(table) });
    }
  }
  const assignmentMatch = url.pathname.match(/^\/api\/tables\/(\d+)\/assignment$/);
  if (request.method === 'PUT' && assignmentMatch) {
    const table = validTable(assignmentMatch[1]);
    const payload = await jsonBody(request); const waiterId = cleanText(payload.waiterId, 80);
    if (waiterId && !store.waiters.some((item) => item.id === waiterId && item.active)) return json(response, 400, { error: 'Mesero no disponible.' });
    if (waiterId) store.assignments[String(table)] = waiterId; else delete store.assignments[String(table)];
    await persist(); return json(response, 200, { table: tableSnapshot(table) });
  }

  if (request.method === 'GET' && url.pathname === '/api/orders/track') {
    const code = cleanText(url.searchParams.get('code'), 30).toUpperCase();
    const token = cleanText(url.searchParams.get('token'), 80);
    const pickupCode = cleanText(url.searchParams.get('pickupCode'), 10);
    const order = store.orders.find((item) => item.code === code);
    if (!order || !((token && token === order.trackingToken) || (pickupCode && pickupCode === order.pickupCode))) return json(response, 404, { error: 'No encontramos un pedido con esos datos.' });
    return json(response, 200, { order: publicOrder(order) });
  }

  if (request.method === 'GET' && url.pathname === '/api/orders') return json(response, 200, { orders: [...store.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const payload = normalizeOrder(await jsonBody(request));
    if (payload.channel === 'table') occupyTable(payload.table);
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
      ...payload
    };
    store.orders.push(order);
    await persist();
    return json(response, 201, { order: { ...publicOrder(order), trackingToken: order.trackingToken } });
  }

  const paymentMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)\/payment$/i);
  if (request.method === 'PATCH' && paymentMatch) {
    const order = store.orders.find((item) => item.id === paymentMatch[1]);
    if (!order) return json(response, 404, { error: 'Pedido no encontrado.' });
    const payload = await jsonBody(request);
    const paymentStatus = cleanText(payload.paymentStatus, 20);
    const paymentMethod = cleanText(payload.paymentMethod, 20);
    if (!paymentStatuses.includes(paymentStatus)) return json(response, 400, { error: 'Estado de pago invÃ¡lido.' });
    if (paymentStatus === 'paid' && !paymentMethods.includes(paymentMethod)) return json(response, 400, { error: 'Selecciona un mÃ©todo de pago vÃ¡lido.' });
    order.paymentStatus = paymentStatus;
    order.paymentMethod = paymentStatus === 'paid' ? paymentMethod : null;
    order.paidAt = paymentStatus === 'paid' ? new Date().toISOString() : null;
    order.updatedAt = new Date().toISOString();
    await persist();
    return json(response, 200, { order });
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)$/i);
  if (orderMatch) {
    const order = store.orders.find((item) => item.id === orderMatch[1]);
    if (!order) return json(response, 404, { error: 'Pedido no encontrado.' });
    if (request.method === 'GET') return json(response, 200, { order });
    if (request.method === 'PATCH') {
      const payload = await jsonBody(request);
      const next = cleanText(payload.status, 20);
      if (!allowedStatuses.includes(next) || !transitions[order.status]?.includes(next)) return json(response, 409, { error: `No se puede cambiar de ${order.status} a ${next}.` });
      order.status = next; order.updatedAt = new Date().toISOString(); await persist();
      return json(response, 200, { order });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/service-requests') return json(response, 200, { requests: [...store.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  if (request.method === 'POST' && url.pathname === '/api/service-requests') {
    const payload = await jsonBody(request); const table = Number(payload.table); const type = cleanText(payload.type, 20);
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
    if (!Number.isInteger(table) || table < 1 || table > 100 || !['waiter', 'help'].includes(type)) return json(response, 400, { error: 'Solicitud de mesa inválida.' });
    const serviceRequest = { id: crypto.randomUUID(), table, type, status: 'pending', createdAt: new Date().toISOString() };
    store.requests.push(serviceRequest); occupyTable(table); await persist(); return json(response, 201, { request: serviceRequest });
  }
  const requestMatch = url.pathname.match(/^\/api\/service-requests\/([0-9a-f-]+)$/i);
  if (request.method === 'PATCH' && requestMatch) {
    const serviceRequest = store.requests.find((item) => item.id === requestMatch[1]);
    if (!serviceRequest) return json(response, 404, { error: 'Solicitud no encontrada.' });
    serviceRequest.status = 'resolved'; serviceRequest.updatedAt = new Date().toISOString(); await persist(); return json(response, 200, { request: serviceRequest });
  }

  if (request.method === 'GET' && url.pathname === '/api/config/extras') return json(response, 200, store.extras || {});
  if (request.method === 'PUT' && url.pathname === '/api/config/extras') {
    const payload = await jsonBody(request);
    if (!payload || typeof payload !== 'object' || !payload.products || typeof payload.products !== 'object') return json(response, 400, { error: 'Configuración de extras inválida.' });
    store.extras = payload; await persist(); return json(response, 200, store.extras);
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
    if (url.pathname.startsWith('/api/')) return await api(request, response, url);
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) return json(response, 405, { error: 'Método no permitido.' });
    const file = await fileFor(url.pathname);
    if (!file) { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('No encontrado en el preview local.'); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else response.end(body);
  } catch (error) {
    json(response, /inválid|tamaño|contiene|producto|mesa|reservación|teléfono|nombre/i.test(error.message) ? 400 : 500, { error: error.message || 'Error interno del preview.' });
  }
});

server.listen(config.localPort, '0.0.0.0', () => {
  console.log(`${config.name}: http://localhost:${config.localPort}/`);
  for (const address of localAddresses(config.localPort)) console.log(`Red local: ${address}`);
});
