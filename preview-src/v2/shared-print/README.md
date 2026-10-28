# Impresión de las demos públicas

Fuente versionada del motor: `isabellas-menu-preview-a/preview-a/shared-print`. Boccantina aplica su diseño de papel mediante `node scripts/sync-print-design.mjs`, que parte del motor original sin modificar Isabella's. El build V2 ejecuta esa adaptación automáticamente; `node scripts/sync-print-design.mjs --check` valida las huellas. `manifest.json` registra la fuente, adaptación y archivos. No editar manualmente `engine.js` ni sincronizarlo desde Isabella sin reaplicar la adaptación.

El diseño de Boccantina está en `../print-layout.js` y `../print.css`. La vista HTML y el PDF local usan esa composición A4. `../print-definition.js` mide esas mismas páginas y conserva texto y ornamentos vectoriales en el PDF de navegador. El logotipo transparente oficial se usa sin alteración. El fondo de mármol es un recurso independiente generado para esta edición; ver `../assets/PRINT-ASSETS.md`. Fraunces se incrusta como TTF estático de peso 400, derivado del WOFF2 local bajo su licencia OFL.

La huella incluye `PRINT_DESIGN_VERSION`: un PDF del diseño anterior queda en el historial pero no se reutiliza como edición actual. La paginación repite encabezados al continuar una categoría y divide descripciones excepcionalmente largas sin ocultar contenido. La última hoja se equilibra por categorías conservando el orden de lectura.

El adaptador de cada restaurante lee su catálogo del navegador. El módulo genera PDF A4 con pdfmake 0.3.11 (MIT), fuentes Noto Sans (OFL) y Times estándar. No usa servicios de pago, servidores locales, fotografías privadas ni credenciales. Los archivos de Noto Sans provienen de `https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans` y conservan su licencia.

La carga del motor y las fuentes solo ocurre al generar, previsualizar o imprimir. Las ediciones PDF y su proyección de contenido se guardan juntas en IndexedDB, en bases separadas por restaurante. La huella incluye idioma, contenido visible, orden y URL de carta; excluye la disponibilidad temporal. Los cambios posteriores conservan el PDF anterior. El precio pendiente permanece explícito y las variantes conservan sus precios.

## Límites de la demostración

No es autenticación real ni almacenamiento compartido. Otro dispositivo no verá estas ediciones. Al limpiar los datos del sitio se pierde el historial; los PDF descargados permanecen en el equipo. No se debe introducir información privada. La API Node y sus permisos/archivos privados no se modifican.

La impresión abre el visor PDF del navegador con una acción de impresión. Algunos navegadores móviles exigen usar su opción Compartir/Imprimir. No se elude el diálogo del sistema ni se envía nada a una impresora sin la intervención del usuario.

## Comprobaciones

`node scripts/check-browser-print.mjs --both` desde Isabella's ejecuta las dos demos bajo un servidor estático aislado: login, PDF descargado, historial tras recargar, edición de precio, ES/EN, vista previa, acción de impresión y anchos 320/390/768/1440. Los artefactos se guardan en una carpeta temporal, nunca en los datos reales. `check:static` y `check:print:pages:v2` verifican además las rutas publicadas de cada repositorio.
