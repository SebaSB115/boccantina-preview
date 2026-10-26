import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { V2Data } from './v2-data.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(process.env.BOCCANTINA_V2_DATA_DIR || join(repo, '.preview-data-v2'));
const data = await new V2Data(directory).init();
if (data.value.users.length) throw new Error('La versión 2 ya tiene cuentas. Crea las siguientes desde Administración > Cuentas.');

if (process.argv.includes('--import-v1-owner')) {
  const source = process.env.BOCCANTINA_V1_AUTH_FILE;
  if (!source) throw new Error('Indica BOCCANTINA_V1_AUTH_FILE con la ruta del archivo de acceso de V1. Solo se leerá.');
  const auth = JSON.parse(await readFile(resolve(source), 'utf8'));
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(auth.username || '') || !/^[a-f0-9]{64}$/.test(auth.salt || '') || !/^[a-f0-9]{128}$/.test(auth.hash || '')) throw new Error('El archivo de acceso de V1 no tiene el formato esperado.');
  await data.mutate((draft) => {
    const now = new Date().toISOString();
    draft.users.push({ id:randomUUID(), username:auth.username, name:'Administrador', active:true,
      salt:auth.salt, hash:auth.hash, createdAt:now, updatedAt:now });
  });
  console.log('Acceso inicial V2 creado con el usuario y la contraseña existentes. El archivo de V1 no se modificó.');
  process.exit(0);
}

if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
function prompt(label, hidden = false) {
  return new Promise((done) => {
    process.stdout.write(label);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          done(value);
          return;
        }
        if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130); }
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
        if (!hidden) process.stdout.write(char);
      }
    };
    process.stdin.on('data', onData);
  });
}
const username = await prompt('Usuario administrador: ');
const name = await prompt('Nombre visible: ');
const password = await prompt('Contraseña (mínimo 11 caracteres): ', true);
const repeat = await prompt('Repetir contraseña: ', true);
if (password !== repeat) throw new Error('Las contraseñas no coinciden.');
await data.createFirstAdmin(username, name, password);
console.log('Cuenta administradora de Boccantina V2 creada.');
