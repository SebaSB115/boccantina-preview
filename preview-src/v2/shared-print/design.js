// Configuración de composición para propuestas creadas por el usuario.
// El diseño vigente no utiliza estos ajustes y conserva su aspecto aprobado.
export const printDesignDefaults = brand => brand === 'boccantina'
  ? {columns:2,margin:20,gutter:12,logoWidth:93,titleSize:15,bodySize:8.8,itemSpacing:4,logoAlign:'center',ornament:true}
  : {columns:2,margin:22,gutter:22,logoWidth:82,titleSize:15,bodySize:9.2,itemSpacing:3.5,logoAlign:'center',ornament:true};
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};

export function normalizePrintDesign(value, brand) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Falta el diseño de la propuesta.');
  const defaults=printDesignDefaults(brand),result={};
  const limits={columns:[1,2],margin:[14,32],gutter:[6,24],logoWidth:[55,110],titleSize:[12,21],bodySize:[8,12],itemSpacing:[2,8]};
  for(const [key,[min,max]] of Object.entries(limits)){
    const number=Number(value[key] ?? defaults[key]);
    if(!Number.isFinite(number)||number<min||number>max||(key==='columns'&&!Number.isInteger(number)))invalid(`Ajuste de impresión no válido: ${key}.`);
    result[key]=number;
  }
  result.logoAlign=value.logoAlign ?? defaults.logoAlign;
  if(!['center','left'].includes(result.logoAlign))invalid('Alineación del logotipo no válida.');
  result.ornament=value.ornament ?? defaults.ornament;
  if(typeof result.ornament!=='boolean')invalid('Marco decorativo no válido.');
  return result;
}

export function normalizePrintSelection(proposal='actual',size='A4',design=null,brand='isabella'){
  if(!['A4','A3','A2'].includes(size))invalid('Tamaño de papel no válido.');
  if(proposal==='actual'){
    if(design != null)invalid('El diseño vigente no admite cambios de composición. Crea una propuesta nueva.');
    return {proposal,size};
  }
  if(!/^p-[0-9a-f-]{36}$/.test(proposal))invalid('Propuesta no válida.');
  return {proposal,size,design:normalizePrintDesign(design,brand)};
}
