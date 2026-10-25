# pteron — landing y cuenta

Sitio público de `pteron`, con la cuenta web para autenticación, planes,
registro de tarjeta y activación de licencias en la aplicación de escritorio.
Todo se despliega en Cloudflare: la web como assets estáticos y la API como un
Worker, con `wrangler` desde la rama `main` de este repositorio (ver «Despliegue»).

## Contenido

- `public/`: la web tal como se publica. Cloudflare la sirve directamente, con
  URLs limpias y sin barra final.
  - `index.html`: el inicio. Láminas antiguas que flotan; al bajar, cada una se
    da vuelta y aterriza sobre su figura en hojas armadas con el código de pteron.
    Siguen «Cómo funciona» (la ventana de pteron, con las escenas del recorrido
    de bienvenida de la app: pedir, decidir, crear y guardar), la hoja en sus dos versiones,
    el aviso de datos de estudiantes y la descarga.
  - `planes/index.html`: planes, precios y funcionamiento de las licencias. Cada plan de pago
    parte con «Disponible pronto»; `script.js` pregunta a `GET /api/plans` y muestra «Elegir» sólo
    para el que está a la venta, como `/cuenta`.
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
    `inicio.js` mueve las láminas y las hojas (y, con dos clics seguidos en
    una lámina, abre el recreo: `recreo.js`, que sólo se carga entonces), y
    `cuenta/cuenta.js`,
    `admin/admin.js`, `descargar/download.js` y `docs/app.js` son los scripts
    de página.
  - `pteron-ventana.js`: las plantillas y la secuencia de la ventana de pteron
    (el índice, la Home con la marca, el recuadro, el plan con su decisión, la
    hoja que se escribe y las tarjetas del material), con el reconocimiento del
    pedido y el aviso de datos de estudiantes de la app. `pteron-app.css` son las reglas de la app acotadas a `.pt-app` y
    `pteron-hoja.css` las de las hojas de Write acotadas a `.pteron-document`;
    las dos se generan (ver Scripts) y no se editan a mano.
  - `release-data.js`: selección semver de la última versión completa a partir
    del JSON incluido y la API pública de GitHub. No contiene ninguna versión
    escrita a mano: si no hay datos, la web no anuncia versión y enlaza a las
    versiones publicadas.
  - `_headers`: cabeceras de seguridad y caché de `assets/`. La Content-Security-Policy deja
    correr sólo los scripts del sitio y sus scripts en línea, cada uno con su hash; los estilos
    en línea sí se permiten (las láminas llevan su posición en `style`). Si cambia un script en
    línea, `tests/csp.test.js` dice qué hash poner, y no se usan manejadores `on…=` en línea.
  - `assets/atlas/`: recortes de láminas de dominio público y piezas propias;
    sus créditos están en `/privacidad#creditos`. `assets/app/`: capturas reales
    de pteron para la documentación, con su `LEEME.md`.
  - `assets/fonts/`: Archivo, Outfit, Playwrite CL e IBM Plex, con sus
    licencias; `assets/marca.svg`: el contorno de la marca «pteron» (Outfit con
    la esquina de la «t» doblada); `assets/marca/`: la marca en azul, blanco y
    tinta y el icono, para descargar; `assets/pt-icons.svg`: los iconos Lucide
    de la ventana, los de la app (lo escribe `scripts/pteron-iconos.mjs`); los iconos `*-v4` y `favicon-v5-*` (la «p» de la marca sobre el azul;
    `favicon.ico` y `apple-touch-icon.png` van además en la raíz, sin versión) y
    `assets/og/`: una imagen para compartir por página.
- `src/worker.js`: el Worker. Atiende `/api/*` y reescribe `/docs/:slug` a la
  página de documentación; todo lo demás lo sirven los assets. Su handler
  `scheduled` corre el Cron diario de la sincronización con Flow.
  - `src/lib/`: ayudantes HTTP (con la guarda de host), cliente de Supabase,
    cliente de Flow con lectores tipados, la sincronización con Flow
    (`flow-sync.js`), firma y verificación de licencias (Ed25519 con Web
    Crypto), el saneamiento de las peticiones a la IA incluida
    (`gateway-request.js`), sus unidades por costo (`units.js`), la
    contabilidad del gateway, la versión vigente de los Términos (`terms.js`) y los
    correos al cliente (`correo.js`, `correo-textos.js`).
  - `src/routes/`: `auth`, `billing`, `activation`, `license`, `account`, `ai`,
    `admin` y `health`.
  - `/api/*` y `/docs/*` entran siempre por el Worker (`run_worker_first`):
    sin eso, una navegación del navegador a una ruta sin asset la respondería
    la página 404 y el retorno de Flow nunca llegaría.
