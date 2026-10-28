const root = document.getElementById('menu-root');
function initialLanguage() {
  try { const saved = localStorage.getItem('boccantina-v2-menu-language'); if (saved === 'es' || saved === 'en') return saved; } catch {}
  return /^es(?:-|$)/i.test(navigator.language || '') ? 'es' : 'en';
}
const ALL_PRODUCTS = '__all__';
const railPositions = new Map();
let detailTrigger = null, detailScroll = 0;
const state = { catalog:null, language:initialLanguage(), category:ALL_PRODUCTS, query:'' };
const translations = {
  es: { menu:'Carta digital', heading:'La carta', consult:'Solo consulta', category:'Categoría', intro:'Explora platos, precios y disponibilidad.', categories:'Categorías', allProducts:'Todos los productos', pick:'Elegir categoría', change:'Cambiar categoría', search:'Buscar un plato o ingrediente', searchPlaceholder:'Buscar en toda la carta', clear:'Limpiar búsqueda', dishes:'platos', dish:'plato', featuredDish:'Plato', results:'Resultados de búsqueda', noResults:'No encontramos platos con ese nombre o ingrediente.', noCategory:'La carta está en preparación. Consulta al personal del restaurante.', count:'en esta categoría', details:'Ver detalles', close:'Cerrar detalles', unavailable:'No disponible actualmente', pricePending:'Precio por confirmar', reference:'Imagen ilustrativa de la categoría', ownPhoto:'Fotografía del plato', noDescription:'Consulta al personal por los detalles de este plato.' },
  en: { menu:'Digital menu', heading:'The menu', consult:'Browse only', category:'Category', intro:'Explore dishes, prices and availability.', categories:'Categories', allProducts:'All dishes', pick:'Choose a category', change:'Change category', search:'Search for a dish or ingredient', searchPlaceholder:'Search the whole menu', clear:'Clear search', dishes:'dishes', dish:'dish', featuredDish:'Dish', results:'Search results', noResults:'No dishes match that name or ingredient.', noCategory:'The menu is being prepared. Please ask our team.', count:'in this category', details:'View details', close:'Close details', unavailable:'Currently unavailable', pricePending:'Price to be confirmed', reference:'Illustrative category image', ownPhoto:'Dish photograph', noDescription:'Please ask our team for more details about this dish.' }
};
Object.assign(translations.es, { allShort:'Todos', previousCategories:'Categorías anteriores', nextCategories:'Más categorías', previousDishes:'Platos anteriores', nextDishes:'Más platos', carousel:'Carrusel de platos', illustrative:'Imagen ilustrativa', noPhoto:'Sin fotografía' });
Object.assign(translations.en, { allShort:'All', previousCategories:'Previous categories', nextCategories:'More categories', previousDishes:'Previous dishes', nextDishes:'More dishes', carousel:'Dish carousel', illustrative:'Illustrative image', noPhoto:'No photograph' });
const html = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const copy = () => translations[state.language];
const localized = (item, esKey, enKey) => state.language === 'en' ? item[enKey] || item[esKey] || '' : item[esKey] || '';
const categoryName = (item) => localized(item, 'es', 'en');
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
    <a class="brand" href="/carta/" aria-label="Boccantina · ${html(copy().menu)}"><img src="/preview/assets/boccantina-logo-transparent.png" alt="Boccantina Cantina de Vinos" width="401" height="98"></a>
    <div class="header-tools"><span class="consult-label">${html(copy().consult)}</span><div class="language-switch" role="group" aria-label="Idioma / Language"><button type="button" data-language="es" aria-label="Español" aria-pressed="${state.language === 'es'}">ES</button><button type="button" data-language="en" aria-label="English" aria-pressed="${state.language === 'en'}">EN</button></div></div>
  </div></header>
  <main class="menu-layout" id="platos" tabindex="-1">
    <aside class="menu-navigation" aria-label="${html(copy().categories)}">
      <div class="menu-navigation__title"><span class="eyebrow">${html(copy().consult)}</span><h1>${html(copy().heading)}</h1><p>${html(copy().intro)}</p></div>
      <label class="search-label" for="menu-search">${html(copy().search)}</label>
      <div class="search-control"><input id="menu-search" name="menu-search" type="search" autocomplete="off" placeholder="${html(copy().searchPlaceholder)}" value="${html(state.query)}"><button type="button" class="clear-search" data-clear-search aria-label="${html(copy().clear)}" ${state.query ? '' : 'hidden'}>×</button></div>
    </aside>
    <div class="category-carousel">
      <nav id="menu-categories" class="category-links" aria-label="${html(copy().categories)}" data-category-links></nav>
      <div class="category-controls" hidden><button type="button" data-category-step="-1" aria-controls="menu-categories" aria-label="${html(copy().previousCategories)}" disabled>‹</button><button type="button" data-category-step="1" aria-controls="menu-categories" aria-label="${html(copy().nextCategories)}">›</button></div>
    </div>
    <section class="menu-content"><div id="menu-results"></div></section>
  </main>
  <dialog class="dish-dialog" aria-label="${html(copy().details)}"><div class="dish-dialog__content" data-dialog-content></div></dialog>`;
  root.querySelector('.dish-dialog').addEventListener('close', () => {
    document.documentElement.classList.remove('dish-open');
    detailTrigger?.isConnected && detailTrigger.focus({ preventScroll:true });
    window.scrollTo({ top:detailScroll, behavior:'instant' });
  });
  renderNavigation(); renderResults();
}

function renderNavigation() {
  const categories = state.catalog.categories;
  const sidebar = root.querySelector('[data-category-links]');
  const left = sidebar.scrollLeft;
  const allVisual = '<span class="category-avatar category-avatar--all" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>';
  sidebar.innerHTML = `<button type="button" data-all-products aria-label="${html(copy().allProducts)}" aria-current="${state.category === ALL_PRODUCTS && !state.query}">${allVisual}<span>${html(copy().allShort)}</span></button>` + categories.map((item) => {
    const visual = categoryImage(item);
    const avatar = `<span class="category-avatar${visual ? '' : ' is-missing'}" aria-hidden="true"><span class="category-avatar__fallback">${html(categoryName(item).slice(0, 1))}</span>${visual ? `<img src="${html(visual.path)}" alt="" width="60" height="60" loading="lazy" decoding="async" draggable="false">` : ''}</span>`;
    return `<button type="button" data-category="${html(item.id)}" aria-label="${html(categoryName(item))}" title="${html(categoryName(item))}" aria-current="${item.id === state.category && !state.query}">${avatar}<span>${html(categoryName(item))}</span></button>`;
  }).join('');
  sidebar.scrollLeft = left;
  updateCategoryControls();
}

function updateCategoryControls() {
  const nav = root.querySelector('[data-category-links]');
  if (!nav) return;
  const frame = nav.parentElement, controls = frame.querySelector('.category-controls');
  const style = getComputedStyle(frame);
  const available = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  controls.hidden = nav.scrollWidth <= available + 2;
  const end = nav.scrollWidth - nav.clientWidth;
  controls.querySelector('[data-category-step="-1"]').disabled = nav.scrollLeft < 2;
  controls.querySelector('[data-category-step="1"]').disabled = nav.scrollLeft >= end - 2;
}

function rememberRails() {
  root.querySelectorAll('[data-dish-rail]').forEach((rail) => railPositions.set(rail.dataset.dishRail, rail.scrollLeft));
}
function updateRail(rail) {
  const controls = rail.closest('.menu-shelf').querySelector('.shelf-controls');
  const end = rail.scrollWidth - rail.clientWidth;
  controls.hidden = end < 2;
  rail.tabIndex = end < 2 ? -1 : 0;
  controls.querySelector('[data-rail-step="-1"]').disabled = rail.scrollLeft < 2;
  controls.querySelector('[data-rail-step="1"]').disabled = rail.scrollLeft >= end - 2;
}
function restoreRails() {
  root.querySelectorAll('[data-dish-rail]').forEach((rail) => {
    rail.scrollLeft = railPositions.get(rail.dataset.dishRail) || 0;
    updateRail(rail);
  });
}
function moveRail(rail, step) {
  const first = rail.querySelector('li');
  if (!first) return;
  const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
  rail.scrollBy({ left:step * (first.getBoundingClientRect().width + gap), behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function focusCategory(selected = root.querySelector('[data-category-links] [aria-current="true"]')) {
  const nav = root.querySelector('[data-category-links]');
  if (!selected) return;
  selected.focus({ preventScroll:true });
  const item = selected.getBoundingClientRect(), frame = nav.getBoundingClientRect();
  if (item.left < frame.left + 8) nav.scrollLeft += item.left - frame.left - 8;
  else if (item.right > frame.right - 8) nav.scrollLeft += item.right - frame.right + 8;
}

function dishCard(item) {
  const own = realPhoto(item);
  return `<li><article class="dish-card${item.soldOut ? ' dish-card--unavailable' : ''}">
    <div class="dish-card__media${item.image ? '' : ' is-missing'}"><span class="dish-card__missing">${html(copy().noPhoto)}</span>${item.image ? `<img src="${html(item.image)}" alt="" width="400" height="300" loading="lazy" decoding="async" draggable="false">${own ? '' : `<span class="dish-card__image-note">${html(copy().illustrative)}</span>`}` : ''}</div>
    <div class="dish-card__body"><h3><button class="dish-card__link" type="button" data-detail="${html(item.id)}" aria-haspopup="dialog" aria-label="${html(productName(item))} · ${html(copy().details)}">${html(productName(item))}</button></h3>
      <p class="dish-card__description">${html(productDescription(item) || copy().noDescription)}</p>
      ${item.soldOut ? `<span class="dish-card__status">${html(copy().unavailable)}</span>` : ''}
      <strong class="dish-card__price">${html(price(item.price))}</strong><span class="dish-card__details" aria-hidden="true">${html(copy().details)} ↗</span>
    </div>
  </article></li>`;
}

function renderResults() {
  const container = root.querySelector('#menu-results');
  if (state.query) {
    const items = itemsForView();
    container.innerHTML = `<header class="mobile-results-heading"><h2 id="category-title" tabindex="-1">${html(copy().results)}</h2><p role="status">${items.length} ${html(copy().dishes)}</p></header><div class="dish-list">${items.length ? items.map((item) => dishRow(item, true)).join('') : `<p class="menu-empty">${html(copy().noResults)}</p>`}</div>`;
    return;
  }
  const categories = state.catalog.categories.filter((category) => state.category === ALL_PRODUCTS || category.id === state.category);
  container.innerHTML = categories.length ? categories.map((category) => {
    const items = state.catalog.products.filter((item) => item.category === category.id);
    const name = categoryName(category), titleId = `shelf-title-${category.id}`, railId = `shelf-${category.id}`;
    return `<section class="menu-shelf" aria-labelledby="${html(titleId)}">
      <header class="shelf-heading"><div><h2 id="${html(titleId)}">${html(name)}</h2><p>${items.length} ${html(items.length === 1 ? copy().dish : copy().dishes)}</p></div>
        <div class="shelf-controls"><button type="button" data-rail-step="-1" aria-controls="${html(railId)}" aria-label="${html(copy().previousDishes)} · ${html(name)}" disabled>‹</button><button type="button" data-rail-step="1" aria-controls="${html(railId)}" aria-label="${html(copy().nextDishes)} · ${html(name)}">›</button></div>
      </header>
      <ul id="${html(railId)}" class="dish-carousel" data-dish-rail="${html(category.id)}" aria-label="${html(copy().carousel)} · ${html(name)}" tabindex="0">${items.map(dishCard).join('')}</ul>
    </section>`;
  }).join('') : `<p class="menu-empty">${html(copy().noCategory)}</p>`;
  restoreRails();
}

function itemsForView() {
  if (!state.query) return state.catalog.products.filter((item) => state.category === ALL_PRODUCTS || item.category === state.category);
  const needle = normalize(state.query.trim());
  return state.catalog.products.filter((item) => normalize(`${item.nameEs} ${item.nameEn} ${item.descEs} ${item.descEn}`).includes(needle));
}

function dishRow(item, showCategory = false) {
  const photo = realPhoto(item) ? `<img class="dish-row__photo" src="${html(item.image)}" alt="" width="88" height="88" loading="lazy" decoding="async">` : '';
  const description = productDescription(item);
  return `<article class="dish-row${item.soldOut ? ' dish-row--unavailable' : ''}">
    ${photo}<div class="dish-row__main">${showCategory ? `<span class="dish-row__category">${html(categoryName(categoryById(item.category)))}</span>` : ''}<div class="dish-row__heading"><h3>${html(productName(item))}</h3><span class="dish-row__price">${html(price(item.price))}</span></div>
    ${description ? `<p class="dish-row__description">${html(description)}</p>` : ''}
    <div class="dish-row__footer">${item.soldOut ? `<span class="dish-row__status">${html(copy().unavailable)}</span>` : '<span></span>'}<button type="button" class="details-button" data-detail="${html(item.id)}">${html(copy().details)} <span aria-hidden="true">↗</span></button></div></div>
  </article>`;
}

function openDetail(id, trigger) {
  const item = state.catalog.products.find((product) => product.id === id);
  if (!item) return;
  detailTrigger = trigger;
  detailScroll = window.scrollY;
  const dialog = root.querySelector('.dish-dialog');
  dialog.querySelector('[data-dialog-content]').innerHTML = `<div class="dish-dialog__header"><span class="eyebrow">BOCCANTINA · ${html(copy().menu)}</span><button type="button" class="dialog-close" data-dialog-close aria-label="${html(copy().close)}">×</button></div>
    ${realPhoto(item) ? `<figure class="dish-dialog__visual"><img src="${html(item.image)}" alt="${html(productName(item))}" width="640" height="430" decoding="async"><figcaption>${html(copy().ownPhoto)}</figcaption></figure>` : ''}
    <div class="dish-dialog__body"><h2>${html(productName(item))}</h2><strong>${html(price(item.price))}</strong><p>${html(productDescription(item) || copy().noDescription)}</p>${item.soldOut ? `<p class="dish-dialog__status">${html(copy().unavailable)}</p>` : ''}</div>`;
  document.documentElement.classList.add('dish-open');
  dialog.showModal();
  dialog.querySelector('[data-dialog-close]').focus({ preventScroll:true });
}

root.addEventListener('click', (event) => {
  const language = event.target.closest('[data-language]');
  if (language) {
    if (state.language === language.dataset.language) return;
    const scroll = window.scrollY;
    rememberRails();
    const navigationScroll = root.querySelector('[data-category-links]').scrollLeft;
    state.language = language.dataset.language;
    try { localStorage.setItem('boccantina-v2-menu-language', state.language); } catch {}
    document.documentElement.lang = state.language;
    document.title = `${copy().menu} · Boccantina`;
    shell(); root.querySelector('[data-category-links]').scrollLeft = navigationScroll; updateCategoryControls(); root.querySelector(`[data-language="${state.language}"]`).focus({ preventScroll:true }); window.scrollTo({ top:scroll, behavior:'instant' }); return;
  }
  const categoryStep = event.target.closest('[data-category-step]');
  if (categoryStep) {
    const nav = root.querySelector('[data-category-links]');
    nav.scrollBy({ left:Number(categoryStep.dataset.categoryStep) * Math.max(92, nav.clientWidth - 92), behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return;
  }
  const category = event.target.closest('[data-category]');
  if (category || event.target.closest('[data-all-products]')) {
    rememberRails(); state.category = category ? category.dataset.category : ALL_PRODUCTS;
    state.query = ''; root.querySelector('#menu-search').value = ''; root.querySelector('[data-clear-search]').hidden = true;
    renderNavigation(); renderResults();
    focusCategory();
    return;
  }
  const step = event.target.closest('[data-rail-step]');
  if (step) { moveRail(step.closest('.menu-shelf').querySelector('[data-dish-rail]'), Number(step.dataset.railStep)); return; }
  const clear = event.target.closest('[data-clear-search]');
  if (clear) { state.query = ''; root.querySelector('#menu-search').value = ''; root.querySelector('[data-clear-search]').hidden = true; renderNavigation(); renderResults(); root.querySelector('#menu-search').focus(); return; }
  const detail = event.target.closest('[data-detail]');
  if (detail) { openDetail(detail.dataset.detail, detail); return; }
  if (event.target.closest('[data-dialog-close]')) root.querySelector('.dish-dialog').close();
});
root.addEventListener('input', (event) => {
  if (event.target.id !== 'menu-search') return;
  rememberRails();
  state.query = event.target.value.trim();
  root.querySelector('[data-clear-search]').hidden = !state.query;
  renderNavigation(); renderResults();
});
root.addEventListener('scroll', (event) => {
  if (event.target.matches?.('[data-category-links]')) updateCategoryControls();
  if (event.target.matches?.('[data-dish-rail]')) {
    railPositions.set(event.target.dataset.dishRail, event.target.scrollLeft);
    updateRail(event.target);
  }
}, true);
root.addEventListener('keydown', (event) => {
  const category = event.target.closest('[data-category-links] button');
  if (category && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();
    const buttons = [...category.parentElement.querySelectorAll('button')], index = buttons.indexOf(category);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1);
    focusCategory(buttons[Math.max(0, Math.min(buttons.length - 1, next))]);
    return;
  }
  if (!event.target.matches('[data-dish-rail]') || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault(); moveRail(event.target, event.key === 'ArrowRight' ? 1 : -1);
});
root.addEventListener('error', (event) => {
  const media = event.target.closest?.('.category-avatar, .dish-card__media');
  if (media) { media.classList.add('is-missing'); event.target.hidden = true; }
}, true);
root.addEventListener('click', (event) => {
  const dialog = root.querySelector('.dish-dialog');
  if (event.target === dialog) dialog.close();
});

async function start() {
  document.documentElement.lang = state.language;
  document.title = `${copy().menu} · Boccantina`;
  try {
    const response = await fetch('/api/v2/catalog', { cache:'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la carta.');
    state.catalog = await response.json();
    state.category = ALL_PRODUCTS;
    shell();
  } catch (error) {
    root.innerHTML = `<main class="load-error" role="alert"><h1>La carta no está disponible</h1><p>${html(error.message)}</p><button type="button" data-retry>Reintentar</button></main>`;
    root.querySelector('[data-retry]').addEventListener('click', () => location.reload());
  }
}
start();
window.addEventListener('resize', () => {
  updateCategoryControls();
  root.querySelectorAll('[data-dish-rail]').forEach(updateRail);
});
