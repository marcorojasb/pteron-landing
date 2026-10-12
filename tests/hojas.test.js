import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lo que arma scripts/pteron-hojas.mjs con el código de pteron: las láminas, las hojas y la guía en dos versiones
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const between = (name) => {
  const start = `<!-- ${name}:inicio -->`;
  const a = html.indexOf(start);
  const b = html.indexOf(`<!-- ${name}:fin -->`);
  assert.ok(a >= 0 && b > a, `index.html tiene el bloque ${name}`);
  return html.slice(a + start.length, b);
};
const laminas = [...between("laminas").matchAll(/<div class="lamina" data-lamina="([^"]+)"([^>]*)>/g)].map(([, id, attrs]) => ({
  id,
  hoja: /data-hoja="([^"]+)"/.exec(attrs)?.[1],
  bloque: /data-bloque="([^"]+)"/.exec(attrs)?.[1],
}));
const hojas = between("hojas");

test("dieciséis láminas, cada una con su imagen recortada", () => {
  assert.equal(laminas.length, 16);
  assert.equal(new Set(laminas.map((l) => l.id)).size, 16, "sin láminas repetidas");
  for (const { id } of laminas) {
    assert.match(between("laminas"), new RegExp(`/assets/atlas/${id}-600\\.webp`), `${id} trae su imagen`);
  }
});

test("cada lámina que aterriza encuentra su figura en una de las cuatro hojas", () => {
  const sheets = [...hojas.matchAll(/<div class="mesa-hoja" data-hoja="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(sheets, ["ciencias", "historia", "matematica", "lenguaje"]);
  const landing = laminas.filter((l) => l.hoja);
  assert.ok(landing.length >= 4, "al menos una lámina por hoja");
  for (const { id, hoja, bloque } of landing) {
    assert.ok(sheets.includes(hoja), `${id} apunta a una hoja que existe`);
    assert.match(hojas, new RegExp(`data-figura="${hoja}/${bloque}"`), `${id} aterriza en ${hoja}/${bloque}`);
  }
});

test("la hoja del estudiante no trae respuestas; la versión docente sí", () => {
  const guia = between("hoja");
  const estudiante = guia.slice(guia.indexOf('data-audiencia="estudiante"'), guia.indexOf('data-audiencia="docente"'));
  const docente = guia.slice(guia.indexOf('data-audiencia="docente"'));
  assert.ok(estudiante.length > 1000 && docente.length > 1000, "las dos versiones están");
  assert.doesNotMatch(estudiante, /Respuesta esperada/);
  assert.match(docente, /Respuesta esperada/);
});

test("las figuras de las hojas son SVG del motor de pteron, no imágenes", () => {
  assert.doesNotMatch(hojas, /data-pteron-design-figure/);
  assert.ok((hojas.match(/<svg[^>]*class="pteron-figura"/g) || []).length >= 6, "las seis figuras de las hojas");
});
