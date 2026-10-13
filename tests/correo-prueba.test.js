import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/worker.js";
import { TERMS_VERSION } from "../src/lib/terms.js";
import { fakeAssets, fakeExecution, fakeNetwork, matches, testEnv, withFetch } from "./helpers/fakes.js";

// POST /api/admin/correo-prueba: los tres correos con datos de ejemplo, sólo al administrador que lo pide.
// Cada prueba usa un administrador distinto: la espera de 60 s se lleva por correo, en memoria.
const CLAVE = "re_clave_de_prueba_123";
const CORREO = {
  RESEND_API_KEY: CLAVE,
  EMAIL_FROM: "pteron <no-reply@patagua.dev>",
  SELLER_NAME: "Vendedor de Prueba SpA",
  SELLER_RUT: "76.123.456-7",
  SELLER_ADDRESS: "Calle Falsa 123, Coronel",
  SELLER_EMAIL: "contacto@vendedor.test",
};
const TERMINOS = readFileSync(new URL("../public/terminos/2026-10-13.html", import.meta.url), "utf8");
const admins = Array.from({ length: 8 }, (_, i) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i}`, email: `admin${i}@patagua.dev` }));
const profe = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "profe@escuela.cl" };

const envPrueba = (cambios = {}) => testEnv({
  ADMIN_EMAILS: admins.map((admin) => admin.email).join(","),
  ASSETS: fakeAssets({ [`/terminos/${TERMS_VERSION}`]: TERMINOS }),
  ...CORREO,
  ...cambios,
});

function red(usuario, resend = () => ({ status: 200, body: { id: "re_enviado" } })) {
  return fakeNetwork([
    { match: matches.auth("user"), respond: { body: usuario } },
    { match: (url) => url === "https://api.resend.com/emails", respond: (call) => resend(call) },
  ]);
}
const clic = (cuerpo, metodo = "POST") => new Request("https://pteron.test/api/admin/correo-prueba", {
  method: metodo,
  headers: { authorization: "Bearer sesion", "content-type": "application/json" },
  ...(metodo === "POST" ? { body: JSON.stringify(cuerpo ?? {}) } : {}),
});
const correr = (request, env) => worker.fetch(request, env, fakeExecution());
const enviosDe = (network) => network.calls.filter((call) => call.url === "https://api.resend.com/emails");

test("un correo que no es de administración recibe 403 y no se envía nada", async () => {
  const network = red(profe);
  await withFetch(network.fetch, async () => {
    const respuesta = await correr(clic(), envPrueba());
    assert.equal(respuesta.status, 403);
    assert.equal((await respuesta.json()).error, "forbidden");
  });
  assert.equal(enviosDe(network).length, 0);
  const sinSesion = await correr(new Request("https://pteron.test/api/admin/correo-prueba", { method: "POST" }), envPrueba());
  assert.equal(sinSesion.status, 401);
});

test("sólo acepta POST", async () => {
  const network = red(admins[0]);
  await withFetch(network.fetch, async () => {
    assert.equal((await correr(clic(null, "GET"), envPrueba())).status, 405);
  });
  assert.equal(enviosDe(network).length, 0);
});

test("manda los tres correos con asunto «[Prueba] », sólo al correo del administrador y sin tocar la base", async () => {
  const network = red(admins[1]);
  await withFetch(network.fetch, async () => {
    // Un destinatario en el cuerpo se ignora.
    const respuesta = await correr(clic({ to: "otro@ejemplo.cl", destinatario: "otro@ejemplo.cl", email: "otro@ejemplo.cl" }), envPrueba());
    assert.equal(respuesta.status, 200);
    const datos = await respuesta.json();
    assert.equal(datos.ok, true);
    assert.equal(datos.destinatario, admins[1].email);
    assert.deepEqual(datos.resultados.map((r) => [r.tipo, r.estado]), [["purchase", "enviado"], ["trial_ending", "enviado"], ["cancellation", "enviado"]]);
    assert.ok(datos.resultados.every((r) => r.asunto.startsWith("[Prueba] ")));
    assert.equal(JSON.stringify(datos).includes(CLAVE), false, "la respuesta no lleva la clave");
  });
  const envios = enviosDe(network);
  assert.equal(envios.length, 3);
  for (const envio of envios) {
    assert.deepEqual(envio.body.to, [admins[1].email]);
    assert.match(envio.body.subject, /^\[Prueba\] /);
    assert.equal(envio.body.from, CORREO.EMAIL_FROM);
    assert.equal(envio.headers.Authorization, `Bearer ${CLAVE}`);
    assert.ok(envio.body.html.includes(CORREO.SELLER_NAME) && envio.body.text.includes(CORREO.SELLER_RUT), "usa la configuración real del vendedor");
  }
  assert.match(envios[0].body.subject, /Confirmación de compra: pteron Basic/);
  assert.match(envios[1].body.subject, /Tu prueba de pteron Basic termina/);
  assert.match(envios[2].body.subject, /Cancelaste la renovación de pteron Basic/);
  assert.equal(envios[0].body.attachments?.length, 1, "la compra lleva la copia de los Términos, como la real");
  assert.equal(envios[1].body.attachments, undefined);
  // Una Idempotency-Key propia de cada envío, que no choca con las de los correos reales.
  const claves = envios.map((envio) => envio.headers["Idempotency-Key"]);
  assert.equal(new Set(claves).size, 3);
  assert.ok(claves.every((clave) => /^prueba:(purchase|trial_ending|cancellation):[0-9a-f-]{36}$/.test(clave) && !clave.startsWith("email:")));
  // Sólo se consultó la sesión y se llamó a Resend: ni lectura ni escritura en la base.
  assert.ok(network.calls.every((call) => call.url.includes("/auth/v1/user") || call.url === "https://api.resend.com/emails"));
  assert.equal(network.calls.some((call) => call.url.includes("billing_events") || call.url.includes("/rest/v1/")), false);
});

test("sin configuración completa responde 409 con los nombres que faltan y no envía nada", async () => {
  const network = red(admins[2]);
  await withFetch(network.fetch, async () => {
    const respuesta = await correr(clic(), envPrueba({ RESEND_API_KEY: "", SELLER_RUT: " " }));
    assert.equal(respuesta.status, 409);
    const datos = await respuesta.json();
    assert.equal(datos.error, "email_not_configured");
    assert.deepEqual(datos.faltan, ["RESEND_API_KEY", "SELLER_RUT"]);
    assert.match(datos.message, /RESEND_API_KEY, SELLER_RUT/);
  });
  assert.equal(enviosDe(network).length, 0);
  // Que faltara algo no gasta la espera: arreglado, el siguiente clic envía.
  const listo = red(admins[2]);
  await withFetch(listo.fetch, async () => {
    assert.equal((await correr(clic(), envPrueba())).status, 200);
  });
  assert.equal(enviosDe(listo).length, 3);
});

test("una segunda prueba antes de 60 segundos se rechaza con 429 y no envía; otro administrador no se ve afectado", async () => {
  const network = red(admins[3]);
  await withFetch(network.fetch, async () => {
    assert.equal((await correr(clic(), envPrueba())).status, 200);
    const segunda = await correr(clic(), envPrueba());
    assert.equal(segunda.status, 429);
    const datos = await segunda.json();
    assert.equal(datos.error, "rate_limited");
    assert.ok(datos.retry_after_seconds >= 1 && datos.retry_after_seconds <= 60);
    assert.equal(segunda.headers.get("retry-after"), String(datos.retry_after_seconds));
  });
  assert.equal(enviosDe(network).length, 3, "la segunda no envió nada");
  const otro = red(admins[4]);
  await withFetch(otro.fetch, async () => {
    assert.equal((await correr(clic(), envPrueba())).status, 200);
  });
  assert.equal(enviosDe(otro).length, 3);
});

test("si Resend rechaza un correo, el resultado lleva sólo el código y los demás siguen", async () => {
  let n = 0;
  const network = red(admins[5], () => (++n === 2 ? { status: 403, body: { name: "validation_error", message: `dominio no verificado ${CLAVE}` } } : { status: 200, body: { id: "re_ok" } }));
  await withFetch(network.fetch, async () => {
    const respuesta = await correr(clic(), envPrueba());
    assert.equal(respuesta.status, 200);
    const datos = await respuesta.json();
    assert.equal(datos.ok, false);
    assert.deepEqual(datos.resultados.map((r) => r.estado), ["enviado", "error", "enviado"]);
    assert.equal(datos.resultados[1].codigo, "validation_error");
    assert.equal(JSON.stringify(datos).includes(CLAVE), false);
    assert.equal(JSON.stringify(datos).includes("dominio no verificado"), false);
  });
  assert.equal(enviosDe(network).length, 3);
});

test("la página de Salud tiene el botón y lo arma sin innerHTML", () => {
  const js = readFileSync(new URL("../public/admin/admin.js", import.meta.url), "utf8");
  assert.ok(js.includes("Enviarme los correos de prueba") && js.includes("/api/admin/correo-prueba"));
  assert.equal(/innerHTML|insertAdjacentHTML/.test(js), false);
});
