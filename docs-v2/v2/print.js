import { renderPrintBody } from './print-layout.js';

const root = document.getElementById('print-root');
const message = document.getElementById('print-message');
const button = document.getElementById('print-button');
const base = document.querySelector('meta[name="boccantina-demo-base"]')?.content || '';
const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
document.documentElement.lang = language;
button.addEventListener('click', () => window.print());

try {
  let catalog;
  if (base) {
    if (typeof window.BoccV2DemoCatalog !== 'function') throw new Error('No se cargó el catálogo de demostración.');
    catalog = window.BoccV2DemoCatalog();
  } else {
    const response = await fetch('/api/v2/admin/catalog', { credentials:'same-origin', cache:'no-store' });
    if (!response.ok) throw new Error(response.status === 401 ? 'Inicia sesión en la administración para consultar el menú impreso.' : 'No se pudo leer la carta actual.');
    catalog = await response.json();
  }
  root.innerHTML = renderPrintBody(catalog, language, `${base}/preview/assets/boccantina-logo-transparent.png`);
  message.textContent = base ? 'Demostración pública: impresión de los datos guardados solo en este navegador.' : 'Vista previa A4. Para archivar un PDF, utiliza la administración.';
  button.disabled = false;
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  message.textContent = error.message;
  message.setAttribute('role', 'alert');
  document.documentElement.dataset.ready = 'error';
}
