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
  // Las páginas legales se marcan en el pie del colofón y en el pie del índice
  assert.deepEqual([...read("privacidad.html").matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]), ["/privacidad", "/privacidad"]);
  assert.equal(read("404.html").includes('aria-current="page"'), false);
});

test("Descargar flota sólo en el inicio (parte oculto) y en /planes; en la documentación taparía el texto", () => {
  const corner = (page) => read(page).match(/<nav class="esquina"[\s\S]*?<\/nav>/)[0];
  assert.match(corner("planes/index.html"), /esquina-descargar" href="\/descargar" data-descargar>Descargar<\/a>/);
  assert.match(corner("index.html"), /data-descargar data-oculto>Descargar<\/a>/);
  for (const page of ["docs/index.html", "descargar/index.html", "admin/index.html", "cuenta/index.html", "privacidad.html", "terminos.html", "404.html", "marca/index.html"]) {
    assert.doesNotMatch(corner(page), /esquina-descargar/, `${page} no lleva Descargar flotante`);
  }
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

test("la esquina doblada abre el índice: sin JavaScript lleva al pie y su nombre es «Índice»", () => {
  for (const page of ALL) {
    const corner = read(page).match(/<nav class="esquina"[\s\S]*?<\/nav>/)[0];
    assert.match(corner, /<a class="oreja" href="#colofon" data-indice>/, `${page}: la esquina lleva al pie sin JavaScript`);
    assert.match(corner, /<span class="sr-only">Índice<\/span><\/a>/, `${page}: nombre accesible`);
  }
  const dialog = read("planes/index.html").match(/<dialog class="indice"[\s\S]*?<\/dialog>/)[0];
  assert.match(dialog, /<h2 class="indice-titulo" id="indice-titulo">Índice<\/h2>/);
  assert.match(dialog, /<nav class="indice-bloque" aria-labelledby="indice-aqui" data-indice-capitulos hidden>/, "los capítulos parten ocultos: los arma script.js");
  assert.match(dialog, /<a href="\/planes" aria-current="page">Planes<\/a>/);
});

test("los capítulos de cada página tienen ancla y nombre; los del inicio siguen el recorrido", () => {
  for (const page of ALL) {
    for (const m of read(page).matchAll(/<[a-z]+ [^>]*data-capitulo="([^"]*)"[^>]*>/g)) {
      assert.match(m[0], /\sid="[^"]+"/, `${page}: capítulo «${m[1]}» sin id`);
      assert.ok(m[1].trim(), `${page}: capítulo sin nombre en ${m[0]}`);
    }
  }
  const home = [...read("index.html").matchAll(/data-capitulo="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(home, ["Portada", "Cuatro hojas", "Cómo se pide", "La hoja", "En tu computador", "macOS, Windows y Linux"]);
  assert.match(read("index.html"), /id="hojas" data-mesa data-capitulo="Cuatro hojas" data-capitulo-avance="0\.9"/, "las hojas son un momento de la escena");
  const legal = (page) => [...read(page).matchAll(/<section id="([^"]+)" data-capitulo/g)].map((m) => m[1]);
  assert.deepEqual(legal("terminos.html"), ["naturaleza", "disponibilidad", "precio", "responsabilidad", "propiedad", "contacto"]);
  assert.deepEqual(legal("privacidad.html"), ["minimizacion", "trabajo-local", "originales", "estudiantes", "cuenta", "sitio-web", "consultas"]);
});
