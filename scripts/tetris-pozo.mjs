// Generador del pozo de tetris del héroe del inicio (public/index.html).
// Calcula cuándo aterriza cada pieza en escritorio y en móvil y reescribe el bloque <div class="tetris ...">.
// Los instantes de la fase final (CLEAR y END de cada diseño) deben coincidir con --T-clear y --T-end en inicio.css.
// Uso: node scripts/tetris-pozo.mjs          (escribe public/index.html)
//      node scripts/tetris-pozo.mjs --dry    (sólo muestra los tiempos)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html");
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const SUBJECT = {
  lenguaje: ["is-lenguaje", "Lenguaje"], matematica: ["is-matematica", "Matemática"], ciencias: ["is-ciencias", "Ciencias"],
  historia: ["is-historia", "Historia"], mezcla: ["is-mezcla", "Artes"],
};
// Fuente que se lee en el reverso; debe coincidir con /privacidad#creditos.
const SOURCE = {
  "lenguaje-araucana": "Ercilla, 1574", "ciencias-loica": "Gay, 1854", "matematica-pizarra": "Pieza propia",
  "ciencias-espectro": "Pieza propia", "mezcla-pintura-kraft": "Pieza propia", "historia-gay-mapa": "Gay, 1854",
  "lenguaje-yciar": "Yciar, 1564", "matematica-circulos": "Hirschvogel, 1543", "lenguaje-yciar-xyz": "Yciar, 1564",
  "lenguaje-enie": "Pieza propia", "historia-chile-1816": "Pinkerton, 1816", "matematica-paralelogramos": "Byrne, 1847",
  "matematica-semicirculos": "Byrne, 1847", "matematica-byrne": "Byrne, 1847", "historia-ovalle": "Ovalle, 1646",
  "ciencias-luna": "Trouvelot, 1875", "ciencias-flores": "Gay, 1854", "ciencias-algas": "Gay, 1854",
  "ciencias-corcho": "Hooke, 1665", "mezcla-salpicadura-crayon": "Pieza propia", "lenguaje-muestrario": "Westtown, 1801",
  "ciencias-diatomeas": "Haeckel, 1904", "matematica-perspectiva": "Hirschvogel, 1543", "ciencias-orion": "Trouvelot, 1881",
  "ciencias-eclipse": "Trouvelot, 1878", "historia-portulano": "Portulano, s. XVI", "ciencias-andes": "NASA, 2019",
};
// Formas (vista de frente) que mueven el texto del reverso: escalera hacia la derecha y hueco abajo a la izquierda.
const SHAPE_STEP_R = new Set(["historia-gay-mapa", "ciencias-loica", "matematica-byrne-cuadrados", "matematica-numeros", "matematica-pizarra"]);
const SHAPE_BL = new Set(["ciencias-limbo", "lenguaje-yciar-xyz", "matematica-circulos"]);

