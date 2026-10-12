# pteron — landing y cuenta

Sitio público de `pteron`, con la cuenta web para autenticación, planes,
registro de tarjeta y activación de licencias en la aplicación de escritorio.
Todo se despliega en Cloudflare: la web como assets estáticos y la API como un
Worker, desde este repositorio en GitHub.

## Contenido

- `public/`: la web tal como se publica. Cloudflare la sirve directamente, con
  URLs limpias y sin barra final.
  - `index.html`: el inicio. Láminas antiguas que flotan; al bajar, cada una se
    da vuelta y aterriza sobre su figura en hojas armadas con el código de pteron.
    Siguen «Cómo se pide» (la ventana de pteron), la hoja en sus dos versiones,
    el aviso de datos de estudiantes y la descarga.
  - `planes/index.html`: planes, precios y funcionamiento de las licencias.
  - `cuenta/`: cuenta web, acceso por enlace mágico, checkout y activación.
  - `descargar/`: descargas por plataforma, firmas y clave pública.
  - `docs/`: documentación en una sola página; `docs/data/releases.json` es el
    catálogo de versiones que mantiene el workflow.
  - `admin/`: panel interno de cuentas, cortesías, consumo de IA y planes;
    reutiliza la sesión de `/cuenta` y sólo entra quien figura en `ADMIN_EMAILS`.
  - `marca/`: la marca, el icono, los colores (con su valor en fotocopia), la
    letra, las láminas con su figura y la voz, con los archivos para descargar.
  - `privacidad.html` (con los créditos), `terminos.html` y `404.html`.
  - `styles.css`: el sistema compartido (letras, colores, botones, la esquina,
    el índice y el colofón); `inicio.css`, `legal.css`, `planes/planes.css`,
    `descargar/descargar.css`, `cuenta/cuenta.css`, `admin/admin.css` y
    `docs/styles.css` son las hojas propias de cada página.
  - `script.js`: el índice que sale de la esquina doblada (los capítulos de la
    página, marcados con `data-capitulo`, y las páginas del sitio), Descargar con la plataforma
    del visitante, la versión publicada, el año y los botones de copiar;
    `inicio.js` mueve las láminas y las hojas, y `cuenta/cuenta.js`,
    `admin/admin.js`, `descargar/download.js` y `docs/app.js` son los scripts
    de página.
  - `pteron-ventana.js`: las plantillas y la secuencia de la ventana de pteron,
    con el reconocimiento del pedido y el aviso de datos de estudiantes de la
    app. `pteron-app.css` son las reglas de la app acotadas a `.pt-app` y
    `pteron-hoja.css` las de las hojas de Write acotadas a `.pteron-document`;
    las dos se generan (ver Scripts) y no se editan a mano.
  - `release-data.js`: selección semver de la última versión completa a partir
    del JSON incluido y la API pública de GitHub. No contiene ninguna versión
    escrita a mano: si no hay datos, la web no anuncia versión y enlaza a las
    versiones publicadas.
  - `_headers`: cabeceras de seguridad y caché de `assets/`.
  - `assets/atlas/`: recortes de láminas de dominio público y piezas propias;
    sus créditos están en `/privacidad#creditos`. `assets/app/` y
    `assets/docs/`: capturas reales de pteron para la documentación.
  - `assets/fonts/`: Archivo, Outfit, Playwrite CL e IBM Plex, con sus
    licencias; `assets/marca.svg`: el contorno de la marca «pteron» (Outfit con
    la esquina de la «t» doblada); `assets/marca/`: la marca en azul, blanco y
    tinta y el icono, para descargar; `assets/pt-icons.svg`: los iconos Lucide
    de la app; los iconos `*-v4` y `favicon-v5-*` (la «p» de la marca sobre el azul) y
    `assets/og/`: una imagen para compartir por página.
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
  Además, los generadores del sitio:
  - `sitio.mjs` escribe la esquina, el colofón y el índice en cada página
    (`--revisar` sólo comprueba que estén al día; lo usa una prueba).
  - `pteron-hojas.mjs <ruta de pteron>` arma las hojas del inicio con el código
    de Write de pteron y las figuras de su motor, y escribe las láminas, las
    hojas y `pteron-hoja.css`, y los pares lámina y figura de `/marca`. Necesita el repositorio de pteron y sus paquetes
    (jsdom, @xmldom/xmldom, temml y mathml2omml) en su `node_modules` o en la
    carpeta que indique `PTERON_DEPS`. Los materiales y las láminas viven en
    `scripts/pteron-hojas/materiales.mjs`.
  - `marca-trazado.py` escribe `assets/marca.svg`: compone «pteron» en Outfit
    y le hace los dos cortes. Necesita fontTools, uharfbuzz y skia-pathops; no
    son dependencias del sitio, porque el SVG queda en el repositorio.
  - `marca-dibujos.mjs` es el único lugar donde se dibuja: la marca en cada
    color, con y sin su espacio libre, la «p» del icono (también en la
    cuadrícula de macOS) y los contenedores `.ico` e `.icns`.
  - `marca.mjs` escribe con esos dibujos la marca para descargar y el icono del
    sitio y del kit; con `--png` (y `PLAYWRIGHT` apuntando a Playwright) también
    los PNG, el `.ico` y el `.icns` (`--revisar` comprueba los SVG).
  - `kit.mjs` arma el kit del lenguaje visual: copia los archivos del sitio y de
    `kit/archivos`, genera `tokens.css`, `tokens.ts` y la tabla de contrastes
    desde `kit/tokens.json` (la fuente única de colores y medidas), escribe el
    manifiesto con sus sumas y empaqueta dos .zip de bytes fijos: el público,
    `assets/marca/pteron-marca-1.0.0.zip`, que ofrece `/marca`, y el completo
    en `dist/`, con los parches para la app de `kit/app` (fuera del
    repositorio). `--revisar` comprueba que el público esté al día.
  - `kit-letras.py` convierte Archivo a TTF para instalar y copia la Outfit
    de pteron (`--outfit`, desde pteron-design en la app), fijada por su suma
    (`--revisar` comprueba las dos); necesita fontTools y brotli.
  - `og.mjs` fotografía las imágenes para compartir con la tarjeta de
    `scripts/og/tarjeta.html` (la marca, el título y un dato en el cuadrado del
    centro; a los lados, una lámina y su reverso) y deja al día `og:image`,
    `twitter:image` y el texto alternativo de cada página. También necesita
    `PLAYWRIGHT`.
  - `pteron-ventana.mjs` escribe la ventana en reposo con las plantillas de
    `pteron-ventana.js`, y `pteron-app-css.mjs` extrae y acota las reglas de la
    app a `pteron-app.css`.
