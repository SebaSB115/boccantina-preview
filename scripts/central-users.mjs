import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(process.env.BOCCANTINA_USERS_FILE || resolve(process.env.BOCCANTINA_DATA_DIR || resolve(repo, '.preview-data'), 'central-users.json'));
const params = { N:1 << 14, r:8, p:5, maxmem:64 * 1024 * 1024 };
export const permissionLabels = Object.freeze({
  'boccantina.orders':'Boccantina · Pedidos', 'boccantina.kitchen':'Boccantina · Cocina',
  'boccantina.reservations':'Boccantina · Reservaciones', 'boccantina.tables':'Boccantina · Mesas y QR',
  'boccantina.new-order':'Boccantina · Nuevo pedido', 'boccantina.extras':'Boccantina · Extras de la carta'
});
export const allPermissions = Object.keys(permissionLabels);
export const operationLabels = Object.freeze({
  'orders.view':'Consultar pedidos', 'orders.view_assigned':'Consultar pedidos de mis mesas', 'orders.create':'Crear pedidos', 'orders.create_for_table':'Crear pedidos de mis mesas', 'orders.edit':'Actualizar pedidos', 'orders.cancel':'Cancelar pedidos',
  'kitchen.view':'Consultar comandas', 'kitchen.update':'Actualizar preparación',
  'payments.view':'Consultar cobros', 'payments.collect':'Registrar cobros', 'payments.refund':'Corregir cobros',
  'tables.view':'Consultar mesas', 'tables.claim':'Iniciar atención de una mesa', 'tables.assign':'Asignar meseros', 'tables.release':'Liberar mesas cerradas', 'tables.manage':'Configurar mesas y QR',
  'reservations.view':'Consultar reservaciones', 'reservations.manage':'Gestionar reservaciones',
  'menu.view':'Consultar carta', 'menu.edit':'Editar carta', 'menu.price.edit':'Editar precios',
  'extras.manage':'Gestionar extras', 'availability.manage':'Gestionar disponibilidad',
  'users.view':'Consultar personal', 'users.manage':'Gestionar personal', 'roles.manage':'Gestionar roles y permisos',
  'audit.view':'Consultar auditoría', 'settings.manage':'Configuración crítica'
});
export const operationPermissions = Object.keys(operationLabels);
export const roleDefinitions = Object.freeze({
  waiter:{ label:'Mesero', permissions:['orders.view_assigned','orders.create_for_table','tables.view','tables.claim'] },
  cashier:{ label:'Cajero', permissions:['orders.view','orders.create','orders.edit','payments.view','payments.collect','tables.view','tables.release'] },
  reception:{ label:'Recepción', permissions:['reservations.view','reservations.manage','tables.view','tables.assign'] },
  kitchen:{ label:'Cocina', permissions:['kitchen.view','kitchen.update'] }
});
const legacyOperations = Object.freeze({
  'boccantina.orders':['orders.view','orders.edit','orders.cancel','payments.view','payments.collect','payments.refund','tables.view'],
  'boccantina.kitchen':['kitchen.view','kitchen.update'],
  'boccantina.reservations':['reservations.view','reservations.manage'],
  'boccantina.tables':['tables.view'],
  'boccantina.new-order':['orders.create'],
  'boccantina.extras':['extras.manage','availability.manage','menu.edit','menu.price.edit']
});
export function effectivePermissions(user) {
  if (!user) return [];
  const result = new Set(Array.isArray(user.grants) ? user.grants.filter(value => operationPermissions.includes(value)) : []);
  for (const role of Array.isArray(user.roles) ? user.roles : []) for (const permission of roleDefinitions[role]?.permissions || []) result.add(permission);
  // Earlier accounts retain their established access until the owner explicitly assigns roles.
  if (!Array.isArray(user.roles)) for (const view of user.permissions || []) for (const permission of legacyOperations[view] || []) result.add(permission);
  for (const permission of Array.isArray(user.denies) ? user.denies : []) result.delete(permission);
  // Configuring the physical salon and its QR codes is reserved for the separate owner account.
  result.delete('tables.manage');
  if (!user.roles?.includes('reception')) result.delete('tables.assign');
  return [...result];
}
export function viewPermissions(user) {
  const operations = new Set(effectivePermissions(user));
  return [
    ['boccantina.orders',['orders.view','orders.view_assigned']], ['boccantina.kitchen',['kitchen.view']],
    ['boccantina.reservations',['reservations.view']], ['boccantina.tables',['tables.view']],
    ['boccantina.new-order',['orders.create','orders.create_for_table']], ['boccantina.extras',['extras.manage']],
    ['boccantina.availability',['availability.manage']]
  ].filter(([, required]) => required.some(permission => operations.has(permission))).map(([view]) => view);
}
let writeQueue = Promise.resolve();

export function publicCentralUser(user) {
  return { id:user.id, username:user.username, name:user.name, active:user.active, roles:user.roles || [], grants:user.grants || [], denies:user.denies || [], permissions:viewPermissions(user), operations:effectivePermissions(user), waiterId:user.waiterId || null, lastLoginAt:user.lastLoginAt || null, createdAt:user.createdAt, updatedAt:user.updatedAt };
}

export async function hashCentralPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('La contraseña debe tener entre 8 y 256 caracteres.');
  const salt = randomBytes(32).toString('hex');
  const hash = (await scrypt(password, Buffer.from(salt, 'hex'), 64, params)).toString('hex');
  return { salt, hash };
}

export function updateCentralUsers(update) {
  const result = writeQueue.then(async () => {
    const users = await readCentralUsers();
    const value = await update(users);
    await mkdir(dirname(file), { recursive:true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version:1, users }, null, 2)}\n`, { mode:0o600 });
    await rename(temporary, file);
    return value;
  });
  writeQueue = result.catch(() => {});
  return result;
}

export async function readCentralUsers() {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(data.users) ? data.users : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function verifyCentralUser(username, password) {
  const users = await readCentralUsers();
  const user = users.find(item => item.active && item.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !/^[a-f0-9]{64}$/.test(user.salt || '') || !/^[a-f0-9]{128}$/.test(user.hash || '')) return null;
  const candidate = await scrypt(password, Buffer.from(user.salt, 'hex'), 64, params);
  return timingSafeEqual(candidate, Buffer.from(user.hash, 'hex')) ? user : null;
}
