# Marca de pteron · propuesta de actualización (octubre de 2026)

Estado: aplicada en la web (rama `claude/lucid-galileo-p8x5t3`, vista previa tetris-r2); en la app, lista para
aplicar con los parches del kit completo (ADR-169 y ADR-170 de la app). La página pública es `/marca`; la
especificación entera, con cada medida, es `kit/LENGUAJE.md`, y sus archivos salen de `node scripts/kit.mjs`. Este
archivo registra la decisión y cómo se tomó.

## Contexto

La doctrina vigente de pteron (INTERFAZ.md, «Gramática visual») fija una marca tipográfica con la paleta
navy/gold/ivory (`#0F2238`, `#C9A261`, `#F6F2EC`) y el icono de la app es una «p» dorada de IBM Plex Serif sobre un
degradado navy. La web rehecha («La lámina y la figura») tomó otra paleta, que no es inventada: es la de los
materiales que pteron produce. Marco la aprobó como actualización de la marca y pidió otra letra para «pteron»: la
Iowan Old Style de la app no lo convencía.

## Decisión

1. **Marca**: sigue siendo tipográfica (ADR-045: sin isotipo, sin alas ni rombos). Es un dibujo, no una letra: el
   contorno de `public/assets/marca.svg`, «pteron» en Outfit 600, la letra con que pteron rotula sus figuras, con dos
   cortes propios: la esquina de arriba a la derecha de la «t», doblada a 45° como la hoja de la web, y la esquina
   opuesta de la «p». Lo escribe `scripts/marca-trazado.py`. Siempre «pteron», en minúscula. Espacio libre: el alto
   de su «o». Tamaño mínimo: 30 px de alto en pantalla, 8 mm en papel.
2. **Icono**: la «p» de esa marca, con su corte, en blanco sobre el azul, con esquinas de radio 229 en 1024 (el que ya
   usa `build/icon.svg` en la app). A 16 y 32 px, la letra se engruesa medio píxel por lado y el radio baja a 200.
3. **Color** (los de las hojas de pteron):
   - tinta `#1F2A3D` (classroom.ink) para el texto;
   - azul `#1E3F94` (classroom.navy) para títulos, enlaces y la marca;
   - lápiz `#F0C060` (figura.area.a2) sólo para la acción principal y como destacador, nunca en cápsulas;
   - mesa `#E9EDF1` (el lienzo de Write) de fondo y hoja `#FFFFFF` para lo que es papel;
   - grafito `#5B6B82` (classroom.muted) para el texto secundario.
   En fotocopia: azul 71 % de gris, tinta 83 %, lápiz 20 %, mesa 6 %.
4. **Letra**: Archivo (Omnibus-Type, OFL) compone la web, con la jerarquía hecha por ancho y peso. Outfit es la letra
   de la marca y de las hojas de pteron —su texto, sus títulos y sus figuras—; en la web no compone texto. La pauta de
   caligrafía de primer ciclo va en Playwrite CL, las diapositivas en Arial y la interfaz de la app en IBM Plex.
5. **Láminas y figuras**: obras de dominio público o piezas propias, recortadas en escalera (uno, tres o seis
   cuadros), con la figura de pteron detrás y su crédito siempre.
6. **La hoja**: oficio por omisión. En la web, la página es una hoja: la esquina de arriba a la derecha se dobla y
   abre el índice; la marca va como membrete arriba a la izquierda. En el material, nunca: las hojas que arma pteron
   llevan el membrete del establecimiento que el profe configura en Perfil, o ninguno (`src/shared/school-brand.ts`,
   ADR-140), y su pie dice sólo el título y «Pág. N de M». Ni la marca ni la «p» van en hojas, exportaciones, marcas
   de agua o el centro de un código QR.
7. **Geometría**: dos gestos y nada más. El doblez a 45° (la esquina que abre el índice y los cortes de la «t» y la
   «p») y la escalera sobre la cuadrícula (las láminas, de uno, tres o seis cuadros, y la pieza que falta en la hoja
   del 404). La esquina doblada significa índice y no se usa como adorno.

## Cómo se eligió la letra

Se compusieron nueve letras libres con su propio kerning; las finalistas se probaron en el membrete junto a un
título, en el colofón, en el Home y el arranque de la app (la réplica de la ventana), en el icono a 180, 32 y 16 px y
sobre el azul. Quedaron fuera:

- Iowan Old Style, la marca anterior: una serif de libro sin rasgo propio, que fuera de macOS la app cambia por Times.
- Archivo ancha con la esquina doblada: los títulos de la web ya son Archivo al 118 % en azul, y la marca se leía
  como un título más.
- Playwrite CL engrosada, la letra escolar chilena: la más cercana a la sala, pero su «p» es abierta (así la enseña
  el modelo chileno) y sola, en el icono, se lee «ρ» o «r». En pteron es, además, la letra de la pauta de caligrafía
  de primer ciclo.
- Atkinson Hyperlegible, Andika, Lexend, Bricolage Grotesque, Instrument Sans y Schibsted Grotesk: sin un rasgo
  propio en «pteron», o letras que ya se asocian a plantillas.

Outfit se distingue de los títulos (geométrica frente a grotesca), su «p» funciona sola en el icono y es la letra de
las figuras de pteron: la marca y lo que pteron dibuja hablan igual.

## En la app

El kit completo (`dist/pteron-lenguaje-1.0.0.zip`, que no se publica) trae tres parches para el repositorio de
pteron y su guía, `app/APLICAR.md`:

- ADR-169: la marca dibujada en línea en la Home, el arranque y la carga, como marca de agua de un solo color que se
  disuelve hacia abajo, a la misma escala que la letra anterior; el icono del kit para macOS (en su cuadrícula de
  824), Windows y Linux, con pruebas que fijan sus sumas. Se retira `--font-brand`.
- ADR-170: los tokens de la app con los colores de las hojas, en claro y en el oscuro de pteron-design; el foco y la
  selección en azul, el lápiz sólo como destacador y la mesa plana.
- La respuesta guardada como archivo ya no se titula «Material creado con pteron».

Mientras la app no publique una versión con estos cambios, la ventana de la web sigue mostrando el «pteron» de Iowan
y la paleta anterior, porque muestra la app tal como es; tampoco muestra el icono de la app, para no tener dos iconos
en la misma página. Cuando salga, se regeneran `public/pteron-app.css` y el `WORDMARK` de `public/pteron-ventana.js`.

Queda por elegir: «Basic» o «Básico» para el plan (la web y parte de la app dicen «Basic»; `src/shared/licensing.ts`,
«Básico»).
