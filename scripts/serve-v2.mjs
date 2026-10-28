import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { V2Data, field, makeUser, newId, publicCatalog, publicUser, validateCategory, validateProduct } from './v2-data.mjs';
import { hashCentralPassword } from './central-users.mjs';
import { PrintMenuV2 } from './print-menu-v2.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = resolve(process.env.BOCCANTINA_V2_DATA_DIR || join(repo, '.preview-data-v2'));
const publicRoot = join(repo, 'snapshot', 'boccantina.com');
const port = Number(process.env.BOCCANTINA_V2_PORT) || 4175;
const host = process.env.BOCCANTINA_V2_HOST || '127.0.0.1';
const data = await new V2Data(dataDirectory).init();
const printMenu = new PrintMenuV2(dataDirectory);
const sessions = new Map();
const failures = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff':'font/woff2', '.woff2':'font/woff2', '.ttf':'font/ttf' };
const htmlCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const resourcePaths = new Map([
  ['/preview/admin-entry.css', join(publicRoot, 'preview/admin-entry.css')],
  ['/preview/assets/boccantina-logo-transparent.png', join(publicRoot, 'preview/assets/boccantina-logo-transparent.png')],
  ['/preview/fonts/inter-latin-variable.woff2', join(publicRoot, 'preview/fonts/inter-latin-variable.woff2')],
  ['/preview/fonts/urbanist-latin-variable.woff2', join(publicRoot, 'preview/fonts/urbanist-latin-variable.woff2')]
]);

function send(response, status, body, contentType = 'application/json; charset=utf-8', headers = {}) {
  response.writeHead(status, { 'content-type': contentType, 'cache-control':'no-store',
    'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer',
    'x-frame-options':'DENY', ...headers });
  response.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
}
function failure(response, status, message) { send(response, status, { error: message }); }
function cookie(token, age) { return `boccantina_v2=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.BOCCANTINA_V2_PUBLIC_URL?.startsWith('https://') ? '; Secure' : ''}`; }
function originAllowed(request) {
  const origin = request.headers.origin;
  return origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`;
}
function sessionFor(request) {
  const token = /(?:^|;\s*)boccantina_v2=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
  const session = token && sessions.get(token);
  if (!session) return null;
  const user = data.value.users.find((item) => item.id === session.userId && item.active && item.hash === session.hash);
  if (!user || session.expires < Date.now()) { sessions.delete(token); return null; }
  session.expires = Date.now() + 8 * 60 * 60 * 1000;
  return { ...session, token, user };
}
async function bodyOf(request, limit = 16000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) { const error = new Error('El archivo o formulario supera el tamaño permitido.'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) { const error = new Error('Envía los datos como JSON.'); error.status = 415; throw error; }
  try { return JSON.parse((await bodyOf(request)).toString('utf8')); }
  catch (error) { if (error.status) throw error; const invalid = new Error('Los datos enviados no son válidos.'); invalid.status = 400; throw invalid; }
}
function revisionOf(input) {
  if (!Number.isInteger(input?.revision)) { const error = new Error('Falta la versión de la carta. Recarga la página.'); error.status = 400; throw error; }
  return input.revision;
}
function notFound(label) { const error = new Error(`${label} no encontrado.`); error.status = 404; throw error; }
function publicMenuUrl() {
  const configured = process.env.BOCCANTINA_V2_PUBLIC_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('BOCCANTINA_V2_PUBLIC_URL debe usar HTTPS.');
    return new URL('/carta/', url).toString();
  }
  return `http://127.0.0.1:${port}/carta/`;
}
async function sendFile(response, file) {
  const type = mime[extname(file).toLowerCase()];
  if (!type) return failure(response, 404, 'Recurso no encontrado.');
  try {
    const info = await stat(file);
    if (!info.isFile()) return failure(response, 404, 'Recurso no encontrado.');
    send(response, 200, await readFile(file), type, type.startsWith('text/html') ? { 'content-security-policy':htmlCsp } : {});
  } catch (error) {
    if (error.code === 'ENOENT') return failure(response, 404, 'Recurso no encontrado.');
    throw error;
  }
}
function safeFile(root, requestPath) {
  let path;
  try { path = decodeURIComponent(requestPath); } catch { return null; }
  const candidate = resolve(root, `.${path}`);
  return candidate.startsWith(`${resolve(root)}${sep}`) ? candidate : null;
}
function revokeUser(id) {
  for (const [token, session] of sessions) if (session.userId === id) sessions.delete(token);
}

