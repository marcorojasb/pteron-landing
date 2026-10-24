import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import worker from "../src/worker.js";
import { createCorreo, faltantesCorreo, sendEmail } from "../src/lib/correo.js";
import { componerCorreo, escapar, fechaLarga } from "../src/lib/correo-textos.js";
import { reconcilePendingCheckouts, syncDueSubscriptions } from "../src/lib/flow-sync.js";
import { TERMS_RETRACTO, TERMS_VERSION } from "../src/lib/terms.js";
import { fakeAssets, fakeExecution, fakeNetwork, formRequest, jsonRequest, matches, testEnv, testServices, withFetch } from "./helpers/fakes.js";
import { basicEnPrueba, registro } from "./helpers/flow-fixtures.js";

// Claves y datos de mentira: nada de esto existe fuera de las pruebas.
const CLAVE = "re_clave_de_prueba_123";
const VENDEDOR = {
  SELLER_NAME: 'Marco & Hijos <SpA> "pteron"',
  SELLER_RUT: "76.123.456-7",
  SELLER_ADDRESS: "Calle Falsa 123, Santiago",
  SELLER_EMAIL: "contacto@vendedor.test",
};
const CORREO_CONFIGURADO = { RESEND_API_KEY: CLAVE, EMAIL_FROM: "pteron <no-reply@patagua.dev>", ...VENDEDOR };
const TERMINOS = readFileSync(new URL("../public/terminos/2026-10-13.html", import.meta.url), "utf8");
const nuevosAssets = () => fakeAssets({ [`/terminos/${TERMS_VERSION}`]: TERMINOS });
const ASSETS = nuevosAssets();

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "profe@escuela.cl", user_metadata: { full_name: "Profe Uno" } };
const INTENT = "22222222-2222-4222-8222-222222222222";
const BASIC = { id: "basic", display_name: "Basic", monthly_price_clp: 2990, trial_period_days: 7, ai_units_limit: 6_000_000, trial_ai_units_limit: 1_500_000, license_plan: "basic" };
const AHORA = new Date("2026-10-18T12:17:00Z");
const HORA = 3_600_000;

const envFlow = { FLOW_API_KEY: "flow-api", FLOW_SECRET_KEY: "flow-secret", FLOW_BASE_URL: "https://sandbox.flow.cl/api", FLOW_BASIC_PLAN_ID: "pteron-basic-2990-mensual", FLOW_PRO_PLAN_ID: "pteron-pro-9990-mensual" };
const envCorreo = (cambios = {}) => testEnv({ ...envFlow, ...CORREO_CONFIGURADO, ASSETS: nuevosAssets(), ...cambios });

/** Una suscripción de Basic en su prueba: termina (y se cobra) el 20 de octubre, a medianoche de Chile. */
const enPrueba = (cambios = {}) => ({
  id: "sub-1",
  user_id: USER.id,
  plan_id: "basic",
  provider: "flow",
  provider_subscription_id: "sus_basic01",
  provider_plan_id: "pteron-basic-2990-mensual",
  status: "trialing",
  trial_ends_at: "2026-10-20T03:00:00.000Z",
  current_period_start: "2026-10-13T03:00:00.000Z",
  current_period_end: "2026-10-20T03:00:00.000Z",
  cancel_at_period_end: false,
  canceled_at: null,
  terms_version: TERMS_VERSION,
  ...cambios,
});

/** Silencia console.error durante `fn` y devuelve lo que se registró. */
async function registrando(fn) {
  const errores = [];
  const consoleError = console.error;
  console.error = (...args) => errores.push(args);
  try {
    await fn();
  } finally {
    console.error = consoleError;
  }
  return errores;
}

const param = (call, nombre) => new URL(call.url).searchParams.get(nombre)?.replace(/^(eq|lt|gt|gte|lte)\./, "") ?? null;

/** Las condiciones `columna=gt.valor` / `lte.valor` de la URL, aplicadas a una fila. */
function cumpleRango(fila, call, columna) {
  return new URL(call.url).searchParams.getAll(columna).every((condicion) => {
    const [, operador, valor] = /^(gte|gt|lte|lt)\.(.*)$/.exec(condicion) ?? [];
    const lado = Date.parse(fila[columna]);
    const limite = Date.parse(valor);
    return { gt: lado > limite, gte: lado >= limite, lt: lado < limite, lte: lado <= limite }[operador] ?? true;
  });
}

/**
 * Supabase, Flow y Resend con estado. La base responde como PostgREST en lo que
 * los correos usan: billing_events con external_event_id único (el insert con
 * ignore-duplicates devuelve [] si ya existe), la búsqueda de pruebas por
 * terminar con sus rangos y el filtro de eventos por tipo, estado y fecha.
 * `resend(llamada, n)` decide qué responde Resend.
 */
function mundo({ subs = [], intents = [], eventos = [], flowSub = basicEnPrueba(), resend = () => ({ status: 200, body: { id: "re_enviado" } }), correo = USER.email, listaFlow = [], plan = BASIC } = {}) {
  const filas = subs.map((fila) => ({ ...fila }));
  const intentos = intents.map((fila) => ({ ...fila }));
  const registros = new Map(eventos.map((evento) => [evento.external_event_id, { id: `ev-${evento.external_event_id}`, status: "received", event_metadata: {}, created_at: AHORA.toISOString(), ...evento }]));
  const flow = { suscripcion: flowSub };
  let envios = 0;
  const network = fakeNetwork([
    {
      match: (url) => url === "https://api.resend.com/emails",
      respond: (call) => {
        envios += 1;
        return resend(call, envios);
      },
    },
    { match: matches.auth("user"), respond: { body: USER } },
    { match: matches.auth("admin/users/"), respond: { body: { id: USER.id, email: correo } } },
    { match: matches.supabase("plan_catalog"), respond: { body: plan ? [plan] : [] } },
    {
      match: matches.supabase("subscriptions", "GET"),
      respond: (call) => {
        const id = param(call, "id");
        if (id) return { body: filas.filter((fila) => fila.id === id) };
        const url = new URL(call.url);
        if (url.searchParams.has("trial_ends_at")) {
          return {
            body: filas
              .filter((fila) => fila.provider === param(call, "provider") && fila.status === param(call, "status") && fila.cancel_at_period_end === false && cumpleRango(fila, call, "trial_ends_at"))
              .map((fila) => ({ ...fila })),
          };
        }
        if (url.searchParams.has("created_at") || url.searchParams.has("updated_at")) {
          const [columna, estados] = [url.searchParams.has("created_at") ? "created_at" : "updated_at", /^in\.\((.*)\)$/.exec(url.searchParams.get("status") ?? "")?.[1].split(",")];
          return {
            body: filas
              .filter((fila) => fila.provider === param(call, "provider") && fila.provider_subscription_id && (columna === "created_at" ? !estados || estados.includes(fila.status) : fila.cancel_at_period_end === true) && cumpleRango(fila, call, columna))
              .map((fila) => ({ ...fila })),
          };
        }
        if (url.searchParams.has("or")) return { body: [] };
        const ids = [...(url.searchParams.get("provider_subscription_id") ?? "").matchAll(/"([^"]+)"/g)].map(([, valor]) => valor);
        const estados = /^in\.\((.*)\)$/.exec(url.searchParams.get("status") ?? "")?.[1].split(",");
        const usuario = param(call, "user_id");
        return { body: filas.filter((fila) => (!ids.length || ids.includes(fila.provider_subscription_id)) && (!estados || estados.includes(fila.status)) && (!usuario || fila.user_id === usuario)).map((fila) => ({ ...fila })) };
      },
    },
    {
      match: matches.supabase("subscriptions", "POST"),
      respond: (call) => {
        const fila = { id: `sub-${filas.length + 1}`, canceled_at: null, ...call.body };
        filas.push(fila);
        return { body: [{ ...fila }] };
      },
    },
    {
      match: matches.supabase("subscriptions", "PATCH"),
      respond: (call) => {
        const fila = filas.find((candidata) => candidata.id === param(call, "id"));
        if (!fila) return { body: [] };
        Object.assign(fila, call.body);
        return { body: [{ ...fila }] };
      },
    },
    {
      match: matches.supabase("billing_checkout_intents", "GET"),
      respond: (call) => {
        const [status, antes] = ["status", "updated_at"].map((nombre) => param(call, nombre));
        return { body: intentos.filter((intento) => (!status || intento.status === status) && (!antes || Date.parse(intento.updated_at) < Date.parse(antes))).map((intento) => ({ ...intento })) };
      },
    },
    {
      match: matches.supabase("billing_checkout_intents", "PATCH"),
      respond: (call) => {
        const [id, status] = [param(call, "id"), param(call, "status")];
        const intento = intentos.find((fila) => fila.id === id && (!status || fila.status === status) && (status !== "card_registration_pending" || Date.parse(fila.expires_at) > Date.now()));
        if (!intento) return { body: [] };
        Object.assign(intento, call.body, { updated_at: new Date().toISOString() });
        return { body: [{ ...intento }] };
      },
    },
    {
      match: matches.supabase("billing_events", "POST"),
      respond: (call) => {
        if (registros.has(call.body.external_event_id)) return { body: [] };
        const fila = { id: `ev-${registros.size + 1}`, created_at: AHORA.toISOString(), ...call.body };
        registros.set(fila.external_event_id, fila);
        return { body: [{ ...fila }] };
      },
    },
    {
      match: matches.supabase("billing_events", "PATCH"),
      respond: (call) => {
        const fila = registros.get(param(call, "external_event_id"));
        const estado = param(call, "status");
        if (!fila || (estado && fila.status !== estado)) return { body: [] };
        Object.assign(fila, call.body);
        return { body: [{ ...fila }] };
      },
    },
    {
      match: matches.supabase("billing_events", "GET"),
      respond: (call) => {
        const url = new URL(call.url);
        const tipos = /^in\.\((.*)\)$/.exec(url.searchParams.get("event_type") ?? "")?.[1].split(",");
        const estado = param(call, "status");
        const limite = Number(url.searchParams.get("limit") ?? 1000);
        const ids = /^in\.\((.*)\)$/.exec(url.searchParams.get("external_event_id") ?? "")?.[1].split(",").map((id) => id.replace(/^"|"$/g, ""));
        return {
          body: [...registros.values()]
            .filter((fila) => (!ids || ids.includes(fila.external_event_id)) && (!tipos || tipos.includes(fila.event_type)) && (!estado || fila.status === estado) && cumpleRango(fila, call, "created_at"))
            .slice(0, limite)
            .map((fila) => ({ ...fila })),
        };
      },
    },
    { match: matches.flow("/customer/getRegisterStatus"), respond: { body: registro({ customerId: "cus_1" }) } },
    { match: matches.flow("/subscription/create"), respond: () => ({ body: flow.suscripcion }) },
    { match: matches.flow("/subscription/get"), respond: () => ({ body: flow.suscripcion }) },
    { match: matches.flow("/subscription/cancel"), respond: () => ({ body: flow.suscripcion }) },
    { match: matches.flow("/customer/getSubscriptions"), respond: { body: { total: listaFlow.length, hasMore: false, data: listaFlow } } },
  ]);
  const aResend = () => network.calls.filter((call) => call.url === "https://api.resend.com/emails");
  return { network, filas, intentos, registros, flow, aResend, evento: (id) => registros.get(id) };
}

