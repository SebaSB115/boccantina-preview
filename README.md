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
- Propuesta B: `http://localhost:4174/?hero=b`
- Portada original: `http://localhost:4174/`

Las propuestas solo sustituyen los dos sliders superiores cuando se usa el
parámetro `hero`. El resto de la copia local permanece igual.

Para regenerar el snapshot público:

```powershell
npm.cmd run mirror
```

## Límites de seguridad

- El repositorio no contiene `wp-config.php`, base de datos, credenciales, pedidos, usuarios ni backups.
- Los formularios y conexiones dinámicas quedan bloqueados en el snapshot.
- `reference/wordpress/themes/` es una referencia de código para maquetado; el contenido de Elementor vive originalmente en la base de datos y se conserva visualmente en `snapshot/`.
- No existe despliegue automático ni remoto configurado.
