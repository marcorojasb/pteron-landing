# Marca de pteron · propuesta de actualización (octubre de 2026)

Estado: aplicada en la web (rama `claude/lucid-galileo-p8x5t3`, vista previa tetris-r2); pendiente en la app.
La página pública es `/marca`; este archivo registra la decisión y lo que falta para que la app la adopte.

## Contexto

La doctrina vigente de pteron (INTERFAZ.md, «Gramática visual») fija una marca tipográfica con la paleta
navy/gold/ivory (`#0F2238`, `#C9A261`, `#F6F2EC`) y el icono de la app es una «p» dorada de IBM Plex Serif sobre un
degradado navy. La web rehecha («La lámina y la figura») tomó otra paleta, que no es inventada: es la de los
materiales que pteron produce. Marco la aprobó como actualización de la marca.

## Decisión

1. **Marca**: sigue siendo tipográfica (ADR-045: sin isotipo, sin alas ni rombos). Es un dibujo, no una letra: el
   contorno de `public/assets/marca.svg`, «pteron» en Iowan Old Style tal como la app lo muestra en macOS. Siempre
   «pteron», en minúscula. Espacio libre: el alto de su «o». Tamaño mínimo: 30 px de alto en pantalla, 8 mm en papel.
2. **Icono**: la «p» de esa marca, en blanco sobre el azul. A 16 y 32 px, la letra se engruesa medio píxel por lado.
3. **Color** (los de las hojas de pteron):
   - tinta `#1F2A3D` (classroom.ink) para el texto;
   - azul `#1E3F94` (classroom.navy) para títulos, enlaces y la marca;
   - lápiz `#F0C060` (figura.area.a2) sólo para la acción principal y como destacador, nunca en cápsulas;
   - mesa `#E9EDF1` (el lienzo de Write) de fondo y hoja `#FFFFFF` para lo que es papel;
   - grafito `#5B6B82` (classroom.muted) para el texto secundario.
   En fotocopia: azul 71 % de gris, tinta 83 %, lápiz 20 %, mesa 6 %.
4. **Letra**: Archivo (Omnibus-Type, OFL) en las superficies de marca, con la jerarquía hecha por ancho y peso. La
   letra de la marca vive sólo en la marca. Los materiales siguen en Outfit y Playwrite CL; la interfaz de la app, en
   IBM Plex.
5. **Láminas y figuras**: obras de dominio público o piezas propias, recortadas en piezas de cuatro cuadrados, con la
   figura de pteron detrás y su crédito siempre.
6. **La hoja**: oficio por omisión. En la web, la página es una hoja: la esquina de arriba a la derecha se dobla y
   abre el índice; la marca va como membrete arriba a la izquierda.

## Pendiente en la app (repositorio pteron, no se tocó desde aquí)

- Un ADR en `docs/DECISIONES.md` con esta decisión, y la línea 45 de `docs/INTERFAZ.md` («paleta navy/gold/ivory»)
  y los tokens de marca de «Gramática visual» separados de los de la interfaz.
- `build/icon.svg`: la «p» blanca sobre `#1E3F94` (la misma de `public/assets/marca/p-azul.svg`) y `npm run icon`.
  Hasta entonces la web no muestra el icono de la app, para no tener dos iconos en la misma página.
- El wordmark de Home y de la marca de arranque se escriben con la pila `Iowan Old Style, Baskerville`: fuera de
  macOS se ven en Times New Roman o en Liberation Serif. Dibujarlos con el contorno (como la web) los deja iguales en
  Windows y Linux. La ventana de la web muestra la app como se ve en macOS.
- El plan se llama «Basic» en la web y en parte de la app, y «Básico» en `src/shared/licensing.ts`: conviene
  elegir uno.
