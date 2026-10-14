/**
 * Escribe en public/index.html la ventana de pteron en reposo (la Home), con las mismas plantillas que usa
 * public/pteron-ventana.js para la secuencia de «Cómo funciona»: una sola fuente para el marcado de la ventana.
 *
 *   node scripts/pteron-ventana.mjs
 *
 * El HTML queda entre <!-- ventana:inicio --> y <!-- ventana:fin -->: la página carga con la Home en reposo y la
 * secuencia la toma desde ahí (con movimiento reducido, el script la cambia por el encargo terminado).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const indexPath = path.join(root, "public/index.html");
const html = readFileSync(indexPath, "utf8");
const icons = /data-pt-icons="([^"]+)"/.exec(html)?.[1];
if (!icons) throw new Error("index.html no declara data-pt-icons en la ventana");

// Un navegador mínimo: sin elementos en el documento, cada sección del script termina sin hacer nada
const window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
const document = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
vm.runInNewContext(readFileSync(path.join(root, "public/pteron-ventana.js"), "utf8"), { window, document, console });
window.pteronUI.window.setIcons(icons);
const markup = window.pteronUI.window.html({ final: false });

const start = "<!-- ventana:inicio -->";
const end = "<!-- ventana:fin -->";
const a = html.indexOf(start);
const b = html.indexOf(end);
if (a < 0 || b < a) throw new Error("index.html no tiene los marcadores de la ventana");
writeFileSync(indexPath, `${html.slice(0, a + start.length)}${markup}${html.slice(b)}`);
console.log(`Ventana de pteron escrita en index.html (${markup.length} caracteres).`);
