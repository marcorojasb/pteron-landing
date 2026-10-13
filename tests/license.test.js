import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify as nodeVerify } from "node:crypto";
import { PUBLIC_KEYS, accesoHasta, createLicenseService, normalizePem, verifyLicense } from "../src/lib/license.js";
import { importEd25519PublicKey } from "../src/lib/crypto.js";
import { fakeNetwork, matches, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";
import { basicEnPrueba, cobroMensual } from "./helpers/flow-fixtures.js";

// Par de pruebas, nunca la clave real: verifyLicense acepta un mapa de claves
// propio para no depender de PUBLIC_KEYS ni de variables reales.
const keys = testKeyPair();
const testKeys = { k1: keys.publicPem };
const env = { LICENSE_PRIVATE_KEY_PEM: keys.privatePem, LICENSE_KID: "k1" };

function firmar(overrides = {}, customEnv = env) {
  return createLicenseService(customEnv, null).signLicense({
    subject: "sub-opaco-1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    ...overrides,
  });
}

test("signLicense + verifyLicense: mismo contrato de bytes que el cliente", async () => {
  const token = await firmar({ plan: "pro" });
  const verificado = await verifyLicense(token, testKeys);
  assert.equal(verificado?.sub, "sub-opaco-1");
  assert.equal(verificado?.plan, "pro");
  assert.equal(verificado?.kid, "k1");
});

test("la firma Web Crypto la verifica node:crypto, que es lo que usa la aplicación de escritorio", async () => {
  const token = await firmar({ plan: "basic" });
  const [segmento, firma] = token.split(".");
  const ok = nodeVerify(null, Buffer.from(segmento, "utf8"), createPublicKey(keys.publicPem), Buffer.from(firma, "base64url"));
  assert.equal(ok, true);
  const payload = JSON.parse(Buffer.from(segmento, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload), ["v", "sub", "plan", "iat", "exp", "kid"]);
});

test("verifyLicense distingue básico de pro", async () => {
  assert.equal((await verifyLicense(await firmar({ plan: "basic" }), testKeys))?.plan, "basic");
  assert.equal((await verifyLicense(await firmar({ plan: "pro" }), testKeys))?.plan, "pro");
});

test("verifyLicense renueva incluso si el token ya venció: decide la suscripción, no el reloj del token", async () => {
  const vencido = await firmar({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal((await verifyLicense(vencido, testKeys))?.sub, "sub-opaco-1");
});

test("verifyLicense rechaza una licencia alterada en un solo byte", async () => {
  const token = await firmar({ plan: "basic" });
  const [segmento, firma] = token.split(".");
  const alterado = Buffer.from(segmento, "base64url").toString("utf8").replace('"basic"', '"pro"');
  const falsificado = `${Buffer.from(alterado, "utf8").toString("base64url")}.${firma}`;
  assert.equal(await verifyLicense(falsificado, testKeys), null);
});

test("verifyLicense rechaza una licencia firmada por otra clave", async () => {
  const otra = testKeyPair();
  const token = await firmar({ subject: "sub-opaco-2" }, { LICENSE_PRIVATE_KEY_PEM: otra.privatePem, LICENSE_KID: "k1" });
  assert.equal(await verifyLicense(token, testKeys), null);
});

test("verifyLicense rechaza un kid que el servidor no reconoce, también los heredados del prototipo", async () => {
  assert.equal(await verifyLicense(await firmar(), {}), null);
  const token = await firmar({}, { LICENSE_PRIVATE_KEY_PEM: keys.privatePem, LICENSE_KID: "constructor" });
  assert.equal(await verifyLicense(token, testKeys), null);
});

test("verifyLicense rechaza formatos que no son una licencia, sin lanzar", async () => {
  for (const valor of ["", "   ", "sin-punto", "a.b.c", "!!!.***", undefined, null, 42]) {
    assert.equal(await verifyLicense(valor, testKeys), null);
  }
});

test("verifyLicense rechaza una versión que no entiende", async () => {
  const payload = {
    v: 2,
    sub: "sub-opaco-3",
    plan: "pro",
    iat: new Date().toISOString(),
    exp: new Date(Date.now() + 1000).toISOString(),
    kid: "k1",
  };
  const segmento = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  assert.equal(await verifyLicense(`${segmento}.firma-cualquiera`, testKeys), null);
});

test("signLicense acepta un PEM aplastado o con saltos literales, como llega desde un panel", async () => {
  const unaLinea = keys.privatePem.replace(/\n/g, "");
  const literales = keys.privatePem.replace(/\n/g, "\\n");
  for (const pem of [unaLinea, literales]) {
    const token = await firmar({}, { LICENSE_PRIVATE_KEY_PEM: pem, LICENSE_KID: "k1" });
    assert.equal((await verifyLicense(token, testKeys))?.sub, "sub-opaco-1");
  }
  assert.match(normalizePem(unaLinea), /^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n$/);
});

test("sin clave configurada, sin LICENSE_KID o con una clave inválida responde 503 con un código distinto", async () => {
  await assert.rejects(firmar({}, { LICENSE_KID: "k1" }), { status: 503, code: "license_not_configured" });
  // Sin kid no hay valor por defecto: firmar con una clave y rotular otra deja licencias que nadie acepta.
  await assert.rejects(firmar({}, { LICENSE_PRIVATE_KEY_PEM: keys.privatePem }), { status: 503, code: "license_not_configured" });
  await assert.rejects(firmar({}, { LICENSE_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n", LICENSE_KID: "k1" }), { status: 503, code: "license_key_invalid" });
});

test("las claves públicas de producción son Ed25519 válidas y k2 es la vigente", async () => {
  assert.deepEqual(Object.keys(PUBLIC_KEYS), ["k1", "k2"]);
  for (const pem of Object.values(PUBLIC_KEYS)) {
    const key = await importEd25519PublicKey(pem);
    assert.equal(key.algorithm.name, "Ed25519");
  }
  assert.notEqual(PUBLIC_KEYS.k1, PUBLIC_KEYS.k2);
});

// ── Emisión: acceso hasta, tope de 7 días y sincronización con Flow ────────

const HORA = 3_600_000;
const DIA = 24 * HORA;
const envEmision = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem, FLOW_API_KEY: "flow-api", FLOW_SECRET_KEY: "flow-secret", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });

/** Una fila Flow de Basic como la deja la sincronización. */
function filaFlow(cambios = {}) {
  return {
    id: "fila-1",
    user_id: "user-1",
    plan_id: "basic",
    provider: "flow",
    provider_customer_id: "cus_1",
    provider_subscription_id: "sus_basic01",
    provider_plan_id: "pteron-basic-1990-mensual",
    status: "active",
    trial_starts_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    next_invoice_at: null,
    last_synced_at: null,
    plan_catalog: { license_plan: "basic", monthly_price_clp: 1990 },
    ...cambios,
  };
}

/**
 * Llama a issueLicense con la red simulada: `fila` es lo que devuelve la base y
 * `flow`, la respuesta de subscription/get (sin ella, Flow responde 500).
 */
async function emitir(fila, { now, flow, publicKeys = testKeys } = {}) {
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: fila ? [fila] : [] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    { match: matches.supabase("licenses", "POST"), respond: { body: [{ id: "licencia-1" }] } },
    { match: matches.flow("/subscription/get"), respond: () => (flow ? { body: flow } : { status: 500, body: { message: "Flow no responde" } }) },
  ]);
  const services = testServices(envEmision, publicKeys);
  const issued = await withFetch(network.fetch, () => services.license.issueLicense("user-1", { ...services, now }));
  return { issued, network };
}

function payload(token) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

test("accesoHasta: lo pagado más 72 h en Flow, sin gracia al cancelar al cierre ni en una cortesía, y nada sin fecha", () => {
  assert.equal(accesoHasta({ provider: "flow", current_period_end: "2026-11-20T03:00:00.000Z" }).toISOString(), "2026-11-23T03:00:00.000Z");
  assert.equal(accesoHasta({ provider: "flow", cancel_at_period_end: true, current_period_end: "2026-11-20T03:00:00.000Z" }).toISOString(), "2026-11-20T03:00:00.000Z");
  assert.equal(accesoHasta({ provider: "comp", current_period_end: "2027-01-01T00:00:00.000Z" }).toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(accesoHasta({ provider: "flow", current_period_end: null, trial_ends_at: "2026-11-20T03:00:00.000Z" }), null);
});

test("la licencia vale a lo más 7 días aunque lo pagado dure más, y trae el estado del plan", async () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const fila = filaFlow({ current_period_start: "2026-10-20T03:00:00.000Z", current_period_end: "2026-11-20T03:00:00.000Z", next_invoice_at: "2026-11-20T03:00:00.000Z", trial_ends_at: "2026-10-20T03:00:00.000Z", last_synced_at: "2026-10-21T11:00:00.000Z" });
  const { issued, network } = await emitir(fila, { now });
  assert.equal(issued.expiresAt, "2026-10-28T12:00:00.000Z");
  assert.equal(payload(issued.token).exp, "2026-10-28T12:00:00.000Z");
  assert.equal(payload(issued.token).iat, "2026-10-21T12:00:00.000Z");
  assert.equal((await verifyLicense(issued.token, testKeys))?.sub, "user-1");
  assert.deepEqual(issued.subscription, {
    planId: "basic",
    status: "active",
    paidThrough: "2026-11-20T03:00:00.000Z",
    accessUntil: "2026-11-23T03:00:00.000Z",
    trialEndsAt: "2026-10-20T03:00:00.000Z",
    nextChargeAt: "2026-11-20T03:00:00.000Z",
    cancelAtPeriodEnd: false,
    priceClp: 1990,
  });
  assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false, "lejos del fin de lo pagado no se consulta Flow");
  const licencia = network.calls.find((call) => call.url.includes("/rest/v1/licenses"));
  assert.equal(licencia.body.expires_at, "2026-10-28T12:00:00.000Z");
  assert.equal(licencia.body.key_id, "k1");
  const consulta = decodeURIComponent(network.calls[0].url);
  assert.match(consulta, /status=in\.\(incomplete,trialing,active,past_due\)/);
  assert.match(consulta, /plan_catalog\(license_plan,monthly_price_clp\)/);
});

test("72 h de gracia tras lo pagado; sin gracia si canceló al cierre; después de la gracia, plan_expired", async () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const reciente = "2026-10-21T11:55:00.000Z";
  const enUnDia = new Date(now.getTime() + DIA).toISOString();
  assert.equal((await emitir(filaFlow({ current_period_end: enUnDia, last_synced_at: reciente }), { now })).issued.expiresAt, "2026-10-25T12:00:00.000Z");
  const alCierre = (await emitir(filaFlow({ current_period_end: enUnDia, cancel_at_period_end: true, next_invoice_at: enUnDia, last_synced_at: reciente }), { now })).issued;
  assert.equal(alCierre.expiresAt, "2026-10-22T12:00:00.000Z");
  assert.equal(alCierre.subscription.nextChargeAt, null, "quien canceló al cierre no tiene otro cobro");
  assert.equal(alCierre.subscription.cancelAtPeriodEnd, true);
  // Pasado el fin de lo pagado, dentro de la gracia: el cobro del mes todavía puede llegar.
  const ayer = new Date(now.getTime() - DIA).toISOString();
  assert.equal((await emitir(filaFlow({ status: "past_due", current_period_end: ayer, last_synced_at: reciente }), { now })).issued.expiresAt, "2026-10-23T12:00:00.000Z");
  const haceTresDias = new Date(now.getTime() - 3 * DIA - 1000).toISOString();
  await assert.rejects(emitir(filaFlow({ status: "past_due", current_period_end: haceTresDias, last_synced_at: reciente }), { now }), { status: 403, code: "plan_expired" });
});

