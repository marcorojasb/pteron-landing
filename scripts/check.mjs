/**
 * Comprobación rápida sin red: sintaxis de todo el JavaScript propio y un
 * empaquetado en seco del Worker (lo mismo que haría el deploy, sin subirlo).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const skip = new Set(["node_modules", ".wrangler", ".git", "assets"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(m?js)$/.test(name)) yield full;
  }
}

const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "public")), ...walk(path.join(root, "scripts")), ...walk(path.join(root, "tests"))];
for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log(`${files.length} archivos JavaScript con sintaxis válida.`);

// El binario local, nunca uno que npx descargue por su cuenta.
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
if (!existsSync(wrangler)) {
  console.error("Falta wrangler en node_modules: ejecuta `npm ci` antes de `npm run check`.");
  process.exit(1);
}
execFileSync(wrangler, ["deploy", "--dry-run", "--outdir", ".wrangler/dry-run"], { cwd: root, stdio: "inherit" });
console.log("Worker empaquetado en seco sin errores.");
