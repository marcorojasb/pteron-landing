# Design QA

## Llenar la web con diseño, no con etiquetas — 2026-10-25

- Tras quitar las etiquetas y descripciones secundarias, varias páginas se veían vacías. Comparadas con las de antes a
  1280 y 390 px, cada vacío se llenó con diseño:
  - Inicio:
    - «Cómo funciona» es una línea de tiempo: pasos más grandes, unidos por una línea que se pinta de azul a medida que
      avanza la ventana;
    - en «La hoja», a 1100 px o más, la hoja del estudiante y la versión docente van lado a lado con su nombre debajo,
      y las respuestas esperadas se ven sin elegir. El selector de hoja queda para pantallas angostas, y la cota de la
      hoja oficio (215,9 × 330,2 mm) se dibuja como en un plano;
    - «En tu computador» lleva el icono de cada punto.
  - /descargar: el archivo y su peso en cada sistema; pteron con una guía abierta en Write; y una franja con lo que da
    confianza (firmado y notarizado en macOS, firma GPG en Linux, se actualiza sólo con tu permiso).
  - /descargar/<sistema>: el momento de instalar, dibujado: la ventana del .dmg hacia Aplicaciones, SmartScreen con los
    pasos 1 y 2 marcados, y «Ejecutable como programa». El nombre del archivo es el de la versión que baja.
  - /cuenta: junto al acceso, una hoja con lo que trae la cuenta (el plan, la IA del período y el equipo activado).
  - /planes: bajo cada cuota, su barra a escala (Basic es un quinto de Pro), y a quién escribir junto a las preguntas.
- Descartado: un selector de papel (Oficio, Carta, A4). La hoja de ejemplo mide 1113 px a 96 ppp y no cabe en una
  carta (1056): se saldría del papel.
- Verificado en Chromium a 1440, 1280, 1100, 1024 y 390 px:
  - sin desborde, errores ni violaciones de CSP;
  - en el modo lado a lado, ninguna de las dos hojas queda inerte; en las pantallas angostas, sí la que no se ve.
- Revisión del sitio 2026-10-25.8. 514 pruebas, humo y `sitio.mjs --revisar` en verde.

## Analítica de visitas que cuenta lo que importa — 2026-10-25

- Privacidad ya no dice «Esta web no incorpora analítica»: dice que la web cuenta sus visitas con Cloudflare Web
  Analytics (lo inyecta el borde de Cloudflare), sin cookies ni nada guardado en el navegador, y qué registra: la
  dirección de la página sin lo que va tras «?» o «#», la página de origen, el país, el equipo, el sistema, el
  navegador y el tiempo de carga. Comprobado en el código del beacon que inyecta Cloudflare (2024.11.0, `spa: 2`):
  `location` y `referrer` pasan por una función que borra la consulta, el fragmento y las credenciales, así que los
  tokens que vuelven a /cuenta no salen. No usa cookies, localStorage ni sessionStorage.
- La documentación tiene una dirección por página, `/docs/<página>`: con `?pagina=` las 30 páginas llegaban a la
  analítica como una sola, `/docs`. La forma anterior redirige con un 301 (el Worker atiende ahora también `/docs`) y
  `app.js` deja la dirección en la forma nueva antes de que el beacon la lea. Sitemap, llms.txt y enlaces, al día.
- Cada descarga pasa por `/descargar/macos`, `/descargar/windows` o `/descargar/linux` (noindex): la página baja el
  instalador al llegar, después de `load` para que la visita alcance a anotarse, y no al recargar ni al volver; deja a
  la vista los pasos para instalar. Los botones del inicio, `/planes`, `/descargar` y la esquina llevan ahí; un
  teléfono vuelve a `/descargar`. Los .deb, .rpm y .tar.gz siguen bajando directo.
- Verificado en Chromium:
  - cada sistema baja su archivo una vez y no al recargar, a 1280 y 390 px;
  - un teléfono vuelve a /descargar sin bajar nada;
  - en Linux, el botón del inicio lleva a /descargar/linux y baja la AppImage;
  - `/docs?pagina=crear#plan` queda en `/docs/crear#plan`, y la página siguiente, el índice y Atrás usan la forma
    nueva.

  Sin errores, violaciones de CSP ni desborde.
- 21 mutantes de la lógica nueva (Worker, `app.js`, `descarga.js`, `script.js`, `download.js`), todos detectados.
- Revisión del sitio 2026-10-25.7. 514 pruebas, humo y `sitio.mjs --revisar` en verde.

## Sin etiquetas ni descripciones secundarias — 2026-10-25

- Principio, en toda la interfaz: el diseño hace la explicación (queda en `AGENTS.md`). Se quitaron:
  - las bajadas bajo el título de Planes, Descargar, Cuenta, Marca, Administración y la 404;
  - el rótulo sobre cada título de la documentación, los rótulos y el pie de las hojas de la portada y la nota de la
    beta en el índice de la documentación;
  - las descripciones bajo cada enlace (por dónde empezar, «Sigue leyendo», la 404, las plataformas del inicio), los
    pies de las capturas de la documentación, la ayuda de teclado del buscador y el grupo de cada resultado, y
    «Siguiente» en la tarjeta de la página siguiente;
  - en Descargar, el chip «Tu equipo» (el botón de tu sistema ya es el principal), los nombres de archivo repetidos y
    las notas que repetían la documentación; en Cuenta, las notas de la sesión, la activación y los planes, y la ayuda
    al pie; en Marca, la leyenda del espacio libre, la nota de formatos y la columna «Para» de los archivos.
- Pasan a ser sólo para lectores de pantalla: «En esta página», «Páginas», «Sigue leyendo», «Huella», «Qué hoja»,
  «Impresión», «Ver» y los rótulos del correo, la búsqueda y el mes.
- El diseño explica en vez del texto: en Marca, el gris de cada color aparece sólo al verla en fotocopia. El colofón
  queda en la marca, la frase y las páginas; los créditos de las láminas viven en /privacidad#creditos, enlazados
  desde la línea legal de cada página («Créditos»).
- Lo que un pie de captura decía y el párrafo no pasó al texto: la alternativa sugerida va primero, Adjuntar no envía
  nada y «Qué hoja» al imprimir. En /admin, las reglas de los paneles pasaron a la acción que las necesita: abrir la
  venta recuerda revisar el plan de Flow, pausar la IA dice que las cuotas y la clave no cambian y terminar un plan
  dice que revoca las licencias.
- Sin tocar: el texto legal de Privacidad y Términos (con sus bajadas) y la copia fija de los Términos; las
  condiciones de la prueba y del cobro en Planes y en el resumen antes de Flow; el aviso de SmartScreen; los créditos;
  las confirmaciones; el recreo.
- Verificado en Chromium a 1280 y 390 px: las diez páginas y sus estados (Cuenta sin plan, con plan y con un plan
  pedido; Administración con datos, una cuenta y los planes; una guía de instalación, la última página de la
  documentación y el buscador abierto; Marca en fotocopia). Sin errores de consola ni violaciones de CSP.
- Pruebas: la de los rótulos de la portada se fue con ellos; la de los créditos ahora exige que cada lámina que se ve
  tenga su crédito y que cada pie lleve ahí; la de precios exige además que ningún precio nombrado sea otro que los
  del catálogo. Cinco mutantes de esas dos pruebas, todos detectados.