- `supabase/esquema.sql`: el esquema completo de la base, en un solo archivo:
  catálogo de planes con precios y cuotas, perfiles, suscripciones, licencias,
  activaciones, eventos de cobro, uso, reservas de IA y sus funciones. No hay
  migraciones ni historial.
- `LANZAR-BASIC.md`: lo que falta hacer a mano, en orden, para que funcione y
  abrir la venta de Basic con IA incluida (Supabase, Cloudflare, Anthropic y
  Flow).
- `LEGAL-PENDIENTE.md`: lo que se decide con abogado o contador antes de vender
  (quién vende, retracto, confirmación escrita, boleta), con borradores;
  `BORRADORES-LEGALES.md` trae los textos, las opciones y las fuentes.
- `tests/`: pruebas con `node --test`, sin red: Supabase, Flow y el proveedor
  de IA se simulan.
- `scripts/`: sincronización de versiones, capturas, comprobaciones y la prueba
  de humo contra `wrangler dev` (`scripts/smoke.mjs`), que cubre lo que las
  pruebas unitarias no ven: URLs limpias, 404, cabeceras y navegaciones reales.
  Además, los generadores del sitio:
  - Los scripts de operación (esquema, Auth, DNS de Resend) están en «Scripts de operación».
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
    `pteron-ventana.js`, `pteron-app-css.mjs` extrae y acota las reglas de la
    app a `pteron-app.css` y `pteron-iconos.mjs` arma `assets/pt-icons.svg` con
    los iconos de lucide-solid del `node_modules` de pteron.
  - `capturas-pteron.mjs <ruta de pteron>` toma las capturas de la documentación
    con el arnés de pteron (sus escenas `PTERON_CAPTURE_SCENE` y la siembra de
    materiales de prueba) sobre una mesa con encargos y archivos de un profesor,
    a 1440 × 880 y escala 2, y les compone el marco de macOS. Necesita pteron
    construido (`npm run build`) con sus paquetes; en Linux, un servidor X
    (`xvfb-run`). El detalle está en `assets/app/LEEME.md`.
- `supabase/correos/`: los correos de Supabase Auth en español (enlace mágico y
  confirmación), que carga `scripts/supabase-auth.mjs`.
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
los materiales de pteron (Outfit y Playwrite CL) y la ventana las de la app
(Archivo, como el sitio, e IBM Plex Mono para lo técnico). Sin cursivas.

Sin barra superior: la esquina de arriba a la derecha está doblada y debajo
asoma la hoja azul del índice, con los capítulos de la página y las páginas del
sitio; Descargar flota abajo a la derecha y el colofón lleva lo mismo al final
de cada página. La marca y sus reglas están en `/marca`; el icono es la «p» de
la marca en blanco sobre el azul. Si se muestra la interfaz de pteron, es la de la app: la ventana se
dibuja con sus reglas (`pteron-app.css`) y las hojas con el código de Write.

Movimiento: las láminas flotan y se dan vuelta al pasar el puntero (o al
tocarlas); con el desplazamiento vuelan a sus figuras mientras las hojas se
imprimen. Con `prefers-reduced-motion` todo queda quieto y legible (sin
transiciones) y la ventana muestra el encargo terminado; sin JavaScript la
página muestra las hojas terminadas y los pasos de «Cómo funciona», sin la
ventana, que necesita el script para escalarse.

El recreo (huevo de pascua): dos clics o dos toques seguidos en una lámina de
la portada. Las letras del titular caen una a una, las láminas se quedan
quietas y `recreo.js` las recorta en piezas de un juego de piezas que caen: cada
lámina deja caer su sobrante y la pieza vuela con su trozo de la obra (la del
doble clic a la cuadrícula; las cuatro siguientes, a «Siguiente»). Cada pieza
nueva lleva la obra de una lámina, siempre al derecho, y las fijas forman un
collage. Sobre la mesa van tres tarjetas: la cuadrícula al centro, la guardada y
el marcador a la izquierda, y las que siguen y los controles a la derecha (en
pantallas táctiles, un costado y botones abajo). Es el juego completo: bolsa de
siete, giros SRS, guardar, fantasma, T-spin, combos y jugadas seguidas. Al
cerrar, las láminas suben a su lugar y las letras vuelven. Con movimiento
reducido el juego se abre de una vez; si el archivo no carga, la portada vuelve
como estaba. El motor del juego es puro y se prueba en `tests/recreo.test.js`,
junto con lo que se dibuja sin documento.

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

