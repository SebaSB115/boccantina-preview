const root = document.getElementById('menu-root');
const state = { catalog:null, language:localStorage.getItem('boccantina-v2-menu-language') === 'en' ? 'en' : 'es', category:null, query:'' };
const translations = {
  es: { menu:'Carta digital', heading:'La carta', consult:'Solo consulta', category:'Categoría', intro:'Explora platos, precios y disponibilidad.', categories:'Categorías', pick:'Elegir categoría', search:'Buscar un plato o ingrediente', searchPlaceholder:'Buscar en toda la carta', clear:'Limpiar búsqueda', dishes:'platos', dish:'plato', featuredDish:'Plato', results:'Resultados de búsqueda', noResults:'No encontramos platos con ese nombre o ingrediente.', noCategory:'La carta está en preparación. Consulta al personal del restaurante.', count:'en esta categoría', details:'Ver detalles', close:'Cerrar detalles', unavailable:'No disponible actualmente', pricePending:'Precio por confirmar', reference:'Imagen ilustrativa de la categoría', ownPhoto:'Fotografía del plato', noDescription:'Consulta al personal por los detalles de este plato.', nextLanguage:'English' },
  en: { menu:'Digital menu', heading:'The menu', consult:'Browse only', category:'Category', intro:'Explore dishes, prices and availability.', categories:'Categories', pick:'Choose a category', search:'Search for a dish or ingredient', searchPlaceholder:'Search the whole menu', clear:'Clear search', dishes:'dishes', dish:'dish', featuredDish:'Dish', results:'Search results', noResults:'No dishes match that name or ingredient.', noCategory:'The menu is being prepared. Please ask our team.', count:'in this category', details:'View details', close:'Close details', unavailable:'Currently unavailable', pricePending:'Price to be confirmed', reference:'Illustrative category image', ownPhoto:'Dish photograph', noDescription:'Please ask our team for more details about this dish.', nextLanguage:'Español' }
};
const html = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const copy = () => translations[state.language];
const localized = (item, esKey, enKey) => state.language === 'en' ? item[enKey] || item[esKey] || '' : item[esKey] || '';
const categoryName = (item) => localized(item, 'es', 'en');
const categoryDescription = (item) => localized(item, 'esDescription', 'enDescription');
const productName = (item) => localized(item, 'nameEs', 'nameEn');
const productDescription = (item) => localized(item, 'descEs', 'descEn');
const price = (value) => value === null ? copy().pricePending : `₡${Number(value).toLocaleString('es-CR')}`;
const realPhoto = (item) => item.ownPhoto === true && (/^data:image\/(?:jpeg|png|webp);base64,/.test(item.image || '') || /^\/(?:media\/[0-9a-f-]{36}|v2\/assets\/[a-z0-9-]+)\.(?:jpg|png|webp)$/.test(String(item.image || '').replace(/^\/boccantina-preview(?=\/)/, '')));
const categoryById = (id) => state.catalog.categories.find((item) => item.id === id);
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function categoryImage(category) {
  if (category.image) return { path:category.image, caption:categoryName(category) };
  const own = state.catalog.products.find((product) => product.category === category.id && realPhoto(product));
  if (own) return { path:own.image, caption:`${copy().featuredDish}: ${productName(own)}` };
  const first = state.catalog.products.find((product) => product.category === category.id && product.image);
  return first ? { path:first.image, caption:realPhoto(first) ? `${copy().featuredDish}: ${productName(first)}` : copy().reference } : null;
}