// Piezas: [papel, escritorio [col, fila, ancho], móvil [col, fila, ancho] o null, giro en el aire, inclinación en reposo, giro al desarmarse].
// Filas del pozo: 0 es la fila de aparición; la estructura final ocupa 1..5 en escritorio (7 columnas) y 1..3 en móvil (5 columnas).
// Papeles: clear = fila de abajo que se completa y se limpia; gap = la pieza que la completa; stack = pila que espera una
// fila más arriba y baja tras la limpieza; post = cae después; crown = remate.
const PIECES = {
  "historia-gay-mapa": ["clear", [0, 5, 1], [0, 3, 1], 0, -0.8, -6],
  "lenguaje-yciar": ["clear", [1, 5, 1], [1, 3, 1], -90, 0.6, 5],
  "matematica-pizarra": ["gap", [2, 5, 1], [2, 3, 1], 90, 0, 0],
  "ciencias-espectro": ["clear", [3, 5, 1], [3, 3, 1], 90, -0.5, -4],
  "mezcla-pintura-kraft": ["clear", [4, 5, 1], [4, 3, 1], 0, 0.9, 6],
  "matematica-circulos": ["clear", [5, 5, 1], null, 90, -0.7, -5],
  "lenguaje-yciar-xyz": ["clear", [6, 5, 1], null, 0, 0.5, 7],
  "lenguaje-araucana": ["stack", [0, 4, 2], [0, 2, 2], -90, -0.6, -5],
  "lenguaje-enie": ["stack", [1, 4, 1], [1, 2, 1], 0, 1.1, 8],
  "historia-chile-1816": ["stack", [1, 3, 1], null, 0, -1.2, -9],
  "ciencias-orion": ["stack", [3, 5, 1], null, -90, 0.7, 4],
  "mezcla-salpicadura-crayon": ["stack", [3, 4, 1], null, 0, -0.9, -7],
  "ciencias-luna": ["stack", [3, 3, 1], null, 90, 0.8, 6],
  "matematica-byrne": ["stack", [3, 2, 1], null, 0, -1.0, -8],
  "ciencias-eclipse": ["stack", [4, 5, 1], null, 90, -0.6, -3],
  "lenguaje-muestrario": ["stack", [4, 4, 1], null, -90, 0.9, 5],
  "ciencias-flores": ["stack", [4, 3, 1], null, 0, -0.7, -6],
  "historia-ovalle": ["stack", [4, 2, 1], null, 90, 1.2, 9],
  "historia-portulano": ["stack", [5, 5, 1], [3, 3, 1], 0, 0.6, 4],
  "ciencias-diatomeas": ["stack", [5, 4, 1], null, 0, -0.8, -5],
  "ciencias-algas": ["stack", [5, 3, 1], null, -90, 0.7, 6],
  "ciencias-andes": ["stack", [6, 5, 1], [4, 3, 1], 0, -0.5, 3],
  "matematica-perspectiva": ["stack", [6, 4, 1], null, 90, 1.0, 7],
  "ciencias-corcho": ["stack", [6, 3, 1], null, -90, -0.9, -6],
  "matematica-semicirculos": ["post", [2, 5, 1], [2, 3, 1], 0, 0.8, -4],
  "matematica-paralelogramos": ["post", [2, 4, 1], [2, 2, 1], 90, -1.0, 5],
  "ciencias-loica": ["crown", [5, 1, 2], [3, 1, 2], 0, 0.5, 8],
};
// Orden de aterrizaje de la primera fase y constantes de cada diseño. Cada pieza aterriza después de la que la sostiene.
const LAYOUT = {
  d: {
    start: 0.42, step: 0.05, clear: 1.98, end: 4.36,
    post: [["matematica-semicirculos", 3.46], ["matematica-paralelogramos", 3.6]],
    order: ["ciencias-espectro", "historia-gay-mapa", "matematica-circulos", "lenguaje-yciar", "lenguaje-yciar-xyz",
      "mezcla-pintura-kraft", "ciencias-orion", "lenguaje-araucana", "historia-portulano", "ciencias-eclipse",
      "ciencias-andes", "lenguaje-enie", "mezcla-salpicadura-crayon", "ciencias-diatomeas", "lenguaje-muestrario",
      "matematica-perspectiva", "historia-chile-1816", "ciencias-luna", "ciencias-algas", "ciencias-flores",
      "ciencias-corcho", "matematica-byrne", "historia-ovalle"],
  },
  m: {
    start: 0.4, step: 0.085, clear: 1.46, end: 3.71,
    post: [["matematica-semicirculos", 2.94], ["matematica-paralelogramos", 3.08]],
    order: ["ciencias-espectro", "historia-gay-mapa", "lenguaje-yciar", "mezcla-pintura-kraft", "lenguaje-araucana",
      "lenguaje-enie", "historia-portulano", "ciencias-andes"],
  },
};

const landTimes = (key) => {
  const L = LAYOUT[key];
  const times = {};
  L.order.forEach((slug, i) => { times[slug] = Math.round((L.start + i * L.step) * 1000) / 1000; });
  times["matematica-pizarra"] = L.clear;
  for (const [slug, t] of L.post) times[slug] = t;
  times["ciencias-loica"] = L.end;
  return times;
};
const fmt = (x) => { const s = x.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); return s || "0"; };

