import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const host = new URL(config.origin).hostname;
const siteRoot = join(repoRoot, 'snapshot', host);
const sourceRoot = join(repoRoot, 'preview-src');
const targetRoot = join(siteRoot, 'preview');
const homeFile = join(siteRoot, 'index.html');
const reservationFile = join(siteRoot, 'reservaciones', 'index.html');

await mkdir(targetRoot, { recursive: true });
await Promise.all([
  copyFile(join(sourceRoot, 'hero-variants.css'), join(targetRoot, 'hero-variants.css')),
  copyFile(join(sourceRoot, 'hero-variants.js'), join(targetRoot, 'hero-variants.js')),
  copyFile(join(sourceRoot, 'interactive-menu-a.css'), join(targetRoot, 'interactive-menu-a.css')),
  copyFile(join(sourceRoot, 'interactive-menu-a.js'), join(targetRoot, 'interactive-menu-a.js')),
  copyFile(join(sourceRoot, 'menu-extras-config-a.js'), join(targetRoot, 'menu-extras-config-a.js')),
  copyFile(join(sourceRoot, 'menu-admin-a.css'), join(targetRoot, 'menu-admin-a.css')),
  copyFile(join(sourceRoot, 'menu-admin-a.js'), join(targetRoot, 'menu-admin-a.js')),
  copyFile(join(sourceRoot, 'reservation-a.css'), join(targetRoot, 'reservation-a.css')),
  copyFile(join(sourceRoot, 'reservation-a.js'), join(targetRoot, 'reservation-a.js'))
]);

let html = await readFile(homeFile, 'utf8');
const styleTag = '<link id="bocc-hero-styles" rel="stylesheet" href="/preview/hero-variants.css">';
const scriptTag = '<script id="bocc-hero-script" src="/preview/hero-variants.js" defer></script>';
const menuStyleTag = '<link id="bocc-menu-a-styles" rel="stylesheet" href="/preview/interactive-menu-a.css">';
const adminStyleTag = '<link id="bocc-menu-admin-a-styles" rel="stylesheet" href="/preview/menu-admin-a.css">';
const extrasConfigScriptTag = '<script id="bocc-menu-extras-config-a-script" src="/preview/menu-extras-config-a.js" defer></script>';
const menuScriptTag = '<script id="bocc-menu-a-script" src="/preview/interactive-menu-a.js" defer></script>';
const adminScriptTag = '<script id="bocc-menu-admin-a-script" src="/preview/menu-admin-a.js" defer></script>';

html = html.replace(/\s*<link id="bocc-hero-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-hero-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<link id="bocc-menu-a-styles"[^>]*>/i, '');
html = html.replace(/\s*<link id="bocc-menu-admin-a-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-menu-extras-config-a-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<script id="bocc-menu-a-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<script id="bocc-menu-admin-a-script"[^>]*><\/script>/i, '');
html = html.includes('</head>')
  ? html.replace('</head>', `${styleTag}\n${menuStyleTag}\n${adminStyleTag}\n</head>`)
  : `${styleTag}\n${menuStyleTag}\n${adminStyleTag}\n${html}`;
html = html.includes('</body>')
  ? html.replace('</body>', `${extrasConfigScriptTag}\n${scriptTag}\n${menuScriptTag}\n${adminScriptTag}\n</body>`)
  : `${html}\n${extrasConfigScriptTag}\n${scriptTag}\n${menuScriptTag}\n${adminScriptTag}`;

await writeFile(homeFile, html, 'utf8');

let reservationHtml = await readFile(reservationFile, 'utf8');
const reservationStyleTag = '<link id="bocc-reservation-a-styles" rel="stylesheet" href="/preview/reservation-a.css">';
const reservationScriptTag = '<script id="bocc-reservation-a-script" src="/preview/reservation-a.js" defer></script>';

reservationHtml = reservationHtml.replace(/\s*<link id="bocc-reservation-a-styles"[^>]*>/i, '');
reservationHtml = reservationHtml.replace(/\s*<script id="bocc-reservation-a-script"[^>]*><\/script>/i, '');
reservationHtml = reservationHtml.includes('</head>')
  ? reservationHtml.replace('</head>', `${reservationStyleTag}\n</head>`)
  : `${reservationStyleTag}\n${reservationHtml}`;
reservationHtml = reservationHtml.includes('</body>')
  ? reservationHtml.replace('</body>', `${reservationScriptTag}\n</body>`)
  : `${reservationHtml}\n${reservationScriptTag}`;

await writeFile(reservationFile, reservationHtml, 'utf8');
console.log('Variantes de hero A/B aplicadas al preview local.');