const intento = (cambios = {}) => ({
  id: INTENT,
  user_id: USER.id,
  plan_id: "basic",
  provider_customer_id: "cus_1",
  provider_plan_id: "pteron-basic-2990-mensual",
  status: "card_registration_pending",
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  updated_at: new Date().toISOString(),
  trial_days: 7,
  terms_version: TERMS_VERSION,
  ...cambios,
});

function retorno(runEnv, execution) {
  return worker.fetch(formRequest(`https://pteron.test/api/billing/card-callback?intent=${INTENT}`, { token: "tok_1" }), runEnv, execution);
}

function cancelar(runEnv, execution) {
  return worker.fetch(jsonRequest("https://pteron.test/api/billing/cancel", {}, { headers: { authorization: "Bearer sesion" } }), runEnv, execution);
}

const cuerpoDe = (llamada) => llamada.body;
const adjuntoDe = (llamada) => Buffer.from(llamada.body.attachments[0].content, "base64").toString("utf8");

// ── Resend ────────────────────────────────────────────────────────────────

test("sendEmail pide a Resend como su documentación: Bearer, Idempotency-Key, from, to, reply_to, adjuntos y vencimiento de 10 s", async () => {
  const env = envCorreo();
  const red = fakeNetwork([{ match: (url) => url === "https://api.resend.com/emails", respond: { body: { id: "re_1" } } }]);
  let init;
  await withFetch((url, opciones) => {
    init = opciones;
    return red.fetch(url, opciones);
  }, async () => {
    const resultado = await sendEmail(env, {
      to: "profe@escuela.cl",
      subject: "Asunto",
      html: "<p>Hola</p>",
      text: "Hola",
      idempotencyKey: "email:purchase:sub-1",
      attachments: [{ filename: "a.html", content: "PGgxPg==" }],
    });
    assert.deepEqual(resultado, { ok: true, id: "re_1" });
  });
  const [llamada] = red.calls;
  assert.equal(llamada.url, "https://api.resend.com/emails");
  assert.equal(llamada.method, "POST");
  assert.equal(llamada.headers.Authorization, `Bearer ${CLAVE}`);
  assert.equal(llamada.headers["Idempotency-Key"], "email:purchase:sub-1");
  assert.equal(llamada.headers["Content-Type"], "application/json");
  assert.deepEqual(llamada.body, {
    from: "pteron <no-reply@patagua.dev>",
    to: ["profe@escuela.cl"],
    subject: "Asunto",
    html: "<p>Hola</p>",
    text: "Hola",
    reply_to: VENDEDOR.SELLER_EMAIL,
    attachments: [{ filename: "a.html", content: "PGgxPg==" }],
  });
  assert.ok(init.signal instanceof AbortSignal, "con vencimiento");
});

test("sendEmail convierte cualquier fallo en un resultado tipado y nunca lanza", async () => {
  const env = envCorreo();
  const datos = { to: "profe@escuela.cl", subject: "x", html: "<p>x</p>", text: "x", idempotencyKey: "k" };
  const responder = (respuesta) => async () => respuesta;
  const casos = [
    [responder(new Response(JSON.stringify({ statusCode: 422, name: "validation_error", message: "profe@escuela.cl no vale" }), { status: 422 })), { ok: false, code: "validation_error", status: 422 }],
    [responder(new Response("<html>bad gateway</html>", { status: 502 })), { ok: false, code: "http_502", status: 502 }],
    [responder(new Response(JSON.stringify({ name: "Rate Limit!" }), { status: 429 })), { ok: false, code: "http_429", status: 429 }],
    [responder(new Response("{}", { status: 200 })), { ok: false, code: "invalid_response" }],
    [async () => { throw new DOMException("timeout", "TimeoutError"); }, { ok: false, code: "timeout" }],
    [async () => { throw new TypeError("fetch failed"); }, { ok: false, code: "network" }],
  ];
  for (const [fetchSimulado, esperado] of casos) {
    await withFetch(fetchSimulado, async () => assert.deepEqual(await sendEmail(env, datos), esperado));
  }
});

// ── Contenido ─────────────────────────────────────────────────────────────

const VENDEDOR_TEXTO = { nombre: "Ana Pérez", rut: "11.111.111-1", domicilio: "Av. Uno 1, Santiago", correo: "ana@vendedor.test", representante: "" };
const compuesto = (tipo, cambios = {}) => componerCorreo(tipo, { suscripcion: enPrueba(), plan: BASIC, vendedor: VENDEDOR_TEXTO, base: "https://pteron.patagua.dev", destinatario: "profe@escuela.cl", enPrueba: true, copiaAdjunta: false, ...cambios });
const LOGO = "https://pteron.patagua.dev/assets/correo/pteron-banda-correo-v1.png";
const sinPrueba = (cambios = {}) => enPrueba({ status: "active", trial_ends_at: null, current_period_start: "2026-10-13T03:00:00.000Z", current_period_end: "2026-11-13T03:00:00.000Z", ...cambios });
// Una fila de la ficha: la etiqueta en su párrafo y, debajo, el valor en el suyo (no dos columnas).
const fila = (etiqueta, valor) => new RegExp(`<p class="dk-mut"[^>]*>${etiqueta}</p><p class="dk-t"[^>]*>${valor}</p>`);
const todos = () => [
  compuesto("purchase"),
  compuesto("purchase", { suscripcion: sinPrueba(), enPrueba: false, copiaAdjunta: true }),
  compuesto("purchase", { suscripcion: sinPrueba({ status: "past_due" }), enPrueba: false }),
  compuesto("trial_ending"),
  compuesto("cancellation", { suscripcion: enPrueba({ cancel_at_period_end: true }) }),
  compuesto("cancellation", { suscripcion: sinPrueba({ cancel_at_period_end: true }), enPrueba: false }),
  compuesto("cancellation", { suscripcion: sinPrueba({ status: "past_due", cancel_at_period_end: true }), enPrueba: false }),
];

test("las fechas son del calendario de Chile, en verano (UTC-3) y en invierno (UTC-4)", () => {
  assert.equal(fechaLarga("2026-10-20T03:00:00.000Z"), "20 de octubre de 2026");
  assert.equal(fechaLarga("2026-10-20T02:59:59.000Z"), "19 de octubre de 2026", "a las 23:59 del 19 en Chile");
  assert.equal(fechaLarga("2026-07-01T04:00:00.000Z"), "1 de julio de 2026", "invierno");
  assert.equal(fechaLarga("2026-07-01T03:59:59.000Z"), "30 de junio de 2026");
  assert.equal(fechaLarga(null), "");
  assert.equal(fechaLarga("no es fecha"), "");
});

