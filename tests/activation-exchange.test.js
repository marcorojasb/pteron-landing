const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");

process.env.SUPABASE_URL = "https://fake.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-fake";
process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-fake";
const { privateKey } = generateKeyPairSync("ed25519");
process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.LICENSE_KID = "k1";

const exchange = require("../api/activation/exchange");

// Enruta por tabla + método: el mismo endpoint dispara varias llamadas
// PostgREST distintas (leer el intent, leer la suscripción, guardar la
// licencia, marcar el intent consumido) y cada test define sólo las que le
// importan.
function fakeSupabase(routes) {
  const calls = [];
  return {
    calls,
    async fetch(url, init = {}) {
      const method = init.method || "GET";
      calls.push({ url: String(url), method });
      const route = routes.find((entry) => entry.method === method && String(url).includes(`/rest/v1/${entry.table}`));
      if (!route) throw new Error(`Sin mock para ${method} ${url}`);
      const result = typeof route.respond === "function" ? route.respond(calls.length) : route.respond;
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
}

function fakeReq(body) {
  return { method: "POST", body, headers: {} };
}

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: "" };
  res.setHeader = (key, value) => {
    res.headers[key] = value;
  };
  res.end = (chunk) => {
    if (chunk) res.body += chunk;
  };
  return res;
}

const pendingIntent = { id: "intent-1", user_id: "user-1", expires_at: new Date(Date.now() + 60_000).toISOString() };
const activeSubscription = {
  plan_id: "pro",
  current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
};

test("exchange devuelve una licencia válida cuando el intent ya está autorizado", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "license-1" }] } },
    { table: "activation_intents", method: "PATCH", respond: { body: [{ id: "intent-1" }] } },
  ]);
  const globalFetch = globalThis.fetch;
  globalThis.fetch = supabase.fetch;
  try {
    const res = fakeRes();
    await exchange(fakeReq({ code: "codigo-de-prueba" }), res);

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body);
    assert.equal(payload.ok, true);
    assert.equal(payload.plan, "pro");
    assert.equal(typeof payload.token, "string");
    assert.equal(supabase.calls.length, 4);
  } finally {
    globalThis.fetch = globalFetch;
  }
});

test("exchange rechaza un código sin intent autorizado (410, no gastó nada)", async () => {
  const supabase = fakeSupabase([{ table: "activation_intents", method: "GET", respond: { body: [] } }]);
  const globalFetch = globalThis.fetch;
  globalThis.fetch = supabase.fetch;
  try {
    const res = fakeRes();
    await exchange(fakeReq({ code: "codigo-sin-autorizar" }), res);

    assert.equal(res.statusCode, 410);
    assert.equal(JSON.parse(res.body).error, "activation_not_ready");
    assert.equal(supabase.calls.length, 1, "no debe llamar a subscriptions ni licenses si el intent no está listo");
  } finally {
    globalThis.fetch = globalFetch;
  }
});

test("exchange no emite licencia si el usuario no tiene un plan activo", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [] } },
  ]);
  const globalFetch = globalThis.fetch;
  globalThis.fetch = supabase.fetch;
  try {
    const res = fakeRes();
    await exchange(fakeReq({ code: "codigo-de-prueba" }), res);

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "plan_required");
  } finally {
    globalThis.fetch = globalFetch;
  }
});

test("exchange rechaza un enlace ya canjeado por otra llamada concurrente (409)", async () => {
  const supabase = fakeSupabase([
    { table: "activation_intents", method: "GET", respond: { body: [pendingIntent] } },
    { table: "subscriptions", method: "GET", respond: { body: [activeSubscription] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "license-1" }] } },
    // La carrera real: otra corrida ya lo marcó consumido, el update no encuentra la fila pendiente.
    { table: "activation_intents", method: "PATCH", respond: { body: [] } },
  ]);
  const globalFetch = globalThis.fetch;
  globalThis.fetch = supabase.fetch;
  try {
    const res = fakeRes();
    await exchange(fakeReq({ code: "codigo-de-prueba" }), res);

    assert.equal(res.statusCode, 409);
    assert.equal(JSON.parse(res.body).error, "activation_used");
  } finally {
    globalThis.fetch = globalFetch;
  }
});

test("exchange rechaza un cuerpo sin código", async () => {
  const res = fakeRes();
  await exchange(fakeReq({}), res);
  assert.equal(res.statusCode, 400);
});
