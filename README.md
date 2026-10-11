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
  - `admin/`: panel interno de cuentas, cortesías, consumo de IA y planes;
    reutiliza la sesión de `/cuenta` y sólo entra quien figura en `ADMIN_EMAILS`.
  - `styles.css`: el sistema visual compartido; `inicio.css`, `legal.css`,
    `planes/planes.css`, `descargar/descargar.css`, `cuenta/cuenta.css`,
    `admin/admin.css` y `docs/styles.css` son las hojas propias de cada página.
  - `script.js`: menú móvil, cabecera que se vuelve píldora, apariciones,
    parallax, película con scroll, vídeo de fondo y aurora generativa, todo con
    `prefers-reduced-motion`; `cuenta/cuenta.js`, `admin/admin.js` y
    `descargar/download.js` son los scripts de página.
  - `release-data.js`: selección semver de la última versión completa a partir
    del JSON incluido y la API pública de GitHub. No contiene ninguna versión
    escrita a mano: si no hay datos, la web no anuncia versión y enlaza a las
    versiones publicadas.
  - `_headers`: cabeceras de seguridad y caché de `assets/`.
  - `assets/app/`: capturas reales de pteron 0.7 (1x, `-2x` y `-marco` con el
    marco de ventana real) y `LEEME.md` con su uso; `assets/docs/`: capturas de
    la documentación; `assets/photos/`, `assets/video/`, `assets/atlas/` y
    `assets/arte/`: fotografías, vídeos, baldosas del atlas de asignaturas y
    piezas generativas, con sus licencias en `assets/photos/CREDITOS.md`
    (los créditos visibles van en el pie de cada página y en `/privacidad`).
  - `assets/icons.svg`: sprite de iconos; favicons y `og-pteron-v4.jpg`.
- `src/worker.js`: el Worker. Atiende `/api/*` y reescribe `/docs/:slug` a la
  página de documentación; todo lo demás lo sirven los assets.
  - `src/lib/`: ayudantes HTTP, cliente de Supabase, cliente de Flow, firma y
    verificación de licencias (Ed25519 con Web Crypto) y contabilidad del
    gateway de IA.
  - `src/routes/`: `auth`, `billing`, `activation`, `license`, `account` y `ai`.
  - `/api/*` y `/docs/*` entran siempre por el Worker (`run_worker_first`):
    sin eso, una navegación del navegador a una ruta sin asset la respondería
    la página 404 y el retorno de Flow nunca llegaría.
- `supabase/migrations/`: esquema de perfiles, suscripciones, licencias,
  activaciones, eventos de cobro y uso.
- `tests/`: pruebas con `node --test`, sin red: Supabase, Flow y el proveedor
  de IA se simulan.
- `scripts/`: sincronización de versiones, capturas, comprobaciones y la prueba
  de humo contra `wrangler dev` (`scripts/smoke.mjs`), que cubre lo que las
  pruebas unitarias no ven: URLs limpias, 404, cabeceras y navegaciones reales.
- `wrangler.jsonc`: configuración del Worker, los assets y las variables públicas.
- `design-qa.md`: registro de verificación visual y decisiones de interfaz.

## Sistema visual

Sistema «La hora azul»: fotografía del sur de Chile y timelapses de Atacama al
anochecer, la ventana real de pteron 0.7 como protagonista, baldosas del atlas de
asignaturas (láminas y mapas de dominio público, texturas propias) y movimiento
ligado al scroll. Tokens en `styles.css`: noche (`--night`, `--vault`), papel
(`--paper`, `--snow`), tinta (`--ink`) y ámbar (`--ember`).

Tipografía: **Newsreader** para titulares, **Geist** para interfaz y cuerpo,
**Geist Mono** sólo para datos técnicos. Sin cursivas salvo el wordmark. Sin
píldoras de estado con punto ni avisos con borde izquierdo. Todo asset propio
lleva `?v=<fecha>` para invalidar la caché; al cambiar hojas, scripts o
imágenes se sube la versión en todas las páginas.

Verificación visual: capturas de las nueve páginas a 1440 y 390 px, en claro y
oscuro, con y sin JavaScript y con movimiento reducido; sin desborde
horizontal, sin errores de consola, hooks de los scripts intactos y peso del
inicio por debajo de 2,5 MB. El registro vive en `design-qa.md`.

## Arquitectura

La web estática y la API viven en un único Worker de Cloudflare. Supabase
mantiene sólo metadatos de cuenta y suscripción; los archivos de trabajo
permanecen en el equipo del profesor. Flow gestiona el registro de tarjeta y los
cobros. La aplicación `pteron` recibe un enlace de un solo uso y guarda
localmente una licencia firmada con protección del sistema operativo.

Las URLs públicas de la API no cambiaron con la migración desde Vercel: la
cuenta web, Flow y la aplicación de escritorio siguen llamando a
`/api/auth/*`, `/api/billing/*`, `/api/activation/*`, `/api/license/*`,
`/api/account` y `/api/ai/v1/*`. Las licencias conservan su formato: la firma
Ed25519 que produce Web Crypto es la misma que verifica `node:crypto` en la
aplicación, y una prueba lo comprueba en cada corrida. Las claves públicas
admitidas viven en `src/lib/license.js` (`PUBLIC_KEYS`, por `kid`); la privada
que firma es el secreto `LICENSE_PRIVATE_KEY_PEM` y `LICENSE_KID` dice con cuál.

