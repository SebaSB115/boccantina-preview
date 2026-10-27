const state = {
  catalog:null, users:[], session:null, view:'products', selectedProduct:null,
  selectedCategory:null, selectedUser:null, userFormOpen:false, mobileMode:'list', dirty:false,
  search:'', filter:'all', qr:null
};
const content = document.getElementById('view-content');
const feedback = document.getElementById('feedback');
const sidebar = document.getElementById('admin-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
function setSidebar(open, restoreFocus = false) {
  document.body.classList.toggle('is-sidebar-open', open);
  sidebar.inert = !open;
  sidebar.setAttribute('aria-hidden', String(!open));
  sidebarToggle.setAttribute('aria-expanded', String(open));
  sidebarToggle.setAttribute('aria-label', open ? 'Cerrar menú de administración' : 'Abrir menú de administración');
  sidebarBackdrop.hidden = !open;
  if (open) sidebar.querySelector('#sidebar-close').focus();
  else if (restoreFocus) sidebarToggle.focus();
}
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const fold = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const money = (price) => price === null ? 'Sin precio' : `₡${Number(price).toLocaleString('es-CR')}`;
const ownProductPhoto = (image) => /^data:image\/(?:jpeg|png|webp);base64,/.test(image || '') || /^\/(?:media\/[0-9a-f-]{36}|v2\/assets\/[a-z0-9-]+)\.(?:jpg|png|webp)$/.test(String(image || '').replace(/^\/boccantina-preview(?=\/)/, ''));
const categories = () => [...state.catalog.categories].sort((a,b) => a.position - b.position || a.es.localeCompare(b.es));
const products = () => [...state.catalog.products].sort((a,b) => a.position - b.position || a.nameEs.localeCompare(b.nameEs));
const categoryName = (id) => state.catalog.categories.find((item) => item.id === id)?.es || 'Sin categoría';

function notify(message, error = false) {
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.dataset.error = String(error);
  feedback.setAttribute('role', error ? 'alert' : 'status');
}
function clearNotice() { feedback.hidden = true; feedback.textContent = ''; }
function confirmDiscard() { return !state.dirty || confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'); }
function markDirty() { state.dirty = true; }
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof Blob)) headers['content-type'] = 'application/json';
  if (options.method && options.method !== 'GET') headers['x-csrf-token'] = state.session.csrf;
  const response = await fetch(path, { credentials:'same-origin', cache:'no-store', ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) { location.assign('/admin/login/'); throw new Error('La sesión terminó.'); }
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}
function heading(title, description) {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-description').textContent = description;
  document.querySelectorAll('.main-nav [data-view]').forEach((button) => {
    if (button.dataset.view === state.view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function imageControl(value, label, fallback = 'Sin imagen propia.', product = false) {
  const src = value ? escapeHtml(value) : '';
  const message = product ? ownProductPhoto(value) ? 'Foto propia del plato. Se muestra junto a su nombre en la carta.' : value ? 'La imagen heredada es ilustrativa. Sube una foto real del plato para mostrarla individualmente en la carta.' : 'Sube una foto real del plato para mostrarla individualmente en la carta.' : 'Esta imagen se muestra como fotografía de la categoría.';
  return `<div class="image-field"><div>${src ? `<img class="image-preview" src="${src}" alt="Vista previa de ${escapeHtml(label)}">` : `<div class="image-preview image-placeholder">${escapeHtml(fallback)}</div>`}</div><div><label>Imagen JPG, PNG o WebP<input data-image-upload name="image-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="image-help"></label><input type="hidden" name="image" value="${src}"><p class="help" id="image-help">${escapeHtml(message)} Máximo 3 MB. Guarda el formulario para aplicar el cambio.</p>${src ? '<button class="button button--quiet" type="button" data-clear-image>Quitar imagen</button>' : ''}</div></div>`;
}
function productRows() {
  const query = fold(state.search.trim());
  const visible = products().filter((item) => {
    const matches = !query || fold(`${item.nameEs} ${item.nameEn} ${item.descEs} ${categoryName(item.category)}`).includes(query);
    const status = state.filter === 'all' || state.filter === 'no-price' && item.price === null || state.filter === 'hidden' && !item.visible || state.filter === 'unavailable' && !item.available || state.filter === 'no-photo' && !ownProductPhoto(item.image);
    return matches && status;
  });
  return visible.length ? visible.map((item) => `<button class="item-row" type="button" data-select-product="${escapeHtml(item.id)}" aria-current="${state.selectedProduct === item.id}"><span class="item-row__copy"><strong>${escapeHtml(item.nameEs)}</strong><small>${escapeHtml(categoryName(item.category))}${!item.visible ? ' · Oculto' : !item.available ? ' · No disponible' : ''}${ownProductPhoto(item.image) ? '' : ' · Foto por confirmar'}</small></span><span class="item-row__end">${escapeHtml(money(item.price))}</span></button>`).join('') : '<p class="empty">No hay productos con estos filtros.</p>';
}
function categoryRows() {
  return categories().map((item) => { const count = state.catalog.products.filter((product) => product.category === item.id).length; return `<button class="item-row" type="button" data-select-category="${escapeHtml(item.id)}" aria-current="${state.selectedCategory === item.id}"><span class="item-row__copy"><strong>${escapeHtml(item.es)}</strong><small>${count} ${count === 1 ? 'producto' : 'productos'}${item.visible ? '' : ' · Oculta'}</small></span><span class="item-row__end">${item.position + 1}</span></button>`; }).join('');
}
function productEditor() {
  const item = state.catalog.products.find((product) => product.id === state.selectedProduct);
  const creating = !item;
  const value = item || { nameEs:'', nameEn:'', descEs:'', descEn:'', category:categories()[0]?.id || '', price:null, image:'', visible:true, available:true, position:state.catalog.products.length, tags:[] };
  return `<div class="editor-panel"><div class="editor-head"><button type="button" class="button back-button" data-back-list>← Volver a productos</button><h2>${creating ? 'Nuevo producto' : 'Editar producto'}</h2><p>${creating ? 'Agrega un plato a la carta.' : `Producto de ${escapeHtml(categoryName(value.category))}`}</p></div>
    <form class="editor-form" id="product-form" data-entity="product">
      <div class="form-section"><h3>Información principal</h3><div class="form-grid">
        <label class="form-wide">Nombre en español *<input name="nameEs" maxlength="100" required value="${escapeHtml(value.nameEs)}"></label>
        <label>Categoría *<select name="category" required>${categories().map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === value.category ? 'selected' : ''}>${escapeHtml(category.es)}</option>`).join('')}</select></label>
        <label>Precio en colones<input name="price" type="number" min="0" max="10000000" step="1" inputmode="numeric" value="${value.price ?? ''}" placeholder="Pendiente"><span class="help">Déjalo vacío si falta confirmar el precio.</span></label>
        <label class="form-wide">Descripción en español<textarea name="descEs" maxlength="600" rows="3">${escapeHtml(value.descEs)}</textarea></label>
      </div><div class="choice-row"><label><input type="checkbox" name="visible" ${value.visible ? 'checked' : ''}> Visible en la carta</label><label><input type="checkbox" name="available" ${value.available ? 'checked' : ''}> Disponible</label></div></div>
      <div class="form-section"><h3>Imagen</h3>${imageControl(value.image, value.nameEs || 'producto', 'Sin fotografía propia del plato.', true)}</div>
      <details class="form-section"><summary>Inglés y opciones</summary><div class="form-grid"><label class="form-wide">Nombre en inglés<input name="nameEn" maxlength="100" value="${escapeHtml(value.nameEn)}"></label><label class="form-wide">Descripción en inglés<textarea name="descEn" maxlength="600" rows="3">${escapeHtml(value.descEn)}</textarea></label><label>Posición en la categoría<input name="position" type="number" min="0" max="10000" step="1" value="${value.position}"></label></div><fieldset><legend>Etiquetas</legend><div class="choice-row">${[['recommended','Recomendado'],['share','Para compartir'],['vegetarian','Vegetariano'],['spicy','Picante']].map(([key,label]) => `<label><input type="checkbox" name="tag" value="${key}" ${value.tags.includes(key) ? 'checked' : ''}> ${label}</label>`).join('')}</div></fieldset></details>
      <div class="editor-actions"><div class="editor-actions__main"><button class="button button--primary" type="submit">${creating ? 'Crear producto' : 'Guardar cambios'}</button><button class="button" type="button" data-cancel-form>Cancelar</button></div>${creating ? '' : '<button class="button button--danger" type="button" data-delete-product>Eliminar producto</button>'}</div>
    </form></div>`;
}
function categoryEditor() {
  const item = state.catalog.categories.find((category) => category.id === state.selectedCategory);
  const creating = !item;
  const value = item || { es:'', en:'', esDescription:'', enDescription:'', image:'', position:state.catalog.categories.length, visible:true };
  const count = item ? state.catalog.products.filter((product) => product.category === item.id).length : 0;
  return `<div class="editor-panel"><div class="editor-head"><button type="button" class="button back-button" data-back-list>← Volver a categorías</button><h2>${creating ? 'Nueva categoría' : 'Editar categoría'}</h2><p>${creating ? 'Organiza los platos de la carta.' : `${count} ${count === 1 ? 'producto' : 'productos'} en esta categoría.`}</p></div>
    <form class="editor-form" id="category-form" data-entity="category">
      <div class="form-section"><h3>Información</h3><div class="form-grid"><label class="form-wide">Nombre en español *<input name="es" maxlength="80" required value="${escapeHtml(value.es)}"></label><label class="form-wide">Descripción en español<textarea name="esDescription" maxlength="300" rows="2">${escapeHtml(value.esDescription)}</textarea></label><label>Posición<input name="position" type="number" min="0" max="10000" step="1" value="${value.position}"></label></div><div class="choice-row"><label><input type="checkbox" name="visible" ${value.visible ? 'checked' : ''}> Visible en la carta</label></div></div>
      <div class="form-section"><h3>Imagen de categoría</h3>${imageControl(value.image, value.es || 'categoría', 'Sin imagen propia. Se mostrará una foto de sus platos o una referencia ilustrativa.')}</div>
      <details class="form-section"><summary>Contenido en inglés</summary><div class="form-grid"><label class="form-wide">Nombre en inglés<input name="en" maxlength="80" value="${escapeHtml(value.en)}"></label><label class="form-wide">Descripción en inglés<textarea name="enDescription" maxlength="300" rows="2">${escapeHtml(value.enDescription)}</textarea></label></div></details>
      <div class="editor-actions"><div class="editor-actions__main"><button class="button button--primary" type="submit">${creating ? 'Crear categoría' : 'Guardar cambios'}</button><button class="button" type="button" data-cancel-form>Cancelar</button></div>${creating ? '' : '<button class="button button--danger" type="button" data-delete-category>Eliminar categoría</button>'}</div>
    </form></div>`;
}
function renderProducts() {
  heading('Productos', 'Edita lo que aparece en la carta digital.');
  content.innerHTML = `<div class="workspace" data-mobile-mode="${state.mobileMode}"><section class="list-panel" aria-label="Lista de productos"><div class="list-head"><h2>Platos <small>${state.catalog.products.length} en la carta</small></h2><button class="button button--primary" type="button" data-new-product>+ Nuevo</button></div><div class="filters filters--two"><label>Buscar<input type="search" name="product-search" data-search placeholder="Nombre o ingrediente" value="${escapeHtml(state.search)}"></label><label>Mostrar<select name="product-filter" data-filter><option value="all">Todos</option><option value="no-price" ${state.filter === 'no-price' ? 'selected' : ''}>Sin precio</option><option value="hidden" ${state.filter === 'hidden' ? 'selected' : ''}>Ocultos</option><option value="unavailable" ${state.filter === 'unavailable' ? 'selected' : ''}>No disponibles</option><option value="no-photo" ${state.filter === 'no-photo' ? 'selected' : ''}>Sin foto propia</option></select></label></div><div class="item-list" data-items>${productRows()}</div></section>${productEditor()}</div>`;
}
function renderCategories() {
  heading('Categorías', 'Organiza la carta y sus imágenes.');
  content.innerHTML = `<div class="workspace" data-mobile-mode="${state.mobileMode}"><section class="list-panel" aria-label="Lista de categorías"><div class="list-head"><h2>Categorías <small>${state.catalog.categories.length} en la carta</small></h2><button class="button button--primary" type="button" data-new-category>+ Nueva</button></div><div class="item-list" data-items>${categoryRows()}</div></section>${categoryEditor()}</div>`;
}
function renderUsers() {
  heading('Cuentas', 'Todas las personas de esta versión tienen el mismo acceso de administrador.');
  const selected = state.users.find((user) => user.id === state.selectedUser);
  const activeCount = state.users.filter((user) => user.active).length;
  content.innerHTML = `<div class="list-head"><h2>Administradores <small>${activeCount} ${activeCount === 1 ? 'activo' : 'activos'}</small></h2><button type="button" class="button button--primary" data-new-user>+ Nuevo administrador</button></div><div class="users-list">${state.users.map((user) => `<div class="user-row"><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.username)}</small></div><span>Administrador</span><span class="badge ${user.active ? '' : 'badge--off'}">${user.active ? 'Activo' : 'Inactivo'}</span><button class="button" type="button" data-edit-user="${user.id}">Editar</button></div>`).join('')}</div>
    ${state.userFormOpen ? `
    <form class="user-form" id="user-form"><h2>${selected ? 'Editar administrador' : 'Nuevo administrador'}</h2><div class="form-grid"><label>Nombre visible *<input name="name" required maxlength="80" value="${escapeHtml(selected?.name || '')}"></label><label>Usuario *<input name="username" required minlength="3" maxlength="80" autocomplete="off" value="${escapeHtml(selected?.username || '')}"></label><label class="form-wide">Contraseña ${selected ? '(déjala vacía para conservarla)' : '*'}<input name="password" type="password" ${selected ? '' : 'required'} minlength="11" maxlength="256" autocomplete="new-password"></label></div>${selected ? `<div class="choice-row"><label><input type="checkbox" name="active" ${selected.active ? 'checked' : ''} ${selected.id === state.session.user.id ? 'disabled' : ''}> Cuenta activa</label></div>` : ''}<div class="editor-actions"><div class="editor-actions__main"><button type="submit" class="button button--primary">${selected ? 'Guardar cuenta' : 'Crear cuenta'}</button><button class="button" type="button" data-cancel-user>Cancelar</button></div></div></form>`
    : ''}`;
}
function renderQr() {
  heading('QR del menú', 'Un acceso directo a la carta digital de consulta.');
  const value = state.qr;
  content.innerHTML = value ? `<div class="qr-section"><div class="qr-frame"><img src="/api/v2/admin/qr.svg" alt="Código QR de la carta digital de Boccantina"></div><div class="qr-details"><h2>Escanea para consultar la carta</h2><a class="qr-link" href="${escapeHtml(value.url)}" target="_blank" rel="noopener">${escapeHtml(value.url)}</a>${value.local ? '<p class="warning">Este QR abre una dirección local de prueba. Antes de imprimirlo para clientes, configura la URL pública HTTPS de la carta.</p>' : ''}<div class="qr-actions"><button class="button button--primary" type="button" data-copy-qr>Copiar enlace</button><a class="button" href="/api/v2/admin/qr.svg?download=1">Descargar QR en SVG</a></div></div></div>` : '<p class="empty">Cargando QR…</p>';
}
function render() {
  clearNotice();
  if (state.view === 'products') renderProducts();
  else if (state.view === 'categories') renderCategories();
  else if (state.view === 'users') renderUsers();
  else renderQr();
}
async function navigate(view) {
  if (view === state.view) return true;
  if (!confirmDiscard()) return false;
  state.dirty = false; state.view = view; state.mobileMode = 'list'; render();
  document.getElementById('main').focus({ preventScroll:true });
  if (view === 'users') { state.users = (await api('/api/v2/admin/users')).users; render(); }
  if (view === 'qr') { state.qr = await api('/api/v2/admin/qr'); render(); }
  return true;
}
function formValue(form, key) { return form.elements.namedItem(key)?.value ?? ''; }
async function saveCatalog(form, entity) {
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const isProduct = entity === 'product';
    const id = isProduct ? state.selectedProduct : state.selectedCategory;
    const input = isProduct ? {
      nameEs:formValue(form,'nameEs'), nameEn:formValue(form,'nameEn'),
      category:formValue(form,'category'), price:formValue(form,'price'),
      descEs:formValue(form,'descEs'), descEn:formValue(form,'descEn'),
      position:formValue(form,'position'), image:formValue(form,'image'),
      visible:form.elements.visible.checked, available:form.elements.available.checked,
      tags:[...form.querySelectorAll('[name=tag]:checked')].map((element) => element.value)
    } : {
      es:formValue(form,'es'), en:formValue(form,'en'),
      esDescription:formValue(form,'esDescription'), enDescription:formValue(form,'enDescription'),
      position:formValue(form,'position'), image:formValue(form,'image'),
      visible:form.elements.visible.checked
    };
    const base = isProduct ? '/api/v2/admin/products' : '/api/v2/admin/categories';
    const result = await api(id ? `${base}/${encodeURIComponent(id)}` : base, {
      method:id ? 'PATCH' : 'POST', body:JSON.stringify({ ...input, revision:state.catalog.revision })
    });
    state.catalog = result.catalog;
    if (isProduct) state.selectedProduct = result.result.id;
    else state.selectedCategory = result.result.id;
    state.dirty = false; render();
    notify(id ? 'Cambios guardados. La carta digital ya refleja esta actualización.' : `${isProduct ? 'Producto creado' : 'Categoría creada'}. Ya aparece en la carta digital si tiene productos visibles.`);
  } catch (error) { notify(error.message, true); button.disabled = false; }
}
async function removeCatalog(entity) {
  if (!confirmDiscard()) return;
  const isProduct = entity === 'product';
  const id = isProduct ? state.selectedProduct : state.selectedCategory;
  const item = isProduct ? state.catalog.products.find((entry) => entry.id === id) : state.catalog.categories.find((entry) => entry.id === id);
  if (!item || !confirm(`¿Eliminar ${isProduct ? 'el producto' : 'la categoría'} “${item.nameEs || item.es}”? Esta acción lo quitará de la carta digital.`)) return;
  try {
    const result = await api(`/api/v2/admin/${isProduct ? 'products' : 'categories'}/${encodeURIComponent(id)}`, { method:'DELETE', body:JSON.stringify({ revision:state.catalog.revision }) });
    state.catalog = result.catalog;
    if (isProduct) state.selectedProduct = null;
    else state.selectedCategory = state.catalog.categories[0]?.id || null;
    state.dirty = false; state.mobileMode = 'list'; render();
    notify(`${isProduct ? 'Producto' : 'Categoría'} eliminado de la carta.`);
  } catch (error) { notify(error.message, true); }
}
async function saveUser(form) {
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const selected = state.users.find((user) => user.id === state.selectedUser);
    const input = { name:formValue(form,'name'), username:formValue(form,'username'), password:formValue(form,'password') };
    if (selected) input.active = selected.id === state.session.user.id ? true : form.elements.active.checked;
    if (selected && selected.active && !input.active && !confirm(`¿Desactivar la cuenta de ${selected.name}? No podrá volver a iniciar sesión.`)) { button.disabled = false; return; }
    const response = await api(selected ? `/api/v2/admin/users/${selected.id}` : '/api/v2/admin/users', { method:selected ? 'PATCH' : 'POST', body:JSON.stringify(input) });
    if (selected?.id === state.session.user.id && input.password) {
      location.assign('/admin/login/?updated=1');
      return;
    }
    state.users = (await api('/api/v2/admin/users')).users;
    state.selectedUser = response.user.id;
    state.dirty = false; render(); notify(selected ? 'Cuenta actualizada.' : 'Administrador creado. Ya puede iniciar sesión.');
  } catch (error) { notify(error.message, true); button.disabled = false; }
}

document.querySelector('.main-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (button) navigate(button.dataset.view).then((changed) => { if (changed) setSidebar(false); }).catch((error) => notify(error.message, true));
});
sidebarToggle.addEventListener('click', () => setSidebar(!document.body.classList.contains('is-sidebar-open'), true));
document.getElementById('sidebar-close').addEventListener('click', () => setSidebar(false, true));
sidebarBackdrop.addEventListener('click', () => setSidebar(false, true));
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('is-sidebar-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); setSidebar(false, true); return; }
  if (event.key !== 'Tab') return;
  const controls = [...sidebar.querySelectorAll('button, a[href]')].filter((item) => !item.disabled);
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
});
content.addEventListener('input', (event) => {
  if (event.target.matches('[data-search]')) { state.search = event.target.value; content.querySelector('[data-items]').innerHTML = productRows(); return; }
  if (event.target.closest('form')) markDirty();
});
content.addEventListener('change', (event) => {
  if (event.target.matches('[data-filter]')) { state.filter = event.target.value; content.querySelector('[data-items]').innerHTML = productRows(); return; }
  if (event.target.closest('form')) markDirty();
  if (!event.target.matches('[data-image-upload]')) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { notify('Usa una imagen JPG, PNG o WebP de hasta 3 MB.', true); event.target.value = ''; return; }
  api('/api/v2/admin/images', { method:'POST', headers:{ 'content-type':file.type }, body:file })
    .then((result) => {
      const form = event.target.closest('form');
      form.elements.image.value = result.path;
      const preview = form.querySelector('.image-preview');
      const image = document.createElement('img');
      image.className = 'image-preview'; image.src = result.path; image.alt = 'Vista previa de la imagen seleccionada';
      preview.replaceWith(image);
      markDirty(); notify('Imagen preparada. Guarda el formulario para aplicarla a la carta.');
    }).catch((error) => notify(error.message, true));
});
content.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  if (form.dataset.entity) saveCatalog(form, form.dataset.entity);
  else if (form.id === 'user-form') saveUser(form);
});
content.addEventListener('click', (event) => {
  const target = event.target;
  const product = target.closest('[data-select-product]');
  const category = target.closest('[data-select-category]');
  const user = target.closest('[data-edit-user]');
  if (product || category || user) {
    if (!confirmDiscard()) return;
    state.dirty = false;
    if (product) state.selectedProduct = product.dataset.selectProduct;
    if (category) state.selectedCategory = category.dataset.selectCategory;
    if (user) { state.selectedUser = user.dataset.editUser; state.userFormOpen = true; }
    state.mobileMode = 'editor'; render(); content.querySelector('.editor-panel, .user-form')?.scrollIntoView({ block:'start' });
    return;
  }
  if (target.closest('[data-new-product], [data-new-category], [data-new-user]')) {
    if (!confirmDiscard()) return;
    state.dirty = false;
    if (target.closest('[data-new-product]')) state.selectedProduct = null;
    if (target.closest('[data-new-category]')) state.selectedCategory = null;
    if (target.closest('[data-new-user]')) { state.selectedUser = null; state.userFormOpen = true; }
    state.mobileMode = 'editor'; render(); content.querySelector('form input')?.focus();
    return;
  }
  if (target.closest('[data-back-list], [data-cancel-form], [data-cancel-user]')) {
    if (!confirmDiscard()) return;
    state.dirty = false; state.mobileMode = 'list';
    if (target.closest('[data-cancel-user]')) state.userFormOpen = false;
    render(); return;
  }
  if (target.closest('[data-delete-product]')) return removeCatalog('product');
  if (target.closest('[data-delete-category]')) return removeCatalog('category');
  if (target.closest('[data-clear-image]')) {
    const form = target.closest('form');
    form.elements.image.value = '';
    form.querySelector('.image-preview').replaceWith(Object.assign(document.createElement('div'), { className:'image-preview image-placeholder', textContent:'Sin imagen propia.' }));
    target.remove(); markDirty(); return;
  }
  if (target.closest('[data-copy-qr]')) navigator.clipboard.writeText(state.qr.url)
    .then(() => notify('Enlace de la carta copiado.')).catch(() => notify('No se pudo copiar. Selecciona el enlace visible.', true));
});
document.getElementById('logout-button').addEventListener('click', async () => {
  if (!confirmDiscard()) return;
  try { await api('/api/v2/admin/logout', { method:'POST', body:'{}' }); }
  finally { location.assign('/admin/login/'); }
});
document.getElementById('theme-button').addEventListener('click', () => {
  const theme = document.body.dataset.theme === 'blue' ? 'gold' : 'blue';
  document.body.dataset.theme = theme;
  localStorage.setItem('boccantina-v2-admin-theme', theme);
  document.getElementById('theme-button').textContent = theme === 'blue' ? 'Estilo dorado' : 'Estilo azul';
});
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  try {
    const theme = localStorage.getItem('boccantina-v2-admin-theme') === 'gold' ? 'gold' : 'blue';
    document.body.dataset.theme = theme;
    document.getElementById('theme-button').textContent = theme === 'blue' ? 'Estilo dorado' : 'Estilo azul';
    state.session = await api('/api/v2/admin/session');
    state.catalog = await api('/api/v2/admin/catalog');
    state.selectedProduct = state.catalog.products[0]?.id || null;
    state.selectedCategory = state.catalog.categories[0]?.id || null;
    document.getElementById('current-user').textContent = state.session.user.name;
    render();
  } catch (error) { notify(error.message, true); }
}
start();