async function catalogMutation(request, response, path) {
  const input = await jsonBody(request);
  const revision = revisionOf(input);
  const categoryMatch = path.match(/^\/api\/v2\/admin\/categories(?:\/([a-z0-9-]+))?$/);
  const productMatch = path.match(/^\/api\/v2\/admin\/products(?:\/([a-z0-9-]+))?$/);
  if (!categoryMatch && !productMatch) return failure(response, 404, 'Acción no encontrada.');
  const isCategory = Boolean(categoryMatch);
  const id = (categoryMatch || productMatch)[1];
  const method = request.method;
  if ((method === 'POST' && id) || (method !== 'POST' && !id) || !['POST','PATCH','DELETE'].includes(method)) return failure(response, 405, 'Acción no permitida.');
  const updated = await data.updateCatalog(revision, (catalog) => {
    const list = isCategory ? catalog.categories : catalog.products;
    const current = id ? list.find((item) => item.id === id) : null;
    if (id && !current) notFound(isCategory ? 'Categoría' : 'Producto');
    if (method === 'DELETE') {
      if (isCategory && catalog.categories.length === 1) throw new Error('La carta necesita al menos una categoría.');
      if (isCategory && catalog.products.some((item) => item.category === id)) {
        const error = new Error('Esta categoría contiene productos. Reasígnalos antes de eliminarla.'); error.status = 409; throw error;
      }
      list.splice(list.indexOf(current), 1);
      return { deleted: id };
    }
    const fields = isCategory ? validateCategory(input, catalog, id) : validateProduct(input, catalog, id);
    if (method === 'POST') {
      const created = { id:newId(isCategory ? 'cat' : 'prd'), ...fields };
      list.push(created);
      return created;
    }
    Object.assign(current, fields);
    return current;
  });
  send(response, method === 'POST' ? 201 : 200, updated);
}

async function userMutation(request, response, path, currentSession) {
  const input = await jsonBody(request);
  const id = /^\/api\/v2\/admin\/users\/([a-f0-9-]{36})$/.exec(path)?.[1];
  if (request.method === 'POST' && !id && path === '/api/v2/admin/users') {
    const user = await makeUser(input.username, input.name, input.password);
    const result = await data.mutate((draft) => {
      if (draft.users.some((item) => item.username.toLowerCase() === user.username.toLowerCase())) throw new Error('Ese usuario ya existe.');
      draft.users.push(user);
      return publicUser(user);
    });
    return send(response, 201, { user:result });
  }
  if (request.method !== 'PATCH' || !id) return failure(response, 405, 'Acción no permitida.');
  if (input.password && (typeof input.password !== 'string' || input.password.length < 11 || input.password.length > 256)) throw new Error('La contraseña debe tener entre 11 y 256 caracteres.');
  const newPassword = input.password ? await hashCentralPassword(input.password) : null;
  const result = await data.mutate((draft) => {
    const user = draft.users.find((item) => item.id === id);
    if (!user) notFound('Usuario');
    if (user.id === currentSession.user.id && input.active === false) throw new Error('No puedes desactivar tu propia cuenta.');
    const username = field(input.username, 'El usuario', 80, true);
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('El usuario debe tener entre 3 y 80 letras, números, puntos o guiones.');
    if (draft.users.some((item) => item.id !== id && item.username.toLowerCase() === username.toLowerCase())) throw new Error('Ese usuario ya existe.');
    user.username = username;
    user.name = field(input.name, 'El nombre visible', 80, true);
    user.active = input.active !== false;
    if (newPassword) Object.assign(user, newPassword);
    user.updatedAt = new Date().toISOString();
    if (!draft.users.some((item) => item.active)) throw new Error('Debe quedar al menos una cuenta activa.');
    return publicUser(user);
  });
  if (!result.active || newPassword) revokeUser(id);
  send(response, 200, { user:result });
}

