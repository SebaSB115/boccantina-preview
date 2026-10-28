// Shared paper composition. Both PDF engines use these measured pages.
import {normalizePrintDesign} from './shared-print/design.js';
export const PRINT_DESIGN_VERSION = 'boccantina-gold-2';
const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const ordered = (items, key) => [...items].sort((a, b) => a.position - b.position || String(a[key] || '').localeCompare(String(b[key] || '')));
const price = (value, en) => value == null ? (en ? 'Ask for price' : 'Consultar precio') : `₡${new Intl.NumberFormat('es-CR').format(value)}`;

export function printProjection(catalog) {
  return ordered(catalog.categories.filter(category => category.visible !== false), 'es').map(category => ({
    id:category.id, es:category.es, en:category.en,
    products:ordered(catalog.products.filter(product => product.visible !== false && product.category === category.id), 'nameEs')
      .map(({ id, nameEs, nameEn, descEs, descEn, price:amount }) => ({ id, nameEs, nameEn, descEs, descEn, price:amount }))
  })).filter(category => category.products.length);
}

export function paperArtwork(centerRule=true) {
  const corner = `<g fill="none" stroke="#b99b5d" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 76V2H76M7 68V7H68M2 44C15 44 26 35 26 22S13 8 13 18C13 27 34 27 43 15S61 10 56 20C52 29 41 24 47 18M7 55C17 53 25 45 28 35M35 28C45 25 53 17 55 7"/>
    <path d="M18 39C4 37 10 25 16 28S20 36 18 39ZM39 18C37 4 25 10 28 16S36 20 39 18ZM32 29C27 20 35 15 38 22S35 28 32 29ZM29 32C20 27 15 35 22 38S28 35 29 32Z"/>
    <path d="M48 7C56 2 65 4 69 8M7 48C2 56 4 65 8 69"/><circle cx="12" cy="12" r="2" fill="#b99b5d"/>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123" aria-hidden="true">
    <rect width="794" height="1123" fill="#111210" opacity=".62"/>
    <g fill="none" stroke="#b99b5d"><path d="M100 29H694M765 100V1023M694 1094H100M29 1023V100" stroke-width="1.2"/><path d="M96 34H698M760 96V1027M698 1089H96M34 1027V96" stroke-width=".5"/>
    ${centerRule?'<path d="M397 245V1030" stroke-width=".55" opacity=".6"/>':''}</g>
    <g transform="translate(27 27)">${corner}</g><g transform="translate(767 27) scale(-1 1)">${corner}</g><g transform="translate(27 1096) scale(1 -1)">${corner}</g><g transform="translate(767 1096) scale(-1 -1)">${corner}</g>
    <g fill="none" stroke="#b99b5d" stroke-width="1.1"><path d="M306 65H345C355 65 357 52 349 52S343 63 355 63C374 63 378 50 397 50S420 63 439 63C451 63 453 52 445 52S439 65 449 65H488M329 73H372L397 64 422 73H465"/><path d="M397 39 401 44 397 49 393 44Z" fill="#b99b5d"/>
    <path d="M235 215H371L397 222 423 215H559M377 213 397 205 417 213"/><path d="M393 213 397 209 401 213 397 217Z" fill="#b99b5d"/>
    <path d="M170 1050H355M439 1050H624M365 1050C378 1062 387 1059 397 1050C407 1059 416 1062 429 1050M391 1050 397 1044 403 1050 397 1056Z"/>
    </g>
  </svg>`;
}

function productMarkup(item, en) {
  const name = en ? item.nameEn || item.nameEs : item.nameEs;
  const description = en ? item.descEn || item.descEs : item.descEs;
  return `<article class="print-product" data-product-id="${escapeHtml(item.id)}"><div class="product-line"><h3>${escapeHtml(name)}</h3><strong>${escapeHtml(price(item.price, en))}</strong></div>${description ? `<p>${escapeHtml(description)}</p>` : ''}</article>`;
}

export function renderPrintBody(catalog, language = 'es', logo = new URL('../preview/assets/boccantina-logo-transparent.png', import.meta.url).href, edition = {}, texture = new URL('./assets/print-marble-black.png', import.meta.url).href) {
  if (!['es', 'en'].includes(language)) throw new Error('Idioma de impresión no válido.');
  const en = language === 'en', groups = printProjection(catalog);
  const design=edition.design?normalizePrintDesign(edition.design,'boccantina'):null;
  const style=design?` style="--print-columns:${design.columns};--print-margin:${design.margin}mm;--print-gap:${design.gutter}mm;--print-logo:${design.logoWidth}mm;--print-title:${design.titleSize}pt;--print-body:${design.bodySize}pt;--print-item-gap:${design.itemSpacing}mm;--print-logo-align:${design.logoAlign==='left'?'flex-start':'center'}"`:'';
  const date = edition.createdAt ? new Date(edition.createdAt).toLocaleDateString(en ? 'en-US' : 'es-CR') : (en ? 'Preview' : 'Vista previa');
  return `<main class="print-menu" data-language="${language}" data-ornament="${design?.ornament===false?'false':'true'}"${style} aria-label="${en ? 'Printed menu' : 'Menú para imprimir'}">
    <template data-print-source>${groups.map(group => `<section data-group="${escapeHtml(group.id)}"><h2>${escapeHtml(en ? group.en || group.es : group.es)}</h2>${group.products.map(item => productMarkup(item, en)).join('')}</section>`).join('')}</template>
    <template data-print-paper><div class="print-page"><section class="print-sheet">
      <div class="paper-art"><img src="${escapeHtml(texture)}" alt="" class="paper-texture">${paperArtwork(design?.columns!==1)}</div>
      <header class="print-masthead"><img src="${escapeHtml(logo)}" alt="Boccantina · Cantina de vinos" width="401" height="98"><h1>${en ? 'MENU' : 'MENÚ'}</h1></header>
      <div class="print-columns"><div class="print-column"></div><div class="print-column"></div></div>
      <footer class="print-footer"><span>${en ? 'Prices in Costa Rican colones' : 'Precios en colones costarricenses'}</span><span data-page-number></span></footer>
      <p class="print-edition">${escapeHtml(date)} · ${en ? 'Revision' : 'Revisión'} ${Number(catalog.revision) || 1}</p>
    </section></div></template>
  </main>`;
}