test("confirmación de compra con prueba: vendedor, $2.990 con IVA, fechas, cómo cancelar, cuotas y la versión de los Términos con su enlace", () => {
  const { subject, text, html } = compuesto("purchase");
  assert.equal(subject, "Confirmación de compra: pteron Basic");
  for (const fragmento of [
    "CONFIRMACIÓN DE COMPRA\nEmpezó tu prueba de Basic",
    "Tu prueba termina el 20 de octubre de 2026. Ese día se cobran $2.990, y luego cada mes, hasta que canceles.",
    "Plan: pteron Basic",
    "Precio: $2.990 al mes, IVA incluido",
    "Prueba gratis: Hasta el 20 de octubre de 2026",
    "Primer cobro: $2.990 el 20 de octubre de 2026",
    "Pago: Con tarjeta a través de Flow, que registra la tarjeta en su propio sitio: pteron no la recibe",
    "Cuota de IA incluida: 6.000.000 unidades de IA por período (1.500.000 durante la prueba); lo que no usas no pasa al siguiente",
    `Términos aceptados: Términos de uso, versión ${TERMS_VERSION} (https://pteron.patagua.dev/terminos/${TERMS_VERSION}) · copia fija, que no cambia`,
    "CÓMO CANCELAR\nCancelas cuando quieras desde tu cuenta, en https://pteron.patagua.dev/cuenta, con «Cancelar renovación».",
    "Si cancelas durante la prueba, no se cobra nada y Basic termina el día en que terminaba la prueba.",
    "Ir a mi cuenta: https://pteron.patagua.dev/cuenta",
    "QUIÉN TE VENDE\nNombre o razón social: Ana Pérez\nRUT: 11.111.111-1\nDomicilio: Av. Uno 1, Santiago\nCorreo: ana@vendedor.test",
    "Recibiste este correo porque contrataste pteron Basic con profe@escuela.cl. Guárdalo: es la confirmación de tu contratación y de los Términos que aceptaste.",
    "pteron lo vende Ana Pérez, RUT 11.111.111-1, domicilio Av. Uno 1, Santiago. Si respondes este correo, tu mensaje llega a ana@vendedor.test.",
  ]) {
    assert.ok(text.includes(fragmento), `texto: ${fragmento}`);
  }
  assert.doesNotMatch(text, /Si ya pagaste/, "con prueba no se habla de lo ya pagado");
  assert.doesNotMatch(text, /primer cobro de|Representante/);
  assert.doesNotMatch(text, /adjunta/);
  assert.ok(html.includes('<html lang="es-CL"') && html.includes("<title>Confirmación de compra: pteron Basic</title>"), "HTML con idioma y título");
  assert.match(html, /<h1 [^>]*>Empezó tu prueba de Basic<\/h1>/);
  assert.match(html, /<h2 [^>]*>Quién te vende<\/h2>/);
  assert.match(html, /<h2 [^>]*>Cómo cancelar<\/h2>/);
  assert.match(html, />Prueba gratis hasta el 20 de octubre de 2026\. Ese día se cobran \$2\.990, salvo que canceles antes\./, "preheader");
  assert.ok(html.includes('href="https://pteron.patagua.dev/cuenta"') && html.includes(`href="https://pteron.patagua.dev/terminos/${TERMS_VERSION}"`));
  assert.ok(html.includes('href="mailto:ana@vendedor.test"'));
  assert.match(html, /<a href="https:\/\/pteron\.patagua\.dev\/cuenta" class="btn-a"[^>]*>Ir a mi cuenta<\/a>/, "botón píldora");
  assert.match(html, fila("Primer cobro", "\\$2\\.990 el 20 de octubre de 2026"));
  assert.match(html, fila("RUT", "11\\.111\\.111-1"));
  assert.match(html, /Tu prueba termina el <strong[^>]*>20 de octubre de 2026<\/strong>/);
  assert.equal(compuesto("purchase", { copiaAdjunta: true }).text.includes(`versión ${TERMS_VERSION} (https://pteron.patagua.dev/terminos/${TERMS_VERSION}) · copia fija, también adjunta a este correo`), true);
});

test("los correos tienen la hoja del diseño: banda con el logo publicado, ficha, sin scripts ni recursos externos más que el logo", () => {
  for (const { html } of todos()) {
    assert.match(html, /^<!doctype html>/);
    const imagenes = [...html.matchAll(/<img\b[^>]*>/g)].map(([img]) => img);
    assert.equal(imagenes.length, 1, "sólo el logo");
    assert.ok(imagenes[0].includes(`src="${LOGO}"`) && imagenes[0].includes('alt="pteron"') && imagenes[0].includes('width="104" height="32"'));
    assert.match(html, /class="band px" bgcolor="#162F70"/);
    assert.match(html, /class="card" bgcolor="#FFFFFF"/);
    assert.match(html, /class="nota"/, "ficha de datos");
    assert.doesNotMatch(html, /<(script|link|iframe|form)\b/i);
    assert.doesNotMatch(html, /url\(|@import/i, "el <style> no trae recursos");
    assert.ok(Buffer.byteLength(html) < 60_000, "lejos del recorte de Gmail");
  }
  assert.ok(existsSync(new URL("../public/assets/correo/pteron-banda-correo-v1.png", import.meta.url)), "el logo se publica con el sitio");
  // /assets/* es inmutable por un año: el logo lleva versión en el nombre y el
  // de antes sigue publicado, igual byte a byte, para los correos ya enviados
  // y las plantillas de Supabase Auth.
  const anterior = new URL("../public/assets/correo/pteron-banda-correo.png", import.meta.url);
  assert.ok(existsSync(anterior), "el logo sin versión sigue publicado");
  assert.ok(readFileSync(anterior).equals(readFileSync(new URL("../public/assets/correo/pteron-banda-correo-v1.png", import.meta.url))));
});

test("ningún correo sale con marcadores «por definir» ni corchetes, y el texto plano está completo", () => {
  for (const { subject, html, text } of todos()) {
    for (const parte of [subject, text, html.replace(/<!--\[if [^\]]+\]>|<!\[endif\]-->/g, "")]) {
      assert.doesNotMatch(parte, /por definir|\[[^\]]*\]|undefined|null|NaN/i);
    }
    assert.ok(text.includes("\n—\nRecibiste este correo porque") && text.includes("profe@escuela.cl"), "el pie nombra al destinatario");
    assert.ok(text.includes("Tu cuenta de pteron: https://pteron.patagua.dev/cuenta"));
    assert.ok(text.includes("pteron lo vende Ana Pérez, RUT 11.111.111-1"));
    assert.doesNotMatch(text, /<[a-z]/i, "texto sin etiquetas");
  }
});

test("el representante legal es opcional: sale en la ficha y en el pie sólo si está configurado", () => {
  const vendedor = { ...VENDEDOR_TEXTO, nombre: "Pteron SpA", representante: "Ana Pérez" };
  const { text, html } = compuesto("purchase", { vendedor });
  assert.ok(text.includes("Domicilio: Av. Uno 1, Santiago\nRepresentante legal: Ana Pérez\nCorreo: ana@vendedor.test"));
  assert.ok(text.includes("pteron lo vende Pteron SpA, RUT 11.111.111-1, domicilio Av. Uno 1, Santiago, representante legal Ana Pérez."));
  assert.match(html, fila("Representante legal", "Ana Pérez"));
  for (const tipo of ["trial_ending", "cancellation"]) assert.ok(compuesto(tipo, { vendedor }).text.includes("representante legal Ana Pérez"), tipo);
  assert.doesNotMatch(compuesto("purchase").html, /Representante/);
});

test("confirmación de compra sin prueba: el primer cobro ya se hizo, sin cuota de prueba ni fecha de fin de prueba", () => {
  const { text, html } = compuesto("purchase", { suscripcion: sinPrueba(), enPrueba: false });
  assert.ok(text.includes("Tu plan Basic está activo"));
  assert.ok(text.includes("El primer cobro de $2.990 se hizo el 13 de octubre de 2026. Luego se cobra cada mes, hasta que canceles."));
  assert.ok(text.includes("Primer cobro: $2.990, hecho el 13 de octubre de 2026"));
  assert.ok(text.includes("Cuota de IA incluida: 6.000.000 unidades de IA por período; lo que no usas no pasa al siguiente"));
  assert.ok(text.includes("Si ya pagaste, el plan sigue hasta el fin del período pagado y no se renueva."));
  assert.match(html, />Se cobraron \$2\.990 el 13 de octubre de 2026\./, "preheader");
  assert.doesNotMatch(text, /1\.500\.000|Tu prueba|durante la prueba|Prueba gratis/);
});

test("confirmación de compra sin prueba: sin un período pagado no dice que el cobro se hizo (past_due o activa sin pago)", () => {
  const pendiente = compuesto("purchase", { suscripcion: sinPrueba({ status: "past_due" }), enPrueba: false });
  assert.doesNotMatch(pendiente.text, /se hizo el|hecho el|está activo|Se cobraron/);
  assert.doesNotMatch(pendiente.html, /se hizo el|hecho el|está activo|Se cobraron/);
  assert.ok(pendiente.text.includes("El primer cobro de $2.990 todavía no se pudo hacer: tu cuenta muestra «Pago pendiente»"));
  assert.ok(pendiente.text.includes("Primer cobro: Pago pendiente"));
  const sinPago = compuesto("purchase", { suscripcion: sinPrueba({ current_period_end: null }), enPrueba: false });
  assert.doesNotMatch(sinPago.text, /se hizo el|hecho el|está activo|todavía no se pudo|Primer cobro/);
  assert.doesNotMatch(sinPago.html, /se hizo el|hecho el|está activo|Se cobraron/);
  assert.ok(sinPago.text.includes("Los planes se renuevan solos cada mes, hasta que canceles."));
  const finDePrueba = compuesto("purchase", { suscripcion: sinPrueba({ trial_ends_at: "2026-11-13T03:00:00.000Z" }), enPrueba: false });
  assert.doesNotMatch(finDePrueba.text, /se hizo el|hecho el/, "un fin de período que es el de la prueba no es un pago");
  assert.doesNotMatch(finDePrueba.html, /Se cobraron/);
});

