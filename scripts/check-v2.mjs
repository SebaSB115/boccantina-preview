import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { V2Data, publicCatalog } from './v2-data.mjs';

const repo = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'boccantina-v2-check-'));
const store = await new V2Data(directory).init();
const starter = store.value.catalog.products.find((item) => item.id === 'cachapa-v2');
if (!starter || starter.category !== 'entradas' || starter.price !== 5000 || starter.image !== '/v2/assets/cachapa.jpg' || starter.visible !== true) {
  throw new Error('El producto de prueba Cachapa debe iniciar la carta V2 con su fotografía y precio.');
}
checkEmptyCatalog();
function checkEmptyCatalog() {
  const draft = structuredClone(store.value.catalog);
  draft.products = draft.products.map((item) => ({ ...item, visible:false }));
  const result = publicCatalog(draft);
  if (result.categories.length || result.products.length) throw new Error('La carta sin productos visibles debe tener un estado vacío.');
  const example = structuredClone(store.value.catalog);
  const category = example.categories.find((item) => item.id === example.products[0].category);
  category.image = '/media/00000000-0000-4000-8000-000000000000.png';
  example.products[0].image = '';
  const inherited = publicCatalog(example).products.find((item) => item.id === example.products[0].id);
  if (inherited.ownPhoto || inherited.image !== category.image) throw new Error('La foto de categoría no debe atribuirse a un plato.');
}
const password = `QA-${randomBytes(18).toString('base64url')}`;
await store.createFirstAdmin('adminqa', 'Administrador QA', password);
const freePort = await new Promise((done, fail) => {
  const server = createServer();
  server.once('error', fail);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => done(port)); });
});
const base = `http://127.0.0.1:${freePort}`;
const child = spawn(process.execPath, ['scripts/serve-v2.mjs'], { cwd:repo,
  env:{ ...process.env, BOCCANTINA_V2_DATA_DIR:directory, BOCCANTINA_V2_PORT:String(freePort) },
  stdio:['ignore','pipe','pipe'] });
let childError = '';
child.stderr.on('data', (chunk) => { childError += chunk.toString(); });
const check = (condition, message) => { if (!condition) throw new Error(message); };
let cookie = '', csrf = '';
async function call(path, method = 'GET', body = null, authenticated = true, contentType = 'application/json') {
  const headers = {};
  if (authenticated && cookie) headers.cookie = cookie;
  if (method !== 'GET') { headers.origin = base; if (authenticated && csrf) headers['x-csrf-token'] = csrf; }
  if (body !== null) headers['content-type'] = contentType;
  const response = await fetch(base + path, { method, headers, body:body === null ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body, redirect:'manual' });
  const raw = await response.text();
  let json; try { json = JSON.parse(raw); } catch { json = null; }
  return { response, json, raw };
}

