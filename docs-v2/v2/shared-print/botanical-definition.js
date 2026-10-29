import {renderBotanical,paginateBotanical,botanicalArtwork} from './botanical.js';
import {botanicalAssets} from './botanical-assets.js';
let stylesheet;
const point = px => px * 72 / 96;
const color = css => '#'+css.match(/\d+/g).slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
const paperScale = size => ({A4:1,A3:Math.SQRT2,A2:2})[size] || 1;
function scaleNode(value, factor, key = '') {
  if (Array.isArray(value)) return value.map(item => scaleNode(item, factor, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name,item]) => [name,scaleNode(item,factor,name)]));
  return typeof value === 'number' && ['fontSize','width','height','fit','x','y','x1','x2','y1','y2','lineWidth','characterSpacing','padding','margin'].includes(key) ? value * factor : value;
}
function loadStyles(){
  return stylesheet ||= new Promise((resolve,reject)=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./botanical.css',import.meta.url).href;
    link.onload=resolve;link.onerror=()=>{stylesheet=null;link.remove();reject(new Error('No se pudo cargar el diseño del menú impreso.'));};
    document.head.append(link);
  });
}
// Measure the same A4 page used by Chromium, preserving selectable PDF text.
function linesOf(element,paper){
  const range=document.createRange(), walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT), lines=[];
  const style=getComputedStyle(element),bounds=element.getBoundingClientRect();let node;
  while((node=walker.nextNode())){
    for(let i=0;i<node.length;i++){
      range.setStart(node,i);range.setEnd(node,i+1);const rect=range.getBoundingClientRect();if(!rect.width)continue;
      let line=lines.at(-1);if(!line||Math.abs(line.top-rect.top)>2){line={text:'',left:rect.left,top:rect.top};lines.push(line);}line.text+=node.textContent[i];
    }
  }
  return lines.filter(l=>l.text.trim()).map(l=>({
    text:style.textTransform==='uppercase'?l.text.trimEnd().toLocaleUpperCase():l.text.trimEnd(),
    font:style.fontFamily.includes('BotanicalSerif')?'BotanicalSerif':'NotoSans',fontSize:point(parseFloat(style.fontSize)),color:color(style.color),
    absolutePosition:{x:point(l.left-paper.left),y:point(bounds.top-paper.top+l.top-lines[0].top)},noWrap:true,margin:0
  }));
}
export async function createBotanicalDefinition(snapshot,edition,logo,pdf,brand){
  if(!snapshot.groups.length)throw new Error('No hay productos visibles para imprimir. Revisa el catálogo.');
  await loadStyles();const texture=botanicalAssets[brand].texture,font=new URL('./botanical-serif.ttf',import.meta.url).href;
  pdf.addFonts({BotanicalSerif:{normal:font,bold:font,italics:font,bolditalics:font}});
  const host=document.createElement('div');host.innerHTML=renderBotanical(snapshot,brand,logo);
  const menu=host.firstElementChild;menu.classList.add('bot-measure');document.body.append(menu);
  try{
    const pages=await paginateBotanical(menu), content=[];
    pages.forEach((page,index)=>{
      content.push({text:' ',fontSize:1,margin:0,...(index?{pageBreak:'before'}:{})});
      const paper=page.getBoundingClientRect(),image=page.querySelector('.bot-masthead img').getBoundingClientRect();
      content.push({image:logo,width:point(image.width),height:point(image.height),absolutePosition:{x:point(image.left-paper.left),y:point(image.top-paper.top)}});
      for(const element of page.querySelectorAll('h2,h3,strong,.bot-dish p,.bot-variant span,.bot-chapter>span,.bot-footer p,.bot-footer>span,.bot-masthead p'))content.push(...linesOf(element,paper));
      for(const photo of page.querySelectorAll('.bot-photo')){
        const rect=photo.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=canvas.height=600;
        const ctx=canvas.getContext('2d');ctx.beginPath();ctx.arc(300,300,300,0,Math.PI*2);ctx.clip();
        const side=Math.min(photo.naturalWidth,photo.naturalHeight);ctx.drawImage(photo,(photo.naturalWidth-side)/2,(photo.naturalHeight-side)/2,side,side,0,0,600,600);
        content.push({image:canvas.toDataURL('image/png'),width:point(rect.width),height:point(rect.height),absolutePosition:{x:point(rect.left-paper.left),y:point(rect.top-paper.top)}});
      }
      for(const head of page.querySelectorAll('.bot-chapter')){const r=head.getBoundingClientRect();content.push({canvas:[{type:'line',x1:point(r.left-paper.left),x2:point(r.right-paper.left),y1:point(r.bottom-paper.top),y2:point(r.bottom-paper.top),lineWidth:.5,lineColor:brand==='isabella'?'#917240':'#d0b37b'}],absolutePosition:{x:0,y:0}});}
      const columns=page.querySelector('.bot-columns');
      if(columns.children.length===2){const r=columns.getBoundingClientRect(),x=point(r.left-paper.left+r.width/2);content.push({canvas:[{type:'line',x1:x,x2:x,y1:point(r.top-paper.top),y2:point(r.bottom-paper.top),lineWidth:.3,lineColor:brand==='isabella'?'#b7a783':'#6d6548'}],absolutePosition:{x:0,y:0}});}

    });
    const factor=paperScale(snapshot.size);
    const background={stack:[{image:'ivory',width:841.89,height:595.28,absolutePosition:{x:0,y:0}},{svg:botanicalArtwork(brand==='boccantina',snapshot.design?.ornament!==false),width:841.89,height:595.28,absolutePosition:{x:0,y:0}}]};
    return {
      pageSize:snapshot.size || 'A4',pageOrientation:'landscape',pageMargins:0,
      info:{title:(brand==='isabella'?'Isabella’s':'Boccantina')+' · '+(snapshot.language==='en'?'Printed menu':'Menú impreso'),author:brand==='isabella'?'Isabella’s':'Boccantina',subject:'Revision '+(edition.version||edition.revision)},
      images:{ivory:texture},
      background:()=>scaleNode(background,factor),
      defaultStyle:{font:'NotoSans',fontSize:9.2*factor,color:'#39352e'},content:scaleNode(content,factor)
    };
  }finally{menu.remove();}
}
