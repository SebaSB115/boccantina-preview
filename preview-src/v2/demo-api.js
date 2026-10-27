/* Demo pública de GitHub Pages. Este archivo nunca se carga en el servidor privado. */
(() => {
  const base = document.querySelector('meta[name="boccantina-demo-base"]')?.content || '';
  const seed = window.BoccV2DemoSeed;
  if (!seed) throw new Error('Faltan los datos de demostración.');
  const catalogKey = 'boccantina-v2-public-demo-catalog';
  const usersKey = 'boccantina-v2-public-demo-users';
  const sessionKey = 'boccantina-v2-public-demo-session';
  const defaultUser = { id:'demo-admin', username:'demo-boccantina', name:'Administrador de demostración', password:'vista2026', active:true };
  const originalFetch = window.fetch.bind(window);
  const clone = (value) => structuredClone(value);
  const readStored = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : clone(fallback);
    } catch { return clone(fallback); }
  };
  const response = (status, payload) => new Response(JSON.stringify(payload), {
    status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }
  });
  const fail = (status, error) => response(status, { error });
  const clean = (value) => String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const pathWithoutBase = (path) => base && path.startsWith(`${base}/`) ? path.slice(base.length) : path;
  const ownPhoto = (path) => /^data:image\/(?:jpeg|png|webp);base64,/.test(path || '')
    || /^\/(?:media\/[0-9a-f-]{36}|v2\/assets\/[a-z0-9-]+)\.(?:jpg|png|webp)$/.test(pathWithoutBase(path || ''));
  const ordered = (items, label) => [...items].sort((a, b) => a.position - b.position || String(a[label]).localeCompare(String(b[label])));
  const publicCatalog = (catalog) => {
    const populated = new Set(catalog.products.filter((item) => item.visible).map((item) => item.category));
    const categories = ordered(catalog.categories.filter((item) => item.visible && populated.has(item.id)), 'es');
    const categoryIds = new Set(categories.map((item) => item.id));
    const products = ordered(catalog.products.filter((item) => item.visible && categoryIds.has(item.category)), 'nameEs')
      .map((item) => ({
        ...item, soldOut:!item.available, ownPhoto:ownPhoto(item.image),
        image:item.image || categories.find((category) => category.id === item.category)?.image || `${base}/wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-1.webp`
      }));
    return { categories, products, updatedAt:catalog.updatedAt };
  };
  const catalog = () => {
    const value = readStored(catalogKey, seed);
    return Array.isArray(value.categories) && Array.isArray(value.products) ? value : clone(seed);
  };
  const users = () => {
    const value = readStored(usersKey, [defaultUser]);
    return Array.isArray(value) && value.length ? value : [clone(defaultUser)];
  };
  const publicUser = ({ id, username, name, active }) => ({ id, username, name, active, role:'Administrador' });
  const currentUser = () => users().find((item) => item.id === sessionStorage.getItem(sessionKey) && item.active);
  const field = (value, label, max, required = false) => {
    const text = clean(value);
    if (required && !text) throw new Error(`${label} es obligatorio.`);
    if (text.length > max) throw new Error(`${label} admite hasta ${max} caracteres.`);
    return text;
  };
  const position = (value, fallback) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10000 ? Number(value) : fallback;
  const validImage = (value) => {
    const image = clean(value);
    if (!image || image.startsWith('data:image/')) return image;
    if (/^\/(?:boccantina-preview\/)?(?:v2\/assets\/[a-z0-9-]+|wp-content\/uploads\/[a-zA-Z0-9_./-]+)\.(?:jpg|jpeg|png|webp)$/.test(image) && !image.includes('..')) return image;
    throw new Error('Selecciona una imagen de la carta o sube un archivo nuevo.');
  };
  const validateCategory = (input, draft, id) => {
    const es = field(input.es, 'El nombre de la categoría', 80, true);
    if (draft.categories.some((item) => item.id !== id && fold(item.es) === fold(es))) throw new Error('Ya existe una categoría con ese nombre.');
    return {
      es, en:field(input.en, 'El nombre en inglés', 80) || es,
      esDescription:field(input.esDescription, 'La descripción', 300),
      enDescription:field(input.enDescription, 'La descripción en inglés', 300),
      image:validImage(input.image), visible:input.visible !== false,
      position:position(input.position, draft.categories.length)
    };
  };
  const validateProduct = (input, draft, id) => {
    if (!draft.categories.some((item) => item.id === input.category)) throw new Error('Selecciona una categoría existente.');
    const nameEs = field(input.nameEs, 'El nombre del producto', 100, true);
    if (draft.products.some((item) => item.id !== id && item.category === input.category && fold(item.nameEs) === fold(nameEs))) throw new Error('Ya existe un producto con ese nombre en la categoría.');
    const price = input.price === '' || input.price === null || input.price === undefined ? null : Number(input.price);
    if (price !== null && (!Number.isInteger(price) || price < 0 || price > 10000000)) throw new Error('El precio debe ser un número entero entre 0 y 10.000.000 colones.');
    return {
      category:input.category, nameEs, nameEn:field(input.nameEn, 'El nombre en inglés', 100) || nameEs,
      descEs:field(input.descEs, 'La descripción', 600), descEn:field(input.descEn, 'La descripción en inglés', 600),
      price, image:validImage(input.image), visible:input.visible !== false,
      available:input.available !== false, position:position(input.position, draft.products.length),
      tags:Array.isArray(input.tags) ? input.tags.filter((tag) => ['recommended','share','vegetarian','spicy'].includes(tag)) : []
    };
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { throw new Error('Este navegador no tiene espacio para guardar más datos de prueba.'); }
  };
  async function handle(input, init, path) {
    const method = String(init.method || 'GET').toUpperCase();
    if (path === '/api/v2/catalog' && method === 'GET') return response(200, publicCatalog(catalog()));
    if (path === '/api/v2/admin/login' && method === 'POST') {
      const credentials = JSON.parse(init.body || '{}');
      const user = users().find((item) => item.active && item.username === credentials.username && item.password === credentials.password);
      if (!user) return fail(401, 'Usuario o contraseña de demostración incorrectos.');
      sessionStorage.setItem(sessionKey, user.id);
      return response(200, { user:publicUser(user), csrf:'demo-publica' });
    }
    const user = currentUser();
    if (!user) return fail(401, 'Inicia sesión en la demostración.');
    if (method !== 'GET' && new Headers(init.headers || {}).get('x-csrf-token') !== 'demo-publica') return fail(403, 'Recarga la demostración e inténtalo de nuevo.');
    if (path === '/api/v2/admin/session' && method === 'GET') return response(200, { user:publicUser(user), csrf:'demo-publica' });
    if (path === '/api/v2/admin/logout' && method === 'POST') {
      sessionStorage.removeItem(sessionKey);
      return response(200, { ok:true });
    }
    if (path === '/api/v2/admin/catalog' && method === 'GET') return response(200, catalog());
    if (path === '/api/v2/admin/users' && method === 'GET') return response(200, { users:users().map(publicUser) });
    if (path === '/api/v2/admin/qr' && method === 'GET') return response(200, { url:`${location.origin}${base}/carta/`, local:false });
    if (path === '/api/v2/admin/images' && method === 'POST') {
      const file = init.body;
      if (!(file instanceof Blob) || !['image/jpeg','image/png','image/webp'].includes(file.type)) return fail(415, 'Usa una imagen JPG, PNG o WebP.');
      if (file.size > 3 * 1024 * 1024) return fail(413, 'La imagen debe pesar menos de 3 MB.');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      return response(201, { path:data });
    }
    const match = /^\/api\/v2\/admin\/(products|categories)(?:\/([a-z0-9-]+))?$/.exec(path);
    if (match && ['POST','PATCH','DELETE'].includes(method)) {
      const entity = match[1], id = match[2], input = JSON.parse(init.body || '{}');
      const draft = clone(catalog()), list = entity === 'products' ? draft.products : draft.categories;
      if (input.revision !== draft.revision) return fail(409, 'La carta cambió en otra pestaña. Recárgala antes de guardar.');
      if (method === 'POST' && id || method !== 'POST' && !id) return fail(405, 'Acción no permitida.');
      const existing = id ? list.find((item) => item.id === id) : null;
      if (id && !existing) return fail(404, 'Elemento no encontrado.');
      let result;
      if (method === 'DELETE') {
        if (entity === 'categories' && draft.categories.length === 1) return fail(409, 'La carta necesita al menos una categoría.');
        if (entity === 'categories' && draft.products.some((item) => item.category === id)) return fail(409, 'Esta categoría contiene productos. Reasígnalos antes de eliminarla.');
        list.splice(list.indexOf(existing), 1);
        result = { deleted:id };
      } else {
        const values = entity === 'products' ? validateProduct(input, draft, id) : validateCategory(input, draft, id);
        if (method === 'POST') {
          result = { id:`${entity === 'products' ? 'prd' : 'cat'}-${crypto.randomUUID()}`, ...values };
          list.push(result);
        } else { Object.assign(existing, values); result = existing; }
      }
      draft.revision += 1;
      draft.updatedAt = new Date().toISOString();
      save(catalogKey, draft);
      return response(method === 'POST' ? 201 : 200, { result, catalog:draft });
    }
    const userMatch = /^\/api\/v2\/admin\/users(?:\/([a-z0-9-]+))?$/.exec(path);
    if (userMatch && ['POST','PATCH'].includes(method)) {
      const id = userMatch[1], input = JSON.parse(init.body || '{}');
      const draft = clone(users());
      if (method === 'POST' && id || method === 'PATCH' && !id) return fail(405, 'Acción no permitida.');
      const existing = id ? draft.find((item) => item.id === id) : null;
      if (id && !existing) return fail(404, 'Usuario no encontrado.');
      const username = field(input.username, 'El usuario', 80, true);
      const name = field(input.name, 'El nombre visible', 80, true);
      if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) return fail(400, 'El usuario debe tener entre 3 y 80 letras, números, puntos o guiones.');
      if (draft.some((item) => item.id !== id && item.username.toLowerCase() === username.toLowerCase())) return fail(409, 'Ese usuario ya existe.');
      if (!existing && (!input.password || input.password.length < 11)) return fail(400, 'La contraseña de prueba debe tener al menos 11 caracteres.');
      if (existing?.id === user.id && input.active === false) return fail(400, 'No puedes desactivar tu propia cuenta.');
      const updated = existing || { id:crypto.randomUUID(), active:true };
      Object.assign(updated, { username, name, active:input.active !== false });
      if (input.password) updated.password = String(input.password);
      if (!existing) draft.push(updated);
      save(usersKey, draft);
      return response(existing ? 200 : 201, { user:publicUser(updated) });
    }
    return fail(404, 'Esta acción no está disponible en la demostración.');
  }
  window.fetch = function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const path = pathWithoutBase(url.pathname);
    if (!path.startsWith('/api/v2/')) return originalFetch(input, init);
    return Promise.resolve().then(() => handle(input, init, path)).catch((error) => fail(400, error.message || 'No se pudo completar la acción.'));
  };
  // La vista A4 de la demo se abre en otra pestaña, donde sessionStorage no se comparte.
  // Sus datos ya son locales y públicos; el servidor Node conserva su control de sesión.
  Object.defineProperty(window, 'BoccV2DemoCatalog', { value:() => clone(catalog()) });
})();
