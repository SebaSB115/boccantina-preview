import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PRINT_DESIGN_VERSION, printProjection, renderPrintBody } from '../preview-src/v2/print-layout.js';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserPath = () => [process.env.CHROME_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'].find((path) => path && existsSync(path));
const printOptions = (proposal = 'actual', size = 'A4') => {
  if (!['actual','sobria','editorial'].includes(proposal) || !['A4','A3','A2'].includes(size)) throw Object.assign(new Error('Propuesta o tamaño de papel no válido.'), {status:400});
  return {proposal,size};
};
const fingerprint = (catalog, language, proposal = 'actual', size = 'A4') => createHash('sha256').update(JSON.stringify({ layout:PRINT_DESIGN_VERSION, language, ...printOptions(proposal,size), categories:printProjection(catalog) })).digest('hex');
const rows = (projection) => new Map(projection.flatMap((group, index) => [[`category:${group.id}`, JSON.stringify({ es:group.es, en:group.en, index })], ...group.products.map((product, position) => [`product:${product.id}`, JSON.stringify({ ...product, category:group.id, position })])]));

export class PrintMenuV2 {
  constructor(dataDirectory) { this.archive = join(dataDirectory, 'print-editions'); this.queue = Promise.resolve(); }

  async editions() {
    await mkdir(this.archive, { recursive:true });
    const files = (await readdir(this.archive)).filter((file) => /^[a-f0-9-]{36}\.json$/.test(file));
    const editions = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(this.archive, file), 'utf8'))));
    return editions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async status(catalog, language = 'es', proposal = 'actual', size = 'A4') {
    if (!['es', 'en'].includes(language)) throw Object.assign(new Error('Idioma de impresión no válido.'), { status:400 });
    printOptions(proposal,size);
    const list = await this.editions();
    const latest = list.find((edition) => edition.language === language && edition.proposal === proposal && edition.size === size);
    const before = rows(latest?.snapshot || []), after = rows(printProjection(catalog));
    const changes = { added:0, changed:0, removed:0 };
    for (const [key, value] of after) {
      if (!before.has(key)) changes.added++;
      else if (before.get(key) !== value) changes.changed++;
    }
    for (const key of before.keys()) if (!after.has(key)) changes.removed++;
    const currentFingerprint = fingerprint(catalog, language, proposal, size);
    return { revision:catalog.revision, current:latest?.fingerprint === currentFingerprint, changes,
      editions:list.map(({ snapshot, ...edition }) => ({ ...edition, current:edition.fingerprint === currentFingerprint && edition.proposal === proposal && edition.size === size, legacy:!edition.proposal || !edition.size })) };
  }

  generate(catalog, revision, language, author, proposal = 'actual', size = 'A4') {
    const task = this.queue.then(async () => {
      if (!['es', 'en'].includes(language)) throw Object.assign(new Error('Idioma de impresión no válido.'), { status:400 });
      printOptions(proposal,size);
      if (revision !== catalog.revision) throw Object.assign(new Error('La carta cambió. Actualiza el estado antes de generar.'), { status:409 });
      const copy = structuredClone(catalog);
      const hash = fingerprint(copy, language, proposal, size);
      const existing = (await this.editions()).find((edition) => edition.language === language && edition.fingerprint === hash && edition.proposal === proposal && edition.size === size);
      if (existing) { const { snapshot, ...metadata } = existing; return metadata; }
      const chrome = browserPath();
      if (!chrome) throw Object.assign(new Error('Para generar el PDF instala Chrome o Chromium en este servidor y configura CHROME_EXECUTABLE_PATH.'), { status:503 });
      const edition = { id:randomUUID(), createdAt:new Date().toISOString(), language, proposal, size, revision, author, fingerprint:hash, snapshot:printProjection(copy) };
      let css = await readFile(join(repo, 'preview-src/v2/print.css'), 'utf8');
      for (const font of ['assets/fraunces-print.ttf', 'shared-print/vendor/NotoSans-Regular.ttf']) {
        css = css.replace(`./${font}`, `data:font/ttf;base64,${(await readFile(join(repo, 'preview-src/v2', font))).toString('base64')}`);
      }
      const layoutModule = `data:text/javascript;base64,${Buffer.from(await readFile(join(repo, 'preview-src/v2/print-layout.js'))).toString('base64')}`;
      const logo = await readFile(join(repo, 'snapshot/boccantina.com/preview/assets/boccantina-logo-transparent.png'));
      const texture = await readFile(join(repo, 'preview-src/v2/assets/print-marble-black.png'));
      const body = renderPrintBody(copy, language, `data:image/png;base64,${logo.toString('base64')}`, edition, `data:image/png;base64,${texture.toString('base64')}`);
      const factor={A4:1,A3:Math.SQRT2,A2:2}[size],paper={A4:['210mm','297mm'],A3:['297mm','420mm'],A2:['420mm','594mm']}[size];
      css += size==='A4'?'':`@page{size:${paper.join(' ')};margin:0}@media print{body.print-document{zoom:${factor}}.print-page{width:210mm;height:297mm}}`;
      let browser;
      try {
        browser = await puppeteer.launch({ executablePath:chrome, headless:true, args:process.env.CI ? ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] : ['--disable-gpu'], timeout:60000, dumpio:Boolean(process.env.CI) });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => /^(data:|about:)/.test(request.url()) ? request.continue() : request.abort());
        await page.setContent(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>${css}</style></head><body class="print-document">${body}</body></html>`, { waitUntil:'load' });
        await page.emulateMediaType('print');
        await page.evaluate(async (module) => { const {paginatePrint} = await import(module); await paginatePrint(document.querySelector('.print-menu')); }, layoutModule);
        const pdf = await page.pdf({ width:paper[0], height:paper[1], preferCSSPageSize:false, printBackground:true, displayHeaderFooter:false });
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
