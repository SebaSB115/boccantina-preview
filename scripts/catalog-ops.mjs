import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// The local server reads the same versioned catalog and config rules as the browser.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'preview-src');
const window = { location: { search: '' } };
const context = { window, URLSearchParams };
runInNewContext(await readFile(join(root, 'interactive-menu-a.js'), 'utf8'), context);
runInNewContext(await readFile(join(root, 'menu-extras-config-a.js'), 'utf8'), context);

export const catalog = window.BoccMenuCatalog;
export const extrasApi = window.BoccMenuExtrasConfig;
export const normalizeExtras = (value) => JSON.parse(JSON.stringify(extrasApi.normalizeConfig(value)));

export function unavailableItems(items, config) {
  const products = new Map(extrasApi.catalogProducts(config).map((product) => [product.id, product]));
  return items.flatMap((item) => {
    const product = products.get(item.productId);
    if (!product) return [{ id: item.productId, name: item.name, reason: 'El producto ya no figura en la carta.' }];
    if (product.visible === false) return [{ id: item.productId, name: product.nameEs, reason: 'El producto está oculto.' }];
    if (extrasApi.statusFor(config, product) !== 'available') return [{ id: item.productId, name: product.nameEs, reason: 'El producto no está disponible.' }];
    const assigned = config.products?.[item.productId];
    const activeExtras = new Map((config.library || []).filter((extra) => extra.active !== false).map((extra) => [extra.id, extra]));
    return (item.extras || []).filter((extra) => !assigned?.enabled || !assigned.extras?.some((entry) => entry.id === extra.id) || !activeExtras.has(extra.id))
      .map((extra) => ({ id: extra.id, name: extra.name, reason: `El extra ${extra.name} ya no está disponible.` }));
  });
}