// Measure at A4 size regardless of the preview viewport. Long descriptions
// continue on the next column instead of being clipped or dropped.
export async function paginatePrint(menu) {
  await Promise.all([document.fonts.load('16px PrintSerif'), document.fonts.load('16px PrintSans')]);
  const source = menu.querySelector('[data-print-source]'), paper = menu.querySelector('[data-print-paper]');
  menu.querySelectorAll('.print-page').forEach(page => page.remove());
  const groups = [...source.content.children], en = menu.dataset.language === 'en';
  let column, columns, index = 1;
  function nextColumn() {
    if (!columns || index === columns.length - 1) {
      const page = paper.content.firstElementChild.cloneNode(true);
      menu.append(page); columns = [...page.querySelectorAll('.print-column')].filter(c=>getComputedStyle(c).display!=='none'); index = 0;
    } else index++;
    column = columns[index];
  }
  const fits = () => column.scrollHeight <= column.clientHeight + 1;
  function heading(group, continuation = false) {
    const head = document.createElement('header'); head.className = 'chapter-head';
    head.append(group.querySelector('h2').cloneNode(true));
    if (continuation) { const note = document.createElement('span'); note.textContent = en ? 'continued' : 'continuación'; head.append(note); }
    column.append(head); return head;
  }
  nextColumn();
  for (const group of groups) {
    let head = heading(group), first = true;
    for (const original of group.querySelectorAll('.print-product')) {
      let item = original.cloneNode(true);
      column.append(item);
      if (!fits() && (head.previousElementSibling || !first)) {
        item.remove(); if (first) head.remove();
        nextColumn(); head = heading(group, !first); column.append(item);
      }
      while (!fits()) {
        const paragraph = item.querySelector('p');
        if (!paragraph) throw new Error(en ? 'A product name is too long for the printed page.' : 'Un nombre de producto es demasiado largo para la página impresa.');
        const words = paragraph.textContent.match(/\S+\s*/g) || [];
        let low = 0, high = words.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          paragraph.textContent = words.slice(0, middle).join('');
          if (fits()) low = middle; else high = middle - 1;
        }
        if (!low) throw new Error(en ? 'This product cannot fit on the printed page.' : 'Este producto no cabe en la página impresa.');
        paragraph.textContent = words.slice(0, low).join('');
        const continuation = original.cloneNode(true);
        continuation.querySelector('strong')?.remove();
        continuation.querySelector('h3').textContent += en ? ' · continued' : ' · continuación';
        continuation.querySelector('p').textContent = words.slice(low).join('');
        nextColumn(); heading(group, true); column.append(continuation); item = continuation;
      }
      first = false;
    }
  }
  if (!groups.length) {
    const empty = document.createElement('p'); empty.className = 'print-empty';
    empty.textContent = en ? 'There are no visible dishes in this menu.' : 'No hay platos visibles en esta carta.'; column.append(empty);
  }
  const pages = [...menu.querySelectorAll('.print-sheet')];
  // Balance the final sheet at category boundaries, preserving reading order.
  const [left, right] = pages.at(-1).querySelectorAll('.print-column');
  const used = col => col.lastElementChild ? col.lastElementChild.getBoundingClientRect().bottom - col.getBoundingClientRect().top : 0;
  for (let attempt = 0; right && attempt < groups.length; attempt++) {
    const lastHead = [...left.querySelectorAll('.chapter-head')].at(-1);
    if (!lastHead?.previousElementSibling || used(left) <= used(right)) break;
    const difference = Math.abs(used(left) - used(right));
    const moving = []; let sibling = lastHead;
    while (sibling) { moving.push(sibling); sibling = sibling.nextElementSibling; }
    const fragment = document.createDocumentFragment(); fragment.append(...moving); right.prepend(fragment);
    if (right.scrollHeight > right.clientHeight + 1 || Math.abs(used(left) - used(right)) >= difference) { left.append(...moving); break; }
  }
  pages.forEach((page, i) => { page.querySelector('[data-page-number]').textContent = `${String(i + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`; });
  await Promise.all([...menu.querySelectorAll('img')].map(image => image.decode()));
  return pages;
}

export function fitPrintPreview(menu) {
  const update = () => {
    const paper = menu.querySelector('.print-sheet'); if (!paper) return;
    menu.style.setProperty('--paper-scale', Math.min(1, menu.clientWidth / paper.offsetWidth));
  };
  const observer = new ResizeObserver(update); observer.observe(menu); update();
  return () => observer.disconnect();
}