test("la cuota de prueba sin valor en el catálogo es un cuarto de la cuota, como en /cuenta; sin cuota no se habla de unidades", () => {
  assert.ok(compuesto("purchase", { plan: { ...BASIC, trial_ai_units_limit: null } }).text.includes("(1.500.000 durante la prueba)"));
  assert.doesNotMatch(compuesto("purchase", { plan: { ...BASIC, ai_units_limit: null } }).text, /unidades de IA|Cuota de IA/);
});

test("el correo repite lo que dicen los Términos y no inventa política: el retracto sólo sale si los Términos lo dicen", () => {
  const terminosVigentes = readFileSync(new URL("../public/terminos.html", import.meta.url), "utf8");
  const { text, html } = compuesto("purchase");
  if (TERMS_RETRACTO.trim()) {
    assert.ok(text.includes(TERMS_RETRACTO.trim()));
    assert.ok(terminosVigentes.includes(TERMS_RETRACTO.trim()), "el párrafo es copia literal de los Términos");
  } else {
    // Hoy los Términos no dicen nada de retracto (LEGAL-PENDIENTE.md, punto 2): si lo agregan, hay que pegarlo en TERMS_RETRACTO.
    assert.doesNotMatch(terminosVigentes, /retracto|devoluci/i, "los Términos ya hablan de retracto: copia su párrafo en TERMS_RETRACTO");
    assert.doesNotMatch(text, /retracto|devoluci/i);
    assert.doesNotMatch(html, /retracto|devoluci/i, "ni el subtítulo ni un marcador");
  }
  // Lo demás que afirma el correo está en los Términos tal cual.
  assert.ok(terminosVigentes.includes("Si cancelas durante la prueba, no se cobra nada y Basic termina el día en que terminaba la prueba."));
  assert.ok(terminosVigentes.includes("Lo que no usas no pasa al siguiente."));
  assert.ok(terminosVigentes.includes("Basic incluye 6.000.000 unidades de IA por período (1.500.000 durante la prueba)"));
  assert.ok(terminosVigentes.includes("se pagan con tarjeta a través de Flow, que registra la tarjeta en su propio sitio: pteron no la recibe."));
  assert.ok(terminosVigentes.includes("Después, pteron vuelve al núcleo gratuito sin borrar tu trabajo local."));
  assert.ok(terminosVigentes.includes("La prueba es una por persona"), "el correo de cancelación dice que al volver no hay prueba");
});