- Revisión del sitio 2026-10-25.6. 503 pruebas, humo y `sitio.mjs --revisar` en verde.
- Desplegado (main d853a30, versión 7782a551). La revisión en producción encontró que las leyendas ocultas de los
  selectores (inicio y Marca) medían todo el ancho: `.segmento legend{width:100%}` le ganaba a `.sr-only`, y la página
  se desbordaba 15 px a 390 y 50 px en Marca a 1280. `.sr-only` ahora lleva `!important` en cada propiedad; ningún
  texto oculto del sitio mide más de 1 px ni desborda, en las doce rutas a 1280 y 390 con el índice abierto.

## Entrar con Google y Apple, listo y oculto — 2026-10-25

- /cuenta: «Continuar con Google» y «Continuar con Apple» arriba de la hoja de entrada, de papel y a lo ancho, con la
  marca de cada uno tal cual; debajo, «o con tu correo» y el formulario de siempre. Quedan ocultos (`hidden` en
  `data-oauth`) hasta que Google, Apple y Supabase estén configurados (`ENTRAR-CON-GOOGLE-Y-APPLE.md`). Con los
  botones ocultos, /cuenta es idéntica píxel a píxel a la anterior, a 1280 y 390 px.
- OpenID Connect con `id_token`, sin secretos y sin pasar por el dominio de Supabase, como hola.patagua.dev. Se
  reutilizan su cliente de Google (una URI de redirección más, sin tocar su marca) y el equipo de Apple (un Services
  ID «pteron»). El nonce queda en el navegador y al proveedor sólo va su huella. Supabase acepta el `id_token` sólo
  con ese nonce, así que uno ajeno no abre nada; lo que vuelve sin el state de este navegador no se usa. Un proveedor
  apagado lo dice junto a los botones, nada queda guardado y el foco vuelve al botón.
- Los errores de la vuelta (y los del enlace por correo, que antes mostraban el texto en inglés de la URL) se dicen con
  palabras nuestras; cancelar en Google o Apple no avisa nada. El texto de la URL nunca se muestra.
- Verificado en Chromium, con los botones a la vista y los proveedores simulados:
  - viaje completo con Google a 1280 px y con Apple a 390 px;
  - «Abriendo…» mientras sale y el esqueleto mientras Supabase valida;
  - después, la cuenta abierta con el saludo, la URL limpia y el intento borrado;
  - cancelar vuelve sin aviso y un `id_token` ajeno no pide nada;
  - «Atrás» desde Google deja los botones libres;
  - sin desborde, errores ni violaciones de CSP.
- 43 mutantes del Worker y de /cuenta, todos detectados por las pruebas. Google acepta este flujo con el cliente de
  hola.patagua.dev (comprobado con la dirección de autorización, sin entrar con ninguna cuenta).

## «Cómo funciona» con la app de hoy — 2026-10-25

- La ventana del inicio refleja pteron main (b79850c):
  - la Home sin rumbos;
  - el pedido leído en una frase (Agregar todo · Tab);
  - el plan con su decisión en el recuadro;
  - la hoja que se escribe con la tarjeta de la corrida al pie;
  - «Listo en …» al terminar.

  Los relojes cuentan el tiempo de la app (22 s el plan, 55 s la guía), no el de la secuencia, que va más rápido. Los
  pasos de la sección dicen lo que muestra la ventana.
- Verificado en Chromium a 1440 y 390 px: el inicio, seis estados intermedios y el final. Sin errores de consola,
  violaciones de CSP ni desborde. El CLS mientras corre es de 0,013 y 0,027, y queda dentro del cuadro de la ventana:
  la página no se mueve. Con movimiento reducido se ve el final, fijo.
- Pendiente, anterior a este cambio: si `pteron-ventana.js` no carga, la Home estática queda recortada (escala 0,6),
  igual que en la versión publicada.
- Revisión del sitio 2026-10-25.4. 484 pruebas, humo y `sitio.mjs --revisar` en verde.

## La documentación con pteron main y el despliegue verificado en producción — 2026-10-25

- Capturas de la documentación tomadas de nuevo con pteron main (b79850c, 0.9 en curso), con el arnés de la app bajo
  Xvfb: 27 escenas revisadas una por una. Nuevas: la tarjeta de la corrida, el menú «Ajustar», un pedido con un
  archivo de la carpeta y el OA, y una respuesta cortada por el proveedor. Retiradas: la ficha y el error al exportar,
  que la 0.8.2 quitó. El encargo abierto de la corrida, el error y el aviso de datos se nombra para que calce con lo
  que muestra. El plan listo va con «Cómo lo abordaré» plegado: en main, los números de sus etapas se dibujan unos
  200 px más abajo (una regla de chat.css con posición absoluta dentro de una rejilla; en 0.8.1 se veían bien).
- Documentación al día con la app: la pantalla de inicio sin rumbos, el pedido leído en una frase (Tab), lo último de
  la carpeta, el índice, Copiar y «Nuevo chat desde aquí», la Biblioteca, «Ajustar», lo pedagógico en la hoja, la
  tarjeta de la corrida, los ítems con incisos, el formato del colegio, el aviso de datos ampliado y la respuesta que
  se corta. Cada control nombrado se buscó en el código de pteron. 20 páginas a 390 y 1280 px: sin imágenes rotas,
  textos alternativos vacíos, desborde, errores ni violaciones de CSP.
- Despliegue de main a8716b0 (versión 02a9a6bc) y, tras el arreglo, 985ae9f (versión fae117a3). Producción estaba en
  la revisión 2026-10-14.2. Comprobado en pteron.patagua.dev: 24 archivos idénticos al repositorio, `/api/health` ok,
  `/api/plans` con el catálogo real (Basic a la venta), la API de cuenta y de administración piden sesión, la CSP y
  las cabeceras en assets y en lo que entrega el Worker, `/assets` inmutable y releases.json en 0.8.2.
- Hallazgo en producción: Cloudflare inyecta en cada página el beacon de Web Analytics de la zona, y la CSP nueva lo
  bloqueaba (error en la consola de cada página y analítica sin datos). La CSP suma static.cloudflareinsights.com en
  script-src y cloudflareinsights.com en connect-src; probado imitando la inyección (con la CSP anterior no carga, con
  esta carga y envía) y después en producción: carga sin violaciones.
- Barrido de producción en Chromium, 17 rutas a 1280 y 390 px: sin errores de consola, violaciones de CSP,
  peticiones fallidas, imágenes rotas ni desborde; CLS de 0 a 0,007, salvo /admin (0,085 y 0,156: el colofón baja al
  mostrar «Entra primero con tu cuenta», que el panel decide después de cargar; es anterior y sólo de esa página).
  Pruebas de lectura: /planes con «Elegir Basic» y Pro «Disponible pronto», /descargar y Versiones con 0.8.2, un
  enlace de entrada adulterado en /cuenta no entra y lo dice el aviso, y /admin sin sesión no muestra datos.

## Comandos GPG legibles y enlaces de entrada ajenos — 2026-10-25

- /descargar: los comandos GPG se cortan entre argumentos y no en un guion (antes: «--» / «fingerprint», «pteron-» /
  «releases…»). La continuación de un comando lleva sangría, y la de un nombre de archivo que no cabe en una línea, el
  doble; si junto a «Copiar» no caben 42 caracteres, el botón baja. Medido a 320, 390, 768, 1024, 1280 y 1920 px: desde
  768 px ningún corte cae en un guion; a 390 sólo se parte la firma de la AppImage, que no cabe en una línea. Lo que se
  copia, con el botón o seleccionando, es el comando exacto.
