import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const read = (rel) => readFileSync(path.join(pub, rel), "utf8");
const exists = (url) => existsSync(path.join(pub, decodeURIComponent(new URL(url, "https://pteron.patagua.dev").pathname)));

function* pages(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "assets") continue;
    if (statSync(full).isDirectory()) yield* pages(full);
    else if (name.endsWith(".html")) yield path.relative(pub, full).split(path.sep).join("/");
  }
}
const ALL = [...pages(pub)];

test("la marca tiene sus huecos: los contornos interiores van al revés y con evenodd", () => {
  const svg = read("assets/marca.svg");
  assert.match(svg, /<path fill="currentColor" fill-rule="evenodd" d="/);
  const d = /\sd="([^"]+)"/.exec(svg)[1];
  const area = (part) => {
    const n = part.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let a = 0;
    for (let i = 0; i < n.length; i += 2) {
      const j = (i + 2) % n.length;
      a += n[i] * n[j + 1] - n[j] * n[i + 1];
    }
    return a / 2;
  };
  const partes = d.split(/(?=M)/).filter((p) => p.trim()).map(area);
  // Seis letras que giran en un sentido y tres huecos (la «p», la «e» y la «o») que giran en el otro
  const sentidos = [partes.filter((a) => a > 0).length, partes.filter((a) => a < 0).length].sort((x, y) => y - x);
  assert.deepEqual(sentidos, [6, 3]);
});

test("cada marca de la web usa la caja del símbolo de marca.svg", () => {
  const [, ancho, alto] = /<symbol id="pteron" viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(read("assets/marca.svg"));
  const caja = `viewBox="0 0 ${ancho} ${alto}"`;
  const usos = /<svg[^>]*?(viewBox="[^"]*")[^>]*><use href="\/assets\/marca\.svg[^"]*#pteron"/g;
  let n = 0;
  for (const page of ALL) {
    for (const m of read(page).matchAll(usos)) {
      assert.equal(m[1], caja, `${page}: la marca con otra caja`);
      n += 1;
    }
  }
  assert.ok(n >= ALL.length, "cada página lleva la marca");
  for (const archivo of ["scripts/sitio.mjs", "scripts/og/tarjeta.html"]) {
    assert.ok(readFileSync(path.join(root, archivo), "utf8").includes(caja), `${archivo}: la caja de la marca`);
  }
});

test("el inicio lleva el símbolo de marca.svg en la página: la marca de la portada no espera a las láminas", () => {
  const simbolo = /<symbol id="pteron"[\s\S]*?<\/symbol>/.exec(read("assets/marca.svg"))[0];
  const inicio = read("index.html");
  const bloque = /<!-- marca:inicio -->([\s\S]*?)<!-- marca:fin -->/.exec(inicio)?.[1] || "";
  assert.equal(bloque, `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${simbolo}</svg>`, "copiado tal cual por scripts/sitio.mjs");
  assert.equal(inicio.split('<symbol id="pteron"').length, 2, "un solo símbolo");
  assert.match(inicio, /<a class="marca portada-marca" href="\/" aria-label="pteron"><svg viewBox="0 0 2872 886" aria-hidden="true"><use href="#pteron"\/><\/svg><\/a>/);
  // Las demás páginas no tienen el símbolo: piden la marca a marca.svg
  for (const page of ALL.filter((page) => page !== "index.html")) {
    assert.doesNotMatch(read(page), /<symbol id="pteron"|<use href="#pteron"/, `${page}: la marca, desde marca.svg`);
  }
});

test("los archivos de la marca están al día con marca.svg (node scripts/marca.mjs)", () => {
  execFileSync(process.execPath, [path.join(root, "scripts/marca.mjs"), "--revisar"], { stdio: "pipe" });
  assert.ok(existsSync(path.join(pub, "favicon.ico")), "favicon.ico en la raíz");
  assert.ok(
    readFileSync(path.join(pub, "apple-touch-icon.png")).equals(readFileSync(path.join(pub, "assets/apple-touch-icon-v4.png"))),
    "apple-touch-icon.png en la raíz, igual al de assets",
  );
  for (const file of ["favicon-v5-16.png", "favicon-v5-32.png", "favicon-v5-48.png", "apple-touch-icon-v4.png", "app-icon-v5-192.png", "app-icon-v5-512.png", "app-icon-v4-mascara.png", "icono-v4.svg"]) {
    assert.ok(existsSync(path.join(pub, "assets", file)), `falta assets/${file}`);
  }
});

test("cada página usa el icono nuevo y su imagen para compartir existe", () => {
  for (const page of ALL) {
    const html = read(page);
    if (!html.includes('rel="icon"')) continue;
    assert.doesNotMatch(html, /favicon-v2|apple-touch-icon-v2|app-icon-v2/, `${page} todavía enlaza el icono anterior`);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/assets\/icono-v4\.svg">/, `${page}: favicon SVG`);
    for (const m of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)">/g)) {
      assert.ok(exists(m[1]), `${page}: no existe ${m[1]}`);
    }
  }
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons) assert.ok(exists(icon.src), `manifest: no existe ${icon.src}`);
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"), "manifest con icono enmascarable");
});