function shell() {
  root.innerHTML = `<header class="site-header"><div class="site-header__inner">
    <a class="brand" href="/boccantina-preview/carta/" aria-label="Boccantina · ${html(copy().menu)}"><img src="/boccantina-preview/preview/assets/boccantina-logo-transparent.png" alt="Boccantina Cantina de Vinos" width="401" height="98"></a>
    <div class="header-tools"><span class="consult-label">${html(copy().consult)}</span><button class="language-button" type="button" data-language>${html(copy().nextLanguage)}</button></div>
  </div></header>
  <main class="menu-layout" id="platos" tabindex="-1">
    <aside class="menu-navigation" aria-label="${html(copy().categories)}">
      <div class="menu-navigation__title"><span class="eyebrow">${html(copy().consult)}</span><h1>${html(copy().heading)}</h1><p>${html(copy().intro)}</p></div>
      <label class="search-label" for="menu-search">${html(copy().search)}</label>
      <div class="search-control"><input id="menu-search" name="menu-search" type="search" autocomplete="off" placeholder="${html(copy().searchPlaceholder)}" value="${html(state.query)}"><button type="button" class="clear-search" data-clear-search aria-label="${html(copy().clear)}" ${state.query ? '' : 'hidden'}>×</button></div>
      <nav class="category-links" aria-label="${html(copy().categories)}" data-category-links></nav>
      <label class="category-picker-label" for="category-picker">${html(copy().pick)}</label>
      <select id="category-picker" name="category-picker" data-category-picker></select>
    </aside>
    <section class="menu-content"><div id="menu-results"></div></section>
  </main>
  <dialog class="dish-dialog" aria-label="${html(copy().details)}"><div class="dish-dialog__content" data-dialog-content></div></dialog>`;
  renderNavigation(); renderResults();
}

function renderNavigation() {
  const categories = state.catalog.categories;
  root.querySelector('[data-category-links]').innerHTML = categories.map((item) => `<button type="button" data-category="${html(item.id)}" aria-current="${item.id === state.category && !state.query ? 'true' : 'false'}">${html(categoryName(item))}</button>`).join('');
  const picker = root.querySelector('[data-category-picker]');
  picker.innerHTML = categories.map((item) => `<option value="${html(item.id)}" ${item.id === state.category ? 'selected' : ''}>${html(categoryName(item))}</option>`).join('');
}

function itemsForView() {
  if (!state.query) return state.catalog.products.filter((item) => item.category === state.category);
  const needle = normalize(state.query.trim());
  return state.catalog.products.filter((item) => normalize(`${item.nameEs} ${item.nameEn} ${item.descEs} ${item.descEn}`).includes(needle));
}

function dishRow(item) {
  const photo = realPhoto(item) ? `<img class="dish-row__photo" src="${html(item.image)}" alt="" width="88" height="88" loading="lazy" decoding="async">` : '';
  const description = productDescription(item);
  return `<article class="dish-row${item.soldOut ? ' dish-row--unavailable' : ''}">
    ${photo}<div class="dish-row__main"><div class="dish-row__heading"><h3>${html(productName(item))}</h3><span class="dish-row__price">${html(price(item.price))}</span></div>
    ${description ? `<p class="dish-row__description">${html(description)}</p>` : ''}
    <div class="dish-row__footer">${item.soldOut ? `<span class="dish-row__status">${html(copy().unavailable)}</span>` : '<span></span>'}<button type="button" class="details-button" data-detail="${html(item.id)}">${html(copy().details)} <span aria-hidden="true">↗</span></button></div></div>
  </article>`;
}

function renderResults() {
  const container = root.querySelector('#menu-results');
  const items = itemsForView();
  const search = Boolean(state.query);
  const category = categoryById(state.category);
  if (!category && !search) { container.innerHTML = `<p class="menu-empty">${html(copy().noCategory)}</p>`; return; }
  const visual = !search && category ? categoryImage(category) : null;
  const title = search ? copy().results : categoryName(category);
  const subtitle = search ? `“${html(state.query)}”` : categoryDescription(category);
  container.innerHTML = `<header class="category-feature${visual ? '' : ' category-feature--plain'}">
      <div class="category-feature__copy"><span class="eyebrow">${html(search ? copy().results : copy().category)}</span><h2 id="category-title" tabindex="-1">${html(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}<span class="category-feature__count" role="status" aria-live="polite">${items.length} ${html(items.length === 1 ? copy().dish : copy().dishes)}${search ? '' : ` ${html(copy().count)}`}</span></div>
      ${visual ? `<figure class="category-feature__visual"><img src="${html(visual.path)}" alt="" width="600" height="420" decoding="async"><figcaption>${html(visual.caption)}</figcaption></figure>` : ''}
    </header>
    <div class="dish-list">${items.length ? items.map(dishRow).join('') : `<p class="menu-empty">${html(search ? copy().noResults : copy().noCategory)}</p>`}</div>`;
}

