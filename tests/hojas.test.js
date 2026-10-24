import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAMINAS } from "../scripts/pteron-hojas/materiales.mjs";
import { NADA, imagenLamina, imagenPieza } from "../scripts/pteron-hojas/imagenes.mjs";

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

// Lo que escribe el generador para las imágenes (scripts/pteron-hojas/imagenes.mjs), comprobado sin el código de pteron
const version = /\/styles\.css\?v=([^"&]+)/.exec(html)?.[1];

test("cada lámina pide una sola imagen, del ancho con que se ve, y las de escritorio no se bajan en el teléfono", () => {
  const partes = between("laminas").split('<div class="lamina" ').slice(1);
  assert.equal(partes.length, LAMINAS.length, "las láminas de materiales.mjs");
  for (const lamina of LAMINAS) {
    const parte = partes.find((p) => p.startsWith(`data-lamina="${lamina.archivo}"`));
    assert.ok(parte, `${lamina.archivo} está en el inicio`);
    const imagen = imagenLamina(lamina, version);
    assert.ok(parte.includes(`<div class="lamina-sombra">${imagen}</div>`), `${lamina.archivo}: la sombra, como la escribe el generador`);
    assert.ok(parte.includes(`<div class="lamina-cara">${imagen}</div>`), `${lamina.archivo}: la cara, con la misma imagen`);
    assert.equal((parte.match(/<img /g) || []).length, 2, `${lamina.archivo}: sombra y cara`);
    // sizes es el ancho de inicio.css: --w × 0,82vmax y, en el teléfono, --wm vw
    const v = (nombre) => Number(new RegExp(`[";]--${nombre}:(-?[\\d.]+)`).exec(parte)?.[1]);
    const w = v("w");
    const wm = parte.includes(";--wm:") ? v("wm") : w;
    assert.ok(parte.includes(`sizes="(max-width: 760px) ${wm}vw, ${+(w * 0.82).toFixed(2)}vmax"`), `${lamina.archivo}: sizes del ancho real`);
    // Sólo de escritorio: hasta 760 px está oculta y pide el GIF vacío
    assert.equal(parte.includes("data-solo-escritorio"), !lamina.movil, `${lamina.archivo}: data-solo-escritorio`);
    assert.equal((parte.match(/<source media="\(max-width: 760px\)" srcset="data:image\/gif;base64,/g) || []).length, lamina.movil ? 0 : 2, `${lamina.archivo}: el GIF del teléfono`);
    assert.doesNotMatch(parte, /loading="lazy"/, `${lamina.archivo}: sin carga diferida`);
  }
  assert.ok(NADA.startsWith("data:image/gif;base64,"));
});

test("la pieza de cabecera de planes, descargar y cuenta no se baja bajo 560 px, donde no se muestra", () => {
  for (const pagina of ["planes/index.html", "descargar/index.html", "cuenta/index.html"]) {
    const pieza = readFileSync(new URL(`../public/${pagina}`, import.meta.url), "utf8").match(/<!-- pieza:inicio -->([\s\S]*?)<!-- pieza:fin -->/)?.[1] || "";
    const archivo = /\/assets\/atlas\/([a-z-]+)-600\.webp/.exec(pieza)?.[1];
    const lamina = LAMINAS.find((item) => item.archivo === archivo);
    assert.ok(lamina, `${pagina}: la pieza es una lámina de materiales.mjs`);
    assert.ok(pieza.includes(`<div class="pieza-cara">${imagenPieza(lamina, version)}</div>`), `${pagina}: la imagen, como la escribe el generador`);
    assert.match(pieza, /<picture><source media="\(max-width: 560px\)" srcset="data:image\/gif;base64,[^"]+"><img /, `${pagina}: el GIF del teléfono`);
    assert.doesNotMatch(pieza, /loading="lazy"/, `${pagina}: la pieza es la imagen principal en escritorio`);
  }
});