test("una cortesía vale hasta su fin, sin gracia, con el mismo tope de 7 días y sin consultar Flow", async () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const cortesia = (fin) => filaFlow({ plan_id: "tester", provider: "comp", provider_subscription_id: null, provider_customer_id: null, current_period_end: fin, plan_catalog: { license_plan: "basic", monthly_price_clp: 0 } });
  const larga = await emitir(cortesia("2027-10-21T12:00:00.000Z"), { now });
  assert.equal(larga.issued.expiresAt, "2026-10-28T12:00:00.000Z", "una cortesía de 12 meses ya no firma licencias de 12 meses");
  assert.equal(larga.issued.plan, "basic");
  assert.equal(larga.issued.subscription.nextChargeAt, null);
  assert.equal(larga.network.calls.some((call) => call.url.includes("flow.cl")), false);
  assert.equal((await emitir(cortesia("2026-10-23T12:00:00.000Z"), { now })).issued.expiresAt, "2026-10-23T12:00:00.000Z");
});

test("sin período pagado no hay licencia: ni un Pro esperando su primer cobro ni una fila sin iniciar", async () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const reciente = "2026-10-21T11:55:00.000Z";
  await assert.rejects(emitir(filaFlow({ plan_id: "pro", plan_catalog: { license_plan: "pro", monthly_price_clp: 9990 }, last_synced_at: reciente }), { now }), { status: 403, code: "plan_pending" });
  await assert.rejects(emitir(filaFlow({ status: "incomplete", last_synced_at: reciente }), { now }), { status: 403, code: "plan_pending" });
  await assert.rejects(emitir(filaFlow({ provider: "comp", provider_subscription_id: null, current_period_end: null }), { now }), { status: 403, code: "plan_pending" });
  await assert.rejects(emitir(null, { now }), { status: 403, code: "plan_required" });
});