La cuenta web, Flow y la aplicación de escritorio llaman a `/api/auth/*`,
`/api/billing/*`, `/api/activation/*`, `/api/license/*`, `/api/account` y
`/api/ai/v1/*`. `/planes` llama a `GET /api/plans`, público y sin sesión: lee
`plan_catalog` con la clave publicable (la política pública muestra los planes
activos y listados) y responde sólo el id y si se vende, con un minuto de caché. La firma Ed25519 de las licencias la produce Web Crypto y la
verifica `node:crypto` en la aplicación; una prueba lo comprueba en cada
corrida. La única clave pública admitida es k2 y vive en `src/lib/license.js`
(`PUBLIC_KEYS`); la privada que firma es el secreto `LICENSE_PRIVATE_KEY_PEM` y
`LICENSE_KID` (`k2`) dice con cuál (sin `LICENSE_KID` no se firma; cada firma se
verifica con su clave pública antes de entregarla). Una licencia con otro `kid`
no se acepta.

Las vistas previas están apagadas (`workers_dev` y `preview_urls` en `false` en
`wrangler.jsonc`): el Worker sólo responde en `pteron.patagua.dev`. Como
defensa adicional, fuera del host de `PUBLIC_SITE_URL` las rutas de cuenta,
cobro, licencia, activación, IA y admin responden 421, así que ninguna otra
dirección cobra, firma ni gasta IA con los secretos de producción.

### Cobro y licencia

Flow es la fuente de verdad del cobro (ADR-177 de pteron). El aviso de pago de
Flow no trae la suscripción: el Worker la lee con `subscription/get` al crearla,
tras cada aviso, al emitir una licencia cerca de su fin (a lo más cada 15
minutos) y en un Cron diario (`17 12 * * *` UTC). Las fechas de Flow son días
del calendario de Chile con el fin incluido; «pagado hasta» es el comienzo del
día siguiente a la última factura pagada, o al fin de la prueba, y se guarda en
`subscriptions.current_period_end`.

- El checkout vende sólo un plan de `plan_catalog` con `for_sale`, toma de ahí
  el precio y la prueba (una por persona), exige aceptar los Términos vigentes
  (`TERMS_VERSION`) y valida el plan de Flow con `plans/get`: si el monto, la
  moneda, el intervalo o el `urlCallback` no calzan, no cobra (503).
- El retorno de la tarjeta reclama el intento una sola vez, siempre redirige a
  `/cuenta?billing=…` y, si no puede guardar la suscripción, la cancela en Flow.
- Si `subscription/create` no responde (red, vencimiento de 10 s o 5xx), la
  suscripción pudo quedar creada en Flow: el intento sigue en
  `subscription_pending` y se anota el evento `subscription_create_uncertain`.
  Pasados 10 minutos, el Cron diario y el siguiente checkout de esa cuenta lo
  concilian con `customer/getSubscriptions`: si Flow tiene una suscripción de
  ese plan que la base no conoce, se anota (`subscription_reconciled`); si no,
  el intento falla (`subscription_create_not_found`) y se puede comprar de
  nuevo. Mientras tanto el checkout responde 409 `checkout_pending`, y
  `/api/admin/salud` cuenta los intentos que llevan más de 10 minutos así.
- La licencia vence en lo pagado más 72 h (sin gracia si se canceló al cierre;
  en una cortesía, su fin), con un tope de 7 días: la app la renueva sola. La
  renovación devuelve además el estado del plan.

### Gateway de IA incluida

El proveedor detrás del plan es Anthropic y el modelo lo fija el servidor
(`GATEWAY_MODEL_ID`, hoy `claude-haiku-5-5`, que debe tener precio conocido en
`src/lib/units.js`); el cliente sólo pide `pteron-managed` y se identifica con
su licencia (ADR-054/055/056 y ADR-177 de pteron).

