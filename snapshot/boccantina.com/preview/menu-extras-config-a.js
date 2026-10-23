(() => {
  const storageKey = 'boccantina.hero-a.extras.v1';

  const products = [
    { id: 'bocca-burger', type: 'burger', categoryEs: 'Hamburguesas', categoryEn: 'Burgers', nameEs: 'Hamburguesa Bocca', nameEn: 'Bocca Burger' },
    { id: 'double-burger', type: 'burger', categoryEs: 'Hamburguesas', categoryEn: 'Burgers', nameEs: 'Doble Quesoburguesa', nameEn: 'Double Cheeseburger' },
    { id: 'american-burger', type: 'burger', categoryEs: 'Hamburguesas', categoryEn: 'Burgers', nameEs: 'Hamburguesa Americana', nameEn: 'American Hamburger' },
    { id: 'tica-burga', type: 'burger', categoryEs: 'Hamburguesas', categoryEn: 'Burgers', nameEs: 'Tica Burga', nameEn: 'Tica Burger' },
    { id: 'mini-chicken', type: 'burger', categoryEs: 'Mini hamburguesas', categoryEn: 'Mini burgers', nameEs: 'Mini Hamburguesas de Pollo', nameEn: 'Mini Chicken Burgers' },
    { id: 'mini-lamb', type: 'burger', categoryEs: 'Mini hamburguesas', categoryEn: 'Mini burgers', nameEs: 'Mini Hamburguesas de Cordero', nameEn: 'Mini Lamb Burgers' },
    { id: 'mini-pork', type: 'burger', categoryEs: 'Mini hamburguesas', categoryEn: 'Mini burgers', nameEs: 'Mini Hamburguesas de Pulled Pork', nameEn: 'Mini Pulled Pork Burgers' },
    { id: 'pizza-toscana', type: 'pizza', categoryEs: 'Pizzas', categoryEn: 'Pizzas', nameEs: 'Pizza Toscana', nameEn: 'Tuscan Pizza' },
    { id: 'pizza-pepperoni', type: 'pizza', categoryEs: 'Pizzas', categoryEn: 'Pizzas', nameEs: 'Pizza Pepperoni', nameEn: 'Pepperoni Pizza' },
    { id: 'pizza-suprema', type: 'pizza', categoryEs: 'Pizzas', categoryEn: 'Pizzas', nameEs: 'Pizza Suprema Boccantina', nameEn: 'Boccantina Supreme Pizza' },
    { id: 'pizza-margarita', type: 'pizza', categoryEs: 'Pizzas', categoryEn: 'Pizzas', nameEs: 'Pizza Margarita', nameEn: 'Margherita Pizza' },
    { id: 'pizza-carne', type: 'pizza', categoryEs: 'Pizzas', categoryEn: 'Pizzas', nameEs: 'Pizza Molto Carne', nameEn: 'Molto Carne Pizza' }
  ];

  const defaultExtras = {
    pizza: [
      { id: 'extra-mozzarella', nameEs: 'Mozzarella extra', nameEn: 'Extra mozzarella', price: null },
      { id: 'extra-pepperoni', nameEs: 'Pepperoni extra', nameEn: 'Extra pepperoni', price: null },
      { id: 'extra-prosciutto', nameEs: 'Prosciutto extra', nameEn: 'Extra prosciutto', price: null },
      { id: 'extra-bacon', nameEs: 'Tocineta extra', nameEn: 'Extra bacon', price: null },
      { id: 'extra-mushrooms', nameEs: 'Champiñones', nameEn: 'Mushrooms', price: null },
      { id: 'extra-jalapenos', nameEs: 'Jalapeños', nameEn: 'Jalapeños', price: null }
    ],
    burger: [
      { id: 'extra-angus-patty', nameEs: 'Torta Angus extra', nameEn: 'Extra Angus patty', price: null },
      { id: 'extra-cheddar', nameEs: 'Cheddar extra', nameEn: 'Extra cheddar', price: null },
      { id: 'extra-bacon', nameEs: 'Tocineta extra', nameEn: 'Extra bacon', price: null },
      { id: 'extra-caramelized-onion', nameEs: 'Cebolla caramelizada', nameEn: 'Caramelized onion', price: null },
      { id: 'extra-fried-egg', nameEs: 'Huevo frito', nameEn: 'Fried egg', price: null },
      { id: 'extra-jalapenos', nameEs: 'Jalapeños', nameEn: 'Jalapeños', price: null }
    ]
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const cleanText = (value, fallback = '') => String(value ?? fallback).trim().slice(0, 80);
  const cleanId = (value) => cleanText(value).replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const statuses = ['available', 'sold-out-today', 'unavailable'];

  function catalogProducts(config = null) {
    const catalog = window.BoccMenuCatalog;
    const categories = new Map((catalog?.categories || []).map((category) => [category.id, category]));
    const builtIn = catalog?.products?.length ? catalog.products.map((product) => ({
      ...product,
      categoryEs: categories.get(product.category)?.es || product.category,
      categoryEn: categories.get(product.category)?.en || product.category
    })) : products;
    return [...builtIn, ...(config?.customProducts || [])].filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index);
  }

  function createDefaultConfig() {
    const library = [...new Map(Object.values(defaultExtras).flat().map((extra) => [extra.id, { ...extra, active: true }])).values()];
    return {
      version: 2,
      updatedAt: null,
      library,
      availability: {},
      customProducts: [],
      products: Object.fromEntries(products.map((product) => [product.id, {
        enabled: true,
        type: product.type,
        extras: clone(defaultExtras[product.type])
      }]))
    };
  }

  function normalizePrice(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.round(numeric);
  }

  function normalizeConfig(value) {
    const fallback = createDefaultConfig();
    const incomingProducts = value?.products && typeof value.products === 'object' ? value.products : {};
    const categories = new Set((window.BoccMenuCatalog?.categories || []).map((item) => item.id));
    const knownIds = new Set(catalogProducts().map((product) => product.id));
    fallback.customProducts = (Array.isArray(value?.customProducts) ? value.customProducts : []).slice(0, 100)
      .filter((product) => /^custom-[a-z0-9-]{6,60}$/.test(String(product?.id || '')) && !knownIds.has(product.id) && (!categories.size || categories.has(product.category)))
      .map((product) => ({
        id: product.id, category: product.category,
        nameEs: cleanText(product.nameEs), nameEn: cleanText(product.nameEn, product.nameEs),
        descEs: String(product.descEs || '').trim().slice(0, 240), descEn: String(product.descEn || product.descEs || '').trim().slice(0, 240),
        price: normalizePrice(product.price), image: String(product.image || '').replace(/^\/+/, '').slice(0, 240),
        tags: Array.isArray(product.tags) ? product.tags.filter((tag) => ['recommended', 'share', 'vegetarian', 'spicy'].includes(tag)) : [],
        visible: product.visible !== false
      })).filter((product) => product.nameEs);
    const library = new Map(fallback.library.map((extra) => [extra.id, extra]));
    for (const product of catalogProducts(fallback)) {
      const incoming = incomingProducts[product.id];
      if (!incoming || typeof incoming !== 'object') {
        if (!fallback.products[product.id]) fallback.products[product.id] = { enabled: false, type: 'other', extras: [] };
        continue;
      }
      const seen = new Set();
      const extras = (Array.isArray(incoming.extras) ? incoming.extras : []).slice(0, 60).map((extra, index) => {
        const id = cleanId(extra?.id || `extra-${index + 1}`);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        const nameEs = cleanText(extra?.nameEs ?? extra?.es);
        if (!library.has(id) && nameEs) library.set(id, { id, nameEs, nameEn: cleanText(extra?.nameEn ?? extra?.en, nameEs), price: normalizePrice(extra?.price), active: true });
        return { id, nameEs, nameEn: cleanText(extra?.nameEn ?? extra?.en, nameEs), price: normalizePrice(extra?.price), useLibraryPrice: extra?.useLibraryPrice === true };
      }).filter(Boolean);
      fallback.products[product.id] = {
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : true,
        type: cleanText(incoming.type, product.type || 'other'), extras
      };
    }
    for (const extra of (Array.isArray(value?.library) ? value.library : []).slice(0, 300)) {
      const id = cleanId(extra?.id);
      const nameEs = cleanText(extra?.nameEs);
      if (id && nameEs) library.set(id, { id, nameEs, nameEn: cleanText(extra?.nameEn, nameEs), price: normalizePrice(extra?.price), active: extra.active !== false });
    }
    fallback.library = [...library.values()];
    for (const config of Object.values(fallback.products)) {
      config.extras = config.extras.filter((extra) => library.has(extra.id)).map((extra) => {
        const shared = library.get(extra.id);
        return { ...extra, nameEs: shared.nameEs, nameEn: shared.nameEn,
          price: extra.useLibraryPrice ? shared.price : extra.price };
      });
    }
    for (const [id, entry] of Object.entries(value?.availability || {})) {
      if (!catalogProducts(fallback).some((product) => product.id === id)) continue;
      const status = typeof entry === 'string' ? entry : entry?.status;
      if (statuses.includes(status)) fallback.availability[id] = { status, updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : null };
    }
    fallback.updatedAt = typeof value?.updatedAt === 'string' ? value.updatedAt : null;
    return fallback;
  }

  function statusFor(config, product) {
    return config?.availability?.[product.id]?.status || (product.soldOut ? 'sold-out-today' : 'available');
  }

  function load() {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? normalizeConfig(JSON.parse(stored)) : createDefaultConfig();
    } catch {
      return createDefaultConfig();
    }
  }

  async function save(config) {
    const normalized = normalizeConfig({ ...config, updatedAt: new Date().toISOString() });
    try {
      const response = await fetch('/api/config/extras', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(normalized)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, config: normalized, error: body.error || 'No se pudo guardar en el servidor.' };
      const saved = normalizeConfig(body);
      try { window.localStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
      window.dispatchEvent(new CustomEvent('bocc:extras-config', { detail: clone(saved) }));
      return { ok: true, config: saved };
    } catch (error) {
      return { ok: false, config: normalized, error: error.message || 'No hay conexión con el servidor.' };
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The defaults remain available even when browser storage is unavailable.
    }
    const config = createDefaultConfig();
    window.dispatchEvent(new CustomEvent('bocc:extras-config', { detail: clone(config) }));
    fetch('/api/config/extras', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config)
    }).catch(() => {});
    return config;
  }

  async function hydrate() {
    try {
      const response = await fetch('/api/config/extras', { headers: { accept: 'application/json' } });
      if (!response.ok) return load();
      const normalized = normalizeConfig(await response.json());
      window.localStorage.setItem(storageKey, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('bocc:extras-config', { detail: clone(normalized) }));
      return normalized;
    } catch {
      return load();
    }
  }

  window.BoccMenuExtrasConfig = Object.freeze({ storageKey, products: clone(products), defaults: createDefaultConfig, load, save, reset, hydrate, normalizePrice, normalizeConfig, catalogProducts, statusFor });
})();
