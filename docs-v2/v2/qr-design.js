// One self-contained artwork for the preview, SVG download and A6 print.
const asset = (path) => new URL(path, import.meta.url).href;
const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'
})[character]);

async function resource(path) {
  const response = await fetch(asset(path), { credentials:'same-origin', cache:'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar el diseño del QR. Inténtalo de nuevo.');
  return response;
}
function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo preparar el archivo del QR.'));
    reader.readAsDataURL(blob);
  });
}

export async function createQrArtwork(url) {
  const destination = new URL(url);
  if (!['http:', 'https:'].includes(destination.protocol)) throw new Error('El enlace de la carta no es válido.');
  const [qrSource, logo, sans, serif] = await Promise.all([
    resource('../api/v2/admin/qr.svg').then((response) => response.text()),
    resource('../preview/assets/boccantina-logo-transparent.png').then((response) => response.blob()).then(dataUrl),
    resource('../preview/fonts/inter-latin-variable.woff2').then((response) => response.blob()).then(dataUrl),
    resource('./assets/fraunces-latin.woff2').then((response) => response.blob()).then(dataUrl)
  ]);
  const document = new DOMParser().parseFromString(qrSource, 'image/svg+xml');
  const qr = document.documentElement;
  const size = Number(qr.getAttribute('viewBox')?.trim().split(/\s+/)[2]);
  const paths = [...qr.querySelectorAll('path')];
  if (qr.localName !== 'svg' || document.querySelector('parsererror') || !Number.isFinite(size) || size < 21 || !paths.length) {
    throw new Error('El código QR no se pudo preparar. Inténtalo de nuevo.');
  }
  // Keep only the generated vector geometry. Add two modules to the existing
  // two-module margin, preserving a four-module white quiet zone on every side.
  const geometry = paths.map((path) => `<path ${['d','fill','stroke','stroke-width']
    .filter((name) => path.hasAttribute(name))
    .map((name) => `${name}="${xml(path.getAttribute(name))}"`).join(' ')}/>`).join('');
  const address = `${destination.host}${destination.pathname}${destination.search}${destination.hash}`;
  const footer = address.length <= 72 ? [address] : [address.slice(0, 72), address.slice(72, 141) + (address.length > 141 ? '…' : '')];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="105mm" height="148mm" viewBox="0 0 420 592" role="img" aria-labelledby="title description">
  <title id="title">Boccantina · La carta</title>
  <desc id="description">Escanea el código con la cámara de tu teléfono para consultar la carta en español e inglés. Destino: ${xml(url)}</desc>
  <defs><style>
    @font-face{font-family:QrSans;src:url('${sans}') format('woff2');font-weight:100 900}
    @font-face{font-family:QrSerif;src:url('${serif}') format('woff2');font-weight:100 900}
    text{font-family:QrSans,Arial,sans-serif}
    .editorial{font-family:QrSerif,Georgia,serif}
  </style></defs>
  <rect width="420" height="592" fill="#171716"/>
  <image href="${logo}" x="80" y="40" width="260" height="64" preserveAspectRatio="xMidYMid meet"/>
  <path d="M0 128H420" stroke="#c5a467" stroke-width="4"/>
  <text x="30" y="166" fill="#c5a467" font-size="8.5" letter-spacing="1.5">COMER · CONVERSAR · DISFRUTAR</text>
  <text x="28" y="238" fill="#d5b471" class="editorial" font-size="64" font-weight="550">La carta.</text>
  <text x="30" y="274" fill="#f5efe4" class="editorial" font-size="24">El siguiente buen momento.</text>
  <path d="M30 299H390" stroke="#a88c59" stroke-width="1"/>
  <rect x="30" y="324" width="216" height="216" fill="#fff" stroke="#c5a467" stroke-width="3"/>
  <svg x="36" y="330" width="204" height="204" viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges">${geometry}</svg>
  <g fill="#d5b471" font-size="12" font-weight="600">
    <text x="265" y="365">ABRE TU</text><text x="265" y="383">CÁMARA</text>
  </g>
  <g fill="#f5efe4" font-size="12">
    <text x="265" y="425">Escanea y elige</text><text x="265" y="444">a tu gusto.</text>
  </g>
  <text x="265" y="497" fill="#d5b471" font-size="10">ES / EN</text>
  <text x="265" y="514" fill="#c5bbac" font-size="10">Sin aplicaciones.</text>
  <a href="${xml(url)}">${footer.map((line, index) => `<text x="30" y="${footer.length === 1 ? 571 : 564 + index * 11}" fill="#c5b18b" font-size="8">${xml(line)}</text>`).join('')}</a>
</svg>`;
  return { svg, image:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, url };
}

export function downloadQrArtwork(artwork) {
  const url = URL.createObjectURL(new Blob([artwork.svg], { type:'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'boccantina-cartel-qr-A6.svg';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function printQrArtwork(artwork) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Permite abrir la vista de impresión en tu navegador e inténtalo de nuevo.');
  const doc = popup.document;
  doc.title = 'Boccantina · Cartel QR A6';
  doc.documentElement.lang = 'es';
  const viewport = doc.createElement('meta');
  viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1';
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = asset('./qr-print.css');
  doc.head.append(viewport, stylesheet);
  const toolbar = doc.createElement('header');
  const instructions = doc.createElement('p');
  instructions.textContent = 'Cartel A6 · 105 × 148 mm. Imprime al 100 %, sin encabezados ni pies de página.';
  const button = doc.createElement('button');
  button.type = 'button'; button.textContent = 'Preparando impresión…'; button.disabled = true;
  button.addEventListener('click', () => popup.print());
  toolbar.append(instructions, button);
  const main = doc.createElement('main');
  const poster = doc.createElement('img');
  poster.alt = 'Boccantina · La carta. Cartel con código QR.';
  poster.width = 420; poster.height = 592;
  main.append(poster); doc.body.append(toolbar, main);
  const cssReady = new Promise((resolve, reject) => {
    stylesheet.addEventListener('load', resolve, { once:true });
    stylesheet.addEventListener('error', reject, { once:true });
  });
  poster.src = artwork.image;
  Promise.all([poster.decode(), cssReady]).then(() => {
    button.disabled = false; button.textContent = 'Imprimir / guardar PDF';
    button.focus({ preventScroll:true });
  }).catch(() => { instructions.textContent = 'No se pudo preparar la impresión. Cierra esta pestaña e inténtalo de nuevo.'; });
  popup.focus();
}