- `POST /api/ai/v1/messages`: la API Messages de Anthropic, saneada. Pasa sólo
  lo que usa la app (herramientas propias, las betas de pi-ai, `max_tokens`
  hasta 65.536, caché de 5 minutos), con el esfuerzo bajo fijado arriba y en
  los mensajes system y un seudónimo de la cuenta en `metadata.user_id`. El
  cuerpo admite hasta 1.200.000 bytes. Exige una suscripción vigente, reserva
  unidades con `begin_ai_request` (hasta 3 en vuelo por cuenta), retransmite
  el stream byte a byte y cierra con `finish_ai_request` el gasto real, aunque
  cruce el tope.
- `GET /api/ai/v1/models`: el único modelo virtual; responde 503 si falta la
  configuración o la IA incluida está en pausa.

La cuota se cuenta en unidades por costo: equivalentes de token de entrada a
precio de lista (10.000.000 = US$1; la salida pesa 5, la escritura de caché
1,25 y la lectura 0,1; sobre 100.000 tokens de prompt, todo ×5). Basic tiene
6.000.000 por período, 1.500.000 en la prueba y Pro 30.000.000
(`plan_catalog`); el período es el mes pagado, la prueba o el mes de aniversario
de una cortesía, y su límite queda fijo desde el primer uso.

Los errores llevan `{error, message: "código: texto"}`: 401 de licencia
(`license_revoked` si no hay suscripción vigente), 429 `quota_exceeded` (con
`resets_at`) o `concurrency_limited`, 413 `prompt_too_long` y 503
`included_ai_unavailable` con su motivo. Los errores de la cuenta de pteron en
Anthropic (saldo, tope de gasto, clave, modelo) se dicen como 503
`provider_paused` y la reserva los anota con ese estado, el HTTP de Anthropic y
un motivo corto (`tope`, `tope_nivel`, `credito`, `clave`, `permiso`, `modelo`;
nunca su texto); los 429 y 529 del proveedor pasan con su `retry-after`. Si
Anthropic no responde, o su respuesta no se pudo leer, es 503 con motivo
`provider_unreachable` (en el segundo caso se cobra lo reservado, porque
Anthropic ya la ejecutó).

Proyecto Supabase configurado:

```text
https://swzqblyllbudwbmbcthr.supabase.co
```

### Base de datos

El esquema es un solo archivo, `supabase/esquema.sql`. Se pega entero en
Supabase › SQL Editor y corre en una sola transacción: borra lo que pteron
creó (todas sus tablas, funciones y datos; `auth.users` no se toca) y lo crea
de nuevo, así que sirve igual en un proyecto nuevo, en uno con una versión
anterior y para volver a empezar. Sólo conserva qué cliente de Flow es de cada
cuenta, porque Flow no deja crear otro con la misma. Antes y después se siguen
los pasos de la sección 1 de `LANZAR-BASIC.md`.

Un cambio de esquema se hace editando ese archivo, no agregando migraciones, y
mientras no haya usuarios reales se aplica corriéndolo de nuevo. Si algún día
hay datos que conservar, ese día se decide cómo cambiarlos sin borrarlos.

## Administración

`/admin` usa la misma sesión que `/cuenta` y sólo responde a los correos de
`ADMIN_EMAILS` que Supabase tenga confirmados (`email_confirmed_at`); un correo
de la lista sin confirmar recibe el mismo 403 que cualquier otra cuenta. El
panel no se abre hasta que `GET /api/admin/sesion` responde: una cuenta que no
administra ve sólo el aviso, sin pestañas ni tablas vacías.
Muestra el resumen (cuentas, pagos, cortesías, unidades del
mes, licencias vigentes, planes a la venta y si la IA incluida está en pausa),
la lista y el detalle de cada cuenta (suscripciones, licencias, activaciones,
consumo del período, peticiones de IA y eventos de cobro), el consumo por mes,
por modelo y por cuenta (agregado en SQL), y el catálogo de planes con su cuota
en unidades y su equivalente en US$. Desde ahí se abre o cierra la venta de cada
plan, se pausa la IA incluida, se concede o retira una cortesía (`provider =
comp`; no pisa un plan pagado y retirarla revoca sus licencias) y se termina un
plan de inmediato («Terminar ahora» cancela también en Flow). La pestaña Salud
(`/api/admin/salud`) dice con booleanos si están los secretos, si Flow es el de
producción, si la firma k2 se verifica, si la clave de Anthropic responde y si
el plan de Flow de cada plan a la venta calza con el catálogo. También muestra el
último rechazo de la cuenta de Anthropic en 7 días (la clave puede responder y el
tope de gasto rechazar cada petición), en rojo sólo si ninguna petición funcionó
después, y el tope de gasto sugerido para el workspace: 1,5 × la cuota mensual
de las cuentas que hoy usan la IA incluida, mínimo US$20. La API vive en
`src/routes/admin.js` y `src/routes/health.js`, y sus pruebas en
`tests/admin.test.js`.

