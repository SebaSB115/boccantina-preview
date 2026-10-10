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

await mkdir(targetRoot, { recursive: true });
await Promise.all([
  copyFile(join(sourceRoot, 'hero-variants.css'), join(targetRoot, 'hero-variants.css')),
  copyFile(join(sourceRoot, 'hero-variants.js'), join(targetRoot, 'hero-variants.js')),
  copyFile(join(sourceRoot, 'interactive-menu-a.css'), join(targetRoot, 'interactive-menu-a.css')),
  copyFile(join(sourceRoot, 'interactive-menu-a.js'), join(targetRoot, 'interactive-menu-a.js'))
]);

let html = await readFile(homeFile, 'utf8');
const styleTag = '<link id="bocc-hero-styles" rel="stylesheet" href="/preview/hero-variants.css">';
const scriptTag = '<script id="bocc-hero-script" src="/preview/hero-variants.js" defer></script>';
const menuStyleTag = '<link id="bocc-menu-a-styles" rel="stylesheet" href="/preview/interactive-menu-a.css">';
const menuScriptTag = '<script id="bocc-menu-a-script" src="/preview/interactive-menu-a.js" defer></script>';

html = html.replace(/\s*<link id="bocc-hero-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-hero-script"[^>]*><\/script>/i, '');
html = html.replace(/\s*<link id="bocc-menu-a-styles"[^>]*>/i, '');
html = html.replace(/\s*<script id="bocc-menu-a-script"[^>]*><\/script>/i, '');
html = html.includes('</head>')
  ? html.replace('</head>', `${styleTag}\n${menuStyleTag}\n</head>`)
  : `${styleTag}\n${menuStyleTag}\n${html}`;
html = html.includes('</body>')
  ? html.replace('</body>', `${scriptTag}\n${menuScriptTag}\n</body>`)
  : `${html}\n${scriptTag}\n${menuScriptTag}`;

await writeFile(homeFile, html, 'utf8');
console.log('Variantes de hero A/B aplicadas al preview local.');