- /cuenta: un enlace de entrada abre su cuenta sin preguntar sólo si es la que se pidió desde este navegador (el correo
  queda anotado una hora) o la que ya está abierta en él. Si no, pregunta «¿Entrar como …?» y dice si hay otra cuenta
  abierta; «Cancelar» deja todo como estaba. Así, el enlace que manda otra persona ya no deja a nadie dentro de una
  cuenta ajena sin saberlo. El correo del enlace lo confirma el servidor (`GET /api/auth/me`), no el texto del token:
  un token alterado no entra, no reemplaza la sesión abierta y lo dice un aviso. Los tokens salen de la URL en el acto.
  Verificado en Chromium a 390 y 1280 px: la pregunta aparece sin esqueleto y con el foco en su título; después, el
  foco pasa a la cuenta o al correo. Tab recorre «Entrar» y «Cancelar», un correo largo no desborda y recargar no
  vuelve a preguntar. El recorrido de siempre (pedir y abrir el enlace en el mismo navegador) entra sin preguntar.
- Revisión del sitio 2026-10-25.3. CSP: ninguna violación en las 15 escenas. 476 pruebas pasan.

## Planes según la venta, salto temprano de la portada y CSP — 2026-10-25

- /planes: cada plan de pago parte con «Disponible pronto» (deshabilitado, atenuado como en /cuenta) y `script.js`
  muestra «Elegir Basic/Pro» sólo para el plan que `GET /api/plans` dice a la venta. Verificado a 390 y 1280 px con
  la venta cerrada, con Basic abierto, con la API caída y lenta (1,5 s): CLS 0 en todos, y sin JavaScript queda
  «Disponible pronto».
- Portada: si el visitante bajó más de 8 px antes de que corriera inicio.js, la escena queda quieta (como con
  movimiento reducido) en vez de fijarse y cambiarle lo que leía. Medido con Fast 3G y CPU 4x bajando a 400, 1100 y
  2000 px: CLS 0–0,003 y los títulos en el mismo lugar antes y después (antes, CLS 0,54). Sin bajar, la escena abre
  igual; #hojas, recargar y volver atrás también.
- Content-Security-Policy en todo el sitio (`public/_headers`). Recorridos en Chromium con las cabeceras de
  `_headers`: portada con escena, índice y recreo (el tablero y sus piezas se pintan), docs con búsqueda, siguiente,
  versiones y sin sus scripts, cuenta con y sin sesión, admin, descargar, planes, marca, privacidad, términos y 404:
  ninguna violación. Una prueba de control con un hash menos sí las detecta.
- Privacidad, versión 2026-10-25: lo que se dice de Anthropic calza con su política (borra lo de la API dentro de
  30 días).
- Barrido final: 12 páginas a 390 y 1280 px (portada y docs también con movimiento reducido), sin peticiones
  fallidas, errores, desborde ni imágenes rotas. 466 pruebas pasan.

## Rendimiento, accesibilidad, documentación y pulido — 2026-10-25

Pedido: revisar qué más mejorar y optimizar en la landing. Una auditoría en seis frentes (rendimiento,
accesibilidad, SEO, contenido, visual y código), con cada hallazgo verificado aparte, dejó lo objetivo en cinco
paquetes; lo que cambia textos, diseño, precios o necesita desplegar quedó para decidir. Revisión del sitio
2026-10-25.1.

- Portada: una sola imagen por lámina (la sombra usa la de la cara), `sizes` a la medida de cada lámina y nada de las
  nueve láminas de escritorio en el teléfono. Medido en Chromium: 47 → 22 peticiones y 993 → 421 KB a 390 × 844 a
  escala 3; 47 → 31 y 993 → 470 KB a 1280 × 800. Ninguna lámina queda con menos píxeles de los que pinta.
  La pieza de cabecera de /planes, /descargar y /cuenta no se baja bajo 560 px. Las láminas ya no saltan al arrancar
  la escena (CLS de escritorio 0,36–0,44 → bajo 0,04, que queda del rótulo «Descargar para …» y de la letra), la marca
  de la portada va en línea y se pinta con el título, y los rótulos de las hojas se parten en una tableta vertical en
  vez de montarse (0 cruces de 768 a 900 px).
- Docs: canónica y descripción por página (antes, todas declaraban /docs), el foco pasa al título nuevo al navegar
  (o a la sección, con ancla) y el colofón ya no se asoma y salta mientras carga (CLS 0,55–0,60 → 0 en escritorio).
  Si content.js o app.js no cargan, la página vuelve a mostrar el colofón. Un enlace con ancla conserva la sección.
- /cuenta: el foco vuelve a un lugar visible tras cada petición (enlace enviado, error de correo con aria-invalid,
  «Abrir pteron» tras activar, errores de pago y cancelación) y el aviso inferior nunca lo tapa: 0 % en 27 casos a
  390, 320 y 768 px.
- Pulido: la línea legal del pie alineada (10 px → 0), el fondo del recreo y del índice sin fundido con movimiento
  reducido, la tabla de /marca sin cortes, la esquina «Descargar» se aparta de #descargar y del colofón también en
  modo quieto, y la letra mono y los créditos de /privacidad llevan revisión.
- Impresión de Términos y Privacidad: sin «Sigue leyendo» ni página final con sólo la línea legal en Carta, A4, Legal
  y Oficio, y sin texto encimado en ningún papel probado (Carta, A4, Legal, Oficio, Folio, 216 × 300, 216 × 340, A5;
  antes había texto encimado en 11 de 24 combinaciones). Queda: en A5, Folio y 216 × 340 la última página de Términos
  puede llevar sólo la línea legal; `break-before: avoid` en el colofón no lo evita en Chromium.
- Barrido final con la revisión nueva: 12 páginas a 390 y 1280 px (portada y docs también con movimiento reducido),
  sin peticiones fallidas, errores de consola, desborde horizontal ni imágenes rotas. 449 pruebas pasan.
- Fuera de esta pasada: capturas de docs a 960 px (ahorran cerca de 45 % en escala 1, pero se ven más blandas a escala
  3 y al imprimir), y lo que pide decidir: textos, diseño, precios y despliegue.

## La landing con el diseño de pteron 0.8 y el recorrido de bienvenida — 2026-10-14

Pedido: alinear la landing con el diseño nuevo de la app (0.8.0 y 0.8.1: el índice, el margen, Archivo, la marca
dibujada, los colores de las hojas) y con el recorrido de bienvenida de la rama `nuevo-onboarding` de pteron
(c61e8f05, ADR-183), sobre todo las capturas y las animaciones.

- «Cómo funciona» (antes «Cómo se pide»): la ventana se rehízo con el marcado de los componentes actuales (ShellIndex,
  HomePage con `Marca.tsx`, Composer, la tarjeta del plan y su decisión en el recuadro, la hojita, LiveSheet y las
  tarjetas de material) y las reglas de la app regeneradas (`pteron-app.css`, desde c61e8f05). La secuencia sigue las
  escenas del recorrido: Pedir (el primer pedido de partida del recorrido, «Una guía de fracciones equivalentes para
  5° básico, de 45 minutos, con ejercicios graduados», con lo reconocido y «Agregar todo»), Decidir (el encargo entra
  al índice en 5° básico · Matemática y el plan pregunta cómo graduar; se elige la sugerida), Crear (la hoja que se
  escribe es la guía de Matemática de «La hoja», bloque a bloque) y Guardar (la guía y su pauta quedan en el
  encargo). La guía de «La hoja» pasa a 5° básico, el curso del pedido.