test("prueba de 7 días que termina y cobra: al renovar se sincroniza con Flow y la licencia se extiende", async () => {
  const enPrueba = filaFlow({
    status: "trialing",
    trial_starts_at: "2026-10-13T03:00:00.000Z",
    trial_ends_at: "2026-10-20T03:00:00.000Z",
    current_period_start: "2026-10-13T03:00:00.000Z",
    current_period_end: "2026-10-20T03:00:00.000Z",
    next_invoice_at: "2026-10-20T03:00:00.000Z",
    last_synced_at: "2026-10-18T11:50:00.000Z",
  });
  // Durante la prueba (sincronizada hace 10 minutos): hasta el fin de la prueba más la gracia.
  const durante = await emitir(enPrueba, { now: new Date("2026-10-18T12:00:00Z") });
  assert.equal(durante.issued.expiresAt, "2026-10-23T03:00:00.000Z");
  assert.equal(durante.issued.subscription.trialEndsAt, "2026-10-20T03:00:00.000Z");
  assert.equal(durante.network.calls.some((call) => call.url.includes("flow.cl")), false, "a lo más una consulta cada 15 minutos");

  const cobrada = basicEnPrueba({
    status: 1,
    period_start: "2026-10-20 00:00:00",
    period_end: "2026-11-19 00:00:00",
    next_invoice_date: "2026-11-20 00:00:00",
    invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: true, flowOrder: 9000001 })],
  });
  const despues = await emitir(enPrueba, { now: new Date("2026-10-21T12:00:00Z"), flow: cobrada });
  assert.equal(despues.issued.expiresAt, "2026-10-28T12:00:00.000Z");
  assert.equal(despues.issued.subscription.status, "active");
  assert.equal(despues.issued.subscription.paidThrough, "2026-11-20T03:00:00.000Z");
  assert.equal(despues.issued.subscription.nextChargeAt, "2026-11-20T03:00:00.000Z");
  const patch = despues.network.calls.find((call) => call.method === "PATCH");
  assert.equal(patch.body.status, "active");
  assert.equal(patch.body.current_period_end, "2026-11-20T03:00:00.000Z");
});

