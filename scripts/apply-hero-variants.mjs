import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const host = new URL(config.origin).hostname;
const siteRoot = join(repoRoot, 'snapshot', host);
const sourceRoot = join(repoRoot, 'preview-src');
const targetRoot = join(siteRoot, 'preview');
const homeFile = join(siteRoot, 'index.html');
const reservationFile = join(siteRoot, 'reservaciones', 'index.html');
const publicPreviewBase = 'https://sebasb115.github.io/boccantina-preview';

const previewCsp = [
  "default-src 'self' data: blob:",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob: https://cdn-icons-png.flaticon.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://fonts.googleapis.com",
  "worker-src 'self' blob:"
].join('; ');

function isolatePreview(documentHtml) {
  const withoutActiveIntegrations = documentHtml
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '<div class="bocc-preview-disabled-embed" aria-hidden="true"></div>')
    .replace(/<link\b[^>]+href=["'](?:https?:)?\/\/(?:www\.)?googletagmanager\.com[^>]*>/gi, '')
    .replace(/<link\b[^>]+href=["'](?:https?:)?\/\/maxcdn\.bootstrapcdn\.com[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptBlock) => {
      const integrationPattern = /bit[-_ ]?assist|\bSR7\b|revslider|tp-tools|tptools|\b_tpt\b|elementor[-_ ]?frontend|elementorFrontend|wp[-_ ]?emoji|wpEmoji|advanced_iframe|aiShowIframeId|googletagmanager|google_gtag/i;
      return integrationPattern.test(scriptBlock) ? '' : scriptBlock;
    });
  const withoutPreviousCsp = withoutActiveIntegrations.replace(
    /\s*<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    ''
  );
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${previewCsp}">`;

  return withoutPreviousCsp
    .replace(/<head([^>]*)>/i, `<head$1>\n${cspTag}`)
    .replace(/[ \t]+(?=\r?\n)/g, '')
    .replace(/ +\t/g, '\t');
}

await mkdir(targetRoot, { recursive: true });
await Promise.all([
  mkdir(join(siteRoot, 'carta'), { recursive: true }),
  mkdir(join(siteRoot, 'mesa'), { recursive: true }),
  mkdir(join(siteRoot, 'pedido'), { recursive: true }),
  mkdir(join(siteRoot, 'admin', 'pedidos'), { recursive: true }),
  mkdir(join(siteRoot, 'admin', 'cocina'), { recursive: true }),
  mkdir(join(siteRoot, 'admin', 'reservaciones'), { recursive: true }),
  mkdir(join(siteRoot, 'qr-mesas'), { recursive: true }),
  mkdir(join(targetRoot, 'qr'), { recursive: true })
]);
await Promise.all([
  copyFile(join(sourceRoot, 'hero-variants.css'), join(targetRoot, 'hero-variants.css')),
  copyFile(join(sourceRoot, 'hero-variants.js'), join(targetRoot, 'hero-variants.js')),
  copyFile(join(sourceRoot, 'interactive-menu-a.css'), join(targetRoot, 'interactive-menu-a.css')),
  copyFile(join(sourceRoot, 'interactive-menu-a.js'), join(targetRoot, 'interactive-menu-a.js')),
  copyFile(join(sourceRoot, 'menu-extras-config-a.js'), join(targetRoot, 'menu-extras-config-a.js')),
  copyFile(join(sourceRoot, 'menu-admin-a.css'), join(targetRoot, 'menu-admin-a.css')),
  copyFile(join(sourceRoot, 'menu-admin-a.js'), join(targetRoot, 'menu-admin-a.js')),
  copyFile(join(sourceRoot, 'order-system-a.css'), join(targetRoot, 'order-system-a.css')),
  copyFile(join(sourceRoot, 'order-system-a.js'), join(targetRoot, 'order-system-a.js')),
  copyFile(join(sourceRoot, 'static-demo-api-a.js'), join(targetRoot, 'static-demo-api-a.js')),
  copyFile(join(sourceRoot, 'reservation-a.css'), join(targetRoot, 'reservation-a.css')),
  copyFile(join(sourceRoot, 'reservation-a.js'), join(targetRoot, 'reservation-a.js')),
  copyFile(join(sourceRoot, 'order-pages', 'carta.html'), join(siteRoot, 'carta', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'mesa.html'), join(siteRoot, 'mesa', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'pedido.html'), join(siteRoot, 'pedido', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'admin-pedidos.html'), join(siteRoot, 'admin', 'pedidos', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'admin-cocina.html'), join(siteRoot, 'admin', 'cocina', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'admin-reservaciones.html'), join(siteRoot, 'admin', 'reservaciones', 'index.html')),
  copyFile(join(sourceRoot, 'order-pages', 'qr-mesas.html'), join(siteRoot, 'qr-mesas', 'index.html'))
]);

await Promise.all(Array.from({ length: 12 }, async (_, index) => {
  const table = index + 1;
  const svg = await QRCode.toString(`${publicPreviewBase}/mesa/?mesa=${table}#menu`, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 640,
    color: { dark: '#000000', light: '#ffffff' }
  });
  await writeFile(join(targetRoot, 'qr', `mesa-${table}.svg`), svg, 'utf8');
}));

