# Boccantina — preview local

Copia aislada para maquetado y pruebas visuales de `https://boccantina.com/`.

## Uso

```powershell
npm.cmd install
npm.cmd run serve
```

Abrir `http://localhost:4174/`.

Para regenerar el snapshot público:

```powershell
npm.cmd run mirror
```

## Límites de seguridad

- El repositorio no contiene `wp-config.php`, base de datos, credenciales, pedidos, usuarios ni backups.
- Los formularios y conexiones dinámicas quedan bloqueados en el snapshot.
- `reference/wordpress/themes/` es una referencia de código para maquetado; el contenido de Elementor vive originalmente en la base de datos y se conserva visualmente en `snapshot/`.
- No existe despliegue automático ni remoto configurado.
