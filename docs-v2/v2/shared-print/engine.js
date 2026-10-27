// Fuente compartida de impresión de las demos. No sustituye la API privada.
const assets = new URL('./vendor/', import.meta.url);
let loading;
function loadScript(name) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, assets).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('No se pudo cargar el motor PDF. Comprueba la conexión y vuelve a intentar.')); };
    document.head.append(script);
  });
}
async function renderer() {
  if (!loading) loading = (async () => {
    await loadScript('pdfmake.min.js');
    await loadScript('vfs_fonts.js');
    await loadScript('Times.js');
    window.pdfMake.addFonts({NotoSans:{normal:new URL('NotoSans-Regular.ttf',assets).href,bold:new URL('NotoSans-SemiBold.ttf',assets).href,italics:new URL('NotoSans-Regular.ttf',assets).href,bolditalics:new URL('NotoSans-SemiBold.ttf',assets).href}});
    return window.pdfMake;
  })().catch(error => { loading = null; throw error; });
  return loading;
}
const tx = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.es || '';
const ordered = (values, key) => [...values].sort((a, b) => (a.position || 0) - (b.position || 0) || String(a[key] || '').localeCompare(String(b[key] || '')));
export function project(catalog, brand, language) {
  if (!['es', 'en'].includes(language)) throw new Error('Selecciona español o inglés.');
  const groups = brand === 'isabella'
    ? catalog.categories.filter(c => c.visible !== false).map(c => ({ id:c.id, title:tx(c.title, language), items:c.items.filter(i => i.visible !== false).map(i => ({ id:i.id, name:tx(i.name, language), description:tx(i.description, language), price:i.price, options:(i.options || []).map(o => ({ label:tx(o.label, language), price:o.price })), addon:i.addon ? { label:tx(i.addon.label, language), price:i.addon.price } : null })) }))
    : ordered(catalog.categories.filter(c => c.visible !== false), 'es').map(c => ({ id:c.id, title:language === 'en' ? c.en || c.es : c.es, items:ordered(catalog.products.filter(i => i.visible !== false && i.category === c.id), 'nameEs').map(i => ({ id:i.id, name:language === 'en' ? i.nameEn || i.nameEs : i.nameEs, description:language === 'en' ? i.descEn || i.descEs : i.descEs, price:i.price, options:[], addon:null })) }));
  return { layout:1, brand, language, groups:groups.filter(g => g.items.length), publicUrl:catalog.settings?.publicUrl || '' };
}
async function digest(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}
function database(brand) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${brand}-demo-print-v1`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('editions', { keyPath:'id' });
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('El navegador no permite guardar las ediciones. Habilita el almacenamiento del sitio e inténtalo de nuevo.'));
  });
}
async function stored(brand, store, id) {
  const db = await database(brand);
  try {
    return await new Promise((resolve, reject) => {
      const request = id === undefined ? db.transaction(store).objectStore(store).getAll() : db.transaction(store).objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('No se pudo leer el historial de este navegador.'));
    });
  } finally { db.close(); }
}
async function save(brand, edition, blob) {
  const db = await database(brand);
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['editions', 'files'], 'readwrite');
      transaction.objectStore('editions').put(edition);
      transaction.objectStore('files').put(blob, edition.id);
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(new Error('No hay espacio para archivar el PDF. Las ediciones anteriores se conservan. Libera espacio y vuelve a intentar.'));
    });
  } finally { db.close(); }
}
function differences(before, after) {
  const rows = snapshot => new Map((snapshot?.groups || []).flatMap((g, index) => [[`c:${g.id}`, JSON.stringify([g.title, index])], ...g.items.map((i, order) => [`p:${i.id}`, JSON.stringify([g.id, order, i])])]));
  const old = rows(before), next = rows(after), changes = { added:0, changed:0, removed:0 };
  for (const [id, value] of next) { if (!old.has(id)) changes.added++; else if (old.get(id) !== value) changes.changed++; }
  for (const id of old.keys()) if (!next.has(id)) changes.removed++;
  if ((before?.publicUrl || '') !== after.publicUrl) changes.changed++;
  return changes;
}
async function logoData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo cargar el logotipo para la edición. Vuelve a intentar.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el logotipo.'));
    reader.readAsDataURL(blob);
  });
}
export function definition(snapshot, edition, logo) {
  const isabella = snapshot.brand === 'isabella', en = snapshot.language === 'en';
  const name = isabella ? 'Isabella’s' : 'Boccantina';
  const accent = isabella ? '#643447' : '#87641f';
  const ink = isabella ? '#382b2d' : '#242124';
  const price = p => p == null ? (en ? 'Ask for price' : 'Consultar precio') : `₡${new Intl.NumberFormat('en-US').format(p)}`;
  const rules = { hLineWidth:i => i === 1 ? 0.5 : 0, vLineWidth:() => 0, hLineColor:() => accent, paddingLeft:i => i ? 12 : 0, paddingRight:i => i ? 0 : 12, paddingTop:() => 7, paddingBottom:() => 9 };
  function item(value) {
    const row = (label, amount) => ({ columns:[{ text:label, width:'*' }, { text:price(amount), width:68, alignment:'right', bold:true }], columnGap:8, margin:[0, 5, 0, 0], fontSize:10 });
    return { stack:[
      { columns:[{ text:value.name, font:'Times', fontSize:16, width:'*' }, ...(value.options.length ? [] : [{ text:price(value.price), fontSize:10, bold:true, alignment:'right', width:68 }])], columnGap:8 },
      ...(value.description ? [{ text:value.description, fontSize:10, lineHeight:1.25, margin:[0, 5, 0, 3] }] : []),
      ...value.options.map(o => row(o.label, o.price)),
      ...(value.addon ? [row(value.addon.label, value.addon.price)] : [])
    ], margin:[0, 4, 0, 8] };
  }
  const content = [
    { image:logo, fit:[240, 84], alignment:'center', margin:[0, 52, 0, 42] },
    { text:en ? 'At the table' : 'A la mesa', font:'Times', fontSize:44, color:accent, alignment:'center' },
    { text:isabella ? (en ? 'Italian cooking · Menu' : 'Cocina italiana · La carta') : (en ? 'Food & wine · Printed menu' : 'Cocina y vinos · Carta para el local'), alignment:'center', margin:[0, 10, 0, 30] },
    { table:{ widths:['*', '*'], body:Array.from({length:Math.ceil(snapshot.groups.length / 2)}, (_, i) => [0, 1].map(j => {
      const group = snapshot.groups[i * 2 + j];
      return { text:group ? `${String(i * 2 + j + 1).padStart(2, '0')}   ${group.title}` : '', margin:[8, 5, 8, 5], fontSize:10 };
    })) }, layout:'noBorders' },
    { text:en ? 'Prices in Costa Rican colones.' : 'Precios en colones costarricenses.', alignment:'center', fontSize:9, margin:[0, 24, 0, 4] },
    ...(isabella ? [{ text:en ? 'Taxes included; 10% service not included.' : 'Incluyen impuestos; no incluyen 10 % de servicio.', alignment:'center', fontSize:9 }] : []),
    ...(/^https:\/\//.test(snapshot.publicUrl) ? [{ qr:snapshot.publicUrl, fit:72, alignment:'center', margin:[0, 14, 0, 4] }, {text:en ? 'Explore our digital menu' : 'Consulta la carta digital', alignment:'center', fontSize:8}] : []),
    { text:`${new Date(edition.createdAt).toLocaleDateString(en ? 'en-US' : 'es-CR')} · ${en ? 'Revision' : 'Revisión'} ${edition.version}`, alignment:'center', fontSize:9, color:accent, margin:[0, 18, 0, 0] }
  ];
  snapshot.groups.forEach((group, index) => {
    // A category can continue across pages. No fixed-height boxes or clipped text.
    const rows = [];
    for (let i = 0; i < group.items.length; i += 2) rows.push([item(group.items[i]), group.items[i + 1] ? item(group.items[i + 1]) : '']);
    const compactRows = !group.items.some(i => JSON.stringify(i).length > 1800);
    content.push({ ...(isabella || index === 0 ? {pageBreak:'before'} : {margin:[0, 20, 0, 0]}), table:{ headerRows:1, keepWithHeaderRows:compactRows ? 1 : 0, dontBreakRows:compactRows, widths:['*', '*'], body:[
      [{ colSpan:2, stack:[{text:`${name.toUpperCase()} · ${String(index + 1).padStart(2, '0')}`, fontSize:8, color:accent, characterSpacing:1}, {text:group.title, font:'Times', fontSize:30, color:accent, margin:[0, 6, 0, 12]}] }, ''], ...rows
    ] }, layout:rules });
  });
  if (!snapshot.groups.length) throw new Error('No hay productos visibles para imprimir. Revisa el catálogo.');
  return {
    pageSize:'A4', pageMargins:[48, 44, 48, 48],
    info:{title:`${name} · ${en ? 'Printed menu' : 'Menú impreso'}`, author:name, subject:`${en ? 'Revision' : 'Revisión'} ${edition.version}`},
    defaultStyle:{font:'NotoSans', fontSize:11, color:ink},
    footer:(page, total) => ({text:`${name} · ${page} / ${total}`, alignment:'center', fontSize:8, color:accent, margin:[0, 18, 0, 0]}),
    content
  };
}
export function createPrintService({ brand, readCatalog, logo }) {
  let queue = Promise.resolve();
  const revision = catalog => catalog.version ?? catalog.revision;
  const all = async () => (await stored(brand, 'editions')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  async function status(language) {
    const catalog = await readCatalog(), snapshot = project(catalog, brand, language), fingerprint = await digest(snapshot), list = await all();
    const latest = list.find(e => e.language === language);
    const hashes = { [language]:fingerprint };
    for (const lang of ['es', 'en']) if (!hashes[lang]) hashes[lang] = await digest(project(catalog, brand, lang));
    return { version:revision(catalog), revision:revision(catalog), current:list.some(e => e.fingerprint === fingerprint), changes:differences(latest?.snapshot, snapshot), editions:list.map(({snapshot:_, ...e}) => ({...e, current:e.fingerprint === hashes[e.language]})) };
  }
  async function documentFor(language, catalog, edition) {
    const [pdf, image] = await Promise.all([renderer(), logoData(logo)]);
    return pdf.createPdf(definition(project(catalog, brand, language), edition, image));
  }
  function generate(version, language) {
    const task = queue.then(async () => {
      const catalog = await readCatalog();
      if (revision(catalog) !== version) throw new Error('La carta cambió. Actualiza el estado antes de generar.');
      const snapshot = project(catalog, brand, language), fingerprint = await digest(snapshot), existing = (await all()).find(e => e.fingerprint === fingerprint);
      if (existing) return existing;
      const edition = {id:fingerprint, fingerprint, snapshot, language, version, revision:version, author:'Demostración · este navegador', createdAt:new Date().toISOString()};
      const document = await documentFor(language, catalog, edition), blob = await document.getBlob();
      if (await digest(project(await readCatalog(), brand, language)) !== fingerprint) throw new Error('La carta cambió durante la generación. Actualiza el estado y vuelve a intentar.');
      await save(brand, edition, blob);
      return edition;
    });
    queue = task.catch(() => {});
    return task;
  }
  async function download(id) {
    const [edition, blob] = await Promise.all([stored(brand, 'editions', id), stored(brand, 'files', id)]);
    if (!blob || !edition) throw new Error('Esta edición no está disponible en este navegador. Genera el PDF de nuevo.');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${brand}-menu-${edition.language}-r${edition.version}.pdf`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function preview(language, popup, print = false) {
    if (!popup) throw new Error('Permite abrir pestañas para ver e imprimir el menú. También puedes descargar el PDF.');
    try {
      popup.opener = null;
      popup.document.title = 'Preparando menú para imprimir';
      popup.document.body.textContent = 'Preparando la carta completa…';
      const catalog = await readCatalog(), doc = await documentFor(language, catalog, {version:revision(catalog), createdAt:new Date().toISOString()});
      if (print) await doc.print(popup); else await doc.open(popup);
    } catch (error) { popup.close(); throw error; }
  }
  return { status, generate, download, preview };
}
