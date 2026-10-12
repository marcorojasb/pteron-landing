/**
 * Arma, con el código de pteron, las hojas y las figuras que muestra el inicio. Nada se dibuja a mano:
 *
 * - public/pteron-hoja.css: la hoja de Write (writerStyles con la paleta classroom y el marco de página de
 *   writerHTML), acotada a .pteron-document.
 * - public/index.html, entre marcadores:
 *     <!-- laminas:inicio -->: las láminas que flotan, con la figura de pteron en su reverso;
 *     <!-- hojas:inicio -->: las cuatro hojas que se arman en el escenario;
 *     <!-- hoja:inicio -->: la guía de Matemática del estudiante y la versión docente.
 *
 *   node scripts/pteron-hojas.mjs [ruta de pteron]   (por omisión ../pteron o $PTERON_DIR)
 *
 * Los bloques pasan por blocksToWriter, writerForAudience y writerHTML de pteron; las figuras, por el motor de
 * pteron-design (renderDetallado). Requiere los paquetes de pteron: su node_modules o la carpeta de PTERON_DEPS
 * (jsdom, @xmldom/xmldom, temml y mathml2omml). El contenido vive en scripts/pteron-hojas/materiales.mjs.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node lee TypeScript sin compilar desde la 22.18; antes, con la bandera.
if (!process.features.typescript) {
  const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pteron = path.resolve(process.argv[2] || process.env.PTERON_DIR || path.join(root, "..", "pteron"));
const modules = [path.join(pteron, "node_modules"), ...(process.env.PTERON_DEPS ? [path.join(process.env.PTERON_DEPS)] : [])];
register(pathToFileURL(path.join(root, "scripts/pteron-hojas/cargador.mjs")), {
  data: { shared: path.join(pteron, "src/shared"), modules },
});

const from = (file) => import(pathToFileURL(path.join(pteron, file)).href);
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

const { blocksToWriter } = await from("src/shared/writer-blocks.ts");
const { writerForAudience } = await from("src/shared/writer-answers.ts");
const { writerHTML } = await from("src/shared/office/renderer.ts");
const { FIGURE_KIT_VERSION } = await from("src/shared/design-figures.ts");
const kit = await from("src/vendor/pteron-design/library/render.mjs");
const { MATERIALES, LAMINAS } = await import(pathToFileURL(path.join(root, "scripts/pteron-hojas/materiales.mjs")).href);

const indexPath = path.join(root, "public/index.html");
let index = readFileSync(indexPath, "utf8");
const version = /\/styles\.css\?v=([^"&]+)/.exec(index)?.[1];
if (!version) throw new Error("index.html no enlaza /styles.css?v=…: no sé qué versión poner a las láminas");

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El pedido de una figura: un ejemplo del catálogo del kit o un pedido escrito en materiales.mjs. */
function pedidoDe(figura) {
  if (figura.pedido) return figura.pedido;
  const tipo = figura.ejemplo.split("-")[0];
  const motor = kit.motores[tipo];
  const ejemplo = motor?.ejemplos.find((item) => item.id === figura.ejemplo);
  if (!ejemplo) throw new Error(`El kit no tiene el ejemplo ${figura.ejemplo}`);
  const base = kit.pedidoEjemplo(motor, ejemplo);
  return figura.width ? { ...base, width: figura.width } : base;
}