test("los datos del vendedor y del destinatario se escapan en el HTML y no se alteran en el texto", () => {
  const raro = { nombre: 'Marco & <b>Hijos</b> "SpA"', rut: "1-9", domicilio: "Calle <script>alert(1)</script>", correo: "a@b.test", representante: "<i>Rep</i>" };
  for (const tipo of ["purchase", "trial_ending", "cancellation"]) {
    const { html, text } = compuesto(tipo, { vendedor: raro, destinatario: "o'neil+<x>@escuela.cl" });
    assert.doesNotMatch(html, /<b>Hijos<\/b>|<script>|<i>Rep|<x>/);
    assert.ok(html.includes("Marco &amp; &lt;b&gt;Hijos&lt;/b&gt; &quot;SpA&quot;"), tipo);
    assert.ok(html.includes("o&#39;neil+&lt;x&gt;@escuela.cl"), tipo);
    assert.ok(text.includes('Marco & <b>Hijos</b> "SpA"'), tipo);
    assert.ok(text.includes("o'neil+<x>@escuela.cl"), tipo);
  }
  assert.equal(escapar(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("aviso de fin de prueba: la fecha en hora de Chile, el cobro de $2.990 y el enlace para cancelar", () => {
  const { subject, text, html } = compuesto("trial_ending");
  assert.equal(subject, "Tu prueba de pteron Basic termina el 20 de octubre de 2026");
  assert.ok(text.includes("AVISO DE FIN DE PRUEBA\nTu prueba de Basic termina el 20 de octubre de 2026"));
  assert.ok(text.includes("Ese día se cobran $2.990, IVA incluido, salvo que canceles antes en https://pteron.patagua.dev/cuenta."));
  assert.ok(text.includes("Fin de la prueba: 20 de octubre de 2026\nCobro: $2.990 el 20 de octubre de 2026; luego cada mes, hasta que canceles"));
  assert.ok(text.includes("Ver mi plan: https://pteron.patagua.dev/cuenta"));
  assert.ok(text.includes("Si cancelas durante la prueba, no se cobra nada"));
  assert.ok(text.includes("Recibiste este correo porque tienes una prueba de pteron Basic con profe@escuela.cl."));
  assert.ok(html.includes('href="https://pteron.patagua.dev/cuenta"'));
  assert.match(html, fila("Fin de la prueba", "20 de octubre de 2026"));
  assert.ok(text.includes(VENDEDOR_TEXTO.rut), "también dice quién vende");
  const sinFecha = compuesto("trial_ending", { suscripcion: enPrueba({ trial_ends_at: null, current_period_end: null }) });
  assert.equal(sinFecha.subject, "Tu prueba de pteron Basic está por terminar");
  assert.doesNotMatch(sinFecha.text, /Fin de la prueba|Ese día| el $/m);
});

test("confirmación de cancelación: en la prueba no se cobra nada; pagado, el plan sigue hasta el fin del período y no se cobra más", () => {
  const prueba = compuesto("cancellation", { suscripcion: enPrueba({ cancel_at_period_end: true }) });
  assert.ok(prueba.text.includes("Cancelaste Basic durante la prueba: no se cobra nada y Basic termina el 20 de octubre de 2026."));
  assert.ok(prueba.text.includes("Prueba hasta: 20 de octubre de 2026\nCobros: Ninguno"));
  assert.doesNotMatch(prueba.text, /fin del período pagado/);
  const pagado = compuesto("cancellation", { suscripcion: enPrueba({ status: "active", cancel_at_period_end: true, current_period_end: "2026-11-20T03:00:00.000Z" }), enPrueba: false });
  assert.equal(pagado.subject, "Cancelaste la renovación de pteron Basic");
  assert.ok(pagado.text.includes("RENOVACIÓN CANCELADA\nTu plan Basic sigue activo hasta el 20 de noviembre de 2026"));
  assert.ok(pagado.text.includes("Tu plan sigue hasta el 20 de noviembre de 2026, el fin del período pagado, y no se cobra nada más."));
  assert.ok(pagado.text.includes("Después, pteron vuelve al núcleo gratuito sin borrar tu trabajo local."));
  assert.ok(pagado.text.includes("Activo hasta: 20 de noviembre de 2026\nCobros: No se renueva; no se cobra nada más"));
  assert.ok(pagado.text.includes("SI QUIERES VOLVER\nCuando termine el plan, entra a tu cuenta y elige Basic de nuevo. Esta vez el cobro se hace al contratar, sin prueba."));
  assert.ok(pagado.text.includes("escríbenos a ana@vendedor.test."));
  assert.ok(pagado.text.includes("Recibiste este correo porque se canceló la renovación de pteron Basic en la cuenta profe@escuela.cl."));
  assert.match(pagado.html, fila("Activo hasta", "20 de noviembre de 2026"));
});

test("confirmación de cancelación con el cobro pendiente: no dice «activo hasta» ni promete que no se cobra nada más", () => {
  // past_due: current_period_end es el fin del último período pagado, que ya pasó.
  const pendiente = compuesto("cancellation", { suscripcion: sinPrueba({ status: "past_due", cancel_at_period_end: true, current_period_end: "2026-10-11T02:59:59Z" }), enPrueba: false });
  assert.equal(pendiente.subject, "Cancelaste la renovación de pteron Basic");
  assert.ok(pendiente.text.includes("RENOVACIÓN CANCELADA\nCancelaste la renovación de Basic\n"));
  assert.ok(pendiente.text.includes("Cancelaste la renovación de Basic: no se renueva. El último cobro no se pudo hacer y tu cuenta lo muestra como «Pago pendiente»; ahí ves su estado."));
  assert.ok(pendiente.text.includes("Período pagado hasta: 10 de octubre de 2026\nCobros: No se renueva; el cobro pendiente se ve en tu cuenta"));
  assert.match(pendiente.html, fila("Período pagado hasta", "10 de octubre de 2026"));
  assert.doesNotMatch(pendiente.text + pendiente.html, /activo hasta|no se cobra nada más|sigue hasta/i);
  assert.ok(pendiente.html.includes("El último cobro quedó pendiente"), "el preheader");
  const sinFecha = compuesto("cancellation", { suscripcion: sinPrueba({ status: "past_due", cancel_at_period_end: true, current_period_end: null }), enPrueba: false });
  assert.doesNotMatch(sinFecha.text, /Período pagado hasta|activo hasta|no se cobra nada más/i);
});

test("la copia fija de los Términos existe, es la versión vigente y no cambia su texto", () => {
  const vigente = readFileSync(new URL("../public/terminos.html", import.meta.url), "utf8");
  const hoja = (html) => /<article class="legal-hoja"[\s\S]*?<\/article>/.exec(html)[0];
  assert.equal(hoja(TERMINOS), hoja(vigente), "la hoja de la copia es la de los Términos vigentes");
  assert.ok(TERMINOS.includes(`<link rel="canonical" href="https://pteron.patagua.dev/terminos/${TERMS_VERSION}">`));
  assert.ok(TERMINOS.includes(`Versión ${TERMS_VERSION}`));
});

test("los Términos vigentes y su copia fija identifican al vendedor (Reglamento de comercio electrónico, art. 7)", () => {
  const vigente = readFileSync(new URL("../public/terminos.html", import.meta.url), "utf8");
  for (const [donde, html] of [["vigentes", vigente], ["copia fija", TERMINOS]]) {
    const hoja = /<article class="legal-hoja"[\s\S]*?<\/article>/.exec(html)[0];
    assert.match(hoja, /Patagua\.dev SpA/, `${donde}: razón social`);
    assert.ok(hoja.includes("78.418.149-9"), `${donde}: RUT`);
    assert.ok(hoja.includes("Fundo San Ricardo, Lote A y Lote B, Coronel, Región del Biobío"), `${donde}: domicilio legal`);
    assert.ok(hoja.includes('href="mailto:hola@patagua.dev"'), `${donde}: medio de contacto`);
    assert.ok(hoja.includes("desde no-reply@patagua.dev, a la dirección de tu cuenta"), `${donde}: cómo contacta el vendedor`);
    assert.ok(hoja.includes("Marco Antonio Rojas Belmar"), `${donde}: representante legal`);
    assert.doesNotMatch(hoja, /tel[eé]fono|\+56/i, `${donde}: sin teléfono`);
  }
  // La copia lleva lo mismo que lo vigente: índice de la página y hoja, sin diferencias.
  const indice = (html) => /<nav class="legal-indice"[\s\S]*?<\/nav>/.exec(html)[0];
  assert.equal(indice(TERMINOS), indice(vigente));
});

// ── Configuración ─────────────────────────────────────────────────────────

test("faltantesCorreo nombra lo que falta, también con espacios en blanco, y nunca devuelve valores", () => {
  assert.deepEqual(faltantesCorreo(CORREO_CONFIGURADO), []);
  assert.deepEqual(faltantesCorreo({}), ["RESEND_API_KEY", "EMAIL_FROM", "SELLER_NAME", "SELLER_RUT", "SELLER_ADDRESS", "SELLER_EMAIL"]);
  assert.deepEqual(faltantesCorreo({ ...CORREO_CONFIGURADO, SELLER_RUT: "  ", RESEND_API_KEY: "" }), ["RESEND_API_KEY", "SELLER_RUT"]);
  // El representante legal es opcional (una persona natural no tiene): no detiene el envío.
  assert.deepEqual(faltantesCorreo({ ...CORREO_CONFIGURADO, SELLER_REPRESENTATIVE: "" }), []);
});

test("wrangler.jsonc declara el remitente de Supabase Auth y los datos del vendedor completos; la clave de Resend no está en el archivo", () => {
  const texto = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(texto, /"EMAIL_FROM": "pteron <no-reply@patagua\.dev>"/);
  const vendedor = {
    SELLER_NAME: "Patagua.dev SpA",
    SELLER_RUT: "78.418.149-9",
    SELLER_ADDRESS: "Fundo San Ricardo, Lote A y Lote B, Coronel, Región del Biobío",
    SELLER_EMAIL: "hola@patagua.dev",
    SELLER_REPRESENTATIVE: "Marco Antonio Rojas Belmar",
  };
  for (const [nombre, valor] of Object.entries(vendedor)) assert.ok(texto.includes(`"${nombre}": "${valor}"`), `${nombre} está lleno en wrangler.jsonc`);
  assert.doesNotMatch(texto, /"RESEND_API_KEY"/);
  // Con todo lo requerido en wrangler.jsonc y el secreto cargado, no falta nada: los correos salen.
  assert.deepEqual(faltantesCorreo({ EMAIL_FROM: "pteron <no-reply@patagua.dev>", ...vendedor, RESEND_API_KEY: "re_de_prueba" }), []);
});

// ── Compuerta: sin configuración no sale nada ─────────────────────────────

test("sin la clave o sin cualquier dato del vendedor no se llama a Resend ni se lee nada: queda un evento omitido con los nombres que faltan", async () => {
  for (const nombre of Object.keys(CORREO_CONFIGURADO)) {
    const w = mundo({ subs: [enPrueba()] });
    const env = envCorreo({ [nombre]: "" });
    const resultado = await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1", user_id: USER.id }));
    assert.deepEqual(resultado, { estado: "omitido", faltan: [nombre] });
    assert.equal(w.aResend().length, 0, `sin ${nombre}: ninguna petición a Resend`);
    assert.equal(w.network.calls.some((call) => call.url.includes("/auth/v1/admin")), false, "ni se busca el correo de la cuenta");
    const evento = w.evento("email:purchase:sub-1:skipped");
    assert.deepEqual([evento.event_type, evento.status, evento.user_id], ["purchase_email_skipped", "ignored", USER.id]);
    assert.deepEqual(evento.event_metadata.faltan, [nombre]);
    assert.equal(w.evento("email:purchase:sub-1"), undefined, "no se reclamó el envío: al configurar, el siguiente intento sí sale");
  }
});

test("sin nada configurado cada tipo deja su propio evento *_email_skipped, una sola vez por suscripción", async () => {
  const env = testEnv({ ...envFlow, ASSETS });
  const w = mundo({ subs: [enPrueba()] });
  await withFetch(w.network.fetch, async () => {
    const correo = createCorreo(env, testServices(env).supabase);
    for (const tipo of ["purchase", "trial_ending", "cancellation"]) {
      await correo.entregar(tipo, { id: "sub-1", user_id: USER.id });
      await correo.entregar(tipo, { id: "sub-1", user_id: USER.id });
    }
    assert.equal(correo.resumen.omitidos, 6);
  });
  assert.deepEqual([...w.registros.keys()].sort(), ["email:cancellation:sub-1:skipped", "email:purchase:sub-1:skipped", "email:trial_ending:sub-1:skipped"]);
  assert.deepEqual(w.evento("email:purchase:sub-1:skipped").event_metadata.faltan, ["RESEND_API_KEY", "EMAIL_FROM", "SELLER_NAME", "SELLER_RUT", "SELLER_ADDRESS", "SELLER_EMAIL"]);
  assert.equal(w.aResend().length, 0);
});

// ── Idempotencia ──────────────────────────────────────────────────────────

test("un correo se envía una vez: el evento es la cerradura y su id es la Idempotency-Key", async () => {
  const w = mundo({ subs: [enPrueba()] });
  const env = envCorreo();
  await withFetch(w.network.fetch, async () => {
    const correo = createCorreo(env, testServices(env).supabase);
    const [primero, segundo] = await Promise.all([correo.entregar("purchase", { id: "sub-1" }), correo.entregar("purchase", { id: "sub-1" })]);
    assert.deepEqual([primero.estado, segundo.estado].sort(), ["duplicado", "enviado"], "dos llamadas a la vez: sólo una envía");
    assert.equal((await correo.entregar("purchase", { id: "sub-1" })).estado, "duplicado");
    assert.equal((await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" })).estado, "duplicado", "otra instancia, mismo resultado");
  });
  assert.equal(w.aResend().length, 1);
  const [llamada] = w.aResend();
  assert.equal(llamada.headers["Idempotency-Key"], "email:purchase:sub-1");
  const evento = w.evento("email:purchase:sub-1");
  assert.deepEqual([evento.event_type, evento.status, evento.user_id], ["purchase_email", "processed", USER.id]);
  assert.equal(evento.event_metadata.resendId, "re_enviado");
  assert.match(evento.processed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify([...w.registros.values()]).includes(USER.email), false, "el evento no guarda la dirección");
});

test("la confirmación de compra lleva el correo de la cuenta (Auth admin), la copia de los Términos adjunta y reply_to al vendedor", async () => {
  const w = mundo({ subs: [enPrueba()] });
  const env = envCorreo();
  await withFetch(w.network.fetch, async () => {
    assert.equal((await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" })).estado, "enviado");
  });
  const admin = w.network.calls.find((call) => call.url.includes("/auth/v1/admin/users/"));
  assert.ok(admin.url.endsWith(`/auth/v1/admin/users/${USER.id}`));
  assert.equal(admin.headers.Authorization, "Bearer service-role-fake", "con la service role");
  const [llamada] = w.aResend();
  const cuerpo = cuerpoDe(llamada);
  assert.deepEqual(cuerpo.to, [USER.email]);
  assert.equal(cuerpo.reply_to, VENDEDOR.SELLER_EMAIL);
  assert.equal(cuerpo.subject, "Confirmación de compra: pteron Basic");
  assert.ok(cuerpo.text.includes(`contrataste pteron Basic con ${USER.email}.`), "el pie nombra la cuenta que recibe");
  assert.ok(cuerpo.text.includes("copia fija, también adjunta a este correo"));
  assert.ok(cuerpo.html.includes("Marco &amp; Hijos &lt;SpA&gt; &quot;pteron&quot;"));
  assert.equal(cuerpo.attachments.length, 1);
  assert.equal(cuerpo.attachments[0].filename, `terminos-pteron-${TERMS_VERSION}.html`);
  const copia = adjuntoDe(llamada);
  assert.ok(copia.includes("Naturaleza del servicio") && copia.includes("Esta es la versión 2026-10-13 de los términos."));
  assert.ok(copia.includes('href="https://pteron.test/cuenta"'), "los enlaces del adjunto son absolutos");
  assert.doesNotMatch(copia, /<script|href="\//);
  assert.deepEqual(env.ASSETS.calls, [`/terminos/${TERMS_VERSION}`]);
  assert.doesNotMatch(cuerpo.text, /Representante/, "sin SELLER_REPRESENTATIVE no hay representante");
});

test("con SELLER_REPRESENTATIVE el correo enviado nombra al representante legal del vendedor", async () => {
  const w = mundo({ subs: [enPrueba()] });
  const env = envCorreo({ SELLER_REPRESENTATIVE: "  Ana <Rep>  " });
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" }));
  const cuerpo = cuerpoDe(w.aResend()[0]);
  assert.ok(cuerpo.text.includes("Representante legal: Ana <Rep>") && cuerpo.text.includes("representante legal Ana <Rep>."));
  assert.ok(cuerpo.html.includes("Ana &lt;Rep&gt;") && !cuerpo.html.includes("<Rep>"));
});

test("si la copia de los Términos no se puede leer, el correo sale igual, sólo con el enlace", async () => {
  const w = mundo({ subs: [enPrueba()] });
  for (const assets of [fakeAssets({}), { fetch: async () => { throw new Error("assets caídos"); } }, fakeAssets({ [`/terminos/${TERMS_VERSION}`]: "<p>otra cosa</p>" }), undefined]) {
    const env = envCorreo({ ASSETS: assets });
    w.registros.clear();
    await withFetch(w.network.fetch, async () => assert.equal((await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" })).estado, "enviado"));
    const cuerpo = cuerpoDe(w.aResend().at(-1));
    assert.equal(cuerpo.attachments, undefined);
    assert.doesNotMatch(cuerpo.text, /adjunta/);
    assert.ok(cuerpo.text.includes(`https://pteron.test/terminos/${TERMS_VERSION}`), "el enlace siempre va");
  }
});

// ── Fallos ────────────────────────────────────────────────────────────────

test("si Resend falla el evento queda failed con el código del error y nada más; nunca se lanza", async () => {
  for (const [resend, codigo] of [
    [() => ({ status: 500, body: { name: "internal_server_error", message: "profe@escuela.cl" } }), "internal_server_error"],
    [() => ({ status: 429, body: "texto" }), "http_429"],
  ]) {
    const w = mundo({ subs: [enPrueba()], resend });
    const env = envCorreo();
    const errores = await registrando(() => withFetch(w.network.fetch, async () => {
      assert.deepEqual(await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" }), { estado: "fallido", code: codigo });
    }));
    const evento = w.evento("email:purchase:sub-1");
    assert.equal(evento.status, "failed");
    assert.equal(evento.event_metadata.error, codigo);
    const rastro = JSON.stringify([[...w.registros.values()], errores]);
    for (const secreto of [CLAVE, USER.email, VENDEDOR.SELLER_RUT]) assert.equal(rastro.includes(secreto), false, "ni la clave ni la dirección quedan en eventos o logs");
  }
  const w = mundo({ subs: [enPrueba()] });
  const env = envCorreo();
  await registrando(() => withFetch((url, init) => (String(url).includes("resend.com") ? Promise.reject(new TypeError("fetch failed")) : w.network.fetch(url, init)), async () => {
    assert.deepEqual(await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" }), { estado: "fallido", code: "network" });
  }));
  assert.equal(w.evento("email:purchase:sub-1").event_metadata.error, "network");
});

test("cuenta sin correo, plan sin precio, base caída o suscripción inexistente: fallan con su código y no lanzan", async () => {
  const env = envCorreo();
  const intentar = (w, id = "sub-1") => registrando(() => withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).entregar("purchase", { id })).then((resultado) => {
    w.resultado = resultado;
  }));
  const sinCorreo = mundo({ subs: [enPrueba()], correo: null });
  await intentar(sinCorreo);
  assert.deepEqual(sinCorreo.resultado, { estado: "fallido", code: "no_recipient" });
  assert.equal(sinCorreo.aResend().length, 0);
  assert.equal(sinCorreo.evento("email:purchase:sub-1").status, "failed");
  assert.equal(sinCorreo.evento("email:purchase:sub-1").event_metadata.error, "no_recipient");

  const sinPrecio = mundo({ subs: [enPrueba()], plan: { ...BASIC, monthly_price_clp: 0 } });
  await intentar(sinPrecio);
  assert.deepEqual(sinPrecio.resultado, { estado: "fallido", code: "plan_invalid" });
  assert.equal(sinPrecio.aResend().length, 0);

  const inexistente = mundo({ subs: [] });
  await intentar(inexistente, "sub-9");
  assert.deepEqual(inexistente.resultado, { estado: "fallido", code: "subscription_missing" });

  const baseCaida = fakeNetwork([{ match: () => true, respond: { status: 500, body: { message: "caída" } } }]);
  await registrando(() => withFetch(baseCaida.fetch, async () => {
    assert.equal((await createCorreo(env, testServices(env).supabase).entregar("purchase", { id: "sub-1" })).estado, "fallido");
  }));
  assert.equal(baseCaida.calls.some((call) => call.url.includes("resend.com")), false);
});

// ── Dentro de card-callback, cancel y el Cron ─────────────────────────────

test("card-callback: al anotar la suscripción sale la confirmación de compra con waitUntil y la redirección no cambia", async () => {
  const env = envCorreo();
  const w = mundo({ intents: [intento()] });
  const execution = fakeExecution();
  await withFetch(w.network.fetch, async () => {
    const res = await retorno(env, execution);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
    await execution.settle();
  });
  assert.ok(execution.promises.length >= 1, "el envío sigue después de responder");
  assert.equal(w.aResend().length, 1);
  const cuerpo = cuerpoDe(w.aResend()[0]);
  assert.deepEqual(cuerpo.to, [USER.email]);
  assert.ok(cuerpo.text.includes("Tu prueba termina el 20 de octubre de 2026."));
  assert.equal(w.filas.length, 1);
  assert.equal(w.evento(`email:purchase:${w.filas[0].id}`).status, "processed");
  // Un segundo retorno del mismo intento no crea otra suscripción ni otro correo.
  await withFetch(w.network.fetch, async () => {
    const res = await retorno(env, execution);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
    await execution.settle();
  });
  assert.equal(w.aResend().length, 1);
});

test("card-callback sin waitUntil espera el envío y da la misma redirección", async () => {
  const env = envCorreo();
  const w = mundo({ intents: [intento()] });
  await withFetch(w.network.fetch, async () => {
    const res = await retorno(env, undefined);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
  });
  assert.equal(w.aResend().length, 1);
});

test("card-callback: si Resend falla, la base falla o no hay configuración, el retorno es el mismo y la suscripción queda anotada", async () => {
  const escenarios = [
    ["Resend responde 500", envCorreo(), { resend: () => ({ status: 500, body: { name: "internal_server_error" } }) }, "failed"],
    ["sin configurar", testEnv({ ...envFlow, ASSETS }), {}, null],
  ];
  for (const [nombre, env, opciones, estado] of escenarios) {
    const w = mundo({ intents: [intento()], ...opciones });
    const execution = fakeExecution();
    await registrando(() => withFetch(w.network.fetch, async () => {
      const res = await retorno(env, execution);
      assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success", nombre);
      await execution.settle();
    }));
    assert.equal(w.filas.length, 1, nombre);
    assert.equal(w.intentos[0].status, "completed", nombre);
    if (estado) assert.equal(w.evento(`email:purchase:${w.filas[0].id}`).status, estado);
    else assert.equal(w.aResend().length, 0, nombre);
  }
  // Con las lecturas de la base del correo caídas (el evento no se puede anotar), el retorno tampoco cambia.
  const w = mundo({ intents: [intento()] });
  const env = envCorreo();
  const execution = fakeExecution();
  await registrando(() => withFetch((url, init) => (String(url).includes("/billing_events") ? Promise.resolve(new Response('{"message":"caída"}', { status: 500 })) : w.network.fetch(url, init)), async () => {
    const res = await retorno(env, execution);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
    await execution.settle();
  }));
  assert.equal(w.aResend().length, 0);
});

test("cancel: responde como siempre y envía la confirmación de cancelación una sola vez", async (t) => {
  // La ruta sincroniza con Flow usando la hora del reloj. Pasado el fin de la
  // prueba del ejemplo (20 de octubre), cancelar al cierre la deja cancelada y
  // el segundo pedido ya no encuentra plan: el reloj se fija en AHORA, dentro de la prueba.
  t.mock.timers.enable({ apis: ["Date"], now: AHORA });
  const env = envCorreo();
  const w = mundo({ subs: [enPrueba()], flowSub: basicEnPrueba({ cancel_at_period_end: 1 }) });
  const execution = fakeExecution();
  await withFetch(w.network.fetch, async () => {
    for (let i = 0; i < 2; i++) {
      const res = await cancelar(env, execution);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true, cancelAt: "2026-10-20T03:00:00.000Z" });
      await execution.settle();
    }
  });
  assert.equal(w.aResend().length, 1, "pedir cancelar dos veces no manda dos correos");
  const cuerpo = cuerpoDe(w.aResend()[0]);
  assert.equal(cuerpo.subject, "Cancelaste la renovación de pteron Basic");
  assert.ok(cuerpo.text.includes("no se cobra nada y Basic termina el 20 de octubre de 2026."));
  assert.equal(w.evento("email:cancellation:sub-1").status, "processed");
});

test("cancel: un Resend caído o sin configurar no cambia la respuesta", async () => {
  for (const [env, opciones] of [
    [envCorreo(), { resend: () => ({ status: 503, body: {} }) }],
    [envCorreo(), { resend: () => { throw new Error("explotó el mock"); } }],
    [testEnv({ ...envFlow, ASSETS }), {}],
  ]) {
    const w = mundo({ subs: [enPrueba()], flowSub: basicEnPrueba({ cancel_at_period_end: 1 }), ...opciones });
    const execution = fakeExecution();
    await registrando(() => withFetch(w.network.fetch, async () => {
      const res = await cancelar(env, execution);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true, cancelAt: "2026-10-20T03:00:00.000Z" });
      await execution.settle();
    }));
  }
});

test("conciliar un checkout incierto que Flow sí creó envía también la confirmación de compra, una vez", async () => {
  const env = envCorreo();
  const huerfana = basicEnPrueba({ subscriptionId: "sus_huerfana", created: "2026-10-13 15:20:00" });
  const w = mundo({
    intents: [intento({ status: "subscription_pending", updated_at: new Date(Date.now() - 15 * 60_000).toISOString() })],
    flowSub: huerfana,
    listaFlow: [huerfana],
  });
  await withFetch(w.network.fetch, async () => {
    const services = testServices(env);
    assert.deepEqual(await reconcilePendingCheckouts(services, { now: new Date() }), { conciliados: 1, sinSuscripcion: 0, pendientes: 0 });
    assert.deepEqual(await reconcilePendingCheckouts(services, { now: new Date() }), { conciliados: 0, sinSuscripcion: 0, pendientes: 0 });
  });
  assert.equal(w.aResend().length, 1);
  assert.equal(cuerpoDe(w.aResend()[0]).subject, "Confirmación de compra: pteron Basic");
  assert.equal(w.evento(`email:purchase:${w.filas[0].id}`).status, "processed");
});

test("el Cron avisa sólo a quien termina su prueba dentro de 48 horas y no canceló, una vez, y cuenta los correos en su resumen", async () => {
  const en = (horas) => new Date(AHORA.getTime() + horas * HORA).toISOString();
  const subs = [
    enPrueba({ id: "dentro", trial_ends_at: en(38.75) }),
    enPrueba({ id: "justo", trial_ends_at: en(48) }),
    enPrueba({ id: "lejos", trial_ends_at: en(48.01) }),
    enPrueba({ id: "ya-termino", trial_ends_at: en(-1) }),
    enPrueba({ id: "cancelada", trial_ends_at: en(30), cancel_at_period_end: true }),
    enPrueba({ id: "pagando", status: "active", trial_ends_at: en(30) }),
    enPrueba({ id: "cortesia", provider: "comp", trial_ends_at: en(30) }),
  ];
  const w = mundo({ subs });
  const env = envCorreo();
  const resumenes = [];
  await withFetch(w.network.fetch, async () => {
    for (let dia = 0; dia < 2; dia++) resumenes.push(await syncDueSubscriptions(testServices(env), AHORA));
  });
  assert.deepEqual(resumenes[0], {
    sincronizadas: 0,
    fallidas: 0,
    correosEnviados: 2,
    correosOmitidos: 0,
    correosFallidos: 0,
    checkoutsVencidos: 0,
    cortesiasVencidas: 0,
    checkoutsConciliados: 0,
    checkoutsSinSuscripcion: 0,
    checkoutsPendientes: 0,
  });
  assert.deepEqual([resumenes[1].correosEnviados, resumenes[1].correosFallidos], [0, 0], "al día siguiente no se repite");
  assert.deepEqual(Object.keys(resumenes[0]), Object.keys(resumenes[1]));
  assert.deepEqual([...w.registros.keys()].sort(), ["email:trial_ending:dentro", "email:trial_ending:justo"]);
  const consulta = decodeURIComponent(w.network.calls.find((call) => call.url.includes("trial_ends_at")).url);
  assert.ok(consulta.includes(`trial_ends_at=gt.${AHORA.toISOString()}`) && consulta.includes(`trial_ends_at=lte.${en(48)}`), "ventana de 48 horas exactas");
  assert.match(consulta, /provider=eq\.flow&status=eq\.trialing&cancel_at_period_end=is\.false/);
  const aviso = cuerpoDe(w.aResend()[0]);
  assert.equal(aviso.subject, "Tu prueba de pteron Basic termina el 20 de octubre de 2026");
});

test("el Cron sin correo configurado deja el evento omitido de cada aviso y no llama a Resend", async () => {
  const subs = [enPrueba({ id: "dentro", trial_ends_at: new Date(AHORA.getTime() + 30 * HORA).toISOString() })];
  const w = mundo({ subs });
  const env = testEnv({ ...envFlow, ASSETS });
  const resumen = await withFetch(w.network.fetch, () => syncDueSubscriptions(testServices(env), AHORA));
  assert.deepEqual([resumen.correosEnviados, resumen.correosOmitidos, resumen.correosFallidos], [0, 1, 0]);
  assert.equal(w.aResend().length, 0);
  assert.equal(w.evento("email:trial_ending:dentro:skipped").event_type, "trial_ending_email_skipped");
});

test("el Cron reintenta los fallidos de menos de 3 días, hasta 20 por corrida, y no los de más antiguos", async () => {
  const dia = 24 * HORA;
  const eventos = [];
  const subs = [];
  for (let i = 0; i < 25; i++) {
    subs.push(enPrueba({ id: `s${i}`, trial_ends_at: new Date(AHORA.getTime() + 30 * HORA).toISOString() }));
    eventos.push({ external_event_id: `email:trial_ending:s${i}`, event_type: "trial_ending_email", status: "failed", event_metadata: { tipo: "trial_ending", subscriptionId: `s${i}`, error: "http_500" }, created_at: new Date(AHORA.getTime() - 2 * dia).toISOString() });
  }
  subs.push(enPrueba({ id: "vieja" }), enPrueba({ id: "buena", plan_id: "basic" }));
  eventos.push({ external_event_id: "email:purchase:vieja", event_type: "purchase_email", status: "failed", event_metadata: { tipo: "purchase", subscriptionId: "vieja" }, created_at: new Date(AHORA.getTime() - 3 * dia - HORA).toISOString() });
  const w = mundo({ subs, eventos });
  const env = envCorreo();
  const primera = await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).reintentar(AHORA).then(() => w.aResend().length));
  assert.equal(primera, 20, "hasta 20 por corrida");
  assert.equal(w.evento("email:purchase:vieja").status, "failed", "más de 3 días: se deja");
  const procesados = [...w.registros.values()].filter((evento) => evento.status === "processed");
  assert.equal(procesados.length, 20);
  assert.equal(procesados[0].event_metadata.intentos, 2);
  assert.equal(procesados[0].event_metadata.error, undefined);
  assert.ok(w.aResend().every((llamada) => /^email:trial_ending:s\d+$/.test(llamada.headers["Idempotency-Key"])), "mismo id de evento como Idempotency-Key");
  // La siguiente corrida termina los 5 que quedaron.
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).reintentar(AHORA));
  assert.equal(w.aResend().length, 25);
});

test("un reintento no envía lo que ya no aplica (prueba cancelada o terminada) y un envío que quedó a medias se reenvía con la misma clave", async () => {
  const eventos = [
    { external_event_id: "email:trial_ending:cancelada", event_type: "trial_ending_email", status: "failed", event_metadata: { tipo: "trial_ending", subscriptionId: "cancelada" }, created_at: AHORA.toISOString() },
    { external_event_id: "email:cancellation:colgada", event_type: "cancellation_email", status: "received", event_metadata: { tipo: "cancellation", subscriptionId: "colgada" }, created_at: new Date(AHORA.getTime() - 2 * HORA).toISOString() },
    { external_event_id: "email:cancellation:reciente", event_type: "cancellation_email", status: "received", event_metadata: { tipo: "cancellation", subscriptionId: "reciente" }, created_at: new Date(AHORA.getTime() - 5 * 60_000).toISOString() },
    { external_event_id: "email:trial_ending:ajeno", event_type: "trial_ending_email", status: "failed", event_metadata: { tipo: "trial_ending", subscriptionId: "otra" }, created_at: AHORA.toISOString() },
  ];
  const subs = [
    enPrueba({ id: "cancelada", cancel_at_period_end: true, trial_ends_at: new Date(AHORA.getTime() + 30 * HORA).toISOString() }),
    enPrueba({ id: "colgada", cancel_at_period_end: true }),
    enPrueba({ id: "reciente", cancel_at_period_end: true }),
  ];
  const w = mundo({ subs, eventos });
  const env = envCorreo();
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).reintentar(AHORA));
  assert.equal(w.evento("email:trial_ending:cancelada").status, "ignored", "ya canceló: no se le avisa que se cobrará");
  assert.equal(w.evento("email:trial_ending:ajeno").status, "failed", "un evento cuyo id no calza con su suscripción no se toca");
  assert.equal(w.evento("email:cancellation:reciente").status, "received", "uno reciente puede estar enviándose");
  assert.equal(w.evento("email:cancellation:colgada").status, "processed");
  assert.deepEqual(w.aResend().map((llamada) => llamada.headers["Idempotency-Key"]), ["email:cancellation:colgada"]);
});

test("el Cron no reintenta nada mientras falte configuración, y un fallo de correos no toca el resto del resumen", async () => {
  const eventos = [{ external_event_id: "email:purchase:sub-1", event_type: "purchase_email", status: "failed", event_metadata: { tipo: "purchase", subscriptionId: "sub-1" }, created_at: AHORA.toISOString() }];
  const w = mundo({ subs: [enPrueba()], eventos });
  const sinClave = envCorreo({ RESEND_API_KEY: "" });
  await withFetch(w.network.fetch, () => createCorreo(sinClave, testServices(sinClave).supabase).reintentar(AHORA));
  assert.equal(w.aResend().length, 0);
  assert.equal(w.evento("email:purchase:sub-1").status, "failed");

  const caido = mundo({ subs: [enPrueba({ trial_ends_at: new Date(AHORA.getTime() + 30 * HORA).toISOString() })], resend: () => ({ status: 500, body: { name: "internal_server_error" } }) });
  const env = envCorreo();
  let resumen;
  await registrando(() => withFetch(caido.network.fetch, async () => {
    resumen = await syncDueSubscriptions(testServices(env), AHORA);
  }));
  assert.deepEqual([resumen.correosEnviados, resumen.correosFallidos, resumen.sincronizadas, resumen.fallidas], [0, 1, 0, 0]);
  assert.equal(caido.evento("email:trial_ending:sub-1").status, "failed");
  // Al día siguiente, con Resend de vuelta, el reintento lo envía.
  caido.network.calls.length = 0;
  const sana = envCorreo();
  const recuperado = mundo({ subs: [enPrueba({ trial_ends_at: new Date(AHORA.getTime() + 30 * HORA).toISOString() })], eventos: [...caido.registros.values()] });
  await withFetch(recuperado.network.fetch, async () => {
    const dia = await syncDueSubscriptions(testServices(sana), new Date(AHORA.getTime() + 24 * HORA));
    assert.equal(dia.correosEnviados, 1);
  });
  assert.equal(recuperado.evento("email:trial_ending:sub-1").status, "processed");
});

// ── /admin › Salud ────────────────────────────────────────────────────────

test("el Worker no cambia /api/health: sigue sin nombrar los correos", () => {
  const origen = readFileSync(new URL("../src/routes/health.js", import.meta.url), "utf8");
  const publico = /export async function health[\s\S]*?\n}\n/.exec(origen)[0];
  assert.doesNotMatch(publico, /correo|RESEND|SELLER/i);
});

test("el Cron envía la compra y la cancelación que nunca llegaron a anotar evento, sin repetir las ya atendidas ni las omitidas", async () => {
  const dia = 24 * HORA;
  const hace = (ms) => new Date(AHORA.getTime() - ms).toISOString();
  const subs = [
    enPrueba({ id: "perdida", created_at: hace(2 * dia), updated_at: hace(2 * dia) }),
    enPrueba({ id: "atendida", created_at: hace(2 * dia), updated_at: hace(2 * dia) }),
    enPrueba({ id: "omitida", created_at: hace(2 * dia), updated_at: hace(2 * dia) }),
    enPrueba({ id: "vieja", created_at: hace(4 * dia), updated_at: hace(4 * dia) }),
    enPrueba({ id: "reciente", created_at: hace(5 * 60_000), updated_at: hace(5 * 60_000) }),
    enPrueba({ id: "cancelada", created_at: hace(5 * dia), updated_at: hace(2 * dia), cancel_at_period_end: true }),
    enPrueba({ id: "comp", provider: "comp", created_at: hace(2 * dia), updated_at: hace(2 * dia) }),
  ];
  const eventos = [
    { external_event_id: "email:purchase:atendida", event_type: "purchase_email", status: "processed" },
    { external_event_id: "email:purchase:omitida:skipped", event_type: "purchase_email_skipped", status: "ignored" },
    { external_event_id: "email:purchase:cancelada", event_type: "purchase_email", status: "processed" },
  ];
  const w = mundo({ subs, eventos });
  const env = envCorreo();
  const resumen = await withFetch(w.network.fetch, () => syncDueSubscriptions(testServices(env), AHORA));
  // (Los avisos de fin de prueba de estas mismas filas salen aparte y no cuentan aquí.)
  const claves = () => w.aResend().map((llamada) => llamada.headers["Idempotency-Key"]).filter((clave) => !clave.startsWith("email:trial_ending:")).sort();
  assert.deepEqual(claves(), ["email:cancellation:cancelada", "email:purchase:perdida"]);
  assert.equal(w.evento("email:purchase:perdida").status, "processed");
  assert.ok(resumen.correosEnviados >= 2);
  // Otra corrida no repite nada.
  await withFetch(w.network.fetch, () => syncDueSubscriptions(testServices(env), AHORA));
  assert.equal(claves().length, 2);
});

test("la recuperación busca los eventos ya anotados en tandas de 50: con muchas ventas ninguna URL pasa de 8 KB y ninguna tanda se pierde", async () => {
  const dia = 24 * HORA;
  const hace = (ms) => new Date(AHORA.getTime() - ms).toISOString();
  // Ids con la forma de las reales (uuid), para que el largo de la URL sea el de producción.
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const compras = Array.from({ length: 100 }, (_, i) => enPrueba({ id: uuid(i), created_at: hace(2 * dia), updated_at: hace(2 * dia) }));
  const cancelaciones = Array.from({ length: 100 }, (_, i) => enPrueba({ id: uuid(1000 + i), created_at: hace(5 * dia), updated_at: hace(2 * dia), cancel_at_period_end: true }));
  // Todas ya atendidas (con su evento o su omitido), menos una compra de la tercera tanda y una cancelación de la última.
  const [perdidaCompra, perdidaCancelacion] = [compras[60].id, cancelaciones[90].id];
  const eventos = [...compras.map((fila) => ["purchase", fila]), ...cancelaciones.map((fila) => ["cancellation", fila])]
    .filter(([, fila]) => fila.id !== perdidaCompra && fila.id !== perdidaCancelacion)
    .map(([tipo, fila], i) => (i % 2
      ? { external_event_id: `email:${tipo}:${fila.id}`, event_type: `${tipo}_email`, status: "processed" }
      : { external_event_id: `email:${tipo}:${fila.id}:skipped`, event_type: `${tipo}_email_skipped`, status: "ignored" }));
  const w = mundo({ subs: [...compras, ...cancelaciones], eventos });
  const env = envCorreo();
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).recuperarSinEvento(AHORA));
  const busquedas = w.network.calls.filter((call) => call.method === "GET" && call.url.includes("/rest/v1/billing_events?external_event_id=in."));
  assert.equal(busquedas.length, 8, "400 ids (compra y omitido por suscripción) en tandas de 50");
  for (const busqueda of busquedas) assert.ok(busqueda.url.length < 8_000, `URL de ${busqueda.url.length} caracteres`);
  assert.deepEqual(w.aResend().map((llamada) => llamada.headers["Idempotency-Key"]), [`email:purchase:${perdidaCompra}`, `email:cancellation:${perdidaCancelacion}`]);
});

