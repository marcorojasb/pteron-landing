/**
 * Genera public/pteron-app.css: las reglas de la interfaz de pteron, tal cual, para dibujar su ventana en la web.
 *
 *   node scripts/pteron-app-css.mjs [ruta del repositorio de pteron]   (por omisión ../pteron o $PTERON_DIR)
 *
 * Lee las hojas que importa app-styles.ts en el mismo orden, toma las reglas de los componentes que la web
 * muestra (barra superior, pestañas, Home, recuadro, conversación, tarjetas de material, marca de actividad)
 * y las acota a `.pt-app`, que hace de `body` de la app. La ventana mide 1440 × 880 como las capturas, así
 * que vw y vh se fijan a esa medida; quedan fuera el tema oscuro y las consultas de ancho. Las reglas globales
 * de elementos (styles.css y meridian-office.css) entran con el mismo prefijo, de modo que la cascada de la
 * app se conserva. Al final se agrega scripts/pteron-app/aislamiento.css (escrito a mano): devuelve dentro de
 * la ventana los valores que el sitio reinicia, dibuja el wordmark y los semáforos.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pteron = path.resolve(process.argv[2] || process.env.PTERON_DIR || path.join(root, "..", "pteron"));
const SRC = path.join(pteron, "src/renderer/src");
const W = 1440;
const H = 880;

// Orden de app-styles.ts. De meridian-office.css sólo entran sus reglas globales de elementos.
const FILES = [
  "styles.css",
  "meridian/meridian-office.css",
  "pteron.css",
  "ui/controls.css",
  "components/composer/composer.css",
  "components/chat/chat.css",
];
const GLOBAL_ONLY = new Set(["meridian/meridian-office.css"]);
const GLOBAL_TOO = new Set(["styles.css"]);
const GLOBAL_SEL = /^(\*|body|button|input|select|textarea|svg\.icon|button \.chevron)(:[a-z-]+(\([^)]*\))?)*$/;
const KEEP = new RegExp(
  "\\.(" +
    [
      "app-shell", "shell-topbar", "topbar-", "session-tab", "session-history", "workspace-menu-trigger", "shell-main",
      "shell-corner-controls", "footer-right", "footer-circle-btn", "home-", "type-tile", "filter-bar", "filter-field",
      "composer", "context-select", "chat-", "message", "material-card", "quiet-action", "btn\\b", "btn-",
      "activity-mark", "run-details-toggle", "run-step", "pteron-icon", "workspace-surface", "workspace-main", "md-body",
      "md-chat", "live-", "contextual-suggestion", "icon-action",
    ].join("|") +
    ")",
);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Divide en [preludio, cuerpo] respetando llaves anidadas. */
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let k = open + 1;
    while (k < css.length && depth) {
      if (css[k] === "{") depth += 1;
      else if (css[k] === "}") depth -= 1;
      k += 1;
    }
    out.push([prelude, css.slice(open + 1, k - 1)]);
    i = k;
  }
  return out;
}

const units = (body) =>
  body
    .replace(/(-?\d*\.?\d+)vw/g, (_, n) => `${+(Number(n) * W / 100).toFixed(4)}px`)
    .replace(/(-?\d*\.?\d+)vh/g, (_, n) => `${+(Number(n) * H / 100).toFixed(4)}px`);

function scope(selector) {
  const sel = selector.trim();
  if (!sel || sel.includes("data-theme") || sel.includes("meridian") || sel.startsWith("html") || sel.startsWith("@")) return null;
  if (sel.startsWith(":root")) return ".pt-app" + sel.slice(5);
  if (sel.startsWith("body")) return ".pt-app" + sel.slice(4);
  return ".pt-app " + sel;
}

