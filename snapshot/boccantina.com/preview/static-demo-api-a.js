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

  function businessDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }

  function activeReservationForTable(store, table) {
    return store.reservations
      .filter((reservation) => Number(reservation.table) === Number(table)
        && !['cancelled', 'completed'].includes(reservation.status)
        && reservation.date === businessDate())
      .sort((first, second) => String(first.time).localeCompare(String(second.time)))[0] || null;
  }

  function tableSnapshot(store, table) {
    const session = store.tables[String(table)];
    const orders = ordersForTable(store, table);
    const active = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
    const unpaid = orders.filter((order) => order.paymentStatus !== 'paid');
    const waiter = store.waiters.find((item) => item.id === store.assignments[String(table)]);
    const reservation = activeReservationForTable(store, table);
    const occupied = session?.status === 'occupied' || active.length > 0 || reservation?.status === 'seated';
    const reserved = !occupied && reservation && ['pending', 'confirmed'].includes(reservation.status);
    return {
      table,
      status: occupied ? 'occupied' : reserved ? 'reserved' : 'available',
      openedAt: session?.openedAt || null,
      updatedAt: session?.updatedAt || reservation?.updatedAt || null,
      activeOrders: active.length,
      unpaidOrders: unpaid.length,
      totalOrders: orders.length,
      canRelease: !reserved && active.length === 0 && unpaid.length === 0,
      waiterId: waiter?.id || null,
      waiterName: waiter?.name || null,
      reservationId: session?.reservationId || reservation?.id || null,
      reservation: reservation ? {
        id: reservation.id, code: reservation.code, date: reservation.date, time: reservation.time,
        status: reservation.status, guests: reservation.guests
      } : null
    };
  }

  function reservationStartMinutes(reservation) {
    const [hours, minutes] = String(reservation.time || '').split(':').map(Number);
    return (hours * 60) + minutes;
  }

  function reservationsOverlap(first, second) {
    if (first.date !== second.date) return false;
    const firstStart = reservationStartMinutes(first);
    const secondStart = reservationStartMinutes(second);
    return firstStart < secondStart + (Number(second.durationMinutes) || 120)
      && secondStart < firstStart + (Number(first.durationMinutes) || 120);
  }

  function conflictingReservation(store, candidate, ignoredId = '') {
    return store.reservations.find((reservation) => reservation.id !== ignoredId
      && !['cancelled', 'completed'].includes(reservation.status)
      && Number(reservation.table) === Number(candidate.table)
      && reservationsOverlap(reservation, candidate));
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
      if (method === 'PUT') { store.extras = window.BoccMenuExtrasConfig?.normalizeConfig(payload) || payload; save(store); return response(200, store.extras); }
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
        if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 60) return response(400, { error: 'El pedido no contiene productos válidos.' });
        if (payload.channel === 'takeaway' && (clean(payload.customerName, 100).length < 2 || clean(payload.phone, 40).replace(/\D/g, '').length < 8)) return response(400, { error: 'Para llevar requiere nombre y teléfono válidos.' });
        const channel = ['table', 'takeaway', 'counter'].includes(payload.channel) ? payload.channel : 'table';
        const hasTable = channel === 'table' || (channel === 'counter' && payload.table !== null && payload.table !== undefined && payload.table !== '');
        const table = hasTable ? Number(payload.table) : null;
        if (hasTable && (!Number.isInteger(table) || table < 1 || table > 100)) return response(400, { error: 'Número de mesa inválido.' });
        if (channel === 'counter' && table && tableSnapshot(store, table).status === 'reserved') return response(409, { error: 'La mesa tiene una reservación activa.' });
        const items = payload.items.map((item) => ({
          productId: clean(item.productId, 80), name: clean(item.name, 100), quantity: Number(item.quantity),
          unitPrice: Math.round(Number(item.unitPrice)), note: clean(item.note, 180),
          destination: item.destination == null ? (channel === 'takeaway' ? 'takeaway' : 'dine-in') : clean(item.destination, 20),
          extras: Array.isArray(item.extras) ? item.extras.slice(0, 20).map((extra) => ({ id: clean(extra.id, 80), name: clean(extra.name, 100), price: extra.price === null ? null : Math.max(0, Math.round(Number(extra.price) || 0)) })).filter((extra) => extra.name) : []
        }));
        if (items.some((item) => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 12 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return response(400, { error: 'Uno de los productos es inválido.' });
        if (items.some((item) => !['dine-in', 'takeaway'].includes(item.destination) || (channel === 'takeaway' && item.destination !== 'takeaway'))) return response(400, { error: 'El destino de uno de los productos es inválido.' });
        const total = items.reduce((sum, item) => sum + item.quantity * (item.unitPrice + item.extras.reduce((extraSum, extra) => extraSum + (Number(extra.price) || 0), 0)), 0);
        const clientRequestId = /^[0-9a-f-]{36}$/i.test(String(payload.clientRequestId || '')) ? String(payload.clientRequestId) : null;
        const existing = clientRequestId && store.orders.find((order) => order.clientRequestId === clientRequestId);
        if (existing) {
          if (existing.channel !== channel || existing.table !== table || existing.total !== total || JSON.stringify(existing.items) !== JSON.stringify(items)) return response(409, { error: 'Esta solicitud ya registró una orden diferente. Revisa la central antes de reenviarla.' });
          return response(200, { order: existing });
        }
        if (store.extras && window.BoccMenuExtrasConfig) {
          const api = window.BoccMenuExtrasConfig;
          const config = api.normalizeConfig(store.extras);
          const products = new Map(api.catalogProducts(config).map((product) => [product.id, product]));
          const blocked = items.find((item) => {
            const product = products.get(item.productId);
            return !product || product.visible === false || api.statusFor(config, product) !== 'available'
              || item.extras.some((extra) => !config.products[item.productId]?.enabled || !config.products[item.productId].extras.some((assigned) => assigned.id === extra.id) || config.library.find((entry) => entry.id === extra.id)?.active === false);
          });
          if (blocked) return response(409, { error: `Revisa ${blocked.name}: el producto o uno de sus extras ya no está disponible. Los demás siguen en tu pedido.` });
        }
        if (table) occupyTable(store, table);
        store.counter += 1;
        const createdAt = now();
        const order = {
          id: id(), code: `BOC-${String(store.counter).padStart(3, '0')}`,
          pickupCode: String(Math.floor(1000 + Math.random() * 9000)), trackingToken: id(),
          status: 'pending', paymentStatus: 'unpaid', paymentMethod: null, paidAt: null,
          createdAt, updatedAt: createdAt, channel, table,
          customerName: clean(payload.customerName, 100), phone: clean(payload.phone, 40), note: clean(payload.note, 240),
          items, total, clientRequestId
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
      if (method === 'POST' && tableMatch[2] === 'open') {
        const snapshot = tableSnapshot(store, table);
        if (snapshot.status === 'reserved') return response(409, { error: `La mesa ${table} está reservada para las ${snapshot.reservation.time}. Administración debe registrar la llegada antes de abrir el pedido.` });
        occupyTable(store, table); save(store); return response(200, { table: tableSnapshot(store, table) });
      }
      if (method === 'PUT' && tableMatch[2] === 'assignment') {
        if (payload.waiterId) store.assignments[String(table)] = clean(payload.waiterId, 80); else delete store.assignments[String(table)];
        save(store); return response(200, { table: tableSnapshot(store, table) });
      }
      if (method === 'PATCH' && !tableMatch[2]) {
        const snapshot = tableSnapshot(store, table);
        if (snapshot.status === 'reserved') return response(409, { error: 'Esta mesa tiene una reservación activa. Cancela o cambia la reservación desde la agenda.' });
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
      const candidate = { ...item };
      if (Object.prototype.hasOwnProperty.call(payload, 'table')) candidate.table = payload.table ? Number(payload.table) : null;
      for (const field of ['date', 'time', 'guests', 'name', 'phone', 'email', 'source', 'occasion', 'preferences']) if (Object.prototype.hasOwnProperty.call(payload, field)) candidate[field] = payload[field];
      if (!['cancelled', 'completed'].includes(payload.status || candidate.status) && candidate.table) {
        const conflict = conflictingReservation(store, candidate, item.id);
        if (conflict) return response(409, { error: `La mesa ${candidate.table} ya está asignada a ${conflict.code} a las ${conflict.time}.` });
      }
      Object.assign(item, candidate);
      if (payload.status === 'confirmed' && !item.table) return response(409, { error: 'Asigna una mesa antes de confirmar la reservación.' });
      if (payload.status === 'seated') { if (!item.table) return response(409, { error: 'Asigna una mesa antes de registrar la llegada.' }); occupyTable(store, item.table, item.id); }
      if (payload.status === 'completed' && item.table) store.tables[String(item.table)] = { status: 'available', openedAt: null, updatedAt: now(), reservationId: null };
      if (payload.status) item.status = payload.status;
      item.updatedAt = now(); save(store); return response(200, { reservation: item });
    }
    if (method === 'DELETE' && reservationMatch) {
      const index = store.reservations.findIndex((reservation) => reservation.id === reservationMatch[1]);
      if (index < 0) return response(404, { error: 'Reservación no encontrada.' });
      if (!['cancelled', 'completed'].includes(store.reservations[index].status)) return response(409, { error: 'Solo se pueden eliminar reservaciones canceladas o cumplidas.' });
      store.reservations.splice(index, 1); save(store); return response(200, { ok: true });
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