test("la recuperación de correos sin evento espera a tener configuración, se acota a 20 por corrida y un fallo de lectura no lanza", async () => {
  const subs = Array.from({ length: 25 }, (_, i) => enPrueba({ id: `s${i}`, created_at: new Date(AHORA.getTime() - 24 * HORA).toISOString() }));
  const w = mundo({ subs });
  const sinClave = envCorreo({ RESEND_API_KEY: "" });
  await withFetch(w.network.fetch, () => createCorreo(sinClave, testServices(sinClave).supabase).recuperarSinEvento(AHORA));
  assert.equal(w.aResend().length, 0);
  assert.equal(w.registros.size, 0, "sin configuración no deja ni evento omitido: al configurar, sí sale");
  const env = envCorreo();
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).recuperarSinEvento(AHORA));
  assert.equal(w.aResend().length, 20);
  await withFetch(w.network.fetch, () => createCorreo(env, testServices(env).supabase).recuperarSinEvento(AHORA));
  assert.equal(w.aResend().length, 25);

  const errores = await registrando(() => withFetch(async () => new Response("{}", { status: 500 }), async () => {
    assert.equal(await createCorreo(env, testServices(env).supabase).recuperarSinEvento(AHORA), undefined);
  }));
  assert.equal(errores.length, 1);
});
