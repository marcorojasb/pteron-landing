# Pterón — landing page

Landing estática, responsive y lista para desplegar en Vercel.

## Contenido

- `index.html`: landing principal.
- `styles.css`: sistema visual completo.
- `script.js`: navegación móvil, demo interactiva, animaciones y copiar correo.
- `privacidad.html` y `terminos.html`: borradores preliminares para revisión antes del lanzamiento.
- `vercel.json`: URLs limpias, caché de assets y cabeceras de seguridad.
- `assets/`: imágenes optimizadas y favicons.

## Despliegue en Vercel

### Opción A: desde la interfaz de Vercel

1. Descomprime el ZIP.
2. Sube la carpeta a un repositorio GitHub, GitLab o Bitbucket.
3. En Vercel selecciona **Add New → Project** e importa el repositorio.
4. Framework Preset: **Other**.
5. Build Command: déjalo vacío.
6. Output Directory: `.`
7. Despliega.
8. En **Settings → Domains**, agrega `pteron.patagua.dev` y configura el DNS indicado por Vercel.

### Opción B: Vercel CLI

Desde la carpeta:

```bash
vercel
vercel --prod
```

No hay variables de entorno ni servicios externos obligatorios.

## Probar localmente

```bash
python3 -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Antes de publicar comercialmente

- Definir y comunicar cualquier plan pagado antes de activar cobros.
- Revisar legalmente Privacidad y Términos.
- Mantener los enlaces de descarga sincronizados con el canal público de releases.
- Confirmar las capacidades exactas de cada versión de escritorio.
