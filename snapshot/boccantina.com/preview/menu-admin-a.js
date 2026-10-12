(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== 'extras') return;

  const api = window.BoccMenuExtrasConfig;
  if (!api) return;

  const state = {
    config: api.load(),
    selectedProductId: api.products[0]?.id || null,
    query: '',
    saveTimer: null
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const productMeta = (id) => api.products.find((product) => product.id === id);
  const productConfig = (id) => state.config.products[id];
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
  document.body.classList.remove('plwao-overflow');
  document.title = 'Administrar extras — Boccantina';
  document.body.innerHTML = `
    <a class="bocc-admin-skip" href="#bocc-admin-editor">Ir al editor</a>
    <div class="bocc-admin-shell">
      <header class="bocc-admin-header">
        <div class="bocc-admin-brand"><span aria-hidden="true">B</span><div><strong>Boccantina</strong><small>Administración del menú · Preview local</small></div></div>
        <div class="bocc-admin-header__actions">
          <span class="bocc-admin-environment">No conectado a producción</span>
          <a href="/?hero=a#bocc-menu-app" target="_blank" rel="noopener">Ver carta del cliente ${icon('external')}</a>
        </div>
      </header>
      <div class="bocc-admin-layout">
        <aside class="bocc-admin-sidebar" aria-label="Platos configurables">
          <div class="bocc-admin-sidebar__head"><p>Configuración</p><h1>Extras por plato</h1><span>Activa, asigna y fija el precio individual de cada extra.</span></div>
          <label class="bocc-admin-search"><span>Buscar plato</span><div>${icon('search')}<input type="search" placeholder="Ej. Toscana" data-field="admin-search"></div></label>
          <nav data-region="admin-products" aria-label="Lista de platos"></nav>
        </aside>
        <main class="bocc-admin-main" id="bocc-admin-editor" tabindex="-1">
          <div class="bocc-admin-main__statusbar"><span data-region="admin-summary"></span><span class="bocc-admin-save-status" data-region="admin-save-status" role="status" aria-live="polite">Configuración cargada</span></div>
          <section data-region="admin-editor"></section>
        </main>
      </div>
    </div>`;

  const shell = document.querySelector('.bocc-admin-shell');
  const region = (name) => shell.querySelector(`[data-region="${name}"]`);

  function currentExtrasCount() {
    return Object.values(state.config.products).reduce((total, product) => total + (product.enabled ? product.extras.length : 0), 0);
  }

  function renderSummary() {
    const activeProducts = Object.values(state.config.products).filter((product) => product.enabled).length;
    region('admin-summary').textContent = `${activeProducts} platos activos · ${currentExtrasCount()} extras asignados`;
  }

  function renderProducts() {
    const query = state.query.toLocaleLowerCase('es');
    const visible = api.products.filter((product) => `${product.nameEs} ${product.categoryEs}`.toLocaleLowerCase('es').includes(query));
    const groups = [...new Set(visible.map((product) => product.categoryEs))];
    region('admin-products').innerHTML = groups.length ? groups.map((group) => `
      <section class="bocc-admin-product-group">
        <h2>${escapeHtml(group)}</h2>
        ${visible.filter((product) => product.categoryEs === group).map((product) => {
          const config = productConfig(product.id);
          return `<button type="button" data-action="select-product" data-product="${product.id}" aria-current="${state.selectedProductId === product.id ? 'page' : 'false'}">
            <span><strong>${escapeHtml(product.nameEs)}</strong><small>${config.extras.length} ${config.extras.length === 1 ? 'extra' : 'extras'}</small></span>
            <i class="${config.enabled ? 'is-active' : ''}">${config.enabled ? 'Activo' : 'Oculto'}</i>
          </button>`;
        }).join('')}
      </section>`).join('') : '<p class="bocc-admin-empty">No hay platos que coincidan con la búsqueda.</p>';
  }

  function renderEditor(focusExtraId = null) {
    const product = productMeta(state.selectedProductId);
    const config = productConfig(state.selectedProductId);
    if (!product || !config) return;
    region('admin-editor').innerHTML = `
      <div class="bocc-admin-editor-card">
        <header class="bocc-admin-editor-card__header">
          <div><p>${escapeHtml(product.categoryEs)}</p><h2>${escapeHtml(product.nameEs)}</h2><span>ID interno: ${escapeHtml(product.id)}</span></div>
          <label class="bocc-admin-toggle">
            <input type="checkbox" data-field="product-enabled" ${config.enabled ? 'checked' : ''}>
            <span aria-hidden="true"></span>
            <b>Permitir extras en este plato</b>
          </label>
        </header>
        <div class="bocc-admin-visibility-note"><strong>Visibilidad del cliente</strong><p>El cliente solo verá “Personalizar” y los extras guardados cuando esta opción esté activa. Este panel nunca aparece en su carta.</p></div>
        <div class="bocc-admin-extras-head"><div><h3>Extras asignados</h3><p>Cada precio se aplica por unidad del plato. Déjalo vacío mientras el precio esté pendiente de confirmación.</p></div><button type="button" data-action="add-extra">${icon('plus')} Añadir extra</button></div>
        <div class="bocc-admin-extra-list" data-region="admin-extra-list">
          ${config.extras.length ? config.extras.map((extra, index) => `
            <fieldset class="bocc-admin-extra-card" data-extra="${escapeHtml(extra.id)}">
              <legend>Extra ${index + 1}</legend>
              <div class="bocc-admin-extra-card__fields">
                <label for="extra-es-${index}"><span>Nombre en español</span><input id="extra-es-${index}" type="text" value="${escapeHtml(extra.nameEs)}" maxlength="80" data-field="extra-name-es" data-extra="${escapeHtml(extra.id)}" required></label>
                <label for="extra-en-${index}"><span>Nombre en inglés</span><input id="extra-en-${index}" type="text" value="${escapeHtml(extra.nameEn)}" maxlength="80" data-field="extra-name-en" data-extra="${escapeHtml(extra.id)}"></label>
                <label for="extra-price-${index}"><span>Precio individual (₡)</span><input id="extra-price-${index}" type="number" min="0" step="50" inputmode="numeric" value="${extra.price === null ? '' : extra.price}" placeholder="Por confirmar" data-field="extra-price" data-extra="${escapeHtml(extra.id)}"><small>${escapeHtml(formatPrice(extra.price))}</small></label>
              </div>
              <button class="bocc-admin-remove" type="button" data-action="remove-extra" data-extra="${escapeHtml(extra.id)}" aria-label="Eliminar ${escapeHtml(extra.nameEs)}">${icon('trash')} Quitar extra del plato</button>
            </fieldset>`).join('') : '<div class="bocc-admin-empty-state"><h3>Este plato no tiene extras asignados.</h3><p>Añade el primero o desactiva la personalización para ocultar la opción en la carta.</p><button type="button" data-action="add-extra">Añadir primer extra</button></div>'}
        </div>
        <footer class="bocc-admin-editor-card__footer">
          <button class="bocc-admin-reset" type="button" data-action="reset-product">${icon('reset')} Restaurar extras iniciales de este plato</button>
          <button class="bocc-admin-save" type="button" data-action="save-config">${icon('check')} Guardar cambios</button>
        </footer>
      </div>`;
    renderSummary();
    if (focusExtraId) region('admin-editor').querySelector(`[data-extra="${CSS.escape(focusExtraId)}"] input`)?.focus();
  }

  function showSaveStatus(message, stateName = 'saved') {
    const target = region('admin-save-status');
    target.textContent = message;
    target.dataset.state = stateName;
  }

  function persist({ announce = true } = {}) {
    window.clearTimeout(state.saveTimer);
    const result = api.save(state.config);
    state.config = result.config;
    if (result.ok) {
      showSaveStatus(announce ? 'Cambios guardados' : 'Guardado automático', 'saved');
    } else {
      showSaveStatus('No se pudo guardar en este navegador', 'error');
    }
    renderSummary();
    return result.ok;
  }

  function scheduleSave() {
    showSaveStatus('Guardando cambios…', 'saving');
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => persist({ announce: false }), 450);
  }

  function updateExtra(input) {
    const config = productConfig(state.selectedProductId);
    const extra = config.extras.find((item) => item.id === input.dataset.extra);
    if (!extra) return;
    if (input.dataset.field === 'extra-name-es') {
      extra.nameEs = input.value.slice(0, 80);
      const removeButton = input.closest('.bocc-admin-extra-card')?.querySelector('[data-action="remove-extra"]');
      if (removeButton) removeButton.setAttribute('aria-label', `Eliminar ${extra.nameEs || 'extra'}`);
    }
    if (input.dataset.field === 'extra-name-en') extra.nameEn = input.value.slice(0, 80);
    if (input.dataset.field === 'extra-price') {
      extra.price = api.normalizePrice(input.value);
      input.parentElement.querySelector('small').textContent = formatPrice(extra.price);
    }
    scheduleSave();
  }

  shell.addEventListener('input', (event) => {
    if (event.target.matches('[data-field="admin-search"]')) {
      state.query = event.target.value;
      renderProducts();
      return;
    }
    if (event.target.matches('[data-field^="extra-"]')) updateExtra(event.target);
  });

  shell.addEventListener('change', (event) => {
    if (!event.target.matches('[data-field="product-enabled"]')) return;
    productConfig(state.selectedProductId).enabled = event.target.checked;
    persist({ announce: false });
    renderProducts();
  });

  shell.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'select-product') {
      state.selectedProductId = button.dataset.product;
      renderProducts();
      renderEditor();
      document.querySelector('#bocc-admin-editor').focus({ preventScroll: true });
    } else if (action === 'add-extra') {
      const config = productConfig(state.selectedProductId);
      const id = `extra-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      config.extras.push({ id, nameEs: 'Nuevo extra', nameEn: 'New extra', price: null });
      persist({ announce: false });
      renderProducts();
      renderEditor(id);
    } else if (action === 'remove-extra') {
      const config = productConfig(state.selectedProductId);
      const extra = config.extras.find((item) => item.id === button.dataset.extra);
      if (!extra || !window.confirm(`¿Quitar “${extra.nameEs}” de este plato?`)) return;
      config.extras = config.extras.filter((item) => item.id !== button.dataset.extra);
      persist({ announce: false });
      renderProducts();
      renderEditor();
    } else if (action === 'reset-product') {
      if (!window.confirm('¿Restaurar la configuración inicial de extras para este plato?')) return;
      const defaults = api.defaults();
      state.config.products[state.selectedProductId] = defaults.products[state.selectedProductId];
      persist();
      renderProducts();
      renderEditor();
    } else if (action === 'save-config') {
      persist();
      renderProducts();
    }
  });

  renderProducts();
  renderEditor();
})();
