import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, 'docs-v2', path), 'utf8');
const selector = await read('central/index.html');
const login = await read('admin/login/index.html');
const admin = await read('admin/index.html');
const carta = await read('carta/index.html');
const seed = await read('v2/seed.js');
const demoApi = await read('v2/demo-api.js');
assert.match(selector, /href="https:\/\/sebasb115\.github\.io\/isabellas-menu-preview-a\/admin\/"/);
assert.match(selector, /href="\.\.\/admin\/login\/"/);
assert.match(selector, /Demostración pública/);
assert.match(login, /ACCESO DE DEMOSTRACIÓN/);
assert.match(login, /demo-boccantina/);
assert.match(admin, /DEMO PÚBLICA · CAMBIOS SOLO EN ESTE NAVEGADOR/);
assert.match(carta, /permanecen solo en tu navegador/);
for (const html of [login, admin, carta]) {
  assert(html.indexOf('/v2/seed.js') < html.indexOf('/v2/demo-api.js'));
  assert(html.indexOf('/v2/demo-api.js') < html.indexOf('/v2/' + (html === login ? 'login.js' : html === admin ? 'admin.js' : 'carta.js')));
}
assert.match(seed, /"id":"cachapa-v2"/);
assert.match(seed, /"price":5000/);
assert.match(demoApi, /boccantina-v2-public-demo-catalog/);
assert((await stat(resolve(root, 'docs-v2/v2/assets/cachapa.jpg'))).size > 100000);
assert((await stat(resolve(root, 'docs-v2/api/v2/admin/qr.svg'))).size > 1000);
console.log('V2 Pages: selector, demo identificada, carta, foto, orden de scripts y QR verificados.');
