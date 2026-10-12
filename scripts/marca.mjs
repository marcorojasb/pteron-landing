/**
 * Los archivos de la marca, derivados del único dibujo que existe: el contorno de public/assets/marca.svg («pteron» en
 * Outfit con la esquina de la «t» doblada; lo escribe scripts/marca-trazado.py). De ahí salen la marca para descargar en
 * tres colores y el icono, que es la «p» de esa marca sobre el azul.
 *
 *   node scripts/marca.mjs              escribe los SVG (sin dependencias)
 *   node scripts/marca.mjs --png        además los PNG; necesita Playwright con Chromium:
 *                                       PLAYWRIGHT=/ruta/a/playwright/index.mjs node scripts/marca.mjs --png
 *   node scripts/marca.mjs --revisar    sólo comprueba que los SVG estén al día (lo usa la prueba)
 *
 * Salidas: public/assets/marca/pteron-{azul,tinta,blanco}.svg y .png, public/assets/marca/p-{azul,blanco}.svg,
 * public/assets/icono-v4.svg (favicon) y, con --png, los iconos PNG (favicon-v5-16/32/48, apple-touch-icon-v4,
 * app-icon-v5-192/512 y app-icon-v4-mascara) y public/favicon.ico.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "public/assets");
const check = process.argv.includes("--revisar");
const png = process.argv.includes("--png");

export const COLOR = { azul: "#1E3F94", tinta: "#1F2A3D", blanco: "#FFFFFF", lapiz: "#F0C060", mesa: "#E9EDF1" };

const fuente = readFileSync(path.join(assets, "marca.svg"), "utf8");
const d = /<path[^>]* d="([^"]+)"/.exec(fuente)?.[1];
if (!d) throw new Error("public/assets/marca.svg no tiene el trazado de la marca");

/** Los contornos del trazado con su caja: la marca son seis letras, tres de ellas con hueco. */
const contornos = d
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
const P = { d: letraP.d + huecoP.d, x0: letraP.x0, x1: letraP.x1, y0: letraP.y0, y1: letraP.y1 };

const caja = {
  x0: Math.min(...contornos.map((c) => c.x0)),
  x1: Math.max(...contornos.map((c) => c.x1)),
  y0: Math.min(...contornos.map((c) => c.y0)),
  y1: Math.max(...contornos.map((c) => c.y1)),
};
const r1 = (n) => Math.round(n * 10) / 10;

// El espacio libre de la marca es el alto de su «o»: la quinta letra entre las que no caben dentro de otra
const letras = contornos
  .filter((c) => !contornos.some((o) => o !== c && o.x0 < c.x0 && o.x1 > c.x1 && o.y0 < c.y0 && o.y1 > c.y1))
  .sort((a, b) => a.x0 - b.x0);
if (letras.length !== 6) throw new Error(`la marca debería tener seis letras y tiene ${letras.length}`);
export const AIRE = letras[4].y1 - letras[4].y0;

/** La marca en un color, con su espacio libre dentro del archivo: pegada en un documento, no queda apretada. */
function marcaSVG(color) {
  const w = caja.x1 - caja.x0 + 2 * AIRE;
  const h = caja.y1 - caja.y0 + 2 * AIRE;
  const vb = [caja.x0 - AIRE, caja.y0 - AIRE, w, h].map(r1).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${r1(w)}" height="${r1(h)}"><title>pteron</title><path fill="${color}" fill-rule="evenodd" d="${d}"/></svg>\n`;
}

/**
 * La «p» en un cuadrado de 1024. alto: cuánto mide la letra (con su descendente); y: dónde cae el centro de su caja,
 * un poco bajo la mitad para que el ojo de la «p» quede al centro. radio 0 para los iconos que el sistema recorta.
 */
function pSVG({ fondo, letra, alto = 600, y = 0.53, radio = 0, grosor = 0 }) {
  const k = alto / (P.y1 - P.y0);
  const cx = (P.x0 + P.x1) / 2;
  const cy = (P.y0 + P.y1) / 2;
  const t = `translate(512 ${r1(1024 * y)}) scale(${k.toFixed(5)}) translate(${r1(-cx)} ${r1(-cy)})`;
  const base = fondo ? `<rect width="1024" height="1024"${radio ? ` rx="${radio}"` : ""} fill="${fondo}"/>` : "";
  // grosor: un trazo del mismo color engruesa la letra para los tamaños chicos (a 16 px el trazo fino se pierde)
  const trazo = grosor ? ` stroke="${letra}" stroke-width="${grosor}" stroke-linejoin="round"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>pteron</title>${base}<path fill="${letra}" fill-rule="evenodd"${trazo} transform="${t}" d="${P.d}"/></svg>\n`;
}

// El radio de la «p» en su cuadrado de 1024: 229, el mismo de build/icon.svg en la app (cerca del 22,4 % de los iconos de
// macOS), para que el icono de la web y el de la app sean un solo dibujo. El favicon va con 200: su letra ocupa el 84 % del
// alto y un radio mayor le comería el pie de la «p».
const RADIO = 229;
const RADIO_FAVICON = 200;

