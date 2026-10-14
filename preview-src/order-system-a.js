(() => {
  const page = document.body.dataset.orderPage;
  const root = document.getElementById('bocc-order-root');
  if (!page || !root) return;
  const appUrl = window.BoccStaticDemo?.appUrl || ((path = '/') => path);
  const isStaticDemo = Boolean(window.BoccStaticDemo?.enabled);

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const money = (value) => Number.isFinite(Number(value)) ? `₡${Number(value).toLocaleString('en-US')}` : 'Consultar';
  const time = (value) => new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const iconSearch = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg>';
  const iconTable = '<svg class="table-option__icon" aria-hidden="true" viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 29h48l-5 23H29l-5-23Z" fill="currentColor" fill-opacity=".1"></path><path d="M32 52l-4 13m36-13 4 13"></path><path d="M11 31h10v20H11V31Zm64 0h10v20H75V31Z"></path><path d="M13 26h6m58 0h6M38 18h20"></path><path d="M42 18v11m12-11v11"></path><path d="M45 11h6l-1 7h-4l-1-7Z"></path></svg>';
  const iconLock = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>';
  const iconBag = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 13H6L5 8Z"></path><path d="M9 9V6a3 3 0 0 1 6 0v3"></path></svg>';
  const iconCounter = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16v10H4zM7 10V5h10v5"></path><path d="M8 14h3m5 0h1m-9 3h9"></path></svg>';
  const iconCalendar = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4m8-4v4M3 10h18"></path><path d="M8 14h3m2 0h3m-8 3h3"></path></svg>';

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
    return `<header class="order-header${centralLink ? ' order-header--with-back' : ''}">
      <a class="order-brand" href="${appUrl(internal ? '/admin/pedidos/' : '/?hero=a')}">
        <span class="order-brand__mark">B</span><span><strong>BOCCANTINA</strong><small>Cantina de vinos</small></span>
      </a>
      <div class="order-header__meta">
        ${centralLink ? `<a class="header-back-link" href="${appUrl('/admin/pedidos/')}" aria-label="Volver a la central del restaurante"><span aria-hidden="true">←</span><span class="header-back-link__long">Volver a la central</span><span class="header-back-link__short">Central</span></a>` : ''}
        <span class="environment-badge">${isStaticDemo ? 'DEMO GITHUB · NO PRODUCCIÓN' : 'PRUEBA LOCAL · NO PRODUCCIÓN'}</span>
        ${table ? `<span class="table-badge">Mesa ${escapeHtml(table)}</span>` : context ? `<span class="table-badge">${escapeHtml(context)}</span>` : ''}
      </div>
    </header>`;
  }

  function catalogData() {
    const catalog = window.BoccMenuCatalog;
    if (!catalog?.products?.length) throw new Error('No se pudo cargar el catálogo.');
    return catalog;
  }

  function productImage(product) {
    return appUrl(product.image.startsWith('/') ? product.image : `/${product.image}`);
  }

  function tagLabel(tag) {
    return ({ recommended: 'Recomendado', share: 'Para compartir', vegetarian: 'Vegetariano', spicy: 'Picante' })[tag] || tag;
  }

  const channelLabel = (channel) => ({ table: 'Mesa', takeaway: 'Para llevar', counter: 'Caja' })[channel || 'table'] || 'Pedido';
  const sourceLabel = (source) => ({ web: 'Web', phone: 'Teléfono', whatsapp: 'WhatsApp', 'walk-in': 'Presencial', manual: 'Manual' })[source] || 'Manual';
  const orderContext = (order) => (order.channel || 'table') === 'table' ? `Mesa ${order.table}` : channelLabel(order.channel);
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
    const primaryAction = item.status === 'pending' ? `<button class="primary-button" type="button" data-reservation-status="confirmed" data-reservation="${escapeHtml(item.id)}" ${item.table ? '' : `disabled aria-describedby="reservation-help-${escapeHtml(item.id)}"`}>Confirmar reservación</button>`
      : item.status === 'confirmed' ? `<button class="primary-button" type="button" data-reservation-status="seated" data-reservation="${escapeHtml(item.id)}" ${item.table ? '' : `disabled aria-describedby="reservation-help-${escapeHtml(item.id)}"`}>Registrar llegada</button>`
      : item.status === 'seated' ? `<button class="primary-button" type="button" data-release-reservation="${escapeHtml(item.id)}">Cliente se retiró · liberar mesa</button>` : '';
    const actions = editActions || primaryAction ? `<footer class="reservation-card__actions">${editActions}${primaryAction}${helper}</footer>` : '';
    const statusLabel = ({ pending: 'Pendiente', confirmed: 'Confirmada', seated: 'Cliente en mesa', completed: 'Cumplida', cancelled: 'Cancelada' })[item.status] || 'Actualizada';
    return `<article class="reservation-card" data-reservation-card="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(sourceLabel(item.source))}</span></div><b data-reservation-state="${item.status}">${statusLabel}</b></header><dl><div><dt>Fecha</dt><dd>${escapeHtml(item.date)} · ${escapeHtml(item.time)}</dd></div><div><dt>Grupo</dt><dd>${escapeHtml(item.guests)} personas</dd></div><div><dt>Cliente</dt><dd>${escapeHtml(item.name)} · ${escapeHtml(item.phone)}</dd></div><div><dt>Mesa</dt><dd>${item.table ? `Mesa ${escapeHtml(item.table)}` : 'Pendiente de asignación'}</dd></div>${item.preferences ? `<div><dt>Notas</dt><dd>${escapeHtml(item.preferences)}</dd></div>` : ''}</dl>${assignment}${actions}</article>`;
  }

  async function initMenu({ ordering, channel = 'catalog', internalMode = false }) {
    const { categories, products } = catalogData();
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
    if (ordering && isTable) await request(`/api/tables/${encodeURIComponent(table)}/open`, { method: 'POST', body: '{}' });

    let extrasConfig = window.BoccMenuExtrasConfig?.load() || { products: {} };
    if (window.BoccMenuExtrasConfig?.hydrate) {
      extrasConfig = await window.BoccMenuExtrasConfig.hydrate().catch(() => extrasConfig);
    }
    const state = { category: categories[0].id, query: '', cart: [], selected: null, quantity: 1, table, ordering, channel };

    root.innerHTML = `<main class="order-shell">
      ${header({ table: ordering && isTable ? table : null, internal: internalMode, centralLink: internalMode, context: ordering && !isTable ? channelName : null })}
      ${internalMode ? `<section class="order-mode-selector" aria-labelledby="order-mode-title">
        <div><p class="order-eyebrow">Nuevo pedido</p><h1 id="order-mode-title">Selecciona el tipo de pedido</h1><p>Registra la orden desde una sola pantalla. Cocina y administración recibirán siempre el canal correctamente identificado.</p></div>
        <nav aria-label="Tipo de pedido">
          <a href="${appUrl('/pedido/?modo=interno&amp;tipo=counter')}" data-order-mode ${channel === 'counter' ? 'aria-current="page"' : ''}><span>${iconCounter}<strong>Pedido en caja</strong></span><small>Orden presencial registrada por el personal.</small></a>
          <a href="${appUrl('/pedido/?modo=interno&amp;tipo=takeaway')}" data-order-mode ${channel === 'takeaway' ? 'aria-current="page"' : ''}><span>${iconBag}<strong>Para llevar</strong></span><small>Solicita nombre y teléfono y genera código de retiro.</small></a>
        </nav>
      </section>` : ''}
      <section class="order-hero${internalMode ? ' order-hero--internal' : ''}">
        <div><p class="order-eyebrow">${ordering ? `Pedido digital · ${escapeHtml(channelName)}` : 'Carta digital · Solo consulta'}</p>
          <${internalMode ? 'h2' : 'h1'} class="order-hero__title">${ordering ? (isTable ? 'Tu mesa, a tu ritmo.' : channel === 'takeaway' ? 'Tu pedido, para llevar.' : 'Pedido desde caja.') : 'La carta, sin prisas.'}</${internalMode ? 'h2' : 'h1'}>
          <p class="order-hero__intro">${ordering ? (isTable ? 'Explora la carta, personaliza cada plato y envía el pedido directamente al equipo. El número de mesa viaja con cada comanda.' : channel === 'takeaway' ? 'Elige tus platos y deja un nombre y teléfono para identificar el retiro en el restaurante.' : 'Registra el pedido que recibe el personal en caja y envíalo a la misma central de cocina.') : 'Explora platos, ingredientes y precios. Para ordenar dentro del restaurante, escanea el código QR colocado en tu mesa.'}</p>
        </div>
        <aside class="order-hero__aside">
          <strong>${ordering && isTable ? '¿Necesitas atención?' : ordering ? 'Origen identificado' : 'Carta visual'}</strong>
          <p>${ordering && isTable ? 'Puedes llamar al mesero o solicitar una explicación sin abandonar tu pedido.' : ordering ? `La central y cocina verán este pedido identificado como “${escapeHtml(channelName)}”.` : 'Esta página no envía órdenes. El sistema de pedidos se abre desde el QR de mesa o desde el acceso para llevar.'}</p>
          ${ordering && isTable ? '<div class="dialog-actions" style="justify-content:flex-start;margin-top:16px"><button class="secondary-button" type="button" data-service="waiter">Llamar al mesero</button><button class="secondary-button" type="button" data-service="help">Solicitar ayuda</button></div><p class="feedback" data-service-feedback role="status" aria-live="polite"></p>' : !ordering ? `<div class="dialog-actions" style="justify-content:flex-start;margin-top:16px"><a class="primary-button" href="${appUrl('/pedido/?tipo=takeaway')}">Hacer pedido para llevar</a></div>` : ''}
        </aside>
      </section>
      ${ordering && !isTable && !internalMode ? '<section class="order-tracking-entry"><div><p class="order-eyebrow">Seguimiento y ayuda</p><strong>¿Ya hiciste un pedido?</strong><span>Recupéralo con la referencia y el código de retiro, incluso desde otro dispositivo.</span></div><button class="secondary-button" type="button" data-open-tracker>Consultar mi pedido</button></section>' : ''}
      <section class="menu-toolbar" aria-label="Herramientas de la carta">
        <label class="menu-search"><span class="sr-only">Buscar platos</span>${iconSearch}<input type="search" name="menu-search" placeholder="Buscar plato o ingrediente…" data-search></label>
        <nav class="category-tabs" aria-label="Categorías" data-categories></nav>
      </section>
      <section class="menu-content">
        <header class="menu-heading"><div><h2 data-category-title></h2><p data-category-description></p></div><span data-results></span></header>
        <div class="product-grid" data-products></div>
      </section>
      ${ordering ? '<section class="cart-dock" data-cart-dock hidden><div><small data-cart-count></small><strong data-cart-total></strong></div><button class="primary-button" type="button" data-open-cart>Revisar pedido</button></section>' : ''}
      <dialog class="order-dialog" data-product-dialog></dialog>
      ${ordering ? '<dialog class="order-dialog" data-cart-dialog></dialog>' : ''}
      ${ordering && !isTable && !internalMode ? '<dialog class="order-dialog" data-tracker-dialog><header class="dialog-header"><div><h2>Consultar pedido</h2><p>Usa los datos entregados al confirmar la orden.</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header><form class="dialog-body" data-track-form><label class="field">Referencia del pedido<input name="code" required placeholder="BOC-000" autocomplete="off"></label><label class="field">Código de retiro<input name="pickupCode" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" autocomplete="one-time-code"></label><p class="feedback" data-track-feedback role="status" aria-live="polite"></p><div class="dialog-actions"><button class="secondary-button" type="button" data-close>Cancelar</button><button class="primary-button" type="submit">Ver estado</button></div></form></dialog>' : ''}
    </main>`;

    const el = (selector) => root.querySelector(selector);
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

    function renderCategories() {
      el('[data-categories]').innerHTML = categories.map((category) => `<button type="button" data-category="${category.id}" aria-pressed="${!state.query && state.category === category.id}">${escapeHtml(category.es)}</button>`).join('');
    }

    function renderProducts() {
      const items = filteredProducts();
      const category = categoryById(state.category);
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
        return `<article class="menu-spread" aria-labelledby="menu-spread-${escapeHtml(group.category.id)}">
          <figure class="menu-spread__visual">
            <img src="${escapeHtml(productImage(heroProduct))}" alt="Presentación de ${escapeHtml(group.category.es)}" width="720" height="960" ${groupIndex ? 'loading="lazy"' : ''}>
            <figcaption><span>Carta Boccantina</span><strong>${escapeHtml(group.category.es)}</strong><small>${categoryNumber}</small></figcaption>
          </figure>
          <section class="menu-spread__catalog">
            <header class="menu-spread__header"><div><span>Selección de la casa</span><h3 id="menu-spread-${escapeHtml(group.category.id)}">${escapeHtml(group.category.es)}</h3></div><p>${escapeHtml(group.category.esDescription)}</p></header>
            <div class="menu-spread__items">${group.items.map((product) => `<article class="product-card${product.soldOut ? ' is-sold-out' : ''}">
              <div class="product-card__body"><div class="product-card__top"><h4>${escapeHtml(product.nameEs)}</h4><span class="product-card__price">${money(product.price)}</span></div>
              <p class="product-card__description">${escapeHtml(product.descEs)}</p>
              <footer class="product-card__footer"><div class="product-tags">${product.tags.map((tag) => `<span>${tagLabel(tag)}</span>`).join('')}</div>
              ${ordering ? `<div class="product-card__actions"><button class="secondary-button" type="button" data-detail="${product.id}">Detalles</button><button class="primary-button" type="button" data-add="${product.id}" ${product.soldOut || product.price === null ? 'disabled' : ''}>${product.soldOut ? 'Agotado' : product.price === null ? 'Consultar' : 'Agregar pedido'}</button></div>` : `<div class="product-card__actions"><button class="secondary-button" type="button" data-detail="${product.id}">Ver detalles</button></div>`}</footer></div>
            </article>`).join('')}</div>
          </section>
        </article>`;
      }).join('');
    }

    function extrasFor(product) {
      const config = extrasConfig.products?.[product.id];
      return config?.enabled ? config.extras.filter((extra) => extra.nameEs?.trim()) : [];
    }

    function openProduct(product, readOnly = false) {
      state.selected = product;
      state.quantity = 1;
      const extras = extrasFor(product);
      const dialog = el('[data-product-dialog]');
      dialog.innerHTML = `<header class="dialog-header"><div><h2>${escapeHtml(product.nameEs)}</h2><p>${money(product.price)}</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header>
        <div class="dialog-body"><p>${escapeHtml(product.descEs)}</p>
          ${!readOnly && extras.length ? `<fieldset><legend>Extras para este plato</legend><div class="extra-list">${extras.map((extra) => `<label class="extra-option"><input type="checkbox" value="${escapeHtml(extra.id)}" data-extra><span>${escapeHtml(extra.nameEs)}</span><small>${extra.price === null ? 'Precio pendiente' : `+${money(extra.price)}`}</small></label>`).join('')}</div></fieldset>` : ''}
          ${!readOnly ? `<label class="field">Indicación de preparación<textarea data-item-note maxlength="180" placeholder="Ej. sin cebolla"></textarea></label>
          <div class="quantity-picker" aria-label="Cantidad"><button type="button" data-quantity="minus" aria-label="Restar">−</button><output data-quantity-output>1</output><button type="button" data-quantity="plus" aria-label="Sumar">+</button></div>
          <div class="dialog-actions"><button class="primary-button" type="button" data-confirm-item>Agregar al pedido</button></div>` : ''}
        </div>`;
      dialog.showModal();
    }

    function renderCartDock() {
      if (!ordering) return;
      const dock = el('[data-cart-dock]');
      const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
      dock.hidden = count === 0;
      el('[data-cart-count]').textContent = `${count} ${count === 1 ? 'producto' : 'productos'} · ${channelName}`;
      el('[data-cart-total]').textContent = `Total estimado: ${money(cartTotal())}`;
    }

    function openCart() {
      const dialog = el('[data-cart-dialog]');
      dialog.innerHTML = `<header class="dialog-header"><div><h2>Tu pedido</h2><p>${escapeHtml(channelName)}</p></div><button class="dialog-close" type="button" data-close aria-label="Cerrar">×</button></header>
        <div class="dialog-body"><div class="cart-lines">${state.cart.map((item, index) => `<article class="cart-line"><div class="cart-line__top"><h3>${item.quantity} × ${escapeHtml(item.product.nameEs)}</h3><strong>${money(itemUnitTotal(item) * item.quantity)}</strong></div>${item.extras.length ? `<ul>${item.extras.map((extra) => `<li>+ ${escapeHtml(extra.nameEs)}${extra.price === null ? '' : ` (${money(extra.price)})`}</li>`).join('')}</ul>` : ''}${item.note ? `<p><small>Nota: ${escapeHtml(item.note)}</small></p>` : ''}<div class="cart-line__actions"><button type="button" data-remove-line="${index}">Quitar</button></div></article>`).join('')}</div>
          ${!isTable ? `<div class="order-contact-fields"><label class="field">Nombre ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-name maxlength="100" autocomplete="name" ${channel === 'takeaway' ? 'required' : ''}></label><label class="field">Teléfono ${channel === 'takeaway' ? '<span>Obligatorio</span>' : '<span>Opcional</span>'}<input data-customer-phone type="tel" inputmode="tel" maxlength="40" autocomplete="tel" ${channel === 'takeaway' ? 'required' : ''}></label></div>` : ''}
          <label class="field">Nota general del pedido<textarea data-order-note maxlength="240" placeholder="Ej. entregar bebidas primero"></textarea></label>
          <div class="cart-total"><span>Total estimado</span><span>${money(cartTotal())}</span></div>
          <p class="feedback" data-order-feedback role="status" aria-live="polite"></p>
          <div class="dialog-actions"><button class="secondary-button" type="button" data-close>Seguir agregando</button><button class="primary-button" type="button" data-send-order>Enviar pedido</button></div>
        </div>`;
      dialog.showModal();
    }

    async function sendOrder(button) {
      const feedback = el('[data-order-feedback]');
      if (channel === 'takeaway') {
        const missing = [el('[data-customer-name]'), el('[data-customer-phone]')].find((input) => !input?.value.trim());
        if (missing) { feedback.textContent = 'Completa el nombre y el teléfono para identificar el retiro.'; feedback.dataset.state = 'error'; missing.focus(); return; }
      }
      button.disabled = true;
      feedback.textContent = 'Enviando pedido a la central…';
      try {
        const result = await request('/api/orders', { method: 'POST', body: JSON.stringify({
          channel,
          table: isTable ? Number(table) : null,
          customerName: el('[data-customer-name]')?.value.trim() || '',
          phone: el('[data-customer-phone]')?.value.trim() || '',
          note: el('[data-order-note]')?.value.trim() || '',
          items: state.cart.map((item) => ({ productId: item.product.id, name: item.product.nameEs, quantity: item.quantity, unitPrice: item.product.price, extras: item.extras.map((extra) => ({ id: extra.id, name: extra.nameEs, price: extra.price })), note: item.note })),
          total: cartTotal()
        }) });
        el('[data-cart-dialog]').close();
        renderConfirmation(result.order);
      } catch (error) {
        feedback.textContent = error.message;
        feedback.dataset.state = 'error';
        button.disabled = false;
      }
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
      const contextText = order.channel === 'table' ? `la mesa ${order.table}` : pickup ? 'tu pedido para llevar' : 'el pedido de caja';
      root.innerHTML = `${header({ table: order.table, internal: internalMode, centralLink: internalMode, context: order.table ? null : channelName })}<main class="confirmation confirmation--tracking">
        <div class="confirmation__icon">✓</div><p class="order-eyebrow">Pedido recibido por la central</p><h1>Tu pedido está registrado.</h1>
        <p>${internalMode ? 'La orden ya está visible en la central y conserva su canal de atención.' : 'Conserva estos datos para recuperar el seguimiento y verificar la entrega.'}</p>
        <section class="order-identity" aria-label="Datos para identificar el pedido"><div><small>Referencia</small><strong>${escapeHtml(order.code)}</strong></div>${pickup ? `<div><small>Código de retiro</small><strong>${escapeHtml(order.pickupCode)}</strong></div>` : ''}<div><small>Pago</small><strong data-client-payment>${escapeHtml(paymentLabel(order))}</strong></div></section>
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
      if (!event.target.matches('[data-search]')) return;
      state.query = event.target.value;
      renderCategories();
      renderProducts();
    });
    root.addEventListener('click', async (event) => {
      const orderMode = event.target.closest('[data-order-mode]');
      if (orderMode && state.cart.length && !window.confirm('Cambiar el tipo de pedido vaciará los productos agregados. ¿Deseas continuar?')) { event.preventDefault(); return; }
      if (event.target.closest('[data-open-tracker]')) { el('[data-tracker-dialog]').showModal(); return; }
      const category = event.target.closest('[data-category]');
      if (category) {
        state.category = category.dataset.category;
        state.query = '';
        el('[data-search]').value = '';
        renderCategories();
        renderProducts();
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
        state.cart.push({ product: state.selected, quantity: state.quantity, extras: options.filter((extra) => selectedIds.includes(extra.id)), note: el('[data-item-note]')?.value.trim() || '' });
        el('[data-product-dialog]').close(); renderCartDock(); return;
      }
      if (event.target.closest('[data-open-cart]')) { openCart(); return; }
      const remove = event.target.closest('[data-remove-line]');
      if (remove) { state.cart.splice(Number(remove.dataset.removeLine), 1); el('[data-cart-dialog]').close(); renderCartDock(); if (state.cart.length) openCart(); return; }
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
    renderCategories(); renderProducts(); renderCartDock();
  }

  function receipt(order) {
    return `<section class="receipt-print" aria-hidden="true"><h1>BOCCANTINA</h1><h2>${escapeHtml(orderContext(order).toUpperCase())}</h2><p>ORDEN: ${escapeHtml(order.code)}</p>${order.channel === 'takeaway' ? `<p>RETIRO: ${escapeHtml(order.pickupCode)}</p>` : ''}<p>${escapeHtml(time(order.createdAt))}</p>${order.customerName ? `<p>CLIENTE: ${escapeHtml(order.customerName)}</p>` : ''}<hr><ul>${order.items.map((item) => `<li><strong>${item.quantity} x ${escapeHtml(item.name)}</strong>${item.extras?.map((extra) => `<small>+ ${escapeHtml(extra.name)}</small>`).join('') || ''}${item.note ? `<small>NOTA: ${escapeHtml(item.note)}</small>` : ''}</li>`).join('')}</ul><hr>${order.note ? `<p class="receipt-note">NOTA: ${escapeHtml(order.note)}</p>` : ''}<p class="receipt-total"><span>TOTAL</span><span>${money(order.total)}</span></p><p>COBRO: ${escapeHtml(paymentLabel(order).toUpperCase())}</p><hr><p style="text-align:center">${escapeHtml(orderStatusLabel(order.status).toUpperCase())} · COCINA</p></section>`;
  }

  async function initAdmin() {
    const environmentNotice = isStaticDemo
      ? '<strong>Demostración pública aislada:</strong> los datos se guardan únicamente en este navegador. No se comparten con otros dispositivos ni procesan pedidos reales.'
      : '<strong>Entorno de prueba:</strong> este panel local no tiene todavía autenticación. No debe exponerse a internet hasta añadir usuarios, permisos, base de datos y copias de seguridad.';
    root.innerHTML = `<main class="admin-shell">${header({ internal: true })}<section class="admin-toolbar"><div><h1>Central del restaurante</h1><p>Pedidos, mesas y equipo de sala en un mismo lugar.</p></div><div class="admin-actions"><span class="connection-state" data-connection>Actualización automática</span><a class="secondary-button" href="${appUrl('/admin/cocina/')}">Vista cocina</a><a class="primary-button" href="${appUrl('/pedido/?modo=interno')}">Nuevo pedido</a><a class="secondary-button" href="${appUrl('/qr-mesas/')}">Mesas y QR</a><a class="secondary-button admin-reservations-button" href="${appUrl('/admin/reservaciones/')}">${iconCalendar}<span>Reservaciones</span><b data-reservation-nav-count aria-label="0 reservaciones activas">0</b></a><button class="secondary-button" type="button" data-refresh>Actualizar</button></div></section><div class="admin-alert">${environmentNotice}</div><section class="active-tables" data-active-tables aria-label="Mesas ocupadas"></section><section data-service-requests></section><section class="admin-board" data-board></section><section class="operations-grid operations-grid--single"><div class="operations-panel"><header><p class="order-eyebrow">Equipo de sala</p><h2>Meseros</h2><p>Agrega al equipo y asígnalo desde cada mesa activa.</p></header><form class="compact-form" data-waiter-form><label>Nombre del mesero<input name="name" required minlength="2" autocomplete="off"></label><button class="primary-button" type="submit">Agregar</button></form><div class="staff-list" data-waiters></div></div></section><div data-receipt></div></main>`;
    let known = new Set();
    let lastOrdersSignature = '';
    let lastRequestsSignature = '';
    let lastTablesSignature = '';
    let lastOperationsSignature = '';
    const statuses = [
      { id: 'pending', label: 'Nuevos' }, { id: 'confirmed', label: 'Confirmados' }, { id: 'preparing', label: 'En cocina' }, { id: 'ready', label: 'Listos' }, { id: 'payment-due', label: 'Por cobrar' }
    ];
    function card(order) {
      const next = ({ pending: ['confirmed', 'Confirmar'], confirmed: ['preparing', 'Enviar a cocina'], preparing: ['ready', 'Marcar listo'], ready: ['delivered', 'Entregado'] })[order.status];
      const paid = order.paymentStatus === 'paid';
      return `<article class="order-card ${order.status === 'pending' ? 'is-new' : ''}" data-order-card="${escapeHtml(order.id)}">
        <header class="order-card__head"><div><strong>${escapeHtml(order.code)}</strong><time>${escapeHtml(time(order.createdAt))}</time></div><span>${escapeHtml(orderContext(order))}</span></header>
        ${order.customerName ? `<p class="order-card__customer"><strong>${escapeHtml(order.customerName)}</strong>${order.phone ? ` · ${escapeHtml(order.phone)}` : ''}</p>` : ''}
        ${order.channel === 'takeaway' ? `<p class="pickup-verification"><small>Código de retiro</small><strong>${escapeHtml(order.pickupCode)}</strong></p>` : ''}
        <ul>${order.items.map((item) => `<li><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>${item.extras?.map((extra) => `<small>+ ${escapeHtml(extra.name)}</small>`).join('') || ''}${item.note ? `<small>Nota: ${escapeHtml(item.note)}</small>` : ''}</li>`).join('')}</ul>
        ${order.note ? `<p><small>Nota del pedido: ${escapeHtml(order.note)}</small></p>` : ''}
        <div class="order-card__total"><span>Total</span><span>${money(order.total)}</span></div>
        <section class="payment-control" data-payment-state="${paid ? 'paid' : 'unpaid'}"><div><small>Estado de cobro</small><strong>${escapeHtml(paymentLabel(order))}</strong></div>${paid ? `<button class="secondary-button" type="button" data-payment-action="unpaid" data-order="${order.id}">Corregir a pendiente</button>` : `<label>Método<select name="payment-method-${escapeHtml(order.id)}" data-payment-method="${order.id}"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="sinpe">SINPE</option><option value="other">Otro</option></select></label><button class="primary-button" type="button" data-payment-action="paid" data-order="${order.id}">Registrar pago</button>`}</section>
        <div class="order-card__buttons">${next ? `<button class="primary-button" type="button" data-status="${next[0]}" data-order="${order.id}">${next[1]}</button>` : ''}<button class="secondary-button" type="button" data-print="${order.id}" ${order.status === 'pending' ? 'disabled title="Confirma el pedido antes de imprimir"' : ''}>Imprimir</button></div>
      </article>`;
    }

    async function refresh({ silent = false } = {}) {
      try {
        const [{ orders }, { requests }, { tables }, { waiters }, { reservations }] = await Promise.all([request('/api/orders'), request('/api/service-requests'), request('/api/tables?count=100'), request('/api/waiters'), request('/api/reservations')]);
        root.querySelector('[data-connection]').classList.remove('is-error');
        root.querySelector('[data-connection]').textContent = 'Actualización automática';
        const active = orders.filter((order) => order.status !== 'cancelled' && (order.status !== 'delivered' || order.paymentStatus !== 'paid'));
        const ordersSignature = JSON.stringify(active.map((order) => [order.id, order.status, order.paymentStatus, order.updatedAt]));
        if (ordersSignature !== lastOrdersSignature) {
          root.querySelector('[data-board]').innerHTML = statuses.map((status) => { const list = active.filter((order) => status.id === 'payment-due' ? order.status === 'delivered' && order.paymentStatus !== 'paid' : order.status === status.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); return `<section class="admin-column"><header class="admin-column__head"><h2>${status.label}</h2><span>${list.length}</span></header>${list.length ? list.map(card).join('') : '<div class="admin-empty">Sin pedidos</div>'}</section>`; }).join('');
          lastOrdersSignature = ordersSignature;
        }
        const pendingRequests = requests.filter((item) => item.status === 'pending');
        const requestsSignature = JSON.stringify(pendingRequests.map((item) => [item.id, item.status, item.type]));
        if (requestsSignature !== lastRequestsSignature) {
          root.querySelector('[data-service-requests]').innerHTML = pendingRequests.length ? `<div class="admin-alert"><strong>Solicitudes de ayuda:</strong> ${pendingRequests.map((item) => `<button class="secondary-button" style="margin:6px" type="button" data-resolve-request="${item.id}">${item.table ? `Mesa ${item.table} · ${item.type === 'waiter' ? 'llamar mesero' : 'ayuda'}` : `${escapeHtml(item.orderCode || 'Pedido')} · ${item.type === 'payment-review' ? 'revisar pago' : 'ayuda remota'}`}</button>`).join('')}</div>` : '';
          lastRequestsSignature = requestsSignature;
        }
        const occupiedTables = tables.filter((item) => item.status === 'occupied');
        const tablesSignature = JSON.stringify([occupiedTables.map((item) => [item.table, item.activeOrders, item.unpaidOrders, item.totalOrders, item.canRelease, item.updatedAt, item.waiterId]), waiters.map((item) => [item.id, item.name])]);
        if (tablesSignature !== lastTablesSignature) {
          root.querySelector('[data-active-tables]').innerHTML = occupiedTables.length ? `<div class="active-tables__head"><div><p class="order-eyebrow">Estado del salón</p><h2>Mesas activas</h2></div><span>${occupiedTables.length} ${occupiedTables.length === 1 ? 'ocupada' : 'ocupadas'}</span></div><div class="active-tables__grid">${occupiedTables.map((item) => `<article class="active-table"><div><strong>Mesa ${item.table}</strong><small>${item.activeOrders ? `${item.activeOrders} pedido${item.activeOrders === 1 ? '' : 's'} activo${item.activeOrders === 1 ? '' : 's'}` : item.unpaidOrders ? 'Consumo finalizado · pago pendiente' : item.totalOrders ? 'Cuenta pagada · cliente aún en la mesa' : 'Sesión abierta · todavía sin pedido'}</small><label>Mesero asignado<select data-assign-waiter="${item.table}"><option value="">Sin asignar</option>${waiters.map((waiter) => `<option value="${waiter.id}" ${item.waiterId === waiter.id ? 'selected' : ''}>${escapeHtml(waiter.name)}</option>`).join('')}</select></label></div><button class="secondary-button" type="button" data-release-table="${item.table}" ${item.canRelease ? '' : 'disabled title="Finaliza los pedidos y registra el pago antes de liberar"'}>${item.canRelease ? (item.totalOrders ? 'Cliente se retiró · liberar' : 'Cerrar sesión de mesa') : item.unpaidOrders ? 'Pago pendiente' : 'Finaliza los pedidos'}</button></article>`).join('')}</div>` : '';
          lastTablesSignature = tablesSignature;
        }
        const activeReservations = reservations.filter((item) => !['cancelled', 'completed'].includes(item.status));
        const reservationCount = root.querySelector('[data-reservation-nav-count]');
        reservationCount.textContent = activeReservations.length;
        reservationCount.setAttribute('aria-label', `${activeReservations.length} reservaciones activas`);
        const operationsSignature = JSON.stringify(waiters.map((item) => [item.id, item.name]));
        if (operationsSignature !== lastOperationsSignature) {
          root.querySelector('[data-waiters]').innerHTML = waiters.length ? waiters.map((waiter) => `<span class="staff-chip">${escapeHtml(waiter.name)}<button type="button" data-remove-waiter="${waiter.id}" aria-label="Quitar a ${escapeHtml(waiter.name)}">×</button></span>`).join('') : '<p class="admin-empty">Agrega al primer mesero para poder asignarlo.</p>';
          lastOperationsSignature = operationsSignature;
        }
        if (!silent && active.some((order) => !known.has(order.id))) document.title = '● Nuevo pedido — Boccantina';
        known = new Set(active.map((order) => order.id));
        root.dataset.orders = JSON.stringify(orders);
      } catch (error) {
        const indicator = root.querySelector('[data-connection]'); indicator.classList.add('is-error'); indicator.textContent = error.message;
      }
    }

    root.addEventListener('click', async (event) => {
      if (event.target.closest('[data-refresh]')) { await refresh(); return; }
      const status = event.target.closest('[data-status]');
      if (status) { status.disabled = true; try { await request(`/api/orders/${encodeURIComponent(status.dataset.order)}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.status }) }); await refresh({ silent: true }); } catch (error) { window.alert(error.message); status.disabled = false; } return; }
      const payment = event.target.closest('[data-payment-action]');
      if (payment) {
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
      if (removeWaiter) { removeWaiter.disabled = true; try { await request(`/api/waiters/${encodeURIComponent(removeWaiter.dataset.removeWaiter)}`, { method: 'DELETE' }); await refresh({ silent: true }); } catch (error) { window.alert(error.message); removeWaiter.disabled = false; } }
    });
    root.addEventListener('change', async (event) => {
      const assignment = event.target.closest('[data-assign-waiter]');
      if (!assignment) return;
      assignment.disabled = true;
      try { await request(`/api/tables/${encodeURIComponent(assignment.dataset.assignWaiter)}/assignment`, { method: 'PUT', body: JSON.stringify({ waiterId: assignment.value }) }); await refresh({ silent: true }); }
      catch (error) { window.alert(error.message); }
      finally { assignment.disabled = false; }
    });
    root.addEventListener('submit', async (event) => {
      const waiterForm = event.target.closest('[data-waiter-form]');
      if (!waiterForm) return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const button = event.target.querySelector('button[type="submit"]'); button.disabled = true;
      try {
        await request('/api/waiters', { method: 'POST', body: JSON.stringify(data) });
        event.target.reset();
        await refresh({ silent: true });
      } catch (error) {
        window.alert(error.message);
      } finally { button.disabled = false; }
    });
    await refresh({ silent: true });
    window.setInterval(() => refresh(), 3000);
  }

  async function initReservations() {
    root.innerHTML = `<main class="admin-shell reservation-page">${header({ internal: true, centralLink: true })}
      <section class="reservation-page-hero">
        <div><p class="order-eyebrow">Agenda del restaurante</p><h1>Reservaciones</h1><p>Centraliza solicitudes, confirma cada visita y asigna la mesa desde una agenda dedicada.</p></div>
        <div class="admin-actions"><span class="connection-state" data-connection>Actualización automática</span><a class="secondary-button" href="${appUrl('/qr-mesas/')}">Mesas y QR</a><button class="secondary-button" type="button" data-refresh>Actualizar</button></div>
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
          <header class="reservation-agenda-header"><div><p class="order-eyebrow">Agenda unificada</p><h2 id="reservation-agenda-title">Agenda y seguimiento</h2><p>Solicitudes activas, cancelaciones y visitas cumplidas en un solo lugar.</p></div><span data-reservation-list-count>0 reservaciones</span></header>
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

    async function refresh() {
      try {
        const { reservations } = await request('/api/reservations');
        const sorted = [...reservations].sort((first, second) => {
          const firstClosed = ['cancelled', 'completed'].includes(first.status);
          const secondClosed = ['cancelled', 'completed'].includes(second.status);
          if (firstClosed && !secondClosed) return 1;
          if (secondClosed && !firstClosed) return -1;
          return `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`);
        });
        reservationState = reservations;
        const active = reservations.filter((item) => !['cancelled', 'completed'].includes(item.status));
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
        root.querySelector('[data-reservation-list-count]').textContent = `${reservations.length} ${reservations.length === 1 ? 'reservación' : 'reservaciones'}`;
        document.title = pending.length ? `${pending.length} pendiente${pending.length === 1 ? '' : 's'} · Reservaciones — Boccantina` : 'Reservaciones — Boccantina';
        const signature = JSON.stringify(sorted.map((item) => [item.id, item.status, item.table, item.updatedAt]));
        if (signature !== lastSignature) {
          root.querySelector('[data-reservations]').innerHTML = sorted.length ? sorted.map((item) => reservationCard(item, reservations)).join('') : '<div class="reservation-empty"><strong>Agenda disponible</strong><p>Todavía no hay reservaciones registradas.</p></div>';
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
      const confirmTrigger = event.target.closest('[data-cancel-reservation], [data-release-reservation]');
      if (confirmTrigger) {
        const id = confirmTrigger.dataset.cancelReservation || confirmTrigger.dataset.releaseReservation;
        const item = reservationState.find((reservation) => reservation.id === id);
        if (!item) return;
        const action = confirmTrigger.hasAttribute('data-cancel-reservation') ? 'cancelled' : 'completed';
        const dialog = root.querySelector('[data-reservation-confirm-dialog]');
        const confirmButton = dialog.querySelector('[data-confirm-reservation-action]');
        dialog.dataset.reservation = id;
        dialog.dataset.action = action;
        dialog.querySelector('[data-confirm-reservation-code]').textContent = `${item.code} · ${item.name}`;
        dialog.querySelector('[data-confirm-reservation-title]').textContent = action === 'cancelled' ? 'Cancelar reservación' : 'Completar visita y liberar mesa';
        dialog.querySelector('[data-confirm-reservation-message]').textContent = action === 'cancelled' ? 'La reservación quedará cancelada y su mesa volverá a estar disponible para ese horario.' : `Se marcará la visita como cumplida y se liberará la mesa ${item.table}. Si existen pedidos activos o pagos pendientes, el sistema impedirá la liberación.`;
        dialog.querySelector('[data-confirm-reservation-feedback]').textContent = '';
        confirmButton.textContent = action === 'cancelled' ? 'Sí, cancelar' : 'Liberar mesa';
        confirmButton.className = action === 'cancelled' ? 'danger-button' : 'primary-button';
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
          await request(`/api/reservations/${encodeURIComponent(dialog.dataset.reservation)}`, { method: 'PATCH', body: JSON.stringify({ status: action }) });
          dialog.close();
          root.querySelector('[data-reservation-page-feedback]').textContent = action === 'cancelled' ? 'Reservación cancelada correctamente.' : 'Visita cumplida y mesa liberada correctamente.';
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
    root.innerHTML = `<main class="admin-shell">${header({ internal: true })}<section class="admin-toolbar"><div><p class="order-eyebrow">Producción</p><h1>Cola de cocina</h1><p>Órdenes confirmadas en orden de llegada, con su origen siempre visible.</p></div><div class="admin-actions"><span class="connection-state" data-connection>Actualización automática</span><a class="secondary-button" href="${appUrl('/admin/pedidos/')}">Volver a central</a><button class="secondary-button" type="button" data-refresh>Actualizar</button></div></section><nav class="queue-filters" aria-label="Filtrar pedidos por origen"><button type="button" data-channel-filter="all" aria-pressed="true">Todos</button><button type="button" data-channel-filter="table" aria-pressed="false">Mesas</button><button type="button" data-channel-filter="takeaway" aria-pressed="false">Para llevar</button><button type="button" data-channel-filter="counter" aria-pressed="false">Caja</button></nav><section class="kitchen-queue" data-kitchen-queue aria-live="polite"></section><div data-receipt></div></main>`;

    function render() {
      const visible = state.orders.filter((order) => ['confirmed', 'preparing', 'ready'].includes(order.status) && (state.filter === 'all' || (order.channel || 'table') === state.filter)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      root.querySelector('[data-kitchen-queue]').innerHTML = visible.length ? visible.map((order, index) => {
        const next = order.status === 'confirmed' ? ['preparing', 'Comenzar preparación'] : order.status === 'preparing' ? ['ready', 'Marcar listo'] : ['delivered', 'Entregado'];
        return `<article class="kitchen-ticket"><header><div><span class="queue-number">#${index + 1}</span><strong>${escapeHtml(order.code)}</strong><time>${escapeHtml(time(order.createdAt))}</time></div><b data-channel="${escapeHtml(order.channel || 'table')}">${escapeHtml(orderContext(order))}</b></header>${order.customerName ? `<p class="kitchen-ticket__customer">Cliente: <strong>${escapeHtml(order.customerName)}</strong></p>` : ''}<div class="kitchen-ticket__meta"><span data-payment-state="${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}">${escapeHtml(paymentLabel(order))}</span>${order.channel === 'takeaway' ? `<span>Retiro ${escapeHtml(order.pickupCode)}</span>` : ''}</div><ul>${order.items.map((item) => `<li><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>${item.extras?.map((extra) => `<small>+ ${escapeHtml(extra.name)}</small>`).join('') || ''}${item.note ? `<small>Nota: ${escapeHtml(item.note)}</small>` : ''}</li>`).join('')}</ul>${order.note ? `<p class="kitchen-ticket__note">${escapeHtml(order.note)}</p>` : ''}<footer><span data-kitchen-state="${order.status}">${order.status === 'confirmed' ? 'Confirmado' : order.status === 'preparing' ? 'En preparación' : 'Listo'}</span><div><button class="secondary-button" type="button" data-print="${order.id}">Imprimir</button><button class="primary-button" type="button" data-kitchen-status="${next[0]}" data-order="${order.id}">${next[1]}</button></div></footer></article>`;
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

  async function initQr() {
    let defaultBase = appUrl('/').replace(/\/$/, '');
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      try {
        const health = await request('/api/health');
        defaultBase = health.networkUrls?.find((url) => /^http:\/\/192\.168\./.test(url)) || health.networkUrls?.[0] || defaultBase;
        defaultBase = defaultBase.replace(/\/$/, '');
      } catch { /* Keep localhost as an editable fallback. */ }
    }
    root.innerHTML = `<main class="order-shell">${header({ internal: true })}<section class="order-hero qr-hero"><div><p class="order-eyebrow">Operación del restaurante</p><h1>Cada pedido, bien identificado.</h1><p class="order-hero__intro">Gestiona mesas, pedidos para llevar y órdenes tomadas en caja desde el mismo sistema.</p></div><aside class="order-hero__aside"><strong>Estado en tiempo real</strong><p>Una mesa se apaga cuando el cliente abre su sesión. Los otros canales funcionan aunque todo el salón esté ocupado.</p></aside></section><section class="order-channels" aria-labelledby="order-channels-title"><header><p class="order-eyebrow">Otros medios de pedido</p><h2 id="order-channels-title">Atiende sin depender de una mesa</h2></header><div><article>${iconBag}<span><strong>Para llevar</strong><small>Enlace para el cliente que retira su pedido.</small></span><a class="primary-button" href="${appUrl('/pedido/?tipo=takeaway')}">Abrir carta</a></article><article>${iconCounter}<span><strong>Pedido en caja</strong><small>Para que el personal registre una orden presencial.</small></span><a class="secondary-button" href="${appUrl('/pedido/?tipo=counter')}">Crear pedido</a></article></div></section><form class="qr-controls" data-qr-form><label>Dirección del sistema<input type="url" name="base" value="${escapeHtml(defaultBase)}" required></label><label>Cantidad de mesas<input type="number" name="count" value="12" min="1" max="100" required></label><button class="primary-button" type="submit">Actualizar mesas</button></form><section class="qr-status" aria-label="Resumen de mesas"><div><strong data-available-count>0</strong><span>Disponibles</span></div><div><strong data-occupied-count>0</strong><span>Ocupadas</span></div><p data-qr-feedback role="status" aria-live="polite"></p></section><section class="qr-workspace"><div class="table-selector"><header><p class="order-eyebrow">Selector del salón</p><h2>Gestiona cada mesa</h2><p>Selecciona una mesa para ver su QR o liberarla cuando el cliente se retire.</p></header><div class="table-selector__grid" data-table-selector></div></div><aside class="qr-preview" data-qr-preview></aside></section><section class="qr-print-card" data-qr-print aria-hidden="true"></section></main>`;
    const form = root.querySelector('[data-qr-form]');
    const state = { tables: [], selected: null, count: 12, base: defaultBase };

    function tableUrl(table) { return `${state.base}/mesa/?mesa=${table}`; }

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
        preview.innerHTML = `<div class="qr-preview__empty qr-preview__occupied">${iconTable}<p class="order-eyebrow">Mesa seleccionada</p><h2>Mesa ${selected.table} ocupada</h2><p>${selected.activeOrders ? `Tiene ${selected.activeOrders} pedido${selected.activeOrders === 1 ? '' : 's'} activo${selected.activeOrders === 1 ? '' : 's'}.` : selected.unpaidOrders ? 'Tiene consumos pendientes de pago.' : selected.reservationId ? 'El cliente llegó con una reservación.' : 'La sesión de esta mesa continúa abierta.'}</p><button class="primary-button" type="button" data-release-qr-table="${selected.table}" ${selected.canRelease ? '' : 'disabled title="Finaliza los pedidos y registra el pago antes de liberar"'}>${selected.canRelease ? 'Cliente se retiró · liberar mesa' : selected.unpaidOrders ? 'Pago pendiente' : 'Finaliza los pedidos'}</button><a class="secondary-button" href="${appUrl('/admin/pedidos/')}">Ver en la central</a></div>`;
        print.innerHTML = '';
        return;
      }
      const url = tableUrl(selected.table);
      const demoQr = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260"><rect width="260" height="260" fill="#fff"/><rect x="18" y="18" width="224" height="224" fill="none" stroke="#111" stroke-width="10"/><path d="M42 42h54v54H42zm122 0h54v54h-54zM42 164h54v54H42zm82-42h22v22h-22zm40 0h54v22h-54zm-40 42h22v54h-22zm40 0h54v54h-54z" fill="#111"/><text x="130" y="137" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700">QR DEMO</text></svg>`)}`;
      const qrSource = isStaticDemo ? demoQr : appUrl(`/api/qr?url=${encodeURIComponent(url)}`);
      const card = `<div class="qr-card"><span class="qr-card__monogram">B</span><p class="qr-card__brand">BOCCANTINA<small>Cantina de vinos</small></p><span class="qr-card__table">MESA ${selected.table}</span><img src="${qrSource}" alt="${isStaticDemo ? 'Representación del QR de demostración' : `Código QR para ordenar desde la mesa ${selected.table}`}" width="260" height="260"><strong>${isStaticDemo ? 'DEMO · ABRIR MENÚ' : 'ESCANEA PARA ORDENAR'}</strong><small class="qr-card__hint">${isStaticDemo ? 'Usa el botón Abrir menú para probar esta mesa.' : 'La mesa se identificará automáticamente.'}</small></div>`;
      preview.innerHTML = `<p class="order-eyebrow">Vista previa seleccionada</p>${card}<div class="qr-preview__actions"><a class="primary-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir menú</a><button class="secondary-button" type="button" data-copy-link>Copiar enlace</button><button class="secondary-button" type="button" data-print-qr>Imprimir QR</button></div>`;
      print.innerHTML = card;
    }

    function renderTables() {
      const available = state.tables.filter((item) => item.status === 'available').length;
      root.querySelector('[data-available-count]').textContent = available;
      root.querySelector('[data-occupied-count]').textContent = state.tables.length - available;
      root.querySelector('[data-table-selector]').innerHTML = state.tables.map((item) => {
        const occupied = item.status === 'occupied';
        const selected = item.table === state.selected;
        return `<button class="table-option${selected ? ' is-selected' : ''}${occupied ? ' is-occupied' : ''}" type="button" data-table="${item.table}" aria-pressed="${selected}">${iconTable}<span class="table-option__copy"><strong>Mesa ${item.table}</strong><small>${occupied ? `${iconLock} Ocupada` : selected ? 'Seleccionada' : 'Disponible'}</small></span></button>`;
      }).join('');
      renderPreview();
    }

    async function refreshTables({ announce = false } = {}) {
      const { tables } = await request(`/api/tables?count=${state.count}`);
      state.tables = tables;
      if (!tables.some((item) => item.table === state.selected)) state.selected = tables.find((item) => item.status === 'available')?.table || tables[0]?.table || null;
      renderTables();
      if (announce) root.querySelector('[data-qr-feedback]').textContent = 'Estados de mesas actualizados.';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      state.base = String(data.get('base')).replace(/\/$/, '');
      state.count = Math.max(1, Math.min(100, Number(data.get('count')) || 1));
      submit.disabled = true;
      try { await refreshTables({ announce: true }); }
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

  const renderFatal = (error) => {
    root.innerHTML = `${header()}<main class="confirmation"><div class="confirmation__icon">!</div><h1>No pudimos abrir esta vista</h1><p>${escapeHtml(error.message)}</p></main>`;
  };

  try {
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
  } catch (error) { renderFatal(error); }
})();