- Verificado en Chromium (Playwright) con un servidor estático de `public/`, a 1440 × 900 y 390 × 844, con cuadros a
  0, 1,5, 4, 7, 9,5, 12, 14,5, 17, 19,5, 22, 25 y 29 s: inicio en reposo, el recuadro que se amplía, el pedido
  escrito, «¿Agregar?», las fichas aceptadas, el índice con «Trabajando…» y «Falta 1 decisión», la alternativa
  elegida, el plan Listo y «Crear la guía», la hoja que se arma y el final con las dos tarjetas y «Ver de nuevo».
  En el teléfono la vista se acerca al recuadro, al plan con su decisión, a la hoja y a las tarjetas.
- Los pasos 2, 3 y 4 retoman la secuencia desde su escena; «Ver de nuevo» la reinicia; si la ventana sale de la
  pantalla a medio camino vuelve a la Home y empieza de nuevo al volver. Movimiento reducido: el encargo terminado,
  sin animación, en escritorio y teléfono. Sin JavaScript la ventana sigue oculta (no se puede escalar) y ahora el
  texto ocupa el ancho, sin un hueco a la derecha.
- El aviso de datos de estudiantes de «En tu computador» va dentro del recuadro, como en la app (título ámbar).
- Las figuras de las hojas (la de las fracciones en «La hoja», las de la portada y la hoja que se escribe en la
  ventana) quedan centradas en su pregunta, como en el Word de pteron: medido, 0 px entre el centro de cada figura y el
  de su tarjeta. En la hoja de Write la figura es `inline-block` y su `margin: auto` no la centraba; además, las reglas
  de la imagen no alcanzaban al SVG con que la web la reemplaza.
- Iconos: `assets/pt-icons.svg` sale de lucide-solid 1.43.0 (el de la app) con `scripts/pteron-iconos.mjs`; una prueba
  comprueba que cada icono que pide la ventana esté en el sprite.
- Docs: las 22 figuras de 0.6 y 0.7 pasan a 26, hechas con 24 capturas nuevas (dos se muestran recortadas), tomadas
  con `scripts/capturas-pteron.mjs` sobre el arnés de pteron: Home, pedido reconocido, rumbo Planificar, encargo, memoria,
  conversación, Biblioteca, plan por acordar y listo, Write con margen y ficha, apaisada, respuestas, pauta, imprimir,
  cambio aplicado con «Deshacer», vista doble con PDF, Present con el maestro nuevo, aviso de datos, Modelo de IA
  («¿Dónde trabaja la IA?»), error al exportar, el recorrido (apertura y escena Crear) y la guía de IA. Sale la figura
  del taller de figuras, que la app ya no tiene. Los textos de docs se alinearon con la interfaz (índice, encargos,
  margen, cambios con «Deshacer», Configuración al instante, primera apertura con el recorrido y la guía de IA).
- Cómo se toman las capturas (Linux bajo Xvfb, plataforma de macOS, IA incluida respondiendo, mesa preparada) está en
  `public/assets/app/LEEME.md`. Revisadas una por una en hojas de contacto; cargan todas en docs, sin errores.
- Las cuatro guías de la portada y «La hoja», revisadas como guías de un profe:
  - Matemática: los rótulos de las fracciones van todos bajo su barra (antes 3/4 y 6/8 iban arriba y las casillas
    abajo). La segunda barra llega en blanco, para pintar 3/4 en doceavos. Luego una recta con tercios y sextos, con
    los sextos sin simplificar (el kit escribía 1/3 y 1/2) y una casilla en 4/6. Es la gradación de lo concreto a lo
    simbólico que elige la ventana: su plan y su respuesta cuentan esta guía.
  - Ciencias: los dibujos de las fases van numerados, para no confundirlos con las letras de las alternativas, que
    ahora son nombres de fases. La pregunta de la órbita trae espacio para responder y pide explicar.
  - Historia: la República ya no empieza en 1810 (Conquista, Colonia e Independencia hasta 1823). La tabla, que no se
    podía contestar porque la línea no rotula el inicio ni el fin de cada período, pasa a «¿En qué período ocurrió
    cada hecho?», con un año (1647) que se ubica con la escala.
  - Lenguaje: la consigna de caligrafía calza con la pauta (palabra modelo, dos copias para repasar y espacio). Las
    sílabas usan tres animales del mismo trazo (mariposa, conejo y rana: cuatro, tres y dos sílabas directas) en vez
    de tres dibujos de estilos distintos.
  - Las respuestas esperadas y los criterios de corrección van en la versión docente. Las figuras se piden a la medida
    y con su descripción para el lector de pantalla. Sólo llevan pie las que dicen algo que el enunciado no dice
    (en pteron el pie es opcional).
  - La figura entra a Write con la proporción de su PNG, como en la app, así que pteron decide qué figura va junto al
    enunciado: las fases de la Luna. Cada hoja, también la versión docente, cabe en su página oficio de 1248 px, con
    un margen de 32 a 135 px.
  - La portada, con sus láminas cayendo sobre las figuras, y la ventana se revisaron por cuadros a 1440 y 390.
- Desborde horizontal: 0 px en /, /marca, /privacidad y docs a 1440 y 390. Consola: sin errores propios (sólo el 403
  por límite de la API pública de GitHub que pide `release-data.js`).
- `npm run verify`: sintaxis y `wrangler deploy --dry-run`, 400 pruebas y la prueba de humo contra `wrangler dev`.

- Unido con `main` (el recreo rehecho, ya en producción con la revisión 2026-10-14.1): la revisión sube a
  2026-10-14.2 para que la caché no sirva los archivos anteriores con el mismo número. Los generadores de las hojas
  y la ventana dan el mismo `index.html`, `npm run verify` pasa con 407 pruebas y el recreo se abre con dos clics.

Producción: desplegado a mano con `wrangler` desde `main` (`1f8a334`, versión `613892a0`) tras `npm ci` y
`npm run verify`. En pteron.patagua.dev la portada carga la revisión 2026-10-14.2. Son idénticos a los del
repositorio la portada, /marca, /planes, /descargar, /cuenta, `inicio.js`, `inicio.css`, `pteron-ventana.js`,
`pteron-app.css`, `pteron-hoja.css`, `recreo.js`, `styles.css`, `docs/content.js` y `pt-icons.svg`. Las capturas
nuevas responden 200 y `/api/health` responde `{"ok":true}`. En escritorio (1440 × 900) y teléfono (390 × 844) se ven
la portada armada, la ventana en marcha, «La hoja» con sus dos versiones y docs con sus figuras, sin errores, sin
imágenes rotas y sin desborde.

Final result: passed (pendiente: Safari en iPhone)

## El recreo, rehecho como la referencia — 2026-10-14

Pedido: que el juego sea de verdad y se vea como la captura de referencia (tablero en una tarjeta con cuadrícula,
piezas con la obra de las láminas y sombra, «Siguiente» con cuatro piezas y «Controles» como teclas).

Verificado en Chromium (Playwright) con un servidor estático de `public/`, a 1440 × 900 y 1366 × 650 (puntero),
680 × 860 (ventana angosta), 390 × 844 y 844 × 390 (teléfono) y 820 × 1180 (tableta):

- Tablero: tarjeta de cartón claro con filo de luz y sombra, cuadrícula fina, esquinas redondeadas que recortan las
  piezas del borde. El lado de la casilla es entero y la tarjeta calza justo con la cuadrícula.
