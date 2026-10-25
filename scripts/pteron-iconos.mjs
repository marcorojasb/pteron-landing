/**
 * Escribe public/assets/pt-icons.svg: los iconos que dibuja la ventana de pteron, como <symbol id="pt-nombre">. Los de
 * Lucide salen del mismo paquete que usa la app (lucide-solid, en el node_modules de pteron); los tipos de material y
 * los formatos de archivo, de su familia propia (src/renderer/src/ui/familia.ts, ADR-185), que se lee con el esbuild
 * de pteron.
 *
 *   node scripts/pteron-iconos.mjs [ruta del repositorio de pteron]   (por omisión ../pteron o $PTERON_DIR)
 *
 * La lista es la de pteron-ventana.js; tests/pteron-ventana.test.js comprueba que cada icono que pide la ventana
 * esté en el sprite.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pteron = path.resolve(process.argv[2] || process.env.PTERON_DIR || path.join(root, "..", "pteron"));
const lucide = path.join(pteron, "node_modules/lucide-solid");

// Los glifos de lucide por su nombre de archivo (los alias de la app ya resueltos: CircleHelp es circle-question-mark
// y FilePlus2, file-plus-corner)
export const ICONOS = [
  "archive", "arrow-down", "arrow-up", "book-open", "bot", "brain", "check", "chevron-down", "chevron-right",
  "circle-question-mark", "clock-3", "copy", "file-plus-corner", "folder-open", "graduation-cap", "landmark", "layers",
  "library-big", "lightbulb", "list-checks", "lock-keyhole", "message-square", "panel-left", "paperclip", "search",
  "settings", "split", "square", "square-pen", "x",
];

const version = JSON.parse(readFileSync(path.join(lucide, "package.json"), "utf8")).version;
const attrs = (props) =>
  Object.entries(props)
    .filter(([key]) => key !== "key")
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, "&quot;")}"`)
    .join(" ");

const symbols = ICONOS.map((nombre) => {
  // La fuente de cada icono declara `node: [[etiqueta, atributos], …]`: datos literales del paquete
  const fuente = readFileSync(path.join(lucide, "dist/source/icons", `${nombre}.jsx`), "utf8");
  const literal = /node:\s*(\[[\s\S]*?\])\s*,\s*\n\s*aliases|node:\s*(\[[\s\S]*?\])\s*\n\s*\}/.exec(fuente);
  if (!literal) throw new Error(`No encuentro el dibujo de ${nombre} en lucide-solid`);
  const nodos = Function(`"use strict"; return (${literal[1] ?? literal[2]});`)();
  return `<symbol id="pt-${nombre}" viewBox="0 0 24 24">${nodos.map(([tag, props]) => `<${tag} ${attrs(props)}/>`).join("")}</symbol>`;
});

// La familia propia: el módulo no importa nada; esbuild le quita los tipos y se carga como datos
const esbuild = createRequire(path.join(pteron, "package.json"))("esbuild");
const { code } = esbuild.transformSync(readFileSync(path.join(pteron, "src/renderer/src/ui/familia.ts"), "utf8"), { loader: "ts", format: "esm" });
const { FAMILIA } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const familia = Object.entries(FAMILIA).map(
  ([concepto, trazos]) => `<symbol id="pt-${concepto}" viewBox="0 0 24 24">${trazos.map(([tag, props]) => `<${tag} ${attrs(props)}/>`).join("")}</symbol>`,
);

// Un comentario XML no admite «--»: la línea divisoria de la licencia se escribe con una raya
const licencia = readFileSync(path.join(lucide, "LICENSE"), "utf8").trim().replace(/-{2,}/g, "—");
writeFileSync(
  path.join(root, "public/assets/pt-icons.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg">\n<!-- Iconos de Lucide (lucide-solid ${version}), los mismos que usa la app pteron.\n${licencia} -->\n${symbols.join("\n")}\n` +
    `<!-- La familia propia de pteron (src/renderer/src/ui/familia.ts): los tipos de material y los formatos de archivo. -->\n${familia.join("\n")}\n</svg>\n`,
);
console.log(`${symbols.length} iconos de lucide-solid ${version} y ${familia.length} de la familia de pteron → public/assets/pt-icons.svg`);
