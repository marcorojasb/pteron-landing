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

/** Ruta pública de un archivo de public/ (index.html → la carpeta, sin barra final). */
function routeOf(file) {
  const rel = path.relative(pub, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"/index.html".length)}`;
  return `/${rel.replace(/\.html$/, "")}`;
}

function marca(version, label = "pteron, inicio") {
  return `<a class="marca" href="/" aria-label="${label}"><svg viewBox="0 0 2706 858" aria-hidden="true"><use href="/assets/marca.svg?v=${version}#pteron"/></svg></a>`;
}

const current = (route, href) => (route === href || (href !== "/" && route.startsWith(`${href}/`)) ? ' aria-current="page"' : "");

function esquina(route) {
  // En /descargar la página es la descarga y /admin es interno: ahí la esquina sólo lleva el índice
  const descargar = route === "/descargar" || route === "/admin" ? "" : `<a class="boton boton-principal esquina-descargar" href="/descargar" data-descargar${route === "/" ? " data-oculto" : ""}>Descargar</a>`;
  return `
  <nav class="esquina" aria-label="Sitio">
    ${descargar}
    <a class="oreja" href="#colofon" data-indice aria-label="Índice del sitio"><span class="oreja-hoja" aria-hidden="true"></span><span class="oreja-pliegue" aria-hidden="true"></span><span class="oreja-texto" aria-hidden="true">Índice</span></a>
  </nav>
  `;
}

function colofon(route, version) {
  return `
  <footer class="colofon" id="colofon">
    <div class="contenedor">
      <div class="colofon-rejilla">
        <div>
          ${marca(version)}
          <p class="colofon-lema">Construido por profes, para profes.</p>
          <p class="colofon-lugar">Hecho en Chile.</p>
        </div>
        <nav aria-label="Páginas">
          <ul>
            ${PAGINAS.map(([href, name]) => `<li><a href="${href}"${current(route, href)}>${name}</a></li>`).join("\n            ")}
          </ul>
        </nav>
        <div class="colofon-creditos">
          <p>Láminas de dominio público: Yciar (1564), Ercilla (1574), Hirschvogel (1543), Ovalle (1646), Westtown (1801), Byrne (1847), Gay (1854), Trouvelot (1875 y 1878), Haeckel (1904), una carta portulana de hacia 1500 y una fotografía de la NASA (2019). Las conservan The Metropolitan Museum of Art, la Library of Congress e Internet Archive.</p>
          <p>Figuras y hojas: pteron. Créditos completos en <a href="/privacidad#creditos">Privacidad</a>.</p>
        </div>
      </div>
      <div class="colofon-legal">
        <span>© <span data-year>2026</span> pteron · Patagua</span>
        <span><a href="/privacidad"${current(route, "/privacidad")}>Privacidad</a> · <a href="/terminos"${current(route, "/terminos")}>Términos</a> · <a href="mailto:pteron@patagua.dev">pteron@patagua.dev</a></span>
      </div>
    </div>
  </footer>
  `;
}

function indice(route, version) {
  return `
  <dialog class="indice" id="indice" aria-labelledby="indice-titulo">
    <div class="indice-hoja">
      <div class="indice-cabeza">
        <h2 class="sr-only" id="indice-titulo">Índice</h2>
        ${marca(version)}
        <button class="indice-cerrar" type="button" data-indice-cerrar>Cerrar</button>
      </div>
      <ol class="indice-lista" role="list">
        ${PAGINAS.map(([href, name]) => `<li><a href="${href}"${current(route, href)}>${name}<span></span></a></li>`).join("\n        ")}
      </ol>
      <p class="indice-pie"><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a><a href="mailto:pteron@patagua.dev">pteron@patagua.dev</a></p>
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
  for (const [name, markup] of [["esquina", esquina(route)], ["colofon", colofon(route, version)], ["indice", indice(route, version)]]) {
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
