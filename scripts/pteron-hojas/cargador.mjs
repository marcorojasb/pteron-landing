/**
 * Ganchos de módulos para leer el código de pteron tal cual (TypeScript con importaciones sin extensión,
 * alias @shared y JSON sin atributo, como los resuelve Vite) desde scripts/pteron-hojas.mjs.
 * Los paquetes externos salen de node_modules de pteron o de la carpeta indicada en PTERON_DEPS.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let shared = "";
let modules = [];

export function initialize(data) {
  shared = data.shared;
  modules = data.modules;
}

const isFile = (file) => existsSync(file) && statSync(file).isFile();

function fromFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, "index.ts")]) {
    if (isFile(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

function fromPackage(specifier) {
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const rest = parts.slice(name.split("/").length).join("/");
  for (const dir of modules) {
    const root = path.join(dir, name);
    if (!existsSync(path.join(root, "package.json"))) continue;
    if (rest) return fromFile(path.join(root, rest));
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const dot = typeof pkg.exports === "string" ? pkg.exports : pkg.exports?.["."];
    const entry = typeof dot === "string" ? dot : dot?.import ?? dot?.default ?? dot?.require;
    return fromFile(path.join(root, typeof entry === "string" ? entry : pkg.module || pkg.main || "index.js"));
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@shared/")) specifier = pathToFileURL(path.join(shared, specifier.slice(8))).href;
  if (context.parentURL && (specifier.startsWith(".") || specifier.startsWith("file:"))) {
    const base = specifier.startsWith("file:")
      ? fileURLToPath(specifier)
      : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const url = fromFile(base);
    if (url) return next(url, context);
  }
  // Un paquete resuelve sus dependencias como Node, con las versiones anidadas en su propio node_modules
  if (context.parentURL?.includes("/node_modules/")) return next(specifier, context);
  if (!/^(node:|file:|\.|\/|data:)/.test(specifier)) {
    const url = fromPackage(specifier);
    if (url) return next(url, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
  }
  if (/\.css(\?|$)|\?raw$/.test(url)) return { format: "module", source: "export default '';", shortCircuit: true };
  return next(url, context);
}
