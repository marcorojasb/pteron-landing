import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { fakeExecution, fakeSupabase, jsonRequest, testEnv, testKeyPair, withFetch } from "./helpers/fakes.js";

const keys = testKeyPair();
const env = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem });

function exchange(payload) {
  return worker.fetch(jsonRequest("https://pteron.test/api/activation/exchange", payload), env, fakeExecution());
}

const pendingIntent = { id: "intent-1", user_id: "user-1", expires_at: new Date(Date.now() + 60_000).toISOString() };
const activeSubscription = {
  plan_id: "pro",
  current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  // issueLicense firma plan_catalog.license_plan, no plan_id.
  plan_catalog: { license_plan: "pro" },
};

test("exchange devuelve una licencia válida cuando el intent ya está autorizado", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "license-1" }] } },
    { table: "activation_intents", method: "PATCH", respond: { body: [{ id: "intent-1" }] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const res = await exchange({ code: "codigo-de-prueba" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.plan, "pro");
    assert.equal(payload.keyId, "k1");
    assert.equal(typeof payload.token, "string");
    assert.equal(supabase.calls.length, 4);
    const upsert = supabase.calls[2];
    assert.match(upsert.url, /on_conflict=subject/);
    assert.equal(upsert.body.subject, "user-1");
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

test("exchange no emite licencia si el usuario no tiene un plan activo", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const res = await exchange({ code: "codigo-de-prueba" });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, "plan_required");
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

test("exchange rechaza un cuerpo sin código", async () => {
  const res = await exchange({});
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_input");
});

test("start crea un intent y devuelve el enlace de cuenta sin barra final", async () => {
  const supabase = fakeSupabase([{ table: "activation_intents", method: "POST", respond: { body: [{ id: "intent-2" }] } }]);
  await withFetch(supabase.fetch, async () => {
    const res = await worker.fetch(jsonRequest("https://pteron.test/api/activation/start", { appInstanceId: "mac-01" }), env, fakeExecution());
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.match(payload.browserUrl, /^https:\/\/pteron\.test\/cuenta\?activate=[0-9a-f]{64}$/);
    assert.match(payload.deepLink, /^pteron:\/\/activate\?code=[0-9a-f]{64}$/);
    assert.match(supabase.calls[0].body.code_hash, /^[0-9a-f]{64}$/);
  });
});
