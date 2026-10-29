import {createBotanicalDefinition} from './shared-print/botanical-definition.js';
import {renderPrintBody, paginatePrint, paperArtwork} from './print-layout.js';

let stylesheet;
function loadStyles() {
  return stylesheet ||= new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./print.css', import.meta.url).href;
    link.onload = resolve;
    link.onerror = () => { stylesheet = null; link.remove(); reject(new Error('No se pudo cargar el diseño de impresión.')); };
    document.head.append(link);
  });
}
const pt = pixels => pixels * 72 / 96;
const hexColor = value => '#' + (value.match(/\d+/g) || []).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
const paperScale = size => ({A4:1,A3:Math.SQRT2,A2:2})[size] || 1;
function scaleNode(value, factor, key = '') {
  if (Array.isArray(value)) return value.map(item => scaleNode(item, factor, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name,item]) => [name,scaleNode(item,factor,name)]));
  return typeof value === 'number' && ['fontSize','width','height','fit','x','y','x1','x2','y1','y2','lineWidth','characterSpacing','padding','margin'].includes(key) ? value * factor : value;
}

// Extract actual browser line breaks at A4, then retain vector text in the PDF.
// Local Chromium and the hosted browser therefore paginate the same content.
function linesOf(element, sheet) {
  const range = document.createRange(), walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines = [], style = getComputedStyle(element), bounds = element.getBoundingClientRect();
  let node;
  while ((node = walker.nextNode())) {
    for (let offset = 0; offset < node.length; offset++) {
      range.setStart(node, offset); range.setEnd(node, offset + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width) continue;
      let line = lines.at(-1);
      if (!line || Math.abs(line.top - rect.top) > 2) {
        line = {text:'', left:rect.left, top:rect.top}; lines.push(line);
      }
      line.text += node.textContent[offset];
    }
  }
  return lines.filter(line => line.text.trim()).map(line => ({
    text:style.textTransform === 'uppercase' ? line.text.trimEnd().toLocaleUpperCase() : line.text.trimEnd(),
    font:style.fontFamily.includes('PrintSerif') ? 'PrintSerif' : 'NotoSans',
    fontSize:pt(parseFloat(style.fontSize)),
    color:hexColor(style.color),
    characterSpacing:style.letterSpacing === 'normal' ? 0 : pt(parseFloat(style.letterSpacing)),
    absolutePosition:{x:pt(line.left - sheet.left), y:pt(bounds.top - sheet.top + line.top - lines[0].top)},
    noWrap:true, margin:0
  }));
}

export async function createPrintDefinition(snapshot, edition, logo, pdf) {
  if(snapshot.design?.template==='botanical')return createBotanicalDefinition(snapshot,edition,logo,pdf,'boccantina');
  await loadStyles();
  const response = await fetch(new URL('./assets/print-marble-black.png', import.meta.url));
  if (!response.ok) throw new Error('No se pudo cargar el fondo del menú impreso.');
  const textureBlob = await response.blob();
  const texture = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
    reader.readAsDataURL(textureBlob);
  });
  const serif = new URL('./assets/fraunces-print.ttf', import.meta.url).href;
  pdf.addFonts({PrintSerif:{normal:serif,bold:serif,italics:serif,bolditalics:serif}});
  const catalog = {
    revision:edition.version,
    categories:snapshot.groups.map((group, position) => ({id:group.id, es:group.title, en:group.title, position})),
    products:snapshot.groups.flatMap(group => group.items.map((item, position) => ({
      id:item.id, category:group.id, nameEs:item.name, nameEn:item.name,
      descEs:item.description, descEn:item.description, price:item.price, position
    })))
  };
  const container = document.createElement('div');
  container.innerHTML = renderPrintBody(catalog, snapshot.language, logo, edition, texture);
  const menu = container.firstElementChild;
  menu.classList.add('print-measure'); document.body.append(menu);
  try {
    const pages = await paginatePrint(menu), content = [];
    pages.forEach((page, index) => {
      content.push({text:' ',fontSize:1,margin:0,...(index ? {pageBreak:'before'} : {})});
      const sheet = page.getBoundingClientRect(), image = page.querySelector('.print-masthead img').getBoundingClientRect();
      content.push({image:logo,width:pt(image.width),height:pt(image.height),absolutePosition:{x:pt(image.left-sheet.left),y:pt(image.top-sheet.top)}});
      for (const element of page.querySelectorAll('h1,h2,h3,strong,.print-product p,.chapter-head span,.print-footer span,.print-edition,.print-empty')) {
        content.push(...linesOf(element, sheet));
      }
      for (const head of page.querySelectorAll('.chapter-head')) {
        const rect = head.getBoundingClientRect();
        content.push({canvas:[{type:'line',x1:pt(rect.left-sheet.left),x2:pt(rect.right-sheet.left),y1:pt(rect.bottom-sheet.top),y2:pt(rect.bottom-sheet.top),lineWidth:0.56,lineColor:'#74603a'}],absolutePosition:{x:0,y:0}});
      }
    });
    const factor=paperScale(snapshot.size);
    const background={stack:[{image:'marble',width:595.28,height:841.89,absolutePosition:{x:0,y:0}},...(snapshot.design?.ornament===false?[]:[{svg:paperArtwork(snapshot.design?.columns!==1),width:595.28,height:841.89,absolutePosition:{x:0,y:0}}])]};
    return {
      info:{title:'Boccantina · '+(snapshot.language === 'en' ? 'Printed menu' : 'Menú impreso'),author:'Boccantina'},
      pageSize:snapshot.size || 'A4',pageMargins:0,
      images:{marble:texture},
      background:()=>scaleNode(background,factor),
      defaultStyle:{font:'NotoSans',fontSize:8.8*factor,color:'#eee6d6'},
      content:scaleNode(content,factor)
    };
  } finally { menu.remove(); }
}