- Piezas: cada una con el trozo de su lámina, al derecho aunque gire (el texto de las láminas se lee), sin costuras
  entre casillas, con un filo apenas oscuro y sombra; la que cae flota más que las fijas. Las láminas con calados van
  sobre papel. Al borrar una fila del medio de una pieza, cada parte conserva su trozo de la obra.
- Costados: «Siguiente» con cuatro piezas (menos si no caben bien), «Guardada», marcador con puntaje, nivel, líneas y
  récord; «Controles» bajo una línea punteada, con teclas; Pausa y Salir son botones con su tecla.
- Jugadas: cuatro líneas, T-spin, combos y jugadas seguidas aparecen bajo el marcador (sobre la cuadrícula en el
  teléfono) y se van solas; las filas completas se blanquean de izquierda a derecha antes de irse.
- Vuelo: las láminas se recortan y las piezas vuelan con su obra a la cuadrícula y a «Siguiente»; al llegar, la sombra
  de la lámina se vuelve la de su lugar, sin saltos.
- Estados: inicio, pausa (velo con desenfoque), fin con récord, cierre (la portada vuelve) y movimiento reducido (el
  juego aparece de una vez, con las piezas ya recortadas y la página tapada por la mesa).
- Desborde: 0 px en todas las medidas. Consola: sin errores propios.

Producción: desplegado a mano con `wrangler` desde `main` (`b81189f`, versión `b373de57`) tras `npm ci` y
`npm run verify`. En pteron.patagua.dev la portada carga la revisión 2026-10-14.1, `recreo.js`, `inicio.js`,
`inicio.css`, `styles.css` y la portada son idénticos a los del repositorio, `/api/health` responde `{"ok":true}`, y
el doble clic, el vuelo y el juego funcionan en escritorio (1440 × 900) y teléfono (390 × 844) sin errores ni desborde.

Final result: passed (pendiente: Safari en iPhone y un teléfono de gama baja)

## El recreo (huevo de pascua de la portada) — 2026-10-13

Pedido: dos clics en una de las formas de la portada; las letras se van, las láminas se transforman en las piezas de
un juego de piezas que caen, totalmente jugable.

Verificado en Chromium (Playwright) con un servidor estático de `public/`, a 1440 × 900 (puntero) y 390 × 844
(táctil), con capturas por ráfagas y con el reloj del vuelo congelado en 0, 300, 400, 600, 900, 1100, 1500 y 2200 ms:

- Inicio: el doble clic no salta nada; las láminas se enderezan y dejan de flotar; las letras del titular caen una a una
  y lo demás de la portada se desvanece.
- Toma: en el cuadro en que el recreo dibuja las láminas, la página esconde las suyas; congelado en 0 ms, la copia
  calza con el original (sin corrimientos ni trozos de otra parte de la obra).
- Recorte: la línea de tinta rodea la pieza dentro de cada lámina, el sobrante cae girando y se desvanece; ninguna
  pieza ocupa la lámina entera.
- Vuelo y llegada: la primera pieza llega a donde nace en el tablero; las tres siguientes, a «Siguiente»; las demás se
  apilan detrás y se desvanecen. Al terminar no queda nada del vuelo encima de la hoja.
- Juego: suelto sobre la mesa, sin hoja detrás; lo que rodea la cuadrícula (cabeza, marcador, ayuda) va chico. En el
  aire cada lámina se da vuelta y llega como figura de pteron: color plano, divisiones apenas marcadas y contorno de
  tinta. Fantasma a lápiz; pausa, fin del recreo y récord; teclado en escritorio y botones táctiles en el teléfono.
- Cierre: la hoja baja, las láminas suben a su lugar desde abajo y las letras vuelven; el titular queda idéntico al
  original y no quedan animaciones colgando.
- Movimiento reducido: el juego se abre de una vez, con las piezas recortadas de las láminas y la página detrás de la
  mesa.
- Falla del recurso (`recreo.js` bloqueado): la portada vuelve como estaba, un aviso en la consola y un segundo doble
  clic lo intenta de nuevo.
- Desborde horizontal: 0 px. Consola: sin errores propios (sólo el 403 por límite de la API pública de GitHub que pide
  `release-data.js`, ajeno a este cambio).
- Rendimiento: en el Chromium sin GPU del entorno de prueba, la toma de las láminas tarda unos 200 ms (con las láminas
  quietas) y el vuelo corre a unos 40 cuadros por segundo a densidad 1; falta medirlo en un teléfono real.

Producción: desplegado a mano con `wrangler` desde `main` (`49ee072`, versión `59c53292`) tras `npm run verify`.
En pteron.patagua.dev la portada carga la revisión 2026-10-13.6, `recreo.js` es idéntico al del repositorio,
`/api/health` responde `{"ok":true}`, y el doble clic, el juego y el cierre funcionan en escritorio y teléfono sin
errores ni desborde.

Final result: passed (pendiente: Safari en iPhone y un teléfono de gama baja)

## Landing móvil y carga de video — 2026-07-28

Target: Pteron landing, responsive mobile correction and video loading state

Reference: `IMG_3104.PNG` and `IMG_3105.PNG` captured on the user's iPhone

Verification viewport: 393 × 852 px

### Reference findings

- Mobile display type was oversized: the headline, supporting copy, button, and note consumed too much vertical space.
- Safari displayed the scroll-film area as an almost solid black field while the MP4 was not ready to provide a seeked frame.
- `product-home-current.png` contained a large black canvas around the application window. Scaling that complete canvas made the actual product unnecessarily small.
- The scroll-film negative margins expanded the mobile stage beyond the viewport.

### Corrections verified

- Reduced and rebalanced the complete mobile type scale and spacing without changing the selected copy.
- Kept the full application window and removed only the black canvas outside it. All four rounded application edges remain visible.
- Added a full-page loading state that keeps the page hidden until the MP4 is decoded and seekable.
- Adapted the supplied medusa animation to a canvas loader using Pteron's paper, ink, and gold palette. It contains no text or visible container.
- Loads the MP4 into a local Blob before revealing the page, improving reliable seeking in iOS Safari. The poster remains as the failure fallback.
- Preloaded the poster and product image, and added intrinsic image dimensions to prevent layout shifts.
- Corrected mobile film margins. Final product-image bounds at 393 px viewport: left 16 px, right 377 px, width 361 px.
- Horizontal overflow: 0 px.
- Verified ready state after loading: loader dismissed, video class active, `readyState: 4`, Blob source active, video opacity `1`.
- Browser console: 0 errors, 0 warnings.

### Visual result

- Hero capture: `.playwright-cli/page-2026-07-28T12-53-03-014Z.png`
- Film and complete product capture: `.playwright-cli/page-2026-07-28T12-56-45-227Z.png`
- Loader capture: `.playwright-cli/loader-pteron-mobile-final.png`
- Page after video readiness: `.playwright-cli/pteron-mobile-ready-final.png`

Final result: passed

## Documentación — 2026-07-28

- source visual truth: `/Users/marcorojasbelmar/.codex/generated_images/019fa715-a99f-76e0-84af-c5e3241b485c/call_qj1xVIphMTzt8PX01cmexIp3.png`
- implementation: `http://127.0.0.1:4173/docs/`
- implementation screenshot: `/Users/marcorojasbelmar/Developer/pteron-landing/output/docs-windows-desktop.png`
- paired comparison: `/Users/marcorojasbelmar/Developer/pteron-landing/.playwright-cli/page-2026-07-28T19-49-20-422Z.png`
- viewport: 1440 × 1024 CSS px
- source pixels: 1487 × 1058
- implementation pixels: 1440 × 1024
- device scale factor: 1
- normalization: both full-page designs were displayed at equal CSS width in the paired comparison; their aspect ratios differ by less than 0.1%.
- state: Windows installation article, light theme, top of page

