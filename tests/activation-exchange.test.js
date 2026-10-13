import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { matchApi } from "../src/worker.js";
import { handleError } from "../src/lib/http.js";
import { verifyLicense } from "../src/lib/license.js";
import { fakeExecution, fakeSupabase, jsonRequest, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";

const keys = testKeyPair();
const testKeys = { k2: keys.publicPem };
const env = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem });

/**
 * Canje con las claves públicas de prueba: el Worker comprueba cada licencia
 * recién firmada contra la clave publicada del kid, y la de prueba no es la de
 * PUBLIC_KEYS. Los errores se convierten en respuesta como en handleApi.
 */
async function exchange(payload) {
  const request = jsonRequest("https://pteron.test/api/activation/exchange", payload);
  try {
    return await matchApi("/api/activation/exchange")({ request, env, url: new URL(request.url), execution: fakeExecution(), services: testServices(env, testKeys) });
  } catch (error) {
    return handleError(error);
  }
}

const DIA = 86_400_000;
const pendingIntent = { id: "intent-1", user_id: "user-1", expires_at: new Date(Date.now() + 60_000).toISOString() };
const periodEnd = new Date(Date.now() + 30 * DIA).toISOString();
const activeSubscription = {
  id: "sub-1",
  plan_id: "pro",
  provider: "flow",
  provider_subscription_id: "sus_1",
  status: "active",
  current_period_end: periodEnd,
  next_invoice_at: periodEnd,
  cancel_at_period_end: false,
  trial_ends_at: null,
  // Recién sincronizada: el canje no consulta Flow.
  last_synced_at: new Date().toISOString(),
  // issueLicense firma plan_catalog.license_plan, no plan_id.
  plan_catalog: { license_plan: "pro", monthly_price_clp: 9990 },
};

test("exchange devuelve una licencia válida y el estado del plan cuando el intent ya está autorizado", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "license-1" }] } },
    { table: "activation_intents", method: "PATCH", respond: { body: [{ id: "intent-1" }] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const before = Date.now();
    const res = await exchange({ code: "codigo-de-prueba" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.plan, "pro");
    assert.equal(payload.keyId, "k2");
    assert.equal((await verifyLicense(payload.token, testKeys))?.sub, "user-1");
    // Tope de 7 días aunque el período pagado dure 30.
    const exp = Date.parse(payload.expiresAt);
    assert.ok(exp >= before + 7 * DIA && exp <= Date.now() + 7 * DIA, payload.expiresAt);
    assert.deepEqual(payload.subscription, {
      planId: "pro",
      status: "active",
      paidThrough: periodEnd,
      accessUntil: new Date(Date.parse(periodEnd) + 72 * 3_600_000).toISOString(),
      trialEndsAt: null,
      nextChargeAt: periodEnd,
      cancelAtPeriodEnd: false,
      priceClp: 9990,
    });
    assert.equal(supabase.calls.length, 4);
    const upsert = supabase.calls[2];
    assert.match(upsert.url, /on_conflict=subject/);
    assert.equal(upsert.body.subject, "user-1");
    assert.equal(upsert.body.expires_at, payload.expiresAt);
    assert.match(upsert.body.token_hash, /^[0-9a-f]{64}$/);
  });
});

test("exchange rechaza un código sin intent autorizado (410, no gastó nada)", async () => {
  const supabase = fakeSupabase([{ table: "activation_intents", method: "GET", respond: { body: [] } }]);
  await withFetch(supabase.fetch, async () => {
    const res = await exchange({ code: "codigo-sin-autorizar" });
    assert.equal(res.status, 410);
    assert.equal((await res.json()).error, "activation_not_ready");
    assert.equal(supabase.calls.length, 1, "no debe llamar a subscriptions ni licenses si el intent no está listo");
  });
});

test("exchange no emite licencia si el usuario no tiene un plan activo, ni consume el intent", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const res = await exchange({ code: "codigo-de-prueba" });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, "plan_required");
    assert.equal(supabase.calls.some((call) => call.method === "PATCH"), false);
  });
});

test("exchange rechaza un enlace ya canjeado por otra llamada concurrente (409)", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "license-1" }] } },
    // La carrera real: otra corrida ya lo marcó consumido, el update no encuentra la fila pendiente.
    { table: "activation_intents", method: "PATCH", respond: { body: [] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const res = await exchange({ code: "codigo-de-prueba" });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "activation_used");
  });
});

test("exchange con la clave real de producción y una privada de prueba responde 503 license_key_mismatch", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
  ]);
  const consoleError = console.error;
  console.error = () => {};
  try {
    await withFetch(supabase.fetch, async () => {
      const res = await worker.fetch(jsonRequest("https://pteron.test/api/activation/exchange", { code: "codigo-de-prueba" }), env, fakeExecution());
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "license_key_mismatch");
      assert.equal(supabase.calls.some((call) => call.method !== "GET"), false, "ni licencia guardada ni intent consumido");
    });
  } finally {
    console.error = consoleError;
  }
});

test("exchange rechaza un cuerpo sin código", async () => {
  const res = await exchange({});
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_input");
});

test("start crea un intent de 60 minutos y devuelve el enlace de cuenta sin barra final", async () => {
  const supabase = fakeSupabase([{ table: "activation_intents", method: "POST", respond: { body: [{ id: "intent-2" }] } }]);
  await withFetch(supabase.fetch, async () => {
    const before = Date.now();
    const res = await worker.fetch(jsonRequest("https://pteron.test/api/activation/start", { appInstanceId: "mac-01" }), env, fakeExecution());
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.match(payload.browserUrl, /^https:\/\/pteron\.test\/cuenta\?activate=[0-9a-f]{64}$/);
    assert.match(payload.deepLink, /^pteron:\/\/activate\?code=[0-9a-f]{64}$/);
    assert.match(supabase.calls[0].body.code_hash, /^[0-9a-f]{64}$/);
    const expires = Date.parse(payload.expiresAt);
    assert.ok(expires >= before + 60 * 60_000 && expires <= Date.now() + 60 * 60_000, payload.expiresAt);
    assert.equal(supabase.calls[0].body.expires_at, payload.expiresAt);
  });
});
