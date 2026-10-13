import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { matchApi } from "../src/worker.js";
import { fakeExecution, fakeNetwork, jsonRequest, matches, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";

const keys = testKeyPair();
const env = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem });
const user = { id: "user-1", email: "profe@escuela.cl", created_at: "2026-01-01T00:00:00.000Z" };

function run(request) {
  return worker.fetch(request, env, fakeExecution());
}

test("auth/refresh devuelve los cuatro campos de la sesión renovada y 502 si GoTrue responde a medias", async () => {
  const network = fakeNetwork([
    { match: matches.auth("token"), respond: (call, calls) => ({ body: calls.length === 1 ? { access_token: "a", refresh_token: "r", expires_in: 3600, token_type: "bearer" } : {} }) },
  ]);
  await withFetch(network.fetch, async () => {
    const ok = await run(jsonRequest("https://pteron.test/api/auth/refresh", { refresh_token: "viejo" }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { access_token: "a", refresh_token: "r", expires_in: 3600, token_type: "bearer" });
    assert.match(network.calls[0].url, /grant_type=refresh_token$/);
    const partial = await run(jsonRequest("https://pteron.test/api/auth/refresh", { refresh_token: "viejo" }));
    assert.equal(partial.status, 502);
    assert.equal((await partial.json()).error, "auth_error");
  });
});

test("auth/me responde 200 con sesión válida, 401 cuando Supabase rechaza el token y 502 ante otro fallo", async () => {
  let status = 200;
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: () => ({ status, body: status === 200 ? user : { message: "bad jwt" } }) },
  ]);
  await withFetch(network.fetch, async () => {
    const ok = await run(new Request("https://pteron.test/api/auth/me", { headers: { authorization: "Bearer sesion" } }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { user: { id: "user-1", email: "profe@escuela.cl", createdAt: "2026-01-01T00:00:00.000Z" } });
    assert.equal(network.calls[0].headers.Authorization, "Bearer sesion");
    status = 401;
    const expired = await run(new Request("https://pteron.test/api/auth/me", { headers: { authorization: "Bearer sesion" } }));
    assert.equal(expired.status, 401);
    assert.equal((await expired.json()).error, "not_authenticated");
    status = 500;
    const broken = await run(new Request("https://pteron.test/api/auth/me", { headers: { authorization: "Bearer sesion" } }));
    assert.equal(broken.status, 502);
    assert.equal((await broken.json()).error, "supabase_error");
  });
});

test("account devuelve perfil, catálogo, suscripciones y licencias con valores por defecto vacíos", async () => {
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("profiles"), respond: { body: [] } },
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "basic", display_name: "Basic" }] } },
    { match: matches.supabase("subscriptions"), respond: { body: null } },
    { match: matches.supabase("licenses"), respond: { body: [] } },
    { match: matches.supabase("usage_periods"), respond: { body: [] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(new Request("https://pteron.test/api/account", { headers: { authorization: "Bearer sesion" } }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      user: { id: "user-1", email: "profe@escuela.cl", createdAt: "2026-01-01T00:00:00.000Z" },
      profile: { display_name: null },
      plans: [{ id: "basic", display_name: "Basic" }],
      subscriptions: [],
      licenses: [],
      trialEligible: true,
      termsVersion: "2026-10-13",
      usage: null,
    });
    const reads = network.calls.filter((call) => call.url.includes("/rest/v1/"));
    assert.ok(reads.every((call) => call.headers.Authorization === "Bearer sesion"), "las lecturas van con la sesión del profesor");
  });
});

test("activation/complete vincula el intent a la cuenta y rechaza los que vencieron o son de otra cuenta", async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  let intents = [{ id: "i1", user_id: null, expires_at: future }];
  let bound = [{ id: "i1" }];
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("activation_intents", "GET"), respond: () => ({ body: intents }) },
    { match: matches.supabase("activation_intents", "PATCH"), respond: () => ({ body: bound }) },
  ]);
  await withFetch(network.fetch, async () => {
    const ok = await run(jsonRequest("https://pteron.test/api/activation/complete", { code: "abc" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, deepLink: "pteron://activate?code=abc", expiresAt: future });
    const patch = network.calls.find((call) => call.method === "PATCH");
    assert.match(patch.url, /user_id=is\.null/);
    assert.deepEqual(patch.body, { user_id: "user-1" });

    bound = [];
    const lost = await run(jsonRequest("https://pteron.test/api/activation/complete", { code: "abc" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(lost.status, 409);
    assert.equal((await lost.json()).error, "activation_bound");

    intents = [{ id: "i1", user_id: "otro", expires_at: future }];
    const foreign = await run(jsonRequest("https://pteron.test/api/activation/complete", { code: "abc" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(foreign.status, 409);

    intents = [];
    const expired = await run(jsonRequest("https://pteron.test/api/activation/complete", { code: "abc" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(expired.status, 410);
    assert.equal((await expired.json()).error, "activation_expired");
  });
});

test("license/refresh reemite desde la sesión web y firma con el kid configurado", async () => {
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("subscriptions"), respond: { body: [{ plan_id: "basic", status: "active", current_period_end: new Date(Date.now() + 86400000).toISOString(), plan_catalog: { license_plan: "basic" } }] } },
    { match: matches.supabase("licenses", "POST"), respond: { body: [{ id: "l" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    // La firma recién hecha se comprueba con la clave pública del kid: aquí, la del par de pruebas.
    const request = jsonRequest("https://pteron.test/api/license/refresh", {}, { headers: { authorization: "Bearer sesion" } });
    const res = await matchApi("/api/license/refresh")({ request, env, url: new URL(request.url), execution: fakeExecution(), services: testServices(env, { k1: keys.publicPem }) });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.plan, "basic");
    assert.equal(payload.keyId, "k1");
    const [segment] = payload.token.split(".");
    assert.equal(JSON.parse(Buffer.from(segment, "base64url").toString("utf8")).kid, "k1");
  });
});

test("un cuerpo JSON que no es objeto responde 400, no 500", async () => {
  for (const body of ["null", "[1]", "42", '"texto"']) {
    const res = await run(new Request("https://pteron.test/api/auth/refresh", { method: "POST", headers: { "content-type": "application/json" }, body }));
    assert.equal(res.status, 400, body);
    assert.equal((await res.json()).error, "invalid_json");
  }
});