## Findings

No actionable P0, P1 or P2 findings remain.

- Fonts and typography: the selected concept used an editorial serif throughout the article. Per the approved direction, the implementation intentionally limits Newsreader to the single header wordmark and uses DM Sans for the documentation UI and article hierarchy. This is a controlled deviation that makes the result more technical and prevents repetition of the pteron display treatment.
- Spacing and layout rhythm: the three-column reading structure, sticky search, sidebar grouping, restrained borders and above-the-fold installation sequence match the source hierarchy. The implementation is slightly denser and uses fewer decorative elements.
- Colors and tokens: ivory paper, navy ink, muted blue, sand warning and ochre section labels map to the reference and the existing pteron palette. Contrast remains clear on the warning and navigation states.
- Image quality: the real 2242 × 1540 product capture is rendered at its native aspect ratio with `height: auto`; all four application edges remain visible. No screenshot crop, black placeholder or generated replacement is used.
- Copy and content: the implementation is shorter and more explicit than the concept. It states that Windows 11 is supported in beta, that the installer is unsigned, what SmartScreen may show, and how to verify the official source. It does not promise a stable date.
- Icons: the final implementation does not reproduce the concept’s decorative line icons because the information architecture no longer needs them. No fake SVG, emoji or CSS illustration replaces a required asset.
- Accessibility and behavior: skip link, semantic navigation, labelled search, keyboard shortcut, focus state, responsive menu state/label, reduced-motion support and meaningful image alt text are present.

## Focused region evidence

- Windows warning and numbered steps were inspected at 1440 × 1024 and 390 × 844.
- The complete product capture was inspected at mobile width after scrolling it into view; its borders and corners remain present.
- The version table was inspected at 900 × 800 with no horizontal page overflow.

## Comparison history

### Pass 1 — blocked

- P2: the first implementation separated installation into three long sections, pushing the product capture almost entirely below the 1024 px viewport and drifting from the selected concept’s compact procedural rhythm.
- P2: the 761–1080 px breakpoint hid the global navigation even though there was enough space, reducing discoverability on tablets.
- P2: the mobile menu opened correctly but did not change its control text or accessible label to communicate the close action.

Fixes:

- Replaced the long Windows sequence with a compact five-step list, then moved the detailed verification note below the real product capture.
- Kept the global navigation visible through the tablet breakpoint.
- Added synchronized `Menú`/`Cerrar`, `aria-expanded` and accessible-label states.

### Pass 2 — passed

- Paired source/implementation evidence shows the product capture entering the first viewport, compact steps, matching three-column structure, and the intentional sans-first technical treatment.
- Desktop, tablet and mobile layouts have no horizontal overflow.
- Search, internal route navigation, mobile menu, version-data rendering and the next-page path were exercised.
- Browser console: 0 errors on application routes reached through the SPA navigation.

## Residual P3 polish

- The right-side table of contents could highlight the section currently crossing the reading position; its links already work.
- The search result list could support arrow-key selection in a later accessibility refinement.

final result: passed

## Lanzamiento 0.2.12 y Linux — 2026-08-11

Target: landing, downloads, documentation, plans and terms after adding Linux x86_64 beta support.

Verification viewports: 1440 × 900 px and 390 × 844 px in the collaborative browser against the local HTTP server.

### Corrections verified

- Added Linux as a third platform without naming distributions that were or were not tested.
- Made AppImage the primary Linux download and exposed `.deb`, `.rpm` and `.tar.gz` as alternatives.
- Added the public GPG key, its fingerprint and detached-signature links.
- Added Linux installation and update documentation. Only the AppImage is described as using the internal updater; the package and archive formats use manual updates.
- Kept AUR out of all public copy until that channel exists.
- Reproduced an intermittent stale-cache failure in which current HTML was overwritten by cached JavaScript that still rendered 0.2.10. Versioned changed CSS and JavaScript URLs with `?v=0.2.12`; the download page then consistently rendered 0.2.12.
- Hardened release discovery: bundled data and the public GitHub Releases API are combined using semantic-version ordering, and an update is announced only when the full release asset matrix is present. A local complete fallback keeps the page useful during source failures.
- Rendered remote release notes as text rather than HTML.
- Verified home, downloads, Linux documentation, version history, plans and terms on desktop and mobile.
- No horizontal page overflow was observed. The responsive version table retains its intentional internal horizontal scroller on narrow screens.
- The home and download videos reached `readyState: 4` and played after loading in both tested viewports.
- JavaScript syntax checks passed; `node --test tests/*.test.js` passed 32/32; `git diff --check` passed.

Final result: passed locally. Production verification remains required after deployment.

## Versiones automáticas y capturas 0.5.4 — 2026-09-18

Target: landing, descargas y documentación después de quitar toda versión escrita a mano.

### Correcciones verificadas

- Se retiró el fallback con versión fija (`FALLBACK_VERSION`/`FALLBACK_RELEASE`, 0.2.12) de `release-data.js`. El catálogo se arma sólo con el `docs/data/releases.json` incluido y la API pública de GitHub; `latest` es `null` cuando no hay una versión completa.
- La página de descargas no contiene ninguna versión: las tres etiquetas de plataforma son neutras y los diez enlaces apuntan a la página oficial de versiones. Ya no aparece «0.2.12» antes de que el JavaScript resuelva el catálogo.
- `/descargar/` con ambas fuentes bloqueadas: sin versión en pantalla, etiquetas neutras, botones y enlace de estado hacia las versiones publicadas, y una línea que declara que no se pudo comprobar la última versión. Desborde horizontal 0 px.
- `/descargar/` con catálogo: «versión 0.5.4» en las tres etiquetas, URLs exactas de los artefactos, video con `readyState: 4` y visible.
- `/docs/?pagina=versiones`: con catálogo, versión, canal, fecha y notas; con ambas fuentes bloqueadas, la página dice que no pudo comprobar la versión en vez de dejar el marcador de carga. El renderizador del estado sin datos recibe sus nodos de tabla y notas como argumentos: una versión anterior los referenciaba fuera de alcance y fallaba en silencio.
- Hero de la home: `/assets/product-home-0-5-4.webp` (2240 × 1369) reemplaza la captura 0.4.7. Límites en móvil a 393 × 852: izquierda 16 px, derecha 377 px, ancho 361 px; desborde horizontal 0 px.
- Las 15 figuras de la documentación se reemplazaron por capturas 1440 × 880 de la compilación 0.5.4 y se renombraron con el sufijo `-0-5-4`, porque `/assets/*` se sirve `immutable`.
- La clave de caché pasó de `?v=0.4.4-4` a la revisión del sitio `?v=2026-09-18.1` en los nueve HTML que cargan CSS o JavaScript compartidos.

### Capturas

Producidas con el arnés del producto (`node scripts/capture-design-qa.mjs --scenes … --viewports 1440x880 --theme light`), que exigió añadir `1440x880` a los tamaños seleccionables: no forma parte de la matriz por defecto de tres tamaños. Las capturas crudas son 2880 × 1760 y se recodificaron con `cwebp -q 82` a 2240 × 1369 (hero) y 1760 × 1076 (figuras).

