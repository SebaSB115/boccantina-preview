(async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== 'extras' && !/^\/admin\/extras\/(?:index\.html)?$/.test(location.pathname)) return;

  const api = window.BoccMenuExtrasConfig;
  if (!api) return;
  const isStaticDemo = Boolean(window.BoccStaticDemo?.enabled);
  const appUrl = window.BoccStaticDemo?.appUrl || (path => path);
  const brandLogoUrl = appUrl('/wp-content/uploads/2026/05/cropped-LOGO-NEW-300x72.jpg');
  const themeKey = 'boccantina-admin-theme';
  const savedTheme = () => { try { return localStorage.getItem(themeKey) === 'gold' ? 'gold' : 'blue'; } catch { return 'blue'; } };
  let session = { role: 'staff', permissions: ['boccantina.orders', 'boccantina.kitchen', 'boccantina.reservations', 'boccantina.tables', 'boccantina.new-order', 'boccantina.extras'] };
  if (!isStaticDemo) {
    const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) { location.assign('/admin/login/'); return; }
    session = await response.json();
  }
  const can = permission => session.role === 'owner' || session.permissions?.includes(`boccantina.${permission}`);
  const navLink = (path, label, active = false) => `<a href="${appUrl(path)}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  const navigation = `<button class="admin-nav-backdrop" type="button" data-admin-nav-close aria-label="Cerrar menú de administración" tabindex="-1"></button>
    <aside class="admin-drawer" id="admin-navigation" role="dialog" aria-modal="true" aria-label="Menú de administración" aria-hidden="true" inert>
      <div class="admin-drawer__head"><img class="admin-drawer__logo" src="${brandLogoUrl}" alt="Boccantina Cantina de Vinos" width="300" height="72"><button type="button" data-admin-nav-close aria-label="Cerrar menú">×</button></div>
      <nav aria-label="Secciones de Boccantina">
        ${['orders','kitchen','reservations','tables','new-order'].some(can) ? '<p>Operación</p>' : ''}
        ${can('orders') ? navLink('/admin/pedidos/', 'Pedidos') : ''}
        ${can('kitchen') ? navLink('/admin/cocina/', 'Vista cocina') : ''}
        ${can('reservations') ? navLink('/admin/reservaciones/', 'Reservaciones') : ''}
        ${can('tables') ? navLink('/qr-mesas/', 'Mesas y QR') : ''}
        ${can('new-order') ? navLink('/pedido/?modo=interno', 'Nuevo pedido') : ''}
        <p>Carta</p>${navLink('/admin/extras/', 'Extras de la carta', true)}${can('availability') ? navLink('/admin/disponibilidad/', 'Disponibilidad') : ''}
        ${session.role === 'owner' && !isStaticDemo ? '<p>Dirección</p>' + navLink('/admin/personal/', 'Administración') : ''}
      </nav>
      <div class="admin-drawer__foot">${isStaticDemo ? 'DEMO GITHUB · NO PRODUCCIÓN' : 'PRUEBA LOCAL · NO PRODUCCIÓN'}</div>
    </aside>`;
  const themeButton = () => `<button class="admin-theme-toggle" type="button" data-admin-theme-toggle aria-label="Cambiar a estilo ${savedTheme() === 'blue' ? 'dorado' : 'azul'}">${savedTheme() === 'blue' ? 'Estilo dorado' : 'Estilo azul'}</button>`;

  const state = {
    config: api.load(),
    selectedProductId: api.catalogProducts()[0]?.id || null,
    view: 'product',
    mobileEditor: false,
    category: '',
    query: '',
    dirty: false,
    saving: false
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const catalog = () => api.catalogProducts(state.config);
  const productMeta = (id) => catalog().find((product) => product.id === id);
  const productConfig = (id) => state.config.products[id];
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const formatPrice = (price) => price === null ? 'Pendiente' : `₡${Number(price).toLocaleString('en-US')}`;
  const icon = (name) => {
    const paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
      external: '<path d="M14 5h5v5M12 12l7-7M19 13v6H5V5h6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      reset: '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M5.5 15a8 8 0 0 0 13-3M18.5 9a8 8 0 0 0-13-3"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  };

  document.documentElement.dataset.boccantinaAdmin = 'extras';
  document.documentElement.classList.remove('plwao-overflow');
  document.body.dataset.boccantinaAdmin = 'extras';
  document.body.dataset.adminTheme = savedTheme();
  document.body.classList.remove('plwao-overflow');
  document.title = 'Administrar extras — Boccantina';
  document.body.innerHTML = `
    <a class="bocc-admin-skip" href="#bocc-admin-editor">Ir al editor</a>
    <div class="bocc-admin-shell">
      <header class="bocc-admin-header">
        <svg class="order-logo-filter" aria-hidden="true" width="0" height="0" focusable="false"><filter id="admin-logo-knockout" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  2.5 2.5 2.5 0 -0.8"></feColorMatrix></filter></svg>
        <button class="admin-nav-toggle" type="button" data-admin-nav-toggle aria-label="Abrir menú de administración" aria-controls="admin-navigation" aria-expanded="false"><span class="admin-nav-toggle__icon" aria-hidden="true"><i></i><i></i><i></i></span></button>
        <a class="bocc-admin-brand" href="${appUrl('/admin/pedidos/')}"><img src="${brandLogoUrl}" alt="Boccantina Cantina de Vinos" width="300" height="72"></a>
        <div class="bocc-admin-header__actions">
          ${themeButton()}
          <span class="bocc-admin-environment">${isStaticDemo ? 'DEMO GITHUB · NO PRODUCCIÓN' : 'PRUEBA LOCAL · NO PRODUCCIÓN'}</span>
          <a href="/?hero=a#bocc-menu-app" target="_blank" rel="noopener">Ver carta del cliente ${icon('external')}</a>
          ${isStaticDemo ? '' : '<button class="bocc-admin-logout" type="button" data-admin-logout>Salir</button>'}
        </div>
      </header>
      ${navigation}
      <div class="bocc-admin-layout">
        <aside class="bocc-admin-sidebar" aria-label="Platos configurables">
          <div class="bocc-admin-sidebar__head"><p>Configuración</p><h1>Extras por plato</h1><span>Biblioteca compartida y asignaciones.</span></div>
          <div class="bocc-admin-section-switch"><button type="button" data-action="view-products" aria-pressed="true">Platos</button><button type="button" data-action="view-library" aria-pressed="false">Biblioteca</button></div>
          <button class="bocc-admin-create" type="button" data-action="new-product">+ Nuevo producto</button>
          <label class="bocc-admin-search"><span>Buscar plato o extra</span><div>${icon('search')}<input type="search" placeholder="Nombre o categoría" data-field="admin-search"></div></label>
          <button class="bocc-admin-clear" type="button" data-action="clear-search" hidden>Limpiar búsqueda</button>
          <label class="bocc-admin-category">Categoría<select data-field="admin-category"><option value="">Todas las categorías</option>${(window.BoccMenuCatalog?.categories || []).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.es)}</option>`).join('')}</select></label>
          <nav data-region="admin-products" aria-label="Lista de platos"></nav>
        </aside>
        <main class="bocc-admin-main" id="bocc-admin-editor" tabindex="-1">
          <div class="bocc-admin-main__statusbar"><button class="bocc-admin-back" type="button" data-action="back-list">← Volver a la lista</button><span data-region="admin-summary"></span><span class="bocc-admin-save-status" data-region="admin-save-status" role="status" aria-live="polite">Configuración cargada</span></div>
          <section data-region="admin-editor"></section>
        </main>
      </div>
    </div>`;

  const shell = document.querySelector('.bocc-admin-shell');
  shell.addEventListener('click', (event) => {
    if (event.target.closest('[data-admin-theme-toggle]')) {
      const theme = document.body.dataset.adminTheme === 'gold' ? 'blue' : 'gold';
      document.body.dataset.adminTheme = theme;
      try { localStorage.setItem(themeKey, theme); } catch {}
      const button = shell.querySelector('[data-admin-theme-toggle]');
      button.textContent = theme === 'blue' ? 'Estilo dorado' : 'Estilo azul';
      button.setAttribute('aria-label', `Cambiar a estilo ${theme === 'blue' ? 'dorado' : 'azul'}`);
    }
    if (event.target.closest('[data-admin-nav-toggle]')) {
      const drawer = shell.querySelector('#admin-navigation');
      drawer.inert = false;
      drawer.setAttribute('aria-hidden', 'false');
      shell.querySelector('[data-admin-nav-toggle]').setAttribute('aria-expanded', 'true');
      document.body.classList.add('admin-nav-open');
      window.setTimeout(() => { if (document.body.classList.contains('admin-nav-open')) drawer.querySelector('.admin-drawer__head [data-admin-nav-close]')?.focus(); }, 50);
    }
    if (event.target.closest('[data-admin-nav-close]')) {
      const drawer = shell.querySelector('#admin-navigation');
      document.body.classList.remove('admin-nav-open');
      drawer.inert = true;
      drawer.setAttribute('aria-hidden', 'true');
      const toggle = shell.querySelector('[data-admin-nav-toggle]');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('admin-nav-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); shell.querySelector('[data-admin-nav-close]')?.click(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...shell.querySelectorAll('.admin-drawer button,.admin-drawer a')];
    const first = controls[0], last = controls.at(-1);
    if (!shell.querySelector('.admin-drawer').contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  shell.querySelector('[data-admin-logout]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await fetch('/api/admin/logout', { method:'POST', credentials:'same-origin' }).catch(() => {});
    location.assign('/admin/login/');
  });
  const region = (name) => shell.querySelector(`[data-region="${name}"]`);

  const libraryExtra = (id) => state.config.library.find((extra) => extra.id === id);
  const selectedConfig = () => productConfig(state.selectedProductId);
  const isMobile = () => matchMedia('(max-width: 760px)').matches;
  const categoryName = (id) => window.BoccMenuCatalog?.categories.find((item) => item.id === id)?.es || id;
  function markDirty() { state.dirty = true; state.revision = (state.revision || 0) + 1; showStatus('Cambios sin guardar', 'saving'); }
  function showStatus(message, kind = 'saved') { const target = region('admin-save-status'); target.textContent = message; target.dataset.state = kind; }
  function canLeave() {
    if (!state.dirty) return true;
    if (!window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?')) return false;
    state.config = structuredClone(state.savedConfig);
    state.dirty = false;
    return true;
  }
  window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
  shell.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (link && !canLeave()) event.preventDefault();
  });

  function renderSummary() {
    const count = catalog().length;
    const assigned = Object.values(state.config.products).reduce((sum, item) => sum + item.extras.length, 0);
    region('admin-summary').textContent = `${count} platos · ${state.config.library.length} extras · ${assigned} asignaciones`;
    shell.classList.toggle('is-editing-mobile', state.mobileEditor);
    shell.querySelector('[data-field="admin-category"]').closest('label').hidden = state.view === 'library';
    shell.querySelector('[data-action="new-product"]').hidden = state.view === 'library';
    shell.querySelector('[data-action="view-products"]').setAttribute('aria-pressed', String(state.view !== 'library'));
    shell.querySelector('[data-action="view-library"]').setAttribute('aria-pressed', String(state.view === 'library'));
  }

  function renderList() {
    const query = normalize(state.query);
    const nav = region('admin-products');
    if (state.view === 'library') {
      const entries = state.config.library.filter((extra) => normalize(`${extra.nameEs} ${extra.nameEn}`).includes(query));
      nav.innerHTML = `<button class="bocc-admin-create" type="button" data-action="new-extra">+ Nuevo extra</button>${entries.length ? entries.map((extra) => `<button class="bocc-admin-list-row" type="button" data-action="select-extra" data-extra="${escapeHtml(extra.id)}" aria-current="${state.selectedExtraId === extra.id ? 'true' : 'false'}"><strong>${escapeHtml(extra.nameEs || 'Nuevo extra')}</strong><small>${extra.active ? formatPrice(extra.price) : 'Desactivado'}</small></button>`).join('') : '<p class="bocc-admin-empty">No hay extras que coincidan con la búsqueda.</p>'}`;
    } else {
      const visible = catalog().filter((product) => (!state.category || product.category === state.category) && normalize(`${product.nameEs} ${product.nameEn} ${product.categoryEs}`).includes(query));
      const groups = [...new Set(visible.map((product) => product.category))];
      nav.innerHTML = groups.length ? groups.map((category) => `<section class="bocc-admin-product-group"><h2>${escapeHtml(categoryName(category))}</h2>${visible.filter((product) => product.category === category).map((product) => {
        const config = productConfig(product.id);
        return `<button type="button" data-action="select-product" data-product="${escapeHtml(product.id)}" aria-current="${state.selectedProductId === product.id ? 'page' : 'false'}"><span><strong>${escapeHtml(product.nameEs)}</strong><small>${config?.extras.length || 0} extras</small></span><i class="${config?.enabled ? 'is-active' : ''}">${config?.enabled ? 'Personalizable' : 'Sin extras'}</i></button>`;
      }).join('')}</section>`).join('') : '<p class="bocc-admin-empty">No hay platos que coincidan. Prueba otro nombre o limpia los filtros.</p>';
    }
    shell.querySelector('[data-action="clear-search"]').hidden = !state.query;
    renderSummary();
  }

  function renderProductEditor() {
    const product = productMeta(state.selectedProductId);
    const config = selectedConfig();
    if (!product || !config) return '<p class="bocc-admin-empty">Selecciona un plato para configurar sus extras.</p>';
    const assignedIds = new Set(config.extras.map((extra) => extra.id));
    const available = state.config.library.filter((extra) => !assignedIds.has(extra.id));
    return `<div class="bocc-admin-editor-card"><header class="bocc-admin-editor-card__header"><div><p>${escapeHtml(categoryName(product.category))}</p><h2>${escapeHtml(product.nameEs)}</h2><span>${product.id.startsWith('custom-') ? 'Producto creado en esta central' : 'Producto de la carta'}</span></div><label class="bocc-admin-toggle"><input type="checkbox" data-field="product-enabled" ${config.enabled ? 'checked' : ''}><span aria-hidden="true"></span><b>Permitir extras</b></label></header>
      <div class="bocc-admin-ops-content"><p class="bocc-admin-helper">Los extras de la biblioteca se pueden usar en varios platos. Quitar una asignación no borra el extra.</p>
      <div class="bocc-admin-assign"><label for="assign-extra">Asignar extra<select id="assign-extra" data-field="assign-extra"><option value="">Selecciona un extra</option>${available.map((extra) => `<option value="${escapeHtml(extra.id)}" ${extra.active ? '' : 'disabled'}>${escapeHtml(extra.nameEs)}${extra.active ? '' : ' · desactivado'}</option>`).join('')}</select></label><button type="button" data-action="assign-extra" ${available.some((extra) => extra.active) ? '' : 'disabled'}>Asignar</button></div>
      <h3>Asignados a este plato <small>${config.extras.length}</small></h3>
      <div class="bocc-admin-assigned">${config.extras.length ? config.extras.map((assigned) => {
        const extra = libraryExtra(assigned.id);
        return `<div class="bocc-admin-assigned-row"><div><strong>${escapeHtml(extra?.nameEs || assigned.nameEs)}</strong><small>${extra?.active === false ? 'Desactivado para pedidos nuevos' : assigned.useLibraryPrice ? `Precio general · ${formatPrice(extra?.price)}` : `Precio especial · ${formatPrice(assigned.price)}`}</small></div><label>Precio especial (₡)<input type="number" min="0" step="1" inputmode="numeric" data-field="assignment-price" data-extra="${escapeHtml(assigned.id)}" value="${assigned.useLibraryPrice || assigned.price === null ? '' : assigned.price}" placeholder="Precio general"></label><button class="bocc-admin-remove" type="button" data-action="remove-assignment" data-extra="${escapeHtml(assigned.id)}" aria-label="Quitar ${escapeHtml(extra?.nameEs || assigned.nameEs)} de ${escapeHtml(product.nameEs)}">Quitar</button></div>`;
      }).join('') : '<p class="bocc-admin-empty">Este plato no tiene extras asignados.</p>'}</div></div>
      <footer class="bocc-admin-editor-card__footer"><button class="bocc-admin-reset" type="button" data-action="reset-product">Restaurar asignaciones iniciales</button><button class="bocc-admin-save" type="button" data-action="save-config">Guardar cambios</button></footer></div>`;
  }

  function renderLibraryEditor() {
    const extra = libraryExtra(state.selectedExtraId);
    if (!extra) return '<p class="bocc-admin-empty">Selecciona un extra o crea uno nuevo.</p>';
    const uses = Object.values(state.config.products).filter((item) => item.extras.some((entry) => entry.id === extra.id)).length;
    return `<div class="bocc-admin-editor-card"><header class="bocc-admin-editor-card__header"><div><p>Biblioteca reutilizable</p><h2>${escapeHtml(extra.nameEs || 'Nuevo extra')}</h2><span>Asignado a ${uses} ${uses === 1 ? 'plato' : 'platos'}</span></div></header><div class="bocc-admin-ops-content"><div class="bocc-admin-form-grid"><label>Nombre en español<input data-field="library-name-es" maxlength="80" required value="${escapeHtml(extra.nameEs)}"></label><label>Nombre en inglés<input data-field="library-name-en" maxlength="80" value="${escapeHtml(extra.nameEn)}"></label><label>Precio general (₡)<input type="number" min="0" step="1" inputmode="numeric" data-field="library-price" value="${extra.price ?? ''}" placeholder="Pendiente"></label><label class="bocc-admin-checkbox"><input type="checkbox" data-field="library-active" ${extra.active ? 'checked' : ''}>Disponible para pedidos nuevos</label></div><p class="bocc-admin-helper">Desactivar conserva las asignaciones y el historial; evita añadir este extra a pedidos nuevos.</p></div><footer class="bocc-admin-editor-card__footer"><button class="bocc-admin-save" type="button" data-action="save-config">Guardar cambios</button></footer></div>`;
  }

  function renderNewProduct() {
    return `<div class="bocc-admin-editor-card"><header class="bocc-admin-editor-card__header"><div><p>Carta</p><h2>Nuevo producto</h2><span>Usará la imagen de su categoría hasta que exista un editor de imágenes.</span></div></header><form class="bocc-admin-ops-content bocc-admin-form-grid" data-form="new-product"><label>Nombre en español<input name="nameEs" maxlength="80" required></label><label>Nombre en inglés<input name="nameEn" maxlength="80"></label><label>Categoría<select name="category" required>${(window.BoccMenuCatalog?.categories || []).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.es)}</option>`).join('')}</select></label><label>Precio (₡)<input name="price" type="number" min="0" step="1" inputmode="numeric" required></label><label class="bocc-admin-form-wide">Descripción en español<textarea name="descEs" maxlength="240"></textarea></label><label class="bocc-admin-form-wide">Description in English<textarea name="descEn" maxlength="240"></textarea></label><label class="bocc-admin-checkbox"><input name="visible" type="checkbox" checked>Visible en la carta</label><div class="bocc-admin-form-wide"><button class="bocc-admin-save" type="submit">Crear producto y configurar extras</button></div></form></div>`;
  }

  function renderEditor() {
    region('admin-editor').innerHTML = state.view === 'library' ? renderLibraryEditor() : state.view === 'new-product' ? renderNewProduct() : renderProductEditor();
    renderSummary();
  }

  async function persist() {
    if (state.saving) return false;
    const empty = state.config.library.find((extra) => !extra.nameEs.trim());
    if (empty) { showStatus('Escribe el nombre en español del extra.', 'error'); region('admin-editor').querySelector('[data-field="library-name-es"]')?.focus(); return false; }
    state.saving = true;
    const revision = state.revision;
    showStatus('Guardando…', 'saving');
    const result = await api.save(state.config);
    state.saving = false;
    if (!result.ok) { showStatus(result.error, 'error'); return false; }
    state.savedConfig = structuredClone(result.config);
    if (revision === state.revision) { state.config = result.config; state.dirty = false; renderList(); renderEditor(); }
    showStatus(state.dirty ? 'Hay cambios nuevos sin guardar' : 'Cambios guardados', state.dirty ? 'saving' : 'saved');
    return true;
  }

  function setView(view, extraId = null) {
    if (!canLeave()) return;
    if ((view === 'library') !== (state.view === 'library')) {
      state.query = '';
      state.category = '';
      shell.querySelector('[data-field="admin-search"]').value = '';
      shell.querySelector('[data-field="admin-category"]').value = '';
    }
    state.view = view;
    state.dirty = false;
    state.mobileEditor = view === 'new-product' || (isMobile() && view === 'library' && Boolean(extraId));
    if (extraId) state.selectedExtraId = extraId;
    if (view === 'library' && !libraryExtra(state.selectedExtraId)) state.selectedExtraId = state.config.library[0]?.id;
    renderList(); renderEditor();
    if (state.mobileEditor) region('admin-editor').querySelector('input,select')?.focus();
  }

  shell.addEventListener('input', (event) => {
    const input = event.target;
    if (input.closest('[data-form="new-product"]')) { markDirty(); return; }
    if (input.matches('[data-field="admin-search"]')) { state.query = input.value; renderList(); return; }
    const field = input.dataset.field;
    if (!field) return;
    if (field.startsWith('library-')) {
      const extra = libraryExtra(state.selectedExtraId);
      if (!extra) return;
      if (field === 'library-name-es') extra.nameEs = input.value.slice(0, 80);
      if (field === 'library-name-en') extra.nameEn = input.value.slice(0, 80);
      if (field === 'library-price') extra.price = api.normalizePrice(input.value);
      markDirty(); return;
    }
    if (field === 'assignment-price') {
      const assigned = selectedConfig()?.extras.find((item) => item.id === input.dataset.extra);
      if (!assigned) return;
      assigned.useLibraryPrice = input.value.trim() === '';
      assigned.price = assigned.useLibraryPrice ? libraryExtra(assigned.id)?.price ?? null : api.normalizePrice(input.value);
      markDirty();
    }
  });

  shell.addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    if (field === 'admin-category') { state.category = event.target.value; renderList(); }
    if (field === 'product-enabled') { selectedConfig().enabled = event.target.checked; markDirty(); renderList(); }
    if (field === 'library-active') { libraryExtra(state.selectedExtraId).active = event.target.checked; markDirty(); renderList(); }
  });

  shell.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-form="new-product"]')) return;
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const categoryProduct = window.BoccMenuCatalog.products.find((item) => item.category === values.category);
    const product = { id: `custom-${crypto.randomUUID()}`, category: values.category, nameEs: values.nameEs.trim(), nameEn: values.nameEn?.trim() || values.nameEs.trim(), descEs: values.descEs?.trim() || '', descEn: values.descEn?.trim() || values.descEs?.trim() || '', price: api.normalizePrice(values.price), image: categoryProduct?.image || '', tags: [], visible: form.elements.visible.checked };
    state.config.customProducts.push(product);
    state.config.products[product.id] = { enabled: true, type: 'other', extras: [] };
    markDirty();
    if (await persist()) { state.selectedProductId = product.id; state.view = 'product'; state.mobileEditor = isMobile(); renderList(); renderEditor(); }
  });

  shell.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'clear-search') { state.query = ''; shell.querySelector('[data-field="admin-search"]').value = ''; renderList(); }
    if (action === 'back-list') { state.mobileEditor = false; renderSummary(); shell.querySelector('[data-field="admin-search"]').focus(); }
    if (action === 'view-products') setView('product');
    if (action === 'view-library') { state.selectedExtraId ||= state.config.library[0]?.id; setView('library'); }
    if (action === 'new-product') setView('new-product');
    if (action === 'select-product') {
      if (!canLeave()) return;
      state.dirty = false; state.view = 'product'; state.selectedProductId = button.dataset.product; state.mobileEditor = isMobile(); renderList(); renderEditor(); region('admin-editor').focus({ preventScroll: true });
    }
    if (action === 'select-extra') { state.selectedExtraId = button.dataset.extra; setView('library', state.selectedExtraId); }
    if (action === 'new-extra') {
      if (!canLeave()) return;
      state.dirty = false; state.selectedExtraId = `extra-custom-${crypto.randomUUID()}`;
      state.config.library.push({ id: state.selectedExtraId, nameEs: '', nameEn: '', price: null, active: true });
      state.mobileEditor = isMobile(); markDirty(); renderList(); renderEditor(); region('admin-editor').querySelector('[data-field="library-name-es"]')?.focus();
    }
    if (action === 'assign-extra') {
      const id = region('admin-editor').querySelector('[data-field="assign-extra"]')?.value;
      const extra = libraryExtra(id);
      if (!extra?.active || selectedConfig().extras.some((item) => item.id === id)) return;
      selectedConfig().extras.push({ id, nameEs: extra.nameEs, nameEn: extra.nameEn, price: extra.price, useLibraryPrice: true });
      markDirty(); renderList(); renderEditor();
    }
    if (action === 'remove-assignment') {
      const extra = libraryExtra(button.dataset.extra);
      if (!window.confirm(`¿Quitar “${extra?.nameEs || 'este extra'}” de este plato?`)) return;
      selectedConfig().extras = selectedConfig().extras.filter((item) => item.id !== button.dataset.extra);
      markDirty(); renderList(); renderEditor();
    }
    if (action === 'reset-product') {
      const original = api.defaults().products[state.selectedProductId];
      if (!original || !window.confirm('¿Restaurar las asignaciones iniciales de este plato?')) return;
      state.config.products[state.selectedProductId] = original; markDirty(); renderList(); renderEditor();
    }
    if (action === 'save-config') await persist();
  });

  state.config = await api.hydrate();
  state.savedConfig = structuredClone(state.config);
  state.selectedExtraId = state.config.library[0]?.id;
  renderList();
  renderEditor();
})();