const SVG = {
  "marca/pteron-azul.svg": marcaSVG(COLOR.azul),
  "marca/pteron-tinta.svg": marcaSVG(COLOR.tinta),
  "marca/pteron-blanco.svg": marcaSVG(COLOR.blanco),
  "marca/p-azul.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, radio: RADIO }),
  "marca/p-blanco.svg": pSVG({ fondo: COLOR.blanco, letra: COLOR.azul, radio: RADIO }),
  // El favicon: la letra más grande, porque a 16 px cada píxel cuenta
  "icono-v4.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, alto: 860, y: 0.52, radio: RADIO_FAVICON }),
};

// Para 16 y 32 px, la letra engruesada: medio píxel más por lado a cada tamaño (el trazo va en las unidades de la «p»,
// que se escala a 860 de 1024)
const pChica = (px) => pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, alto: 860, y: 0.52, radio: RADIO_FAVICON, grosor: Math.round((1024 / px) * ((P.y1 - P.y0) / 860) * 0.9) });

// Cada PNG: de qué dibujo sale y a qué tamaño. Los iconos que el sistema recorta van a sangre (sin radio).
const PNG = [
  ["favicon-v5-16.png", pChica(16), 16],
  ["favicon-v5-32.png", pChica(32), 32],
  ["favicon-v5-48.png", pChica(48), 48],
  ["apple-touch-icon-v4.png", pSVG({ fondo: COLOR.azul, letra: COLOR.blanco }), 180],
  ["app-icon-v5-192.png", "marca/p-azul.svg", 192],
  ["app-icon-v5-512.png", "marca/p-azul.svg", 512],
  // Android recorta en círculo o en gota: la letra cabe en el 80 % central
  ["app-icon-v4-mascara.png", pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, alto: 470 }), 512],
  // La marca de 1600 px de ancho, más su espacio libre
  ["marca/pteron-azul.png", "marca/pteron-azul.svg", 2160],
  ["marca/pteron-tinta.png", "marca/pteron-tinta.svg", 2160],
  ["marca/pteron-blanco.png", "marca/pteron-blanco.svg", 2160],
  ["marca/p-azul.png", "marca/p-azul.svg", 1024],
];

mkdirSync(path.join(assets, "marca"), { recursive: true });
let stale = 0;
for (const [file, svg] of Object.entries(SVG)) {
  const full = path.join(assets, file);
  let before = "";
  try {
    before = readFileSync(full, "utf8");
  } catch {}
  if (before === svg) continue;
  stale += 1;
  if (!check) writeFileSync(full, svg);
  console.log(`${check ? "desactualizado" : "escrito"}: assets/${file}`);
}
if (check) process.exit(stale ? 1 : 0);

if (png) {
  const modulo = process.env.PLAYWRIGHT;
  if (!modulo) throw new Error("--png necesita PLAYWRIGHT=/ruta/a/playwright/index.mjs");
  const { chromium } = await import(modulo);
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [file, fuenteSVG, ancho] of PNG) {
    const svg = fuenteSVG.startsWith("<svg") ? fuenteSVG : SVG[fuenteSVG];
    const [, w, h] = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
    const alto = Math.round((ancho * Number(h)) / Number(w));
    const datos = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await page.setViewportSize({ width: ancho, height: alto });
    await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${datos}" width="${ancho}" height="${alto}" style="display:block"></body></html>`);
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(assets, file), omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } });
    console.log(`png: assets/${file} (${ancho}×${alto})`);
  }
  await browser.close();

  // favicon.ico: el pedido por omisión de navegadores, accesos directos de Windows y lectores de enlaces. Es sólo un
  // contenedor de los PNG de 16, 32 y 48 px.
  const tamanos = [16, 32, 48];
  const pngs = tamanos.map((px) => readFileSync(path.join(assets, `favicon-v5-${px}.png`)));
  const cabeza = Buffer.alloc(6 + 16 * pngs.length);
  cabeza.writeUInt16LE(0, 0);
  cabeza.writeUInt16LE(1, 2);
  cabeza.writeUInt16LE(pngs.length, 4);
  let desde = cabeza.length;
  pngs.forEach((datos, i) => {
    const o = 6 + 16 * i;
    cabeza.writeUInt8(tamanos[i], o);
    cabeza.writeUInt8(tamanos[i], o + 1);
    cabeza.writeUInt16LE(1, o + 4);
    cabeza.writeUInt16LE(32, o + 6);
    cabeza.writeUInt32LE(datos.length, o + 8);
    cabeza.writeUInt32LE(desde, o + 12);
    desde += datos.length;
  });
  writeFileSync(path.join(root, "public/favicon.ico"), Buffer.concat([cabeza, ...pngs]));
  console.log("ico: favicon.ico (16, 32 y 48 px)");
}