function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of prelude) {
    if ("([".includes(ch)) depth += 1;
    if (")]".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

const frames = new Map();
function rules(css, out, { wantedRoot, globalOnly = false, globalToo = false }) {
  for (const [prelude, body] of blocks(css)) {
    if (prelude.startsWith("@keyframes")) {
      frames.set(prelude.split(/\s+/)[1], body);
      continue;
    }
    if (prelude.startsWith("@media")) {
      if (prelude.includes("prefers-reduced-motion")) {
        const inner = [];
        rules(body, inner, { wantedRoot: false });
        if (inner.length) out.push(`@media (prefers-reduced-motion:reduce){\n${inner.join("\n")}\n}`);
      }
      continue; // las de ancho no: la ventana es fija
    }
    if (prelude.startsWith("@")) continue;
    const sels = splitSelectors(prelude);
    if (globalOnly) {
      const keep = sels.map((s) => s.trim()).filter((s) => GLOBAL_SEL.test(s));
      const scoped = keep.map(scope).filter(Boolean);
      if (scoped.length) out.push(`${scoped.join(",")}{${units(body.trim())}}`);
      continue;
    }
    const isRoot = sels.some((s) => [":root", "body"].includes(s.trim()));
    const isGlobal =
      sels.some((s) => s.trim().startsWith("button:has(> svg)")) || (globalToo && sels.every((s) => GLOBAL_SEL.test(s.trim())));
    if (!(KEEP.test(prelude) || isGlobal || (isRoot && wantedRoot))) continue;
    const scoped = sels.map(scope).filter(Boolean);
    if (!scoped.length) continue;
    out.push(`${scoped.join(",")}{${units(body.trim())}}`);
  }
}

const out = [];
for (const file of FILES) {
  const css = stripComments(readFileSync(path.join(SRC, file), "utf8"));
  rules(css, out, { wantedRoot: !GLOBAL_ONLY.has(file), globalOnly: GLOBAL_ONLY.has(file), globalToo: GLOBAL_TOO.has(file) });
}
let css = out.join("\n");
// Los keyframes que se usan, con prefijo para no chocar con los del sitio
const used = [...frames.keys()].filter((name) => new RegExp(`\\b${name}\\b`).test(css)).sort((a, b) => b.length - a.length);
for (const name of used) css = css.replace(new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "g"), `pa-${name}`);
const keyframes = used
  .sort()
  .map((name) => `@keyframes pa-${name}{${units(frames.get(name))}}`)
  .join("\n");

// Compacta espacios sin tocar el contenido de cadenas
const compact = (text) => text.replace(/\n\s+/g, "\n").replace(/;\n/g, ";").replace(/\{\n/g, "{").replace(/\n\}/g, "}");

// La versión de package.json no siempre acompaña a la entrega: se cita el commit de origen
let origin = "";
try {
  origin = execFileSync("git", ["-C", pteron, "log", "-1", "--format=%h, %ad", "--date=short"], { encoding: "utf8" }).trim();
} catch {
  origin = "sin git";
}
const header = `/* pteron · la interfaz de la app (${origin}), regla por regla, para dibujar su ventana en la web.
   Generado por scripts/pteron-app-css.mjs desde src/renderer/src (styles.css, meridian-office.css, pteron.css,
   ui/controls.css, composer.css, chat.css) acotado a .pt-app; vw y vh fijados a una ventana de 1440 × 880.
   No editar a mano: se regenera con cada versión de pteron. Letras: IBM Plex (OFL 1.1, /assets/fonts). */
`;
const fonts = [
  ["IBM Plex Sans", "normal", 400, "ibm-plex-sans-latin-400-normal"],
  ["IBM Plex Sans", "italic", 400, "ibm-plex-sans-latin-400-italic"],
  ["IBM Plex Sans", "normal", 500, "ibm-plex-sans-latin-500-normal"],
  ["IBM Plex Sans", "normal", 600, "ibm-plex-sans-latin-600-normal"],
  ["IBM Plex Sans", "italic", 600, "ibm-plex-sans-latin-600-italic"],
  ["IBM Plex Serif", "normal", 400, "ibm-plex-serif-latin-400-normal"],
  ["IBM Plex Serif", "italic", 400, "ibm-plex-serif-latin-400-italic"],
  ["IBM Plex Serif", "normal", 600, "ibm-plex-serif-latin-600-normal"],
  ["IBM Plex Mono", "normal", 400, "ibm-plex-mono-latin-400-normal"],
]
  .map(([family, style, weight, file]) => `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(/assets/fonts/${file}.woff2) format("woff2")}`)
  .join("\n");
const shell = readFileSync(path.join(root, "scripts/pteron-app/aislamiento.css"), "utf8");
writeFileSync(path.join(root, "public/pteron-app.css"), `${header}${fonts}\n${compact(css)}\n${keyframes}\n${shell}`);
console.log(`${out.length} reglas · ${used.length} keyframes · pteron ${origin} → public/pteron-app.css`);