test("/marca: cada descarga existe, los colores son los del sistema y las láminas traen su figura", () => {
  const html = read("marca/index.html");
  const descargas = [...html.matchAll(/<a href="([^"]+)" download>/g)].map((m) => m[1]);
  assert.ok(descargas.length >= 8);
  for (const href of descargas) assert.ok(exists(href), `/marca: no existe ${href}`);
  const tokens = read("styles.css");
  for (const [nombre, hex] of [["azul", "#1E3F94"], ["tinta", "#1F2A3D"], ["lapiz", "#F0C060"], ["mesa", "#E9EDF1"], ["grafito", "#5B6B82"]]) {
    assert.match(tokens, new RegExp(`--${nombre}:${hex}`), `styles.css define --${nombre}`);
    assert.match(html, new RegExp(`<span class="hex">${hex}</span>`), `/marca muestra ${hex}`);
  }
  assert.equal((html.match(/<li class="par" data-lamina="/g) || []).length, 4, "cuatro láminas con su figura");
  assert.equal((html.match(/class="pteron-figura"/g) || []).length, 4, "cada par lleva la figura de pteron");
});


test("cada página enlaza su tarjeta para compartir y la describe con su lámina y su crédito", async () => {
  const { TARJETAS, VERSION, textoAlternativo } = await import("../scripts/og.mjs");
  const inicio = read("index.html");
  for (const tarjeta of TARJETAS) {
    const html = read(tarjeta.pagina);
    const url = `https://pteron.patagua.dev/assets/og/${tarjeta.nombre}-${VERSION}.jpg`;
    assert.ok(exists(url), `falta ${url}`);
    assert.match(html, new RegExp(`<meta property="og:image" content="${url}">`), `${tarjeta.pagina}: og:image`);
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${url}">`), `${tarjeta.pagina}: twitter:image`);
    const alt = /<meta property="og:image:alt" content="([^"]*)">/.exec(html)?.[1];
    assert.equal(alt, textoAlternativo(tarjeta, inicio).replace(/"/g, "&quot;"), `${tarjeta.pagina}: texto alternativo`);
  }
});

test("el manifiesto no ofrece instalar la web como si fuera la app de pteron", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "browser");
  assert.equal(manifest.display_override, undefined);
});

test("cada lámina se recorta en escalera de uno, tres o seis cuadros, como dice /marca", () => {
  const materiales = readFileSync(path.join(root, "scripts/pteron-hojas/materiales.mjs"), "utf8");
  const formas = [...materiales.matchAll(/forma: (\[[^\]]*\])/g)].map((m) => JSON.parse(m[1]));
  assert.ok(formas.length >= 16, "las láminas declaran su forma");
  for (const forma of formas) {
    const cuadros = forma.join("").split("#").length - 1;
    assert.ok([1, 3, 6].includes(cuadros), `forma ${JSON.stringify(forma)}: ${cuadros} cuadros`);
    // Escalera: cada fila tiene un cuadro más que la anterior, todas pegadas al mismo lado
    forma.forEach((fila, i) => assert.equal(fila.split("#").length - 1, i + 1, `forma ${JSON.stringify(forma)}: fila ${i + 1}`));
    const izquierda = forma.every((fila) => /^#+\.*$/.test(fila));
    const derecha = forma.every((fila) => /^\.*#+$/.test(fila));
    assert.ok(izquierda || derecha, `forma ${JSON.stringify(forma)}: escalera pegada a un lado`);
  }
  assert.match(read("marca/index.html"), /recortada en escalera sobre la cuadrícula, de uno, tres o seis cuadros/);
});

test("las cabeceras de planes, descargar y cuenta llevan una lámina con su figura detrás", () => {
  for (const page of ["planes/index.html", "descargar/index.html", "cuenta/index.html"]) {
    const html = read(page);
    const pieza = html.match(/<!-- pieza:inicio -->([\s\S]*?)<!-- pieza:fin -->/)?.[1] || "";
    assert.match(pieza, /<div class="pieza" data-pieza aria-hidden="true"/, `${page}: la pieza`);
    assert.match(pieza, /class="pteron-figura"/, `${page}: la figura de pteron en el reverso`);
    const src = /<img src="([^"]+)"/.exec(pieza)?.[1];
    assert.ok(src && exists(src), `${page}: la lámina existe`);
  }
});

test("el colofón da los créditos completos de las láminas sólo donde se ven", () => {
  const completo = /Láminas de dominio público: una carta portulana/;
  assert.match(read("index.html"), completo);
  assert.match(read("marca/index.html"), completo);
  for (const page of ["planes/index.html", "cuenta/index.html", "privacidad.html", "404.html"]) {
    const html = read(page);
    assert.doesNotMatch(html.match(/<footer class="colofon"[\s\S]*?<\/footer>/)[0], completo, `${page}`);
    assert.match(html, /sus créditos están en <a href="\/privacidad#creditos">Privacidad<\/a>/, `${page}: enlace a los créditos`);
  }
});

test("Privacidad promete sólo el aviso que pteron tiene (ADR-049): nombre declarado o RUT, no un clasificador", () => {
  const seccion = read("privacidad.html").match(/<section id="estudiantes"[\s\S]*?<\/section>/)[0];
  assert.match(seccion, /un nombre declarado en un campo de persona o un RUT con formato chileno/);
  assert.match(seccion, /no un clasificador de datos sensibles/);
  assert.doesNotMatch(seccion, /incluidos nombres, RUT, calificaciones/);
});