Correspondencia de escenas: home → product-home-0-5-4 / app-inicio-0-5-4, home-rumbo → app-rumbo, tabs → app-sesiones, memory → app-memoria, conversacion → app-conversacion, library → app-biblioteca, plan → app-plan, revision → app-revision, dual → app-referencia, artifact → app-artefacto, writer → app-write (reemplaza la figura de guía apaisada), presentation → app-presentacion, privacy → app-datos, settings-model → app-modelo, export-error → app-error-exportar.

### Documentación

- Toda ruta «Ajustes» pasó a «Configuración», con los nombres vigentes de sus secciones: Modelo de IA, Perfil (carpeta, apariencia y licencia), Memoria y contexto y Labs (iPhone).
- Se añadieron los cuatro espacios (Chats, Biblioteca, Planificador, Configuración), el tema claro u oscuro, la cinta de Write y Present, las hojas físicas y la configuración de página, las ecuaciones dentro del documento y las fuentes externas opt-in.
- La tabla de exportación coincide ahora con las acciones publicadas (`Guardar DOCX…`, `Guardar PPTX…`, `Guardar PDF…` dentro de «Documento imprimible», Archivo → Exportar en los editores) y ya no lista el «Compartir» retirado.
- El espacio Planificador se declara en implementación y se distingue del rumbo conversacional que produce una planificación.

### Comprobaciones

`node --check` sobre los cuatro scripts modificados, `node --test tests/*.test.js` (33 aprobadas; 2 fallas previas en `activation-exchange.test.js`, archivos ajenos a este cambio), `git diff --check` y el recorrido de navegador descrito, a 1440 × 900 y 393 × 852.

Final result: passed locally. Production verification remains required after deployment.

### Pendientes

- `assets/og-pteron-v3.jpg` todavía muestra la interfaz anterior a 0.4.7 (rumbos Guía / Planificación / Evaluación / Rúbrica y avatar) y se sirve `immutable`, así que necesita un nombre nuevo cuando se rediseñe.
- Los 16 recursos reemplazados (`assets/docs/app-*.webp` y `assets/product-home-0-4-7.webp`) ya no están referenciados y esperan autorización para su borrado.

## Sistema visual alineado con la app — 2026-09-23

Target: landing + planes + cuenta + legal + docs. La web no se parecía al
sistema visual de pteron (`docs/INTERFAZ.md`); se refactorizó el sistema
compartido y se revisó el proyecto línea a línea.

### Referencia

- Gramática oficial: `pteron/docs/INTERFAZ.md` (tokens Blue/Sky/Gold/Sand/Ivory,
  IBM Plex Serif/Sans, wordmark Iowan/Baskerville, controles de tres roles).
- Captura de producto del editor Write (cinta, papel, panel Organizar material).

### Cambios verificados

- Tokens: Blue `#0F2238`, Sky `#496A8E`, Gold `#C9A261` (sólo decoración),
  Sand `#E6D8C0`, Ivory `#F6F2EC`. Foco con anillo Gold.
- Tipografía: IBM Plex Serif/Sans en todas las páginas; wordmark Iowan/Baskerville.
- Controles: dominante relleno Blue; secundario píldora Sand; discreto texto.
  Se retiró el override que pintaba `.button-outline` como botón sólido.
- Oro fuera de interacciones (enlaces/hover usan Blue).
- Motion: `--mo-xs…--mo-xl` + curvas `--ease-out`/`--ease-inout`. Stagger 45 ms
  en las tarjetas de principios. `prefers-reduced-motion` cancela desplazamiento
  y conserva opacidad.
- Dead CSS retirado: `.editor-window`, `.process-list`, `.statement`.
- Loader medusa y descarga con la paleta nueva.
- Cuenta: bordes Sand, radios 10 px, tipografía de marca, escala tipográfica
  alineada; se eliminó el uso de `--line-strong` inexistente.
- Caché compartida sincronizada en `?v=2026-09-25.4` en los HTML que cargan
  CSS/JS compartidos (incluye `script.js`, `release-data.js`, `download.js`,
  `docs/*.js`).

### Comprobaciones

- Tokens computados en navegador: body IBM Plex Sans `rgb(15,34,56)` sobre
  `rgb(246,242,236)`; botón dominante Blue; tarjetas con borde Sand `#E6D8C0`.
- 1440×1024 y 393×852: desborde horizontal 0; consola 0 errores/avisos.
- `/planes/`: overflow 0; `.button-outline` como píldora secundaria.

### Capturas de esta pasada

- `.playwright-cli/page-2026-09-23T20-54-07-996Z.png` — principios 1440.
- `/tmp/qa-new-hero.png`, `/tmp/qa-new-principios.png`, `/tmp/qa-new-mobile.png`
  (clasificación de paleta por píxeles).

Final result: passed locally.

## Eficiencia y pulido general — 2026-09-25

Target: landing, planes, descargar, docs, cuenta y legal. Sin regresiones
visuales sobre el sistema IBM Plex ya publicado.

### Mejoras de funcionamiento

- **Revelado desacoplado del vídeo**: la página aparece al terminar fuentes + el
  tiempo mínimo de la medusa (~380 ms). El scroll-film pinta su póster hasta que
  el MP4 está decodificado y es scrubbable. Antes el sitio esperaba la descarga
  completa (13–22 MB) o un soft-timeout de 45 s.
- **Fuente de vídeo adaptativa**: se prefiere `src` directo con range requests;
  iOS/WebKit siguen con Blob para scrubbing fiable; si un host no permite
  scrubbing (p. ej. `http.server` sin Range), cae a Blob automáticamente.
- **Watchdog de seek**: un seek colgado ya no congela el film para el resto de
  la sesión.
- **Geometría del film cacheada**: `offsetTop`/`offsetHeight` se miden en resize,
  no en cada frame de scroll.
- **Medusa más ligera**: 3 600 partículas con la misma silueta (espacio de
  parámetros original remapeado), ~3× menos trabajo por frame.
- **Descarga**: elige el MP4 ligero también con `saveData` o conexión 3G.
- **Docs**: el índice «En esta página» marca la sección visible (scroll-spy) y
  la búsqueda admite flechas ↑↓ y Enter.
- **Fuentes**: se retiró el peso Serif 600 no usado de la URL de Google Fonts.
- **Caché**: revisión de sitio `?v=2026-09-25.4` en todos los HTML que cargan
  CSS/JS compartidos (incluye `cuenta.js`).

### Comprobaciones

- `node --check` en `script.js`, `download.js`, `docs/app.js`, `release-data.js`,
  `cuenta.js`. `node --test tests/*.test.js` 35/35.
- Sweep 8 rutas × 2 viewports (1440×900 y 393×852): desborde horizontal 0,
  consola 0 errores, tipografía IBM Plex activa.
- Revelado home: ~630 ms locales (antes condicionado a la descarga del vídeo).
  Planes/cuenta ~410 ms (tiempo mínimo de medusa coherente).
- Scroll-film frame a frame: `currentTime` 0.00 → 4.86 → 9.73 → 14.59 → 19.46 s
  con `progress` 00/25/50/75/100 y `is-video-ready` activo.
- `prefers-reduced-motion: reduce`: revelado inmediato, reveals visibles,
  desborde 0.
- Menú móvil, búsqueda de docs con cursor de teclado, tarjetas de principios,
  planes, cuenta, legal y descarga inspeccionados en captura real.

Final result: passed locally. Production verification remains required after deployment.

## Capturas 0.6.0 en documentación — 2026-09-27

Target: figuras de `/docs/` y hero de la home. Fuente: build de pteron 0.6.0
(`out/`), extraído con `scripts/extract-pteron-captures.mjs` hacia
`output/captures-0-6-0/` sin escribir en el repositorio de pteron.