test("cobro rechazado: queda past_due con licencia hasta lo pagado más la gracia, y después vence", async () => {
  const enPrueba = filaFlow({ status: "trialing", trial_ends_at: "2026-10-20T03:00:00.000Z", current_period_end: "2026-10-20T03:00:00.000Z", last_synced_at: "2026-10-20T12:17:00.000Z" });
  const rechazada = basicEnPrueba({
    status: 1,
    morose: 1,
    period_start: "2026-10-20 00:00:00",
    period_end: "2026-11-19 00:00:00",
    next_invoice_date: "2026-11-20 00:00:00",
    invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: false, flowOrder: 9000002 })],
  });
  const morosa = await emitir(enPrueba, { now: new Date("2026-10-21T12:00:00Z"), flow: rechazada });
  assert.equal(morosa.issued.subscription.status, "past_due");
  assert.equal(morosa.issued.expiresAt, "2026-10-23T03:00:00.000Z");
  const patch = morosa.network.calls.find((call) => call.method === "PATCH");
  assert.equal(patch.body.payment_link, "https://www.flow.cl/app/web/pay.php?token=PAGO2001");
  // Diez minutos después de la última consulta y ya pasada la gracia: vence.
  const vencida = filaFlow({ status: "past_due", current_period_end: "2026-10-20T03:00:00.000Z", last_synced_at: "2026-10-23T03:50:00.000Z" });
  await assert.rejects(emitir(vencida, { now: new Date("2026-10-23T04:00:00Z") }), { status: 403, code: "plan_expired" });
});