/** SVG de la figura sin ancho ni alto propios: los fija el estilo, como al <img> que reemplaza. */
function figuraSVG(pedido, prefijo, style) {
  const { svg } = kit.renderDetallado(pedido, { prefijoIds: prefijo });
  return svg.replace(/^<svg\b([^>]*)>/, (_, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} class="pteron-figura" style="${style}">`);
}

// Hojas: cada material pasa por el mismo camino que una guía de pteron.
const PNG = (id) => `data:image/png;base64,UFRFUk9O${Buffer.from(id).toString("base64").replace(/=+$/, "")}`;
const pedidos = new Map();
const hojas = new Map();
for (const material of MATERIALES) {
  const bloques = material.bloques.map(({ figura, ...block }) => {
    if (!figura) return block;
    const pedido = pedidoDe(figura);
    pedidos.set(`${material.id}/${block.id}`, pedido);
    return { ...block, designFigure: { kitVersion: FIGURE_KIT_VERSION, pedido, png: PNG(`${material.id}/${block.id}`) } };
  });
  const writer = blocksToWriter(material.titulo, bloques, new Map());
  if (writer.pages.length !== 1) throw new Error(`${material.id} ocupa ${writer.pages.length} hojas: debe caber en una`);
  for (const audiencia of ["estudiante", "docente"]) {
    const html = writerHTML(writerForAudience(writer, audiencia));
    const page = new JSDOM(html).window.document;
    const article = page.querySelector("article.pteron-document");
    article.setAttribute("data-material", material.id);
    article.setAttribute("data-audiencia", audiencia);
    for (const img of article.querySelectorAll("img[data-pteron-design-figure]")) {
      const key = [...pedidos.keys()].find((id) => img.getAttribute("src") === PNG(id));
      if (!key) throw new Error(`Figura sin pedido en ${material.id}`);
      const holder = page.createElement("template");
      holder.innerHTML = figuraSVG(pedidos.get(key), `${material.id}-${audiencia}-${key.split("/")[1]}-`, img.getAttribute("style"));
      holder.content.firstElementChild.setAttribute("data-figura", key);
      img.replaceWith(holder.content.firstElementChild);
    }
    hojas.set(`${material.id}/${audiencia}`, { html: article.outerHTML, css: page.querySelector("style").textContent });
  }
}

// La hoja de Write acotada a .pteron-document: sin @page, sin cuerpo de documento y sin reglas de impresión.
const SHEET = ':is(.meridian-editor[data-editor-kind="writer"] .document-page,.pteron-document)';
function hojaCSS(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    let depth = 1;
    let k = open + 1;
    while (k < css.length && depth) depth += css[k] === "{" ? 1 : css[k] === "}" ? -1 : 0, (k += 1);
    const prelude = css.slice(i, open).trim();
    const body = css.slice(open + 1, k - 1);
    i = k;
    if (prelude.startsWith("@page") || prelude.startsWith("@media print") || prelude === "body") continue;
    const selectors = prelude
      .split(/,(?![^()]*\))/)
      .map((sel) => sel.trim().replaceAll(SHEET, ".pteron-document"))
      .filter((sel) => !sel.includes(".meridian-editor"))
      // Lo que vive dentro de la hoja sin nombrarla (el pie de página) se acota igual
      .map((sel) => (sel.includes(".pteron-document") ? sel : `.pteron-document ${sel}`));
    if (selectors.length) out.push(`${selectors.join(",")}{${body.trim()}}`);
  }
  return out.join("\n");
}
const fuentes = [
  ["Outfit", "100 900", "outfit-latin-wght-normal", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"],
  ["Outfit", "100 900", "outfit-latin-ext-wght-normal", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"],
  ["Playwrite CL", "100 400", "playwrite-cl-wght-normal", null],
]
  .map(([family, weight, file, range]) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(/assets/fonts/${file}.woff2?v=${version}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`)
  .join("\n");
let origen = "";
try {
  origen = spawnSync("git", ["-C", pteron, "log", "-1", "--format=%h, %ad", "--date=short"], { encoding: "utf8" }).stdout.trim();
} catch {
  origen = "";
}
const css = `/* pteron · la hoja de Write (pteron ${origen || "sin git"}; kit de figuras ${FIGURE_KIT_VERSION}), regla por regla.
   Generado por scripts/pteron-hojas.mjs desde writerHTML de src/shared/office: writerStyles con la paleta classroom
   y el marco de la hoja oficio, acotados a .pteron-document. No editar a mano.
   Letras: Outfit y Playwrite CL (OFL 1.1, /assets/fonts/LICENSE-OFL.txt). */
${fuentes}
${hojaCSS(hojas.get("matematica/estudiante").css)}
.pteron-document .pteron-figura{display:inline-block;vertical-align:top}
`;
writeFileSync(path.join(root, "public/pteron-hoja.css"), css);

// Láminas: la cara es el recorte del atlas; el reverso, la misma silueta reflejada con la figura de pteron.
/** Contorno de una silueta de celdas, en porcentajes, para clip-path. */
function contorno(filas) {
  const rows = filas.length;
  const cols = filas[0].length;
  const lleno = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && filas[r][c] === "#";
  const edges = new Map();
  const add = (a, b) => edges.set(a.join(","), b);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!lleno(r, c)) continue;
      if (!lleno(r - 1, c)) add([c, r], [c + 1, r]);
      if (!lleno(r, c + 1)) add([c + 1, r], [c + 1, r + 1]);
      if (!lleno(r + 1, c)) add([c + 1, r + 1], [c, r + 1]);
      if (!lleno(r, c - 1)) add([c, r + 1], [c, r]);
    }
  }
  const [start] = edges.keys();
  const points = [];
  let key = start;
  do {
    const [x, y] = key.split(",").map(Number);
    points.push([x, y]);
    key = edges.get(key).join(",");
  } while (key !== start);
  // Sin vértices intermedios en un mismo lado
  const corners = points.filter((p, i) => {
    const a = points[(i - 1 + points.length) % points.length];
    const b = points[(i + 1) % points.length];
    return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
  });
  const pct = (v, n) => `${+((v / n) * 100).toFixed(3)}%`;
  return `polygon(${corners.map(([x, y]) => `${pct(x, cols)} ${pct(y, rows)}`).join(",")})`;
}

