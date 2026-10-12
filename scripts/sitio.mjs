/**
 * Las piezas comunes de cada página del sitio, escritas una sola vez: la esquina (Descargar y el índice), el pie
 * (colofón) y la hoja del índice. Las inserta entre marcadores en cada HTML de public/ y marca la página actual.
 *
 *   node scripts/sitio.mjs            escribe las páginas
 *   node scripts/sitio.mjs --revisar  sólo comprueba que estén al día (lo usa la prueba)
 *
 * Marcadores: <!-- esquina:inicio --> … <!-- esquina:fin -->, <!-- colofon:inicio --> … y <!-- indice:inicio --> ….
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const check = process.argv.includes("--revisar");

const PAGINAS = [
  ["/", "Inicio"],
  ["/planes", "Planes"],
  ["/descargar", "Descargar"],
  ["/docs", "Documentación"],
  ["/cuenta", "Cuenta"],
];
const CON_DESCARGAR = ["/", "/planes", "/docs"];
const PIE = [
  ["/privacidad", "Privacidad"],
  ["/terminos", "Términos"],
  ["/marca", "Marca"],
  ["mailto:pteron@patagua.dev", "pteron@patagua.dev"],
];

/** Ruta pública de un archivo de public/ (index.html → la carpeta, sin barra final). */
function routeOf(file) {
  const rel = path.relative(pub, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"/index.html".length)}`;
  return `/${rel.replace(/\.html$/, "")}`;
}

function marca(version, label = "pteron, inicio") {
  return `<a class="marca" href="/" aria-label="${label}"><svg viewBox="0 0 2872 886" aria-hidden="true"><use href="/assets/marca.svg?v=${version}#pteron"/></svg></a>`;
}

const current = (route, href) => (route === href || (href !== "/" && route.startsWith(`${href}/`)) ? ' aria-current="page"' : "");

function esquina(route) {
  // Descargar flota sólo donde descargar es el trabajo de la página; en la cuenta, los legales o la 404 competiría
  // con la acción de la página
  const descargar = CON_DESCARGAR.includes(route) ? `<a class="boton boton-principal esquina-descargar" href="/descargar" data-descargar${route === "/" ? " data-oculto" : ""}>Descargar</a>` : "";
  // La esquina de arriba a la derecha está doblada: debajo asoma la hoja azul del índice. Sin JavaScript lleva al pie.
  return `
  <nav class="esquina" aria-label="Sitio">
    <a class="oreja" href="#colofon" data-indice><span class="oreja-azul" aria-hidden="true"><span class="oreja-texto">Índice</span></span><span class="oreja-sombra" aria-hidden="true"><span class="oreja-solapa"></span></span><span class="sr-only">Índice</span></a>
    ${descargar}
  </nav>
  `;
}

// El colofón dice cómo está hecha la página; los créditos completos de las láminas van donde las láminas se ven (el
// inicio y /marca), y en las demás, un enlace a ellos.
const CREDITOS = "Láminas de dominio público: Yciar (1564), Ercilla (1574), Hirschvogel (1543), Ovalle (1646), Westtown (1801), Byrne (1847), Gay (1854), Trouvelot (1875 y 1878), Haeckel (1904), una carta portulana de hacia 1500 y una fotografía de la NASA (2019). Las conservan The Metropolitan Museum of Art, la Library of Congress e Internet Archive.";
const CON_LAMINAS = ["/", "/marca"];

function colofon(route, version) {
  const laminas = CON_LAMINAS.includes(route)
    ? `<p>${CREDITOS} Créditos completos en <a href="/privacidad#creditos">Privacidad</a>.</p>`
    : `<p>Las láminas del sitio son obras de dominio público y piezas propias; sus créditos están en <a href="/privacidad#creditos">Privacidad</a>.</p>`;
  return `
  <footer class="colofon" id="colofon">
    <div class="contenedor">
      <div class="colofon-rejilla">
        <div>
          ${marca(version)}
          ${route === "/" ? "" : `<p class="colofon-lema">Construido por profes, para profes.</p>
          `}<p class="colofon-lugar">Hecho en Chile.</p>
        </div>
        <nav aria-label="Páginas">
          <ul>
            ${PAGINAS.map(([href, name]) => `<li><a href="${href}"${current(route, href)}>${name}</a></li>`).join("\n            ")}
          </ul>
        </nav>
        <div class="colofon-creditos">
          <p>Compuesto en Archivo, de Omnibus-Type; la marca, sobre Outfit. Las hojas se arman con el código de Write y las figuras, con el motor de pteron.</p>
          ${laminas}
        </div>
      </div>
      <div class="colofon-legal">
        <span>© <span data-year>2026</span> pteron · Patagua</span>
        <span>${PIE.map(([href, name]) => `<a href="${href}"${current(route, href)}>${name}</a>`).join(" · ")}</span>
      </div>
    </div>
  </footer>
  `;
}

// La hoja del índice: los capítulos de la página (script.js los toma de [data-capitulo] o de la tabla de la
// documentación), las páginas del sitio y el pie legal. Sin capítulos, ese bloque queda oculto.
function indice(route) {
  return `
  <dialog class="indice" id="indice" aria-labelledby="indice-titulo">
    <div class="indice-hoja" data-indice-hoja>
      <div class="indice-cabeza">
        <h2 class="indice-titulo" id="indice-titulo">Índice</h2>
        <button class="indice-cerrar" type="button" data-indice-cerrar>Cerrar</button>
      </div>
      <nav class="indice-bloque" aria-labelledby="indice-aqui" data-indice-capitulos hidden>
        <h3 class="indice-rotulo" id="indice-aqui">En esta página</h3>
        <ol class="indice-capitulos" role="list"></ol>
      </nav>
      <nav class="indice-bloque" aria-labelledby="indice-paginas">
        <h3 class="indice-rotulo" id="indice-paginas">Páginas</h3>
        <ul class="indice-paginas" role="list">
          ${PAGINAS.map(([href, name]) => `<li><a href="${href}"${current(route, href)}>${name}</a></li>`).join("\n          ")}
        </ul>
      </nav>
      <p class="indice-pie">${PIE.map(([href, name]) => `<a href="${href}"${current(route, href)}>${name}</a>`).join("")}</p>
    </div>
  </dialog>
  `;
}

function* pages(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "assets") continue;
    if (statSync(full).isDirectory()) yield* pages(full);
    else if (name.endsWith(".html")) yield full;
  }
}

let stale = 0;
for (const file of pages(pub)) {
  const before = readFileSync(file, "utf8");
  if (!before.includes("<!-- colofon:inicio -->")) continue;
  const route = routeOf(file);
  const version = /\/styles\.css\?v=([^"&]+)/.exec(before)?.[1];
  if (!version) throw new Error(`${route} no enlaza /styles.css?v=…`);
  let html = before;
  for (const [name, markup] of [["esquina", esquina(route)], ["colofon", colofon(route, version)], ["indice", indice(route)]]) {
    const start = `<!-- ${name}:inicio -->`;
    const end = `<!-- ${name}:fin -->`;
    const a = html.indexOf(start);
    const b = html.indexOf(end);
    if (a < 0 || b < a) throw new Error(`${route} no tiene los marcadores de ${name}`);
    html = `${html.slice(0, a + start.length)}${markup}${html.slice(b)}`;
  }
  if (html !== before) {
    stale += 1;
    if (!check) writeFileSync(file, html);
    console.log(`${check ? "desactualizada" : "escrita"}: ${route}`);
  }
}
if (check && stale) process.exit(1);
