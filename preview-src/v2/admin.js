import {loadPrintDrafts,savePrintDrafts,createPrintDraft,printDraftFields,readPrintDraft,printDraftFeedback} from './shared-print/drafts.js';
import {renderPrintBody,paginatePrint,fitPrintPreview} from './print-layout.js';
const state = {
  catalog:null, users:[], session:null, view:'products', selectedProduct:null,
  selectedCategory:null, selectedUser:null, userFormOpen:false, mobileMode:'list', dirty:false,
  search:'', filter:'all', qr:null, printLanguage:'es', printProposal:'actual', printSize:'A4', printStatus:null, printBusy:false
};
const printChoices=new Proxy({actual:'Diseño actual'},{get:(choices,id)=>choices[id]||escapeHtml(printName(id))});
const printAdded=[];
let printDrafts=loadPrintDrafts('boccantina');
const selectedPrintDraft=()=>printDrafts.find(item=>item.id===state.printProposal);
const printDesign=()=>selectedPrintDraft()?.design||null;
const printName=id=>id==='actual'?'Diseño actual':printDrafts.find(item=>item.id===id)?.name||'Propuesta eliminada';
const printQuery=()=>`lang=${state.printLanguage}&proposal=${encodeURIComponent(state.printProposal)}&size=${state.printSize}${printDesign()?`&design=${encodeURIComponent(JSON.stringify(printDesign()))}`:''}`;
let stopPrintPreview,printPreviewRequest=0;
let printEditorInvalid=false;
function setPrintEditorInvalid(invalid){
  printEditorInvalid=invalid;
  const preview=content.querySelector('[data-preview-print]'),print=content.querySelector('[data-browser-print]');
  if(preview)preview.setAttribute('aria-disabled',String(invalid));
  if(print)print.disabled=invalid;
  if(invalid){printRefreshRequest++;const generate=content.querySelector('[data-generate-print]');if(generate)generate.disabled=true;content.querySelector('.print-download')?.remove();}
}
let printStylesReady;
async function renderPrintPreview(){
  const host=content.querySelector('[data-print-live-preview]');if(!host||!state.catalog)return;
  const request=++printPreviewRequest;
  try{
    if(!printStylesReady){
      printStylesReady=new Promise((resolve,reject)=>{
        const link=document.createElement('link');link.rel='stylesheet';link.dataset.printStyles='true';link.href='/v2/print.css';
        link.onload=resolve;link.onerror=()=>{printStylesReady=null;link.remove();reject(new Error('No se pudieron cargar los estilos de la propuesta.'));};document.head.append(link);
      });
    }
    await printStylesReady;
    if(request!==printPreviewRequest||!host.isConnected)return;
    stopPrintPreview?.();
    host.innerHTML=renderPrintBody(state.catalog,state.printLanguage,new URL('../preview/assets/boccantina-logo-transparent.png',import.meta.url).href,{design:printDesign(),size:state.printSize});
    const menu=host.querySelector('.print-menu');await paginatePrint(menu);
    if(request!==printPreviewRequest||!host.isConnected)return;
    stopPrintPreview=fitPrintPreview(menu);
  }catch(error){if(request===printPreviewRequest&&host.isConnected)host.textContent=`No se pudo mostrar la vista previa: ${error.message}`;}
}
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
let browserPrintService;
function demoPrint() {
  return browserPrintService ||= import('/v2/shared-print/engine.js').then(({createPrintService}) => createPrintService({
    brand:'boccantina', readCatalog:() => window.BoccV2DemoCatalog(),
    logo:new URL('/preview/assets/boccantina-logo-transparent.png', location.origin).href
  }));
}
async function api(path, options = {}) {
  if (document.querySelector('meta[name="boccantina-demo-base"]') && /\/api\/v2\/admin\/print\//.test(path)) {
    const service = await demoPrint();
    if (options.method === 'POST') {
      const data = JSON.parse(options.body);
      return service.generate(data.revision, data.language, data.proposal, data.size,data.design);
    }
    const query=new URL(path,location.origin).searchParams;
    return service.status(query.get('lang') || 'es',query.get('proposal') || 'actual',query.get('size') || 'A4',query.has('design')?JSON.parse(query.get('design')):null);
  }
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
let qrDesign, qrArtwork;
function qrDesigner() { return qrDesign ||= import('/v2/qr-design.js'); }
async function loadQrArtwork(value, section) {
  try {
    const designer = await qrDesigner();
    const artwork = qrArtwork?.url === value.url ? qrArtwork : await designer.createQrArtwork(value.url);
    if (!section.isConnected) return;
    const image = section.querySelector('[data-qr-artwork]');
    image.src = artwork.image;
    await image.decode();
    if (!section.isConnected) return;
    qrArtwork = artwork;
    image.hidden = false;
    section.querySelector('[data-qr-loading]').hidden = true;
    section.querySelectorAll('[data-download-qr-design], [data-print-qr-design]').forEach((button) => { button.disabled = false; });
    section.querySelector('.qr-stage').setAttribute('aria-busy', 'false');
  } catch (error) {
    if (!section.isConnected) return;
    section.querySelector('.qr-stage').setAttribute('aria-busy', 'false');
    section.querySelector('[data-qr-loading]').textContent = 'No se pudo cargar el cartel.';
    section.querySelector('[data-retry-qr]').hidden = false;
    notify(error.message, true);
  }
}
function renderQr() {
  heading('QR del menú', 'Un acceso directo a la carta digital de consulta.');
  const value = state.qr;
  content.innerHTML = value ? `<div class="qr-section">
    <figure class="qr-preview">
      <div class="qr-stage" aria-busy="true">
        <p data-qr-loading role="status">Preparando cartel…</p>
        <button class="button" type="button" data-retry-qr hidden>Reintentar</button>
        <img class="qr-poster" data-qr-artwork width="420" height="592" hidden alt="Cartel de Boccantina. La carta. El siguiente buen momento. Escanea el código con tu cámara para consultar la carta en español e inglés, sin aplicaciones.">
      </div>
      <figcaption>Cartel A6 · 105 × 148 mm</figcaption>
    </figure>
    <div class="qr-actions" aria-label="Acciones del cartel QR">
      <button class="button button--primary" type="button" data-download-qr-design disabled>Descargar diseño SVG</button>
      <button class="button" type="button" data-print-qr-design disabled>Imprimir / guardar PDF</button>
      <button class="button" type="button" data-copy-qr>Copiar enlace</button>
    </div>
    <div class="qr-details">
      <span class="qr-destination-label">Destino del QR</span>
      <a class="qr-link" href="${escapeHtml(value.url)}" target="_blank" rel="noopener">${escapeHtml(value.url)}</a>
      ${value.local ? '<p class="warning">Este QR abre una dirección local de prueba. Antes de imprimirlo para clientes, configura la URL pública HTTPS de la carta.</p>' : ''}
      <a class="qr-code-download" href="/api/v2/admin/qr.svg?download=1">Descargar solo el código QR en SVG</a>
    </div>
  </div>` : '<p class="empty">Cargando QR…</p>';
  if (value) loadQrArtwork(value, content.querySelector('.qr-section'));
}
function renderPrint() {
  printEditorInvalid=false;
  heading('Menú para imprimir', 'Elige una propuesta y un tamaño antes de generar el PDF.');
  const demo = Boolean(document.querySelector('meta[name="boccantina-demo-base"]'));
  const status = state.printStatus;
  const editions = (status?.editions || []).filter(edition=>!edition.legacy&&(edition.proposal==='actual'||printDrafts.some(item=>item.id===edition.proposal)));
  const language = state.printLanguage;
  const missing=Object.keys(printChoices).filter(value=>value!=='actual'&&!printAdded.includes(value));
  const active=editions.find(edition=>edition.current);
  content.innerHTML = `<div class="print-workspace"><div class="print-intro"><h2>Edición para el local</h2><p>Los diseños toman nombres, categorías, orden y precios de la carta guardada. Solo el diseño actual aparece inicialmente; añade alternativas cuando quieras compararlas.</p></div>
    <div class="print-proposals"><label>Propuesta<select data-print-proposal>${['actual',...printAdded].map(value=>`<option value="${value}" ${state.printProposal===value?'selected':''}>${printChoices[value]}</option>`).join('')}</select></label>${missing.length?`<label>Añadir otra propuesta<select data-print-add-choice>${missing.map(value=>`<option value="${value}">${printChoices[value]}</option>`).join('')}</select></label><button class="button" type="button" data-print-add>+ Añadir propuesta</button>`:''}</div>
    <div class="print-controls"><label>Tamaño del papel<select data-print-size>${['A4','A3','A2'].map(value=>`<option value="${value}" ${state.printSize===value?'selected':''}>${value} · ${printDesign()?.template==='botanical'?'horizontal':'vertical'}</option>`).join('')}</select></label><label>Idioma de la edición<select data-print-language><option value="es" ${language === 'es' ? 'selected' : ''}>Español</option><option value="en" ${language === 'en' ? 'selected' : ''}>English</option></select></label><a class="button" data-preview-print href="/imprimir/?lang=${language}&proposal=${state.printProposal}&size=${state.printSize}" target="_blank" rel="noopener">Vista previa ↗</a>${demo ? '<button class="button" type="button" data-browser-print>Imprimir</button>' : ''}<button class="button button--primary" type="button" data-generate-print ${state.printBusy || !status || status.current ? 'disabled' : ''}>${state.printBusy ? 'Preparando PDF…' : 'Generar PDF'}</button><button class="button" type="button" data-refresh-print>Actualizar estado</button></div>
    <p class="print-state" role="status">${!status ? 'Consultando ediciones…' : status.current ? `${printChoices[state.printProposal]} · ${state.printSize} · ${language.toUpperCase()} actualizado.` : `Esta combinación todavía no tiene un PDF vigente. Cambios de contenido: ${status.changes.added} incorporaciones, ${status.changes.changed} cambios y ${status.changes.removed} retiradas.`}</p>
    ${active?`<a class="button button--primary print-download" data-edition="${escapeHtml(active.id)}" href="/api/v2/admin/print/${encodeURIComponent(active.id)}.pdf">Descargar ${printChoices[state.printProposal]} · ${state.printSize} · ${language.toUpperCase()}</a>`:''}
    ${demo ? '<p class=help>PDF e historial guardados solo en este navegador.</p>' : ''}<details class="print-archive"><summary>Archivo de PDF anteriores</summary><p class="help">Estos archivos pueden contener diseños o datos anteriores. Comparte la descarga de la propuesta seleccionada.</p><ul class="print-editions">${editions.length ? editions.map((edition) => `<li><div><strong>${edition.legacy?'Diseño anterior':printChoices[edition.proposal]||'Propuesta archivada'} · ${edition.size||'tamaño anterior'} · ${edition.language === 'es' ? 'Español' : 'English'}</strong><span>${escapeHtml(new Date(edition.createdAt).toLocaleString('es-CR'))} · ${escapeHtml(edition.author)}</span><small>${edition.current ? 'Selección vigente' : 'Archivo histórico; no compartir como menú actual'}</small></div><a class="button" data-edition="${escapeHtml(edition.id)}" href="/api/v2/admin/print/${encodeURIComponent(edition.id)}.pdf">Descargar archivo</a></li>`).join('') : '<li>Aún no hay archivos.</li>'}</ul></details></div>`;
  const proposalSelect=content.querySelector('[data-print-proposal]');
  for(const item of printDrafts)proposalSelect.add(new Option(item.name,item.id,item.id===state.printProposal,item.id===state.printProposal));
  if(printDrafts.length<2)content.querySelector('.print-proposals').insertAdjacentHTML('beforeend','<button class="button" type="button" data-print-add>+ Nueva propuesta</button>');
  content.querySelector('.print-proposals').insertAdjacentHTML('afterend',printDraftFields(selectedPrintDraft()));
  content.querySelector('[data-preview-print]').href='/imprimir/?'+printQuery();
  content.querySelector('.print-controls').insertAdjacentHTML('afterend','<section class="print-preview-panel" aria-label="Vista previa del menú"><h3>Vista previa de la composición</h3><div data-print-live-preview tabindex="0" aria-label="Páginas del menú impreso, desplazables"></div></section>');
  if(selectedPrintDraft()){
    const editor=content.querySelector('.print-editor'),preview=content.querySelector('.print-preview-panel');
    const workspace=document.createElement('div');workspace.className='print-design-workspace';editor.before(workspace);workspace.append(editor,preview);
  }
  content.querySelector('.print-intro p').textContent='El diseño actual se conserva. Crea hasta dos propuestas propias y ajusta su composición. Los platos y precios vienen de la carta guardada.';
  if(demo)content.querySelectorAll('[data-edition]').forEach(link=>{
    const button=document.createElement('button');button.type='button';button.className=link.className;button.dataset.edition=link.dataset.edition;button.textContent=link.textContent;link.replaceWith(button);
  });
  renderPrintPreview();
}
let printRefreshRequest=0;
async function refreshPrint(preserveEditor=false,reloadCatalog=false) {
  const request=++printRefreshRequest;
  const generate=content.querySelector('[data-generate-print]');if(generate)generate.disabled=true;
  content.querySelector('.print-download')?.remove();
  if(reloadCatalog){
    const latest=await api('/api/v2/admin/catalog');
    if(request!==printRefreshRequest||state.view!=='print')return;
    state.catalog=latest;
  }
  const status=await api('/api/v2/admin/print/status?'+printQuery());
  if(request!==printRefreshRequest||printEditorInvalid)return;
  state.printStatus=status;
  if(state.view!=='print')return;
  if(!preserveEditor){renderPrint();return;}
  const stateLine=content.querySelector('.print-state'),button=content.querySelector('[data-generate-print]');
  if(stateLine)stateLine.textContent=status.current?`${printName(state.printProposal)} · ${state.printSize} · ${state.printLanguage.toUpperCase()} actualizado.`:`Esta combinación todavía no tiene un PDF vigente. Cambios de contenido: ${status.changes.added} incorporaciones, ${status.changes.changed} cambios y ${status.changes.removed} retiradas.`;
  if(button)button.disabled=Boolean(status.current)||state.printBusy;
  content.querySelector('.print-download')?.remove();
  const active=status.editions.find(edition=>edition.current);
  if(active&&stateLine){
    const demo=Boolean(document.querySelector('meta[name="boccantina-demo-base"]'));
    const action=document.createElement(demo?'button':'a');
    action.className='button button--primary print-download';action.dataset.edition=active.id;
    action.textContent=`Descargar ${printName(state.printProposal)} · ${state.printSize} · ${state.printLanguage.toUpperCase()}`;
    if(demo)action.type='button';else action.href=`/api/v2/admin/print/${encodeURIComponent(active.id)}.pdf`;
    stateLine.insertAdjacentElement('afterend',action);
  }
}
function render() {
  clearNotice();
  if (state.view === 'products') renderProducts();
  else if (state.view === 'categories') renderCategories();
  else if (state.view === 'users') renderUsers();
  else if (state.view === 'qr') renderQr();
  else renderPrint();
}
async function navigate(view) {
  if (view === state.view) return true;
  if (!confirmDiscard()) return false;
  state.dirty = false; state.view = view; state.mobileMode = 'list'; render();
  document.getElementById('main').focus({ preventScroll:true });
  if (view === 'users') { state.users = (await api('/api/v2/admin/users')).users; render(); }
  if (view === 'qr') { state.qr = await api('/api/v2/admin/qr'); render(); }
  if (view === 'print') await refreshPrint();
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
  if(event.target.matches('[data-print-name],[data-print-design]'))return;
  if (event.target.matches('[data-search]')) { state.search = event.target.value; content.querySelector('[data-items]').innerHTML = productRows(); return; }
  if (event.target.closest('form')) markDirty();
});
content.addEventListener('change', (event) => {
  if(event.target.matches('[data-print-name],[data-print-design]')){
    const draft=selectedPrintDraft();if(!draft)return;
    try{
      const updated=readPrintDraft(content,draft,'boccantina',printDrafts);
      const next=printDrafts.map(item=>item.id===draft.id?updated:item);savePrintDrafts('boccantina',next);printDrafts=next;
      content.querySelector('[data-print-proposal]').selectedOptions[0].textContent=updated.name;
      content.querySelector('[data-preview-print]').href='/imprimir/?'+printQuery();
      content.querySelectorAll('[data-print-size] option').forEach(option=>{option.textContent=`${option.value} · ${updated.design.template==='botanical'?'horizontal':'vertical'}`;});
      setPrintEditorInvalid(false);printDraftFeedback(content,'Propuesta guardada en este navegador.');
      renderPrintPreview();refreshPrint(true).catch(error=>notify(error.message,true));
    }catch(error){setPrintEditorInvalid(true);printDraftFeedback(content,error.message,true);}
    return;
  }
  if (event.target.matches('[data-print-language]')) { setPrintEditorInvalid(false); state.printLanguage = event.target.value; refreshPrint().catch((error) => notify(error.message, true)); return; }
  if (event.target.matches('[data-print-proposal]')) { setPrintEditorInvalid(false); state.printProposal = event.target.value; state.printStatus=null; refreshPrint().catch((error) => notify(error.message, true)); return; }
  if (event.target.matches('[data-print-size]')) { setPrintEditorInvalid(false); state.printSize = event.target.value; state.printStatus=null; refreshPrint().catch((error) => notify(error.message, true)); return; }
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
  if(printEditorInvalid&&target.closest('[data-generate-print],[data-preview-print],[data-browser-print]')){
    event.preventDefault();content.querySelector('[aria-invalid="true"]')?.focus();return;
  }
  if (target.closest('[data-print-add]')) {
    if(printDrafts.length<2){setPrintEditorInvalid(false);const value=createPrintDraft('boccantina',printDrafts.length+1);printDrafts.push(value);savePrintDrafts('boccantina',printDrafts);state.printProposal=value.id;state.printStatus=null;refreshPrint().catch(error=>notify(error.message,true));}return;
  }
  if(target.closest('[data-print-delete]')){
    const selected=selectedPrintDraft();
    if(selected&&confirm('¿Eliminar la propuesta «'+selected.name+'»? Sus PDF dejarán de aparecer en esta lista.')){
      setPrintEditorInvalid(false);printDrafts=printDrafts.filter(item=>item.id!==selected.id);savePrintDrafts('boccantina',printDrafts);state.printProposal='actual';state.printStatus=null;refreshPrint().catch(error=>notify(error.message,true));
    }return;
  }
  if (document.querySelector('meta[name="boccantina-demo-base"]')) {
    const action = target.closest('[data-preview-print],[data-browser-print],[data-edition]');
    if(action) {
      event.preventDefault();const popup=action.dataset.edition?null:window.open('','_blank');
      demoPrint().then(service=>action.dataset.edition?service.download(action.dataset.edition):service.preview(state.printLanguage,popup,action.hasAttribute('data-browser-print'),state.printProposal,state.printSize,printDesign()))
        .catch(error=>{popup?.close();notify(error.message,true);});return;
    }
  }
  if (target.closest('[data-refresh-print]')) { refreshPrint(false,true).catch((error) => notify(error.message, true)); return; }
  if (target.closest('[data-generate-print]')) {
    if(state.printBusy)return;
    state.printBusy = true; renderPrint();
    api('/api/v2/admin/print/editions', { method:'POST', body:JSON.stringify({ revision:state.printStatus?.revision ?? state.catalog.revision, language:state.printLanguage, proposal:state.printProposal, size:state.printSize,design:printDesign() }) })
      .then(() => refreshPrint()).then(() => notify('PDF actualizado. Descárgalo desde la propuesta seleccionada.'))
      .catch((error) => notify(error.message, true)).finally(() => { state.printBusy = false; if (state.view === 'print') renderPrint(); });
    return;
  }
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
  if (target.closest('[data-retry-qr]')) { clearNotice(); renderQr(); return; }
  if (target.closest('[data-download-qr-design], [data-print-qr-design]')) {
    if (!qrArtwork || qrArtwork.url !== state.qr?.url) return;
    qrDesigner().then((designer) => target.closest('[data-download-qr-design]')
      ? designer.downloadQrArtwork(qrArtwork) : designer.printQrArtwork(qrArtwork))
      .catch((error) => notify(error.message, true));
    return;
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
