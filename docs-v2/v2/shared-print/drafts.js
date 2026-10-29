import {normalizePrintDesign,printDesignDefaults} from './design.js';

const key=brand=>`${brand}-print-drafts-v3`;
export function loadPrintDrafts(brand){
  try{
    let values=JSON.parse(localStorage.getItem(key(brand))||'[]');
    const seedKey=brand+'-botanical-proposal-v1';
    if(Array.isArray(values)&&!localStorage.getItem(seedKey)){
      values.push({id:brand==='isabella'?'p-71ed913f-b126-44c8-b87c-392837837201':'p-71ed913f-b126-44c8-b87c-392837837202',name:brand==='isabella'?'Oliva · marfil y fotografía':'Reserva · verde y dorado',design:{...printDesignDefaults(brand),template:'botanical',margin:18,gutter:14,logoWidth:70,titleSize:17,bodySize:8.6,itemSpacing:3}});
      savePrintDrafts(brand,values);localStorage.setItem(seedKey,'1');
    }
    if(!Array.isArray(values))return [];
    return values.filter(value=>/^p-[0-9a-f-]{36}$/.test(value?.id||'')&&typeof value.name==='string')
      .slice(0,3).map(value=>({...value,name:value.name.slice(0,60),design:normalizePrintDesign(value.design,brand)}));
  }catch{return [];}
}
export function savePrintDrafts(brand,drafts){localStorage.setItem(key(brand),JSON.stringify(drafts));}
export function createPrintDraft(brand,index){return {id:`p-${crypto.randomUUID()}`,name:`Propuesta ${index}`,design:printDesignDefaults(brand)};}
export function printDraftFields(draft){
  if(!draft)return '';
  const d=draft.design;
  const number=(key,label,min,max,step=1,unit='')=>`<label class="print-editor-field"><span>${label}</span><span class="print-editor-input"><input data-print-design="${key}" type="number" required min="${min}" max="${max}" step="${step}" value="${d[key]}" aria-label="${label}"><small>${unit}</small></span></label>`;
  return `<section class="print-editor" aria-labelledby="print-editor-title"><div class="print-editor-heading"><div><h3 id="print-editor-title">Editar propuesta</h3><p>Los cambios de composición se reflejan en la vista previa y en el PDF.</p></div><button type="button" class="print-delete" data-print-delete>Eliminar propuesta</button></div>
    <label class="print-editor-field print-editor-name"><span>Nombre de la propuesta</span><input data-print-name required maxlength="60" minlength="3" value="${escapeAttribute(draft.name)}"></label>
    <div class="print-editor-grid">
      <label class="print-editor-field"><span>Composición</span><select data-print-design="template"><option value="classic" ${d.template!=='botanical'?'selected':''}>Tipográfica</option><option value="botanical" ${d.template==='botanical'?'selected':''}>Botánica con fotografías</option></select></label>
      <label class="print-editor-field"><span>Columnas de platos</span><select data-print-design="columns"><option value="2" ${d.columns===2?'selected':''}>Dos columnas</option><option value="1" ${d.columns===1?'selected':''}>Una columna</option></select></label>
      ${number('margin','Margen lateral',14,32,1,'mm')}${number('gutter','Separación entre columnas',6,24,1,'mm')}
      ${number('logoWidth','Ancho del logotipo',55,110,1,'mm')}
      <label class="print-editor-field"><span>Alineación del logotipo</span><select data-print-design="logoAlign"><option value="center" ${d.logoAlign==='center'?'selected':''}>Centrado</option><option value="left" ${d.logoAlign==='left'?'selected':''}>Izquierda</option></select></label>
      ${number('titleSize','Tamaño de categorías',12,21,0.5,'pt')}${number('bodySize','Tamaño de descripciones',8,12,0.2,'pt')}${number('itemSpacing','Espacio entre platos',2,8,0.5,'mm')}
      <label class="print-editor-field print-editor-check"><input type="checkbox" data-print-design="ornament" ${d.ornament?'checked':''}> <span>Mostrar marco ornamental</span></label>
    </div><p id="print-editor-message" class="print-editor-message" role="status" aria-live="polite">Propuesta guardada en este navegador.</p></section>`;
}
function escapeAttribute(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function readPrintDraft(root,draft,brand,others=[]){
  root.querySelectorAll('.print-editor [aria-invalid]').forEach(input=>{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');});
  const invalid=(input,message)=>{input?.setAttribute('aria-invalid','true');input?.setAttribute('aria-describedby','print-editor-message');throw new Error(message);};
  const nameInput=root.querySelector('[data-print-name]'),name=nameInput?.value.trim()||'';
  if(name.length<3||name.length>60)invalid(nameInput,'Escribe un nombre de 3 a 60 caracteres.');
  if(others.some(item=>item.id!==draft.id&&item.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))invalid(nameInput,'Ya existe otra propuesta con ese nombre.');
  const design={...draft.design};
  root.querySelectorAll('[data-print-design]').forEach(input=>{
    if(input.type==='number'&&!input.validity.valid){
      const label=input.getAttribute('aria-label');
      invalid(input,input.validity.stepMismatch?`${label}: usa incrementos de ${input.step}.`:`${label}: escribe un valor entre ${input.min} y ${input.max}.`);
    }
    design[input.dataset.printDesign]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
  });
  return {...draft,name,design:normalizePrintDesign(design,brand)};
}
export function printDraftFeedback(root,message,error=false){
  const status=root.querySelector('.print-editor-message');
  if(status){status.setAttribute('role',error?'alert':'status');status.textContent=message;}
}