### Gateway de IA incluida

El proveedor detrás del plan es Anthropic y el modelo lo fija el servidor
(`GATEWAY_MODEL_ID`, hoy `claude-haiku-5-5`); el cliente sólo pide
`pteron-managed` y se identifica con su licencia (ADR-054/055/056 de pteron).

- `POST /api/ai/v1/messages`: la API Messages de Anthropic tal cual. La app
  (pi-ai sobre el SDK oficial) envía la licencia en `x-api-key` y sus betas en
  `anthropic-beta`; el Worker añade la clave real, reemplaza el modelo y
  retransmite el stream byte a byte. Los tokens se contabilizan desde
  `message_start` y `message_delta` (entrada, caché escrita y leída, salida).
- `POST /api/ai/v1/chat/completions`: puente transitorio para la app 0.6.0,
  que habla el formato de chat completions, por la capa compatible con OpenAI
  de Anthropic. Esa capa está pensada para pruebas, no como solución de largo
  plazo: se retira cuando no queden instalaciones 0.6.0.
- `GET /api/ai/v1/models`: el único modelo virtual.

La cuota (`plan_catalog.ai_units_limit`, hoy `null`, sin tope) se aplica en el
chequeo previo comparando lo usado con el tope; la petición que cruza el tope
anota lo que cabe y deja el período lleno. Un 429 del proveedor pasa al cliente
con su cuerpo para que la app reintente; un 401 de la clave propia se traduce a
502 para no confundirse con la licencia.

Proyecto Supabase configurado:

```text
https://swzqblyllbudwbmbcthr.supabase.co
```

Las migraciones ya aplicadas deben conservarse en `supabase/migrations/` y
aplicarse en orden si se prepara otro entorno.

## Administración

`/admin` usa la misma sesión que `/cuenta` y sólo responde a los correos de
`ADMIN_EMAILS`. Muestra el resumen (cuentas, pagos, cortesías, tokens del mes,
licencias vigentes), la lista y el detalle de cada cuenta (suscripciones,
licencias, activaciones, consumo mensual, peticiones de IA y eventos de cobro),
el consumo por mes, por modelo y por cuenta, y el catálogo de planes con su
límite mensual de tokens. Desde el detalle se concede o retira una cortesía
(`provider = comp`), que cancela el plan vigente y emite licencia como un plan
pagado. La API vive en `src/routes/admin.js` y sus pruebas en
`tests/admin.test.js`.

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
- `LICENSE_KID=k2`
- `GATEWAY_MODEL_ID=claude-haiku-5-5`

Los secretos se cargan con `npx wrangler secret put <NOMBRE>` o desde el panel
del Worker, nunca en el repositorio ni en la interfaz del navegador:

- `SUPABASE_PUBLISHABLE_KEY`: clave publicable de Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY`: la usa sólo el Worker para escribir
  suscripciones, eventos y licencias.
- `FLOW_API_KEY` y `FLOW_SECRET_KEY`: credenciales del entorno de Flow que
  corresponda a `FLOW_BASE_URL`.
- `LICENSE_PRIVATE_KEY_PEM`: clave privada de firma (PKCS8) del `kid` que
  indica `LICENSE_KID`; la pública correspondiente debe estar en `PUBLIC_KEYS`
  y en la aplicación de escritorio.
- `ANTHROPIC_API_KEY`: clave de Anthropic del gateway de IA incluida.
- `ADMIN_EMAILS`: correos autorizados para `/admin` y `/api/admin/*`, separados
  por comas. Sin esta variable, la administración responde 503.

Variables opcionales, también como secretos o en `vars`: `FLOW_BASE_URL`
(`https://sandbox.flow.cl/api` durante las pruebas, `https://www.flow.cl/api`
en producción; por defecto sandbox), `FLOW_BASIC_PLAN_ID`, `FLOW_PRO_PLAN_ID`,
y `ANTHROPIC_BASE_URL`.

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

Después del corte conviene revisar `workers_dev` y `preview_urls` en
`wrangler.jsonc`: ambos publican el mismo Worker, con sus secretos, en
`*.workers.dev` y en URLs por versión, fuera de las reglas de WAF o límite de
tasa que tenga el dominio. Sirven para probar antes del corte; luego pueden
apagarse o protegerse con Cloudflare Access.

Despliegue manual desde una máquina autenticada:

```bash
npx wrangler login
npm run deploy
```

## Desarrollo y comprobaciones

```bash
npm ci
npm run dev        # http://localhost:8787 con assets y API
npm run verify     # sintaxis, empaquetado en seco, pruebas y humo contra wrangler dev
```

`npm run dev` necesita `.dev.vars` para la cuenta, Flow y el gateway; sin él,
esas rutas responden 503 con un código que nombra la configuración ausente.
La web estática, la documentación y las descargas funcionan sin secretos.

## Antes del lanzamiento comercial

- Revisar legalmente Privacidad, Términos, prueba con tarjeta y devoluciones.
- Mantener los enlaces de descarga sincronizados con los releases públicos.
- Probar la activación en una instalación limpia de cada plataforma soportada.
- Confirmar las capacidades exactas de Basic y Pro, incluida la cuota de IA.
