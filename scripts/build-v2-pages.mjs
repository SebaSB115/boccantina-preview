import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { defaultCatalog } from './v2-data.mjs';
import './sync-print-design.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(repo, '..', '..');
const isabella = resolve(workspace, 'version-2-simple', 'isabellas-menu-preview-a');
const output = resolve(repo, 'docs-v2');
const originalSite = resolve(repo, 'snapshot/boccantina.com');
const base = '/boccantina-preview';
const publicMenu = `https://sebasb115.github.io${base}/carta/`;
if (output !== join(repo, 'docs-v2') || !output.startsWith(`${repo}${sep}`)) throw new Error('La ruta de salida no es segura.');
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });

async function write(relative, contents) {
  const destination = resolve(output, relative);
  if (!destination.startsWith(`${output}${sep}`)) throw new Error('Archivo fuera de la salida V2.');
  await mkdir(dirname(destination), { recursive:true });
  await writeFile(destination, contents);
}
async function copy(source, relative) {
  const file = await readFile(source);
  await write(relative, file);
}
const rewriteRoutes = (source) => source.replace(/(?<=["'(=])\/(?=(?:v2|preview|admin|carta|imprimir|api|wp-content)\/)/g, `${base}/`);
const injectDemo = (html, script) => {
  const before = script==='admin.js'?`<script src="${base}/v2/${script}" type="module"></script>`:`<script src="${base}/v2/${script}" defer></script>`;
  return html.replace(before, `<meta name="boccantina-demo-base" content="${base}">\n  <script src="${base}/v2/seed.js" defer></script>\n  <script src="${base}/v2/demo-api.js" defer></script>\n  ${before}`);
};
await cp(resolve(repo, 'preview-src/v2'), resolve(output, 'v2'), { recursive:true });
for (const name of ['admin.html','carta.html','login.html','print.html']) await rm(resolve(output, 'v2', name));
for (const name of ['admin.js','admin.css','carta.js','carta.css','login.js','login.html','admin.html','carta.html','print.html']) {
  const path = resolve(repo, 'preview-src/v2', name);
  let source = rewriteRoutes(await readFile(path, 'utf8'));
  if (name === 'login.html') {
    source = injectDemo(source, 'login.js')
      .replace('>ACCESO PRIVADO</h1>', '>ACCESO DE DEMOSTRACIÓN</h1>')
      .replace('class="entry-button" type="submit"', 'class="entry-button" type="submit" disabled')
      .replace('Versión 2 simple · Vista previa local · No producción', 'DEMO PÚBLICA · Usuario: demo-boccantina · Clave: vista2026 · No uses contraseñas reales.');
  }
  if (name === 'admin.html') {
    source = injectDemo(source, 'admin.js')
      .replaceAll('V2 SIMPLE · PRUEBA LOCAL', 'V2 SIMPLE · DEMO PÚBLICA · CAMBIOS SOLO EN ESTE NAVEGADOR');
  }
  if (name === 'carta.html') {
    source = injectDemo(source, 'carta.js')
      .replace('<div id="menu-root">', '<p class="public-demo-banner">Demostración pública de V2. Los cambios de esta prueba permanecen solo en tu navegador.</p>\n  <div id="menu-root">');
  }
  if (name === 'print.html') source = source.replace(`<script type="module" src="${base}/v2/print.js"></script>`, `<meta name="boccantina-demo-base" content="${base}"><script src="${base}/v2/seed.js" defer></script><script src="${base}/v2/demo-api.js" defer></script><script type="module" src="${base}/v2/print.js"></script>`);
  if (name === 'admin.js') source = source
    .replace('Todas las personas de esta versión tienen el mismo acceso de administrador.', 'Cuentas de prueba guardadas solo en este navegador.')
    .replace('href="/boccantina-preview/api/v2/admin/qr.svg?download=1"', 'href="/boccantina-preview/api/v2/admin/qr.svg" download="boccantina-carta-qr.svg"');
  if (name === 'carta.css') source += '\n.public-demo-banner{margin:0;padding:8px 16px;border-bottom:1px solid var(--line);background:#211e23;color:var(--muted);font-size:.78rem;text-align:center}\n';
  const destination = name.endsWith('.html') ? name === 'login.html' ? 'admin/login/index.html'
    : name === 'admin.html' ? 'admin/index.html' : name === 'print.html' ? 'imprimir/index.html' : 'carta/index.html' : `v2/${name}`;
  await write(destination, source);
}

const seed = defaultCatalog();
seed.updatedAt = null;
for (const item of [...seed.categories, ...seed.products]) {
  if (item.image?.startsWith('/')) item.image = `${base}${item.image}`;
}
await write('v2/seed.js', `window.BoccV2DemoSeed = ${JSON.stringify(seed).replace(/</g, '\\u003c')};\n`);
await copy(resolve(originalSite, 'preview/admin-entry.css'), 'preview/admin-entry.css');
await copy(resolve(originalSite, 'preview/assets/boccantina-logo-transparent.png'), 'preview/assets/boccantina-logo-transparent.png');
for (const name of ['inter-latin-variable.woff2','urbanist-latin-variable.woff2']) {
  await copy(resolve(originalSite, 'preview/fonts', name), `preview/fonts/${name}`);
}
const originalPaths = [...new Set([...seed.categories, ...seed.products].map((item) => item.image)
  .filter((path) => path?.startsWith(`${base}/wp-content/uploads/`))
  .map((path) => path.slice(base.length)))];
originalPaths.push('/wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-1.webp');
for (const path of new Set(originalPaths)) {
  const source = resolve(originalSite, `.${path}`);
  if (!source.startsWith(`${originalSite}${sep}`) || !(await stat(source)).isFile() || !['.png','.jpg','.jpeg','.webp'].includes(extname(source).toLowerCase())) throw new Error(`Imagen no válida: ${path}`);
  await copy(source, path.slice(1));
}
await write('api/v2/admin/qr.svg', await QRCode.toString(publicMenu, {
  type:'svg', errorCorrectionLevel:'H', margin:2, color:{ dark:'#171516', light:'#ffffff' }
}));

const selectorRoot = resolve(isabella, 'preview-a/central');
let selector = await readFile(resolve(selectorRoot, 'index.html'), 'utf8');
selector = selector
  .replace('href="./isabella/"', 'href="https://sebasb115.github.io/isabellas-menu-preview-a/admin/"')
  .replace('href="./boccantina/"', 'href="../admin/login/"')
  .replace('Entorno de demostración local. Los espacios de ambos restaurantes son independientes y no están conectados a producción.', 'Demostración pública. Cada restaurante mantiene sus datos de prueba en este navegador; no hay conexión con producción.');
await write('central/index.html', selector);
await copy(resolve(isabella, 'preview-a/admin-entry.css'), 'admin-entry.css');
for (const name of ['isabella-logo-transparent.png','boccantina-logo-transparent.png']) {
  await copy(resolve(selectorRoot, 'assets', name), `central/assets/${name}`);
}
await write('index.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=./central/"><title>Boccantina V2 · Demostración</title></head><body><a href="./central/">Abrir selector de restaurantes</a></body></html>\n`);
await write('.nojekyll', '');
console.log(`Demo pública V2 generada en ${output}. Datos privados no incluidos.`);
