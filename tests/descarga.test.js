import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// /descargar/<sistema> (public/descargar/descarga.js): al llegar baja el instalador de la última versión y deja los
// pasos a la vista; la analítica de visitas cuenta cada una de esas páginas como una descarga de su sistema. Aquí corre
// sobre un documento de mentira, con el catálogo de versiones a mano.
const source = readFileSync(new URL("../public/descargar/descarga.js", import.meta.url), "utf8");
const leer = (ruta) => readFileSync(new URL(`../public/${ruta}`, import.meta.url), "utf8");
const GITHUB = "https://github.com/marcorojasb/pteron-beta/releases/latest";
const DMG = "https://github.com/marcorojasb/pteron-beta/releases/download/v0.8.2/pteron-0.8.2-arm64.dmg";

/** La página de un sistema; `catalogo` es lo que resuelve loadReleaseCatalog (o un Error, si falla). */
async function abrir({ archivo = "macosDmg", tipo = "navigate", movil = false, catalogo, listo = true, conDatos = true } = {}) {
  const boton = { href: GITHUB, textContent: "Descargar" };
  const main = { dataset: { descarga: archivo } };
  const oyentes = new Map();
  const visitas = { assign: [], replace: [] };
  const documento = {
    readyState: listo ? "complete" : "interactive",
    documentElement: { dataset: movil ? { equipo: "movil" } : {} },
    querySelector: (sel) => ({ "[data-descarga]": main, "[data-descarga-boton]": boton })[sel] ?? null,
  };
  const ventana = {
    document: documento,
    location: { assign: (url) => visitas.assign.push(url), replace: (url) => visitas.replace.push(url) },
    performance: { getEntriesByType: (t) => (t === "navigation" && tipo ? [{ type: tipo }] : []) },
    addEventListener: (nombre, fn) => oyentes.set(nombre, fn),
  };
  if (conDatos) {
    ventana.PTERON_RELEASES = {
      loadReleaseCatalog: async () => {
        if (catalogo instanceof Error) throw catalogo;
        return catalogo ?? { latest: { version: "0.8.2", assets: [{ kind: "macosDmg", url: DMG }] } };
      },
      findAsset: (latest, kind) => latest.assets.find((asset) => asset.kind === kind) ?? null,
    };
  }
  ventana.window = ventana;
  vm.runInNewContext(source, ventana);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { boton, visitas, cargar: async () => { oyentes.get("load")?.(); await new Promise((resolve) => setTimeout(resolve, 10)); } };
}

test("al llegar, la página baja el archivo de su sistema una vez y el botón queda para bajarlo otra vez", async () => {
  const pagina = await abrir();
  assert.deepEqual(pagina.visitas.assign, [DMG]);
  assert.equal(pagina.boton.href, DMG);
  assert.equal(pagina.boton.textContent, "Descargar otra vez");
});

test("la descarga espera a que la página termine de cargar: la analítica alcanza a anotar la visita", async () => {
  const pagina = await abrir({ listo: false });
  assert.deepEqual(pagina.visitas.assign, [], "todavía cargando");
  await pagina.cargar();
  assert.deepEqual(pagina.visitas.assign, [DMG]);
});

test("recargar o volver con «Atrás» no repite la descarga", async () => {
  for (const tipo of ["reload", "back_forward"]) {
    const pagina = await abrir({ tipo });
    assert.deepEqual(pagina.visitas.assign, [], tipo);
    assert.equal(pagina.boton.href, DMG, `${tipo}: el botón baja el archivo`);
    assert.equal(pagina.boton.textContent, "Descargar otra vez", tipo);
  }
});

test("en un teléfono no se baja nada: vuelve a /descargar, donde se envía el enlace", async () => {
  const pagina = await abrir({ movil: true });
  assert.deepEqual(pagina.visitas.replace, ["/descargar"]);
  assert.deepEqual(pagina.visitas.assign, []);
});

