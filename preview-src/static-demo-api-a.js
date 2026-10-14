(() => {
  const script = document.currentScript;
  const scriptUrl = new URL(script?.src || location.href, location.href);
  const basePath = scriptUrl.pathname.replace(/\/preview\/static-demo-api-a\.js$/, '').replace(/\/$/, '');
  const appUrl = (path = '/') => `${location.origin}${basePath}${path.startsWith('/') ? path : `/${path}`}`;
  const enabled = /(^|\.)github\.io$/i.test(location.hostname) || new URLSearchParams(location.search).get('static-demo') === '1';

  window.BoccStaticDemo = Object.freeze({ enabled, basePath, appUrl });
  if (!enabled) return;

  const storageKey = 'boccantina.github-pages.demo.v1';
  const now = () => new Date().toISOString();
  const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clean = (value, limit = 240) => String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit);
  const initialStore = () => ({ counter: 0, reservationCounter: 0, orders: [], requests: [], reservations: [], tables: {}, waiters: [], assignments: {}, extras: null });

  function load() {
    try { return { ...initialStore(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; }
    catch { return initialStore(); }
  }

  function save(store) {
    localStorage.setItem(storageKey, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('bocc:demo-update'));
  }

  const response = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

  function bodyOf(options) {
    try { return JSON.parse(options?.body || '{}'); }
    catch { return {}; }
  }

  function ordersForTable(store, table) {
    const openedAt = store.tables[String(table)]?.openedAt;
    return store.orders.filter((order) => Number(order.table) === Number(table) && (!openedAt || order.createdAt >= openedAt) && order.status !== 'cancelled');
  }

  function tableSnapshot(store, table) {
    const session = store.tables[String(table)];
    const orders = ordersForTable(store, table);
    const active = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
    const unpaid = orders.filter((order) => order.paymentStatus !== 'paid');
    const waiter = store.waiters.find((item) => item.id === store.assignments[String(table)]);
    return {
      table,
      status: session?.status === 'occupied' || active.length ? 'occupied' : 'available',
      openedAt: session?.openedAt || null,
      updatedAt: session?.updatedAt || null,
      activeOrders: active.length,
      unpaidOrders: unpaid.length,
      totalOrders: orders.length,
      canRelease: active.length === 0 && unpaid.length === 0,
      waiterId: waiter?.id || null,
      waiterName: waiter?.name || null,
      reservationId: session?.reservationId || null
    };
  }

  function occupyTable(store, table, reservationId = null) {
    const current = store.tables[String(table)];
    const timestamp = now();
    store.tables[String(table)] = {
      status: 'occupied',
      openedAt: current?.openedAt || timestamp,
      updatedAt: timestamp,
      reservationId: reservationId || current?.reservationId || null
    };
  }

  async function demoApi(url, options = {}) {
    const store = load();
    const method = String(options.method || 'GET').toUpperCase();
    const payload = bodyOf(options);
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) || '/' : url.pathname;

    if (method === 'GET' && path === '/api/health') return response(200, { ok: true, orders: store.orders.length, networkUrls: [appUrl('/')] });
    if (path === '/api/config/extras') {
      if (method === 'GET') return response(200, store.extras || {});
      if (method === 'PUT') { store.extras = payload; save(store); return response(200, store.extras); }
    }

    if (path === '/api/waiters') {
      if (method === 'GET') return response(200, { waiters: store.waiters });
      if (method === 'POST') {
        const name = clean(payload.name, 80);
        if (name.length < 2) return response(400, { error: 'Escribe el nombre del mesero.' });
        const waiter = { id: id(), name, active: true, createdAt: now() };
        store.waiters.push(waiter); save(store); return response(201, { waiter });
      }
    }
    const waiterMatch = path.match(/^\/api\/waiters\/([^/]+)$/);
    if (method === 'DELETE' && waiterMatch) {
      if (Object.values(store.assignments).includes(waiterMatch[1])) return response(409, { error: 'El mesero está asignado a una mesa activa.' });
      store.waiters = store.waiters.filter((item) => item.id !== waiterMatch[1]); save(store); return response(200, { ok: true });
    }

    if (path === '/api/orders/track' && method === 'GET') {
      const order = store.orders.find((item) => item.code === clean(url.searchParams.get('code'), 30).toUpperCase());
      const token = clean(url.searchParams.get('token'), 80);
      const pickupCode = clean(url.searchParams.get('pickupCode'), 10);
      if (!order || !((token && token === order.trackingToken) || (pickupCode && pickupCode === order.pickupCode))) return response(404, { error: 'No encontramos un pedido con esos datos.' });
      return response(200, { order });
    }
    if (path === '/api/orders') {
      if (method === 'GET') return response(200, { orders: [...store.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
      if (method === 'POST') {
        if (!Array.isArray(payload.items) || !payload.items.length) return response(400, { error: 'El pedido no contiene productos válidos.' });
        if (payload.channel === 'takeaway' && (clean(payload.customerName, 100).length < 2 || clean(payload.phone, 40).replace(/\D/g, '').length < 8)) return response(400, { error: 'Para llevar requiere nombre y teléfono válidos.' });
        if (payload.channel === 'table') occupyTable(store, Number(payload.table));
        store.counter += 1;
        const createdAt = now();
        const order = {
          id: id(), code: `BOC-${String(store.counter).padStart(3, '0')}`,
          pickupCode: String(Math.floor(1000 + Math.random() * 9000)), trackingToken: id(),
          status: 'pending', paymentStatus: 'unpaid', paymentMethod: null, paidAt: null,
          createdAt, updatedAt: createdAt, channel: payload.channel || 'table', table: payload.channel === 'table' ? Number(payload.table) : null,
          customerName: clean(payload.customerName, 100), phone: clean(payload.phone, 40), note: clean(payload.note, 240),
          items: payload.items, total: Number(payload.total) || 0
        };
        store.orders.push(order); save(store); return response(201, { order });
      }
    }
    const paymentMatch = path.match(/^\/api\/orders\/([^/]+)\/payment$/);
    if (method === 'PATCH' && paymentMatch) {
      const order = store.orders.find((item) => item.id === paymentMatch[1]);
      if (!order) return response(404, { error: 'Pedido no encontrado.' });
      order.paymentStatus = payload.paymentStatus === 'paid' ? 'paid' : 'unpaid';
      order.paymentMethod = order.paymentStatus === 'paid' ? clean(payload.paymentMethod, 20) : null;
      order.paidAt = order.paymentStatus === 'paid' ? now() : null; order.updatedAt = now(); save(store); return response(200, { order });
    }
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (method === 'PATCH' && orderMatch) {
      const order = store.orders.find((item) => item.id === orderMatch[1]);
      if (!order) return response(404, { error: 'Pedido no encontrado.' });
      const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['delivered'] };
      if (!transitions[order.status]?.includes(payload.status)) return response(409, { error: 'Ese cambio de estado ya no está disponible.' });
      order.status = payload.status; order.updatedAt = now(); save(store); return response(200, { order });
    }

    if (path === '/api/service-requests') {
      if (method === 'GET') return response(200, { requests: [...store.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
      if (method === 'POST') {
        const linkedOrder = store.orders.find((item) => item.id === payload.orderId);
        const serviceRequest = {
          id: id(), table: payload.table ? Number(payload.table) : null, orderId: linkedOrder?.id || null,
          orderCode: linkedOrder?.code || '', channel: linkedOrder?.channel || null,
          type: clean(payload.type, 30), message: clean(payload.message, 180), status: 'pending', createdAt: now()
        };
        if (serviceRequest.table) occupyTable(store, serviceRequest.table);
        store.requests.push(serviceRequest); save(store); return response(201, { request: serviceRequest });
      }
    }
    const serviceMatch = path.match(/^\/api\/service-requests\/([^/]+)$/);
    if (method === 'PATCH' && serviceMatch) {
      const item = store.requests.find((requestItem) => requestItem.id === serviceMatch[1]);
      if (!item) return response(404, { error: 'Solicitud no encontrada.' });
      item.status = 'resolved'; item.updatedAt = now(); save(store); return response(200, { request: item });
    }

    if (path === '/api/tables' && method === 'GET') {
      const count = Math.max(1, Math.min(100, Number(url.searchParams.get('count')) || 12));
      return response(200, { tables: Array.from({ length: count }, (_, index) => tableSnapshot(store, index + 1)) });
    }
    const tableMatch = path.match(/^\/api\/tables\/(\d+)(?:\/(open|assignment))?$/);
    if (tableMatch) {
      const table = Number(tableMatch[1]);
      if (method === 'POST' && tableMatch[2] === 'open') { occupyTable(store, table); save(store); return response(200, { table: tableSnapshot(store, table) }); }
      if (method === 'PUT' && tableMatch[2] === 'assignment') {
        if (payload.waiterId) store.assignments[String(table)] = clean(payload.waiterId, 80); else delete store.assignments[String(table)];
        save(store); return response(200, { table: tableSnapshot(store, table) });
      }
      if (method === 'PATCH' && !tableMatch[2]) {
        const snapshot = tableSnapshot(store, table);
        if (!snapshot.canRelease) return response(409, { error: snapshot.unpaidOrders ? 'La mesa tiene consumos pendientes de pago.' : 'La mesa tiene pedidos activos.' });
        store.tables[String(table)] = { status: 'available', openedAt: null, updatedAt: now(), reservationId: null };
        delete store.assignments[String(table)]; save(store); return response(200, { table: tableSnapshot(store, table) });
      }
    }

    if (path === '/api/reservations') {
      if (method === 'GET') return response(200, { reservations: [...store.reservations].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)) });
      if (method === 'POST') {
        if (!payload.date || !payload.time || !payload.guests || clean(payload.name, 100).length < 2 || clean(payload.phone, 40).replace(/\D/g, '').length < 8) return response(400, { error: 'La reservación requiere fecha, hora, personas, nombre y teléfono válidos.' });
        store.reservationCounter += 1;
        const createdAt = now();
        const reservation = { ...payload, id: id(), code: `RES-${String(store.reservationCounter).padStart(3, '0')}`, status: 'pending', table: null, durationMinutes: 120, createdAt, updatedAt: createdAt };
        store.reservations.push(reservation); save(store); return response(201, { reservation });
      }
    }
    const reservationMatch = path.match(/^\/api\/reservations\/([^/]+)$/);
    if (method === 'PATCH' && reservationMatch) {
      const item = store.reservations.find((reservation) => reservation.id === reservationMatch[1]);
      if (!item) return response(404, { error: 'Reservación no encontrada.' });
      if (Object.prototype.hasOwnProperty.call(payload, 'table')) item.table = payload.table ? Number(payload.table) : null;
      for (const field of ['date', 'time', 'guests', 'name', 'phone', 'email', 'source', 'occasion', 'preferences']) if (Object.prototype.hasOwnProperty.call(payload, field)) item[field] = payload[field];
      if (payload.status === 'confirmed' && !item.table) return response(409, { error: 'Asigna una mesa antes de confirmar la reservación.' });
      if (payload.status === 'seated') { if (!item.table) return response(409, { error: 'Asigna una mesa antes de registrar la llegada.' }); occupyTable(store, item.table, item.id); }
      if (payload.status === 'completed' && item.table) store.tables[String(item.table)] = { status: 'available', openedAt: null, updatedAt: now(), reservationId: null };
      if (payload.status) item.status = payload.status;
      item.updatedAt = now(); save(store); return response(200, { reservation: item });
    }

    return response(404, { error: 'Ruta de demostración no disponible.' });
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) || '/' : url.pathname;
    return path.startsWith('/api/') ? demoApi(url, options) : nativeFetch(input, options);
  };
})();
