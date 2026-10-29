import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const repo = resolve(import.meta.dirname, '..');
const source = resolve(repo, '../isabellas-menu-preview-a/preview-a/shared-print/engine.js');
const destination = resolve(repo, 'preview-src/v2/shared-print');
const hash = value => createHash('sha256').update(value).digest('hex');
const upstream = await readFile(source, 'utf8');
const designSource=await readFile(resolve(repo,'../isabellas-menu-preview-a/preview-a/shared-print/design.js'),'utf8');
const draftsSource=await readFile(resolve(repo,'../isabellas-menu-preview-a/preview-a/shared-print/drafts.js'),'utf8');
const botanicalFiles=['botanical.js','botanical.css','botanical-definition.js','botanical-assets.js','botanical-serif.ttf'];
const botanicalSources=Object.fromEntries(await Promise.all(botanicalFiles.map(async file=>[file,await readFile(resolve(repo,'../isabellas-menu-preview-a/preview-a/shared-print',file))])));
let engine = upstream;
function replace(from, to) {
  if (engine.split(from).length !== 2) throw new Error('El motor compartido cambió. Revisa la adaptación antes de sincronizar.');
  engine = engine.replace(from, to);
}
replace('return { layout:1, brand, language,', "return { layout:brand === 'boccantina' ? PRINT_DESIGN_VERSION : 1, brand, language,");
replace('return pdf.createPdf(definition(selected(catalog, language, edition.proposal, edition.size, edition.design), edition, image));',
  "return pdf.createPdf(brand === 'boccantina' ? await createPrintDefinition(selected(catalog, language, edition.proposal, edition.size, edition.design), edition, image, pdf) : definition(selected(catalog, language, edition.proposal, edition.size, edition.design), edition, image));");
engine = "import {PRINT_DESIGN_VERSION} from '../print-layout.js';\nimport {createPrintDefinition} from '../print-definition.js';\n" + engine;
const manifest = JSON.parse(await readFile(resolve(destination, 'manifest.json'), 'utf8'));
manifest.adaptation = {script:'scripts/sync-print-design.mjs',upstreamSha256:hash(upstream),design:'boccantina-gold-2'};
manifest.files['engine.js'] = hash(engine);
manifest.files['design.js'] = hash(designSource);
manifest.files['drafts.js'] = hash(draftsSource);
for(const [file,bytes] of Object.entries(botanicalSources))manifest.files[file]=hash(bytes);
if (process.argv.includes('--check')) {
  if (await readFile(resolve(destination, 'engine.js'), 'utf8') !== engine) throw new Error('Ejecuta node scripts/sync-print-design.mjs para actualizar el adaptador de impresión.');
  for (const [file, checksum] of Object.entries(manifest.files)) {
    if (hash(await readFile(resolve(destination, file))) !== checksum) throw new Error('Huella de impresión incorrecta: '+file);
  }
  console.log('Motor compartido y adaptación de Boccantina verificados.');
} else {
  await writeFile(resolve(destination, 'engine.js'), engine);
  await writeFile(resolve(destination, 'design.js'), designSource);
  await writeFile(resolve(destination, 'drafts.js'), draftsSource);
  for(const [file,bytes] of Object.entries(botanicalSources))await writeFile(resolve(destination,file),bytes);
  await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2)+'\n');
  console.log('Adaptación reproducible de impresión actualizada; fuente de Isabella intacta.');
}
