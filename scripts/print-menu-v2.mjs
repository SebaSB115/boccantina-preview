import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { printProjection, renderPrintBody } from '../preview-src/v2/print-layout.js';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserPath = () => [process.env.CHROME_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((path) => path && existsSync(path));
const fingerprint = (catalog, language) => createHash('sha256').update(JSON.stringify({ language, categories:printProjection(catalog) })).digest('hex');
const rows = (projection) => new Map(projection.flatMap((group, index) => [[`category:${group.id}`, JSON.stringify({ es:group.es, en:group.en, index })], ...group.products.map((product, position) => [`product:${product.id}`, JSON.stringify({ ...product, category:group.id, position })])]));

export class PrintMenuV2 {
  constructor(dataDirectory) { this.archive = join(dataDirectory, 'print-editions'); this.queue = Promise.resolve(); }

  async editions() {
    await mkdir(this.archive, { recursive:true });
    const files = (await readdir(this.archive)).filter((file) => /^[a-f0-9-]{36}\.json$/.test(file));
    const editions = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(this.archive, file), 'utf8'))));
    return editions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async status(catalog, language = 'es') {
    if (!['es', 'en'].includes(language)) throw Object.assign(new Error('Idioma de impresión no válido.'), { status:400 });
    const list = await this.editions();
    const latest = list.find((edition) => edition.language === language);
    const before = rows(latest?.snapshot || []), after = rows(printProjection(catalog));
    const changes = { added:0, changed:0, removed:0 };
    for (const [key, value] of after) {
      if (!before.has(key)) changes.added++;
      else if (before.get(key) !== value) changes.changed++;
    }
    for (const key of before.keys()) if (!after.has(key)) changes.removed++;
    const currentFingerprint = fingerprint(catalog, language);
    return { revision:catalog.revision, current:latest?.fingerprint === currentFingerprint, changes,
      editions:list.map(({ snapshot, ...edition }) => ({ ...edition, current:edition.fingerprint === fingerprint(catalog, edition.language) })) };
  }

  generate(catalog, revision, language, author) {
    const task = this.queue.then(async () => {
      if (!['es', 'en'].includes(language)) throw Object.assign(new Error('Idioma de impresión no válido.'), { status:400 });
      if (revision !== catalog.revision) throw Object.assign(new Error('La carta cambió. Actualiza el estado antes de generar.'), { status:409 });
      const copy = structuredClone(catalog);
      const hash = fingerprint(copy, language);
      const existing = (await this.editions()).find((edition) => edition.language === language && edition.fingerprint === hash);
      if (existing) { const { snapshot, ...metadata } = existing; return metadata; }
      const chrome = browserPath();
      if (!chrome) throw Object.assign(new Error('Para generar el PDF instala Chrome o Chromium en este servidor y configura CHROME_EXECUTABLE_PATH.'), { status:503 });
      const edition = { id:randomUUID(), createdAt:new Date().toISOString(), language, revision, author, fingerprint:hash, snapshot:printProjection(copy) };
      const css = await readFile(join(repo, 'preview-src/v2/print.css'), 'utf8');
      const logo = await readFile(join(repo, 'snapshot/boccantina.com/preview/assets/boccantina-logo-transparent.png'));
      const body = renderPrintBody(copy, language, `data:image/png;base64,${logo.toString('base64')}`, edition);
      let browser;
      try {
        browser = await puppeteer.launch({ executablePath:chrome, headless:true, args:['--disable-gpu'], timeout:30000 });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => /^(data:|about:)/.test(request.url()) ? request.continue() : request.abort());
        await page.setContent(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`, { waitUntil:'load' });
        await page.emulateMediaType('print');
        const pdf = await page.pdf({ format:'A4', preferCSSPageSize:true, printBackground:true, displayHeaderFooter:true,
          headerTemplate:'<span></span>', footerTemplate:'<div style="width:100%;text-align:center;font:9px Arial;color:#6d6157">Boccantina · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
        await mkdir(this.archive, { recursive:true });
        await writeFile(join(this.archive, `${edition.id}.pdf`), pdf, { flag:'wx' });
        const pending = join(this.archive, `${edition.id}.tmp`);
        await writeFile(pending, JSON.stringify(edition));
        await rename(pending, join(this.archive, `${edition.id}.json`));
        const { snapshot, ...metadata } = edition;
        return metadata;
      } catch (error) {
        if (error.status) throw error;
        console.error('PDF Boccantina:', error);
        throw Object.assign(new Error('No se pudo crear el PDF. Las ediciones anteriores permanecen disponibles.'), { status:503 });
      } finally { await browser?.close(); }
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async pdf(id) {
    if (!/^[a-f0-9-]{36}$/.test(id) || !(await this.editions()).some((edition) => edition.id === id)) throw Object.assign(new Error('Edición no encontrada.'), { status:404 });
    return readFile(join(this.archive, `${id}.pdf`));
  }
}
