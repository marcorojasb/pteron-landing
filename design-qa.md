# Design QA

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
- Caché compartida sincronizada en `?v=2026-09-25.1` en los HTML que cargan
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
- **Caché**: revisión de sitio `?v=2026-09-25.1` en todos los HTML que cargan
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
