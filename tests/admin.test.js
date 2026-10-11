import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { monthRange } from "../src/routes/admin.js";
import { fakeExecution, fakeNetwork, jsonRequest, matches, testEnv, withFetch } from "./helpers/fakes.js";

const env = testEnv({ ADMIN_EMAILS: "Marco@Patagua.dev, otro@patagua.dev" });
const admin = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "marco@patagua.dev", created_at: "2026-01-01T00:00:00.000Z" };
const profe = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "profe@escuela.cl", created_at: "2026-09-10T00:00:00.000Z", last_sign_in_at: "2026-10-01T10:00:00.000Z" };
const usersRoute = { match: (url) => url.includes("/auth/v1/admin/users?"), respond: { body: { users: [admin, profe] } } };
const userRoute = { match: (url) => url.includes(`/auth/v1/admin/users/${profe.id}`), respond: { body: profe } };
const meRoute = (user) => ({ match: matches.auth("user"), respond: { body: user } });

function run(request, customEnv = env) {
  return worker.fetch(request, customEnv, fakeExecution());
}
const get = (path, token = "sesion-admin") => new Request(`https://pteron.test${path}`, { headers: { authorization: `Bearer ${token}` } });

test("monthRange usa el mes UTC actual por defecto y acepta YYYY-MM", () => {
  const now = new Date("2026-10-11T23:30:00.000Z");
  assert.deepEqual(monthRange("", now), { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z", label: "2026-10" });
  assert.deepEqual(monthRange("2026-12", now), { start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z", label: "2026-12" });
  assert.throws(() => monthRange("2026-13", now), { code: "invalid_month" });
});

test("sin ADMIN_EMAILS responde 503; sin sesión 401; con un correo no autorizado 403, sin leer datos", async () => {
  const unconfigured = await run(get("/api/admin/resumen"), testEnv());
  assert.equal(unconfigured.status, 503);
  assert.equal((await unconfigured.json()).error, "admin_not_configured");
  const anonymous = await run(new Request("https://pteron.test/api/admin/resumen"));
  assert.equal(anonymous.status, 401);
  const network = fakeNetwork([meRoute(profe)]);
  await withFetch(network.fetch, async () => {
    const forbidden = await run(get("/api/admin/resumen"));
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error, "forbidden");
    assert.equal(network.calls.length, 1, "sólo se consultó la sesión");
  });
});

test("resumen cuenta pagos, cortesías, pruebas, ingreso recurrente, tokens del mes y licencias", async () => {
  const period = monthRange();
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [
      { user_id: profe.id, plan_id: "pro", provider: "flow", status: "active" },
      { user_id: "u2", plan_id: "basic", provider: "flow", status: "trialing" },
      { user_id: "u3", plan_id: "tester", provider: "comp", status: "active" },
      { user_id: "u4", plan_id: "basic", provider: "flow", status: "incomplete" },
    ] } },
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "basic", monthly_price_clp: 2999 }, { id: "pro", monthly_price_clp: 9990 }, { id: "tester", monthly_price_clp: 0 }] } },
    { match: matches.supabase("usage_periods"), respond: (call) => { assert.match(call.url, new RegExp(encodeURIComponent(period.start).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); return { body: [{ user_id: profe.id, ai_units_used: 1500 }, { user_id: "u2", ai_units_used: 0 }] }; } },
    { match: matches.supabase("licenses"), respond: { body: [{ id: "l1" }, { id: "l2" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/resumen"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.cuentas, 2);
    assert.equal(data.pagando, 2);
    assert.equal(data.cortesias, 1);
    assert.equal(data.en_prueba, 1);
    assert.equal(data.clp_mes_recurrente, 9990, "sólo las activas pagadas suman al recurrente");
    assert.equal(data.tokens_mes, 1500);
    assert.equal(data.cuentas_con_uso, 1);
    assert.equal(data.licencias_vigentes, 2);
    const usersCall = network.calls.find((call) => call.url.includes("/auth/v1/admin/users"));
    assert.equal(usersCall.headers.Authorization, "Bearer service-role-fake", "la lista de usuarios va con la service role");
  });
});

test("cuentas cruza usuarios con plan vigente, última licencia y consumo del mes, y filtra por correo", async () => {
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [{ user_id: profe.id, plan_id: "basic", provider: "flow", status: "trialing", trial_ends_at: "2026-10-18T00:00:00.000Z" }] } },
    { match: matches.supabase("licenses"), respond: { body: [{ user_id: profe.id, plan_id: "basic", status: "active", expires_at: "2026-11-01T00:00:00.000Z", key_id: "k2", issued_at: "2026-10-11T00:00:00.000Z" }, { user_id: profe.id, plan_id: "basic", status: "active", expires_at: "2026-10-01T00:00:00.000Z", key_id: "k1", issued_at: "2026-09-11T00:00:00.000Z" }] } },
    { match: matches.supabase("usage_periods"), respond: { body: [{ user_id: profe.id, ai_units_used: 420, ai_units_limit: null }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/cuentas?q=ESCUELA"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 1);
    const row = data.cuentas[0];
    assert.equal(row.email, "profe@escuela.cl");
    assert.equal(row.suscripcion.status, "trialing");
    assert.equal(row.licencia.key_id, "k2", "la licencia más reciente");
    assert.equal(row.consumo_mes.ai_units_used, 420);
  });
});

