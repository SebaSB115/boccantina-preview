// Isolated, disposable browser fixture. Never reads the restaurant's local data.
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 'boccantina-salon-qa-'));
const port = await new Promise((resolvePort, reject) => {
  const socket = createServer();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const selected = socket.address().port;
    socket.close(() => resolvePort(selected));
  });
});
const params = { N:1 << 14, r:8, p:5 };
const credential = password => {
  const salt = randomBytes(32).toString('hex');
  const hash = scryptSync(password, Buffer.from(salt, 'hex'), 64, { ...params, maxmem:64 * 1024 * 1024 }).toString('hex');
  return { salt, hash };
};
await writeFile(join(dir, 'admin-auth.json'), JSON.stringify({ username:'qa-owner', algorithm:'scrypt', params, ...credential('QaOwner2026!') }));
await writeFile(join(dir, 'central-users.json'), JSON.stringify({ version:1, users:[
  { id:'qa-waiter-user', username:'qa-mesero', name:'Mesero QA', active:true, roles:['waiter'], grants:[], denies:[], waiterId:'qa-waiter-roster', ...credential('QaWaiter2026!') },
  { id:'qa-reception-user', username:'qa-recepcion', name:'Recepción QA', active:true, roles:['reception'], grants:[], denies:[], ...credential('QaReception2026!') }
] }));
await writeFile(join(dir, 'restaurant-system.json'), JSON.stringify({ counter:0, reservationCounter:0, tableCount:12, orders:[], requests:[], reservations:[], extras:null, tables:{}, waiters:[{ id:'qa-waiter-roster', name:'Mesero QA', active:true }], assignments:{} }));

const server = spawn(process.execPath, [resolve(repo, 'scripts/serve.mjs')], {
  cwd:repo, env:{ ...process.env, BOCCANTINA_DATA_DIR:dir, BOCCANTINA_PREVIEW_PORT:String(port), BOCCANTINA_PREVIEW_HOST:'127.0.0.1' }, stdio:'inherit'
});
console.log(`QA_URL=http://127.0.0.1:${port}/admin/login/`);
console.log('QA_WAITER=qa-mesero / QaWaiter2026!');
console.log('QA_RECEPTION=qa-recepcion / QaReception2026!');
const cleanup = async () => { if (server.exitCode === null) server.kill(); await rm(dir, {recursive:true,force:true}); };
process.once('SIGINT', () => { cleanup().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { cleanup().finally(() => process.exit(0)); });