- `wrangler.jsonc`: configuración del Worker, los assets y las variables públicas.
- `design-qa.md`: registro de verificación visual y decisiones de interfaz.

## Sistema visual

Sistema «La lámina y la figura». La página es una hoja sobre la mesa de pteron:
el gris `--mesa` (#E9EDF1) es el que pone la app detrás de sus hojas, y la tinta
(`--tinta`) y el azul (`--azul`) son los de sus materiales. El amarillo lápiz
(`--lapiz`) es sólo para la acción principal.

Una sola familia para el sitio, **Archivo** (variable en ancho y peso), con la
jerarquía hecha por ancho y peso. La marca «pteron» no se escribe con una letra:
se dibuja con su contorno (`assets/marca.svg`), sobre Outfit, la letra de las
figuras de pteron, que en la web no compone texto. Las hojas usan las letras de
los materiales de pteron (Outfit y Playwrite CL) y la ventana las de la app (IBM
Plex). Sin cursivas.

Sin barra superior: la esquina de arriba a la derecha está doblada y debajo
asoma la hoja azul del índice, con los capítulos de la página y las páginas del
sitio; Descargar flota abajo a la derecha y el colofón lleva lo mismo al final
de cada página. La marca y sus reglas están en `/marca`; el icono es la «p» de
la marca en blanco sobre el azul. Si se muestra la interfaz de pteron, es la de la app: la ventana se
dibuja con sus reglas (`pteron-app.css`) y las hojas con el código de Write.

Movimiento: las láminas flotan y se dan vuelta al pasar el puntero (o al
tocarlas); con el desplazamiento vuelan a sus figuras mientras las hojas se
imprimen. Con `prefers-reduced-motion` todo queda quieto y legible (sin
transiciones), y sin JavaScript la página muestra las hojas y la ventana
terminadas.

Todo asset propio lleva `?v=<revisión>` para invalidar la caché (`assets/` se
sirve como inmutable); al cambiar hojas, scripts o imágenes se sube la revisión
en todas las páginas. Verificación visual: capturas de las páginas a 1440 y
390 px, con y sin JavaScript y con movimiento reducido; sin desborde horizontal
ni errores de consola. El registro vive en `design-qa.md`.

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