test("el detalle de una cuenta reúne suscripciones, licencias, activaciones, consumo y eventos", async () => {
  const network = fakeNetwork([
    meRoute(admin), userRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [{ id: "s1", plan_id: "pro", provider: "comp", status: "active" }] } },
    { match: matches.supabase("licenses"), respond: { body: [] } },
    { match: matches.supabase("activation_intents"), respond: { body: [{ id: "a1", status: "consumed" }] } },
    { match: matches.supabase("usage_periods"), respond: { body: [{ period_start: "2026-10-01T00:00:00.000Z", ai_units_used: 10 }] } },
    { match: matches.supabase("usage_events"), respond: { body: [{ units: 10, event_metadata: { route_model: "claude-haiku-5-5" } }] } },
    { match: matches.supabase("billing_events"), respond: { body: [] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get(`/api/admin/cuentas/${profe.id}`));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.cuenta.email, "profe@escuela.cl");
    assert.equal(data.suscripciones[0].provider, "comp");
    assert.equal(data.activaciones.length, 1);
    assert.equal(data.eventos[0].event_metadata.route_model, "claude-haiku-5-5");
  });
  const bogus = await withFetch(fakeNetwork([meRoute(admin)]).fetch, () => run(get("/api/admin/cuentas/no-es-uuid")));
  assert.equal(bogus.status, 404);
});

test("dar cortesía cancela el plan vigente e inserta una suscripción comp; quitarla la cancela", async () => {
  const network = fakeNetwork([
    meRoute(admin), userRoute,
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "tester" }] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "old" }] } },
    { match: matches.supabase("subscriptions", "POST"), respond: (call) => ({ body: [{ id: "new", ...call.body }] }) },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(jsonRequest(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { plan: "tester", meses: 6 }, { headers: { authorization: "Bearer sesion-admin" } }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.suscripcion.provider, "comp");
    assert.equal(data.suscripcion.status, "active");
    assert.equal(data.suscripcion.plan_id, "tester");
    const months = (Date.parse(data.suscripcion.current_period_end) - Date.parse(data.suscripcion.current_period_start)) / (30 * 86400000);
    assert.ok(months > 5.5 && months < 6.5, "vence en unos seis meses");
    const cancel = network.calls.find((call) => call.method === "PATCH");
    assert.match(cancel.url, /status=in\.\(incomplete,trialing,active,past_due,paused\)/);
    assert.equal(cancel.body.status, "canceled");

    const invalid = await run(jsonRequest(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { plan: "tester", meses: 99 }, { headers: { authorization: "Bearer sesion-admin" } }));
    assert.equal(invalid.status, 400);

    const removed = await run(new Request(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { method: "DELETE", headers: { authorization: "Bearer sesion-admin" } }));
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { ok: true, retiradas: 1 });
    const removal = network.calls.filter((call) => call.method === "PATCH").at(-1);
    assert.match(removal.url, /provider=eq\.comp/);
  });
});

test("consumo agrega tokens por cuenta y por modelo del mes pedido", async () => {
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("usage_periods"), respond: (call) => { assert.match(call.url, /2026-09-01T00%3A00%3A00\.000Z/); return { body: [{ user_id: profe.id, plan_id: "pro", ai_units_used: 900, ai_units_limit: null }] }; } },
    { match: matches.supabase("usage_events"), respond: { body: [
      { user_id: profe.id, units: 600, event_metadata: { route_model: "claude-haiku-5-5" } },
      { user_id: profe.id, units: 300, event_metadata: { route_model: "deepseek-v4-flash" } },
    ] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/consumo?mes=2026-09"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mes, "2026-09");
    assert.equal(data.total_tokens, 900);
    assert.equal(data.total_peticiones, 2);
    assert.deepEqual(data.modelos, [{ modelo: "claude-haiku-5-5", tokens: 600 }, { modelo: "deepseek-v4-flash", tokens: 300 }]);
    assert.equal(data.cuentas[0].correo, "profe@escuela.cl");
    assert.equal(data.cuentas[0].peticiones, 2);
  });
});

test("planes se listan y el límite de IA se actualiza con validación", async () => {
  const network = fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("plan_catalog", "GET"), respond: { body: [{ id: "basic", ai_units_limit: null, listed: true }] } },
    { match: matches.supabase("plan_catalog", "PATCH"), respond: (call) => ({ body: [{ id: "basic", ...call.body }] }) },
  ]);
  await withFetch(network.fetch, async () => {
    const list = await run(get("/api/admin/planes"));
    assert.equal(list.status, 200);
    assert.equal((await list.json()).planes[0].id, "basic");
    const ok = await run(new Request("https://pteron.test/api/admin/planes/basic", { method: "PATCH", headers: { authorization: "Bearer sesion-admin", "content-type": "application/json" }, body: JSON.stringify({ ai_units_limit: 200000 }) }));
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).plan.ai_units_limit, 200000);
    const bad = await run(new Request("https://pteron.test/api/admin/planes/basic", { method: "PATCH", headers: { authorization: "Bearer sesion-admin", "content-type": "application/json" }, body: JSON.stringify({ ai_units_limit: -5 }) }));
    assert.equal(bad.status, 400);
    const none = await run(new Request("https://pteron.test/api/admin/planes/basic", { method: "PATCH", headers: { authorization: "Bearer sesion-admin", "content-type": "application/json" }, body: "{}" }));
    assert.equal(none.status, 400);
  });
});

test("una ruta de administración desconocida responde 404 después de autenticar", async () => {
  await withFetch(fakeNetwork([meRoute(admin)]).fetch, async () => {
    const res = await run(get("/api/admin/nada"));
    assert.equal(res.status, 404);
  });
});