try {
  let ready = false;
  for (let tries = 0; tries < 80; tries += 1) {
    try { ready = (await call('/api/v2/health', 'GET', null, false)).response.status === 200; if (ready) break; }
    catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  check(ready, `El servidor V2 no inició. ${childError}`);
  const menuPage = await call('/carta/', 'GET', null, false);
  check(menuPage.response.status === 200 && menuPage.raw.includes('/v2/carta.js') && !menuPage.raw.includes('order-system-a.js'), 'La carta V2 debe usar su vista de consulta independiente.');
  const cachapaPhoto = await fetch(base + '/v2/assets/cachapa.jpg');
  check(cachapaPhoto.status === 200 && cachapaPhoto.headers.get('content-type')?.startsWith('image/jpeg'), 'La fotografía de Cachapa debe estar disponible en V2.');
  check((await call('/api/v2/admin/catalog', 'GET', null, false)).response.status === 401, 'El catálogo administrativo debe exigir sesión.');
  check((await call('/admin/pedidos/', 'GET', null, false)).response.status === 404, 'Pedidos no debe estar disponible en V2.');
  check((await call('/preview/order-system-a.js', 'GET', null, false)).response.status === 404, 'El script de pedidos anterior no debe servirse en V2.');
  const login = await call('/api/v2/admin/login', 'POST', { username:'adminqa', password }, false);
  check(login.response.status === 200, `Login: ${login.raw}`);
  cookie = login.response.headers.get('set-cookie').split(';')[0];
  csrf = login.json.csrf;
  check((await call('/api/v2/admin/session')).json.user.role === 'Administrador', 'Debe haber un solo rol visible.');
  const initial = (await call('/api/v2/admin/catalog')).json;
  check(initial.categories.length > 0 && initial.products.length > 0, 'El catálogo original debe iniciar la V2.');
  const category = await call('/api/v2/admin/categories', 'POST', { revision:initial.revision, es:'Especiales de prueba', en:'Test specials', image:'', visible:true, position:0 });
  check(category.response.status === 201, `Crear categoría: ${category.raw}`);
  const categoryId = category.json.result.id;
  check(!(await call('/api/v2/catalog', 'GET', null, false)).json.categories.some((item) => item.id === categoryId), 'Una categoría sin productos visibles no debe ocupar espacio en la carta.');
  const product = await call('/api/v2/admin/products', 'POST', { revision:category.json.catalog.revision, category:categoryId,
    nameEs:'Producto de prueba', nameEn:'Test product', descEs:'Una descripción de prueba.', descEn:'A test description.',
    price:null, image:'', visible:true, available:false, position:0, tags:[] });
  check(product.response.status === 201, `Crear producto: ${product.raw}`);
  const productId = product.json.result.id;
  let publicMenu = (await call('/api/v2/catalog', 'GET', null, false)).json;
  check(publicMenu.categories.some((item) => item.id === categoryId), 'La categoría creada debe aparecer al publicar un producto visible.');
  check(publicMenu.products.some((item) => item.id === productId && item.soldOut && item.price === null), 'La carta pública debe reflejar disponibilidad y precio pendiente.');
  check(publicMenu.products.some((item) => item.id === productId && item.nameEn === 'Test product'), 'La carta debe conservar el contenido en inglés.');
  const renamed = await call(`/api/v2/admin/categories/${categoryId}`, 'PATCH', { ...category.json.result, revision:product.json.catalog.revision, es:'Aperitivos QA', en:'QA appetizers', position:0, visible:false });
  check(renamed.response.status === 200, `Ocultar y renombrar categoría: ${renamed.raw}`);
  publicMenu = (await call('/api/v2/catalog', 'GET', null, false)).json;
  check(!publicMenu.categories.some((item) => item.id === categoryId) && !publicMenu.products.some((item) => item.id === productId), 'La categoría oculta y sus productos no deben mostrarse.');
  const restored = await call(`/api/v2/admin/categories/${categoryId}`, 'PATCH', { ...renamed.json.result, revision:renamed.json.catalog.revision, visible:true });
  check(restored.response.status === 200, `Restaurar categoría: ${restored.raw}`);
  publicMenu = (await call('/api/v2/catalog', 'GET', null, false)).json;
  check(publicMenu.categories[0]?.id === categoryId && publicMenu.categories[0]?.es === 'Aperitivos QA' && publicMenu.categories[0]?.en === 'QA appetizers', 'La carta debe seguir el nuevo nombre, la traducción y el orden de la Central.');
  const conflict = await call(`/api/v2/admin/categories/${categoryId}`, 'DELETE', { revision:restored.json.catalog.revision });
  check(conflict.response.status === 409, 'No se debe eliminar una categoría con productos.');
  const badCsrf = await fetch(base + '/api/v2/admin/products', { method:'POST', headers:{ cookie, origin:base, 'content-type':'application/json', 'x-csrf-token':'incorrecto' }, body:'{}' });
  check(badCsrf.status === 403, 'Las escrituras deben verificar CSRF.');
  const png = await readFile(join(repo, 'snapshot/boccantina.com/preview/assets/boccantina-logo-transparent.png'));
  const upload = await call('/api/v2/admin/images', 'POST', png, true, 'image/png');
  check(upload.response.status === 201 && upload.json.path.startsWith('/media/'), `Subir imagen: ${upload.raw}`);
  const edit = await call(`/api/v2/admin/products/${productId}`, 'PATCH', { ...product.json.result, revision:restored.json.catalog.revision,
    category:initial.categories[0].id, price:4750, available:true, image:upload.json.path });
  check(edit.response.status === 200, `Editar producto: ${edit.raw}`);
  publicMenu = (await call('/api/v2/catalog', 'GET', null, false)).json;
  check(publicMenu.products.some((item) => item.id === productId && item.price === 4750 && !item.soldOut && item.ownPhoto), 'La carta debe mostrar el producto y distinguir su fotografía propia.');
  check((await call(upload.json.path, 'GET', null, false)).response.status === 200, 'La imagen debe ser pública.');
  const removed = await call(`/api/v2/admin/categories/${categoryId}`, 'DELETE', { revision:edit.json.catalog.revision });
  check(removed.response.status === 200, `Eliminar categoría vacía: ${removed.raw}`);
  const newUser = await call('/api/v2/admin/users', 'POST', { username:'segundoqa', name:'Segunda cuenta QA', password:'NuevaClaveQA2026!' });
  check(newUser.response.status === 201, `Crear segundo administrador: ${newUser.raw}`);
  const qr = await call('/api/v2/admin/qr');
  check(qr.json.url === `${base}/carta/`, 'El QR local debe apuntar a la carta del servidor de prueba.');
  check((await call('/api/v2/admin/qr.svg')).raw.includes('<svg'), 'El QR debe ser SVG.');
  const disabled = await call(`/api/v2/admin/users/${newUser.json.user.id}`, 'PATCH', { ...newUser.json.user, active:false });
  check(disabled.response.status === 200, `Desactivar administrador: ${disabled.raw}`);
  const rejected = await call('/api/v2/admin/login', 'POST', { username:'segundoqa', password:'NuevaClaveQA2026!' }, false);
  check(rejected.response.status === 401, 'La cuenta desactivada no debe iniciar sesión.');
  console.log('V2: login, rol único, CRUD, disponibilidad, imagen, QR, CSRF y rutas excluidas verificados.');
} finally {
  child.kill();
  const absolute = resolve(directory);
  const safeRoot = resolve(tmpdir()) + sep;
  if (absolute.startsWith(safeRoot) && absolute.includes('boccantina-v2-check-')) await rm(absolute, { recursive:true, force:true, maxRetries:5, retryDelay:150 });
}
