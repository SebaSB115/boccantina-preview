# Boccantina · versión 2 simple

Esta rama es un espacio de trabajo separado de la versión 1. La aplicación V2 usa un servidor y archivos de datos propios; el servidor anterior y sus datos no intervienen en las rutas de V2.

## Alcance actual

- Carta digital de **consulta**, con categorías, búsqueda, información de productos, precios, imágenes, disponibilidad e idiomas español e inglés.
- Administración privada de categorías y productos: crear, editar, ordenar mediante posición, ocultar, marcar disponibilidad y eliminar con confirmación. Una categoría con productos debe vaciarse o reasignar sus productos antes de eliminarse.
- Carga de imagen JPG, PNG o WebP por categoría o producto, hasta 3 MB. Cuando no hay imagen propia se utiliza la imagen existente del catálogo.
- La carta distingue las fotografías heredadas, que son ilustrativas, de las fotos subidas para un plato. Las imágenes ilustrativas se usan solo como referencia de categoría; el filtro administrativo **Sin foto propia** ayuda a sustituirlas. La foto individual aparece junto al plato después de cargarla y guardar el producto.
- En el preview V2 se incluye **Cachapa** en Entradas como producto de prueba (₡5.000), con su fotografía propia. Los demás platos conservan sus datos e imágenes existentes hasta recibir fotos identificadas para cada producto.
- Cuentas administrativas con un único rol de **Administrador**. Pueden crearse varias cuentas, desactivarlas y renovar su contraseña. No hay permisos por puesto.
- QR de la carta de consulta, descargable en SVG. El enlace se calcula en el servidor.
- Menú físico A4 independiente de la carta digital: portada Boccantina, índice y categorías con composición para papel. Usa el catálogo guardado en español o inglés y permite generar y conservar revisiones PDF desde la administración local.

Los extras por plato no se usan en V2. Las rutas de pedidos, cocina, mesas y reservas del servidor anterior no se sirven desde V2. El código histórico sigue en el repositorio para conservar la versión 1 y sus comprobaciones; no forma parte de la navegación V2.

## Demostración pública de V2

`npm.cmd run build:pages:v2` genera `docs-v2/` a partir de esta rama y del selector en el worktree hermano de Isabella's V2. El flujo `deploy-v2.yml` publica esos archivos al subir `version/2-simple`. El enlace de entrada es <https://sebasb115.github.io/boccantina-preview/central/>.

El acceso `demo-boccantina` / `vista2026` sirve **solo para explorar la interfaz**. No protege archivos ni autentica contra el servidor: GitHub Pages es estático. Los cambios de productos, categorías y cuentas quedan en el navegador de cada visitante; no se comparten ni actualizan la carta oficial. No introduzcas usuarios ni contraseñas reales en esta demostración. Los datos locales de `.preview-data-v2/` nunca se incluyen en `docs-v2/`.

En la demo, **Menú para imprimir → Generar PDF actualizado → Descargar PDF** genera un archivo A4 real desde el catálogo guardado en el navegador. También permite **Vista previa A4** e **Imprimir**. El historial se conserva en IndexedDB al recargar y detecta cambios de contenido. No requiere el servidor de una laptop; tampoco comparte datos entre dispositivos. Descargar los archivos permite conservarlos fuera del navegador.

El motor gratuito y versionado se distribuye desde `isabellas-menu-preview-a/preview-a/shared-print`; consulta el README y `manifest.json` de `preview-src/v2/shared-print`. Las ediciones de esta demo son independientes de las del servidor Node.

## Ejecutar en local

Desde este repositorio:

```powershell
npm.cmd ci
npm.cmd run admin:setup:v2
npm.cmd run serve:v2
```

El alta inicial pide usuario, nombre y contraseña en una terminal interactiva. Si ya existe una cuenta V2, las siguientes se crean desde **Cuentas**. Para una migración local controlada también existe `admin:setup:v2 -- --import-v1-owner` con `BOCCANTINA_V1_AUTH_FILE` apuntando al archivo de acceso anterior; solo lee ese archivo y copia el hash, sin alterar la versión 1. No publiques ese archivo ni `.preview-data-v2`.

- Carta: <http://127.0.0.1:4175/carta/>
- Login: <http://127.0.0.1:4175/admin/login/>
- Administración: <http://127.0.0.1:4175/admin/> (requiere sesión)
- Vista previa del menú físico: <http://127.0.0.1:4175/imprimir/> (requiere sesión)

El archivo de catálogo, las cuentas y las imágenes subidas se guardan en `.preview-data-v2/`, excluido de Git. Se inicia con una copia de las categorías y productos del catálogo existente; después, los cambios de V2 permanecen en su propio almacén. Para una prueba desechable, configura `BOCCANTINA_V2_DATA_DIR` con otro directorio antes de iniciar el servidor.

## Menú físico y revisiones PDF

Desde **Menú para imprimir**, selecciona español o inglés, revisa la vista A4 y pulsa **Generar PDF actualizado**. El PDF y su revisión se archivan en `.preview-data-v2/print-editions/`. Cuando cambian nombres, descripciones, categorías, orden o precios, la edición anterior se conserva y la Central muestra que hace falta generar otra. Los productos y categorías ocultos no se imprimen; la disponibilidad temporal no modifica una edición física. Los precios sin definir muestran «Consultar precio».

La generación PDF requiere Chrome, Chromium o Edge instalado en el servidor Node; si no se detecta automáticamente, configura `CHROME_EXECUTABLE_PATH`. Las ediciones anteriores permanecen disponibles aunque falle una generación. El archivo de revisiones debe incluirse en las copias de respaldo del directorio de datos.

## QR y futura puesta en línea

Sin configuración, el QR apunta a `127.0.0.1:4175`: sirve para revisar la presentación **en el mismo equipo**, no para imprimirlo y entregarlo a clientes. Cuando exista un servidor público protegido con HTTPS, define `BOCCANTINA_V2_PUBLIC_URL=https://tu-dominio.example` antes de iniciar V2. El servidor validará HTTPS y el QR abrirá `/carta/` en ese dominio. La autenticación real y los datos compartidos requieren alojar este servidor Node y un plan de operación, seguridad y copias de respaldo. El servidor Node de V2 sigue siendo local; la demostración estática sí está publicada en GitHub Pages.

## Comprobaciones

```powershell
npm.cmd run check:v2
npm.cmd run check:print:v2
npm.cmd run build:pages:v2
npm.cmd run check:pages:v2
npm.cmd run check:print:pages:v2
npm.cmd run check:admin
npm.cmd run check:catalog-ops
```

`check:v2` usa un directorio temporal y un puerto libre; no modifica `.preview-data-v2/`. `check:admin` y `check:catalog-ops` protegen el comportamiento heredado. Para revisar el diseño, abre carta y administración a 320, 390, 768 y 1440 px; comprueba ambos estilos administrativos, navegación, búsqueda, formularios, imágenes y QR.
