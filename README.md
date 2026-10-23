# Boccantina — preview local

**[Estado de la entrega del 23 de octubre de 2026](ESTADO_2026-10-23.md)**: alcance, comprobaciones y límites del preview.

Copia aislada para maquetado y pruebas visuales de `https://boccantina.com/`.

## Uso

```powershell
npm.cmd install
npm.cmd run admin:setup
npm.cmd run serve
```

Abrir `http://localhost:4174/`.

La administración local se abre en `http://localhost:4174/admin/login/`. Usa el usuario configurado mediante `npm.cmd run admin:setup` y su contraseña; repetir el comando permite cambiarlos. La contraseña se almacena como hash en `.preview-data/admin-auth.json`, fuera de Git.

El servidor local exige sesión para pedidos, cocina, reservaciones, QR, extras y API administrativas, incluso al abrir una URL directa. La cuenta propietaria de Boccantina conserva acceso completo a **Administración · Personal**. Allí se asignan los puestos Mesero, Cajero, Recepción y Cocina, combinables; el propietario puede añadir o restringir permisos avanzados por operación en cada cuenta. Las cuentas anteriores con casillas por vista conservan sus accesos hasta editarlas. Los usuarios se guardan en `.preview-data/central-users.json`, fuera de Git; para cambiar esa ubicación usa `BOCCANTINA_USERS_FILE`. Editar o desactivar una cuenta revoca sus sesiones. Hay botón para salir, registro local en `.preview-data/security-audit.jsonl` y prueba automatizada con `npm.cmd run check:admin`.

La cuenta propietaria está separada de las cuentas del equipo y no puede editarse desde Personal. `npm.cmd run admin:setup` permite recuperar su acceso desde la terminal local; cambiar su contraseña invalida las sesiones propietarias anteriores. El mesero con perfil vinculado ve todas las mesas del salón y puede iniciar atención en una disponible; solo consulta pedidos de las mesas que atiende. Si aún no tiene un perfil vinculado, puede solicitar ayuda a recepción desde «Mis mesas». Cocina recibe las comandas sin importes ni datos de pago. Los cambios de cuentas, correcciones de cobro y precios requieren un inicio de sesión de los últimos 15 minutos.

### Atención de mesas en el preview local

- El propietario configura la cantidad de mesas y conserva en exclusiva la generación e impresión de QR. La cantidad se guarda en `restaurant-system.json`; comienza en 12 para una base de prueba nueva.
- El mesero entra en «Mis mesas» desde `/qr-mesas/`, puede tomar una mesa sin responsable ni reservación y registrar una comanda desde «Agregar comanda». Recepción puede asignar o reasignar a un mesero con cuenta activa vinculada. El servidor decide la asignación y rechaza reclamaciones concurrentes.
- Cada sesión de mesa abierta tiene un `accountId`; cada comanda sigue siendo un pedido independiente, asociado a ese identificador y al empleado que la creó. Los pedidos QR se suman a la misma sesión. Cocina recibe cada comanda nueva por separado, sin reenviar las anteriores.
- El mesero solicita el cierre; cajero o propietario registran los cobros y liberan la mesa solo cuando ya no hay pedidos activos ni importes pendientes. La mesa sigue ocupada hasta esa liberación explícita.
- `npm.cmd run check:admin` comprueba permisos, concurrencia, comandas, QR, reservas y cierre con archivos temporales. `node scripts/qa-salon-preview.mjs` abre un entorno visual desechable con usuarios de prueba; al detenerlo se eliminan sus datos. Estos comandos no usan `.preview-data/`.

Esta implementación es un preview local, no un servicio listo para producción: las sesiones están en memoria, el registro de auditoría es un archivo local y el servidor HTTP no ofrece HTTPS. La carta pública todavía acepta importes de pedidos enviados por el cliente; antes de un despliegue real hay que calcular y validar precios únicamente en el servidor, revisar límites de acceso por turno y endurecer el seguimiento público de pedidos. La versión estática en GitHub Pages permanece como demo pública sin protección; no se deben usar credenciales reales allí. Para acceso privado remoto se requiere backend alojado con HTTPS.

## Variantes de hero para revisión

- Propuesta A: `http://localhost:4174/?hero=a`
- Reservación de Propuesta A: `http://localhost:4174/reservaciones/?hero=a`
- Propuesta B: `http://localhost:4174/?hero=b`
- Administración local de extras: `http://localhost:4174/admin/extras/` (el acceso anterior `/?admin=extras` sigue disponible)
- Carta pública de consulta: `http://localhost:4174/carta/`
- Pedido por mesa: `http://localhost:4174/mesa/?mesa=12`
- Pedido para llevar: `http://localhost:4174/pedido/?tipo=takeaway`
- Pedido registrado en caja: `http://localhost:4174/pedido/?tipo=counter`
- Central de pedidos: `http://localhost:4174/admin/pedidos/`
- Cola operativa de cocina: `http://localhost:4174/admin/cocina/`
- Generador de QR por mesa: `http://localhost:4174/qr-mesas/`
- Portada original: `http://localhost:4174/`

