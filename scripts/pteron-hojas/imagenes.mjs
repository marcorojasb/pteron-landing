/**
 * Las imágenes del atlas que scripts/pteron-hojas.mjs pone en el inicio (las láminas) y en la cabecera de planes,
 * descargar y cuenta (la pieza). Viven aparte del generador para que tests/hojas.test.js compruebe, sin el código de
 * pteron, que el HTML publicado trae justo lo que el generador escribiría.
 */

// Un GIF transparente de un píxel: donde la lámina no se muestra, la <source> que lo nombra evita bajar la del atlas
export const NADA = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const atlas = (archivo, size, version) => `/assets/atlas/${archivo}-${size}.webp?v=${version}`;

/** La imagen de una lámina del inicio. La cara y la sombra llevan la misma, así el navegador baja un solo archivo. sizes
 *  sigue el ancho que le da inicio.css (--w × 0,82vmax; en el teléfono, --wm vw): con DPR 1 basta la de 300. Las láminas
 *  sólo de escritorio quedan ocultas hasta 760 px y ahí piden el GIF vacío. */
export function imagenLamina(lamina, version) {
  const w = lamina.escritorio[2];
  const sizes = `(max-width: 760px) ${lamina.movil ? lamina.movil[2] : w}vw, ${+(w * 0.82).toFixed(2)}vmax`;
  const img = `<img src="${atlas(lamina.archivo, 600, version)}" srcset="${atlas(lamina.archivo, 300, version)} 300w, ${atlas(lamina.archivo, 600, version)} 600w" sizes="${sizes}" alt="" decoding="async" draggable="false">`;
  return lamina.movil ? img : `<picture><source media="(max-width: 760px)" srcset="${NADA}">${img}</picture>`;
}

/** La imagen de la pieza de cabecera. Bajo 560 px la pieza no se muestra (styles.css) y pide el GIF vacío. */
export function imagenPieza(lamina, version) {
  return `<picture><source media="(max-width: 560px)" srcset="${NADA}">`
    + `<img src="${atlas(lamina.archivo, 600, version)}" srcset="${atlas(lamina.archivo, 300, version)} 300w, ${atlas(lamina.archivo, 600, version)} 600w" sizes="(max-width: 760px) 120px, 240px" width="600" height="600" alt="" decoding="async" draggable="false"></picture>`;
}
