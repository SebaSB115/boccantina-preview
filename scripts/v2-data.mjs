import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { catalog as originalCatalog } from './catalog-ops.mjs';
import { hashCentralPassword } from './central-users.mjs';

const scrypt = promisify(scryptCallback);
const hashParameters = { N: 1 << 14, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };
const clean = (value) => String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
const folded = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const positivePosition = (value, fallback) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10000 ? Number(value) : fallback;

export function field(value, label, max, required = false) {
  const text = clean(value);
  if (required && !text) throw new Error(`${label} es obligatorio.`);
  if (text.length > max) throw new Error(`${label} admite hasta ${max} caracteres.`);
  return text;
}

export function imagePath(value) {
  const path = clean(value);
  if (!path) return '';
  if (/^\/media\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(path)) return path;
  if (/^\/v2\/assets\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(path)) return path;
  if (/^\/?wp-content\/uploads\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/.test(path) && !path.includes('..')) return path.startsWith('/') ? path : `/${path}`;
  throw new Error('Selecciona una imagen del catálogo o sube un archivo nuevo.');
}

export function defaultCatalog() {
  return {
    revision: 1,
    updatedAt: new Date().toISOString(),
    categories: originalCatalog.categories.map((item, position) => ({
      id: item.id, es: item.es, en: item.en || item.es,
      esDescription: item.esDescription || '', enDescription: item.enDescription || '',
      image: '', position, visible: true
    })),
    products: [...originalCatalog.products.map((item, position) => ({
      id: item.id, category: item.category, nameEs: item.nameEs,
      nameEn: item.nameEn || item.nameEs, descEs: item.descEs || '',
      descEn: item.descEn || '', price: item.price, image: imagePath(item.image),
      tags: Array.isArray(item.tags) ? [...item.tags] : [],
      position, visible: item.visible !== false, available: item.soldOut !== true
    })), {
      id:'cachapa-v2', category:'entradas', nameEs:'Cachapa', nameEn:'Cachapa',
      descEs:'Plato de prueba: cachapa con queso de mano y mantequilla.',
      descEn:'Test dish: cachapa with queso de mano and butter.',
      price:5000, image:'/v2/assets/cachapa.jpg', tags:[],
      position:0, visible:true, available:true
    }]
  };
}

export function publicCatalog(catalog) {
  const populated = new Set(catalog.products.filter((item) => item.visible).map((item) => item.category));
  const categories = catalog.categories.filter((item) => item.visible && populated.has(item.id))
    .sort((a, b) => a.position - b.position || a.es.localeCompare(b.es));
  const visibleCategories = new Set(categories.map((item) => item.id));
  const products = catalog.products.filter((item) => item.visible && visibleCategories.has(item.category))
    .sort((a, b) => a.position - b.position || a.nameEs.localeCompare(b.nameEs))
    .map((item) => ({ ...item, soldOut: !item.available,
      ownPhoto: /^\/(?:media\/[0-9a-f-]{36}|v2\/assets\/[a-z0-9-]+)\.(?:jpg|png|webp)$/.test(item.image || ''),
      image: item.image || categories.find((category) => category.id === item.category)?.image || '/wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-1.webp' }));
  return { categories, products, updatedAt: catalog.updatedAt };
}

export function validateCategory(input, catalog, existingId = null) {
  const es = field(input.es, 'El nombre de la categoría', 80, true);
  if (catalog.categories.some((item) => item.id !== existingId && folded(item.es) === folded(es))) throw new Error('Ya existe una categoría con ese nombre.');
  return {
    es, en: field(input.en, 'El nombre en inglés', 80) || es,
    esDescription: field(input.esDescription, 'La descripción', 300),
    enDescription: field(input.enDescription, 'La descripción en inglés', 300),
    image: imagePath(input.image),
    visible: input.visible !== false,
    position: positivePosition(input.position, catalog.categories.length)
  };
}

