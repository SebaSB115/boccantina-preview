(async () => {
  const page = document.body.dataset.orderPage;
  const root = document.getElementById('bocc-order-root');
  if (!page || !root) return;
  const appUrl = window.BoccStaticDemo?.appUrl || ((path = '/') => path);
  const isStaticDemo = Boolean(window.BoccStaticDemo?.enabled);
  const brandLogoUrl = appUrl('/wp-content/uploads/2026/05/cropped-LOGO-NEW-300x72.jpg');
  const adminThemeKey = 'boccantina-admin-theme';
  const currentAdminTheme = () => { try { return localStorage.getItem(adminThemeKey) === 'gold' ? 'gold' : 'blue'; } catch { return 'blue'; } };
  const setAdminTheme = (theme) => {
    document.body.dataset.adminTheme = theme;
    document.querySelectorAll('[data-admin-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', `Cambiar a estilo ${theme === 'blue' ? 'dorado' : 'azul'}`);
      button.textContent = theme === 'blue' ? 'Estilo dorado' : 'Estilo azul';
    });
  };
  setAdminTheme(currentAdminTheme());
  let adminPermissions = new Set(['boccantina.orders','boccantina.kitchen','boccantina.reservations','boccantina.tables','boccantina.new-order','boccantina.extras']);
  let adminOperations = new Set();
  let adminRoles = [];
  let adminAssignedTables = [];
  let adminWaiterId = null;
  let adminRole = 'staff';
  const can = permission => adminPermissions.has(`boccantina.${permission}`);
  const canOperate = permission => adminRole === 'owner' || (permission !== 'tables.assign' || adminRoles.includes('reception')) && adminOperations.has(permission);
  const adminHome = () => adminRoles.includes('waiter') && !adminRoles.some(role => ['cashier','reception'].includes(role)) && can('tables') ? '/qr-mesas/' : [
    ['orders','/admin/pedidos/'], ['kitchen','/admin/cocina/'], ['reservations','/admin/reservaciones/'],
    ['tables','/qr-mesas/'], ['new-order','/pedido/?modo=interno'], ['extras','/admin/extras/'], ['availability','/admin/disponibilidad/']
  ].find(([permission]) => can(permission))?.[1] || '/admin/login/';

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const money = (value) => Number.isFinite(Number(value)) ? `₡${Number(value).toLocaleString('en-US')}` : 'Consultar';
  const time = (value) => new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const iconSearch = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg>';
  const iconTable = '<svg class="table-option__icon" aria-hidden="true" viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 29h48l-5 23H29l-5-23Z" fill="currentColor" fill-opacity=".1"></path><path d="M32 52l-4 13m36-13 4 13"></path><path d="M11 31h10v20H11V31Zm64 0h10v20H75V31Z"></path><path d="M13 26h6m58 0h6M38 18h20"></path><path d="M42 18v11m12-11v11"></path><path d="M45 11h6l-1 7h-4l-1-7Z"></path></svg>';
  const iconOccupiedTable = '<svg class="table-option__icon" aria-hidden="true" viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="17" r="6"></circle><circle cx="80" cy="17" r="6"></circle><path d="M5 43v-8a11 11 0 0 1 22 0v8m42 0v-8a11 11 0 0 1 22 0v8"></path><path d="M29 31h38l-4 24H33l-4-24Z" fill="currentColor" fill-opacity=".12"></path><path d="M36 55l-3 11m30-11 3 11M39 36h18"></path></svg>';
  const iconLock = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>';
  const iconBag = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 13H6L5 8Z"></path><path d="M9 9V6a3 3 0 0 1 6 0v3"></path></svg>';
  const iconCounter = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16v10H4zM7 10V5h10v5"></path><path d="M8 14h3m5 0h1m-9 3h9"></path></svg>';
  const iconCalendar = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4m8-4v4M3 10h18"></path><path d="M8 14h3m2 0h3m-8 3h3"></path></svg>';
  const iconChevron = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>';

  function adminNavigation() {
    const link = (path, label, current, extra = '') => `<a href="${appUrl(path)}" ${current ? 'aria-current="page"' : ''}>${label}${extra}</a>`;
    return `<button class="admin-nav-backdrop" type="button" data-admin-nav-close aria-label="Cerrar menú de administración" tabindex="-1"></button>
      <aside class="admin-drawer" id="admin-navigation" role="dialog" aria-modal="true" aria-label="Menú de administración" aria-hidden="true" inert>
        <div class="admin-drawer__head"><img class="admin-drawer__logo" src="${brandLogoUrl}" alt="Boccantina Cantina de Vinos" width="300" height="72"><button type="button" data-admin-nav-close aria-label="Cerrar menú">×</button></div>
        <nav aria-label="Secciones de Boccantina">
          ${['orders','kitchen','reservations','tables','new-order'].some(can) ? '<p>Operación</p>' : ''}
          ${can('orders') ? link('/admin/pedidos/', 'Pedidos', page === 'admin') : ''}
          ${can('kitchen') ? link('/admin/cocina/', 'Vista cocina', page === 'kitchen') : ''}
          ${can('reservations') ? link('/admin/reservaciones/', 'Reservaciones', page === 'reservations', page === 'admin' ? '<b data-reservation-nav-count aria-label="0 reservaciones activas">0</b>' : '') : ''}
          ${can('tables') ? link('/qr-mesas/', adminRole === 'owner' ? 'Mesas y QR' : adminRoles.includes('waiter') && !canOperate('tables.assign') ? 'Mis mesas' : 'Salón y mesas', page === 'qr') : ''}
          ${can('new-order') ? link('/pedido/?modo=interno', 'Nuevo pedido', false) : ''}
          ${can('extras') || can('availability') ? '<p>Carta</p>' + (can('extras') ? link('/admin/extras/', 'Extras de la carta', page === 'extras') : '') + (can('availability') ? link('/admin/disponibilidad/', 'Disponibilidad', page === 'availability') : '') : ''}
          ${adminRole === 'owner' && !isStaticDemo ? '<p>Dirección</p>' + link('/admin/personal/', 'Administración', page === 'staff') : ''}
        </nav>
        <div class="admin-drawer__foot">${isStaticDemo ? 'DEMO GITHUB · NO PRODUCCIÓN' : 'PRUEBA LOCAL · NO PRODUCCIÓN'}</div>
      </aside>`;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'No se pudo completar la solicitud.');
    return body;
  }

  function header({ table = null, internal = false, context = null, centralLink = page === 'qr' } = {}) {
    const logout = internal || ['admin', 'reservations', 'kitchen', 'qr', 'staff', 'availability'].includes(page);
    const adminPage = ['admin', 'reservations', 'kitchen', 'qr', 'staff', 'availability'].includes(page);
    const showBackLink = centralLink && !adminPage;
    return `<header class="order-header${showBackLink ? ' order-header--with-back' : ''}">
      <svg class="order-logo-filter" aria-hidden="true" width="0" height="0" focusable="false"><filter id="admin-logo-knockout" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  2.5 2.5 2.5 0 -0.8"></feColorMatrix></filter></svg>
      ${adminPage ? '<button class="admin-nav-toggle" type="button" data-admin-nav-toggle aria-label="Abrir menú de administración" aria-controls="admin-navigation" aria-expanded="false"><span class="admin-nav-toggle__icon" aria-hidden="true"><i></i><i></i><i></i></span></button>' : ''}
      <a class="order-brand" href="${appUrl(internal || adminPage ? adminHome() : '/?hero=a')}">
        <img class="order-brand__logo" src="${brandLogoUrl}" alt="Boccantina Cantina de Vinos" width="300" height="72" fetchpriority="high" decoding="async">
      </a>
      <div class="order-header__meta">
        ${adminPage ? `<button class="admin-theme-toggle" type="button" data-admin-theme-toggle aria-label="Cambiar a estilo ${currentAdminTheme() === 'blue' ? 'dorado' : 'azul'}">${currentAdminTheme() === 'blue' ? 'Estilo dorado' : 'Estilo azul'}</button>` : ''}
        ${showBackLink ? `<a class="header-back-link" href="${appUrl('/admin/pedidos/')}" aria-label="Volver a la central del restaurante"><span aria-hidden="true">←</span><span class="header-back-link__long">Volver a la central</span><span class="header-back-link__short">Central</span></a>` : ''}
        <span class="environment-badge">${isStaticDemo ? 'DEMO GITHUB · NO PRODUCCIÓN' : 'PRUEBA LOCAL · NO PRODUCCIÓN'}</span>
        ${logout ? '<button class="admin-logout" type="button" data-admin-logout>Salir</button>' : ''}
        ${table ? `<span class="table-badge">Mesa ${escapeHtml(table)}</span>` : context ? `<span class="table-badge">${escapeHtml(context)}</span>` : ''}
      </div>
    </header>${adminPage ? adminNavigation() : ''}`;
  }

  function catalogData() {
    const catalog = window.BoccMenuCatalog;
    if (!catalog?.products?.length) throw new Error('No se pudo cargar el catálogo.');
    return catalog;
  }

  async function initAvailability() {
    const api = window.BoccMenuExtrasConfig;
    if (!api) throw new Error('No se pudo cargar la disponibilidad.');
    let config = await api.hydrate();
    let query = '', category = '', filter = '';
    const labels = { available: 'Disponible', 'sold-out-today': 'Agotado hoy', unavailable: 'No disponible' };
    const categories = window.BoccMenuCatalog.categories;
    root.innerHTML = `${header()}<main class="availability-page"><div class="availability-intro"><p class="order-eyebrow">Operación diaria</p><h1>Disponibilidad</h1><p>Cambia el estado de los productos sin editar la carta. “Agotado hoy” se reactiva manualmente: todavía no hay un horario operativo configurado.</p></div><div class="availability-filters"><label>Buscar producto<input type="search" data-availability-search placeholder="Nombre del producto"></label><label>Categoría<select data-availability-category><option value="">Todas</option>${categories.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.es)}</option>`).join('')}</select></label><label>Estado<select data-availability-filter><option value="">Todos</option>${Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><p class="availability-feedback" role="status" aria-live="polite" data-availability-feedback></p><div class="availability-list" data-availability-list></div></main>`;
    const list = root.querySelector('[data-availability-list]');
    const feedback = root.querySelector('[data-availability-feedback]');
    const render = () => {
      const products = api.catalogProducts(config).filter((product) => (!category || product.category === category) && (!filter || api.statusFor(config, product) === filter) && normalize(`${product.nameEs} ${product.nameEn}`).includes(normalize(query)));
      list.innerHTML = products.length ? products.map((product) => {
        const status = api.statusFor(config, product);
        return `<div class="availability-row"><div><strong>${escapeHtml(product.nameEs)}</strong><small>${escapeHtml(categories.find((item) => item.id === product.category)?.es || product.category)} · ${escapeHtml(money(product.price))}${product.visible === false ? ' · Oculto en la carta' : ''}</small></div><label>Disponibilidad<select data-availability-product="${escapeHtml(product.id)}" aria-label="Disponibilidad de ${escapeHtml(product.nameEs)}">${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>`;
      }).join('') : '<p class="availability-empty">No hay productos con esos filtros.</p>';
    };
    root.querySelector('[data-availability-search]').addEventListener('input', (event) => { query = event.target.value; render(); });
    root.querySelector('[data-availability-category]').addEventListener('change', (event) => { category = event.target.value; render(); });
    root.querySelector('[data-availability-filter]').addEventListener('change', (event) => { filter = event.target.value; render(); });
    list.addEventListener('change', async (event) => {
      const control = event.target.closest('[data-availability-product]');
      if (!control) return;
      const id = control.dataset.availabilityProduct;
      const previous = config.availability[id];
      list.querySelectorAll('select').forEach((item) => { item.disabled = true; });
      feedback.textContent = 'Guardando disponibilidad…';
      config.availability[id] = { status: control.value, updatedAt: new Date().toISOString() };
      const result = await api.save(config);
      if (result.ok) { config = result.config; feedback.textContent = `${api.catalogProducts(config).find((item) => item.id === id)?.nameEs}: ${labels[control.value]}. Cambio guardado.`; }
      else { if (previous) config.availability[id] = previous; else delete config.availability[id]; feedback.textContent = `No se guardó el cambio: ${result.error}`; }
      render();
      (list.querySelector(`[data-availability-product="${CSS.escape(id)}"]`) || root.querySelector('[data-availability-filter]')).focus({ preventScroll: true });
    });
    render();
  }

  function productImage(product) {
    return appUrl(product.image.startsWith('/') ? product.image : `/${product.image}`);
  }

  function tagLabel(tag) {
    return ({ recommended: 'Recomendado', share: 'Para compartir', vegetarian: 'Vegetariano', spicy: 'Picante' })[tag] || tag;
  }

  const channelLabel = (channel) => ({ table: 'Mesa', takeaway: 'Para llevar', counter: 'Caja' })[channel || 'table'] || 'Pedido';
  const sourceLabel = (source) => ({ web: 'Web', phone: 'Teléfono', whatsapp: 'WhatsApp', 'walk-in': 'Presencial', manual: 'Manual' })[source] || 'Manual';
  const orderContext = (order) => order.table ? `Mesa ${order.table}${order.channel === 'counter' ? ' · Caja' : ''}` : channelLabel(order.channel);
  const itemDestination = (item, order) => ['dine-in', 'takeaway'].includes(item.destination) ? item.destination : order.channel === 'takeaway' ? 'takeaway' : 'dine-in';
  const destinationLabel = (destination) => destination === 'takeaway' ? 'Empacar para llevar' : 'Servir en mesa';
  const orderItemDetails = (item, order) => `<li data-destination="${itemDestination(item, order)}"><strong>${item.quantity} × ${escapeHtml(item.name)}</strong><span class="order-item-destination">${destinationLabel(itemDestination(item, order))}</span>${item.extras?.map((extra) => `<small>+ ${escapeHtml(extra.name)}</small>`).join('') || ''}${item.note ? `<small>Nota: ${escapeHtml(item.note)}</small>` : ''}</li>`;
  const paymentLabel = (order) => order.paymentStatus === 'paid' ? `Pagado${order.paymentMethod ? ` - ${{ cash: 'Efectivo', card: 'Tarjeta', sinpe: 'SINPE', other: 'Otro' }[order.paymentMethod] || 'Registrado'}` : ''}` : 'Pendiente de pago';
  const orderStatusLabel = (status) => ({ pending: 'Recibido', confirmed: 'Confirmado', preparing: 'En cocina', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' })[status] || 'Actualizado';
  const reservationTableCount = 12;

  function reservationStartMinutes(item) {
    const [hours, minutes] = String(item.time || '').split(':').map(Number);
    return (hours * 60) + minutes;
  }

  function reservationsOverlap(first, second) {
    if (first.date !== second.date) return false;
    const firstStart = reservationStartMinutes(first);
    const secondStart = reservationStartMinutes(second);
    return firstStart < secondStart + (Number(second.durationMinutes) || 120)
      && secondStart < firstStart + (Number(first.durationMinutes) || 120);
  }

  function tableHasReservationConflict(table, item, reservations) {
    return reservations.some((other) => other.id !== item.id
      && !['cancelled', 'completed'].includes(other.status)
      && Number(other.table) === table
      && reservationsOverlap(item, other));
  }

  function reservationCard(item, reservations) {
    const canEdit = ['pending', 'confirmed'].includes(item.status);
    const canDelete = ['cancelled', 'completed'].includes(item.status);
    const tableOptions = Array.from({ length: reservationTableCount }, (_, index) => index + 1).map((table) => {
      const unavailable = tableHasReservationConflict(table, item, reservations);
      return `<option value="${table}" ${Number(item.table) === table ? 'selected' : ''} ${unavailable ? 'disabled' : ''}>Mesa ${table}${unavailable ? ' — no disponible' : ''}</option>`;
    }).join('');
    const assignment = canEdit ? `<section class="reservation-assignment" aria-label="Asignación de mesa para ${escapeHtml(item.code)}">
      <div class="reservation-assignment__state"><small>Mesa asignada</small><strong>${item.table ? `Mesa ${escapeHtml(item.table)}` : 'Por asignar'}</strong><span>Bloque estimado: 2 horas</span></div>
      <label for="reservation-table-${escapeHtml(item.id)}">Seleccionar mesa<select id="reservation-table-${escapeHtml(item.id)}" data-reservation-table="${escapeHtml(item.id)}"><option value="">Elegir una mesa</option>${tableOptions}</select></label>
      <button class="secondary-button" type="button" data-assign-reservation="${escapeHtml(item.id)}">${item.table ? 'Cambiar mesa' : 'Asignar mesa'}</button>
      <p class="reservation-assignment__feedback" data-reservation-feedback="${escapeHtml(item.id)}" role="status" aria-live="polite"></p>
    </section>` : `<section class="reservation-assignment reservation-assignment--readonly"><div class="reservation-assignment__state"><small>Mesa asignada</small><strong>${item.table ? `Mesa ${escapeHtml(item.table)}` : 'Sin asignar'}</strong><span>${item.status === 'seated' ? 'Mesa ocupada por esta reservación' : item.status === 'completed' ? 'Visita finalizada' : 'Reservación cancelada'}</span></div></section>`;
    const helper = !item.table && ['pending', 'confirmed'].includes(item.status) ? `<p id="reservation-help-${escapeHtml(item.id)}" class="reservation-confirm-help">Asigna una mesa para continuar con la reservación.</p>` : '';
    const editActions = canEdit ? `<button class="secondary-button" type="button" data-edit-reservation="${escapeHtml(item.id)}">Modificar</button><button class="danger-button" type="button" data-cancel-reservation="${escapeHtml(item.id)}">Cancelar</button>` : '';
    const historyActions = canDelete ? `<button class="danger-button" type="button" data-delete-reservation="${escapeHtml(item.id)}">Eliminar del historial</button>` : '';
    const primaryAction = item.status === 'pending' ? `<button class="primary-button" type="button" data-reservation-status="confirmed" data-reservation="${escapeHtml(item.id)}" ${item.table ? '' : `disabled aria-describedby="reservation-help-${escapeHtml(item.id)}"`}>Confirmar reservación</button>`
      : item.status === 'confirmed' ? `<button class="primary-button" type="button" data-reservation-status="seated" data-reservation="${escapeHtml(item.id)}" ${item.table ? '' : `disabled aria-describedby="reservation-help-${escapeHtml(item.id)}"`}>Registrar llegada</button>`
      : item.status === 'seated' ? `<button class="primary-button" type="button" data-release-reservation="${escapeHtml(item.id)}">Cliente se retiró · liberar mesa</button>` : '';
    const actions = editActions || primaryAction || historyActions ? `<footer class="reservation-card__actions">${editActions}${primaryAction}${historyActions}${helper}</footer>` : '';
    const statusLabel = ({ pending: 'Pendiente', confirmed: 'Confirmada', seated: 'Cliente en mesa', completed: 'Cumplida', cancelled: 'Cancelada' })[item.status] || 'Actualizada';
    return `<article class="reservation-card" data-reservation-card="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(sourceLabel(item.source))}</span></div><b data-reservation-state="${item.status}">${statusLabel}</b></header><dl><div><dt>Fecha</dt><dd>${escapeHtml(item.date)} · ${escapeHtml(item.time)}</dd></div><div><dt>Grupo</dt><dd>${escapeHtml(item.guests)} personas</dd></div><div><dt>Cliente</dt><dd>${escapeHtml(item.name)} · ${escapeHtml(item.phone)}</dd></div><div><dt>Mesa</dt><dd>${item.table ? `Mesa ${escapeHtml(item.table)}` : 'Pendiente de asignación'}</dd></div>${item.preferences ? `<div><dt>Notas</dt><dd>${escapeHtml(item.preferences)}</dd></div>` : ''}</dl>${assignment}${actions}</article>`;
  }

  async function initMenu({ ordering, channel = 'catalog', internalMode = false }) {
    document.body.classList.toggle('order-entry-internal', internalMode);
    if (internalMode) {
      // Algunas ventanas de preview conservan un viewport mayor que la pantalla visible.
      const syncVisibleArea = () => {
        const screenWidth = window.screen?.availWidth || window.innerWidth;
        const screenHeight = window.screen?.availHeight || window.innerHeight;
        document.body.style.setProperty('--order-visible-width', `${Math.min(window.innerWidth, screenWidth)}px`);
        document.body.style.setProperty('--order-visible-height', `${Math.min(window.innerHeight, screenHeight)}px`);
        document.body.classList.toggle('order-entry-viewport-clipped', window.innerWidth >= 761 && (
          window.innerWidth > screenWidth + 16 || window.innerHeight > screenHeight + 16
        ));
      };
      syncVisibleArea();
      window.addEventListener('resize', syncVisibleArea);
    }
    const { categories, products: baseProducts } = catalogData();
    const products = [...baseProducts];
    const queryParams = new URLSearchParams(location.search);
    const table = queryParams.get('mesa');
    const isTable = channel === 'table';
    const channelName = ({ table: `Mesa ${table || ''}`, takeaway: 'Para llevar', counter: 'Pedido en caja' })[channel] || 'Carta digital';
    const trackingStorageKey = isTable ? `boccantina:order:table:${table}` : `boccantina:order:${channel}`;
    if (internalMode) document.title = 'Nuevo pedido — Boccantina';
    if (ordering && isTable && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(table || '')) {
      root.innerHTML = `${header()}<main class="confirmation"><div class="confirmation__icon">!</div><h1>QR de mesa inválido</h1><p>Este enlace no identifica una mesa válida. Solicita al personal el código QR correcto.</p><a class="secondary-button" href="${appUrl('/carta/')}">Consultar la carta</a></main>`;
      return;
    }
    if (ordering && isTable) {
      try {
        await request(`/api/tables/${encodeURIComponent(table)}/open`, { method: 'POST', body: '{}' });
      } catch (error) {
        root.innerHTML = `${header()}<main class="confirmation"><div class="confirmation__icon">!</div><h1>Mesa reservada</h1><p>${escapeHtml(error.message)}</p><p>Cuando administración registre la llegada, el QR permitirá abrir el menú y realizar pedidos.</p><a class="secondary-button" href="${appUrl('/carta/')}">Consultar la carta</a></main>`;
        return;
      }
    }

    let extrasConfig = window.BoccMenuExtrasConfig?.load() || { products: {} };
    if (window.BoccMenuExtrasConfig?.hydrate) {
      extrasConfig = await window.BoccMenuExtrasConfig.hydrate().catch(() => extrasConfig);
    }
    const baseProductIds = new Set(products.map((item) => item.id));
    const syncCustomProducts = () => {
      products.splice(0, products.length, ...baseProducts,
        ...(extrasConfig.customProducts || []).filter((item) => item.visible !== false && !baseProductIds.has(item.id)));
    };
    const availabilityOf = (product) => window.BoccMenuExtrasConfig?.statusFor(extrasConfig, product) || (product.soldOut ? 'sold-out-today' : 'available');
    syncCustomProducts();
    const state = { category: categories[0].id, query: '', cart: [], selected: null, editingIndex: null, quantity: 1, table, ordering, channel };
    const waiterOrderEntry = internalMode && channel === 'counter' && canOperate('orders.create_for_table') && !canOperate('orders.create');
    if (waiterOrderEntry) {
      const currentTables = await request('/api/tables');
      adminAssignedTables = currentTables.tables.filter(item => adminWaiterId && item.waiterId === adminWaiterId).map(item => item.table);
    }
    const heroImage = appUrl('/wp-content/uploads/revslider/o/9/e66f14773e38045d2da5c094a8356f14.webp');

    root.innerHTML = `<main class="order-shell${internalMode ? ' order-shell--internal-entry' : ''}">
      ${header({ table: ordering && isTable ? table : null, internal: internalMode, centralLink: internalMode, context: ordering && !isTable && !internalMode ? channelName : null })}
      ${internalMode ? `<section class="order-mode-selector" aria-labelledby="order-mode-title">
        <div><p class="order-eyebrow">Nuevo pedido</p><h1 id="order-mode-title">${waiterOrderEntry ? (adminAssignedTables.includes(Number(table)) ? `Mesa ${escapeHtml(table)}` : 'Comanda de mesa') : escapeHtml(channelName)}</h1></div>
        ${waiterOrderEntry ? `<button class="order-salon-link" type="button" data-open-table-picker>${adminAssignedTables.length ? 'Consultar mesas' : 'Elegir mesa'}</button>` : ''}
      </section>` : ''}
      <section class="order-hero${internalMode ? ' order-hero--internal' : ''}">
        <div class="order-hero__main"><p class="order-eyebrow">${ordering ? `Pedido digital · ${escapeHtml(channelName)}` : 'Carta digital · Solo consulta'}</p>
          <${internalMode ? 'h2' : 'h1'} class="order-hero__title">${ordering ? (isTable ? 'Arma tu mesa.' : channel === 'takeaway' ? 'Arma tu pedido.' : 'Pedido desde caja.') : 'Aquí se viene a compartir.'}</${internalMode ? 'h2' : 'h1'}>
          <p class="order-hero__intro">${ordering ? (isTable ? 'Explora la carta, personaliza cada plato y envía el pedido directamente al equipo. El número de mesa viaja con cada comanda.' : channel === 'takeaway' ? 'Elige tus platos y deja un nombre y teléfono para identificar el retiro en el restaurante.' : 'Registra el pedido que recibe el personal en caja y envíalo a la misma central de cocina.') : 'Explora platos, ingredientes y precios. Para ordenar dentro del restaurante, escanea el código QR colocado en tu mesa.'}</p>
          ${internalMode ? '' : `<nav class="menu-moments" aria-label="Explorar la carta por momento">
            <button type="button" data-category="entradas"><span>Para compartir</span><small>Entradas</small></button>
            <button type="button" data-category="pizzas"><span>Al centro</span><small>Pizzas</small></button>
            <button type="button" data-category="autor"><span>Para brindar</span><small>Cócteles de autor</small></button>
          </nav>`}
        </div>
        <aside class="order-hero__aside">
          ${internalMode ? '' : `<div class="order-hero__media"><img src="${escapeHtml(heroImage)}" alt="Interior de Boccantina con mesa y cava de vinos" width="1612" height="992" decoding="async" fetchpriority="high"></div>`}
          <div class="order-hero__aside-content">
          <strong>${ordering && isTable ? '¿Necesitas atención?' : ordering ? 'Origen identificado' : 'Carta visual'}</strong>
          <p>${ordering && isTable ? 'Puedes llamar al mesero o solicitar una explicación sin abandonar tu pedido.' : ordering ? `La central y cocina verán este pedido identificado como “${escapeHtml(channelName)}”.` : 'Esta página no envía órdenes. El sistema de pedidos se abre desde el QR de mesa o desde el acceso para llevar.'}</p>
          ${ordering && isTable ? '<div class="dialog-actions" style="justify-content:flex-start;margin-top:16px"><button class="secondary-button" type="button" data-service="waiter">Llamar al mesero</button><button class="secondary-button" type="button" data-service="help">Solicitar ayuda</button></div><p class="feedback" data-service-feedback role="status" aria-live="polite"></p>' : !ordering ? `<div class="dialog-actions" style="justify-content:flex-start;margin-top:16px"><a class="primary-button" href="${appUrl('/pedido/?tipo=takeaway')}">Hacer pedido para llevar</a></div>` : ''}
          </div>
        </aside>
      </section>
      ${ordering && !isTable && !internalMode ? '<section class="order-tracking-entry"><div><p class="order-eyebrow">Seguimiento y ayuda</p><strong>¿Ya hiciste un pedido?</strong><span>Recupéralo con la referencia y el código de retiro, incluso desde otro dispositivo.</span></div><button class="secondary-button" type="button" data-open-tracker>Consultar mi pedido</button></section>' : ''}
      ${internalMode ? '<div class="order-entry-layout">' : ''}
      <section class="menu-toolbar" id="menu" aria-label="Herramientas de la carta">
        <label class="menu-search"><span class="sr-only">Buscar platos</span>${iconSearch}<input type="search" name="menu-search" placeholder="Buscar plato o ingrediente…" data-search></label>
        ${internalMode ? '<details class="order-category-picker"><summary><span>Categoría</span><strong data-category-current></strong></summary><nav class="category-tabs" aria-label="Categorías" data-categories></nav></details>' : `<div class="category-scroller">
          <button class="category-scroller__control category-scroller__control--previous" type="button" data-category-scroll="-1" aria-label="Ver categorías anteriores">${iconChevron}</button>
          <nav class="category-tabs" aria-label="Categorías" data-categories tabindex="0"></nav>
          <button class="category-scroller__control category-scroller__control--next" type="button" data-category-scroll="1" aria-label="Ver más categorías">${iconChevron}</button>
        </div>`}
      </section>
      <section class="menu-content">
        <header class="menu-heading"><div><h2 data-category-title></h2><p data-category-description></p></div><span data-results></span></header>
        <div class="product-grid" data-products></div>
      </section>
      ${internalMode ? `<aside class="order-entry-cart" data-inline-cart aria-labelledby="order-entry-cart-title"><header class="order-entry-cart__head"><div><p class="order-eyebrow">Orden en curso</p><h2 id="order-entry-cart-title">Resumen del pedido</h2><span data-inline-cart-count role="status" aria-live="polite">0 productos</span></div><button class="order-entry-cart__close" type="button" data-cart-close aria-label="Cerrar resumen">×</button></header><div class="order-entry-cart__body"><p class="order-entry-cart__empty" data-inline-cart-empty>Agrega un producto de la carta para empezar.</p><div class="cart-lines" data-inline-cart-lines></div><div class="order-contact-fields"><label class="field">Nombre ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-name maxlength="100" autocomplete="name" ${channel === 'takeaway' ? 'required' : ''}></label><label class="field">Teléfono ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-phone type="tel" inputmode="tel" maxlength="40" autocomplete="tel" ${channel === 'takeaway' ? 'required' : ''}></label></div><label class="field">Nota general del pedido<textarea data-order-note maxlength="240" placeholder="Ej. entregar bebidas primero"></textarea></label></div><footer class="order-entry-cart__foot"><div class="cart-total"><span>Subtotal estimado</span><strong data-inline-cart-total>₡0</strong></div><p class="feedback" data-order-feedback role="status" aria-live="polite"></p><button class="primary-button" type="button" data-send-order disabled>Enviar pedido a cocina</button></footer></aside><button class="order-entry-cart-backdrop" type="button" data-cart-close aria-label="Cerrar resumen del pedido" hidden></button></div>` : ''}
      ${ordering ? '<section class="cart-dock" data-cart-dock hidden><div><small data-cart-count></small><strong data-cart-total></strong></div><button class="primary-button" type="button" data-open-cart>Revisar pedido</button></section>' : ''}
      <dialog class="order-dialog" data-product-dialog></dialog>
      ${waiterOrderEntry ? '<dialog class="order-dialog order-table-dialog" data-table-dialog aria-labelledby="order-table-dialog-title"><header class="dialog-header"><div><h2 id="order-table-dialog-title">Elegir mesa</h2><p>Consulta el salón sin perder los productos de esta orden.</p></div><button class="dialog-close" type="button" data-close-table-picker aria-label="Cerrar selección de mesa">×</button></header><div class="dialog-body"><p class="feedback" data-table-picker-feedback role="status" aria-live="polite"></p><div class="order-table-picker" data-table-picker></div></div></dialog>' : ''}
      ${ordering && !internalMode ? '<dialog class="order-dialog" data-cart-dialog></dialog>' : ''}
      ${ordering && !isTable && !internalMode ? '<dialog class="order-dialog" data-tracker-dialog><header class="dialog-header"><div><h2>Consultar pedido</h2><p>Usa los datos entregados al confirmar la orden.</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header><form class="dialog-body" data-track-form><label class="field">Referencia del pedido<input name="code" required placeholder="BOC-000" autocomplete="off"></label><label class="field">Código de retiro<input name="pickupCode" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" autocomplete="one-time-code"></label><p class="feedback" data-track-feedback role="status" aria-live="polite"></p><div class="dialog-actions"><button class="secondary-button" type="button" data-close>Cancelar</button><button class="primary-button" type="submit">Ver estado</button></div></form></dialog>' : ''}
    </main>`;

    if (internalMode && channel === 'counter') {
      root.querySelector('.order-entry-cart [data-order-note]').closest('.field').insertAdjacentHTML('beforebegin',
        waiterOrderEntry
          ? `<label class="field order-table-field">Mesa asignada <span>Obligatoria</span><select data-order-table required><option value="">Selecciona una mesa</option>${adminAssignedTables.map(table => `<option value="${table}">Mesa ${table}</option>`).join('')}</select></label>${adminAssignedTables.length ? '' : '<p class="feedback">No tienes mesas asignadas. Solicita una asignación antes de crear pedidos.</p>'}`
          : '<label class="field order-table-field">Mesa <span>Opcional · dejar vacío si no hay mesa</span><input data-order-table type="number" inputmode="numeric" min="1" max="100" step="1" placeholder="Número de mesa"></label>');
    }

    const el = (selector) => root.querySelector(selector);
    if (waiterOrderEntry) {
      const tableField = el('[data-order-table]');
      if (adminAssignedTables.includes(Number(table))) tableField.value = table;
      tableField.closest('.field').insertAdjacentHTML('afterend', `<div class="order-table-help"><button class="secondary-button" type="button" data-open-table-picker>Ver mesas disponibles</button><span>${adminAssignedTables.length ? 'Puedes agregar otra comanda a la cuenta de esta mesa.' : 'Elige una mesa disponible sin salir del pedido.'}</span></div>`);
      const oldMessage = tableField.closest('.order-entry-cart__body').querySelector('.feedback');
      if (oldMessage) oldMessage.remove();
    }
    let tablePickerOpener = null;
    const tablePickerDialog = waiterOrderEntry ? el('[data-table-dialog]') : null;
    const tablePickerFeedback = waiterOrderEntry ? el('[data-table-picker-feedback]') : null;
    if (tablePickerDialog) tablePickerDialog.addEventListener('close', () => tablePickerOpener?.focus());
    function selectOrderTable(number) {
      const field = el('[data-order-table]');
      field.value = String(number);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      el('#order-mode-title').textContent = `Mesa ${number}`;
      tablePickerDialog.close();
    }
    async function refreshTablePicker() {
      const { tables } = await request('/api/tables');
      tablePickerFeedback.textContent = '';
      adminAssignedTables = tables.filter(item => adminWaiterId && item.waiterId === adminWaiterId).map(item => item.table);
      const field = el('[data-order-table]');
      const previous = field.value;
      field.innerHTML = `<option value="">Selecciona una mesa</option>${adminAssignedTables.map(number => `<option value="${number}">Mesa ${number}</option>`).join('')}`;
      field.value = adminAssignedTables.includes(Number(previous)) ? previous : '';
      if (previous && !field.value) el('#order-mode-title').textContent = 'Comanda de mesa';
      const ordered = [...tables].sort((a, b) => {
        const rank = item => adminWaiterId && item.waiterId === adminWaiterId ? 0 : !item.waiterId && item.status === 'available' ? 1 : !item.waiterId && item.status === 'occupied' && !item.reservationId ? 2 : 3;
        return rank(a) - rank(b) || a.table - b.table;
      });
      el('[data-table-picker]').innerHTML = ordered.map(item => {
        const mine = Boolean(adminWaiterId && item.waiterId === adminWaiterId);
        const claimable = canOperate('tables.claim') && adminWaiterId && !item.waiterId && item.status !== 'reserved' && !item.reservationId;
        const status = item.status === 'reserved' ? 'Reservada' : item.status === 'occupied' ? 'Ocupada' : 'Disponible';
        const detail = mine ? 'A tu cargo' : item.waiterName ? `Atiende ${escapeHtml(item.waiterName)}` : item.reservation ? `Reserva a las ${escapeHtml(item.reservation.time)}` : item.status === 'occupied' ? 'Sin mesero asignado' : 'Sin responsable';
        const action = mine && item.status !== 'reserved' ? `<button class="secondary-button" type="button" data-select-order-table="${item.table}" aria-label="${field.value === String(item.table) ? 'Continuar con' : 'Elegir'} mesa ${item.table}">${field.value === String(item.table) ? 'Continuar' : 'Elegir mesa'}</button>`
          : claimable ? `<button class="primary-button" type="button" data-claim-order-table="${item.table}" aria-label="${item.status === 'occupied' ? 'Tomar atención en' : 'Iniciar atención en'} mesa ${item.table}">${item.status === 'occupied' ? 'Tomar atención' : 'Iniciar atención'}</button>` : '';
        return `<div class="order-table-picker__row" ${mine ? 'data-mine="true"' : ''}><div><strong>Mesa ${item.table}</strong><span>${status} · ${detail}</span></div>${action}</div>`;
      }).join('') || '<p class="order-table-picker__empty">No hay mesas configuradas.</p>';
      if (!adminWaiterId) tablePickerFeedback.textContent = 'Tu cuenta necesita un perfil de mesero activo. Solicita la vinculación al propietario.';
      else if (previous && !field.value) tablePickerFeedback.textContent = 'La mesa seleccionada ya no está a tu cargo. Elige otra; los productos permanecen en el pedido.';
    }
    async function openTablePicker(opener) {
      tablePickerOpener = opener;
      tablePickerFeedback.textContent = 'Consultando mesas…';
      delete tablePickerFeedback.dataset.state;
      el('[data-table-picker]').innerHTML = '';
      tablePickerDialog.showModal();
      try {
        await refreshTablePicker();
      } catch (error) {
        tablePickerFeedback.textContent = error.message;
        tablePickerFeedback.dataset.state = 'error';
      }
    }
    const productById = (id) => products.find((product) => product.id === id);
    const categoryById = (id) => categories.find((category) => category.id === id);
    const categoryHeroProducts = {
      entradas: 'calamar',
      burgers: 'bocca-burger',
      minis: 'mini-chicken',
      bocas: 'skirt-gallo',
      pizzas: 'pizza-toscana',
      postres: 'dessert',
      vinos: 'house-wine',
      autor: 'tropical-oasis',
      gin: 'gin-tonic',
      rones: 'zacapa',
      tequila: 'don-julio',
      vodka: 'titos',
      whisky: 'monkey'
    };
    const itemUnitTotal = (item) => (Number(item.product.price) || 0) + item.extras.reduce((sum, extra) => sum + (Number(extra.price) || 0), 0);
    const cartTotal = () => state.cart.reduce((sum, item) => sum + itemUnitTotal(item) * item.quantity, 0);

    function filteredProducts() {
      if (state.query) {
        const needle = normalize(state.query);
        return products.filter((product) => normalize(`${product.nameEs} ${product.descEs} ${product.tags.join(' ')}`).includes(needle));
      }
      return products.filter((product) => product.category === state.category);
    }

    function updateCategoryScrollControls() {
      if (internalMode) return;
      const tabs = el('[data-categories]');
      if (!tabs) return;
      const maximum = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
      const previous = el('[data-category-scroll="-1"]');
      const next = el('[data-category-scroll="1"]');
      previous.disabled = maximum < 2 || tabs.scrollLeft <= 2;
      next.disabled = maximum < 2 || tabs.scrollLeft >= maximum - 2;
      tabs.dataset.overflow = maximum >= 2 ? 'true' : 'false';
    }

    function renderCategories({ revealActive = false } = {}) {
      const tabs = el('[data-categories]');
      const previousScroll = tabs.scrollLeft;
      tabs.innerHTML = categories.map((category) => `<button type="button" data-category="${category.id}" aria-pressed="${!state.query && state.category === category.id}">${escapeHtml(category.es)}</button>`).join('');
      if (internalMode) {
        el('[data-category-current]').textContent = state.query ? 'Todas las categorías' : categoryById(state.category)?.es || 'Elegir categoría';
        return;
      }
      root.querySelectorAll('.menu-moments [data-category]').forEach((button) => {
        button.setAttribute('aria-pressed', String(!state.query && state.category === button.dataset.category));
      });
      requestAnimationFrame(() => {
        const active = !state.query && tabs.querySelector('[aria-pressed="true"]');
        if (active && revealActive) {
          const targetLeft = active.offsetLeft - ((tabs.clientWidth - active.offsetWidth) / 2);
          tabs.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
          });
        } else {
          tabs.scrollLeft = previousScroll;
        }
        updateCategoryScrollControls();
      });
    }

    function renderProducts() {
      const items = filteredProducts();
      const category = categoryById(state.category);
      el('.menu-heading').classList.toggle('is-searching', Boolean(state.query));
      el('[data-category-title]').textContent = state.query ? 'Resultados' : category.es;
      el('[data-category-description]').textContent = state.query ? `Coincidencias para “${state.query}” en toda la carta.` : category.esDescription;
      el('[data-results]').textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
      if (!items.length) {
        el('[data-products]').innerHTML = '<div class="empty-state">No encontramos productos. Prueba con otro nombre o ingrediente.</div>';
        return;
      }

      const groupedItems = categories
        .map((groupCategory) => ({ category: groupCategory, items: items.filter((product) => product.category === groupCategory.id) }))
        .filter((group) => group.items.length);

      el('[data-products]').innerHTML = groupedItems.map((group, groupIndex) => {
        const heroProduct = productById(categoryHeroProducts[group.category.id]) || group.items[0];
        const categoryNumber = String(categories.findIndex((item) => item.id === group.category.id) + 1).padStart(2, '0');
        const family = ['vinos', 'autor', 'gin', 'rones', 'tequila', 'vodka', 'whisky', 'bebidas'].includes(group.category.id) ? 'drinks' : 'food';
        return `<article class="menu-spread" data-family="${family}" aria-label="${escapeHtml(group.category.es)}">
          <figure class="menu-spread__visual">
            <img src="${escapeHtml(productImage(heroProduct))}" alt="" width="720" height="960" decoding="async" ${groupIndex ? 'loading="lazy"' : 'fetchpriority="high"'}>
            <figcaption><span>Carta Boccantina</span><strong>${escapeHtml(group.category.es)}</strong><small>${categoryNumber}</small></figcaption>
          </figure>
          <section class="menu-spread__catalog">
            ${group.items.length > 1 ? '<p class="menu-spread__swipe-hint" aria-hidden="true">Desliza para explorar los platos <span>→</span></p>' : ''}
            <div class="menu-spread__items" role="region" tabindex="0" aria-label="Platos de ${escapeHtml(group.category.es)}">${group.items.map((product) => `<article class="product-card${availabilityOf(product) !== 'available' ? ' is-sold-out' : ''}">
              <div class="product-card__body"><div class="product-card__top"><h3>${escapeHtml(product.nameEs)}</h3><span class="product-card__price">${money(product.price)}</span></div>
              <p class="product-card__description">${escapeHtml(product.descEs)}</p>
              <footer class="product-card__footer"><div class="product-tags">${product.tags.map((tag) => `<span>${tagLabel(tag)}</span>`).join('')}</div>
              ${ordering ? `<div class="product-card__actions"><button class="secondary-button" type="button" data-detail="${product.id}">Detalles</button><button class="primary-button" type="button" data-add="${product.id}" ${availabilityOf(product) !== 'available' || product.price === null ? 'disabled' : ''}>${availabilityOf(product) === 'sold-out-today' ? 'Agotado hoy' : availabilityOf(product) === 'unavailable' ? 'No disponible' : product.price === null ? 'Consultar' : internalMode ? 'Agregar' : 'Agregar pedido'}</button></div>` : `<div class="product-card__actions"><button class="secondary-button" type="button" data-detail="${product.id}">Ver detalles</button></div>`}</footer></div>
            </article>`).join('')}</div>
          </section>
        </article>`;
      }).join('');
    }

    function extrasFor(product) {
      const config = extrasConfig.products?.[product.id];
      const active = new Map((extrasConfig.library || []).filter((extra) => extra.active !== false).map((extra) => [extra.id, extra]));
      return config?.enabled ? config.extras.filter((extra) => extra.nameEs?.trim() && active.has(extra.id)).map((extra) => ({ ...extra, nameEs: active.get(extra.id).nameEs, nameEn: active.get(extra.id).nameEn, price: extra.useLibraryPrice ? active.get(extra.id).price : extra.price })) : [];
    }

    function openProduct(product, readOnly = false, editingIndex = null) {
      if (!product || (!readOnly && availabilityOf(product) !== 'available')) return;
      const editing = editingIndex === null ? null : state.cart[editingIndex];
      state.selected = product;
      state.editingIndex = editingIndex;
      state.quantity = editing?.quantity || 1;
      const extras = extrasFor(product);
      const dialog = el('[data-product-dialog]');
      dialog.innerHTML = `<header class="dialog-header"><div><h2>${escapeHtml(product.nameEs)}</h2><p>${money(product.price)}</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header>
        <div class="dialog-body"><p>${escapeHtml(product.descEs)}</p>
          ${readOnly && internalMode && extras.length ? `<div class="order-entry-detail-extras"><strong>Opciones disponibles</strong><ul>${extras.map((extra) => `<li>${escapeHtml(extra.nameEs)} <span>${extra.price === null ? 'Precio pendiente' : `+${money(extra.price)}`}</span></li>`).join('')}</ul></div>` : ''}
          ${!readOnly && extras.length ? `<fieldset><legend>Extras para este plato</legend><div class="extra-list">${extras.map((extra) => `<label class="extra-option"><input type="checkbox" value="${escapeHtml(extra.id)}" data-extra ${editing?.extras.some((selected) => selected.id === extra.id) ? 'checked' : ''}><span>${escapeHtml(extra.nameEs)}</span><small>${extra.price === null ? 'Precio pendiente' : `+${money(extra.price)}`}</small></label>`).join('')}</div></fieldset>` : ''}
          ${!readOnly ? `${channel === 'takeaway' ? '<p class="item-destination-fixed">Destino: <strong>Para llevar</strong></p>' : `<fieldset class="item-destination"><legend>¿Dónde va este producto?</legend><div><label><input type="radio" name="item-destination" value="dine-in" ${!editing || editing.destination !== 'takeaway' ? 'checked' : ''}><span>Consumir aquí</span></label><label><input type="radio" name="item-destination" value="takeaway" ${editing?.destination === 'takeaway' ? 'checked' : ''}><span>Para llevar</span></label></div></fieldset>`}
          <label class="field">Indicación de preparación<textarea data-item-note maxlength="180" placeholder="Ej. sin cebolla">${escapeHtml(editing?.note || '')}</textarea></label>
          <div class="quantity-picker" aria-label="Cantidad"><button type="button" data-quantity="minus" aria-label="Restar">−</button><output data-quantity-output>${state.quantity}</output><button type="button" data-quantity="plus" aria-label="Sumar">+</button></div>
          <div class="dialog-actions"><button class="primary-button" type="button" data-confirm-item>${editing ? 'Guardar cambios' : 'Agregar al pedido'}</button></div>` : ''}
        </div>`;
      dialog.showModal();
    }

    let cartPanelOpen = false;
    let sendingOrder = false;
    const clientRequestId = crypto.randomUUID();
    const compactCart = matchMedia('(max-width: 760px)');

    function syncCartPanel() {
      if (!internalMode) return;
      const panel = el('[data-inline-cart]');
      const backdrop = el('.order-entry-cart-backdrop');
      const isCompact = compactCart.matches;
      panel.hidden = isCompact && !cartPanelOpen;
      panel.inert = isCompact && !cartPanelOpen;
      panel.setAttribute('role', isCompact ? 'dialog' : 'region');
      if (isCompact) panel.setAttribute('aria-modal', 'true');
      else panel.removeAttribute('aria-modal');
      backdrop.hidden = !isCompact || !cartPanelOpen;
      root.querySelectorAll('.order-header, .order-mode-selector, .menu-toolbar, .menu-content, .cart-dock').forEach((section) => { section.inert = isCompact && cartPanelOpen; });
      document.body.classList.toggle('order-entry-cart-open', isCompact && cartPanelOpen);
    }

    function closeCartPanel() {
      if (!internalMode || !cartPanelOpen) return;
      cartPanelOpen = false;
      syncCartPanel();
      const trigger = el('[data-open-cart]');
      if (trigger?.getClientRects().length) trigger.focus();
      else el('[data-search]')?.focus();
    }

    function cartLine(item, index) {
      const destination = item.destination || (channel === 'takeaway' ? 'takeaway' : 'dine-in');
      const lineName = escapeHtml(`${item.product.nameEs} · ${destination === 'takeaway' ? 'para llevar' : 'consumir aquí'}`);
      return `<article class="cart-line"><div class="cart-line__top"><h3>${escapeHtml(item.product.nameEs)}</h3><strong>${money(itemUnitTotal(item) * item.quantity)}</strong></div>
        <span class="item-destination-tag" data-destination="${destination}">${destination === 'takeaway' ? 'Para llevar' : 'Consumir aquí'}</span>
        ${item.extras.length ? `<ul>${item.extras.map((extra) => `<li>+ ${escapeHtml(extra.nameEs)}${extra.price === null ? '' : ` (${money(extra.price)})`}</li>`).join('')}</ul>` : ''}
        ${item.note ? `<p><small>Nota: ${escapeHtml(item.note)}</small></p>` : ''}
        <div class="cart-line__actions"><div class="quantity-picker" aria-label="Cantidad de ${lineName}"><button type="button" data-cart-quantity="minus" data-line="${index}" aria-label="Restar una unidad de ${lineName}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><output>${item.quantity}</output><button type="button" data-cart-quantity="plus" data-line="${index}" aria-label="Sumar una unidad de ${lineName}" ${item.quantity >= 12 ? 'disabled' : ''}>+</button></div><button type="button" data-edit-line="${index}" aria-label="Editar ${lineName}">Editar</button><button type="button" data-remove-line="${index}" aria-label="Quitar ${lineName} del pedido">Quitar</button></div></article>`;
    }

    function renderCartDock() {
      if (!ordering) return;
      const dock = el('[data-cart-dock]');
      const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
      dock.hidden = count === 0;
      el('[data-cart-count]').textContent = `${count} ${count === 1 ? 'producto' : 'productos'} · ${channelName}`;
      el('[data-cart-total]').textContent = `Total estimado: ${money(cartTotal())}`;
      if (!internalMode) return;
      el('[data-inline-cart-count]').textContent = `${count} ${count === 1 ? 'producto' : 'productos'}`;
      el('[data-inline-cart-total]').textContent = money(cartTotal());
      el('[data-inline-cart-empty]').hidden = state.cart.length > 0;
      el('.order-entry-cart .order-contact-fields').hidden = !state.cart.length;
      if (el('[data-order-table]')) el('[data-order-table]').closest('.field').hidden = !state.cart.length;
      el('.order-entry-cart [data-order-note]').closest('.field').hidden = !state.cart.length;
      el('[data-send-order]').disabled = !state.cart.length || sendingOrder;
      el('[data-inline-cart-lines]').innerHTML = state.cart.map(cartLine).join('');
      syncCartPanel();
    }

    function openCart() {
      if (internalMode) {
        cartPanelOpen = true;
        syncCartPanel();
        if (compactCart.matches) el('.order-entry-cart__close').focus();
        else el('#order-entry-cart-title').scrollIntoView({ block: 'nearest' });
        return;
      }
      const dialog = el('[data-cart-dialog]');
      dialog.innerHTML = `<header class="dialog-header"><div><h2>Tu pedido</h2><p>${escapeHtml(channelName)}</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header>
        <div class="dialog-body"><div class="cart-lines">${state.cart.map(cartLine).join('')}</div>
          ${!isTable ? `<div class="order-contact-fields"><label class="field">Nombre ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-name maxlength="100" autocomplete="name" ${channel === 'takeaway' ? 'required' : ''}></label><label class="field">Teléfono ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-phone type="tel" inputmode="tel" maxlength="40" autocomplete="tel" ${channel === 'takeaway' ? 'required' : ''}></label></div>` : ''}
          <label class="field">Nota general del pedido<textarea data-order-note maxlength="240" placeholder="Ej. entregar bebidas primero"></textarea></label>
          <div class="cart-total"><span>Total estimado</span><span>${money(cartTotal())}</span></div>
          <p class="feedback" data-order-feedback role="status" aria-live="polite"></p>
          <div class="dialog-actions"><button class="secondary-button" type="button" data-close>Seguir agregando</button><button class="primary-button" type="button" data-send-order>Enviar pedido</button></div>
        </div>`;
      if (!dialog.open) dialog.showModal();
    }

    async function sendOrder(button) {
      if (sendingOrder || !state.cart.length) return;
      const feedback = el('[data-order-feedback]');
      if (window.BoccMenuExtrasConfig?.hydrate) {
        const nextConfig = await window.BoccMenuExtrasConfig.hydrate().catch(() => extrasConfig);
        if (nextConfig.updatedAt !== extrasConfig.updatedAt) { extrasConfig = nextConfig; syncCustomProducts(); renderProducts(); }
        const blocked = state.cart.find((item) => availabilityOf(item.product) !== 'available' || item.extras.some((extra) => !extrasFor(item.product).some((option) => option.id === extra.id)));
        if (blocked) { feedback.textContent = `Revisa ${blocked.product.nameEs}: el producto o uno de sus extras ya no está disponible. Los demás siguen en tu pedido.`; feedback.dataset.state = 'error'; return; }
      }
      const tableInput = el('[data-order-table]');
      const selectedTable = isTable ? Number(table) : tableInput?.value.trim() ? Number(tableInput.value) : null;
      if (tableInput?.value.trim() && (!Number.isInteger(selectedTable) || selectedTable < 1 || selectedTable > 100)) {
        feedback.textContent = 'Indica un número de mesa entre 1 y 100 o deja el campo vacío.';
        feedback.dataset.state = 'error';
        tableInput.setAttribute('aria-invalid', 'true');
        tableInput.focus();
        return;
      }
      if (waiterOrderEntry && !selectedTable) {
        feedback.textContent = 'Selecciona una mesa a tu cargo o inicia atención desde Mis mesas.';
        feedback.dataset.state = 'error';
        tableInput.setAttribute('aria-invalid', 'true');
        tableInput.focus();
        return;
      }
      if (channel === 'takeaway') {
        const missing = [el('[data-customer-name]'), el('[data-customer-phone]')].find((input) => !input?.value.trim());
        if (missing) {
          feedback.textContent = 'Completa el nombre y el teléfono para identificar el retiro.';
          feedback.dataset.state = 'error';
          if (internalMode) { feedback.id = 'order-entry-error'; missing.setAttribute('aria-invalid', 'true'); missing.setAttribute('aria-describedby', feedback.id); }
          missing.focus();
          return;
        }
      }
      sendingOrder = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const previousLabel = button.textContent;
      button.textContent = 'Enviando…';
      delete feedback.dataset.state;
      feedback.textContent = 'Enviando pedido a la central…';
      try {
        const result = await request('/api/orders', { method: 'POST', body: JSON.stringify({
          clientRequestId,
          channel,
          table: selectedTable,
          customerName: el('[data-customer-name]')?.value.trim() || '',
          phone: el('[data-customer-phone]')?.value.trim() || '',
          note: el('[data-order-note]')?.value.trim() || '',
          items: state.cart.map((item) => ({ productId: item.product.id, name: item.product.nameEs, quantity: item.quantity, unitPrice: item.product.price, destination: item.destination, extras: item.extras.map((extra) => ({ id: extra.id, name: extra.nameEs, price: extra.price })), note: item.note })),
          total: cartTotal()
        }) });
        if (!internalMode) el('[data-cart-dialog]').close();
        document.body.classList.remove('order-entry-cart-open');
        renderConfirmation(result.order);
      } catch (error) {
        feedback.textContent = error.message;
        feedback.dataset.state = 'error';
        sendingOrder = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = previousLabel;
      }
    }

    if (window.BoccMenuExtrasConfig?.hydrate) {
      const refreshAvailability = async () => {
        if (document.hidden) return;
        const nextConfig = await window.BoccMenuExtrasConfig.hydrate().catch(() => extrasConfig);
        if (nextConfig.updatedAt === extrasConfig.updatedAt) return;
        extrasConfig = nextConfig;
        syncCustomProducts();
        renderProducts();
      };
      window.addEventListener('focus', refreshAvailability);
      window.setInterval(refreshAvailability, 20000);
    }

    function trackingEndpoint(credentials) {
      const params = new URLSearchParams({ code: credentials.code });
      if (credentials.token) params.set('token', credentials.token);
      if (credentials.pickupCode) params.set('pickupCode', credentials.pickupCode);
      return `/api/orders/track?${params}`;
    }

    async function trackedOrder(credentials) {
      return (await request(trackingEndpoint(credentials))).order;
    }

    function renderConfirmation(order, access = {}) {
      let currentOrder = { ...order };
      const credentials = { code: order.code, token: access.token || order.trackingToken || '', pickupCode: access.pickupCode || '' };
      if (!internalMode) {
        try { localStorage.setItem(trackingStorageKey, JSON.stringify(credentials)); } catch { /* Tracking still works in the current tab. */ }
      }
      const trackingUrl = new URL(location.href);
      trackingUrl.searchParams.set('pedido', order.code);
      if (credentials.token) trackingUrl.searchParams.set('token', credentials.token);
      else if (credentials.pickupCode) trackingUrl.searchParams.set('retiro', credentials.pickupCode);
      const pickup = (order.channel || channel) === 'takeaway';
      const hasTakeaway = order.items?.some((item) => itemDestination(item, order) === 'takeaway');
      const contextText = order.table ? `la mesa ${order.table}` : pickup ? 'tu pedido para llevar' : 'el pedido de caja';
      root.innerHTML = `${header({ table: order.table, internal: internalMode, centralLink: internalMode, context: order.table ? null : channelName })}<main class="confirmation confirmation--tracking">
        <div class="confirmation__icon">✓</div><p class="order-eyebrow">Pedido recibido por la central</p><h1>Tu pedido está registrado.</h1>
        <p>${internalMode ? 'La orden ya está visible en la central y conserva su canal de atención.' : 'Conserva estos datos para recuperar el seguimiento y verificar la entrega.'}</p>
        <section class="order-identity" aria-label="Datos para identificar el pedido"><div><small>Referencia</small><strong>${escapeHtml(order.code)}</strong></div>${hasTakeaway ? `<div><small>Código de retiro</small><strong>${escapeHtml(order.pickupCode)}</strong></div>` : ''}<div><small>Pago</small><strong data-client-payment>${escapeHtml(paymentLabel(order))}</strong></div></section>
        <div class="order-status-track" data-status-track><span>Recibido</span><span>Confirmado</span><span>En cocina</span><span>Listo</span><span>Entregado</span></div>
        <p class="order-live" data-order-live role="status" aria-live="polite"></p>
        <p class="order-payment-note" data-payment-note>${order.paymentStatus === 'paid' ? 'El equipo ya registró el pago.' : 'El pago todavía no ha sido registrado por el equipo.'}</p>
        <div class="confirmation__actions">${internalMode ? `<a class="secondary-button" href="${appUrl('/admin/pedidos/')}">Volver a la central</a>` : '<button class="secondary-button" type="button" data-copy-tracking>Copiar seguimiento</button>'}${pickup && !internalMode ? '<button class="secondary-button" type="button" data-open-help>Ayuda con mi pedido</button>' : ''}<button class="primary-button" type="button" data-new-order>${internalMode ? 'Registrar otro pedido' : 'Agregar otro pedido'}</button></div>
        ${pickup && !internalMode ? '<dialog class="order-dialog" data-help-dialog><header class="dialog-header"><div><h2>Ayuda para llevar</h2><p>Resuelve las dudas más comunes sin perder tu pedido.</p></div><button class="dialog-close" type="button" data-help-close aria-label="Cerrar">×</button></header><div class="dialog-body"><div class="help-options"><button class="secondary-button" type="button" data-help-topic="status">¿En qué estado está?</button><button class="secondary-button" type="button" data-help-topic="pickup">¿Qué presento al retirar?</button><button class="secondary-button" type="button" data-help-topic="payment">¿El pago está registrado?</button><button class="secondary-button" type="button" data-help-request="remote-help">Necesito otra ayuda</button></div><div class="help-answer" data-help-answer role="status" aria-live="polite">Selecciona una opción.</div></div></dialog>' : ''}
      </main>`;
      const sequence = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
      const labels = {
        pending: `Recibimos ${contextText}. El equipo debe confirmarlo.`,
        confirmed: 'Pedido confirmado. Está en la fila de cocina.',
        preparing: 'La cocina está preparando tu pedido.',
        ready: pickup ? 'Tu pedido está listo. Puedes retirarlo con tu referencia y código.' : 'Tu pedido está listo para entregar.',
        delivered: 'Pedido entregado.',
        cancelled: 'El pedido fue cancelado. Solicita ayuda si necesitas una aclaración.'
      };

      function updateStatus(nextOrder) {
        currentOrder = { ...currentOrder, ...nextOrder };
        const position = sequence.indexOf(currentOrder.status);
        root.querySelectorAll('[data-status-track] span').forEach((node, index) => node.classList.toggle('is-active', position >= 0 && index <= position));
        const live = root.querySelector('[data-order-live]');
        live.textContent = labels[currentOrder.status] || `${orderStatusLabel(currentOrder.status)}.`;
        live.dataset.state = currentOrder.status;
        root.querySelector('[data-client-payment]').textContent = paymentLabel(currentOrder);
        root.querySelector('[data-payment-note]').textContent = currentOrder.paymentStatus === 'paid' ? 'El equipo ya registró el pago.' : 'El pago todavía no ha sido registrado por el equipo.';
      }

      async function refreshStatus() {
        try { updateStatus(await trackedOrder(credentials)); }
        catch { root.querySelector('[data-order-live]').textContent = 'No pudimos actualizar ahora. Conservamos el último estado y volveremos a intentar.'; }
      }

      updateStatus(currentOrder);
      const poll = window.setInterval(async () => {
        await refreshStatus();
        if (currentOrder.status === 'cancelled' || (currentOrder.status === 'delivered' && currentOrder.paymentStatus === 'paid')) window.clearInterval(poll);
      }, 3000);

      root.querySelector('[data-copy-tracking]')?.addEventListener('click', async (event) => {
        try { await navigator.clipboard.writeText(trackingUrl.toString()); event.currentTarget.textContent = 'Enlace copiado'; }
        catch { event.currentTarget.textContent = 'No se pudo copiar'; }
      });
      root.querySelector('[data-new-order]').addEventListener('click', () => {
        window.clearInterval(poll);
        try { localStorage.removeItem(trackingStorageKey); } catch { /* Continue with URL cleanup. */ }
        const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete('pedido'); cleanUrl.searchParams.delete('token'); cleanUrl.searchParams.delete('retiro');
        location.href = cleanUrl.toString();
      });
      root.querySelector('[data-open-help]')?.addEventListener('click', () => root.querySelector('[data-help-dialog]').showModal());
      root.querySelector('[data-help-close]')?.addEventListener('click', () => root.querySelector('[data-help-dialog]').close());
      root.querySelector('[data-help-dialog]')?.addEventListener('click', async (event) => {
        const answer = root.querySelector('[data-help-answer]');
        const topic = event.target.closest('[data-help-topic]')?.dataset.helpTopic;
        if (topic === 'status') answer.textContent = labels[currentOrder.status] || orderStatusLabel(currentOrder.status);
        if (topic === 'pickup') answer.textContent = `Presenta la referencia ${currentOrder.code} y el código de retiro ${currentOrder.pickupCode}. No necesitas entregar el teléfono que hizo el pedido.`;
        if (topic === 'payment') answer.innerHTML = `${escapeHtml(paymentLabel(currentOrder))}. ${currentOrder.paymentStatus === 'paid' ? 'No necesitas hacer otra gestión.' : 'Si ya pagaste, solicita una revisión al equipo.'}${currentOrder.paymentStatus !== 'paid' ? '<br><button class="secondary-button" type="button" data-help-request="payment-review">Solicitar revisión del pago</button>' : ''}`;
        const helpRequest = event.target.closest('[data-help-request]');
        if (helpRequest) {
          helpRequest.disabled = true;
          try { await request('/api/service-requests', { method: 'POST', body: JSON.stringify({ orderId: currentOrder.id, type: helpRequest.dataset.helpRequest }) }); answer.textContent = 'Solicitud enviada. El equipo verá la referencia de tu pedido y podrá ayudarte.'; }
          catch (error) { answer.textContent = error.message; helpRequest.disabled = false; }
        }
      });
    }

    root.addEventListener('submit', async (event) => {
      const trackerForm = event.target.closest('[data-track-form]');
      if (!trackerForm) return;
      event.preventDefault();
      const submit = trackerForm.querySelector('button[type="submit"]');
      const feedback = trackerForm.querySelector('[data-track-feedback]');
      const data = new FormData(trackerForm);
      const credentials = { code: String(data.get('code') || '').trim().toUpperCase(), pickupCode: String(data.get('pickupCode') || '').trim() };
      submit.disabled = true; submit.setAttribute('aria-busy', 'true'); feedback.textContent = 'Buscando pedido…';
      try { const recovered = await trackedOrder(credentials); el('[data-tracker-dialog]').close(); renderConfirmation(recovered, credentials); }
      catch (error) { feedback.textContent = `${error.message} Revisa la referencia y el código de cuatro dígitos.`; feedback.dataset.state = 'error'; }
      finally { submit.disabled = false; submit.removeAttribute('aria-busy'); }
    });

    root.addEventListener('input', (event) => {
      if (event.target.matches('[data-order-table]')) {
        event.target.removeAttribute('aria-invalid');
        const feedback = el('[data-order-feedback]');
        feedback.textContent = '';
        delete feedback.dataset.state;
        return;
      }
      if (internalMode && event.target.matches('[data-customer-name], [data-customer-phone]')) {
        event.target.removeAttribute('aria-invalid');
        event.target.removeAttribute('aria-describedby');
        const feedback = el('[data-order-feedback]');
        feedback.textContent = '';
        delete feedback.dataset.state;
        return;
      }
      if (!event.target.matches('[data-search]')) return;
      state.query = event.target.value;
      renderCategories();
      renderProducts();
    });
    root.addEventListener('click', async (event) => {
      const openTables = event.target.closest('[data-open-table-picker]');
      if (openTables) { await openTablePicker(openTables); return; }
      if (event.target.closest('[data-close-table-picker]')) { tablePickerDialog.close(); return; }
      const selectTable = event.target.closest('[data-select-order-table]');
      if (selectTable) { selectOrderTable(Number(selectTable.dataset.selectOrderTable)); return; }
      const claimTable = event.target.closest('[data-claim-order-table]');
      if (claimTable) {
        claimTable.disabled = true;
        tablePickerFeedback.textContent = `Iniciando atención en mesa ${claimTable.dataset.claimOrderTable}…`;
        try {
          await request(`/api/tables/${claimTable.dataset.claimOrderTable}/claim`, { method: 'POST', body: '{}' });
          await refreshTablePicker();
          selectOrderTable(Number(claimTable.dataset.claimOrderTable));
        } catch (error) {
          await refreshTablePicker().catch(() => { claimTable.disabled = false; });
          tablePickerFeedback.textContent = error.message;
          tablePickerFeedback.dataset.state = 'error';
        }
        return;
      }
      const categoryScroll = event.target.closest('[data-category-scroll]');
      if (categoryScroll) {
        const tabs = el('[data-categories]');
        tabs.scrollBy({
          left: Number(categoryScroll.dataset.categoryScroll) * Math.max(220, tabs.clientWidth * .72),
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
        return;
      }
      if (event.target.closest('[data-open-tracker]')) { el('[data-tracker-dialog]').showModal(); return; }
      const category = event.target.closest('[data-category]');
      if (category) {
        state.category = category.dataset.category;
        state.query = '';
        el('[data-search]').value = '';
        renderCategories({ revealActive: true });
        renderProducts();
        if (internalMode) el('.order-category-picker').open = false;
        el('.menu-heading').scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
        return;
      }
      const add = event.target.closest('[data-add]');
      if (add) { openProduct(productById(add.dataset.add)); return; }
      const detail = event.target.closest('[data-detail]');
      if (detail) { openProduct(productById(detail.dataset.detail), true); return; }
      if (event.target.closest('[data-close]')) { event.target.closest('dialog')?.close(); return; }
      const quantity = event.target.closest('[data-quantity]');
      if (quantity) { state.quantity = Math.max(1, Math.min(12, state.quantity + (quantity.dataset.quantity === 'plus' ? 1 : -1))); el('[data-quantity-output]').textContent = state.quantity; return; }
      if (event.target.closest('[data-confirm-item]')) {
        const options = extrasFor(state.selected);
        const selectedIds = [...el('[data-product-dialog]').querySelectorAll('[data-extra]:checked')].map((node) => node.value);
        const destination = channel === 'takeaway' ? 'takeaway' : el('[name="item-destination"]:checked')?.value || 'dine-in';
        const line = { product: state.selected, quantity: state.quantity, destination, extras: options.filter((extra) => selectedIds.includes(extra.id)), note: el('[data-item-note]')?.value.trim() || '' };
        const editingIndex = state.editingIndex;
        if (editingIndex === null) state.cart.push(line);
        else state.cart[editingIndex] = line;
        state.editingIndex = null;
        el('[data-product-dialog]').close(); renderCartDock();
        if (editingIndex !== null && internalMode) el(`[data-edit-line="${editingIndex}"]`)?.focus();
        if (editingIndex !== null && !internalMode) openCart();
        return;
      }
      if (event.target.closest('[data-open-cart]')) { openCart(); return; }
      if (event.target.closest('[data-cart-close]')) { closeCartPanel(); return; }
      const editLine = event.target.closest('[data-edit-line]');
      if (editLine) {
        const index = Number(editLine.dataset.editLine);
        const line = state.cart[index];
        if (!line) return;
        if (!internalMode) el('[data-cart-dialog]').close();
        openProduct(line.product, false, index);
        return;
      }
      const cartQuantity = event.target.closest('[data-cart-quantity]');
      if (cartQuantity) {
        const index = Number(cartQuantity.dataset.line);
        const item = state.cart[index];
        if (item) item.quantity = Math.max(1, Math.min(12, item.quantity + (cartQuantity.dataset.cartQuantity === 'plus' ? 1 : -1)));
        renderCartDock();
        if (!internalMode) openCart();
        const nextControl = el(`[data-cart-quantity="${cartQuantity.dataset.cartQuantity}"][data-line="${index}"]`);
        if (nextControl && !nextControl.disabled) nextControl.focus();
        else el(`[data-cart-quantity][data-line="${index}"]:not(:disabled)`)?.focus();
        return;
      }
      const remove = event.target.closest('[data-remove-line]');
      if (remove) { state.cart.splice(Number(remove.dataset.removeLine), 1); if (!internalMode) el('[data-cart-dialog]').close(); renderCartDock(); if (state.cart.length && !internalMode) openCart(); return; }
      const send = event.target.closest('[data-send-order]');
      if (send) { await sendOrder(send); return; }
      const service = event.target.closest('[data-service]');
      if (service) {
        const feedback = el('[data-service-feedback]');
        service.disabled = true;
        try { await request('/api/service-requests', { method: 'POST', body: JSON.stringify({ table: Number(table), type: service.dataset.service }) }); feedback.textContent = service.dataset.service === 'waiter' ? 'Mesero solicitado. Ya avisamos al equipo.' : 'Solicitud de ayuda enviada.'; feedback.dataset.state = 'success'; }
        catch (error) { feedback.textContent = error.message; feedback.dataset.state = 'error'; service.disabled = false; }
      }
    });

    window.addEventListener('bocc:extras-config', (event) => { extrasConfig = event.detail; });
    if (ordering && !internalMode) {
      let credentials = null;
      const code = queryParams.get('pedido');
      const token = queryParams.get('token');
      const pickupCode = queryParams.get('retiro');
      if (code && (token || pickupCode)) credentials = { code, token: token || '', pickupCode: pickupCode || '' };
      if (!credentials) {
        try { credentials = JSON.parse(localStorage.getItem(trackingStorageKey) || 'null'); } catch { try { localStorage.removeItem(trackingStorageKey); } catch { /* Ignore unavailable storage. */ } }
      }
      if (credentials?.code && (credentials.token || credentials.pickupCode)) {
        try { renderConfirmation(await trackedOrder(credentials), credentials); return; }
        catch { try { localStorage.removeItem(trackingStorageKey); } catch { /* Ignore unavailable storage. */ } }
      }
    }
    if (internalMode) {
      window.addEventListener('resize', syncCartPanel, { passive: true });
      root.addEventListener('keydown', (event) => {
        if (!cartPanelOpen || !compactCart.matches) return;
        if (root.querySelector('dialog[open]')) return;
        if (event.key === 'Escape') { event.preventDefault(); closeCartPanel(); return; }
        if (event.key !== 'Tab') return;
        const controls = [...el('[data-inline-cart]').querySelectorAll('button,input,textarea')].filter((control) => !control.disabled && control.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    } else {
      const categoryTabs = el('[data-categories]');
      categoryTabs.addEventListener('scroll', updateCategoryScrollControls, { passive: true });
      window.addEventListener('resize', updateCategoryScrollControls, { passive: true });
    }
    renderCategories({ revealActive: true }); renderProducts(); renderCartDock();
    if (location.hash === '#menu') requestAnimationFrame(() => el('#menu').scrollIntoView({ block: 'start' }));
  }

  function receipt(order) {
    return `<section class="receipt-print" aria-hidden="true"><h1>BOCCANTINA</h1><h2>${escapeHtml(orderContext(order).toUpperCase())}</h2><p>ORDEN: ${escapeHtml(order.code)}</p>${order.pickupCode && order.items.some((item) => itemDestination(item, order) === 'takeaway') ? `<p>RETIRO: ${escapeHtml(order.pickupCode)}</p>` : ''}<p>${escapeHtml(time(order.createdAt))}</p>${order.customerName ? `<p>CLIENTE: ${escapeHtml(order.customerName)}</p>` : ''}<hr><ul>${order.items.map((item) => `<li><strong>${item.quantity} x ${escapeHtml(item.name)}</strong><small>${destinationLabel(itemDestination(item, order)).toUpperCase()}</small>${item.extras?.map((extra) => `<small>+ ${escapeHtml(extra.name)}</small>`).join('') || ''}${item.note ? `<small>NOTA: ${escapeHtml(item.note)}</small>` : ''}</li>`).join('')}</ul><hr>${order.note ? `<p class="receipt-note">NOTA: ${escapeHtml(order.note)}</p>` : ''}${canOperate('payments.view') ? `<p class="receipt-total"><span>TOTAL</span><span>${money(order.total)}</span></p><p>COBRO: ${escapeHtml(paymentLabel(order).toUpperCase())}</p>` : ''}<hr><p style="text-align:center">${escapeHtml(orderStatusLabel(order.status).toUpperCase())} · COCINA</p></section>`;
  }

  async function initAdmin() {
    const localOrderDemo = !isStaticDemo && adminRole === 'owner' && ['localhost', '127.0.0.1'].includes(location.hostname);
    const demoQueryKey = 'demo-pedidos';
    let demoActive = localOrderDemo && new URLSearchParams(location.search).get(demoQueryKey) === '1';
    const environmentNotice = isStaticDemo
      ? '<strong>Demostración pública aislada:</strong> los datos se guardan únicamente en este navegador. No se comparten con otros dispositivos ni procesan pedidos reales.'
      : '<strong>Preview local privado:</strong> acceso con la cuenta de Boccantina. Los cambios de esta prueba no se publican en la web oficial.';
    root.innerHTML = `<main class="admin-shell">${header({ internal: true })}
      <section class="admin-toolbar"><div><p class="order-eyebrow">Operación diaria</p><h1>${adminRole === 'owner' ? 'Central del restaurante' : adminRoles.includes('waiter') && !adminRoles.includes('cashier') ? 'Mis mesas y pedidos' : 'Pedidos y cobros'}</h1><p>Pedidos y mesas en tiempo real.</p></div><div class="admin-actions"><span class="connection-state" data-connection role="status" aria-live="polite">Actualización automática</span></div></section>
      <p class="admin-alert">${environmentNotice}</p>
      ${adminRoles.includes('waiter') && !adminRoles.some(role => ['cashier','reception'].includes(role)) && !adminAssignedTables.length ? `<p class="admin-alert">Aún no tienes mesas a tu cargo. <a href="${appUrl('/qr-mesas/')}">Ver mesas disponibles</a></p>` : ''}
      <p class="feedback" role="status" aria-live="polite" data-action-feedback></p>
      <section data-service-requests></section>
      <section class="admin-board-section" aria-labelledby="admin-board-title"><div class="admin-section-head"><div><p class="order-eyebrow">Pedidos activos</p><h2 id="admin-board-title">Estado de pedidos</h2></div><div class="admin-board-controls"><p>De la recepción al cobro</p>${localOrderDemo ? `<button class="admin-demo-toggle" type="button" data-demo-toggle aria-pressed="${demoActive}">${demoActive ? 'Desactivar demostración' : 'Mostrar 20 pedidos de prueba'}</button>` : ''}</div></div>${localOrderDemo ? `<p class="admin-demo-note" data-demo-note ${demoActive ? '' : 'hidden'}>Demostración local · 20 pedidos ficticios en este navegador. Las acciones de estos pedidos no se envían al sistema.</p>` : ''}<div class="admin-board" data-board role="group" aria-label="Seleccionar estado de pedidos"></div><div class="admin-order-workspace"><div class="admin-order-workspace__head"><h3 id="admin-order-list-title" data-selected-title>Nuevos</h3><span data-selected-count role="status" aria-live="polite">0 pedidos</span></div><div class="admin-order-list" id="admin-order-list" data-order-list role="region" aria-labelledby="admin-order-list-title"></div></div></section>
      <section class="active-tables" data-active-tables aria-label="Mesas ocupadas"></section>
      ${canOperate('tables.manage') ? '<details class="waiter-management" open><summary><span><small>Equipo de sala</small><strong>Meseros</strong></span><span class="waiter-management__summary"><span data-waiter-count aria-live="polite">0 integrantes</span><span aria-hidden="true">⌄</span></span></summary><div class="waiter-management__body"><p>Personal disponible para asignar desde cada mesa activa.</p><ul class="staff-list" data-waiters></ul><form class="compact-form" data-waiter-form novalidate><label for="waiter-name">Nombre del mesero<input id="waiter-name" name="name" required minlength="2" autocomplete="off" aria-describedby="waiter-name-error"><span class="waiter-form-error" id="waiter-name-error" data-waiter-error role="alert" hidden></span></label><button class="secondary-button" type="submit">Agregar mesero</button></form></div></details>' : ''}<div data-receipt></div></main>`;
    let known = new Set();
    const lastColumnSignatures = new Map();
    const statusOrders = new Map();
    let selectedStatus = 'pending';
    let renderedSignature = '';
    let lastRequestsSignature = '';
    let lastTablesSignature = '';
    let lastOperationsSignature = '';
    let refreshSequence = 0;
    let liveOrders = [];
    const statuses = [
      { id: 'pending', label: 'Nuevos' }, { id: 'confirmed', label: 'Confirmados' }, { id: 'preparing', label: 'En cocina' }, { id: 'ready', label: 'Listos' }, { id: 'payment-due', label: 'Por cobrar' }
    ];
    // Estos pedidos existen únicamente en memoria y nunca se envían a la API.
    function createDemoOrders() {
      const dishes = [
        ['Pasta al Funghi', 10950], ['Hamburguesa Bocca', 8950], ['Papas Trufadas', 4850],
        ['Choripán de Cordero', 5850], ['Calamar Frito', 6800], ['Ensalada de la Casa', 6200]
      ];
      const stages = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
      const now = Date.now();
      return Array.from({ length: 20 }, (_, index) => {
        const items = Array.from({ length: 1 + (index % 4) }, (_, itemIndex) => {
          const [name, unitPrice] = dishes[(index + itemIndex) % dishes.length];
          return { productId: `demo-product-${(index + itemIndex) % dishes.length}`, name, quantity: index % 5 === 0 && itemIndex === 0 ? 2 : 1, unitPrice, note: itemIndex === 1 && index % 3 === 0 ? 'Sin cebolla' : '', extras: [] };
        });
        const channel = index % 4 === 0 ? 'takeaway' : index % 4 === 1 ? 'counter' : 'table';
        const createdAt = new Date(now - (20 - index) * 3 * 60_000).toISOString();
        return {
          id: `demo-order-${String(index + 1).padStart(3, '0')}`, code: `DEMO-${String(index + 1).padStart(3, '0')}`,
          channel, table: channel === 'table' ? (index % 12) + 1 : null,
          customerName: channel === 'table' ? '' : `Cliente de prueba ${index + 1}`, phone: '',
          pickupCode: String(4100 + index), items, total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
          note: index % 7 === 0 ? 'Pedido de demostración' : '', status: stages[index % stages.length],
          paymentStatus: 'unpaid', paymentMethod: null, paidAt: null, createdAt, updatedAt: createdAt
        };
      });
    }
    let demoOrders = demoActive ? createDemoOrders() : [];
    root.querySelector('[data-board]').innerHTML = statuses.map((status) => `<button class="admin-column" type="button" data-column="${status.id}" data-order-status="${status.id}" aria-pressed="${status.id === selectedStatus}" aria-controls="admin-order-list"><span class="admin-column__head"><span class="admin-column__label">${status.label}</span><span data-column-count>0</span></span></button>`).join('');
    function elapsedLabel(value) {
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
      if (!Number.isFinite(minutes)) return time(value);
      if (minutes < 1) return 'Ahora';
      if (minutes < 60) return `Hace ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} h`;
      return `Hace ${Math.floor(hours / 24)} d`;
    }
    function refreshElapsedTimes() {
      root.querySelectorAll('[data-order-list] .order-row__age').forEach((node) => {
        const fullTime = time(node.dateTime);
        const label = elapsedLabel(node.dateTime);
        if (node.textContent !== label) node.textContent = label;
        node.setAttribute('aria-label', `${label}; creado el ${fullTime}`);
      });
    }
    function card(order) {
      const next = ({ pending: ['confirmed', 'Confirmar'], confirmed: ['preparing', 'Enviar a cocina'], preparing: ['ready', 'Marcar listo'], ready: ['delivered', 'Entregado'] })[order.status];
      const paid = order.paymentStatus === 'paid';
      const products = order.items.reduce((count, item) => count + Number(item.quantity || 0), 0);
      const visibleStatus = order.status === 'delivered' && !paid ? 'Por cobrar' : orderStatusLabel(order.status);
      const fullTime = time(order.createdAt);
      const elapsed = elapsedLabel(order.createdAt);
      return `<details class="order-card order-row ${order.status === 'pending' ? 'is-new' : ''}" data-order-card="${escapeHtml(order.id)}" data-order-stage="${order.status === 'delivered' ? 'payment-due' : escapeHtml(order.status)}">
        <summary class="order-row__summary"><strong>${escapeHtml(order.code)}</strong><span>${escapeHtml(orderContext(order))}</span><span>${products} ${products === 1 ? 'producto' : 'productos'}</span><time class="order-row__age" datetime="${escapeHtml(order.createdAt)}" title="${escapeHtml(fullTime)}" aria-label="${escapeHtml(`${elapsed}; creado el ${fullTime}`)}">${escapeHtml(elapsed)}</time><span class="order-row__status">${escapeHtml(visibleStatus)}</span><span class="order-row__expand" aria-hidden="true">Ver<span class="order-row__chevron"></span></span></summary>
        <div class="order-row__details">
          <div class="order-row__details-inner">
            <div class="order-row__meta">
              <p class="order-row__timestamp"><small>Fecha y hora</small><time datetime="${escapeHtml(order.createdAt)}">${escapeHtml(fullTime)}</time></p>
              ${order.customerName ? `<p class="order-card__customer"><small>Cliente</small><strong>${escapeHtml(order.customerName)}</strong>${order.phone ? `<span>${escapeHtml(order.phone)}</span>` : ''}</p>` : ''}
              ${order.items.some((item) => itemDestination(item, order) === 'takeaway') ? `<p class="pickup-verification"><small>Código de retiro</small><strong>${escapeHtml(order.pickupCode)}</strong></p>` : ''}
            </div>
            <div class="order-row__contents">
              <h4>Productos</h4>
              <ul>${order.items.map((item) => orderItemDetails(item, order)).join('')}</ul>
              ${order.note ? `<p class="order-row__note"><strong>Observación del pedido</strong><span>${escapeHtml(order.note)}</span></p>` : ''}
            </div>
            <div class="order-row__settlement">
              ${canOperate('payments.view') ? `<div class="order-card__total"><span>Total</span><span>${money(order.total)}</span></div><section class="payment-control" data-payment-state="${paid ? 'paid' : 'unpaid'}"><div><small>Estado de cobro</small><strong>${escapeHtml(paymentLabel(order))}</strong></div>${paid ? (canOperate('payments.refund') ? `<button class="secondary-button" type="button" data-payment-action="unpaid" data-order="${order.id}">Corregir a pendiente</button>` : '') : (canOperate('payments.collect') ? `<label>Método<select name="payment-method-${escapeHtml(order.id)}" data-payment-method="${order.id}"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="sinpe">SINPE</option><option value="other">Otro</option></select></label><button class="primary-button" type="button" data-payment-action="paid" data-order="${order.id}">Registrar pago</button>` : '')}</section>` : ''}
              <div class="order-card__buttons">${next && canOperate(['preparing','ready'].includes(next[0]) ? 'kitchen.update' : 'orders.edit') ? `<button class="primary-button" type="button" data-status="${next[0]}" data-order="${order.id}">${next[1]}</button>` : ''}${['pending','confirmed'].includes(order.status) && canOperate('orders.cancel') ? `<button class="secondary-button" type="button" data-status="cancelled" data-order="${order.id}">Cancelar pedido</button>` : ''}${['pending','confirmed'].includes(order.status) && adminRoles.includes('waiter') && !canOperate('orders.cancel') ? `<button class="secondary-button" type="button" data-service-order="cancel-request" data-order="${order.id}">Solicitar cancelación</button>` : ''}${adminRoles.includes('waiter') ? `<button class="secondary-button" type="button" data-service-order="staff-help" data-order="${order.id}">Solicitar ayuda</button>` : ''}${canOperate('payments.view') ? `<button class="secondary-button" type="button" data-print="${order.id}" ${order.status === 'pending' ? 'disabled title="Confirma el pedido antes de imprimir"' : ''}>Imprimir</button>` : ''}</div>
            </div>
          </div>
        </div>
      </details>`;
    }

    function renderSelectedOrders({ force = false } = {}) {
      const list = statusOrders.get(selectedStatus) || [];
      const signature = lastColumnSignatures.get(selectedStatus) || '[]';
      const status = statuses.find((item) => item.id === selectedStatus);
      root.querySelector('[data-selected-title]').textContent = status.label;
      const count = `${list.length} ${list.length === 1 ? 'pedido' : 'pedidos'}`;
      const countNode = root.querySelector('[data-selected-count]');
      if (countNode.textContent !== count) countNode.textContent = count;
      if (!force && signature === renderedSignature) return;
      const container = root.querySelector('[data-order-list]');
      const openIds = new Set([...container.querySelectorAll('[data-order-card][open]')].map((item) => item.dataset.orderCard));
      const focused = container.contains(document.activeElement) ? document.activeElement.closest('[data-order-card]')?.dataset.orderCard : null;
      container.innerHTML = list.length ? list.map(card).join('') : '<p class="admin-empty">No hay pedidos en este estado.</p>';
      container.querySelectorAll('[data-order-card]').forEach((item) => { if (openIds.has(item.dataset.orderCard)) item.open = true; });
      if (focused) (container.querySelector(`[data-order-card="${CSS.escape(focused)}"] summary`) || root.querySelector(`[data-order-status="${selectedStatus}"]`)).focus({ preventScroll: true });
      renderedSignature = signature;
    }

    function updateBoard(orders) {
      const active = orders.filter((order) => order.status !== 'cancelled' && (order.status !== 'delivered' || order.paymentStatus !== 'paid'));
      statuses.forEach((status) => {
        const list = active.filter((order) => status.id === 'payment-due' ? order.status === 'delivered' && order.paymentStatus !== 'paid' : order.status === status.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const signature = JSON.stringify(list.map((order) => [order.id, order.status, order.paymentStatus, order.updatedAt]));
        if (signature === lastColumnSignatures.get(status.id)) return;
        statusOrders.set(status.id, list);
        root.querySelector(`[data-column="${status.id}"] [data-column-count]`).textContent = list.length;
        lastColumnSignatures.set(status.id, signature);
      });
      renderSelectedOrders();
      refreshElapsedTimes();
      root.dataset.orders = JSON.stringify(orders);
    }

    function setDemoActive(active) {
      if (!localOrderDemo) return;
      demoActive = active;
      if (active) demoOrders = createDemoOrders();
      const url = new URL(location.href);
      if (active) url.searchParams.set(demoQueryKey, '1');
      else url.searchParams.delete(demoQueryKey);
      history.replaceState(history.state, '', url);
      const button = root.querySelector('[data-demo-toggle]');
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'Desactivar demostración' : 'Mostrar 20 pedidos de prueba';
      root.querySelector('[data-demo-note]').hidden = !active;
      updateBoard(active ? demoOrders : liveOrders);
    }

    async function refresh({ silent = false } = {}) {
      const sequence = ++refreshSequence;
      try {
        const [{ orders }, { requests }, { tables }, { waiters }, { reservations }] = await Promise.all([request('/api/orders'), request('/api/service-requests'), request('/api/tables?count=100'), request('/api/waiters'), canOperate('reservations.view') ? request('/api/reservations') : Promise.resolve({ reservations:[] })]);
        if (sequence !== refreshSequence) return;
        const indicator = root.querySelector('[data-connection]');
        indicator.classList.remove('is-error');
        if (indicator.textContent !== 'Actualización automática') indicator.textContent = 'Actualización automática';
        liveOrders = orders;
        updateBoard(demoActive ? demoOrders : liveOrders);
        const pendingRequests = requests.filter((item) => item.status === 'pending');
        const requestsSignature = JSON.stringify(pendingRequests.map((item) => [item.id, item.status, item.type]));
        if (requestsSignature !== lastRequestsSignature) {
          root.querySelector('[data-service-requests]').innerHTML = pendingRequests.length ? `<div class="admin-alert"><strong>Solicitudes de ayuda:</strong> ${pendingRequests.map((item) => `<button class="secondary-button" style="margin:6px" type="button" data-resolve-request="${item.id}">${escapeHtml(item.orderCode || (item.table ? `Mesa ${item.table}` : 'Pedido'))} · ${item.type === 'cancel-request' ? 'solicitud de cancelación' : item.type === 'staff-help' ? 'asistencia del mesero' : item.type === 'payment-review' ? 'revisar pago' : item.type === 'waiter' ? 'llamar mesero' : 'ayuda'}</button>`).join('')}</div>` : '';
          lastRequestsSignature = requestsSignature;
        }
        const occupiedTables = tables.filter((item) => item.status === 'occupied');
        const tablesSignature = JSON.stringify([occupiedTables.map((item) => [item.table, item.activeOrders, item.unpaidOrders, item.totalOrders, item.canRelease, item.updatedAt, item.waiterId]), waiters.map((item) => [item.id, item.name])]);
        if (tablesSignature !== lastTablesSignature) {
          root.querySelector('[data-active-tables]').innerHTML = occupiedTables.length ? `<div class="active-tables__head"><div><p class="order-eyebrow">Estado del salón</p><h2>Mesas activas</h2></div><span>${occupiedTables.length} ${occupiedTables.length === 1 ? 'ocupada' : 'ocupadas'}</span></div><div class="active-tables__grid">${occupiedTables.map((item) => `<article class="active-table"><div><strong>Mesa ${item.table}</strong><small>${item.activeOrders ? `${item.activeOrders} pedido${item.activeOrders === 1 ? '' : 's'} activo${item.activeOrders === 1 ? '' : 's'}` : item.unpaidOrders ? 'Consumo finalizado · pago pendiente' : item.totalOrders ? 'Cuenta pagada · cliente aún en la mesa' : 'Sesión abierta · todavía sin pedido'}</small>${canOperate('tables.assign') ? `<label>Mesero asignado<select data-assign-waiter="${item.table}"><option value="">Sin asignar</option>${waiters.filter(waiter => waiter.active && waiter.authorized).map((waiter) => `<option value="${waiter.id}" ${item.waiterId === waiter.id ? 'selected' : ''}>${escapeHtml(waiter.name)}</option>`).join('')}</select></label>` : ''}</div>${canOperate('tables.release') ? `<button class="secondary-button" type="button" data-release-table="${item.table}" ${item.canRelease ? '' : 'disabled title="Finaliza los pedidos y registra el pago antes de liberar"'}>${item.canRelease ? (item.totalOrders ? 'Cliente se retiró · liberar' : 'Cerrar sesión de mesa') : item.unpaidOrders ? 'Pago pendiente' : 'Finaliza los pedidos'}</button>` : ''}</article>`).join('')}</div>` : '';
          lastTablesSignature = tablesSignature;
        }
        const activeReservations = reservations.filter((item) => !['cancelled', 'completed'].includes(item.status));
        const reservationCount = root.querySelector('[data-reservation-nav-count]');
        if (reservationCount) { reservationCount.textContent = activeReservations.length; reservationCount.setAttribute('aria-label', `${activeReservations.length} reservaciones activas`); }
        const operationsSignature = JSON.stringify(waiters.map((item) => [item.id, item.name]));
        if (canOperate('tables.manage') && operationsSignature !== lastOperationsSignature) {
          root.querySelector('[data-waiter-count]').textContent = `${waiters.length} ${waiters.length === 1 ? 'integrante' : 'integrantes'}`;
          root.querySelector('[data-waiters]').innerHTML = waiters.length ? waiters.map((waiter) => `<li class="staff-row"><span>${escapeHtml(waiter.name)}</span><button type="button" data-remove-waiter="${waiter.id}" aria-label="Quitar a ${escapeHtml(waiter.name)}">Quitar</button></li>`).join('') : '<li class="staff-list__empty">Aún no hay meseros registrados.</li>';
          lastOperationsSignature = operationsSignature;
        }
        const liveActive = orders.filter((order) => order.status !== 'cancelled' && (order.status !== 'delivered' || order.paymentStatus !== 'paid'));
        if (!demoActive && !silent && liveActive.some((order) => !known.has(order.id))) document.title = '● Nuevo pedido — Boccantina';
        known = new Set(liveActive.map((order) => order.id));
      } catch (error) {
        if (sequence !== refreshSequence) return;
        const indicator = root.querySelector('[data-connection]'); indicator.classList.add('is-error');
        if (indicator.textContent !== error.message) indicator.textContent = error.message;
      }
    }

    root.addEventListener('click', async (event) => {
      if (event.target.closest('[data-demo-toggle]')) { setDemoActive(!demoActive); return; }
      const selected = event.target.closest('[data-order-status]');
      if (selected) {
        if (selected.dataset.orderStatus !== selectedStatus) {
          selectedStatus = selected.dataset.orderStatus;
          root.querySelectorAll('[data-order-status]').forEach((item) => { item.setAttribute('aria-pressed', String(item === selected)); });
          renderSelectedOrders({ force: true });
        }
        return;
      }
      const status = event.target.closest('[data-status]');
      if (status) {
        if (status.dataset.status === 'cancelled' && !window.confirm('¿Cancelar este pedido? Esta acción quedará registrada.')) return;
        if (demoActive) {
          const order = demoOrders.find((item) => item.id === status.dataset.order);
          if (order) { order.status = status.dataset.status; order.updatedAt = new Date().toISOString(); updateBoard(demoOrders); }
          return;
        }
        status.disabled = true;
        try { await request(`/api/orders/${encodeURIComponent(status.dataset.order)}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.status }) }); await refresh({ silent: true }); }
        catch (error) { window.alert(error.message); status.disabled = false; }
        return;
      }
      const serviceOrder = event.target.closest('[data-service-order]');
      if (serviceOrder) {
        if (serviceOrder.dataset.serviceOrder === 'cancel-request' && !window.confirm('¿Solicitar la cancelación de este pedido? Un responsable deberá revisarla.')) return;
        serviceOrder.disabled = true;
        try {
          await request('/api/service-requests', { method:'POST', body:JSON.stringify({ orderId:serviceOrder.dataset.order, type:serviceOrder.dataset.serviceOrder }) });
          root.querySelector('[data-action-feedback]').textContent = serviceOrder.dataset.serviceOrder === 'cancel-request' ? 'Solicitud de cancelación enviada al responsable.' : 'Solicitud de ayuda enviada.';
          await refresh({ silent:true });
        } catch (error) { root.querySelector('[data-action-feedback]').textContent = error.message; serviceOrder.disabled = false; }
        return;
      }
      const payment = event.target.closest('[data-payment-action]');
      if (payment) {
        if (demoActive) {
          const order = demoOrders.find((item) => item.id === payment.dataset.order);
          if (order) {
            const paid = payment.dataset.paymentAction === 'paid';
            order.paymentStatus = paid ? 'paid' : 'unpaid';
            order.paymentMethod = paid ? root.querySelector(`[data-payment-method="${CSS.escape(order.id)}"]`)?.value || 'cash' : null;
            order.paidAt = paid ? new Date().toISOString() : null;
            order.updatedAt = new Date().toISOString();
            updateBoard(demoOrders);
          }
          return;
        }
        payment.disabled = true; payment.setAttribute('aria-busy', 'true');
        const paymentMethod = payment.dataset.paymentAction === 'paid' ? root.querySelector(`[data-payment-method="${CSS.escape(payment.dataset.order)}"]`)?.value : '';
        try { await request(`/api/orders/${encodeURIComponent(payment.dataset.order)}/payment`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: payment.dataset.paymentAction, paymentMethod }) }); await refresh({ silent: true }); }
        catch (error) { window.alert(error.message); payment.disabled = false; payment.removeAttribute('aria-busy'); }
        return;
      }
      const print = event.target.closest('[data-print]');
      if (print) { const orders = JSON.parse(root.dataset.orders || '[]'); const order = orders.find((item) => item.id === print.dataset.print); if (!order || order.status === 'pending') return; root.querySelector('[data-receipt]').innerHTML = receipt(order); window.print(); return; }
      const resolve = event.target.closest('[data-resolve-request]');
      if (resolve) { await request(`/api/service-requests/${encodeURIComponent(resolve.dataset.resolveRequest)}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }); await refresh({ silent: true }); return; }
      const release = event.target.closest('[data-release-table]');
      if (release) {
        release.disabled = true;
        try { await request(`/api/tables/${encodeURIComponent(release.dataset.releaseTable)}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) }); await refresh({ silent: true }); }
        catch (error) { window.alert(error.message); release.disabled = false; }
        return;
      }
      const removeWaiter = event.target.closest('[data-remove-waiter]');
      if (removeWaiter) {
        const name = removeWaiter.closest('.staff-row')?.querySelector('span')?.textContent || 'este mesero';
        if (!window.confirm(`¿Quitar a ${name} del equipo de sala?`)) return;
        const row = removeWaiter.closest('.staff-row');
        const nextId = (row.nextElementSibling || row.previousElementSibling)?.querySelector('[data-remove-waiter]')?.dataset.removeWaiter;
        removeWaiter.disabled = true;
        try {
          await request(`/api/waiters/${encodeURIComponent(removeWaiter.dataset.removeWaiter)}`, { method: 'DELETE' });
          await refresh({ silent: true });
          const nextControl = nextId ? root.querySelector(`[data-remove-waiter="${nextId}"]`) : null;
          (nextControl || root.querySelector('.waiter-management summary')).focus();
        }
        catch (error) { window.alert(error.message); removeWaiter.disabled = false; }
      }
    });
    root.addEventListener('change', async (event) => {
      const assignment = event.target.closest('[data-assign-waiter]');
      if (!assignment) return;
      assignment.disabled = true;
      try { await request(`/api/tables/${encodeURIComponent(assignment.dataset.assignWaiter)}/assignment`, { method: 'PUT', body: JSON.stringify({ waiterId: assignment.value }) }); await refresh({ silent: true }); }
      catch (error) { window.alert(error.message); }
      finally { assignment.disabled = false; }
    });
    root.addEventListener('input', (event) => {
      if (!event.target.matches('[data-waiter-form] input[name="name"]')) return;
      event.target.removeAttribute('aria-invalid');
      const error = root.querySelector('[data-waiter-error]');
      error.hidden = true;
      error.textContent = '';
    });
    root.addEventListener('submit', async (event) => {
      const waiterForm = event.target.closest('[data-waiter-form]');
      if (!waiterForm) return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const input = waiterForm.elements.name;
      const errorMessage = waiterForm.querySelector('[data-waiter-error]');
      const name = String(data.name || '').trim();
      if (name.length < 2) {
        errorMessage.textContent = name ? 'El nombre debe tener al menos 2 caracteres.' : 'Escribe el nombre del mesero.';
        errorMessage.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      const button = event.target.querySelector('button[type="submit"]'); button.disabled = true;
      try {
        await request('/api/waiters', { method: 'POST', body: JSON.stringify(data) });
        event.target.reset();
        await refresh({ silent: true });
      } catch (error) {
        errorMessage.textContent = error.message || 'No se pudo agregar el mesero.';
        errorMessage.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      } finally { button.disabled = false; }
    });
    if (demoActive) updateBoard(demoOrders);
    await refresh({ silent: true });
    window.setInterval(() => refresh(), 3000);
  }

  async function initReservations() {
    root.innerHTML = `<main class="admin-shell reservation-page">${header({ internal: true, centralLink: true })}
      <section class="reservation-page-hero">
        <div><p class="order-eyebrow">Agenda del restaurante</p><h1>Reservaciones</h1><p>Centraliza solicitudes, confirma cada visita y asigna la mesa desde una agenda dedicada.</p></div>
        <div class="admin-actions"><span class="connection-state" data-connection>Actualización automática</span><button class="secondary-button" type="button" data-refresh>Actualizar</button></div>
      </section>
      <div class="admin-alert"><strong>Flujo recomendado:</strong> registra o recibe la solicitud, asigna una mesa disponible y luego confirma la reservación.</div>
      <section class="reservation-summary" aria-label="Resumen de reservaciones">
        <article><small>Reservaciones activas</small><strong data-reservation-stat="active">0</strong><span>Pendientes, confirmadas y en mesa</span></article>
        <article><small>Requieren atención</small><strong data-reservation-stat="pending">0</strong><span>Pendientes de confirmar</span></article>
        <article><small>Sin mesa</small><strong data-reservation-stat="unassigned">0</strong><span>Necesitan asignación</span></article>
        <article><small>Confirmadas</small><strong data-reservation-stat="confirmed">0</strong><span>Visitas preparadas</span></article>
        <article><small>En mesa</small><strong data-reservation-stat="seated">0</strong><span>Clientes que ya llegaron</span></article>
      </section>
      <section class="reservation-page-grid">
        <aside class="operations-panel reservation-create-panel">
          <header><p class="order-eyebrow">Nueva reservación</p><h2>Registrar solicitud</h2><p>Para llamadas, WhatsApp o clientes que visitan el restaurante.</p></header>
          <form class="reservation-admin-form reservation-admin-form--stacked" data-reservation-form>
            <label>Fecha<input name="date" type="date" required></label>
            <label>Hora<input name="time" type="time" required></label>
            <label>Personas<input name="guests" type="number" min="1" max="40" required></label>
            <label>Nombre<input name="name" required minlength="2" autocomplete="name"></label>
            <label>Teléfono<input name="phone" type="tel" required autocomplete="tel"></label>
            <label>Origen<select name="source"><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option><option value="walk-in">Presencial</option><option value="manual">Otro medio</option></select></label>
            <label class="reservation-admin-form__wide">Notas<textarea name="preferences" rows="3" placeholder="Preferencias, celebración o necesidad especial"></textarea></label>
            <button class="primary-button reservation-submit" type="submit">Crear reservación manual</button>
            <p class="feedback" data-reservation-form-feedback role="status" aria-live="polite"></p>
          </form>
          <div class="reservation-page-note">${iconCalendar}<div><strong>La mesa se asigna después</strong><p>Así administración revisa la disponibilidad y evita que dos reservas ocupen la misma mesa y horario.</p></div></div>
        </aside>
        <section class="operations-panel reservation-agenda-panel" aria-labelledby="reservation-agenda-title">
          <header class="reservation-agenda-header"><div><p class="order-eyebrow">Agenda unificada</p><h2 id="reservation-agenda-title">Agenda y seguimiento</h2><p>Las reservaciones operativas se mantienen separadas del historial.</p></div><span data-reservation-list-count>0 activas</span></header>
          <nav class="reservation-view-tabs" aria-label="Filtrar reservaciones">
            <button type="button" data-reservation-view="active" aria-pressed="true">Activas <span data-reservation-view-count="active">0</span></button>
            <button type="button" data-reservation-view="history" aria-pressed="false">Historial <span data-reservation-view-count="history">0</span></button>
          </nav>
          <p class="reservation-page-feedback" data-reservation-page-feedback role="status" aria-live="polite"></p>
          <div class="reservation-list" data-reservations aria-live="polite"></div>
        </section>
      </section>
      <dialog class="order-dialog reservation-edit-dialog" data-reservation-edit-dialog>
        <header class="dialog-header"><div><h2>Modificar reservación</h2><p data-edit-reservation-code></p></div><button class="dialog-close" type="button" data-close-reservation-dialog aria-label="Cerrar">×</button></header>
        <form class="dialog-body reservation-edit-form" data-reservation-edit-form>
          <input type="hidden" name="id">
          <div class="reservation-edit-grid">
            <label class="field">Fecha<input name="date" type="date" required></label>
            <label class="field">Hora<input name="time" type="time" required></label>
            <label class="field">Personas<input name="guests" type="number" min="1" max="40" required></label>
            <label class="field">Nombre<input name="name" required minlength="2" autocomplete="name"></label>
            <label class="field">Teléfono<input name="phone" type="tel" required autocomplete="tel"></label>
            <label class="field">Origen<select name="source"><option value="web">Web</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option><option value="walk-in">Presencial</option><option value="manual">Otro medio</option></select></label>
            <label class="field reservation-edit-grid__wide">Notas<textarea name="preferences" rows="3"></textarea></label>
          </div>
          <p class="feedback" data-reservation-edit-feedback role="status" aria-live="polite"></p>
          <div class="dialog-actions"><button class="secondary-button" type="button" data-close-reservation-dialog>Descartar cambios</button><button class="primary-button" type="submit">Guardar cambios</button></div>
        </form>
      </dialog>
      <dialog class="order-dialog reservation-confirm-dialog" data-reservation-confirm-dialog>
        <header class="dialog-header"><div><h2 data-confirm-reservation-title>Confirmar acción</h2><p data-confirm-reservation-code></p></div><button class="dialog-close" type="button" data-close-reservation-dialog aria-label="Cerrar">×</button></header>
        <div class="dialog-body"><p data-confirm-reservation-message></p><p class="feedback" data-confirm-reservation-feedback role="status" aria-live="polite"></p><div class="dialog-actions"><button class="secondary-button" type="button" data-close-reservation-dialog>Volver</button><button class="danger-button" type="button" data-confirm-reservation-action>Confirmar</button></div></div>
      </dialog>
    </main>`;

    const dateInput = root.querySelector('[name="date"]');
    dateInput.min = new Intl.DateTimeFormat('en-CA').format(new Date());
    root.querySelector('[data-reservation-edit-form] [name="date"]').min = dateInput.min;
    let lastSignature = '';
    let reservationState = [];
    let reservationView = 'active';

    async function refresh() {
      try {
        const { reservations } = await request('/api/reservations');
        reservationState = reservations;
        const active = reservations.filter((item) => !['cancelled', 'completed'].includes(item.status));
        const history = reservations.filter((item) => ['cancelled', 'completed'].includes(item.status));
        const visible = reservationView === 'history'
          ? [...history].sort((first, second) => String(second.updatedAt).localeCompare(String(first.updatedAt)))
          : [...active].sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`));
        const pending = active.filter((item) => item.status === 'pending');
        const confirmed = active.filter((item) => item.status === 'confirmed');
        const unassigned = active.filter((item) => !item.table);
        const seated = active.filter((item) => item.status === 'seated');
        root.querySelector('[data-connection]').classList.remove('is-error');
        root.querySelector('[data-connection]').textContent = 'Actualización automática';
        root.querySelector('[data-reservation-stat="active"]').textContent = active.length;
        root.querySelector('[data-reservation-stat="pending"]').textContent = pending.length;
        root.querySelector('[data-reservation-stat="unassigned"]').textContent = unassigned.length;
        root.querySelector('[data-reservation-stat="confirmed"]').textContent = confirmed.length;
        root.querySelector('[data-reservation-stat="seated"]').textContent = seated.length;
        root.querySelector('[data-reservation-view-count="active"]').textContent = active.length;
        root.querySelector('[data-reservation-view-count="history"]').textContent = history.length;
        root.querySelector('[data-reservation-list-count]').textContent = reservationView === 'history'
          ? `${history.length} en historial`
          : `${active.length} ${active.length === 1 ? 'activa' : 'activas'}`;
        document.title = pending.length ? `${pending.length} pendiente${pending.length === 1 ? '' : 's'} · Reservaciones — Boccantina` : 'Reservaciones — Boccantina';
        const signature = JSON.stringify([reservationView, visible.map((item) => [item.id, item.status, item.table, item.updatedAt])]);
        if (signature !== lastSignature) {
          const empty = reservationView === 'history'
            ? '<div class="reservation-empty"><strong>Historial limpio</strong><p>No hay reservaciones canceladas o cumplidas.</p></div>'
            : '<div class="reservation-empty"><strong>Agenda disponible</strong><p>No hay reservaciones activas.</p></div>';
          root.querySelector('[data-reservations]').innerHTML = visible.length ? visible.map((item) => reservationCard(item, reservations)).join('') : empty;
          lastSignature = signature;
        }
      } catch (error) {
        const indicator = root.querySelector('[data-connection]');
        indicator.classList.add('is-error');
        indicator.textContent = error.message;
      }
    }

    root.addEventListener('click', async (event) => {
      if (event.target.closest('[data-refresh]')) { await refresh(); return; }
      if (event.target.closest('[data-close-reservation-dialog]')) { event.target.closest('dialog')?.close(); return; }
      const viewTrigger = event.target.closest('[data-reservation-view]');
      if (viewTrigger) {
        reservationView = viewTrigger.dataset.reservationView;
        root.querySelectorAll('[data-reservation-view]').forEach((button) => button.setAttribute('aria-pressed', String(button === viewTrigger)));
        lastSignature = '';
        await refresh();
        return;
      }
      const editReservation = event.target.closest('[data-edit-reservation]');
      if (editReservation) {
        const item = reservationState.find((reservation) => reservation.id === editReservation.dataset.editReservation);
        if (!item) return;
        const dialog = root.querySelector('[data-reservation-edit-dialog]');
        const form = dialog.querySelector('[data-reservation-edit-form]');
        for (const field of ['id', 'date', 'time', 'guests', 'name', 'phone', 'source', 'preferences']) if (form.elements[field]) form.elements[field].value = item[field] || '';
        dialog.querySelector('[data-edit-reservation-code]').textContent = `${item.code} · ${item.name}`;
        dialog.querySelector('[data-reservation-edit-feedback]').textContent = '';
        dialog.showModal();
        form.elements.date.focus();
        return;
      }
      const confirmTrigger = event.target.closest('[data-cancel-reservation], [data-release-reservation], [data-delete-reservation]');
      if (confirmTrigger) {
        const id = confirmTrigger.dataset.cancelReservation || confirmTrigger.dataset.releaseReservation || confirmTrigger.dataset.deleteReservation;
        const item = reservationState.find((reservation) => reservation.id === id);
        if (!item) return;
        const action = confirmTrigger.hasAttribute('data-delete-reservation') ? 'delete'
          : confirmTrigger.hasAttribute('data-cancel-reservation') ? 'cancelled' : 'completed';
        const dialog = root.querySelector('[data-reservation-confirm-dialog]');
        const confirmButton = dialog.querySelector('[data-confirm-reservation-action]');
        dialog.dataset.reservation = id;
        dialog.dataset.action = action;
        dialog.querySelector('[data-confirm-reservation-code]').textContent = `${item.code} · ${item.name}`;
        dialog.querySelector('[data-confirm-reservation-title]').textContent = action === 'delete' ? 'Eliminar registro del historial' : action === 'cancelled' ? 'Cancelar reservación' : 'Completar visita y liberar mesa';
        dialog.querySelector('[data-confirm-reservation-message]').textContent = action === 'delete'
          ? 'Este registro se eliminará definitivamente. Esta acción no se puede deshacer.'
          : action === 'cancelled' ? 'La reservación quedará cancelada y su mesa volverá a estar disponible para ese horario.' : `Se marcará la visita como cumplida y se liberará la mesa ${item.table}. Si existen pedidos activos o pagos pendientes, el sistema impedirá la liberación.`;
        dialog.querySelector('[data-confirm-reservation-feedback]').textContent = '';
        confirmButton.textContent = action === 'delete' ? 'Sí, eliminar' : action === 'cancelled' ? 'Sí, cancelar' : 'Liberar mesa';
        confirmButton.className = ['delete', 'cancelled'].includes(action) ? 'danger-button' : 'primary-button';
        dialog.showModal();
        confirmButton.focus();
        return;
      }
      const confirmAction = event.target.closest('[data-confirm-reservation-action]');
      if (confirmAction) {
        const dialog = root.querySelector('[data-reservation-confirm-dialog]');
        const action = dialog.dataset.action;
        const feedback = dialog.querySelector('[data-confirm-reservation-feedback]');
        confirmAction.disabled = true;
        confirmAction.setAttribute('aria-busy', 'true');
        try {
          await request(`/api/reservations/${encodeURIComponent(dialog.dataset.reservation)}`, action === 'delete'
            ? { method: 'DELETE' }
            : { method: 'PATCH', body: JSON.stringify({ status: action }) });
          dialog.close();
          root.querySelector('[data-reservation-page-feedback]').textContent = action === 'delete' ? 'Registro eliminado del historial.' : action === 'cancelled' ? 'Reservación cancelada y mesa liberada correctamente.' : 'Visita cumplida y mesa liberada correctamente.';
          await refresh();
        } catch (error) { feedback.textContent = error.message; feedback.dataset.state = 'error'; }
        finally { confirmAction.disabled = false; confirmAction.removeAttribute('aria-busy'); }
        return;
      }
      const reservationStatus = event.target.closest('[data-reservation-status]');
      if (reservationStatus) {
        reservationStatus.disabled = true;
        try {
          await request(`/api/reservations/${encodeURIComponent(reservationStatus.dataset.reservation)}`, { method: 'PATCH', body: JSON.stringify({ status: reservationStatus.dataset.reservationStatus }) });
          root.querySelector('[data-reservation-page-feedback]').textContent = reservationStatus.dataset.reservationStatus === 'seated' ? 'Llegada registrada. La mesa ahora aparece ocupada en Mesas y QR.' : 'Reservación confirmada.';
          await refresh();
        }
        catch (error) { const feedback = root.querySelector(`[data-reservation-feedback="${CSS.escape(reservationStatus.dataset.reservation)}"]`); if (feedback) feedback.textContent = error.message; reservationStatus.disabled = false; }
        return;
      }
      const assignReservation = event.target.closest('[data-assign-reservation]');
      if (assignReservation) {
        const id = assignReservation.dataset.assignReservation;
        const select = root.querySelector(`[data-reservation-table="${CSS.escape(id)}"]`);
        const feedback = root.querySelector(`[data-reservation-feedback="${CSS.escape(id)}"]`);
        if (!select?.value) { if (feedback) feedback.textContent = 'Selecciona una mesa antes de asignarla.'; select?.focus(); return; }
        assignReservation.disabled = true;
        assignReservation.setAttribute('aria-busy', 'true');
        try { await request(`/api/reservations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ table: Number(select.value) }) }); root.querySelector('[data-reservation-page-feedback]').textContent = `Mesa ${select.value} asignada correctamente.`; await refresh(); }
        catch (error) { if (feedback) feedback.textContent = error.message; assignReservation.disabled = false; assignReservation.removeAttribute('aria-busy'); }
      }
    });

    root.addEventListener('submit', async (event) => {
      const editForm = event.target.closest('[data-reservation-edit-form]');
      if (editForm) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(editForm));
        const id = data.id;
        delete data.id;
        const feedback = editForm.querySelector('[data-reservation-edit-feedback]');
        const button = editForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        feedback.textContent = 'Guardando cambios…';
        try {
          await request(`/api/reservations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
          root.querySelector('[data-reservation-edit-dialog]').close();
          root.querySelector('[data-reservation-page-feedback]').textContent = 'Reservación modificada correctamente.';
          await refresh();
        } catch (error) { feedback.textContent = error.message; feedback.dataset.state = 'error'; }
        finally { button.disabled = false; button.removeAttribute('aria-busy'); }
        return;
      }
      const form = event.target.closest('[data-reservation-form]');
      if (!form) return;
      event.preventDefault();
      const feedback = root.querySelector('[data-reservation-form-feedback]');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      feedback.textContent = 'Creando reservación…';
      try {
        await request('/api/reservations', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        form.reset();
        dateInput.min = new Intl.DateTimeFormat('en-CA').format(new Date());
        feedback.textContent = 'Reservación manual creada. Ahora asígnale una mesa desde la agenda.';
        feedback.dataset.state = 'success';
        await refresh();
      } catch (error) {
        feedback.textContent = error.message;
        feedback.dataset.state = 'error';
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });

    await refresh();
    window.setInterval(() => refresh(), 4000);
  }

  async function initKitchen() {
    const state = { filter: 'all', orders: [] };
    root.innerHTML = `<main class="admin-shell">${header({ internal: true })}<section class="admin-toolbar"><div><p class="order-eyebrow">Producción</p><h1>Cola de cocina</h1><p>Órdenes confirmadas en orden de llegada, con su origen siempre visible.</p></div><div class="admin-actions"><span class="connection-state" data-connection>Actualización automática</span><button class="secondary-button" type="button" data-refresh>Actualizar</button></div></section><nav class="queue-filters" aria-label="Filtrar pedidos por origen"><button type="button" data-channel-filter="all" aria-pressed="true">Todos</button><button type="button" data-channel-filter="table" aria-pressed="false">Mesas</button><button type="button" data-channel-filter="takeaway" aria-pressed="false">Para llevar</button><button type="button" data-channel-filter="counter" aria-pressed="false">Caja</button></nav><section class="kitchen-queue" data-kitchen-queue aria-live="polite"></section><div data-receipt></div></main>`;

    function render() {
      const visible = state.orders.filter((order) => ['confirmed', 'preparing', 'ready'].includes(order.status) && (state.filter === 'all' || (order.channel || 'table') === state.filter)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      root.querySelector('[data-kitchen-queue]').innerHTML = visible.length ? visible.map((order, index) => {
        const next = order.status === 'confirmed' ? ['preparing', 'Comenzar preparación'] : order.status === 'preparing' ? ['ready', 'Marcar listo'] : ['delivered', 'Entregado'];
        return `<article class="kitchen-ticket"><header><div><span class="queue-number">#${index + 1}</span><strong>${escapeHtml(order.code)}</strong><time>${escapeHtml(time(order.createdAt))}</time></div><b data-channel="${escapeHtml(order.channel || 'table')}">${escapeHtml(orderContext(order))}</b></header>${order.customerName ? `<p class="kitchen-ticket__customer">Cliente: <strong>${escapeHtml(order.customerName)}</strong></p>` : ''}<div class="kitchen-ticket__meta">${canOperate('payments.view') ? `<span data-payment-state="${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}">${escapeHtml(paymentLabel(order))}</span>` : ''}${order.pickupCode && order.items.some((item) => itemDestination(item, order) === 'takeaway') ? `<span>Retiro ${escapeHtml(order.pickupCode)}</span>` : ''}</div><ul>${order.items.map((item) => orderItemDetails(item, order)).join('')}</ul>${order.note ? `<p class="kitchen-ticket__note">${escapeHtml(order.note)}</p>` : ''}<footer><span data-kitchen-state="${order.status}">${order.status === 'confirmed' ? 'Confirmado' : order.status === 'preparing' ? 'En preparación' : 'Listo'}</span><div><button class="secondary-button" type="button" data-print="${order.id}">Imprimir</button>${canOperate(next[0] === 'delivered' ? 'orders.edit' : 'kitchen.update') ? `<button class="primary-button" type="button" data-kitchen-status="${next[0]}" data-order="${order.id}">${next[1]}</button>` : ''}</div></footer></article>`;
      }).join('') : '<div class="empty-state">No hay pedidos en esta cola.</div>';
      root.dataset.orders = JSON.stringify(state.orders);
    }

    async function refresh() {
      try { const { orders } = await request('/api/orders'); state.orders = orders; root.querySelector('[data-connection]').classList.remove('is-error'); root.querySelector('[data-connection]').textContent = 'Actualización automática'; render(); }
      catch (error) { const indicator = root.querySelector('[data-connection]'); indicator.classList.add('is-error'); indicator.textContent = error.message; }
    }

    root.addEventListener('click', async (event) => {
      if (event.target.closest('[data-refresh]')) { await refresh(); return; }
      const filter = event.target.closest('[data-channel-filter]');
      if (filter) { state.filter = filter.dataset.channelFilter; root.querySelectorAll('[data-channel-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button === filter))); render(); return; }
      const status = event.target.closest('[data-kitchen-status]');
      if (status) { status.disabled = true; try { await request(`/api/orders/${encodeURIComponent(status.dataset.order)}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.kitchenStatus }) }); await refresh(); } catch (error) { window.alert(error.message); status.disabled = false; } return; }
      const print = event.target.closest('[data-print]');
      if (print) { const orders = JSON.parse(root.dataset.orders || '[]'); const order = orders.find((item) => item.id === print.dataset.print); if (!order) return; root.querySelector('[data-receipt]').innerHTML = receipt(order); window.print(); }
    });
    await refresh();
    window.setInterval(() => refresh(), 3000);
  }

  async function initStaffTables() {
    const canAssign = canOperate('tables.assign');
    const canClaim = canOperate('tables.claim');
    const isWaiter = adminRoles.includes('waiter') && !canAssign;
    root.innerHTML = `${header({ internal:true })}<main class="salon-page" id="contenido">
      <div class="salon-heading"><div><p class="order-eyebrow">Operación de sala</p><h1>${isWaiter ? 'Mis mesas' : 'Salón y mesas'}</h1><p>${isWaiter ? 'Consulta tus mesas, inicia atención en una disponible y añade comandas a la misma cuenta.' : 'Consulta el estado del salón y asigna el personal responsable.'}</p></div><button class="secondary-button" type="button" data-salon-refresh>Actualizar</button></div>
      <p class="salon-summary" data-salon-summary></p><p class="salon-feedback" data-salon-feedback role="status" aria-live="polite"></p>
      ${isWaiter ? `<section class="salon-group" aria-labelledby="salon-mine-title"><h2 id="salon-mine-title">A mi cargo</h2><div class="salon-grid" data-salon-mine></div></section><section class="salon-group" aria-labelledby="salon-available-title"><h2 id="salon-available-title">Mesas que puedo atender</h2><div class="salon-grid" data-salon-available></div></section><section class="salon-group" aria-labelledby="salon-other-title"><h2 id="salon-other-title">Resto del salón</h2><div class="salon-grid" data-salon-other></div></section>` : `<section class="salon-group" aria-labelledby="salon-all-title"><h2 id="salon-all-title">Estado de mesas</h2><div class="salon-grid" data-salon-all></div></section><section class="salon-group" aria-labelledby="salon-requests-title"><h2 id="salon-requests-title">Solicitudes del equipo</h2><div data-salon-requests></div></section>`}
      ${isWaiter ? '<div class="salon-help"><p>Si necesitas que recepción te asigne una mesa o vincule tu perfil, envía una solicitud.</p><button class="secondary-button" type="button" data-salon-request-assignment>Solicitar asignación</button></div>' : ''}
    </main>`;
    const feedback = root.querySelector('[data-salon-feedback]');
    const state = { tables:[], waiters:[], requests:[], signature:'' };
    const statusLabel = table => table.status === 'reserved' ? 'Reservada' : table.status === 'occupied' ? 'Ocupada' : 'Disponible';
    function tableCard(table) {
      const mine = Boolean(adminWaiterId && table.waiterId === adminWaiterId);
      const claimable = !table.waiterId && table.status !== 'reserved' && !table.reservationId;
      const context = table.waiterName ? `Atiende ${escapeHtml(table.waiterName)}` : table.reservation ? `Reservada para las ${escapeHtml(table.reservation.time)}` : table.status === 'occupied' ? 'Atención sin mesero asignado' : 'Sin responsable';
      const account = table.totalOrders ? `${table.totalOrders} ${table.totalOrders === 1 ? 'comanda' : 'comandas'} · ${table.unpaidOrders ? `${table.unpaidOrders} pendiente${table.unpaidOrders === 1 ? '' : 's'} de cobro` : 'sin cobros pendientes'}` : table.status === 'occupied' ? 'Atención iniciada, sin comandas' : '';
      return `<article class="salon-table" data-state="${escapeHtml(table.status)}" ${mine ? 'data-mine="true"' : ''}><div class="salon-table__top"><h3>Mesa ${table.table}</h3><span>${statusLabel(table)}</span></div><p>${context}</p>${account ? `<small>${account}</small>` : ''}<div class="salon-table__actions">
        ${mine && table.status === 'available' && canClaim ? `<button class="primary-button" type="button" data-salon-claim="${table.table}">Iniciar atención</button>` : ''}
        ${mine && table.status === 'occupied' && can('new-order') ? `<a class="primary-button" href="${appUrl(`/pedido/?modo=interno&mesa=${table.table}`)}">Agregar comanda</a>` : ''}
        ${mine && can('orders') ? `<a class="secondary-button" href="${appUrl('/admin/pedidos/')}">Ver pedidos</a>` : ''}
        ${mine && table.status === 'occupied' ? `<button class="secondary-button" type="button" data-salon-close="${table.table}">Solicitar cierre</button>` : ''}
        ${canClaim && claimable && adminWaiterId ? `<button class="primary-button" type="button" data-salon-claim="${table.table}">${table.status === 'occupied' ? 'Tomar atención' : 'Iniciar atención'}</button>` : ''}
      </div>${canAssign ? `<details class="salon-table__assignment"><summary>${table.waiterId ? 'Reasignar mesero' : 'Asignar mesero'}</summary><label>Responsable<select data-salon-waiter="${table.table}"><option value="">Sin asignar</option>${state.waiters.filter(waiter => waiter.active && waiter.authorized).map(waiter => `<option value="${escapeHtml(waiter.id)}" ${table.waiterId === waiter.id ? 'selected' : ''}>${escapeHtml(waiter.name)}</option>`).join('')}</select></label><button class="secondary-button" type="button" data-salon-assign="${table.table}">Guardar asignación</button></details>` : ''}</article>`;
    }
    function render() {
      const assigned = state.tables.filter(table => adminWaiterId && table.waiterId === adminWaiterId);
      const claimable = state.tables.filter(table => !table.waiterId && table.status !== 'reserved' && !table.reservationId);
      root.querySelector('[data-salon-summary]').textContent = `${state.tables.filter(table => table.status === 'available').length} disponibles · ${state.tables.filter(table => table.status === 'reserved').length} reservadas · ${state.tables.filter(table => table.status === 'occupied').length} ocupadas`;
      if (isWaiter) {
        root.querySelector('[data-salon-mine]').innerHTML = assigned.length ? assigned.map(tableCard).join('') : `<p class="salon-empty">Todavía no tienes mesas a cargo. ${adminWaiterId && canClaim ? 'Puedes iniciar atención en una disponible o solicitar una asignación.' : 'Solicita que el propietario vincule tu perfil de mesero o que recepción te asigne una mesa.'}</p>`;
        root.querySelector('[data-salon-available]').innerHTML = claimable.length ? claimable.map(tableCard).join('') : '<p class="salon-empty">No hay mesas disponibles para tomar en este momento.</p>';
        const other = state.tables.filter(table => !assigned.includes(table) && !claimable.includes(table));
        root.querySelector('[data-salon-other]').innerHTML = other.length ? other.map(tableCard).join('') : '<p class="salon-empty">No hay otras mesas.</p>';
      } else {
        root.querySelector('[data-salon-all]').innerHTML = state.tables.map(tableCard).join('');
        const pending = state.requests.filter(item => item.status === 'pending' && ['assignment-request','close-request'].includes(item.type));
        root.querySelector('[data-salon-requests]').innerHTML = pending.length ? `<ul class="salon-requests">${pending.map(item => `<li><span>${escapeHtml(item.waiterName || 'Mesero')} · ${item.type === 'close-request' ? `solicita cerrar mesa ${item.table}` : 'solicita asignación'}</span><button class="secondary-button" type="button" data-salon-resolve="${escapeHtml(item.id)}">Marcar atendida</button></li>`).join('')}</ul>` : '<p class="salon-empty">Sin solicitudes pendientes.</p>';
      }
    }
    async function refresh(force = false) {
      const [tableData, waiterData, requestData] = await Promise.all([request('/api/tables'), canAssign ? request('/api/waiters') : Promise.resolve({waiters:[]}), canAssign ? request('/api/service-requests') : Promise.resolve({requests:[]})]);
      const signature = JSON.stringify([tableData.tables, waiterData.waiters, requestData.requests]);
      state.tables = tableData.tables; state.waiters = waiterData.waiters; state.requests = requestData.requests;
      adminAssignedTables = state.tables.filter(table => adminWaiterId && table.waiterId === adminWaiterId).map(table => table.table);
      if ((force || signature !== state.signature) && !root.querySelector('[data-salon-all] select:focus, [data-salon-mine] select:focus')) { state.signature = signature; render(); }
    }
    root.addEventListener('click', async event => {
      const action = event.target.closest('[data-salon-refresh],[data-salon-claim],[data-salon-close],[data-salon-request-assignment],[data-salon-assign],[data-salon-resolve]');
      if (!action) return;
      action.disabled = true;
      feedback.textContent = '';
      try {
        if (action.hasAttribute('data-salon-claim')) { await request(`/api/tables/${action.dataset.salonClaim}/claim`, { method:'POST', body:'{}' }); feedback.textContent = `Mesa ${action.dataset.salonClaim} a tu cargo.`; }
        else if (action.hasAttribute('data-salon-assign')) { const table = action.dataset.salonAssign; const waiterId = root.querySelector(`[data-salon-waiter="${table}"]`).value; await request(`/api/tables/${table}/assignment`, { method:'PUT', body:JSON.stringify({waiterId}) }); feedback.textContent = `Responsable de la mesa ${table} actualizado.`; }
        else if (action.hasAttribute('data-salon-close')) { await request('/api/service-requests', { method:'POST', body:JSON.stringify({type:'close-request',table:Number(action.dataset.salonClose)}) }); feedback.textContent = `Solicitud de cierre de la mesa ${action.dataset.salonClose} enviada.`; }
        else if (action.hasAttribute('data-salon-request-assignment')) { await request('/api/service-requests', { method:'POST', body:JSON.stringify({type:'assignment-request'}) }); feedback.textContent = 'Solicitud de asignación enviada a recepción.'; }
        else if (action.hasAttribute('data-salon-resolve')) { await request(`/api/service-requests/${action.dataset.salonResolve}`, { method:'PATCH', body:'{}' }); feedback.textContent = 'Solicitud marcada como atendida.'; }
        await refresh(true);
      } catch (error) { feedback.textContent = error.message; action.disabled = false; }
    });
    await refresh(true);
    window.setInterval(() => { if (!document.hidden) refresh().catch(error => { feedback.textContent = error.message; }); }, 4000);
  }

  async function initQr() {
    if (adminRole !== 'owner' && !isStaticDemo) return initStaffTables();
    const configuredCount = isStaticDemo ? 12 : (await request('/api/tables')).count || 12;
    let defaultBase = appUrl('/').replace(/\/$/, '');
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      try {
        const health = await request('/api/health');
        defaultBase = health.networkUrls?.find((url) => /^http:\/\/192\.168\./.test(url)) || health.networkUrls?.[0] || defaultBase;
        defaultBase = defaultBase.replace(/\/$/, '');
      } catch { /* Keep localhost as an editable fallback. */ }
    }
    root.innerHTML = `<main class="order-shell">${header({ internal: true })}
      <section class="order-hero qr-hero"><div><p class="order-eyebrow">Mesas y QR</p><h1>El salón, mesa por mesa.</h1><p class="order-hero__intro">Consulta el estado de cada mesa y prepara su código QR para ordenar.</p></div><aside class="order-hero__aside"><strong>Estado en tiempo real</strong><p>Las reservaciones de hoy bloquean su mesa hasta cancelar, cambiar la asignación o registrar la llegada.</p></aside></section>
      <form class="qr-controls" data-qr-form><label>Dirección del sistema<input type="url" name="base" value="${escapeHtml(defaultBase)}" ${isStaticDemo ? 'readonly' : ''} required></label><label>Cantidad de mesas<input type="number" name="count" value="${configuredCount}" min="1" max="${isStaticDemo ? 12 : 100}" required></label><button class="primary-button" type="submit">Actualizar mesas</button></form>
      <section class="qr-status" aria-label="Resumen de mesas"><div><strong data-available-count>0</strong><span>Disponibles</span></div><div><strong data-reserved-count>0</strong><span>Reservadas hoy</span></div><div><strong data-occupied-count>0</strong><span>Ocupadas</span></div><p data-qr-feedback role="status" aria-live="polite"></p></section>
      <section class="qr-workspace"><div class="table-selector"><header><p class="order-eyebrow">Selector del salón</p><h2>Gestiona cada mesa</h2><p>Consulta las disponibles, las reservadas para hoy y las mesas actualmente ocupadas.</p></header><div class="table-selector__grid" data-table-selector></div></div><aside class="qr-preview" data-qr-preview></aside></section><section class="qr-print-card" data-qr-print aria-hidden="true"></section>
    </main>`;
    const form = root.querySelector('[data-qr-form]');
    const state = { tables: [], selected: null, count: configuredCount, base: defaultBase };

    function tableUrl(table) { return `${state.base}/mesa/?mesa=${table}#menu`; }

    function renderPreview() {
      const preview = root.querySelector('[data-qr-preview]');
      const print = root.querySelector('[data-qr-print]');
      const selected = state.tables.find((item) => item.table === state.selected);
      if (!selected) {
        preview.innerHTML = `<div class="qr-preview__empty">${iconTable}<h2>Selecciona una mesa</h2><p>Consulta el QR o gestiona una mesa ocupada desde este panel.</p></div>`;
        print.innerHTML = '';
        return;
      }
      if (selected.status === 'occupied') {
        preview.innerHTML = `<div class="qr-preview__empty qr-preview__occupied">${iconOccupiedTable}<p class="order-eyebrow">Mesa seleccionada</p><h2>Mesa ${selected.table} ocupada</h2><p>${selected.activeOrders ? `Tiene ${selected.activeOrders} pedido${selected.activeOrders === 1 ? '' : 's'} activo${selected.activeOrders === 1 ? '' : 's'}.` : selected.unpaidOrders ? 'Tiene consumos pendientes de pago.' : selected.reservationId ? 'El cliente llegó con una reservación.' : 'La sesión de esta mesa continúa abierta.'}</p>${canOperate('tables.manage') ? `<button class="primary-button" type="button" data-release-qr-table="${selected.table}" ${selected.canRelease ? '' : 'disabled title="Finaliza los pedidos y registra el pago antes de liberar"'}>${selected.canRelease ? 'Cliente se retiró · liberar mesa' : selected.unpaidOrders ? 'Pago pendiente' : 'Finaliza los pedidos'}</button>` : ''}${can('orders') ? `<a class="secondary-button" href="${appUrl('/admin/pedidos/')}">Ver en la central</a>` : ''}</div>`;
        print.innerHTML = '';
        return;
      }
      if (selected.status === 'reserved') {
        const reservation = selected.reservation || {};
        preview.innerHTML = `<div class="qr-preview__empty qr-preview__reserved">${iconTable}<p class="order-eyebrow">Mesa bloqueada</p><h2>Mesa ${selected.table} reservada</h2><p><strong>${escapeHtml(reservation.code || 'Reservación activa')}</strong> para las ${escapeHtml(reservation.time || '')}${reservation.guests ? ` · ${escapeHtml(reservation.guests)} personas` : ''}.</p><p>La mesa estará disponible después de registrar la llegada o cambiar la reservación.</p>${can('reservations') ? `<a class="primary-button" href="${appUrl('/admin/reservaciones/')}">Abrir reservaciones</a>` : ''}</div>`;
        print.innerHTML = '';
        return;
      }
      const url = tableUrl(selected.table);
      const qrSource = isStaticDemo ? appUrl(`/preview/qr/mesa-${selected.table}.svg`) : appUrl(`/api/qr?url=${encodeURIComponent(url)}`);
      const card = `<div class="qr-card"><img class="qr-card__logo" src="${brandLogoUrl}" alt="Boccantina Cantina de Vinos" width="300" height="72"><span class="qr-card__table">MESA ${selected.table}</span><img class="qr-card__code" src="${qrSource}" alt="Código QR para ordenar desde la mesa ${selected.table}" width="640" height="640"><strong>ESCANEA PARA ORDENAR</strong><small class="qr-card__hint">La mesa se identificará automáticamente.</small></div>`;
      preview.innerHTML = `<p class="order-eyebrow">Vista previa seleccionada</p>${card}<div class="qr-preview__actions"><a class="primary-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir menú</a><button class="secondary-button" type="button" data-copy-link>Copiar enlace</button><button class="secondary-button" type="button" data-print-qr>Imprimir QR</button></div>`;
      print.innerHTML = card;
    }

    function renderTables() {
      const available = state.tables.filter((item) => item.status === 'available').length;
      const reserved = state.tables.filter((item) => item.status === 'reserved').length;
      const occupied = state.tables.filter((item) => item.status === 'occupied').length;
      root.querySelector('[data-available-count]').textContent = available;
      root.querySelector('[data-reserved-count]').textContent = reserved;
      root.querySelector('[data-occupied-count]').textContent = occupied;
      root.querySelector('[data-table-selector]').innerHTML = state.tables.map((item) => {
        const occupied = item.status === 'occupied';
        const reserved = item.status === 'reserved';
        const selected = item.table === state.selected;
        const statusText = occupied ? 'Ocupada' : reserved ? `${iconLock} Reservada · ${escapeHtml(item.reservation?.time || '')}` : 'Disponible';
        return `<button class="table-option${selected ? ' is-selected' : ''}${occupied ? ' is-occupied' : ''}${reserved ? ' is-reserved' : ''}" type="button" data-table="${item.table}" aria-pressed="${selected}" aria-label="Mesa ${item.table}, ${reserved ? `reservada para las ${escapeHtml(item.reservation?.time || '')}` : occupied ? 'ocupada' : 'disponible'}">${occupied ? iconOccupiedTable : iconTable}<span class="table-option__copy"><strong>Mesa ${item.table}</strong><small>${statusText}</small></span></button>`;
      }).join('');
      renderPreview();
    }

    async function refreshTables({ announce = false } = {}) {
      const { tables } = await request(`/api/tables?count=${state.count}`);
      state.tables = tables;
      if (!tables.some((item) => item.table === state.selected)) state.selected = tables.find((item) => item.status === 'available')?.table || tables.find((item) => item.status === 'reserved')?.table || tables[0]?.table || null;
      renderTables();
      if (announce) root.querySelector('[data-qr-feedback]').textContent = 'Estados de mesas actualizados.';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      state.base = String(data.get('base')).replace(/\/$/, '');
      state.count = Math.max(1, Math.min(isStaticDemo ? 12 : 100, Number(data.get('count')) || 1));
      submit.disabled = true;
      try { if (!isStaticDemo) await request('/api/tables/config', { method:'PUT', body:JSON.stringify({count:state.count}) }); await refreshTables({ announce: true }); }
      catch (error) { root.querySelector('[data-qr-feedback]').textContent = error.message; }
      finally { submit.disabled = false; }
    });

    root.addEventListener('click', async (event) => {
      const tableButton = event.target.closest('[data-table]');
      if (tableButton) { state.selected = Number(tableButton.dataset.table); renderTables(); return; }
      const releaseTable = event.target.closest('[data-release-qr-table]');
      if (releaseTable) {
        if (!window.confirm(`¿Confirmas que el cliente de la mesa ${releaseTable.dataset.releaseQrTable} se retiró? La mesa volverá a quedar disponible.`)) return;
        releaseTable.disabled = true;
        try { await request(`/api/tables/${encodeURIComponent(releaseTable.dataset.releaseQrTable)}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) }); root.querySelector('[data-qr-feedback]').textContent = `Mesa ${releaseTable.dataset.releaseQrTable} liberada correctamente.`; await refreshTables(); }
        catch (error) { root.querySelector('[data-qr-feedback]').textContent = error.message; releaseTable.disabled = false; }
        return;
      }
      if (event.target.closest('[data-print-qr]')) { window.print(); return; }
      if (event.target.closest('[data-copy-link]') && state.selected) {
        const feedback = root.querySelector('[data-qr-feedback]');
        try { await navigator.clipboard.writeText(tableUrl(state.selected)); feedback.textContent = `Enlace de la mesa ${state.selected} copiado.`; }
        catch { feedback.textContent = 'No se pudo copiar automáticamente. Abre el menú y copia la dirección del navegador.'; }
      }
    });

    await refreshTables();
    window.setInterval(() => refreshTables().catch(() => {}), 4000);
  }

  async function initStaff() {
    if (adminRole !== 'owner') throw new Error('Solo el superadministrador puede gestionar el personal.');
    root.innerHTML = `<div class="admin-shell staff-shell">${header({ internal:true })}
      <main class="staff-workspace" id="contenido">
        <div class="staff-breadcrumb">Boccantina <span aria-hidden="true">/</span> Administración <span aria-hidden="true">/</span> Personal</div>
        <div class="staff-heading"><div><p class="staff-kicker">Dirección del restaurante</p><h1>Personal y accesos</h1><p>Asigna puestos y revisa qué puede hacer cada integrante.</p></div></div>
        <section class="staff-section" aria-labelledby="staff-title">
          <div class="staff-section__head"><div><h2 id="staff-title">Equipo</h2><p>Las cuentas inactivas no pueden entrar.</p></div><button class="staff-primary" type="button" data-new-user>+ Nuevo empleado</button></div>
          <div class="staff-filters"><label>Buscar<input type="search" data-staff-search placeholder="Nombre o usuario"></label><label>Puesto<select data-staff-role-filter><option value="">Todos los puestos</option></select></label><label>Estado<select data-staff-status-filter><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label></div>
          <p class="staff-feedback" data-staff-feedback role="status" aria-live="polite"></p>
          <div class="staff-table-wrap"><table class="staff-table"><thead><tr><th scope="col">Nombre</th><th scope="col">Usuario</th><th scope="col">Puesto y accesos</th><th scope="col">Estado</th><th scope="col">Último acceso</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead><tbody data-staff-rows></tbody></table></div>
        </section>
        <details class="staff-audit"><summary>Registro de actividad</summary><p>Últimas operaciones administrativas registradas en este preview local.</p><button class="staff-secondary" type="button" data-staff-audit-load>Actualizar registro</button><ul data-staff-audit-list></ul></details>
      </main>
      <dialog class="staff-dialog" data-staff-dialog aria-labelledby="staff-dialog-title"><form data-staff-form>
        <div class="staff-dialog__head"><div><p class="staff-kicker">Accesos del equipo</p><h2 id="staff-dialog-title">Nuevo empleado</h2></div><button type="button" class="staff-close" data-staff-close aria-label="Cerrar formulario">×</button></div>
        <div class="staff-dialog__body"><div class="staff-fields"><label>Nombre visible<input name="name" autocomplete="name" required minlength="2" maxlength="80"></label><label>Usuario<input name="username" autocomplete="off" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+" aria-describedby="staff-username-help"><small id="staff-username-help">3 a 40 caracteres: letras, números, punto, guion o guion bajo.</small></label></div>
          <label>Contraseña inicial<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="256" aria-describedby="staff-password-help"><small id="staff-password-help">Mínimo 8 caracteres. Al editar, déjala vacía para conservarla.</small></label>
          <fieldset class="staff-permissions"><legend>Puesto de trabajo</legend><div data-staff-roles></div></fieldset>
          <label class="staff-waiter-link" data-staff-waiter-link hidden>Perfil de mesero<select name="waiterId" data-staff-waiter></select><small>Vincula la cuenta con un mesero registrado para limitar sus mesas y pedidos.</small></label>
          <div class="staff-access-preview"><strong>Accesos resultantes</strong><p data-staff-preview>Selecciona un puesto.</p></div>
          <details class="staff-advanced"><summary>Permisos avanzados</summary><p>Añade funciones puntuales o limita las incluidas en el puesto.</p><div class="staff-permissions" data-staff-denies></div><div class="staff-permissions" data-staff-grants></div></details>
          <label class="staff-active"><input name="active" type="checkbox" checked> Cuenta activa</label>
          <p class="staff-form-error" data-staff-error role="alert" aria-live="polite"></p></div>
        <div class="staff-dialog__actions"><button type="button" class="staff-secondary" data-staff-close>Cancelar</button><button type="submit" class="staff-primary" data-staff-save>Crear empleado</button></div>
      </form></dialog></div>`;
    const dialog = root.querySelector('[data-staff-dialog]');
    const form = root.querySelector('[data-staff-form]');
    const rows = root.querySelector('[data-staff-rows]');
    const feedback = root.querySelector('[data-staff-feedback]');
    let users = [];
    let labels = {};
    let roleDefinitions = {};
    let operations = {};
    let waiters = [];
    let ownerUsername = '';
    let selected = null;
    let trigger = null;
    let initialForm = '';
    let deniedSelection = new Set();
    const showMessage = (message, error = false) => { feedback.textContent = message; feedback.dataset.error = String(error); };
    function renderRows() {
      const query = root.querySelector('[data-staff-search]').value.trim().toLocaleLowerCase('es');
      const role = root.querySelector('[data-staff-role-filter]').value;
      const status = root.querySelector('[data-staff-status-filter]').value;
      const visible = users.filter(user => (!query || `${user.name} ${user.username}`.toLocaleLowerCase('es').includes(query)) && (!role || user.roles.includes(role)) && (!status || (status === 'active') === user.active));
      rows.innerHTML = `<tr><td data-label="Nombre"><strong>Superadministrador</strong></td><td data-label="Usuario">${escapeHtml(ownerUsername)}</td><td data-label="Puesto y accesos">Propietario · Acceso completo</td><td data-label="Estado"><span class="staff-state">Principal</span></td><td data-label="Último acceso">—</td><td data-label="Acción"><span class="staff-protected">Cuenta protegida</span></td></tr>` + (visible.length ? visible.sort((a,b) => a.name.localeCompare(b.name, 'es')).map(user => `<tr>
        <td data-label="Nombre"><strong>${escapeHtml(user.name)}</strong></td><td data-label="Usuario">${escapeHtml(user.username)}</td>
        <td data-label="Puesto y accesos"><strong>${escapeHtml(user.roles.length ? user.roles.map(role => roleDefinitions[role]?.label || role).join(' + ') : 'Accesos anteriores')}</strong><small>${escapeHtml(user.permissions.map(permission => (labels[permission] || permission).split(' · ').at(-1)).join(' · '))}</small></td>
        <td data-label="Estado"><span class="staff-state" data-active="${user.active}">${user.active ? 'Activa' : 'Inactiva'}</span></td>
        <td data-label="Último acceso">${user.lastLoginAt ? escapeHtml(new Date(user.lastLoginAt).toLocaleString('es-CR')) : 'Sin acceso registrado'}</td>
        <td data-label="Acción"><button class="staff-edit" type="button" data-edit-user="${escapeHtml(user.id)}" aria-label="Editar a ${escapeHtml(user.name)}">Editar</button></td></tr>`).join('')
        : '<tr><td colspan="6" class="staff-empty">No hay empleados con esos filtros.</td></tr>');
    }
    async function loadUsers() {
      const result = await request('/api/admin/users');
      if (!Array.isArray(result?.users) || !result.owner || !result.roles || !result.operations) {
        throw new Error('La administración necesita reiniciar el servidor local para cargar los permisos actuales.');
      }
      users = result.users;
      labels = result.permissions;
      roleDefinitions = result.roles;
      operations = result.operations;
      waiters = result.waiters || [];
      ownerUsername = result.owner.username;
      root.querySelector('[data-staff-role-filter]').innerHTML = '<option value="">Todos los puestos</option>' + Object.entries(roleDefinitions).map(([key,value]) => `<option value="${escapeHtml(key)}">${escapeHtml(value.label)}</option>`).join('');
      renderRows();
    }
    function formState() {
      return JSON.stringify({ fields:[...new FormData(form).entries()], password:form.elements.password.value, active:form.elements.active.checked });
    }
    function updatePreview() {
      const roles = [...form.querySelectorAll('[name="roles"]:checked')].map(input => input.value);
      const grants = [...form.querySelectorAll('[name="grants"]:checked')].map(input => input.value);
      const roleOperations = [...new Set(roles.flatMap(role => roleDefinitions[role]?.permissions || []))];
      root.querySelector('[data-staff-denies]').innerHTML = roleOperations.length ? `<fieldset><legend>Limitar funciones del puesto</legend><div>${roleOperations.map(key => `<label><input type="checkbox" name="denies" value="${escapeHtml(key)}" ${deniedSelection.has(key) ? 'checked' : ''}><span>Restringir ${escapeHtml((operations[key] || key).toLowerCase())}</span></label>`).join('')}</div></fieldset>` : '';
      root.querySelectorAll('[name="grants"]').forEach(input => { input.closest('label').hidden = roleOperations.includes(input.value) && !input.checked; });
      const combined = new Set([...grants, ...roleOperations]);
      deniedSelection.forEach(permission => combined.delete(permission));
      const paths = [
        ['orders.view','Pedidos'], ['kitchen.view','Cocina'], ['reservations.view','Reservaciones'],
        ['tables.view','Mesas'], ['orders.create','Nuevo pedido'], ['extras.manage','Extras'], ['availability.manage','Disponibilidad']
      ].filter(([permission]) => combined.has(permission)).map(([,title]) => title);
      const actionKeys = ['orders.create','orders.create_for_table','orders.edit','orders.cancel','kitchen.update','payments.collect','payments.refund','tables.claim','tables.assign','tables.release','reservations.manage','extras.manage','availability.manage','menu.price.edit'];
      const actions = actionKeys.filter(key => combined.has(key)).map(key => operations[key] || key);
      root.querySelector('[data-staff-preview]').textContent = paths.length || actions.length ? `Vistas: ${paths.join(' · ') || 'ninguna'}. Acciones: ${actions.join(' · ') || 'solo consulta'}.` : 'Selecciona un puesto o un permiso avanzado.';
      root.querySelector('[data-staff-waiter-link]').hidden = !roles.includes('waiter');
    }
    function openEditor(user, source) {
      selected = user;
      trigger = source;
      form.reset();
      form.elements.name.value = user?.name || '';
      form.elements.username.value = user?.username || '';
      form.elements.password.value = '';
      form.elements.password.required = !user;
      form.elements.active.checked = user?.active ?? true;
      root.querySelector('#staff-dialog-title').textContent = user ? `Editar a ${user.name}` : 'Nuevo empleado';
      root.querySelector('[data-staff-save]').textContent = user ? 'Guardar cambios' : 'Crear empleado';
      root.querySelector('[data-staff-error]').textContent = '';
      root.querySelector('[data-staff-roles]').innerHTML = Object.entries(roleDefinitions).map(([key,value]) => `<label><input type="checkbox" name="roles" value="${escapeHtml(key)}" ${user?.roles.includes(key) ? 'checked' : ''}><span>${escapeHtml(value.label)}</span></label>`).join('');
      const legacyGrants = user && !user.roles.length ? user.operations : user?.grants || [];
      root.querySelector('[data-staff-grants]').innerHTML = `<fieldset><legend>Funciones adicionales</legend><div>${Object.entries(operations).filter(([key]) => !['users.view','users.manage','roles.manage','audit.view','settings.manage','tables.manage'].includes(key)).map(([key,label]) => `<label><input type="checkbox" name="grants" value="${escapeHtml(key)}" ${legacyGrants.includes(key) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}</div></fieldset>`;
      root.querySelector('[data-staff-waiter]').innerHTML = '<option value="">Sin vincular todavía</option>' + waiters.filter(item => item.active).map(item => `<option value="${escapeHtml(item.id)}" ${user?.waiterId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
      root.querySelector('.staff-advanced').open = Boolean(user && !user.roles.length);
      deniedSelection = new Set(user?.denies || []);
      updatePreview();
      dialog.showModal();
      initialForm = formState();
      form.elements.name.focus();
    }
    root.querySelectorAll('[data-staff-search],[data-staff-role-filter],[data-staff-status-filter]').forEach(input => input.addEventListener('input', renderRows));
    root.querySelector('[data-staff-audit-load]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try {
        const { entries } = await request('/api/admin/audit');
        root.querySelector('[data-staff-audit-list]').innerHTML = entries.length ? entries.map(entry => `<li><time>${escapeHtml(new Date(entry.at).toLocaleString('es-CR'))}</time><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(entry.resource)}</span><small>${escapeHtml(entry.result)}</small></li>`).join('') : '<li>Sin operaciones registradas todavía.</li>';
      } catch (error) { showMessage(error.message, true); }
      finally { event.currentTarget.disabled = false; }
    });
    form.addEventListener('change', event => {
      if (event.target.name === 'denies') event.target.checked ? deniedSelection.add(event.target.value) : deniedSelection.delete(event.target.value);
      updatePreview();
    });
    root.querySelector('[data-new-user]').addEventListener('click', event => openEditor(null, event.currentTarget));
    rows.addEventListener('click', event => {
      const button = event.target.closest('[data-edit-user]');
      if (button) openEditor(users.find(user => user.id === button.dataset.editUser), button);
    });
    function closeEditor() {
      if (formState() !== initialForm && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
      dialog.close();
    }
    root.querySelectorAll('[data-staff-close]').forEach(button => button.addEventListener('click', closeEditor));
    dialog.addEventListener('cancel', event => { if (formState() !== initialForm && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) event.preventDefault(); });
    dialog.addEventListener('close', () => trigger?.focus());
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const roles = [...form.querySelectorAll('[name="roles"]:checked')].map(input => input.value);
      const grants = [...form.querySelectorAll('[name="grants"]:checked')].map(input => input.value);
      const denies = [...form.querySelectorAll('[name="denies"]:checked')].map(input => input.value);
      const formError = root.querySelector('[data-staff-error]');
      formError.textContent = '';
      if (!form.reportValidity()) return;
      if (!roles.length && !grants.length) { formError.textContent = 'Selecciona al menos un puesto de trabajo.'; form.querySelector('[name="roles"]').focus(); return; }
      const active = form.elements.active.checked;
      if (selected?.active && !active && !window.confirm(`¿Desactivar a ${selected.name}? Perderá acceso a sus vistas asignadas.`)) return;
      const save = root.querySelector('[data-staff-save]');
      save.disabled = true;
      try {
        const payload = { name:form.elements.name.value.trim(), username:form.elements.username.value.trim(), password:form.elements.password.value, roles, grants, denies, waiterId:form.elements.waiterId.value || null, active };
        if (selected && !window.confirm(`¿Guardar los cambios de acceso de ${selected.name}? Sus sesiones activas se cerrarán.`)) return;
        await request(selected ? `/api/admin/users/${encodeURIComponent(selected.id)}` : '/api/admin/users', { method:selected ? 'PATCH' : 'POST', body:JSON.stringify(payload) });
        const message = selected ? `Accesos de ${payload.name} actualizados.` : `Usuario ${payload.name} creado.`;
        dialog.close();
        await loadUsers();
        showMessage(message);
      } catch (error) { formError.textContent = error.message; }
      finally { save.disabled = false; }
    });
    await loadUsers();
  }

  const renderFatal = (error) => {
    root.innerHTML = `${header()}<main class="confirmation"><div class="confirmation__icon">!</div><h1>No pudimos abrir esta vista</h1><p>${escapeHtml(error.message)}</p></main>`;
  };

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-admin-theme-toggle]')) {
      const nextTheme = document.body.dataset.adminTheme === 'gold' ? 'blue' : 'gold';
      try { localStorage.setItem(adminThemeKey, nextTheme); } catch {}
      setAdminTheme(nextTheme);
      return;
    }
    if (event.target.closest('[data-admin-nav-toggle]')) {
      const drawer = root.querySelector('#admin-navigation');
      if (!drawer) return;
      drawer.inert = false;
      drawer.setAttribute('aria-hidden', 'false');
      root.querySelector('[data-admin-nav-toggle]').setAttribute('aria-expanded', 'true');
      document.body.classList.add('admin-nav-open');
      window.setTimeout(() => { if (document.body.classList.contains('admin-nav-open')) drawer.querySelector('.admin-drawer__head [data-admin-nav-close]')?.focus(); }, 50);
      return;
    }
    if (event.target.closest('[data-admin-nav-close]')) {
      const drawer = root.querySelector('#admin-navigation');
      if (!drawer) return;
      document.body.classList.remove('admin-nav-open');
      drawer.inert = true;
      drawer.setAttribute('aria-hidden', 'true');
      const toggle = root.querySelector('[data-admin-nav-toggle]');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
      return;
    }
    const button = event.target.closest('[data-admin-logout]');
    if (!button) return;
    button.disabled = true;
    await fetch('/api/admin/logout', { method:'POST', credentials:'same-origin' }).catch(() => {});
    location.assign(appUrl('/admin/login/'));
  });

  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('admin-nav-open')) return;
    const drawer = root.querySelector('#admin-navigation');
    if (event.key === 'Escape') {
      event.preventDefault();
      drawer?.querySelector('[data-admin-nav-close]')?.click();
      return;
    }
    if (event.key !== 'Tab' || !drawer) return;
    const controls = [...drawer.querySelectorAll('button,a')];
    const first = controls[0], last = controls.at(-1);
    if (!drawer.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });


  let adminSwipeStart = null;
  document.addEventListener('touchstart', (event) => {
    if (!document.body.classList.contains('admin-nav-open') || !event.target.closest('.admin-drawer')) return;
    const touch = event.changedTouches[0];
    adminSwipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (!adminSwipeStart) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - adminSwipeStart.x;
    const deltaY = touch.clientY - adminSwipeStart.y;
    adminSwipeStart = null;
    if (deltaX < -70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) root.querySelector('.admin-drawer [data-admin-nav-close]')?.click();
  }, { passive: true });

  try {
    const internalChannel = page === 'channel' && (new URLSearchParams(location.search).get('modo') === 'interno' || new URLSearchParams(location.search).get('tipo') === 'counter');
    if (!isStaticDemo && (['admin','reservations','kitchen','qr','staff','availability'].includes(page) || internalChannel)) {
      const response = await fetch('/api/admin/session', { credentials:'same-origin', cache:'no-store' });
      if (!response.ok) { location.assign('/admin/login/'); return; }
      const session = await response.json();
      adminPermissions = new Set(session.permissions || []);
      adminOperations = new Set(session.operations || []);
      adminRoles = session.roles || [];
      adminAssignedTables = session.assignedTables || [];
      adminWaiterId = session.waiterId || null;
      adminRole = session.role;
    }
    if (page === 'catalog') Promise.resolve(initMenu({ ordering: false })).catch(renderFatal);
    if (page === 'table') Promise.resolve(initMenu({ ordering: true, channel: 'table' })).catch(renderFatal);
    if (page === 'channel') {
      const params = new URLSearchParams(location.search);
      const requested = params.get('tipo');
      const internalMode = params.get('modo') === 'interno' || requested === 'counter';
      const channel = internalMode ? (requested === 'takeaway' ? 'takeaway' : 'counter') : 'takeaway';
      Promise.resolve(initMenu({ ordering: true, channel, internalMode })).catch(renderFatal);
    }
    if (page === 'admin') Promise.resolve(initAdmin()).catch(renderFatal);
    if (page === 'reservations') Promise.resolve(initReservations()).catch(renderFatal);
    if (page === 'kitchen') Promise.resolve(initKitchen()).catch(renderFatal);
    if (page === 'qr') Promise.resolve(initQr()).catch(renderFatal);
    if (page === 'staff') Promise.resolve(initStaff()).catch(renderFatal);
    if (page === 'availability') Promise.resolve(initAvailability()).catch(renderFatal);
  } catch (error) { renderFatal(error); }
})();
