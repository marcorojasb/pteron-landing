import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// La Content-Security-Policy de public/_headers: los scripts sólo salen del sitio o son los en línea que el sitio
// tiene, con su hash. Si un script en línea cambia, su hash cambia y esta prueba dice cuál poner en _headers.
const pub = fileURLToPath(new URL("../public/", import.meta.url));
const archivos = (dir, ext) =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "assets" ? [] : archivos(ruta, ext);
    return ruta.endsWith(ext) ? [ruta] : [];
  });
const htmls = archivos(pub, ".html");
const scripts = archivos(pub, ".js");
const relativa = (ruta) => path.relative(pub, ruta);

const headers = readFileSync(path.join(pub, "_headers"), "utf8");
const bloqueRaiz = /^\/\*\n((?: {2}.+\n?)+)/m.exec(headers)?.[1] ?? "";
const politica = /^ {2}Content-Security-Policy: (.+)$/m.exec(bloqueRaiz)?.[1] ?? "";
const directivas = Object.fromEntries(
  politica
    .split(";")
    .map((parte) => parte.trim().split(/\s+/))
    .filter(([nombre]) => nombre)
    .map(([nombre, ...valores]) => [nombre, valores]),
);

/** Los scripts en línea de cada HTML que el navegador ejecuta (un bloque de datos, como el JSON-LD, no corre). */
const enLinea = htmls.flatMap((ruta) =>
  [...readFileSync(ruta, "utf8").matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, atributos]) => !/type="application\/ld\+json"/.test(atributos))
    .map(([, , cuerpo]) => ({ ruta: relativa(ruta), hash: `'sha256-${createHash("sha256").update(cuerpo).digest("base64")}'` })),
);

test("la CSP vale para todo el sitio y cierra lo que no se usa", () => {
  assert.ok(politica, "public/_headers trae Content-Security-Policy en /*");
  assert.deepEqual(directivas["default-src"], ["'self'"]);
  assert.deepEqual(directivas["object-src"], ["'none'"]);
  assert.deepEqual(directivas["base-uri"], ["'none'"]);
  assert.deepEqual(directivas["frame-ancestors"], ["'none'"]);
  assert.deepEqual(directivas["form-action"], ["'self'"]);
  assert.deepEqual(directivas["img-src"], ["'self'", "data:"]);
  assert.deepEqual(directivas["font-src"], ["'self'"]);
  // Los atributos style quedan (las láminas de la portada llevan su posición en style); un <style> inyectado, no
  assert.deepEqual(directivas["style-src"], ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directivas["style-src-elem"], ["'self'"]);
  assert.equal(directivas["script-src"][0], "'self'");
  for (const prohibido of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "*", "https:", "data:"]) {
    assert.ok(!directivas["script-src"].includes(prohibido), `script-src sin ${prohibido}`);
  }
});

test("cada script en línea del sitio está en script-src con su hash, y no sobra ninguno", () => {
  assert.ok(enLinea.length > 0);
  const permitidos = new Set(directivas["script-src"].filter((valor) => valor.startsWith("'sha256-")));
  for (const { ruta, hash } of enLinea) assert.ok(permitidos.has(hash), `${ruta}: agrega ${hash} a script-src en public/_headers`);
  const usados = new Set(enLinea.map(({ hash }) => hash));
  for (const hash of permitidos) assert.ok(usados.has(hash), `${hash} ya no lo usa ninguna página: quítalo de public/_headers`);
});

test("ningún HTML ni el HTML que arma el JavaScript usa manejadores en línea ni javascript:", () => {
  for (const ruta of htmls) {
    const html = readFileSync(ruta, "utf8");
    assert.doesNotMatch(html, /<[a-z][^>]*\son[a-z]+\s*=/i, `${relativa(ruta)}: un on…= en línea no corre con la CSP`);
    assert.doesNotMatch(html, /\b(href|src|action)\s*=\s*["']?\s*javascript:/i, relativa(ruta));
    assert.doesNotMatch(html, /<style[\s>]/i, `${relativa(ruta)}: un <style> no corre con style-src-elem 'self'; va en una hoja`);
  }
  for (const ruta of scripts) {
    const codigo = readFileSync(ruta, "utf8");
    assert.doesNotMatch(codigo, /\son[a-z]+=\\?["']/i, `${relativa(ruta)}: arma HTML con un on…= en línea`);
    assert.doesNotMatch(codigo, /javascript:/i, relativa(ruta));
    assert.doesNotMatch(codigo, /<style[\s>]/i, `${relativa(ruta)}: arma un <style>, que la CSP no deja`);
  }
});

test("connect-src cubre los servicios de afuera a los que el JavaScript del sitio pide datos", () => {
  const externos = new Set(
    scripts.flatMap((ruta) => [...readFileSync(ruta, "utf8").matchAll(/https:\/\/(api\.[a-z0-9.-]+)/g)].map(([, host]) => `https://${host}`)),
  );
  assert.ok(externos.has("https://api.github.com"), "release-data.js lee las versiones de GitHub");
  for (const origen of externos) assert.ok(directivas["connect-src"].includes(origen), `connect-src sin ${origen}`);
  assert.equal(directivas["connect-src"][0], "'self'");
});

test("Cloudflare Web Analytics, que el borde inyecta en cada página, sigue funcionando con la CSP", () => {
  // Cloudflare agrega <script src="https://static.cloudflareinsights.com/beacon.min.js/…" data-cf-beacon> al servir el
  // HTML (no está en el repositorio) y el script envía a cloudflareinsights.com. Sin estas dos fuentes, la CSP lo
  // bloquea en cada página y la analítica de visitas deja de recibir datos.
  assert.ok(directivas["script-src"].includes("https://static.cloudflareinsights.com"), "script-src con el beacon");
  assert.ok(directivas["connect-src"].includes("https://cloudflareinsights.com"), "connect-src con su envío");
});