function openDetail(id) {
  const item = state.catalog.products.find((product) => product.id === id);
  if (!item) return;
  const dialog = root.querySelector('.dish-dialog');
  dialog.querySelector('[data-dialog-content]').innerHTML = `<div class="dish-dialog__header"><span class="eyebrow">BOCCANTINA · ${html(copy().menu)}</span><button type="button" class="dialog-close" data-dialog-close aria-label="${html(copy().close)}">×</button></div>
    ${realPhoto(item) ? `<figure class="dish-dialog__visual"><img src="${html(item.image)}" alt="${html(productName(item))}" width="640" height="430" decoding="async"><figcaption>${html(copy().ownPhoto)}</figcaption></figure>` : ''}
    <div class="dish-dialog__body"><h2>${html(productName(item))}</h2><strong>${html(price(item.price))}</strong><p>${html(productDescription(item) || copy().noDescription)}</p>${item.soldOut ? `<p class="dish-dialog__status">${html(copy().unavailable)}</p>` : ''}</div>`;
  dialog.showModal();
  dialog.querySelector('[data-dialog-close]').focus();
}

root.addEventListener('click', (event) => {
  const language = event.target.closest('[data-language]');
  if (language) {
    state.language = state.language === 'es' ? 'en' : 'es';
    localStorage.setItem('boccantina-v2-menu-language', state.language);
    document.documentElement.lang = state.language;
    document.title = `${copy().menu} · Boccantina`;
    shell(); root.querySelector('[data-language]').focus(); return;
  }
  const category = event.target.closest('[data-category]');
  if (category) { state.category = category.dataset.category; state.query = ''; shell(); root.querySelector('#category-title')?.focus(); return; }
  const clear = event.target.closest('[data-clear-search]');
  if (clear) { state.query = ''; root.querySelector('#menu-search').value = ''; root.querySelector('[data-clear-search]').hidden = true; renderNavigation(); renderResults(); root.querySelector('#menu-search').focus(); return; }
  const detail = event.target.closest('[data-detail]');
  if (detail) { openDetail(detail.dataset.detail); return; }
  if (event.target.closest('[data-dialog-close]')) root.querySelector('.dish-dialog').close();
});
root.addEventListener('input', (event) => {
  if (event.target.id !== 'menu-search') return;
  state.query = event.target.value.trim();
  root.querySelector('[data-clear-search]').hidden = !state.query;
  renderNavigation(); renderResults();
});
root.addEventListener('change', (event) => {
  if (event.target.id !== 'category-picker') return;
  state.category = event.target.value; state.query = ''; shell(); root.querySelector('#category-title')?.focus();
});
root.addEventListener('click', (event) => {
  const dialog = root.querySelector('.dish-dialog');
  if (event.target === dialog) dialog.close();
});

async function start() {
  document.documentElement.lang = state.language;
  document.title = `${copy().menu} · Boccantina`;
  try {
    const response = await fetch('/boccantina-preview/api/v2/catalog', { cache:'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la carta.');
    state.catalog = await response.json();
    state.category = state.catalog.categories[0]?.id || null;
    shell();
  } catch (error) {
    root.innerHTML = `<main class="load-error" role="alert"><h1>La carta no está disponible</h1><p>${html(error.message)}</p><button type="button" data-retry>Reintentar</button></main>`;
    root.querySelector('[data-retry]').addEventListener('click', () => location.reload());
  }
}
start();