## Correos

El Worker envía tres correos al cliente por la API HTTP de Resend
(`src/lib/correo.js`; los textos, en `correo-textos.js`):

- `purchase`: confirmación de compra (art. 12 A de la Ley 19.496), cuando se
  anota la suscripción. Lleva quién vende, el plan, el precio, la prueba o el
  primer cobro, la cuota, cómo cancelar, y la copia de los Términos aceptados
  (adjunta, más el enlace a `/terminos/<versión>`, una copia que no cambia).
- `trial_ending`: aviso a quien termina su prueba en menos de 48 horas y no
  canceló; lo envía el Cron diario.
- `cancellation`: confirmación de «Cancelar renovación».

Apagados hasta configurar todo: si falta el secreto `RESEND_API_KEY` o cualquiera
de `EMAIL_FROM`, `SELLER_NAME`, `SELLER_RUT`, `SELLER_ADDRESS` y `SELLER_EMAIL`
(variables de `wrangler.jsonc`; `SELLER_REPRESENTATIVE`, el representante legal de una persona jurídica, es opcional), no se lee nada ni se llama a Resend, y queda un
evento `<tipo>_email_skipped` con los nombres que faltan. Esas suscripciones no
recibirán después ese correo. El retracto sólo aparece cuando `TERMS_RETRACTO`
(`src/lib/terms.js`) tiene texto, es decir, cuando los Términos lo dicen.

Idempotencia: un evento `<tipo>_email` con id `email:<tipo>:<suscripción>` hace de
cerradura (insert que ignora duplicados) y el mismo id va como `Idempotency-Key`,
así que cada correo sale una vez por suscripción. El evento pasa a `processed` o
`failed` (sólo con el código del error). El Cron reintenta los fallidos de menos de
3 días, hasta 20 por corrida, y los que quedaron en `received` más de 30 minutos;
además busca compras y cancelaciones de esos 3 días que nunca llegaron a anotar su
evento (ni el `:skipped`) y las envía.
Resend recuerda la clave sólo 24 horas. Enviar nunca cambia el resultado del cobro.

`RESEND_API_KEY` es una clave de Resend distinta de la del SMTP de Supabase Auth
(que envía el enlace de acceso): permiso de envío, sólo el dominio `patagua.dev`.
`/admin` › Salud muestra «Correos al cliente», que no bloquea, con el botón
«Enviarme los correos de prueba» (`POST /api/admin/correo-prueba`): manda los tres
correos reales con datos de ejemplo (Basic con prueba, aviso de fin de prueba y
cancelación), con asunto «[Prueba] …», sólo al correo de quien administra, con la
configuración y la clave del Worker. Si falta algo no envía nada y dice qué nombres
faltan. No lee ni escribe en la base (ni `billing_events` ni suscripciones) y usa
una `Idempotency-Key` nueva en cada envío. Admite una prueba cada 60 segundos por
administrador (en la memoria del Worker). Ver `LANZAR-BASIC.md`, sección 1b.

## Scripts de operación

Tres scripts en `scripts/` para dejar Supabase y Resend como pide el Worker, con
`scripts/operador.mjs` como pieza común. Son un ensayo de sólo lectura por omisión
y actúan sólo con `--aplicar`; los tokens salen del entorno y no se imprimen.
En una sesión en la nube con proxy, `NODE_USE_ENV_PROXY=1` hace que el `fetch` de
Node lo use.

- `supabase-esquema.mjs` (`SUPABASE_ACCESS_TOKEN`): revisa las suscripciones de
  Flow vivas y se detiene si hay (salvo `--forzar`); con `--aplicar` se niega además
  si alguna tabla de datos ya tiene filas (salvo `--borrar-datos`), corre `esquema.sql`
  y comprueba el resultado; `--verificar` sólo comprueba.