test("cancelación al cierre: licencia hasta lo pagado sin gracia, y al terminar Flow la deja cancelada", async () => {
  const alCierre = filaFlow({ status: "trialing", cancel_at_period_end: true, trial_ends_at: "2026-10-20T03:00:00.000Z", current_period_end: "2026-10-20T03:00:00.000Z", last_synced_at: "2026-10-19T11:55:00.000Z" });
  assert.equal((await emitir(alCierre, { now: new Date("2026-10-19T12:00:00Z") })).issued.expiresAt, "2026-10-20T03:00:00.000Z");
  const cancelada = basicEnPrueba({ status: 4, cancel_at_period_end: 1, cancel_at: "2026-10-20 00:00:00" });
  const despues = emitir({ ...alCierre, last_synced_at: "2026-10-19T12:00:00.000Z" }, { now: new Date("2026-10-20T04:00:00Z"), flow: cancelada });
  await assert.rejects(despues, { status: 403, code: "plan_expired" });
});

test("si Flow no responde al sincronizar, se firma con lo local y el fallo queda en el registro", async () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const errores = [];
  const consoleError = console.error;
  console.error = (...args) => errores.push(args);
  try {
    const { issued, network } = await emitir(filaFlow({ current_period_end: "2026-11-20T03:00:00.000Z" }), { now });
    assert.equal(issued.expiresAt, "2026-10-28T12:00:00.000Z");
    assert.equal(network.calls.filter((call) => call.url.includes("/subscription/get")).length, 1, "nunca sincronizada: se intenta una vez");
    assert.equal(network.calls.some((call) => call.method === "PATCH"), false);
  } finally {
    console.error = consoleError;
  }
  assert.equal(errores[0][0], "pteron license sync");
});

test("si la clave privada no es la del kid publicado responde 503 license_key_mismatch y no guarda nada", async () => {
  const otra = testKeyPair();
  const now = new Date("2026-10-21T12:00:00Z");
  const fila = filaFlow({ current_period_end: "2026-11-20T03:00:00.000Z", last_synced_at: "2026-10-21T11:55:00.000Z" });
  const network = fakeNetwork([{ match: matches.supabase("subscriptions", "GET"), respond: { body: [fila] } }]);
  const consoleError = console.error;
  console.error = () => {};
  try {
    for (const publicKeys of [{ k1: otra.publicPem }, {}]) {
      const services = testServices(envEmision, publicKeys);
      await assert.rejects(
        withFetch(network.fetch, () => services.license.issueLicense("user-1", { ...services, now })),
        { status: 503, code: "license_key_mismatch" },
      );
    }
  } finally {
    console.error = consoleError;
  }
  assert.equal(network.calls.some((call) => call.url.includes("/rest/v1/licenses")), false);
});
