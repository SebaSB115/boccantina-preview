import scrape from 'website-scraper';
import defaultOptions from 'website-scraper/defaultOptions';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const origin = new URL(config.origin);
const snapshotDir = resolve(repoRoot, 'snapshot');

if (!snapshotDir.startsWith(`${repoRoot}${sep}`)) throw new Error('Ruta de snapshot fuera del repositorio.');

async function discoverPages(sitemapUrl, seen = new Set()) {
  if (seen.has(sitemapUrl)) return [];
  seen.add(sitemapUrl);
  const response = await fetch(sitemapUrl, {
    headers: { 'user-agent': 'TOFU-local-preview/1.0' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`No se pudo leer ${sitemapUrl}: HTTP ${response.status}`);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].replaceAll('&amp;', '&'));
  const nested = locations.filter((value) => /\.xml(?:\?|$)/i.test(value));
  if (!nested.length) return locations;
  const selected = nested.filter((value) => !/author-sitemap\.xml/i.test(value));
  const batches = await Promise.allSettled(selected.map((child) => discoverPages(child, seen)));
  return batches.flatMap((batch) => batch.status === 'fulfilled' ? batch.value : []);
}

function isAllowed(value) {
  try {
    const url = new URL(value);
    const normalizedHost = url.hostname.replace(/^www\./, '');
    const expectedHost = origin.hostname.replace(/^www\./, '');
    const sameSite = normalizedHost === expectedHost;
    const xcloudMedia = normalizedHost.endsWith('.ewp.live') && /\/wp-content\/uploads\//i.test(url.pathname);
    if (!sameSite && !xcloudMedia) return false;
    if (/\/wp-(admin|login|json)(?:\/|\?|$)/i.test(url.pathname)) return false;
    return ['http:', 'https:'].includes(url.protocol);
  } catch { return false; }
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(absolute));
    else output.push(absolute);
  }
  return output;
}

const guard = `
<meta http-equiv="Content-Security-Policy" content="connect-src 'self'; form-action 'none'; object-src 'self' data: blob:;">
<style id="tofu-preview-style">#tofu-preview-badge{position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:7px 10px;border-radius:999px;background:#101010e6;color:#fff;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 2px 12px #0005;pointer-events:none}</style>
<script id="tofu-preview-guard">document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('img[data-src]').forEach(i=>{if(!i.getAttribute('src'))i.src=i.dataset.src});document.querySelectorAll('source[data-srcset]').forEach(i=>{if(!i.getAttribute('srcset'))i.srcset=i.dataset.srcset});document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();alert('Formulario desactivado en la vista previa local.')}));const b=document.createElement('div');b.id='tofu-preview-badge';b.textContent='VISTA PREVIA LOCAL';document.body.appendChild(b);});</script>`;

await rm(snapshotDir, { recursive: true, force: true });
const discovered = await discoverPages(config.sitemap);
const pages = [...new Set([`${origin.origin}/`, ...discovered.filter(isAllowed)])];
const result = await scrape({
  urls: pages,
  directory: snapshotDir,
  filenameGenerator: 'bySiteStructure',
  recursive: true,
  maxRecursiveDepth: 5,
  ignoreErrors: true,
  sources: [
    ...defaultOptions.sources,
    { selector: 'img[data-src]', attr: 'data-src' },
    { selector: 'img[data-lazy-src]', attr: 'data-lazy-src' },
    { selector: 'source[data-srcset]', attr: 'data-srcset' },
    { selector: '[data-background-image]', attr: 'data-background-image' }
  ],
  requestConcurrency: 4,
  request: { headers: { 'user-agent': 'Mozilla/5.0 TOFU-local-preview/1.0' }, retry: { limit: 2 }, timeout: { request: 20_000 } },
  urlFilter: isAllowed
});

const htmlFiles = (await walk(snapshotDir)).filter((file) => file.toLowerCase().endsWith('.html'));
for (const file of htmlFiles) {
  let html = await readFile(file, 'utf8');
  if (!html.includes('tofu-preview-guard')) {
    html = html.includes('</head>') ? html.replace('</head>', `${guard}\n</head>`) : `${guard}\n${html}`;
    await writeFile(file, html, 'utf8');
  }
}

const manifest = { site: config.name, source: origin.origin, generatedAt: new Date().toISOString(), sitemapPages: pages.length, htmlFiles: htmlFiles.length, savedTopLevelResources: result.length, safety: ['no database', 'no credentials', 'forms disabled', 'dynamic connections blocked'] };
await writeFile(join(repoRoot, 'snapshot-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Snapshot listo: ${relative(repoRoot, snapshotDir)} (${htmlFiles.length} HTML).`);
