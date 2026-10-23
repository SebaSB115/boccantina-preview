import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const params = { N: 1 << 14, r: 8, p: 5 };
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(process.env.BOCCANTINA_DATA_DIR || resolve(repo, '.preview-data'), 'admin-auth.json');
const username = process.env.BOCCANTINA_ADMIN_USER || 'boccantina-admin';
if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('Usuario inválido. Usa de 3 a 80 letras, números, puntos o guiones.');
if (!process.stdin.isTTY) throw new Error('Ejecuta admin:setup en una terminal interactiva.');

function secretPrompt(label) {
  return new Promise((resolvePrompt) => {
    process.stdout.write(label);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const done = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); process.stdin.removeListener('data', onData); resolvePrompt(value); };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') return done();
        if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130); }
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

const password = await secretPrompt('Contraseña nueva de Boccantina (mínimo 11 caracteres): ');
const confirm = await secretPrompt('Repetir contraseña: ');
if (password.length < 11 || password.length > 256 || password !== confirm) throw new Error('Las contraseñas deben coincidir y tener entre 11 y 256 caracteres.');
const salt = randomBytes(32).toString('hex');
const hash = (await scrypt(password, Buffer.from(salt, 'hex'), 64, { ...params, maxmem:64 * 1024 * 1024 })).toString('hex');
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify({ username, algorithm: 'scrypt', params, salt, hash, changedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
console.log(`Acceso local de Boccantina configurado para ${username}.`);