export function validateProduct(input, catalog, existingId = null) {
  const category = catalog.categories.find((item) => item.id === input.category);
  if (!category) throw new Error('Selecciona una categoría existente.');
  const nameEs = field(input.nameEs, 'El nombre del producto', 100, true);
  if (catalog.products.some((item) => item.id !== existingId && item.category === category.id && folded(item.nameEs) === folded(nameEs))) throw new Error('Ya existe un producto con ese nombre en la categoría.');
  const price = input.price === '' || input.price === null || input.price === undefined ? null : Number(input.price);
  if (price !== null && (!Number.isInteger(price) || price < 0 || price > 10000000)) throw new Error('El precio debe ser un número entero entre 0 y 10.000.000 colones.');
  return {
    category: category.id, nameEs, nameEn: field(input.nameEn, 'El nombre en inglés', 100) || nameEs,
    descEs: field(input.descEs, 'La descripción', 600),
    descEn: field(input.descEn, 'La descripción en inglés', 600),
    price, image: imagePath(input.image),
    visible: input.visible !== false, available: input.available !== false,
    position: positivePosition(input.position, catalog.products.length),
    tags: Array.isArray(input.tags) ? input.tags.filter((tag) => ['recommended', 'share', 'vegetarian', 'spicy'].includes(tag)) : []
  };
}

export class V2Data {
  constructor(directory) {
    this.directory = directory;
    this.file = join(directory, 'menu-v2.json');
    this.value = null;
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(this.directory, { recursive: true });
    try { this.value = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.value = { version: 2, catalog: defaultCatalog(), users: [] };
      await this.write();
    }
    if (!this.value?.catalog || !Array.isArray(this.value.catalog.categories) || !Array.isArray(this.value.catalog.products) || !Array.isArray(this.value.users)) throw new Error('Los datos de la versión 2 están dañados.');
    return this;
  }

  async write(value = this.value) {
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }

  mutate(fn) {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.value);
      const result = await fn(draft);
      await this.write(draft);
      this.value = draft;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }

  updateCatalog(revision, fn) {
    return this.mutate((draft) => {
      if (revision !== draft.catalog.revision) {
        const error = new Error('La carta cambió en otra sesión. Recárgala antes de guardar.');
        error.status = 409;
        throw error;
      }
      const result = fn(draft.catalog);
      draft.catalog.revision += 1;
      draft.catalog.updatedAt = new Date().toISOString();
      return { result, catalog: draft.catalog };
    });
  }

  async createFirstAdmin(username, name, password) {
    return this.mutate(async (draft) => {
      if (draft.users.length) throw new Error('Ya existe una cuenta administradora.');
      const user = await makeUser(username, name, password);
      draft.users.push(user);
      return publicUser(user);
    });
  }

  async verify(username, password) {
    const user = this.value.users.find((item) => item.active && item.username.toLowerCase() === String(username || '').trim().toLowerCase());
    if (!user || !/^[a-f0-9]{64}$/.test(user.salt || '') || !/^[a-f0-9]{128}$/.test(user.hash || '')) return null;
    const candidate = await scrypt(String(password || ''), Buffer.from(user.salt, 'hex'), 64, hashParameters);
    return timingSafeEqual(candidate, Buffer.from(user.hash, 'hex')) ? user : null;
  }
}

export async function makeUser(username, name, password) {
  const normalizedUser = field(username, 'El usuario', 80, true);
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(normalizedUser)) throw new Error('El usuario debe tener entre 3 y 80 letras, números, puntos o guiones.');
  const normalizedName = field(name, 'El nombre visible', 80, true);
  if (typeof password !== 'string' || password.length < 11 || password.length > 256) throw new Error('La contraseña debe tener entre 11 y 256 caracteres.');
  const credentials = await hashCentralPassword(password);
  const now = new Date().toISOString();
  return { id: randomUUID(), username: normalizedUser, name: normalizedName,
    active: true, ...credentials, createdAt: now, updatedAt: now };
}

export function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name,
    active: user.active, role: 'Administrador', createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export function newId(prefix) { return `${prefix}-${randomUUID()}`; }