async function uploadImage(request, response) {
  const type = request.headers['content-type']?.split(';')[0];
  const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
  if (!extensions[type]) return failure(response, 415, 'Usa una imagen JPG, PNG o WebP.');
  const bytes = await bodyOf(request, 3 * 1024 * 1024);
  const valid = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid || bytes.length < 100) return failure(response, 400, 'El archivo no coincide con el formato de imagen indicado.');
  const name = `${randomUUID()}.${extensions[type]}`;
  const directory = join(dataDirectory, 'uploads');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), bytes, { flag:'wx', mode:0o600 });
  send(response, 201, { path:`/media/${name}` });
}

async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${port}`}`);
  const path = url.pathname;
  if (request.method === 'GET' && path === '/api/v2/health') return send(response, 200, { ok:true, version:2, mode:'local-preview' });
  if (request.method === 'GET' && path === '/api/v2/catalog') return send(response, 200, publicCatalog(data.value.catalog));
  if (request.method === 'GET' && path === '/api/v2/catalog.js') {
    const serialized = JSON.stringify(publicCatalog(data.value.catalog)).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ' ');
    return send(response, 200, `window.BoccMenuCatalog = Object.freeze(${serialized});`, 'text/javascript; charset=utf-8');
  }
  if (request.method === 'GET' && path === '/') return send(response, 302, '', 'text/plain; charset=utf-8', { location:'/carta/' });
  if (request.method === 'GET' && (path === '/carta' || path === '/admin/login' || path === '/admin' || path === '/imprimir')) return send(response, 308, '', 'text/plain; charset=utf-8', { location:`${path}/${url.search}` });
  if (request.method === 'GET' && path === '/carta/') return sendFile(response, join(repo, 'preview-src/v2/carta.html'));
  if (request.method === 'GET' && path === '/admin/login/') return sendFile(response, join(repo, 'preview-src/v2/login.html'));

  if (path === '/api/v2/admin/login' && request.method === 'POST') {
    if (!originAllowed(request)) return failure(response, 403, 'Origen no permitido.');
    const input = await jsonBody(request);
    const key = `${request.socket.remoteAddress}:${String(input.username || '').toLowerCase()}`;
    const attempts = failures.get(key) || { count:0, until:0 };
    if (attempts.until > Date.now()) return failure(response, 429, 'Demasiados intentos. Espera cinco minutos.');
    const user = await data.verify(input.username, input.password);
    if (!user) {
      attempts.count += 1;
      if (attempts.count >= 5) { attempts.count = 0; attempts.until = Date.now() + 5 * 60 * 1000; }
      failures.set(key, attempts);
      return failure(response, 401, 'Usuario o contraseña incorrectos.');
    }
    failures.delete(key);
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(24).toString('hex');
    sessions.set(token, { userId:user.id, hash:user.hash, csrf, expires:Date.now() + 8 * 60 * 60 * 1000 });
    return send(response, 200, { user:publicUser(user), csrf }, 'application/json; charset=utf-8', { 'set-cookie':cookie(token, 8 * 60 * 60) });
  }

  if (path.startsWith('/api/v2/admin/') || path === '/admin/' || path === '/imprimir/') {
    const session = sessionFor(request);
    if (!session) {
      if (path === '/admin/' || path === '/imprimir/') return send(response, 303, '', 'text/plain; charset=utf-8', { location:'/admin/login/' });
      return failure(response, 401, 'Inicia sesión como administrador.');
    }
    if (path === '/admin/' && request.method === 'GET') return sendFile(response, join(repo, 'preview-src/v2/admin.html'));
    if (path === '/imprimir/' && request.method === 'GET') return sendFile(response, join(repo, 'preview-src/v2/print.html'));
    if (path === '/api/v2/admin/session' && request.method === 'GET') return send(response, 200, { user:publicUser(session.user), csrf:session.csrf });
    if (request.method !== 'GET') {
      if (!originAllowed(request) || request.headers['x-csrf-token'] !== session.csrf) return failure(response, 403, 'La sesión de seguridad no es válida. Recarga la página.');
    }
    if (path === '/api/v2/admin/logout' && request.method === 'POST') {
      sessions.delete(session.token);
      return send(response, 200, { ok:true }, 'application/json; charset=utf-8', { 'set-cookie':cookie('', 0) });
    }
    if (path === '/api/v2/admin/catalog' && request.method === 'GET') return send(response, 200, data.value.catalog);
    if (path === '/api/v2/admin/print/status' && request.method === 'GET') return send(response, 200, await printMenu.status(data.value.catalog, url.searchParams.get('lang') || 'es', url.searchParams.get('proposal') || 'actual', url.searchParams.get('size') || 'A4'));
    if (path === '/api/v2/admin/print/editions' && request.method === 'POST') {
      const input = await jsonBody(request);
      return send(response, 201, await printMenu.generate(data.value.catalog, input.revision, input.language, session.user.name, input.proposal, input.size));
    }
    const printPdf = /^\/api\/v2\/admin\/print\/([a-f0-9-]{36})\.pdf$/.exec(path);
    if (printPdf && request.method === 'GET') {
      const pdf = await printMenu.pdf(printPdf[1]);
      return send(response, 200, pdf, 'application/pdf', { 'content-disposition':`attachment; filename="Boccantina-menu-${printPdf[1]}.pdf"` });
    }
    if (path === '/api/v2/admin/users' && request.method === 'GET') return send(response, 200, { users:data.value.users.map(publicUser) });
    if (path === '/api/v2/admin/qr' && request.method === 'GET') return send(response, 200, { url:publicMenuUrl(), local:!process.env.BOCCANTINA_V2_PUBLIC_URL });
    if (path === '/api/v2/admin/qr.svg' && request.method === 'GET') {
      const svg = await QRCode.toString(publicMenuUrl(), { type:'svg', errorCorrectionLevel:'H', margin:2, color:{ dark:'#171516', light:'#ffffff' } });
      return send(response, 200, svg, 'image/svg+xml', url.searchParams.has('download') ? { 'content-disposition':'attachment; filename="boccantina-carta-qr.svg"' } : {});
    }
    if (path === '/api/v2/admin/images' && request.method === 'POST') return uploadImage(request, response);
    if (path.startsWith('/api/v2/admin/categories') || path.startsWith('/api/v2/admin/products')) return catalogMutation(request, response, path);
    if (path.startsWith('/api/v2/admin/users')) return userMutation(request, response, path, session);
    return failure(response, 404, 'Vista no encontrada.');
  }

  if (request.method !== 'GET') return failure(response, 404, 'Vista no encontrada.');
  if (path.startsWith('/v2/')) return sendFile(response, safeFile(join(repo, 'preview-src/v2'), path.slice(3)) || '');
  if (resourcePaths.has(path)) return sendFile(response, resourcePaths.get(path));
  if (path.startsWith('/media/')) {
    if (!/^\/media\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(path)) return failure(response, 404, 'Imagen no encontrada.');
    return sendFile(response, join(dataDirectory, 'uploads', path.slice('/media/'.length)));
  }
  if (path.startsWith('/wp-content/uploads/')) {
    const file = safeFile(publicRoot, path);
    return file ? sendFile(response, file) : failure(response, 404, 'Recurso no encontrado.');
  }
  return failure(response, 404, 'Esta función no forma parte de la versión 2 simple.');
}

createServer((request, response) => handler(request, response).catch((error) => {
  console.error('V2:', error);
  if (response.headersSent) { response.end(); return; }
  failure(response, error.status || (error.code ? 500 : 400), error.code ? 'No se pudo completar la operación.' : error.message);
})).listen(port, host, () => console.log(`Boccantina V2 local: http://${host}:${port}/carta/`));
