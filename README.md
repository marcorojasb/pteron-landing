# pteron — landing y cuenta

Sitio público de `pteron`, con la cuenta web para autenticación, planes,
registro de tarjeta y activación de licencias en la aplicación de escritorio.
Todo se despliega en Cloudflare: la web como assets estáticos y la API como un
Worker, desde este repositorio en GitHub.

## Contenido

- `public/`: la web tal como se publica. Cloudflare la sirve directamente, con
  URLs limpias y sin barra final.
  - `index.html`: landing principal.
  - `planes/index.html`: planes, precios y funcionamiento de las licencias.
  - `cuenta/`: cuenta web, acceso por enlace mágico, checkout y activación.
  - `descargar/`: descargas por plataforma y clave pública de firmas.
  - `docs/`: documentación en una sola página; `docs/data/releases.json` es el
    catálogo de versiones que mantiene el workflow.
  - `styles.css` y `cuenta/styles.css`: sistema visual responsive.
  - `script.js` y `cuenta/cuenta.js`: interacción del sitio y de la cuenta.
  - `release-data.js`: selección semver de la última versión completa a partir
    del JSON incluido y la API pública de GitHub. No contiene ninguna versión
    escrita a mano: si no hay datos, la web no anuncia versión y enlaza a las
    versiones publicadas.
  - `_headers`: cabeceras de seguridad y caché de `assets/`.
  - `assets/`: imágenes, vídeos, favicons y recursos públicos.
- `src/worker.js`: el Worker. Atiende `/api/*` y reescribe `/docs/:slug` a la
  página de documentación; todo lo demás lo sirven los assets.
  - `src/lib/`: ayudantes HTTP, cliente de Supabase, cliente de Flow, firma y
    verificación de licencias (Ed25519 con Web Crypto) y contabilidad del
    gateway de IA.
  - `src/routes/`: `auth`, `billing`, `activation`, `license`, `account` y `ai`.
- `supabase/migrations/`: esquema de perfiles, suscripciones, licencias,
  activaciones, eventos de cobro y uso.
- `tests/`: pruebas con `node --test`, sin red: Supabase, Flow y el proveedor
  de IA se simulan.
- `scripts/`: sincronización de versiones, capturas y comprobaciones.
- `wrangler.jsonc`: configuración del Worker, los assets y las variables públicas.
- `design-qa.md`: registro de verificación visual y decisiones de interfaz.

## Sistema visual

La landing sigue la gramática visual de la aplicación (`pteron/docs/INTERFAZ.md`):

| Token | Valor | Uso |
| --- | --- | --- |
| Blue | `#0F2238` | Texto, acciones dominantes |
| Sky | `#496A8E` | Texto secundario |
| Gold | `#C9A261` | Sólo decoración (reglas, foco, numerales) |
| Sand | `#E6D8C0` | Bordes de controles y tarjetas |
| Ivory | `#F6F2EC` | Fondo de página |

Tipografía: **IBM Plex Serif** para títulos, **IBM Plex Sans** para interfaz y
cuerpo, wordmark en `Iowan Old Style` / `Baskerville`. Controles: dominante
relleno Blue; secundario píldora con borde Sand; discreto sólo texto. El oro no
se usa en estados interactivos.

## Arquitectura

La web estática y la API viven en un único Worker de Cloudflare. Supabase
mantiene sólo metadatos de cuenta y suscripción; los archivos de trabajo
permanecen en el equipo del profesor. Flow gestiona el registro de tarjeta y los
cobros. La aplicación `pteron` recibe un enlace de un solo uso y guarda
localmente una licencia firmada con protección del sistema operativo.

Las URLs públicas de la API no cambiaron con la migración desde Vercel: la
cuenta web, Flow y la aplicación de escritorio siguen llamando a
`/api/auth/*`, `/api/billing/*`, `/api/activation/*`, `/api/license/*`,
`/api/account` y `/api/ai/v1/*`. Las licencias conservan su formato y su
clave: la firma Ed25519 que produce Web Crypto es la misma que verifica
`node:crypto` en la aplicación, y una prueba lo comprueba en cada corrida.

Proyecto Supabase configurado:

```text
https://swzqblyllbudwbmbcthr.supabase.co
```

Las migraciones ya aplicadas deben conservarse en `supabase/migrations/` y
aplicarse en orden si se prepara otro entorno.

## Versiones públicas

El workflow `sync-pteron-releases.yml` actualiza `public/docs/data/releases.json`
a partir de los releases publicados. Una versión sólo pasa a ser la actual
cuando su matriz de artefactos está completa. En el navegador,
`release-data.js` combina ese JSON con la API pública de GitHub y conserva un
fallback local. Cada commit del workflow en `main` despliega el sitio de nuevo.