function figure(slug, td, tm, version) {
  const [role, d, m, spin, rot, er] = PIECES[slug];
  const [subjectClass, subjectName] = SUBJECT[slug.split("-")[0]];
  const classes = ["cutout", { clear: "t-clear", gap: "t-clear t-gap", stack: "t-stack", post: "t-post", crown: "t-post t-crown" }[role]];
  if (!m) classes.push("t-dk");
  classes.push(subjectClass);
  if (SHAPE_STEP_R.has(slug)) classes.push("shape-step-r");
  if (SHAPE_BL.has(slug)) classes.push("shape-bl");
  const style = [`--dc:${d[0]}`, `--dr:${d[1]}`];
  if (d[2] !== 1) style.push(`--dw:${d[2]}`);
  style.push(`--dt:${fmt(td[slug])}s`);
  if (m) {
    style.push(`--mc:${m[0]}`, `--mr:${m[1]}`);
    if (m[2] !== 1) style.push(`--mw:${m[2]}`);
    style.push(`--mt:${fmt(tm[slug])}s`);
  }
  if (spin) style.push(`--spin:${spin}deg`);
  if (rot) style.push(`--rot:${fmt(rot)}deg`);
  if (er) style.push(`--er:${er}deg`);
  style.push(`--img:url(/assets/atlas/${slug}-300.webp${version})`);
  const sizes = d[2] === 2 ? "(max-width: 760px) 160px, 230px" : "(max-width: 760px) 80px, 115px";
  let img = `<img class="cutout-face" src="/assets/atlas/${slug}-300.webp${version}" srcset="/assets/atlas/${slug}-300.webp${version} 300w, /assets/atlas/${slug}-600.webp${version} 600w" sizes="${sizes}" width="600" height="600" alt="" decoding="async">`;
  // Sólo escritorio: en móvil la fuente vacía evita descargar una lámina que no se muestra.
  if (!m) img = `<picture><source media="(max-width: 760px)" srcset="${BLANK}">${img}</picture>`;
  return `<figure class="${classes.join(" ")}" style="${style.join(";")}"><div class="cutout-float"><div class="cutout-inner">${img}<span class="cutout-back"><b>${subjectName}</b>${SOURCE[slug]}</span></div></div></figure>`;
}

function build(version) {
  const td = landTimes("d");
  const tm = landTimes("m");
  const slugs = Object.keys(PIECES);
  const byRole = (...roles) => slugs.filter((slug) => roles.includes(PIECES[slug][0]));
  return [
    '<div class="tetris cutouts" data-cutouts data-tetris aria-hidden="true">',
    '        <div class="tetris-stack">',
    ...byRole("stack").map((slug) => "          " + figure(slug, td, tm, version)),
    "        </div>",
    ...byRole("clear", "gap", "post", "crown").map((slug) => "        " + figure(slug, td, tm, version)),
    '        <span class="tetris-flash"></span>',
    "      </div>",
  ].join("\n");
}

const source = readFileSync(INDEX, "utf8");
const version = (source.match(/\/styles\.css(\?v=[0-9.-]+)"/) || [])[1];
if (!version) throw new Error("No encontré la versión de caché en public/index.html");
// Bloque anterior de una sola línea o bloque generado (termina en el destello). Nunca cruza a otras secciones.
const pattern = /<div class="tetris cutouts drop-in"[^\n]*\n|<div class="tetris cutouts" data-cutouts data-tetris[^>]*>\n(?:(?!<section|<footer)[\s\S])*?<span class="tetris-flash"><\/span>\n {6}<\/div>\n/g;
const matches = [...source.matchAll(pattern)];
if (matches.length !== 1) throw new Error(`Esperaba un bloque del tetris y encontré ${matches.length}`);
const [match] = matches;
if (/<section|hero-stage/.test(match[0])) throw new Error("El reemplazo cruzaría otras secciones");
const output = source.slice(0, match.index) + build(version) + "\n" + source.slice(match.index + match[0].length);
for (const must of ['class="wrap hero-stage"', 'id="como-trabaja"', 'id="descarga"', '<footer class="footer">']) {
  if (!output.includes(must)) throw new Error(`Falta ${must} tras el reemplazo`);
}
const td = landTimes("d");
const tm = landTimes("m");
for (const slug of Object.keys(PIECES)) {
  console.log(`${slug.padEnd(28)} ${PIECES[slug][0].padEnd(6)} escritorio ${td[slug]} s  móvil ${PIECES[slug][2] ? tm[slug] + " s" : "-"}`);
}
if (process.argv.includes("--dry")) {
  console.log(output === source ? "Sin cambios." : "Habría cambios (usa sin --dry para escribir).");
} else if (output === source) {
  console.log("public/index.html ya estaba al día.");
} else {
  writeFileSync(INDEX, output);
  console.log("public/index.html actualizado.");
}