- `supabase-auth.mjs` (`SUPABASE_ACCESS_TOKEN`): Site URL, Redirect URLs (agrega,
  no quita; avisa de un comodín o de otro dominio) y los correos de
  `supabase/correos/`. Deja la confirmación de correo obligatoria, sin cuentas
  anónimas y con cambio de correo seguro: de eso depende que un correo de
  `ADMIN_EMAILS` pruebe quién administra. No toca el SMTP salvo con `--smtp` y
  `RESEND_SMTP_KEY`; `--limite-correos N` cambia el límite por hora.
- `resend-dns.mjs` (`RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`): compara los registros
  de `patagua.dev` en Resend con los de Cloudflare y crea los que faltan; nunca
  modifica ni borra uno existente.

Sus pruebas offline son `tests/scripts-*.test.js`. Uso y prompt para una sesión de
Claude: `LANZAR-BASIC.md`, sección 1b.

## Versiones públicas

El workflow `sync-pteron-releases.yml` actualiza `public/docs/data/releases.json`
a partir de los releases publicados. Una versión sólo pasa a ser la actual
cuando su matriz de artefactos está completa. En el navegador,
`release-data.js` combina ese JSON con la API pública de GitHub y conserva un
fallback local. Sus commits en `main` no se publican solos (ver «Despliegue»):
mientras tanto el sitio ya anuncia la versión nueva, porque `release-data.js` la
toma de la API pública de GitHub, y el JSON publicado, que es el respaldo, se
pone al día en el despliegue siguiente.

Los HTML cargan el CSS y JavaScript compartidos con un parámetro `?v=` para
evitar que un archivo antiguo de la caché reemplace los enlaces actuales. Ese
valor es una revisión del sitio, no la versión de pteron: sube cuando se
modifica `styles.css` o alguno de los JavaScript compartidos, y no cambia al
publicar una versión nueva del producto.

## Variables y secretos

Las variables públicas viven en `wrangler.jsonc`, y sólo ahí: una variable de
texto puesta en el panel de Cloudflare se borra en el siguiente despliegue.

- `PUBLIC_SITE_URL=https://pteron.patagua.dev`
- `SUPABASE_URL=https://swzqblyllbudwbmbcthr.supabase.co`
- `LICENSE_KID=k2`
- `GATEWAY_MODEL_ID=claude-haiku-5-5`
- `FLOW_BASE_URL=https://www.flow.cl/api`: en el sitio de producción no se
  acepta otra (salvo `FLOW_ALLOW_SANDBOX=1`, sólo para desarrollo).
- `FLOW_BASIC_PLAN_ID=pteron-basic-2990-mensual` y
  `FLOW_PRO_PLAN_ID=pteron-pro-9990-mensual`: Flow fija el monto al crear un
  plan, así que un precio nuevo es un id nuevo. El Worker crea el plan en el
  primer checkout con los valores de `plan_catalog` (Basic $2.990 al mes, IVA
  incluido, con 7 días de prueba; Pro $9.990, sin prueba).
- `EMAIL_FROM` y `SELLER_NAME`, `SELLER_RUT`, `SELLER_ADDRESS`, `SELLER_EMAIL`
  (más `SELLER_REPRESENTATIVE`, opcional: el representante legal si vende una
  persona jurídica): remitente y datos del vendedor de los correos (ver
  «Correos»). Los `SELLER_*` llevan los datos de Patagua.dev SpA según su declaración de inicio de
  actividades ante el SII (ver `LEGAL-PENDIENTE.md`, punto 1).

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
  por comas; cada uno debe tener ya una cuenta con el correo confirmado. Sin
  esta variable, la administración responde 503.
- `RESEND_API_KEY`: clave de Resend del Worker para los correos al cliente (ver
  «Correos»). Sin ella no se envía ninguno.

Opcionales: `GATEWAY_MAX_IN_FLIGHT` (peticiones de IA en vuelo por cuenta, por
defecto 3) y `ANTHROPIC_BASE_URL` (en producción sólo la oficial). Sólo para
desarrollo: `FLOW_ALLOW_SANDBOX`.

`/api/health` responde `{ok}` (200 o 503) y `/api/admin/salud` dice qué falta,
sin mostrar valores.

Para desarrollo local, copia `.dev.vars.example` a `.dev.vars`; ese archivo
está ignorado por Git.

## Despliegue

Producción se publica a mano con `wrangler`, desde `main`. Workers Builds (la
integración Git de Cloudflare) no está conectado a este repositorio: un push a
`main` corre la CI («Verificar») pero no publica nada. `wrangler deploy` sube el
sitio, la API y el Cron a `pteron.patagua.dev`. No hay URLs de previsualización
por rama (`workers_dev` y `preview_urls` están en `false`): lo que se quiera ver
antes se prueba con `npm run dev` o con el sandbox de Flow en local.