/** Zonas del reverso: el rectángulo más ancho para la figura (según su proporción) y una celda para el pie. */
function zonas(filas, aspecto) {
  const rows = filas.length;
  const cols = filas[0].length;
  const lleno = (r, c) => filas[r][c] === "#";
  let mejor = null;
  for (let r0 = 0; r0 < rows; r0 += 1)
    for (let c0 = 0; c0 < cols; c0 += 1)
      for (let r1 = r0; r1 < rows; r1 += 1)
        for (let c1 = c0; c1 < cols; c1 += 1) {
          let ok = true;
          for (let r = r0; r <= r1 && ok; r += 1) for (let c = c0; c <= c1 && ok; c += 1) ok = lleno(r, c);
          if (!ok) continue;
          const w = c1 - c0 + 1;
          const h = r1 - r0 + 1;
          // Escala a la que cabe la figura en ese rectángulo
          const escala = Math.min(w, h * aspecto) / aspecto;
          if (!mejor || escala > mejor.escala + 1e-9 || (Math.abs(escala - mejor.escala) < 1e-9 && r0 > mejor.r0))
            mejor = { r0, c0, r1, c1, escala };
        }
  const libres = [];
  for (let r = 0; r < rows; r += 1)
    for (let c = 0; c < cols; c += 1)
      if (lleno(r, c) && !(r >= mejor.r0 && r <= mejor.r1 && c >= mejor.c0 && c <= mejor.c1)) libres.push([r, c]);
  // El pie va en una fila libre completa si la hay; si no, en la celda libre más baja.
  const filasLibres = [...new Set(libres.map(([r]) => r))];
  let pie = null;
  for (const r of filasLibres) {
    const enFila = libres.filter(([rr]) => rr === r).map(([, c]) => c);
    const c0 = Math.min(...enFila);
    const c1 = Math.max(...enFila);
    if (enFila.length === c1 - c0 + 1 && (!pie || c1 - c0 > pie.c1 - pie.c0)) pie = { r0: r, r1: r, c0, c1 };
  }
  const area = ({ r0, c0, r1, c1 }) => `${r0 + 1}/${c0 + 1}/${r1 + 2}/${c1 + 2}`;
  return { figura: area(mejor), pie: pie ? area(pie) : null, grid: `repeat(${rows},1fr)/repeat(${cols},1fr)` };
}