Los HTML cargan el CSS y JavaScript compartidos con un parámetro `?v=` para
evitar que un archivo antiguo de la caché reemplace los enlaces actuales. Ese
valor es una revisión del sitio, no la versión de pteron: sube cuando se
modifica `styles.css` o alguno de los JavaScript compartidos, y no cambia al
publicar una versión nueva del producto.

## Variables y secretos

Las variables públicas viven en `wrangler.jsonc`:

- `PUBLIC_SITE_URL=https://pteron.patagua.dev`
- `SUPABASE_URL=https://swzqblyllbudwbmbcthr.supabase.co`
- `LICENSE_KID=k1`

Los secretos se cargan con `npx wrangler secret put <NOMBRE>` o desde el panel
del Worker, nunca en el repositorio ni en la interfaz del navegador:

- `SUPABASE_PUBLISHABLE_KEY`: clave publicable de Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY`: la usa sólo el Worker para escribir
  suscripciones, eventos y licencias.
- `FLOW_API_KEY` y `FLOW_SECRET_KEY`: credenciales del entorno de Flow que
  corresponda a `FLOW_BASE_URL`.
- `LICENSE_PRIVATE_KEY_PEM`: clave privada de firma (PKCS8); su clave pública
  ya está incluida en la aplicación de escritorio.
- `GATEWAY_UPSTREAM_API_KEY`: clave del proveedor detrás del gateway de IA.

Variables opcionales, también como secretos o en `vars`: `FLOW_BASE_URL`
(`https://sandbox.flow.cl/api` durante las pruebas, `https://www.flow.cl/api`
en producción; por defecto sandbox), `FLOW_BASIC_PLAN_ID`, `FLOW_PRO_PLAN_ID`,
`GATEWAY_UPSTREAM_BASE_URL` y `GATEWAY_UPSTREAM_MODEL_ID`.

Para desarrollo local, copia `.dev.vars.example` a `.dev.vars`; ese archivo
está ignorado por Git.

## Despliegue

El Worker se despliega desde GitHub con la integración Git de Cloudflare
(Workers Builds): cada push a `main` publica producción y cada rama recibe una
URL de previsualización. Configuración del proyecto en el panel:

1. Crear el Worker desde el repositorio `marcorojasb/pteron-landing`, rama de
   producción `main`, comando de build vacío y comando de deploy
   `npx wrangler deploy`.
2. Cargar los secretos listados arriba.
3. En Supabase Auth, mantener como Site URL `https://pteron.patagua.dev/cuenta`
   y permitir ese destino como URL de redirección. Las URLs de previsualización
   no sirven para el enlace mágico salvo que se añadan ahí.
4. En Flow, probar primero con sandbox: registro de tarjeta, callback,
   suscripción Basic con siete días de prueba, cancelación y callback de pago.
5. Al momento del corte, asignar el dominio `pteron.patagua.dev` al Worker
   desde Custom Domains; Cloudflare reemplaza el CNAME anterior. Hasta
   entonces el despliegue anterior sigue respondiendo.
6. Antes de cobrar, cambiar las credenciales y `FLOW_BASE_URL` al entorno de
   producción, confirmar los precios publicados y revisar las condiciones de
   devolución.
7. Definir la cuota de IA antes de habilitar capacidad adicional; el esquema
   deja `ai_units_limit` como `null` hasta tomar esa decisión.

El gateway de IA retransmite respuestas largas del proveedor; el plan Workers
Paid evita el tope de CPU del plan gratuito en esas peticiones.

Despliegue manual desde una máquina autenticada:

```bash
npx wrangler login
npm run deploy
```

## Desarrollo y comprobaciones

```bash
npm ci
npm run dev        # http://localhost:8787 con assets y API
npm run verify     # sintaxis, empaquetado en seco del Worker y pruebas
```

`npm run dev` necesita `.dev.vars` para la cuenta, Flow y el gateway; sin él,
esas rutas responden 503 con un código que nombra la configuración ausente.
La web estática, la documentación y las descargas funcionan sin secretos.

## Antes del lanzamiento comercial

- Revisar legalmente Privacidad, Términos, prueba con tarjeta y devoluciones.
- Mantener los enlaces de descarga sincronizados con los releases públicos.
- Probar la activación en una instalación limpia de cada plataforma soportada.
- Confirmar las capacidades exactas de Basic y Pro, incluida la cuota de IA.
