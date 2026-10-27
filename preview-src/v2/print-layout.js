// Composición compartida por la vista previa del navegador y el PDF del servidor.
const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const ordered = (items, key) => [...items].sort((a, b) => a.position - b.position || String(a[key] || '').localeCompare(String(b[key] || '')));
const price = (value, en) => value == null ? (en ? 'Ask for price' : 'Consultar precio') : `₡${new Intl.NumberFormat('es-CR').format(value)}`;

export function printProjection(catalog) {
  const categories = ordered(catalog.categories.filter((category) => category.visible !== false), 'es');
  return categories.map((category) => ({
    id:category.id, es:category.es, en:category.en,
    products:ordered(catalog.products.filter((product) => product.visible !== false && product.category === category.id), 'nameEs')
      .map(({ id, nameEs, nameEn, descEs, descEn, price:amount }) => ({ id, nameEs, nameEn, descEs, descEn, price:amount }))
  })).filter((category) => category.products.length);
}

export function renderPrintBody(catalog, language = 'es', logo = '/preview/assets/boccantina-logo-transparent.png', edition = {}) {
  if (!['es', 'en'].includes(language)) throw new Error('Idioma de impresión no válido.');
  const en = language === 'en';
  const groups = printProjection(catalog);
  const name = (item) => escapeHtml(en ? item.nameEn || item.nameEs : item.nameEs);
  const description = (item) => escapeHtml(en ? item.descEn || item.descEs : item.descEs);
  const date = edition.createdAt ? new Date(edition.createdAt).toLocaleDateString(en ? 'en-US' : 'es-CR') : (en ? 'Preview' : 'Vista previa');
  return `<main class="print-menu" aria-label="${en ? 'Printed menu' : 'Menú para imprimir'}">
    <section class="print-cover" aria-label="${en ? 'Cover' : 'Portada'}">
      <div class="cover-masthead"><img src="${escapeHtml(logo)}" alt="Boccantina" width="401" height="98"></div>
      <div class="cover-title"><p class="overline">BOCCANTINA · CANTINA DE VINOS</p><h1>${en ? 'At the table' : 'A la mesa'}</h1><p>${en ? 'Food & wine · Printed menu' : 'Cocina y vinos · Carta para el local'}</p></div>
      <div class="cover-index"><p class="overline">${en ? 'THE MENU' : 'LA CARTA'}</p><ol>${groups.map((group, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(en ? group.en || group.es : group.es)}</li>`).join('')}</ol></div>
      <footer class="cover-footer"><span>${en ? 'Prices in Costa Rican colones' : 'Precios en colones costarricenses'}</span><span>${escapeHtml(date)} · ${en ? 'Revision' : 'Revisión'} ${Number(catalog.revision) || 1}</span></footer>
    </section>
    ${groups.map((group, index) => `<section class="print-chapter" aria-label="${escapeHtml(en ? group.en || group.es : group.es)}"><header class="chapter-head"><p class="overline">BOCCANTINA <span>${String(index + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}</span></p><h2>${escapeHtml(en ? group.en || group.es : group.es)}</h2></header><div class="chapter-products">${group.products.map((item) => `<article class="print-product"><div class="product-line"><h3>${name(item)}</h3><strong>${escapeHtml(price(item.price, en))}</strong></div>${description(item) ? `<p>${description(item)}</p>` : ''}</article>`).join('')}</div><footer class="chapter-foot"><span>BOCCANTINA · CANTINA DE VINOS</span><span>${en ? 'Prices in colones' : 'Precios en colones'}</span></footer></section>`).join('')}
  </main>`;
}
