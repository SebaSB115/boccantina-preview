# Boccantina — preview local

Copia aislada para maquetado y pruebas visuales de `https://boccantina.com/`.

## Uso

```powershell
npm.cmd install
npm.cmd run serve
```

Abrir `http://localhost:4174/`.

## Variantes de hero para revisión

- Propuesta A: `http://localhost:4174/?hero=a`
- Reservación de Propuesta A: `http://localhost:4174/reservaciones/?hero=a`
- Propuesta B: `http://localhost:4174/?hero=b`
- Administración local de extras: `http://localhost:4174/?admin=extras`
- Carta pública de consulta: `http://localhost:4174/carta/`
- Pedido por mesa: `http://localhost:4174/mesa/?mesa=12`
- Pedido para llevar: `http://localhost:4174/pedido/?tipo=takeaway`
- Pedido registrado en caja: `http://localhost:4174/pedido/?tipo=counter`
- Central de pedidos: `http://localhost:4174/admin/pedidos/`
- Cola operativa de cocina: `http://localhost:4174/admin/cocina/`
- Generador de QR por mesa: `http://localhost:4174/qr-mesas/`
- Portada original: `http://localhost:4174/`

Las propuestas sustituyen los dos sliders superiores únicamente cuando se usa
el parámetro `hero`. En `hero=a`, la revista y los enlaces de menú abren la
carta digital independiente. La portada conserva su función visual y no recibe
pedidos. `hero=b` y la portada original conservan la carta existente.

La reservación de `hero=a` es un flujo demostrativo de tres pasos:
disponibilidad, datos mínimos y revisión. Incluye confirmación y una vista
operativa simuladas; no consulta horarios reales ni envía datos al restaurante.

El panel administrativo de extras es una superficie separada de la carta del
cliente. Permite activar o desactivar extras por plato, añadirlos, quitarlos y
asignar su precio individual. El servidor local comparte esa configuración con
la carta de las mesas; todavía no representa autenticación ni persistencia de
producción.

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
