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

  function createDefaultConfig() {
    return {
      version: 1,
      updatedAt: null,
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
    const incomingProducts = value && typeof value === 'object' ? value.products : null;
    products.forEach((product) => {
      const incoming = incomingProducts?.[product.id];
      if (!incoming || typeof incoming !== 'object') return;
      const seen = new Set();
      const extras = Array.isArray(incoming.extras) ? incoming.extras.map((extra, index) => {
        const proposedId = cleanText(extra?.id, `extra-${index + 1}`).replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
        const id = seen.has(proposedId) ? `${proposedId}-${index + 1}` : proposedId;
        seen.add(id);
        const nameEs = cleanText(extra?.nameEs ?? extra?.es);
        const nameEn = cleanText(extra?.nameEn ?? extra?.en, nameEs);
        return { id, nameEs, nameEn, price: normalizePrice(extra?.price) };
      }) : fallback.products[product.id].extras;
      fallback.products[product.id] = {
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : true,
        type: product.type,
        extras
      };
    });
    fallback.updatedAt = typeof value?.updatedAt === 'string' ? value.updatedAt : null;
    return fallback;
  }

  function load() {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? normalizeConfig(JSON.parse(stored)) : createDefaultConfig();
    } catch {
      return createDefaultConfig();
    }
  }

  function save(config) {
    const normalized = normalizeConfig({ ...config, updatedAt: new Date().toISOString() });
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('bocc:extras-config', { detail: clone(normalized) }));
      fetch('/api/config/extras', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(normalized)
      }).catch(() => {});
      return { ok: true, config: normalized };
    } catch {
      return { ok: false, config: normalized };
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

  window.BoccMenuExtrasConfig = Object.freeze({ storageKey, products: clone(products), defaults: createDefaultConfig, load, save, reset, hydrate, normalizePrice });
})();
