/**
 * Los dibujos de la marca, en un solo lugar: el sitio (scripts/marca.mjs) y el kit del lenguaje (scripts/kit.mjs) los
 * toman de aquí, así cada archivo sale del mismo trazado, con las mismas medidas y los mismos colores.
 *
 * El único dibujo que existe es el contorno de public/assets/marca.svg («pteron» en Outfit 600 con la esquina de la «t»
 * doblada a 45° y la de la «p» en espejo; lo escribe scripts/marca-trazado.py). Todo lo demás se deriva:
 *
 *   marcaSVG(color, { aire })   la marca en un color; con su espacio libre (el alto de la «o») o ajustada al dibujo
 *   pSVG({...})                 la «p» de la marca sobre un cuadrado de 1024 (el icono y sus variantes)
 *   pChica(px)                  la «p» engruesada para 16 y 32 px
 *   ICONO, ICONO_MAC            el icono de la app, a sangre y en la cuadrícula de macOS (824 en 1024)
 *   pngs → ico(), icns()        los contenedores de Windows y macOS, armados sin dependencias
 *
 * Sin dependencias: lee el SVG del repositorio y escribe texto o bytes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Los colores de la marca (los mismos de public/styles.css y kit/tokens.json). */
export const COLOR = { azul: "#1E3F94", tinta: "#1F2A3D", blanco: "#FFFFFF", lapiz: "#F0C060", mesa: "#E9EDF1" };

// El radio de la «p» en su cuadrado de 1024: 229, el mismo de build/icon.svg en la app (cerca del 22,4 % de los iconos de
// macOS), para que el icono de la web y el de la app sean un solo dibujo. El favicon va con 200: su letra ocupa el 84 % del
// alto y un radio mayor le comería el pie de la «p».
export const RADIO = 229;
export const RADIO_FAVICON = 200;

const fuente = readFileSync(path.join(raiz, "public/assets/marca.svg"), "utf8");
export const d = /<path[^>]* d="([^"]+)"/.exec(fuente)?.[1];
if (!d) throw new Error("public/assets/marca.svg no tiene el trazado de la marca");

/** Los contornos del trazado con su caja: la marca son seis letras, tres de ellas con hueco. */
export const contornos = d
  .split(/(?=M)/)
  .filter((part) => part.trim())
  .map((part) => {
    const nums = part.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    return { d: part, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });

// La «p» es la letra que empieza más a la izquierda; su hueco es el contorno que cabe dentro de ella
const letraP = contornos.reduce((a, b) => (b.x0 < a.x0 ? b : a));
const huecoP = contornos.find((c) => c !== letraP && c.x0 > letraP.x0 && c.x1 < letraP.x1 && c.y0 > letraP.y0 && c.y1 < letraP.y1);
if (!huecoP) throw new Error("no encuentro el hueco de la «p» en la marca");
export const P = { d: letraP.d + huecoP.d, x0: letraP.x0, x1: letraP.x1, y0: letraP.y0, y1: letraP.y1 };

export const caja = {
  x0: Math.min(...contornos.map((c) => c.x0)),
  x1: Math.max(...contornos.map((c) => c.x1)),
  y0: Math.min(...contornos.map((c) => c.y0)),
  y1: Math.max(...contornos.map((c) => c.y1)),
};
export const r1 = (n) => Math.round(n * 10) / 10;

// El espacio libre de la marca es el alto de su «o»: la quinta letra entre las que no caben dentro de otra
const letras = contornos
  .filter((c) => !contornos.some((o) => o !== c && o.x0 < c.x0 && o.x1 > c.x1 && o.y0 < c.y0 && o.y1 > c.y1))
  .sort((a, b) => a.x0 - b.x0);
if (letras.length !== 6) throw new Error(`la marca debería tener seis letras y tiene ${letras.length}`);
export const AIRE = letras[4].y1 - letras[4].y0;

/**
 * La marca en un color. Con aire (por omisión) el archivo trae su espacio libre: pegada en un documento, no queda
 * apretada. Ajustada al dibujo, para quien la monta en una interfaz o en imprenta y mide el aire por su cuenta.
 */
export function marcaSVG(color, { aire = true } = {}) {
  const a = aire ? AIRE : 0;
  const w = caja.x1 - caja.x0 + 2 * a;
  const h = caja.y1 - caja.y0 + 2 * a;
  const vb = [caja.x0 - a, caja.y0 - a, w, h].map(r1).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${r1(w)}" height="${r1(h)}"><title>pteron</title><path fill="${color}" fill-rule="evenodd" d="${d}"/></svg>\n`;
}

/**
 * La «p» en un cuadrado de 1024. alto: cuánto mide la letra (con su descendente); y: dónde cae el centro de su caja,
 * un poco bajo la mitad para que el ojo de la «p» quede al centro. radio 0 para los iconos que el sistema recorta.
 * lado: el cuadrado del fondo, centrado en el lienzo; con menos de 1024 todo se achica en proporción (la cuadrícula de
 * macOS pone el icono en 824 y deja el margen alrededor).
 */
export function pSVG({ fondo, letra, alto = 600, y = 0.53, radio = 0, grosor = 0, lado = 1024 }) {
  const m = (1024 - lado) / 2;
  const s = lado / 1024;
  const k = (alto * s) / (P.y1 - P.y0);
  const cx = (P.x0 + P.x1) / 2;
  const cy = (P.y0 + P.y1) / 2;
  const t = `translate(512 ${r1(m + lado * y)}) scale(${k.toFixed(5)}) translate(${r1(-cx)} ${r1(-cy)})`;
  const caja = m ? ` x="${m}" y="${m}" width="${lado}" height="${lado}"` : ` width="1024" height="1024"`;
  const base = fondo ? `<rect${caja}${radio ? ` rx="${r1(radio * s)}"` : ""} fill="${fondo}"/>` : "";
  // grosor: un trazo del mismo color engruesa la letra para los tamaños chicos (a 16 px el trazo fino se pierde)
  const trazo = grosor ? ` stroke="${letra}" stroke-width="${grosor}" stroke-linejoin="round"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>pteron</title>${base}<path fill="${letra}" fill-rule="evenodd"${trazo} transform="${t}" d="${P.d}"/></svg>\n`;
}

// Para 16 y 32 px, la letra engruesada: medio píxel más por lado a cada tamaño (el trazo va en las unidades de la «p»,
// que se escala a 860 de 1024, o de lado)
export const pChica = (px, lado = 1024) =>
  pSVG({
    fondo: COLOR.azul,
    letra: COLOR.blanco,
    alto: 860,
    y: 0.52,
    radio: RADIO_FAVICON,
    grosor: Math.round((1024 / px) * (1024 / lado) * ((P.y1 - P.y0) / 860) * 0.9),
    lado,
  });

/** El icono de la app y de la web: la «p» blanca sobre el azul, con el radio de la app. */
export const ICONO = pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, radio: RADIO });

