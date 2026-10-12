import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const read = (rel) => readFileSync(path.join(pub, rel), "utf8");

function* pages(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "assets") continue;
    if (statSync(full).isDirectory()) yield* pages(full);
    else if (name.endsWith(".html")) yield path.relative(pub, full).split(path.sep).join("/");
  }
}
const ALL = [...pages(pub)];

test("cada página trae la esquina, el colofón y el índice al día (node scripts/sitio.mjs)", () => {
  assert.ok(ALL.length >= 9, "están todas las páginas");
  for (const page of ALL) {
    const html = read(page);
    for (const name of ["esquina", "colofon", "indice"]) {
      assert.equal(html.split(`<!-- ${name}:inicio -->`).length, 2, `${page}: un solo bloque ${name}`);
    }
    assert.equal((html.match(/<dialog class="indice" id="indice"/g) || []).length, 1, `${page}: un índice`);
    assert.equal((html.match(/<footer class="colofon" id="colofon">/g) || []).length, 1, `${page}: un colofón`);
  }
  // --revisar sale con error si alguna página quedó desactualizada
  execFileSync(process.execPath, [path.join(root, "scripts/sitio.mjs"), "--revisar"], { stdio: "pipe" });
});

test("el índice y el colofón marcan la página actual, y sólo esa", () => {
  const cases = [["index.html", "/"], ["planes/index.html", "/planes"], ["descargar/index.html", "/descargar"], ["docs/index.html", "/docs"], ["cuenta/index.html", "/cuenta"]];
  for (const [page, href] of cases) {
    const html = read(page);
    const current = [...html.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(current, [href, href], `${page}: colofón e índice marcan ${href}`);
  }
  assert.deepEqual([...read("privacidad.html").matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]), ["/privacidad"]);
  assert.equal(read("404.html").includes('aria-current="page"'), false);
});

test("Descargar va en la esquina salvo en /descargar y /admin; en el inicio parte oculto", () => {
  const corner = (page) => read(page).match(/<nav class="esquina"[\s\S]*?<\/nav>/)[0];
  assert.match(corner("planes/index.html"), /esquina-descargar" href="\/descargar" data-descargar>Descargar<\/a>/);
  assert.match(corner("index.html"), /data-descargar data-oculto>Descargar<\/a>/);
  assert.doesNotMatch(corner("descargar/index.html"), /esquina-descargar/);
  assert.doesNotMatch(corner("admin/index.html"), /esquina-descargar/);
});

test("todas las páginas usan la misma versión de caché y ninguna carga letras de terceros", () => {
  const versions = new Set();
  for (const page of ALL) {
    const html = read(page);
    for (const m of html.matchAll(/\?v=([0-9.-]+)/g)) versions.add(m[1]);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, `${page} no pide letras a Google`);
    assert.match(html, /<html lang="es-CL" class="no-js">/, `${page} parte sin JavaScript`);
  }
  assert.equal(versions.size, 1, `una sola versión: ${[...versions].join(", ")}`);
});

test("la 404 dice qué pasó y es noindex", () => {
  const html = read("404.html");
  assert.match(html, /<h1>Página no encontrada<\/h1>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
});
