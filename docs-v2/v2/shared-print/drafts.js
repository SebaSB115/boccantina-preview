import {normalizePrintDesign,printDesignDefaults} from './design.js';

const key=brand=>`${brand}-print-drafts-v3`;
export function loadPrintDrafts(brand){
  try{
    const values=JSON.parse(localStorage.getItem(key(brand))||'[]');
    if(!Array.isArray(values))return [];
    return values.filter(value=>/^p-[0-9a-f-]{36}$/.test(value?.id||'')&&typeof value.name==='string')
      .slice(0,2).map(value=>({...value,name:value.name.slice(0,60),design:normalizePrintDesign(value.design,brand)}));
  }catch{return [];}
}
export function savePrintDrafts(brand,drafts){localStorage.setItem(key(brand),JSON.stringify(drafts));}
export function createPrintDraft(brand,index){return {id:`p-${crypto.randomUUID()}`,name:`Propuesta ${index}`,design:printDesignDefaults(brand)};}
export function printDraftFields(draft){
  if(!draft)return '';
  const d=draft.design;
  const number=(key,label,min,max,step=1,unit='')=>`<label class="print-editor-field"><span>${label}</span><span class="print-editor-input"><input data-print-design="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${d[key]}" aria-label="${label}"><small>${unit}</small></span></label>`;
  return `<section class="print-editor" aria-labelledby="print-editor-title"><div class="print-editor-heading"><div><h3 id="print-editor-title">Editar propuesta</h3><p>Los cambios de composición se reflejan en la vista previa y en el PDF.</p></div><button type="button" class="print-delete" data-print-delete>Eliminar propuesta</button></div>
    <label class="print-editor-field print-editor-name"><span>Nombre de la propuesta</span><input data-print-name required maxlength="60" minlength="3" value="${escapeAttribute(draft.name)}"></label>
    <div class="print-editor-grid">
      <label class="print-editor-field"><span>Columnas de platos</span><select data-print-design="columns"><option value="2" ${d.columns===2?'selected':''}>Dos columnas</option><option value="1" ${d.columns===1?'selected':''}>Una columna</option></select></label>
      ${number('margin','Margen lateral',14,32,1,'mm')}${number('gutter','Separación entre columnas',6,24,1,'mm')}
      ${number('logoWidth','Ancho del logotipo',55,110,1,'mm')}
      <label class="print-editor-field"><span>Alineación del logotipo</span><select data-print-design="logoAlign"><option value="center" ${d.logoAlign==='center'?'selected':''}>Centrado</option><option value="left" ${d.logoAlign==='left'?'selected':''}>Izquierda</option></select></label>
      ${number('titleSize','Tamaño de categorías',12,21,0.5,'pt')}${number('bodySize','Tamaño de descripciones',8,12,0.2,'pt')}${number('itemSpacing','Espacio entre platos',2,8,0.5,'mm')}
      <label class="print-editor-field print-editor-check"><input type="checkbox" data-print-design="ornament" ${d.ornament?'checked':''}> <span>Mostrar marco ornamental</span></label>
    </div><p class="print-editor-message" role="status" aria-live="polite">Propuesta guardada en este navegador.</p></section>`;
}
function escapeAttribute(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function readPrintDraft(root,draft,brand,others=[]){
  const name=root.querySelector('[data-print-name]')?.value.trim()||'';
  if(name.length<3||name.length>60)throw new Error('Escribe un nombre de 3 a 60 caracteres.');
  if(others.some(item=>item.id!==draft.id&&item.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))throw new Error('Ya existe otra propuesta con ese nombre.');
  const design={...draft.design};
  root.querySelectorAll('[data-print-design]').forEach(input=>{
    design[input.dataset.printDesign]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
  });
  return {...draft,name,design:normalizePrintDesign(design,brand)};
}
