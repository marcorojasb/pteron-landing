import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const tokens = JSON.parse(read("kit/tokens.json"));

test("los colores del sitio son los de kit/tokens.json, la fuente única", async () => {
  const { COLORES } = await import("../scripts/kit.mjs");
  const css = read("public/styles.css");
  const raiz = css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{")));
  const variable = { "estado-ok": "ok", "estado-ok-papel": "ok-papel", "estado-ok-borde": "ok-borde", "estado-error": "error", "estado-error-papel": "error-papel", "estado-error-borde": "error-borde", "estado-nota-papel": "nota-papel", "estado-nota-borde": "nota-borde", "estado-aviso-papel": "aviso-papel", "estado-aviso-borde": "aviso-borde" };
  let n = 0;
  for (const [nombre, valor] of COLORES) {
    if (nombre === "sombra") {
      // En el sitio, la sombra es la tinta en canales RGB para usarla con transparencia
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16));
      assert.match(raiz, new RegExp(`--sombra:${r} ${g} ${b};`), "la sombra es de tinta");
      continue;
    }
    assert.match(raiz, new RegExp(`--${variable[nombre] || nombre}:${valor};`, "i"), `styles.css: --${variable[nombre] || nombre} debería ser ${valor}`);
    n += 1;
  }
  assert.ok(n >= 20, "se compararon todos los colores");
});

test("los dibujos de la marca usan las medidas de kit/tokens.json", async () => {
  const { AIRE, COLOR, RADIO, RADIO_FAVICON } = await import("../scripts/marca-dibujos.mjs");
  assert.equal(AIRE, tokens.marca.aire.$value, "el espacio libre es el alto de la «o»");
  assert.equal(RADIO, tokens.icono.radio.$value);
  assert.equal(RADIO_FAVICON, tokens.icono["radio-favicon"].$value);
  assert.equal(COLOR.azul, tokens.color.azul.$value);
  assert.equal(COLOR.tinta, tokens.color.tinta.$value);
  assert.equal(COLOR.lapiz, tokens.color.lapiz.$value);
  assert.equal(COLOR.mesa, tokens.color.mesa.$value);
  assert.match(read("public/assets/marca.svg"), new RegExp(`viewBox="${tokens.marca.viewbox.$value}"`), "la caja de la marca");
});

test("cada par de texto del lenguaje cumple su contraste, en claro, en oscuro y en la app", async () => {
  const { COLORES, COLORES_OSCURO, COLORES_APP, PARES, PARES_OSCURO, PARES_APP, contraste } = await import("../scripts/kit.mjs");
  for (const [paleta, pares] of [[COLORES, PARES], [COLORES_OSCURO, PARES_OSCURO], [[...COLORES, ...COLORES_APP], PARES_APP]]) {
    const valor = Object.fromEntries(paleta);
    for (const [a, b, minimo] of pares) {
      assert.ok(valor[a] && valor[b], `falta ${a} o ${b}`);
      assert.ok(contraste(valor[a], valor[b]) >= minimo, `${a} sobre ${b}: ${contraste(valor[a], valor[b]).toFixed(2)} < ${minimo}`);
    }
  }
  // Las dos paletas tienen los mismos nombres de base
  const oscuro = new Set(COLORES_OSCURO.map(([n]) => n));
  for (const n of ["tinta", "azul", "azul-hondo", "lapiz", "lapiz-hondo", "mesa", "mesa-honda", "hoja", "grafito", "suave", "regla", "linea"]) assert.ok(oscuro.has(n), `oscuro: falta ${n}`);
});

test("el .zip público del kit está al día y /marca lo ofrece (node scripts/kit.mjs)", async () => {
  execFileSync(process.execPath, [path.join(root, "scripts/kit.mjs"), "--revisar"], { stdio: "pipe" });
  const { ZIP_PUBLICO, armar } = await import("../scripts/kit.mjs");
  assert.ok(existsSync(path.join(root, "public", ZIP_PUBLICO)));
  assert.match(read("public/marca/index.html"), new RegExp(`href="/${ZIP_PUBLICO.replace(/[.]/g, "\\.")}[^"]*" download`), "/marca enlaza el .zip");
  const { publico, completo } = armar();
  // Lo de la app que no es el icono queda fuera de lo público
  assert.ok(!publico.some((a) => a.ruta.startsWith("app/") && !a.ruta.startsWith("app/build/")), "lo interno de la app no va en el .zip público");
  assert.ok(completo.length >= publico.length);
  for (const ruta of ["LENGUAJE.md", "marca/marca.svg", "icono/p-azul.svg", "app/build/icon.icns", "color/tokens.json", "color/tokens.css", "letras/Archivo.ttf", "verificar.mjs", "manifiesto.json"]) {
    assert.ok(publico.some((a) => a.ruta === ruta), `el kit trae ${ruta}`);
  }
});