test("sin catálogo, sin el archivo o con un error, el botón queda en la página de versiones de GitHub", async () => {
  for (const caso of [
    { catalogo: { latest: null } },
    { archivo: "windowsExe" },
    { catalogo: new Error("sin red") },
    { conDatos: false },
  ]) {
    const pagina = await abrir(caso);
    assert.deepEqual(pagina.visitas.assign, [], JSON.stringify(caso));
    assert.equal(pagina.boton.href, GITHUB);
    assert.equal(pagina.boton.textContent, "Descargar");
  }
});

test("cada sistema tiene su página: noindex, su archivo, los pasos y los scripts en orden", () => {
  for (const [sistema, archivo, pasos] of [["macos", "macosDmg", 3], ["windows", "windowsExe", 3], ["linux", "linuxAppImage", 2]]) {
    const html = leer(`descargar/${sistema}/index.html`);
    assert.match(html, /<meta name="robots" content="noindex">/, `${sistema}: los buscadores no la indexan`);
    assert.match(html, new RegExp(`<main id="contenido" data-descarga="${archivo}">`), `${sistema}: su archivo`);
    assert.equal((html.match(/<li><span>/g) || []).length, pasos, `${sistema}: los pasos`);
    assert.ok(html.includes(`<a class="boton boton-papel" href="${GITHUB}" data-descarga-boton>Descargar</a>`), `${sistema}: sin JavaScript, la página de versiones`);
    const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ["/release-data.js", "/script.js", "/descargar/descarga.js"], `${sistema}: script.js marca el teléfono antes`);
  }
});

test("los botones de descarga de la web pasan por la página de su sistema, no bajan directo", () => {
  const inicio = leer("index.html");
  for (const sistema of ["macos", "windows", "linux"]) {
    assert.match(inicio, new RegExp(`<li data-platform="${sistema}"><a href="/descargar/${sistema}">`), `inicio: ${sistema}`);
    assert.match(leer("descargar/index.html"), new RegExp(`<a class="boton boton-papel" href="/descargar/${sistema}" data-download-${sistema}>`), `/descargar: ${sistema}`);
  }
  assert.match(leer("descargar/index.html"), /<a href="\/descargar\/linux">Descargar<span class="sr-only"> la AppImage<\/span><\/a>/);
  assert.match(leer("script.js"), /link\.href = `\/descargar\/\$\{platform\}`;/);
  for (const ruta of ["index.html", "planes/index.html", "descargar/index.html", "script.js", "descargar/download.js"]) {
    assert.doesNotMatch(leer(ruta), /releases\/download\//, `${ruta}: ningún enlace fijo a un archivo`);
  }
});

// /descargar (download.js): con el catálogo cargado, los botones de cada sistema siguen en su página de descarga; en
// un teléfono pasan a la versión en GitHub, porque ahí no se instala
test("en /descargar los botones de cada sistema siguen en su página; en un teléfono, la versión en GitHub", async () => {
  const fuente = leer("descargar/download.js");
  for (const movil of [false, true]) {
    const enlaces = Object.fromEntries(["macos", "windows", "linux"].map((s) => [`[data-download-${s}]`, { href: `/descargar/${s}` }]));
    const documento = {
      documentElement: { dataset: movil ? { equipo: "movil" } : {} },
      querySelector: (sel) => enlaces[sel] ?? null,
      querySelectorAll: () => [],
    };
    const latest = { version: "0.8.2", url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v0.8.2", assets: [{ kind: "macosDmg", url: DMG }] };
    const ventana = {
      document: documento,
      location: { origin: "https://pteron.test" },
      PTERON_RELEASES: { loadReleaseCatalog: async () => ({ latest }), findAsset: (l, kind) => l.assets.find((a) => a.kind === kind) ?? null, findSignature: () => null },
    };
    ventana.window = ventana;
    vm.runInNewContext(fuente, ventana);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const hrefs = Object.values(enlaces).map((e) => e.href);
    assert.deepEqual(hrefs, movil ? [latest.url, latest.url, latest.url] : ["/descargar/macos", "/descargar/windows", "/descargar/linux"], movil ? "teléfono" : "escritorio");
  }
});