/**
 * El icono en la cuadrícula de macOS: el mismo dibujo en el cuadrado de 824, centrado en el lienzo de 1024. El Dock y
 * Finder muestran así los iconos de las apps; a sangre, el de pteron se vería más grande que los demás.
 */
export const LADO_MAC = 824;
export const ICONO_MAC = pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, radio: RADIO, lado: LADO_MAC });

/** Ancho y alto del viewBox de un SVG de estos. */
export function medidas(svg) {
  const [, w, h] = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  return { w: Number(w), h: Number(h) };
}

/** Un PNG a partir de un SVG, con Chromium (una página de Playwright ya abierta). */
export async function rasterizar(page, svg, ancho) {
  const { w, h } = medidas(svg);
  const alto = Math.round((ancho * h) / w);
  const datos = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setViewportSize({ width: ancho, height: alto });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${datos}" width="${ancho}" height="${alto}" style="display:block"></body></html>`);
  await page.locator("img").evaluate((img) => img.decode());
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } });
  return { png, ancho, alto };
}

/** Un .ico de Windows: un contenedor de PNG, uno por tamaño ([[px, png], ...], de menor a mayor). */
export function ico(entradas) {
  const cabeza = Buffer.alloc(6 + 16 * entradas.length);
  cabeza.writeUInt16LE(0, 0);
  cabeza.writeUInt16LE(1, 2);
  cabeza.writeUInt16LE(entradas.length, 4);
  let desde = cabeza.length;
  entradas.forEach(([px, datos], i) => {
    const o = 6 + 16 * i;
    // 256 se escribe 0 en el byte de ancho y de alto
    cabeza.writeUInt8(px >= 256 ? 0 : px, o);
    cabeza.writeUInt8(px >= 256 ? 0 : px, o + 1);
    cabeza.writeUInt16LE(1, o + 4);
    cabeza.writeUInt16LE(32, o + 6);
    cabeza.writeUInt32LE(datos.length, o + 8);
    cabeza.writeUInt32LE(desde, o + 12);
    desde += datos.length;
  });
  return Buffer.concat([cabeza, ...entradas.map(([, datos]) => datos)]);
}

/**
 * Un .icns de macOS con PNG adentro ([[tipo, png], ...]). Los tipos con PNG: icp4 16, icp5 32, icp6 64, ic07 128,
 * ic08 256, ic09 512, ic10 1024 (512 @2x), ic11 32 (16 @2x), ic12 64 (32 @2x), ic13 256 (128 @2x), ic14 512 (256 @2x).
 */
export function icns(entradas) {
  const bloques = entradas.map(([tipo, datos]) => {
    const cabeza = Buffer.alloc(8);
    cabeza.write(tipo, 0, "ascii");
    cabeza.writeUInt32BE(datos.length + 8, 4);
    return Buffer.concat([cabeza, datos]);
  });
  const total = 8 + bloques.reduce((n, b) => n + b.length, 0);
  const cabeza = Buffer.alloc(8);
  cabeza.write("icns", 0, "ascii");
  cabeza.writeUInt32BE(total, 4);
  return Buffer.concat([cabeza, ...bloques]);
}

export const ICNS_TIPOS = [
  ["icp4", 16], ["icp5", 32], ["icp6", 64], ["ic07", 128], ["ic08", 256], ["ic09", 512], ["ic10", 1024],
  ["ic11", 32], ["ic12", 64], ["ic13", 256], ["ic14", 512],
];