### Cómo se despliega

Credenciales de Cloudflare: en una sesión de Claude Code en la nube están en
`CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, que `wrangler` lee solo; en un
equipo propio basta `npx wrangler login` una vez. Una sesión despliega sólo con
la autorización explícita de Marco en esa conversación (`AGENTS.md`).

1. Partir de `main` al día y sin cambios:

   ```bash
   git checkout main && git pull
   git status --short    # no debe imprimir nada
   ```

2. Instalar lo del lockfile y verificar. Si `verify` falla, no se despliega:

   ```bash
   npm ci
   npm run verify        # sintaxis, empaquetado en seco, pruebas y humo contra wrangler dev
   ```

3. Desplegar con el commit en el mensaje, para encontrarlo después en el
   historial. Imprime el `Current Version ID`:

   ```bash
   npx wrangler deploy --message "main $(git rev-parse --short HEAD): <qué cambia>"
   ```

4. Comprobar en producción, con un parámetro al azar para no leer una copia
   guardada:

   ```bash
   curl -s "https://pteron.patagua.dev/?r=$RANDOM" | grep -o 'styles.css?v=[^"]*'   # la revisión nueva
   curl -s "https://pteron.patagua.dev/inicio.js?r=$RANDOM" | cmp - public/inicio.js && echo igual
   curl -s https://pteron.patagua.dev/api/health                                    # {"ok":true}
   ```

   Repite el `cmp` con cada archivo que cambió y mira el cambio en el sitio real,
   en escritorio y teléfono.

5. Historial y vuelta atrás: `npx wrangler deployments list` muestra cada
   despliegue (el último, al final) con su origen y su mensaje;
   `npx wrangler rollback <version-id> --message "<por qué>"` vuelve a una versión
   anterior.

`wrangler deploy` toma las variables públicas de `wrangler.jsonc` y conserva los
secretos del Worker, que no viven en el repositorio.

Para que cada push a `main` se publique solo, hay que conectar Workers Builds:
Cloudflare › Workers & Pages › `pteron-landing` › Settings › Build › Connect,
repositorio `marcorojasb/pteron-landing`, rama `main`, build vacío y deploy
`npx wrangler deploy`. Si se conecta, se actualizan esta sección y `AGENTS.md`.

### Configuración del proyecto

1. El dominio `pteron.patagua.dev` lo asigna `wrangler.jsonc` como Custom
   Domain; Cloudflare mantiene el registro DNS y el certificado.
2. Cargar los secretos listados arriba y aplicar `supabase/esquema.sql`.
3. En Supabase Auth, Site URL `https://pteron.patagua.dev/cuenta` y ese mismo
   destino como URL de redirección del enlace mágico.

Lo que queda por configurar a mano antes de cobrar (secretos, SMTP, Anthropic,
Flow, lo legal) está, en orden, en `LANZAR-BASIC.md`. La venta nace cerrada y se
abre desde `/admin`.

El gateway de IA retransmite respuestas largas del proveedor; el plan Workers
Paid evita el tope de CPU del plan gratuito en esas peticiones.

## Desarrollo y comprobaciones

```bash
npm ci
npm run dev        # http://localhost:8787 con assets y API
npm run verify     # sintaxis, empaquetado en seco, pruebas y humo contra wrangler dev
```

`npm run dev` necesita `.dev.vars` para la cuenta, Flow y el gateway; sin él,
esas rutas responden 503 con un código que nombra la configuración ausente.
La web estática, la documentación y las descargas funcionan sin secretos. Para
probar con el sandbox de Flow, `.dev.vars` lleva su `FLOW_BASE_URL` y
`FLOW_ALLOW_SANDBOX=1`.

## Antes del lanzamiento comercial

- Seguir `LANZAR-BASIC.md` y resolver `LEGAL-PENDIENTE.md` (quién vende,
  retracto, confirmación escrita, boleta) antes de abrir la venta; los borradores
  están en `BORRADORES-LEGALES.md`.
- Mantener los enlaces de descarga sincronizados con los releases públicos.
- Probar la activación en una instalación limpia de cada plataforma soportada.
- Medir cuántos materiales caben en cada cuota y publicar esa equivalencia.
