import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const folder=resolve(import.meta.dirname,'../preview-src/v2/shared-print');
export async function inlineBotanicalLayout(layout){
  const assets=await readFile(resolve(folder,'botanical-assets.js'),'utf8');
  let code=(await readFile(resolve(folder,'botanical.js'),'utf8')).replace("import {botanicalAssets} from './botanical-assets.js';",assets);
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  return layout.replace("from './shared-print/botanical.js';",`from '${url}';`);
}
export async function inlineBotanicalCss(css){
  let style=await readFile(resolve(folder,'botanical.css'),'utf8');
  for(const [url,file] of [['./botanical-serif.ttf','botanical-serif.ttf'],['./vendor/NotoSans-Regular.ttf','vendor/NotoSans-Regular.ttf']])style=style.replace(url,'data:font/ttf;base64,'+(await readFile(resolve(folder,file))).toString('base64'));
  return css.replace(/@import url\('[^']*botanical.css'\);/,style);
}
