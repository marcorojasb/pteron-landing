# Marca de pteron · propuesta de actualización (octubre de 2026)

Estado: aplicada en la web (rama `claude/lucid-galileo-p8x5t3`, vista previa tetris-r2); pendiente en la app.
La página pública es `/marca`; este archivo registra la decisión y lo que falta para que la app la adopte.

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
2. **Icono**: la «p» de esa marca, con su corte, en blanco sobre el azul. A 16 y 32 px, la letra se engruesa medio
   píxel por lado.
3. **Color** (los de las hojas de pteron):
   - tinta `#1F2A3D` (classroom.ink) para el texto;
   - azul `#1E3F94` (classroom.navy) para títulos, enlaces y la marca;
   - lápiz `#F0C060` (figura.area.a2) sólo para la acción principal y como destacador, nunca en cápsulas;
   - mesa `#E9EDF1` (el lienzo de Write) de fondo y hoja `#FFFFFF` para lo que es papel;
   - grafito `#5B6B82` (classroom.muted) para el texto secundario.
   En fotocopia: azul 71 % de gris, tinta 83 %, lápiz 20 %, mesa 6 %.
4. **Letra**: Archivo (Omnibus-Type, OFL) compone la web, con la jerarquía hecha por ancho y peso. Outfit es la letra
   de la marca y de las figuras y los títulos de las hojas de pteron; en la web no compone texto. El texto de la hoja
   va en Arial y la pauta de caligrafía de primer ciclo, en Playwrite CL; la interfaz de la app, en IBM Plex.
5. **Láminas y figuras**: obras de dominio público o piezas propias, recortadas en piezas de cuatro cuadrados, con la
   figura de pteron detrás y su crédito siempre.
6. **La hoja**: oficio por omisión. En la web, la página es una hoja: la esquina de arriba a la derecha se dobla y
   abre el índice; la marca va como membrete arriba a la izquierda.

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

## Pendiente en la app (repositorio pteron, no se tocó desde aquí)

- Un ADR en `docs/DECISIONES.md` con esta decisión, y la línea 45 de `docs/INTERFAZ.md` («paleta navy/gold/ivory»)
  y los tokens de marca de «Gramática visual» separados de los de la interfaz.
- `build/icon.svg`: la «p» blanca sobre `#1E3F94` (la misma de `public/assets/marca/p-azul.svg`) y `npm run icon`.
  Hasta entonces la web no muestra el icono de la app, para no tener dos iconos en la misma página.
- El «pteron» de Home (`.home-hero h1`), el de arranque (`.startup-brand`) y el de `index.html` (`.boot-wordmark`)
  se escriben con `--font-brand` (Iowan Old Style; fuera de macOS, Times New Roman o Liberation Serif). Para adoptar
  la marca: dibujar el trazado de `public/assets/marca.svg` en línea, con el degradado de hoy, como ya lo hace
  `public/pteron-ventana.js` con el contorno de Iowan, y en `index.html` el mismo trazado con `fill: #d2dbe2`. A
  igual ancho que hoy (unas 2,7 em del h1), la marca nueva se probó en la réplica del Home y del arranque: se ve
  igual en macOS, Windows y Linux.
- Mientras la app no la adopte, la ventana de la web sigue mostrando el «pteron» de Iowan, porque muestra la app tal
  como es. Cuando la app cambie, basta con cambiar `WORDMARK` y su caja en `public/pteron-ventana.js`.
- El plan se llama «Basic» en la web y en parte de la app, y «Básico» en `src/shared/licensing.ts`: conviene
  elegir uno.
