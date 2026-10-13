/**
 * Los archivos de la marca que publica el sitio. Los dibujos salen de scripts/marca-dibujos.mjs (el mismo módulo que usa
 * el kit del lenguaje, scripts/kit.mjs), y éste sólo decide qué se escribe y dónde.
 *
 *   node scripts/marca.mjs              escribe los SVG (sin dependencias)
 *   node scripts/marca.mjs --png        además los PNG; necesita Playwright con Chromium:
 *                                       PLAYWRIGHT=/ruta/a/playwright/index.mjs node scripts/marca.mjs --png
 *   node scripts/marca.mjs --revisar    sólo comprueba que los SVG estén al día (lo usa la prueba)
 *
 * Salidas del sitio: public/assets/marca/pteron-{azul,tinta,blanco}.svg y .png, public/assets/marca/p-{azul,blanco}.svg,
 * public/assets/icono-v4.svg (favicon) y, con --png, los iconos PNG (favicon-v5-16/32/48, apple-touch-icon-v4,
 * app-icon-v5-192/512 y app-icon-v4-mascara), public/favicon.ico y public/apple-touch-icon.png.
 *
 * Salidas del kit, en kit/archivos/ (las arma scripts/kit.mjs junto a las del sitio, sin volver a dibujar): la marca
 * ajustada a su dibujo, la «p» a sangre, de perfil y en la cuadrícula de macOS, y el icono de la app (icon.svg, icon.png,
 * icon.ico e icon.icns, éste en la cuadrícula de macOS).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLOR, ICNS_TIPOS, ICONO, ICONO_MAC, LADO_MAC, RADIO, RADIO_FAVICON, icns, ico, marcaSVG, pChica, pSVG, raiz, rasterizar } from "./marca-dibujos.mjs";

export { COLOR } from "./marca-dibujos.mjs";

const assets = path.join(raiz, "public/assets");
const check = process.argv.includes("--revisar");
const png = process.argv.includes("--png");

export const SVG = {
  "marca/pteron-azul.svg": marcaSVG(COLOR.azul),
  "marca/pteron-tinta.svg": marcaSVG(COLOR.tinta),
  "marca/pteron-blanco.svg": marcaSVG(COLOR.blanco),
  "marca/p-azul.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, radio: RADIO }),
  "marca/p-blanco.svg": pSVG({ fondo: COLOR.blanco, letra: COLOR.azul, radio: RADIO }),
  // El favicon: la letra más grande, porque a 16 px cada píxel cuenta
  "icono-v4.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, alto: 860, y: 0.52, radio: RADIO_FAVICON }),
};

// Cada PNG: de qué dibujo sale y a qué tamaño. Los iconos que el sistema recorta van a sangre (sin radio).
export const PNG = [
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

const kit = path.join(raiz, "kit/archivos");

const ORIGEN_ICONO = `<!--
  El icono de la aplicación pteron: la «p» de la marca, blanca sobre el azul #1E3F94, con esquinas de radio 229 en
  1024. Es un dibujo: no depende de ninguna letra instalada.

  No se edita a mano. Este archivo, icon.png, icon.ico e icon.icns salen del kit del lenguaje visual de pteron (1.0.0;
  scripts/marca-dibujos.mjs en pteron-landing) y sus sumas SHA-256 están en el manifiesto del kit. icon.ico e icon.icns
  llevan la letra engruesada hasta 32 px; icon.icns, además, el cuadrado de 824 de la cuadrícula de macOS.
-->
`;

// Lo que sólo va en el kit. Los SVG se comprueban con --revisar como los del sitio.
export const SVG_KIT = {
  "marca/pteron-azul-ajustada.svg": marcaSVG(COLOR.azul, { aire: false }),
  "marca/pteron-tinta-ajustada.svg": marcaSVG(COLOR.tinta, { aire: false }),
  "marca/pteron-blanco-ajustada.svg": marcaSVG(COLOR.blanco, { aire: false }),
  // A sangre: para los sistemas que ponen su propia máscara (iOS, Android, los iconos por capas de macOS)
  "icono/p-azul-sangre.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco }),
  // Para las fotos de perfil, que se recortan en círculo: la letra cabe en el 80 % central
  "icono/p-azul-perfil.svg": pSVG({ fondo: COLOR.azul, letra: COLOR.blanco, alto: 470 }),
  // Para el Dock y Finder de macOS: el icono en el cuadrado de 824 de su cuadrícula
  "icono/p-azul-macos.svg": ICONO_MAC,
  // El icono de la app: el mismo dibujo de public/assets/marca/p-azul.svg, para reemplazar build/icon.svg. Lleva su origen
  // escrito, porque en la app nadie debería volver a dibujarlo.
  "app/icon.svg": ICONO.replace("<svg", `${ORIGEN_ICONO}<svg`),
};

export const PNG_KIT = [
  ["marca/pteron-azul-ajustada.png", "marca/pteron-azul-ajustada.svg", 1600],
  ["marca/pteron-tinta-ajustada.png", "marca/pteron-tinta-ajustada.svg", 1600],
  ["marca/pteron-blanco-ajustada.png", "marca/pteron-blanco-ajustada.svg", 1600],
  ["icono/p-blanco.png", pSVG({ fondo: COLOR.blanco, letra: COLOR.azul, radio: RADIO }), 1024],
  ["icono/p-azul-sangre.png", "icono/p-azul-sangre.svg", 1024],
  ["icono/p-azul-perfil.png", "icono/p-azul-perfil.svg", 1024],
  ["icono/p-azul-macos.png", "icono/p-azul-macos.svg", 1024],
  ["app/icon.png", "app/icon.svg", 1024],
  // Linux: electron-builder toma build/icons/ (un PNG por tamaño, con el tamaño en el nombre) y los instala en el tema
  // hicolor; sin esa carpeta deriva un solo icono del .icns. Hasta 32 px, la letra engruesada.
  ...[16, 24, 32, 48, 64, 128, 256, 512].map((px) => [`app/icons/${px}x${px}.png`, px <= 32 ? pChica(px) : ICONO, px]),
];

// Los tamaños del icono de la app. Hasta 32 px, la letra engruesada del favicon (a ese tamaño el trazo fino se pierde
// en la barra de tareas); desde 48 px, el dibujo del icono. En macOS, los dos en el cuadrado de 824 de su cuadrícula.
const dibujoApp = (px) => (px <= 32 ? pChica(px) : ICONO);
const dibujoMac = (px) => (px <= 32 ? pChica(px, LADO_MAC) : ICONO_MAC);
const ICO_APP = [16, 24, 32, 48, 64, 128, 256];

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(raiz, "scripts/marca.mjs")) {
  mkdirSync(path.join(assets, "marca"), { recursive: true });
  for (const carpeta of ["marca", "icono", "app", "app/icons"]) mkdirSync(path.join(kit, carpeta), { recursive: true });
  let stale = 0;
  const todos = [...Object.entries(SVG).map(([file, svg]) => [path.join(assets, file), svg]), ...Object.entries(SVG_KIT).map(([file, svg]) => [path.join(kit, file), svg])];
  for (const [full, svg] of todos) {
    let before = "";
    try {
      before = readFileSync(full, "utf8");
    } catch {}
    if (before === svg) continue;
    stale += 1;
    if (!check) writeFileSync(full, svg);
    console.log(`${check ? "desactualizado" : "escrito"}: ${path.relative(raiz, full)}`);
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
      const { png: datos, alto } = await rasterizar(page, svg, ancho);
      writeFileSync(path.join(assets, file), datos);
      console.log(`png: assets/${file} (${ancho}×${alto})`);
    }
    for (const [file, fuenteSVG, ancho] of PNG_KIT) {
      const svg = fuenteSVG.startsWith("<svg") ? fuenteSVG : SVG_KIT[fuenteSVG];
      const { png: datos, alto } = await rasterizar(page, svg, ancho);
      writeFileSync(path.join(kit, file), datos);
      console.log(`png: kit/archivos/${file} (${ancho}×${alto})`);
    }

    // El icono de la app para Windows (.ico) y macOS (.icns): contenedores de PNG, uno por tamaño
    const cache = new Map();
    const dibujar = async (dibujo, px) => {
      const svg = dibujo(px);
      if (!cache.has(svg + px)) cache.set(svg + px, (await rasterizar(page, svg, px)).png);
      return cache.get(svg + px);
    };
    const entradasIco = [];
    for (const px of ICO_APP) entradasIco.push([px, await dibujar(dibujoApp, px)]);
    writeFileSync(path.join(kit, "app/icon.ico"), ico(entradasIco));
    console.log(`ico: kit/archivos/app/icon.ico (${ICO_APP.join(", ")} px)`);
    const entradasIcns = [];
    for (const [tipo, px] of ICNS_TIPOS) entradasIcns.push([tipo, await dibujar(dibujoMac, px)]);
    writeFileSync(path.join(kit, "app/icon.icns"), icns(entradasIcns));
    console.log(`icns: kit/archivos/app/icon.icns (${ICNS_TIPOS.length} imágenes)`);
    await browser.close();

    // favicon.ico: el pedido por omisión de navegadores, accesos directos de Windows y lectores de enlaces. Es sólo un
    // contenedor de los PNG de 16, 32 y 48 px.
    const entradas = [16, 32, 48].map((px) => [px, readFileSync(path.join(assets, `favicon-v5-${px}.png`))]);
    writeFileSync(path.join(raiz, "public/favicon.ico"), ico(entradas));
    console.log("ico: favicon.ico (16, 32 y 48 px)");
    // apple-touch-icon.png en la raíz: iPhone, iPad y los lectores de enlaces lo piden ahí por su cuenta, sin leer la
    // página. Es el mismo de assets; sin versión en el nombre, el navegador lo revalida en cada visita.
    copyFileSync(path.join(assets, "apple-touch-icon-v4.png"), path.join(raiz, "public/apple-touch-icon.png"));
    console.log("png: apple-touch-icon.png (el de assets, en la raíz)");
  }
}
