import { renderPrintBody, paginatePrint, fitPrintPreview } from './print-layout.js';

const root = document.getElementById('print-root');
const message = document.getElementById('print-message');
const button = document.getElementById('print-button');
const base = document.querySelector('meta[name="boccantina-demo-base"]')?.content || '';
const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
const query = new URLSearchParams(location.search);
const proposal = ['actual','sobria','editorial'].includes(query.get('proposal')) ? query.get('proposal') : 'actual';
const size = ['A4','A3','A2'].includes(query.get('size')) ? query.get('size') : 'A4';
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
  root.innerHTML = renderPrintBody(catalog, language, `${base}/preview/assets/boccantina-logo-transparent.png`, {proposal,size});
  if(size!=='A4'){
    const factor={A3:Math.SQRT2,A2:2}[size],paper={A3:'297mm 420mm',A2:'420mm 594mm'}[size],style=document.createElement('style');
    style.textContent=`@page{size:${paper};margin:0}@media print{body.print-document{zoom:${factor}}.print-page{width:210mm;height:297mm}}`;
    document.head.append(style);
  }
  await paginatePrint(root.querySelector('.print-menu'));
  fitPrintPreview(root.querySelector('.print-menu'));
  message.textContent = base ? `Demostración pública · ${size} · propuesta ${proposal}. Los datos se guardan solo en este navegador.` : `Vista previa proporcional ${size}. Para archivar un PDF, utiliza la administración.`;
  button.disabled = false;
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  message.textContent = error.message;
  message.setAttribute('role', 'alert');
  document.documentElement.dataset.ready = 'error';
}
