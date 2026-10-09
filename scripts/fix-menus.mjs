import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const host = new URL(config.origin).hostname;
const siteRoot = resolve(repoRoot, 'snapshot', host);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function menuAssetUrls(html) {
  const fragments = [
    ...[...html.matchAll(/<script[^>]*class=["'][^"']*df-shortcode-script[^"']*["'][^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0]),
    ...[...html.matchAll(/<a[^>]+href=["'][^"']*\/wp-content\/uploads\/[^"']+\.pdf(?:\?[^"']*)?["'][^>]*>[\s\S]*?(?:men[uú]|menu)[\s\S]*?<\/a>/gi)].map((match) => match[0])
  ];
  const urls = new Set();
  for (const fragment of fragments) {
    for (const match of fragment.matchAll(/https:\\?\/\\?\/[^"'\s<]+/gi)) {
      const value = match[0].replaceAll('\\/', '/').replaceAll('\\u0026', '&');
      try {
        const url = new URL(value);
        if (/\/wp-content\/uploads\//i.test(url.pathname)) urls.add(url.href);
      } catch {}
    }
  }
  return [...urls];
}

const htmlFiles = (await walk(siteRoot)).filter((file) => file.toLowerCase().endsWith('.html'));
const assets = new Set();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const url of menuAssetUrls(html)) assets.add(url);
}

const replacements = [];
for (const value of assets) {
  const url = new URL(value);
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const destination = resolve(siteRoot, relativePath);
  if (!destination.startsWith(`${siteRoot}${sep}`)) throw new Error(`Ruta insegura: ${destination}`);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { 'user-agent': 'TOFU-local-preview/1.0' } });
  } catch (error) {
    console.warn(`No descargado (${error.name}): ${url.href}`);
    continue;
  }
  if (!response.ok) {
    console.warn(`No descargado (${response.status}): ${url.href}`);
    continue;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  replacements.push({ remote: url.href, local: `/${relativePath.replaceAll('\\', '/')}` });
}

for (const file of htmlFiles) {
  let html = await readFile(file, 'utf8');
  html = html.replace("connect-src 'none'", "connect-src 'self'");
  for (const { remote, local } of replacements) {
    html = html.replaceAll(remote, local);
    html = html.replaceAll(remote.replaceAll('/', '\\/'), local.replaceAll('/', '\\/'));
  }
  await writeFile(file, html, 'utf8');
}

console.log(`Menús locales: ${replacements.length}/${assets.size} recursos copiados.`);