let html = isolatePreview(await readFile(homeFile, 'utf8'));
const styleTag = '<link id="bocc-hero-styles" rel="stylesheet" href="preview/hero-variants.css">';
const scriptTag = '<script id="bocc-hero-script" src="preview/hero-variants.js" defer></script>';
const menuStyleTag = '<link id="bocc-menu-a-styles" rel="stylesheet" href="preview/interactive-menu-a.css">';
const adminStyleTag = '<link id="bocc-menu-admin-a-styles" rel="stylesheet" href="preview/menu-admin-a.css">';
const staticDemoScriptTag = '<script id="bocc-static-demo-api-a-script" src="preview/static-demo-api-a.js"></script>';
const extrasConfigScriptTag = '<script id="bocc-menu-extras-config-a-script" src="preview/menu-extras-config-a.js" defer></script>';
const menuScriptTag = '<script id="bocc-menu-a-script" src="preview/interactive-menu-a.js" defer></script>';
const adminScriptTag = '<script id="bocc-menu-admin-a-script" src="preview/menu-admin-a.js" defer></script>';

html = html.replace(/\s*<link id="bocc-hero-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-hero-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<link id="bocc-menu-a-styles"[^>]*>/i, '');
html = html.replace(/\s*<link id="bocc-menu-admin-a-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-static-demo-api-a-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<script id="bocc-menu-extras-config-a-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<script id="bocc-menu-a-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<script id="bocc-menu-admin-a-script"[^>]*><\/script>/i, '');
html = html.includes('</head>')
  ? html.replace('</head>', `${styleTag}\n${menuStyleTag}\n${adminStyleTag}\n</head>`)
  : `${styleTag}\n${menuStyleTag}\n${adminStyleTag}\n${html}`;
html = html.includes('</body>')
  ? html.replace('</body>', `${staticDemoScriptTag}\n${extrasConfigScriptTag}\n${scriptTag}\n${menuScriptTag}\n${adminScriptTag}\n</body>`)
  : `${html}\n${staticDemoScriptTag}\n${extrasConfigScriptTag}\n${scriptTag}\n${menuScriptTag}\n${adminScriptTag}`;

await writeFile(homeFile, html, 'utf8');

let reservationHtml = isolatePreview(await readFile(reservationFile, 'utf8'));
const reservationStyleTag = '<link id="bocc-reservation-a-styles" rel="stylesheet" href="../preview/reservation-a.css">';
const reservationStaticDemoScriptTag = '<script id="bocc-static-demo-api-a-script" src="../preview/static-demo-api-a.js"></script>';
const reservationScriptTag = '<script id="bocc-reservation-a-script" src="../preview/reservation-a.js" defer></script>';

reservationHtml = reservationHtml.replace(/\s*<link id="bocc-reservation-a-styles"[^>]*>/i, '');
reservationHtml = reservationHtml.replace(/\s*<script id="bocc-static-demo-api-a-script"[^>]*><\/script>/i, '');
reservationHtml = reservationHtml.replace(/\s*<script id="bocc-reservation-a-script"[^>]*><\/script>/i, '');
reservationHtml = reservationHtml.includes('</head>')
  ? reservationHtml.replace('</head>', `${reservationStyleTag}\n</head>`)
  : `${reservationStyleTag}\n${reservationHtml}`;
reservationHtml = reservationHtml.includes('</body>')
  ? reservationHtml.replace('</body>', `${reservationStaticDemoScriptTag}\n${reservationScriptTag}\n</body>`)
  : `${reservationHtml}\n${reservationStaticDemoScriptTag}\n${reservationScriptTag}`;

await writeFile(reservationFile, reservationHtml, 'utf8');
console.log('Variantes de hero A/B aplicadas al preview local.');