const laminas = LAMINAS.map((lamina) => {
  const pedido = lamina.hoja ? pedidos.get(`${lamina.hoja}/${lamina.bloque}`) : pedidoDe(lamina.figura);
  if (!pedido) throw new Error(`La lámina ${lamina.archivo} apunta a una figura que no existe`);
  const reflejo = lamina.forma.map((fila) => [...fila].reverse().join(""));
  const { svg, ancho, alto } = kit.renderDetallado(pedido, { prefijoIds: `lamina-${lamina.archivo}-` });
  const zona = zonas(reflejo, ancho / alto);
  const figura = svg.replace(/^<svg\b([^>]*)>/, (_, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} class="pteron-figura" focusable="false">`);
  const [x, y, w, capa, giro] = lamina.escritorio;
  const vars = [`--x:${x}`, `--y:${y}`, `--w:${w}`, `--r:${giro}`];
  if (lamina.movil) vars.push(`--xm:${lamina.movil[0]}`, `--ym:${lamina.movil[1]}`, `--wm:${lamina.movil[2]}`, `--rm:${lamina.movil[4]}`);
  const src = (size) => `/assets/atlas/${lamina.archivo}-${size}.webp?v=${version}`;
  const pie = zona.pie
    ? `<p class="reverso-pie" style="grid-area:${zona.pie}"><b>${escape(pedido.titulo)}</b> <span>Lámina: ${escape(lamina.fuente)}</span></p>`
    : "";
  return `<div class="lamina" data-lamina="${lamina.archivo}" data-capa="${capa}"${lamina.hoja ? ` data-hoja="${lamina.hoja}" data-bloque="${lamina.bloque}"` : ""}${lamina.movil ? "" : " data-solo-escritorio"} style="${vars.join(";")}">`
    + `<div class="lamina-sombra"><img src="${src(300)}" alt="" decoding="async" draggable="false"></div>`
    + `<div class="lamina-cuerpo"><div class="lamina-cara"><img src="${src(600)}" srcset="${src(300)} 300w, ${src(600)} 600w" sizes="(max-width: 760px) 36vw, 24vw" alt="" decoding="async" draggable="false"></div>`
    + `<div class="lamina-reverso" style="clip-path:${contorno(reflejo)};grid-template:${zona.grid}"><div class="reverso-figura" style="grid-area:${zona.figura}">${figura}</div>${pie}</div></div></div>`;
});

/** Reemplaza el contenido entre dos marcadores de index.html. */
function inject(name, markup) {
  const start = `<!-- ${name}:inicio -->`;
  const end = `<!-- ${name}:fin -->`;
  const a = index.indexOf(start);
  const b = index.indexOf(end);
  if (a < 0 || b < a) throw new Error(`index.html no tiene los marcadores de ${name}`);
  index = `${index.slice(0, a + start.length)}${markup}${index.slice(b)}`;
}
inject("laminas", laminas.join(""));
inject("hojas", MATERIALES.map((material) => `<div class="mesa-hoja" data-hoja="${material.id}">${hojas.get(`${material.id}/estudiante`).html}</div>`).join(""));
inject("hoja", ["estudiante", "docente"].map((audiencia) => hojas.get(`matematica/${audiencia}`).html).join(""));
writeFileSync(indexPath, index);
console.log(`${LAMINAS.length} láminas, ${MATERIALES.length} hojas y la guía de Matemática en dos versiones · pteron ${origen || "sin git"} · kit ${FIGURE_KIT_VERSION}`);
