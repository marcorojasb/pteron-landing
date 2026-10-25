/**
 * Las piezas comunes de cada página del sitio, escritas una sola vez: la esquina (Descargar y el índice), el pie
 * (colofón) y la hoja del índice. Las inserta entre marcadores en cada HTML de public/ y marca la página actual.
 *
 *   node scripts/sitio.mjs            escribe las páginas
 *   node scripts/sitio.mjs --revisar  sólo comprueba que estén al día (lo usa la prueba)
 *
 * Marcadores: <!-- esquina:inicio --> … <!-- esquina:fin -->, <!-- colofon:inicio --> … y <!-- indice:inicio --> ….
 * La página que lleva <!-- marca:inicio --> … <!-- marca:fin --> (el inicio) recibe ahí el símbolo de
 * public/assets/marca.svg, copiado tal cual.
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
const CON_DESCARGAR = ["/", "/planes"];
const PIE = [
  ["/privacidad", "Privacidad"],
  ["/terminos", "Términos"],
  ["/marca", "Marca"],
  ["/privacidad#creditos", "Créditos"],
  ["mailto:pteron@patagua.dev", "pteron@patagua.dev"],
];

/** Ruta pública de un archivo de public/ (index.html → la carpeta, sin barra final). */
function routeOf(file) {
  const rel = path.relative(pub, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"/index.html".length)}`;
  return `/${rel.replace(/\.html$/, "")}`;
}

// En el inicio la marca de la portada es lo primero que se lee: va con el símbolo en la misma página, para que no
// espere a marca.svg detrás de las láminas. Las demás marcas (el colofón, las otras páginas) lo piden a marca.svg
const SIMBOLO = /<symbol id="pteron"[\s\S]*?<\/symbol>/.exec(readFileSync(path.join(pub, "assets/marca.svg"), "utf8"))?.[0];
if (!SIMBOLO) throw new Error("public/assets/marca.svg no tiene el <symbol id=\"pteron\">");
const simbolo = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${SIMBOLO}</svg>`;

function marca(version, label = "pteron, inicio") {
  return `<a class="marca" href="/" aria-label="${label}"><svg viewBox="0 0 2872 886" aria-hidden="true"><use href="/assets/marca.svg?v=${version}#pteron"/></svg></a>`;
}

const current = (route, href) => (route === href || (href !== "/" && route.startsWith(`${href}/`)) ? ' aria-current="page"' : "");

function esquina(route) {
  // Descargar flota sólo donde descargar es el trabajo de la página; en la cuenta, los legales o la 404 competiría
  // con la acción de la página, y en la documentación taparía el texto que se lee
  const descargar = CON_DESCARGAR.includes(route) ? `<a class="boton boton-principal esquina-descargar" href="/descargar" data-descargar${route === "/" ? " data-oculto" : ""}>Descargar</a>` : "";
  // La esquina de arriba a la derecha está doblada: debajo asoma la hoja azul del índice. Sin JavaScript lleva al pie.
  return `
  <nav class="esquina" aria-label="Sitio">
    <a class="oreja" href="#colofon" data-indice><span class="oreja-azul" aria-hidden="true"><span class="oreja-texto">Índice</span></span><span class="oreja-sombra" aria-hidden="true"><span class="oreja-solapa"></span></span><span class="sr-only">Índice</span></a>
    ${descargar}
  </nav>
  `;
}

// El colofón es la marca, su lema (no en el inicio, donde es el título) y las páginas; la línea legal lleva a los
// créditos de las láminas, en Privacidad
function colofon(route, version) {
  return `
  <footer class="colofon" id="colofon">
    <div class="contenedor">
      <div class="colofon-rejilla">
        <div>
          ${marca(version)}${route === "/" ? "" : `
          <p class="colofon-lema">Construido por profes, para profes.</p>`}
        </div>
        <nav aria-label="Páginas">
          <ul>
            ${PAGINAS.map(([href, name]) => `<li><a href="${href}"${current(route, href)}>${name}</a></li>`).join("\n            ")}
          </ul>
        </nav>
      </div>
      <div class="colofon-legal">
        <span>© <span data-year>2026</span> Patagua.dev SpA · RUT 78.418.149-9</span>
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
        <h3 class="sr-only" id="indice-aqui">En esta página</h3>
        <ol class="indice-capitulos" role="list"></ol>
      </nav>
      <nav class="indice-bloque" aria-labelledby="indice-paginas">
        <h3 class="sr-only" id="indice-paginas">Páginas</h3>
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
  if (html.includes("<!-- marca:inicio -->")) {
    const a = html.indexOf("<!-- marca:inicio -->") + "<!-- marca:inicio -->".length;
    const b = html.indexOf("<!-- marca:fin -->");
    if (b < a) throw new Error(`${route} no cierra el bloque de la marca`);
    html = `${html.slice(0, a)}${simbolo()}${html.slice(b)}`;
  }
  if (html !== before) {
    stale += 1;
    if (!check) writeFileSync(file, html);
    console.log(`${check ? "desactualizada" : "escrita"}: ${route}`);
  }
}
if (check && stale) process.exit(1);