### Correspondencia de escenas

| Figura docs | Escena del arnés |
| --- | --- |
| app-inicio / product-home-window | home |
| app-rumbo | home-rumbo |
| app-sesiones | tabs |
| app-memoria | memory |
| app-conversacion | conversacion |
| app-biblioteca | library |
| app-plan | plan-ready |
| app-revision | revision |
| app-referencia | pdf (layout dual, ADR-134) |
| app-artefacto / app-write | writer |
| app-presentacion | presentation |
| app-datos | privacy |
| app-modelo | settings-model |
| app-error-exportar | export-error |

Las escenas `artifact` / `artifact-fin` fallan en 0.6.0 su gate de semántica
(`.document-page[contenteditable="true"]`); esa figura se cubre con `writer`,
que sí publica el editor Write completo.

### Producción

- Capturas crudas 2880 × 1760 (1440 × 880 @2x) recodificadas a webp q82
  1760 × 1076, el mismo encuadre que las figuras 0-5-4.
- `docs/content.js` apunta a `*-0-6-0.webp`; alts y pies ajustados a la UI
  vigente (biblioteca integrada, plan listo, revisión comparada, proveedores
  Xiaomi MiMo / Z.AI / personalizados).
- Hero: `assets/product-home-window-0-6-0.webp` (1760 × 1076).
- Caché de docs `?v=2026-09-27.1`.

### Comprobaciones

- 15 figuras 0.6.0 en `assets/docs/`; barrido de 15 páginas de docs: 0 imágenes
  rotas, `naturalWidth` 1760 en todas.
- `node --check` en `content.js` y `app.js`; `node --test tests/*.test.js` 35/35.
- Sin cambios en el repositorio de pteron (sólo lectura de `out/` y scripts).

Final result: passed locally. Production verification remains required after deployment.

## Material rico y GIFs en docs — 2026-09-27

- Figuras nuevas desde el fixture de pteron 0.6.0: `app-guia-encabezado` (guía
  con encabezado tipado, ítems y estructura), `app-guia-top` (figuras, diagrama
  Mermaid y tabla), `app-write-doc`, `app-biblioteca-detalle`,
  `app-presentacion-lienzo`, `app-rumbo-compositor`.
- GIFs animados (1100 px, ~110–210 KB): `guia-completa`, `biblioteca`,
  `presentacion`, `home-rumbo`, `guia-scroll` en `assets/docs/gifs/`.
- Página Documentos (`artefactos`) reescrita para mostrar el nivel real de
  guías/evaluaciones y el formato de ítems, pauta y exportación.
- Pipeline: `scripts/capture-rich-media.mjs` (Playwright Electron + ffmpeg).
  Sin escritura en el repositorio de pteron.

## Versiones legibles y contraste en descargas — 2026-10-04

Target: `/docs/?pagina=versiones` y `/descargar/`.

- Las notas de versión dejaron de ser un listado plano: `release-data.js` parsea
  el cuerpo markdown del release en bloques (resumen, lista, notas al pie,
  secciones), descarta el título que repetía la versión y recorta por palabra.
  `docs/data/releases.json` se regeneró con el mismo parser.
- La última versión se lee completa; las anteriores quedan plegadas en
  `<details>`. La página pasó de ~8400 px a ~2700 px de alto en escritorio.
- `/descargar/`: el wordmark y el titular vuelven a ser blancos sobre el video,
  el velo de la columna de contenido sube y los botones secundarios ganan
  opacidad. Verificado en dos fotogramas con la medusa brillante detrás del
  titular y en móvil.
- Capturas: `.playwright-cli/review/after-versiones-*` y
  `.playwright-cli/review/after2-descargar-*`.
- Comprobaciones: fallback sin API (JSON empaquetado) renderiza igual;
  axe 0 violaciones (contraste sobre video queda como revisión manual);
  `node --test tests/*.test.js` 36/36.


## 2026-10-12 · Rediseño «La hora azul» y panel de administración

- Dirección elegida por jurado (tres jueces, referencias Opero y Shotbase) y
  construida por un sistema compartido más hojas por página. Fotografía CC de
  Wikimedia Commons, timelapses de ESO (CC BY 4.0), capturas reales de pteron
  0.7 con el marco de ventana real, atlas de asignaturas con láminas de dominio
  público y texturas propias, película con scroll en el inicio y vídeo en bucle
  en /descargar, aurora generativa con póster estático.
- Prohibiciones del dueño aplicadas: sin cursivas (salvo wordmark), sin
  píldoras de estado con punto, sin avisos con borde izquierdo, dos familias
  tipográficas más una mono para datos.
- Verificación: 10 páginas × 2 anchos × 2 esquemas sin desborde ni errores de
  consola; hooks de cuenta.js, download.js, docs/app.js, admin.js y script.js
  completos; 118 URL internas en 200; metadatos y canonical sin barra; menú
  móvil, buscador de la documentación, descargas 0.7.0 y cuenta con sesión
  simulada probados con Playwright; sin JS y con movimiento reducido todo el
  contenido queda visible; inicio 1,2 MB iniciales a 1440.
- Pendiente: probar la película con scroll en Safari e iOS (ruta Blob), que no
  se puede ejecutar en el entorno de pruebas.

## 2026-10-12 · «La lámina y la figura»: la web rehecha desde cero

- Concepto: las láminas del atlas (recortes de dominio público y tres piezas
  propias) flotan al cargar; al pasar el puntero o tocarlas se dan vuelta y
  muestran una figura de pteron. Con el desplazamiento vuelan y calzan sobre esa
  figura en cuatro hojas oficio que se imprimen; las demás se retiran. Las hojas
  las arma el código de Write de pteron y las figuras su motor
  (`scripts/pteron-hojas.mjs`), así que el material que se ve es el que produce
  la app.
- Sistema nuevo: la mesa de pteron (#E9EDF1) como fondo, Archivo variable para
  todo el sitio y la marca dibujada con su contorno (sin la letra de la marca en
  el resto del sitio). Sin barra superior: Descargar y una esquina doblada que
  abre el índice; colofón común en todas las páginas (`scripts/sitio.mjs`).
- Páginas rehechas: inicio, planes, descargar, cuenta, documentación,
  privacidad (con créditos lámina por lámina), términos, 404 y administración.
  Los hooks de `cuenta.js`, `download.js`, `docs/app.js` y `admin.js` se
  conservan; `docs/app.js` cambia sólo su marcado y ahora respeta un ancla al
  llegar.
- Verificación: `npm run verify` completo (sintaxis, empaquetado en seco, 114
  pruebas y humo contra `wrangler dev`). Capturas a 1440 × 900 y 390 × 844 de
  todas las páginas, sin desborde horizontal ni errores de consola; la escena
  del inicio revisada en siete puntos del desplazamiento en escritorio y seis
  en móvil, más la secuencia de la ventana, las dos versiones de la hoja, el
  aviso de datos, el índice (abre, Escape cierra y devuelve el foco), sin
  JavaScript y con movimiento reducido. Cuenta (plan en prueba, activación
  pendiente) y administración (resumen, detalle, consumo) probadas con la API
  simulada. Contraste: texto informativo en `--grafito` (4,6:1 sobre la mesa) y
  `--suave` subido a #68778C (4,6:1 sobre blanco).
- Pendiente: revisar en Safari e iOS reales el vuelo de las láminas (el
  entorno de pruebas sólo tiene Chromium).