**Iteración visual (20/10/2026):** la carta usa el azul casi negro y dorado del logotipo y de la web oficial. La portada breve deja ver productos en la primera pantalla. Las categorías tienen una fotografía panorámica baja; los platos forman una cuadrícula compacta en escritorio y una banda horizontal en móvil. Se conservan la búsqueda y los recorridos de pedido. Urbanist para titulares e Inter para lectura se alojan localmente bajo licencia OFL. La rama `preview/hero-a` publica el snapshot de demostración en GitHub Pages; el servidor privado local permanece separado.

Las propuestas sustituyen los dos sliders superiores únicamente cuando se usa
el parámetro `hero`. En `hero=a`, la portada editorial y los enlaces de menú abren la
carta digital independiente. La portada conserva su función visual y no recibe
pedidos. `hero=b` y la portada original conservan la carta existente.

La reservación de `hero=a` es un flujo demostrativo de tres pasos:
disponibilidad, datos mínimos y revisión. Incluye confirmación y una vista
operativa simuladas; no consulta horarios reales ni envía datos al restaurante.

El panel `/admin/extras/` permite buscar todos los productos de la carta,
crear productos locales y reutilizar extras de una biblioteca con nombre en
español e inglés, precio general y estado activo. Las asignaciones conservan
los precios especiales antiguos por plato. `/admin/disponibilidad/` permite
marcar productos como disponibles, agotados hoy o no disponibles. Ambos paneles
requieren el permiso `boccantina.extras`; el servidor guarda los cambios en
`.preview-data/` y valida la disponibilidad de productos y extras al recibir
una orden nueva. No se cambian las comandas ni los importes históricos.

“Agotado hoy” requiere reactivación manual: este preview no tiene horario de
apertura o día operativo configurado. “No disponible” permanece hasta cambio
manual. La visibilidad editorial de un producto creado localmente es distinta
de esos estados. Estas funciones siguen siendo parte del preview local; no
constituyen integración de producción.

## Sistema de pedidos por mesa

El sistema local separa la web pública de la operación del restaurante:

1. `/carta/` permite consultar la carta, pero no ordenar.
2. Cada QR abre `/mesa/?mesa=N` y conserva el número de mesa.
3. El cliente personaliza los productos, envía el pedido y puede solicitar al
   mesero o pedir ayuda.
4. `/pedido/?tipo=takeaway` identifica pedidos para llevar y
   `/pedido/?tipo=counter` permite registrar pedidos tomados en caja.
   La referencia, el código de retiro y el seguimiento se conservan en el
   navegador; también pueden recuperarse manualmente desde otro dispositivo.
5. `/admin/pedidos/` recibe todos los canales, permite asignar meseros a mesas
   activas, registrar pagos, administrar reservaciones web/manuales y generar
   comandas térmicas.
6. `/admin/cocina/` ordena las comandas cronológicamente y permite filtrarlas
   por mesa, para llevar o caja.
7. `/qr-mesas/` muestra un selector responsive con una sola vista previa. Las
   mesas disponibles se muestran activas; las mesas con una sesión o pedido
   abierto quedan bloqueadas hasta que administración las libera.
8. Una mesa nunca queda disponible automáticamente. La central permite
   liberarla solo cuando no tenga pedidos activos ni consumos pendientes y el
   personal confirme que el cliente se retiró.
9. Los pedidos para llevar incluyen ayuda automática para consultar estado,
   retiro y pago; si hace falta, la solicitud se envía a la central asociada a
   la referencia del pedido.

Durante la prueba, pedidos, solicitudes y configuración compartida de extras se
guardan en `.preview-data/`, excluido de Git. El servidor escucha en la red
local para poder probar desde un teléfono conectado al mismo Wi-Fi.

Este es un prototipo operativo local. Antes de exponerlo a internet requiere
autenticación para el panel, base de datos administrada, HTTPS, backups,
monitoreo y configuración de la impresora térmica del restaurante.

## Demo compartible en GitHub Pages

La rama `preview/hero-a` publica automáticamente el snapshot en GitHub Pages.
En ese dominio, pedidos, mesas, meseros y reservaciones usan una base de prueba
en `localStorage`: los datos permanecen solamente en el navegador que realiza
la demostración, no se comparten entre dispositivos y no llegan al restaurante.
El panel muestra de forma visible `DEMO GITHUB · NO PRODUCCIÓN`.

Esta modalidad permite revisar el flujo completo sin conectar la web ni la
operación real. No sustituye el backend, la autenticación ni la base de datos
necesarios para una implementación productiva.

Para regenerar el snapshot público:

```powershell
npm.cmd run mirror
```

## Límites de seguridad

- El repositorio no contiene `wp-config.php`, base de datos, credenciales, pedidos, usuarios ni backups.
- El snapshot de GitHub Pages utiliza datos simulados y aislados en el navegador.
- `reference/wordpress/themes/` es una referencia de código para maquetado; el contenido de Elementor vive originalmente en la base de datos y se conserva visualmente en `snapshot/`.
- El workflow de GitHub Pages se ejecuta solo desde `preview/hero-a`; no modifica `main` ni `boccantina.com`.
