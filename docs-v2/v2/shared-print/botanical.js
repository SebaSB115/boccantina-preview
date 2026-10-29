// Composición fotográfica compartida. El catálogo se proyecta, nunca se modifica.
import {botanicalAssets} from './botanical-assets.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function botanicalArtwork(dark=false,ornament=true){
  const gold=dark?'#c4a369':'#a68a50';
  const sprig='<path d="M0 95Q25 42 82 0M14 66Q-3 45 10 28Q29 41 14 66M28 47Q15 24 31 12Q46 30 28 47M45 30Q41 8 60 2Q65 22 45 30M20 57Q39 58 50 41Q29 36 20 57M39 35Q59 39 74 22Q52 16 39 35M58 17Q79 22 95 8Q77-2 58 17"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1123" height="794" viewBox="0 0 1123 794"><rect width="1123" height="794" fill="${dark?'#08201a':'#fcf7e9'}" opacity="${dark?'.86':'.78'}"/>${ornament?`<g fill="none" stroke="${gold}" stroke-width="1"><g transform="translate(18 18)">${sprig}</g><g transform="translate(1105 776) rotate(180)">${sprig}</g><g transform="translate(1105 18) scale(-1 1)">${sprig}</g><g transform="translate(18 776) scale(1 -1)">${sprig}</g><path d="M130 31H443M680 31H993M130 763H993" opacity=".6"/></g>`:''}</svg>`;
}
export function renderBotanical(snapshot,brand,logo){
  const d=snapshot.design,en=snapshot.language==='en',assets=botanicalAssets[brand];
  const price=n=>n==null?(en?'Ask for price':'Consultar precio'):'₡'+Number(n).toLocaleString('en-US');
  const variant=v=>`<div class="bot-variant"><span>${esc(v.label)}</span><strong>${esc(price(v.price))}</strong></div>`;
  return `<main class="botanical-menu ${brand==='isabella'?'isabella-print':'print-menu'}" data-brand="${brand}" data-language="${snapshot.language}" style="--bot-scale:1;--bot-columns:${d.columns};--bot-margin:${d.margin}mm;--bot-gap:${d.gutter}mm;--bot-logo:${d.logoWidth}mm;--bot-title:${d.titleSize}pt;--bot-body:${d.bodySize}pt;--bot-spacing:${d.itemSpacing}mm;--bot-align:${d.logoAlign==='left'?'flex-start':'center'}">
  <template data-bot-source>${snapshot.groups.map(g=>`<section class="bot-group" data-group="${esc(g.id)}" ${assets.photos[g.id]?'data-photo="true"':''}>${assets.photos[g.id]?`<img class="bot-photo" src="${assets.photos[g.id]}" alt="${esc(g.title)}">`:''}<header class="bot-chapter"><h2>${esc(g.title)}</h2></header><div class="bot-items">${g.items.map(i=>`<article class="bot-dish" data-product-id="${esc(i.id)}"><div class="bot-line"><h3>${esc(i.name)}</h3>${i.options?.length?'':`<strong>${esc(price(i.price))}</strong>`}</div>${i.description?`<p>${esc(i.description)}</p>`:''}${(i.options||[]).map(variant).join('')}${i.addon?variant(i.addon):''}</article>`).join('')}</div></section>`).join('')}</template>
  <template data-bot-paper><div class="bot-page"><section class="bot-sheet"><div class="bot-art"><img src="${assets.texture}" alt="">${botanicalArtwork(brand==='boccantina',d.ornament)}</div><header class="bot-masthead"><img src="${esc(logo)}" alt="${brand==='isabella'?'Isabella’s':'Boccantina'}"><p>${en?'THE MENU':'LA CARTA'}</p></header><div class="bot-columns"><div class="bot-column"></div>${d.columns===2?'<div class="bot-column"></div>':''}</div><footer class="bot-footer"><p>${en?'Prices in Costa Rican colones · Illustrative category photographs':'Precios en colones costarricenses · Fotografías ilustrativas de las categorías'}</p><span data-page-number></span></footer></section></div></template></main>`;
}
export async function paginateBotanical(menu){
  await Promise.all([document.fonts.load('16px BotanicalSerif'),document.fonts.load('16px BotanicalSans')]);
  menu.querySelectorAll('.bot-page').forEach(p=>p.remove());
  const source=[...menu.querySelector('[data-bot-source]').content.children],paper=menu.querySelector('[data-bot-paper]');
  const en=menu.dataset.language==='en';let columns=[],column,section,index=-1;
  const fits=()=>column.scrollHeight<=column.clientHeight+1;
  function next(){
    if(++index>=columns.length){const p=paper.content.firstElementChild.cloneNode(true);menu.append(p);columns=[...p.querySelectorAll('.bot-column')];index=0;}
    column=columns[index];
  }
  function group(original,continued=false){
    section=original.cloneNode(true);section.querySelector('.bot-items').replaceChildren();
    if(continued){const note=document.createElement('span');note.textContent=en?'continued':'continuación';section.querySelector('header').append(note);}
    column.append(section);
  }
  function continuation(original,originalGroup){
    next();group(originalGroup,true);const item=original.cloneNode(true);
    item.querySelectorAll('p,.bot-variant,strong').forEach(n=>n.remove());
    item.querySelector('h3').textContent+=en?' · continued':' · continuación';
    section.querySelector('.bot-items').append(item);return item;
  }
  next();
  for(const originalGroup of source){
    // A short category remains together when it fits an entire fresh column.
    const probe=originalGroup.cloneNode(true);column.append(probe);
    const moveWhole=!fits()&&probe.previousElementSibling&&probe.offsetHeight<=column.clientHeight*.45;
    probe.remove();if(moveWhole)next();
    group(originalGroup);let first=true;
    for(const original of originalGroup.querySelectorAll('.bot-dish')){
      let item=original.cloneNode(true);section.querySelector('.bot-items').append(item);
      if(!fits()&&(section.previousElementSibling||!first)){
        item.remove();if(first)section.remove();next();group(originalGroup,!first);section.querySelector('.bot-items').append(item);
      }
      if(!fits()){
        const variants=[...item.querySelectorAll('.bot-variant')];variants.forEach(v=>v.remove());
        while(!fits()){
          const p=item.querySelector('p');if(!p)throw Error('El nombre del plato no cabe. Reduce el tamaño de texto de la propuesta.');
          const words=p.textContent.match(/\S+\s*/g)||[];let low=0,high=words.length;
          while(low<high){const middle=Math.ceil((low+high)/2);p.textContent=words.slice(0,middle).join('');if(fits())low=middle;else high=middle-1;}
          if(!low)throw Error('El plato no cabe. Reduce el tamaño de texto de la propuesta.');
          p.textContent=words.slice(0,low).join('');item=continuation(original,originalGroup);
          const rest=document.createElement('p');rest.textContent=words.slice(low).join('');item.append(rest);
        }
        for(const v of variants){item.append(v);if(!fits()){v.remove();item=continuation(original,originalGroup);item.append(v);if(!fits())throw Error('La variante no cabe en la página.');}}
      }
      first=false;
    }
  }
  const pages=[...menu.querySelectorAll('.bot-sheet')];
  // Balance only whole category blocks: preserve reading order and complete dishes.
  const last=pages.at(-1),[left,right]=last.querySelectorAll('.bot-column');
  const used=c=>c.lastElementChild?c.lastElementChild.offsetTop+c.lastElementChild.offsetHeight:0;
  if(right)for(let n=0;n<source.length;n++){
    const candidate=left.lastElementChild;if(!candidate?.previousElementSibling)break;
    const before=Math.abs(used(left)-used(right));right.prepend(candidate);
    if(right.scrollHeight>right.clientHeight+1||Math.abs(used(left)-used(right))>=before){left.append(candidate);break;}
  }
  pages.forEach((p,i)=>p.querySelector('[data-page-number]').textContent=`${String(i+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`);
  await Promise.all([...menu.querySelectorAll('img')].map(i=>i.decode()));return pages;
}
export function fitBotanical(menu){const update=()=>{menu.style.setProperty('--bot-scale',Math.min(1,menu.clientWidth/(297*96/25.4)));};const o=new ResizeObserver(update);o.observe(menu);update();return()=>o.disconnect();}
