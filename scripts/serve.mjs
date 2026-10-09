import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(repoRoot, 'site.config.json'), 'utf8'));
const host = new URL(config.origin).hostname;
const publicRoot = resolve(repoRoot, 'snapshot', host);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.woff':'font/woff', '.woff2':'font/woff2', '.pdf':'application/pdf' };

async function fileFor(requestPath) {
  const clean = decodeURIComponent(requestPath.split('?')[0]).replace(/^\/+/, '');
  const candidate = resolve(publicRoot, normalize(clean || 'index.html'));
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${sep}`)) return null;
  try { const info = await stat(candidate); return info.isDirectory() ? join(candidate, 'index.html') : candidate; }
  catch { const withIndex = join(candidate, 'index.html'); try { await stat(withIndex); return withIndex; } catch { return null; } }
}

createServer(async (request, response) => {
  const file = await fileFor(request.url || '/');
  if (!file) { response.writeHead(404); response.end('No encontrado en el snapshot local.'); return; }
  try { const body = await readFile(file); response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); response.end(body); }
  catch { response.writeHead(404); response.end('No encontrado.'); }
}).listen(config.localPort, '127.0.0.1', () => console.log(`${config.name}: http://localhost:${config.localPort}/`));
