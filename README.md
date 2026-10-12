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
- Portada original: `http://localhost:4174/`

Las propuestas sustituyen los dos sliders superiores únicamente cuando se usa
el parámetro `hero`. Además, `hero=a` reemplaza la carta estática por un menú
interactivo local con carrito, ayuda y demostración del panel del mesero.
`hero=b` y la portada original conservan la carta existente.

La reservación de `hero=a` es un flujo demostrativo de tres pasos:
disponibilidad, datos mínimos y revisión. Incluye confirmación y una vista
operativa simuladas; no consulta horarios reales ni envía datos al restaurante.

El panel administrativo de extras es una superficie separada de la carta del
cliente. En este prototipo guarda la configuración únicamente en el
`localStorage` del navegador: permite activar o desactivar extras por plato,
añadirlos, quitarlos y asignar su precio individual. No representa todavía una
autenticación ni persistencia de producción.

Para regenerar el snapshot público:

```powershell
npm.cmd run mirror
```

## Límites de seguridad

- El repositorio no contiene `wp-config.php`, base de datos, credenciales, pedidos, usuarios ni backups.
- Los formularios y conexiones dinámicas quedan bloqueados en el snapshot.
- `reference/wordpress/themes/` es una referencia de código para maquetado; el contenido de Elementor vive originalmente en la base de datos y se conserva visualmente en `snapshot/`.
- No existe despliegue automático ni remoto configurado.
