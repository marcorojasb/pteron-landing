import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { matchApi } from "../src/worker.js";
import { monthRange } from "../src/routes/admin.js";
import { faltaParaVender } from "../src/routes/health.js";
import { fakeExecution, fakeNetwork, jsonRequest, matches, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";

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
const send = (path, requestMethod, payload) => new Request(`https://pteron.test${path}`, {
  method: requestMethod,
  headers: { authorization: "Bearer sesion-admin", "content-type": "application/json" },
  body: JSON.stringify(payload),
});

async function quietly(task) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await task();
  } finally {
    console.error = originalError;
  }
}

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
    for (const request of [get("/api/admin/resumen"), get("/api/admin/salud"), send(`/api/admin/cuentas/${profe.id}/terminar`, "POST", { motivo: "x" }), send("/api/admin/ajustes", "PATCH", { included_ai_paused: true })]) {
      const forbidden = await run(request);
      assert.equal(forbidden.status, 403);
      assert.equal((await forbidden.json()).error, "forbidden");
    }
    assert.ok(network.calls.every((call) => call.url.includes("/auth/v1/user")), "sólo se consultó la sesión");
  });
});

test("resumen cuenta pagos, cortesías, pruebas, ingreso recurrente, IA del mes en unidades, venta y pausa", async () => {
  const period = monthRange();
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [
      { user_id: profe.id, plan_id: "pro", provider: "flow", status: "active" },
      { user_id: "u2", plan_id: "basic", provider: "flow", status: "trialing" },
      { user_id: "u3", plan_id: "tester", provider: "comp", status: "active" },
      { user_id: "u4", plan_id: "basic", provider: "flow", status: "incomplete" },
    ] } },
    { match: matches.supabase("plan_catalog"), respond: { body: [
      { id: "tester", display_name: "Tester", monthly_price_clp: 0, for_sale: false },
      { id: "basic", display_name: "Basic", monthly_price_clp: 2990, for_sale: true },
      { id: "pro", display_name: "Pro", monthly_price_clp: 9990, for_sale: false },
    ] } },
    { match: matches.rpc("admin_usage_by_account"), respond: { body: [{ user_id: profe.id, requests: 3, units: 1500 }, { user_id: "u2", requests: 1, units: 0 }] } },
    { match: matches.rpc("admin_usage_by_model"), respond: { body: [{ route_model: "claude-haiku-5-5", requests: 4, units: 1500 }] } },
    { match: matches.supabase("licenses"), respond: { body: [{ id: "l1" }, { id: "l2" }] } },
    { match: matches.supabase("app_settings"), respond: { body: [{ value: true }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/resumen"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.cuentas, 2);
    assert.equal(data.pagando, 2);
    assert.equal(data.cortesias, 1);
    assert.equal(data.en_prueba, 1);
    assert.equal(data.clp_mes_recurrente, 9990, "sólo las activas pagadas suman, al precio del catálogo");
    assert.equal(data.unidades_mes, 1500);
    assert.equal(data.cuentas_con_uso, 1);
    assert.equal(data.licencias_vigentes, 2);
    assert.deepEqual(data.a_la_venta, ["Basic"]);
    assert.equal(data.ia_incluida_pausada, true);
    const usersCall = network.calls.find((call) => call.url.includes("/auth/v1/admin/users"));
    assert.equal(usersCall.headers.Authorization, "Bearer service-role-fake", "la lista de usuarios va con la service role");
    const rpc = network.calls.find((call) => call.url.includes("/rpc/admin_usage_by_model"));
    assert.deepEqual(rpc.body, { p_from: period.start, p_to: period.end }, "el mes en curso, agregado en la base");
    assert.equal(network.calls.some((call) => call.url.includes("/rest/v1/usage_events")), false, "no trae las peticiones una por una");
  });
});

test("sin fila de interruptor el resumen da la IA incluida por pausada, como la base", async () => {
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [] } },
    { match: matches.supabase("plan_catalog"), respond: { body: [] } },
    { match: matches.rpc("admin_usage_by"), respond: { body: [] } },
    { match: matches.supabase("licenses"), respond: { body: [] } },
    { match: matches.supabase("app_settings"), respond: { body: [] } },
  ]);
  await withFetch(network.fetch, async () => {
    const data = await (await run(get("/api/admin/resumen"))).json();
    assert.equal(data.ia_incluida_pausada, true);
    assert.equal(data.unidades_mes, 0);
  });
});

test("cuentas cruza usuarios con plan vigente, última licencia y el período de cuota que contiene ahora, y filtra por correo", async () => {
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [{ user_id: profe.id, plan_id: "basic", provider: "flow", status: "trialing", trial_ends_at: "2026-10-18T00:00:00.000Z" }] } },
    { match: matches.supabase("licenses"), respond: { body: [{ user_id: profe.id, plan_id: "basic", status: "active", expires_at: "2026-11-01T00:00:00.000Z", key_id: "k2", issued_at: "2026-10-11T00:00:00.000Z" }, { user_id: profe.id, plan_id: "basic", status: "active", expires_at: "2026-10-01T00:00:00.000Z", key_id: "k2", issued_at: "2026-09-11T00:00:00.000Z" }] } },
    { match: matches.supabase("usage_periods"), respond: { body: [
      { user_id: profe.id, period_start: "2026-10-11T03:00:00.000Z", period_end: "2026-10-18T03:00:00.000Z", ai_units_used: 420, ai_units_limit: 1500000 },
      { user_id: profe.id, period_start: "2026-10-01T03:00:00.000Z", period_end: "2026-11-01T03:00:00.000Z", ai_units_used: 9, ai_units_limit: 6000000 },
    ] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/cuentas?q=ESCUELA"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 1);
    const row = data.cuentas[0];
    assert.equal(row.email, "profe@escuela.cl");
    assert.equal(row.suscripcion.status, "trialing");
    assert.equal(row.licencia.issued_at, "2026-10-11T00:00:00.000Z", "la licencia más reciente");
    assert.equal(row.consumo_periodo.ai_units_used, 420, "el período que empezó último");
    const periods = network.calls.find((call) => call.url.includes("/rest/v1/usage_periods"));
    assert.match(periods.url, /period_start=lte\.[^&]+&period_end=gt\./);
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
    const subscriptions = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions"));
    assert.match(subscriptions.url, /next_invoice_at,morose,last_synced_at/, "lo que dice Flow de la suscripción");
  });
  const bogus = await withFetch(fakeNetwork([meRoute(admin)]).fetch, () => run(get("/api/admin/cuentas/no-es-uuid")));
  assert.equal(bogus.status, 404);
});

test("dar cortesía reemplaza sólo una cortesía e inserta una suscripción comp", async () => {
  const network = fakeNetwork([
    meRoute(admin), userRoute,
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "tester" }] } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "old", provider: "comp" }] } },
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
    assert.match(cancel.url, /provider=eq\.comp&status=in\.\(incomplete,trialing,active,past_due,paused\)/, "nunca cancela una fila de Flow");
    assert.equal(cancel.body.status, "canceled");

    const invalid = await run(jsonRequest(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { plan: "tester", meses: 99 }, { headers: { authorization: "Bearer sesion-admin" } }));
    assert.equal(invalid.status, 400);
  });
});

test("dar cortesía se niega si la cuenta paga en Flow, sin escribir nada", async () => {
  const network = fakeNetwork([
    meRoute(admin), userRoute,
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "tester" }] } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "pagada", provider: "flow" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(jsonRequest(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { plan: "tester", meses: 12 }, { headers: { authorization: "Bearer sesion-admin" } }));
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.error, "flow_subscription_active");
    assert.match(data.message, /Terminar ahora/);
    assert.equal(network.calls.some((call) => call.method !== "GET"), false);
  });
});

test("quitar cortesía la cancela y revoca las licencias si no queda plan vigente; con un plan vigente no las toca", async () => {
  let current = [];
  const network = fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "comp-1" }] } },
    { match: matches.supabase("subscriptions", "GET"), respond: () => ({ body: current }) },
    { match: matches.supabase("licenses", "PATCH"), respond: { body: [{ id: "l1" }] } },
  ]);
  const remove = () => new Request(`https://pteron.test/api/admin/cuentas/${profe.id}/cortesia`, { method: "DELETE", headers: { authorization: "Bearer sesion-admin" } });
  await withFetch(network.fetch, async () => {
    const removed = await run(remove());
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { ok: true, retiradas: 1, licencias_revocadas: 1 });
    const cancel = network.calls.find((call) => call.method === "PATCH" && call.url.includes("/subscriptions"));
    assert.match(cancel.url, /provider=eq\.comp/);
    const revoke = network.calls.find((call) => call.url.includes("/rest/v1/licenses"));
    assert.match(revoke.url, new RegExp(`user_id=eq\\.${profe.id}&status=eq\\.active`));
    assert.deepEqual(revoke.body, { status: "revoked" });

    current = [{ id: "otra" }];
    network.calls.length = 0;
    const kept = await run(remove());
    assert.deepEqual(await kept.json(), { ok: true, retiradas: 1, licencias_revocadas: 0 });
    assert.equal(network.calls.some((call) => call.url.includes("/rest/v1/licenses")), false);
  });
});

function terminateFixture({ subscription = { id: "sub-1", plan_id: "basic", status: "active", provider_subscription_id: "sus_abc" }, cancel = { status: 200, body: { subscriptionId: "sus_abc", status: 4 } }, flowGet = null } = {}) {
  return fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("subscriptions", "GET"), respond: { body: subscription ? [subscription] : [] } },
    { match: matches.flow("/subscription/cancel"), respond: cancel },
    { match: matches.flow("/subscription/get"), respond: flowGet || { status: 500, body: { message: "caído" } } },
    { match: matches.supabase("billing_events", "POST"), respond: (call) => ({ body: [call.body] }) },
    { match: matches.supabase("subscriptions", "PATCH"), respond: (call) => ({ body: [{ id: "sub-1", ...call.body }] }) },
    { match: matches.supabase("licenses", "PATCH"), respond: { body: [{ id: "l1" }] } },
  ]);
}
const flowEnv = { ...env, FLOW_API_KEY: "flow-api", FLOW_SECRET_KEY: "flow-secret", FLOW_BASE_URL: "https://sandbox.flow.cl/api" };
const terminate = (payload = { motivo: "Retracto pedido por correo" }) => send(`/api/admin/cuentas/${profe.id}/terminar`, "POST", payload);

test("Terminar ahora cancela en Flow en el acto, deja el motivo en un evento, cierra la fila y revoca las licencias", async () => {
  const network = terminateFixture();
  await withFetch(network.fetch, async () => {
    const res = await run(terminate(), flowEnv);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.flow_cancelada, true);
    assert.equal(data.suscripcion.status, "canceled");
    assert.equal(data.licencias_revocadas, 1);

    const lookup = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "GET");
    assert.match(lookup.url, /provider=eq\.flow&status=in\.\(incomplete,trialing,active,past_due,paused\)/);
    const cancel = network.calls.find((call) => call.url.includes("/subscription/cancel"));
    assert.equal(cancel.body.subscriptionId, "sus_abc");
    assert.equal(cancel.body.at_period_end, "0", "en el acto, no al cierre del período");
    const event = network.calls.find((call) => call.url.includes("/rest/v1/billing_events"));
    assert.match(event.url, /on_conflict=external_event_id/);
    assert.equal(event.body.external_event_id, "admin:terminate:sub-1");
    assert.equal(event.body.event_type, "subscription_terminated_by_admin");
    assert.equal(event.body.event_metadata.reason, "Retracto pedido por correo");
    assert.equal(event.body.event_metadata.adminEmail, "marco@patagua.dev");
    const close = network.calls.find((call) => call.method === "PATCH" && call.url.includes("/rest/v1/subscriptions"));
    assert.match(close.url, /id=eq\.sub-1&status=in\./);
    assert.equal(close.body.status, "canceled");
    assert.ok(Date.parse(close.body.canceled_at) > Date.now() - 60_000);
    const step = (call) => {
      if (call.url.includes("/subscription/cancel")) return "flow";
      if (call.url.includes("/rest/v1/billing_events")) return "evento";
      if (call.method === "PATCH" && call.url.includes("/rest/v1/licenses")) return "licencias";
      if (call.method === "PATCH" && call.url.includes("/rest/v1/subscriptions")) return "fila";
      return null;
    };
    assert.deepEqual(network.calls.map(step).filter(Boolean), ["flow", "evento", "licencias", "fila"], "la fila se cierra al final: un reintento la encuentra vigente");
  });
});

test("Terminar ahora exige motivo y una suscripción Flow vigente", async () => {
  const network = terminateFixture({ subscription: null });
  await withFetch(network.fetch, async () => {
    const noReason = await run(terminate({ motivo: "  " }), flowEnv);
    assert.equal(noReason.status, 400);
    const missing = await run(terminate(), flowEnv);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error, "subscription_missing");
    const wrongMethod = await run(get(`/api/admin/cuentas/${profe.id}/terminar`), flowEnv);
    assert.equal(wrongMethod.status, 405);
    assert.equal(network.calls.some((call) => call.url.includes("flow.cl") || call.method !== "GET"), false, "nada se cancela ni se escribe");
  });
});

test("si Flow rechaza la cancelación, Terminar ahora sólo sigue cuando Flow confirma que ya estaba cancelada", async () => {
  const rejected = terminateFixture({ cancel: { status: 400, body: { code: 400, message: "subscription canceled" } }, flowGet: { body: { subscriptionId: "sus_abc", status: 4 } } });
  await withFetch(rejected.fetch, async () => {
    const res = await run(terminate(), flowEnv);
    assert.equal(res.status, 200, "un reintento después de una cancelación que sí ocurrió");
    assert.equal((await res.json()).suscripcion.status, "canceled");
  });

  const stillActive = terminateFixture({ cancel: { status: 400, body: { code: 400, message: "error" } }, flowGet: { body: { subscriptionId: "sus_abc", status: 1 } } });
  await withFetch(stillActive.fetch, async () => {
    const res = await run(terminate(), flowEnv);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, "flow_error");
    assert.equal(stillActive.calls.some((call) => call.url.includes("/rest/v1/") && call.method !== "GET"), false, "la fila sigue igual si Flow sigue cobrando");
  });
});

test("una fila Flow sin id de suscripción se cierra sin llamar a Flow y la respuesta lo avisa", async () => {
  const network = terminateFixture({ subscription: { id: "sub-1", plan_id: "basic", status: "incomplete", provider_subscription_id: null } });
  await withFetch(network.fetch, async () => {
    const res = await run(terminate(), flowEnv);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).flow_cancelada, false);
    assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false);
  });
});

test("consumo agrega en la base unidades y peticiones por cuenta y por modelo del mes pedido", async () => {
  const network = fakeNetwork([
    meRoute(admin), usersRoute,
    { match: matches.supabase("subscriptions"), respond: { body: [{ user_id: profe.id, plan_id: "tester", provider: "comp" }] } },
    { match: matches.rpc("admin_usage_by_account"), respond: (call) => {
      assert.deepEqual(call.body, { p_from: "2026-09-01T00:00:00.000Z", p_to: "2026-10-01T00:00:00.000Z" });
      return { body: [{ user_id: profe.id, requests: 2, units: 900 }] };
    } },
    { match: matches.rpc("admin_usage_by_model"), respond: { body: [{ route_model: "claude-haiku-5-5", requests: 1, units: 600 }, { route_model: null, requests: 1, units: 300 }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(get("/api/admin/consumo?mes=2026-09"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mes, "2026-09");
    assert.equal(data.total_unidades, 900);
    assert.equal(data.total_peticiones, 2);
    assert.deepEqual(data.modelos, [{ modelo: "claude-haiku-5-5", peticiones: 1, unidades: 600 }, { modelo: "sin modelo", peticiones: 1, unidades: 300 }]);
    assert.deepEqual(data.cuentas, [{ user_id: profe.id, correo: "profe@escuela.cl", plan_id: "tester", cortesia: true, peticiones: 2, unidades: 900 }]);
    assert.equal(network.calls.some((call) => call.url.includes("/rest/v1/usage_events")), false);
  });
});

test("planes se listan y las cuotas de período y de prueba se actualizan con validación", async () => {
  const network = fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("plan_catalog", "GET"), respond: { body: [{ id: "basic", active: true, listed: true, for_sale: false, monthly_price_clp: 2990, ai_units_limit: null, license_plan: "basic" }] } },
    { match: matches.supabase("plan_catalog", "PATCH"), respond: (call) => ({ body: [{ id: "basic", ...call.body }] }) },
  ]);
  await withFetch(network.fetch, async () => {
    const list = await run(get("/api/admin/planes"));
    assert.equal(list.status, 200);
    assert.equal((await list.json()).planes[0].id, "basic");
    assert.match(network.calls.at(-1).url, /trial_ai_units_limit,license_plan,active,listed,for_sale/);
    const ok = await run(send("/api/admin/planes/basic", "PATCH", { ai_units_limit: 6000000, trial_ai_units_limit: 1500000 }));
    assert.equal(ok.status, 200);
    const plan = (await ok.json()).plan;
    assert.equal(plan.ai_units_limit, 6000000);
    assert.equal(plan.trial_ai_units_limit, 1500000);
    const cleared = await run(send("/api/admin/planes/basic", "PATCH", { trial_ai_units_limit: null }));
    assert.equal(cleared.status, 200, "la prueba vuelve a un cuarto de la cuota");
    for (const payload of [{ ai_units_limit: -5 }, { ai_units_limit: 1.5 }, { trial_ai_units_limit: 3_000_000_000 }, { ai_units_limit: "6000000" }, {}]) {
      const bad = await run(send("/api/admin/planes/basic", "PATCH", payload));
      assert.equal(bad.status, 400, JSON.stringify(payload));
    }
  });
});

test("la venta se abre sólo con un plan completo y un plan a la venta no puede quedar sin cuota", async () => {
  let row = { id: "basic", active: true, listed: true, for_sale: false, monthly_price_clp: 2990, ai_units_limit: null, license_plan: "basic" };
  const network = fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("plan_catalog", "GET"), respond: () => ({ body: [row] }) },
    { match: matches.supabase("plan_catalog", "PATCH"), respond: (call) => {
      row = { ...row, ...call.body };
      return { body: [row] };
    } },
  ]);
  await withFetch(network.fetch, async () => {
    const asText = await run(send("/api/admin/planes/basic", "PATCH", { for_sale: "false" }));
    assert.equal(asText.status, 400, "un texto no es un booleano: Boolean('false') abriría la venta");

    const noQuota = await run(send("/api/admin/planes/basic", "PATCH", { for_sale: true }));
    assert.equal(noQuota.status, 409);
    const refused = await noQuota.json();
    assert.equal(refused.error, "plan_not_ready");
    assert.equal(refused.message, "Para abrir la venta, basic debe tener cuota de IA.");
    assert.equal(network.calls.some((call) => call.method === "PATCH"), false);

    const opened = await run(send("/api/admin/planes/basic", "PATCH", { for_sale: true, ai_units_limit: 6000000 }));
    assert.equal(opened.status, 200);
    assert.equal((await opened.json()).plan.for_sale, true);

    const unlimited = await run(send("/api/admin/planes/basic", "PATCH", { ai_units_limit: null }));
    assert.equal(unlimited.status, 409, "a la venta y sin tope no");
    assert.equal((await unlimited.json()).message, "basic está a la venta y debe tener cuota de IA. Para cambiarlo, cierra antes su venta.");
    const hidden = await run(send("/api/admin/planes/basic", "PATCH", { listed: false }));
    assert.equal(hidden.status, 409);

    const closed = await run(send("/api/admin/planes/basic", "PATCH", { for_sale: false }));
    assert.equal(closed.status, 200);
    assert.equal((await closed.json()).plan.for_sale, false);
  });
  assert.deepEqual(faltaParaVender({ id: "tester", active: true, listed: false, monthly_price_clp: 0, ai_units_limit: 6000000, license_plan: "basic" }), ["visible", "precio"]);
});

test("el interruptor pausa y reanuda la IA incluida en app_settings", async () => {
  const network = fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("app_settings", "POST"), respond: (call) => ({ body: [call.body] }) },
  ]);
  await withFetch(network.fetch, async () => {
    const pause = await run(send("/api/admin/ajustes", "PATCH", { included_ai_paused: true }));
    assert.equal(pause.status, 200);
    assert.deepEqual(await pause.json(), { ok: true, included_ai_paused: true });
    const write = network.calls.find((call) => call.url.includes("/rest/v1/app_settings"));
    assert.match(write.url, /on_conflict=key/);
    assert.equal(write.body.key, "included_ai_paused");
    assert.equal(write.body.value, true);
    assert.equal(write.headers.Authorization, "Bearer service-role-fake");

    const resume = await run(send("/api/admin/ajustes", "PATCH", { included_ai_paused: false }));
    assert.deepEqual(await resume.json(), { ok: true, included_ai_paused: false });
    const invalid = await run(send("/api/admin/ajustes", "PATCH", { included_ai_paused: "no" }));
    assert.equal(invalid.status, 400);
    const read = await run(get("/api/admin/ajustes"));
    assert.equal(read.status, 405);
  });
});

function saludFixture(overrides = {}) {
  const keys = testKeyPair();
  const saludEnv = {
    ...env,
    LICENSE_KID: "k2",
    LICENSE_PRIVATE_KEY_PEM: keys.privatePem,
    ANTHROPIC_API_KEY: "anthropic-secreta",
    GATEWAY_MODEL_ID: "claude-haiku-5-5",
    FLOW_API_KEY: "flow-api",
    FLOW_SECRET_KEY: "flow-secreta",
    FLOW_BASE_URL: "https://www.flow.cl/api",
    FLOW_BASIC_PLAN_ID: "pteron-basic-2990-mensual",
    FLOW_PRO_PLAN_ID: "pteron-pro-9990-mensual",
    ...overrides,
  };
  return { keys, saludEnv, services: testServices(saludEnv, { k2: keys.publicPem }) };
}

const catalogo = [
  { id: "free", display_name: "Gratis", active: true, listed: true, for_sale: false, monthly_price_clp: 0, ai_units_limit: null, license_plan: null },
  { id: "tester", display_name: "Tester", active: true, listed: false, for_sale: false, monthly_price_clp: 0, ai_units_limit: 6000000, license_plan: "basic" },
  { id: "basic", display_name: "Basic", active: true, listed: true, for_sale: true, monthly_price_clp: 2990, ai_units_limit: 6000000, license_plan: "basic" },
  { id: "pro", display_name: "Pro", active: true, listed: true, for_sale: false, monthly_price_clp: 9990, ai_units_limit: 30000000, license_plan: "pro" },
];
const flowPlan = (planId, overrides = {}) => ({ planId, currency: "CLP", amount: 2990, interval: 3, interval_count: 1, status: 1, urlCallback: "https://pteron.test/api/billing/flow-callback", ...overrides });

function saludNetwork({ anthropicStatus = 200, basicPlan = flowPlan("pteron-basic-2990-mensual"), settings = [{ value: false }], atascados = { body: [] }, rechazos = { body: [] }, aceptadas = { body: [] }, vigentes = { body: [] } } = {}) {
  return fakeNetwork([
    meRoute(admin),
    { match: matches.supabase("app_settings"), respond: { body: settings } },
    { match: matches.supabase("billing_checkout_intents"), respond: atascados },
    { match: (url, m) => matches.supabase("ai_requests")(url, m) && new URL(url).searchParams.get("event_metadata->>status") === "eq.ok", respond: aceptadas },
    { match: matches.supabase("ai_requests"), respond: rechazos },
    { match: matches.supabase("subscriptions"), respond: vigentes },
    { match: matches.supabase("plan_catalog"), respond: { body: catalogo } },
    { match: (url) => url.startsWith("https://api.anthropic.com/v1/models/"), respond: { status: anthropicStatus, body: { id: "claude-haiku-5-5", type: "model" } } },
    { match: matches.flow("/plans/get"), respond: (call) => {
      const planId = new URL(call.url).searchParams.get("planId");
      // Pro existe en Flow con otro aviso de pago: no coincide.
      return { body: planId === "pteron-basic-2990-mensual" ? basicPlan : flowPlan(planId, { amount: "9990", urlCallback: "https://otro.test/api/billing/flow-callback" }) };
    } },
  ]);
}

function salud(saludEnv, services) {
  const request = get("/api/admin/salud");
  return matchApi("/api/admin/salud")({ request, env: saludEnv, url: new URL(request.url), execution: fakeExecution(), services });
}

test("salud responde con booleanos por chequeo, compara con Flow cada plan de pago y nunca devuelve un secreto", async () => {
  const { keys, saludEnv, services } = saludFixture();
  const network = saludNetwork();
  await withFetch(network.fetch, async () => {
    const res = await salud(saludEnv, services);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.esencial, true);
    assert.ok(Object.values(data.secretos).every((value) => value === true));
    assert.ok(Object.values(data.variables).every((value) => value === true));
    assert.equal(data.supabase, true);
    assert.equal(data.firma, true, "la firma k2 se verifica con la clave pública");
    assert.equal(data.flow, true);
    assert.equal(data.flow_produccion, true);
    assert.equal(data.modelo_con_precio, true);
    assert.equal(data.anthropic, true);
    assert.equal(data.anthropic_url_oficial, true);
    assert.equal(data.ia_incluida_pausada, false);
    assert.equal(data.catalogo, true);
    assert.equal(data.checkouts_atascados, 0, "ningún intento lleva más de 10 minutos en subscription_pending");
    const plan = (id) => data.planes.find((row) => row.id === id);
    assert.equal(plan("free").flow, null, "un plan gratuito no pasa por Flow");
    assert.equal(plan("tester").flow, null);
    assert.equal(plan("basic").flow, true);
    assert.equal(plan("pro").flow, false, "otro urlCallback");
    assert.equal(data.venta, true, "Pro no está a la venta: no cuenta");

    const atascados = network.calls.find((call) => call.url.includes("billing_checkout_intents"));
    assert.match(decodeURIComponent(atascados.url), /status=eq\.subscription_pending&updated_at=lt\.\d{4}-\d{2}-\d{2}T[^&]+&select=id$/);
    const anthropic = network.calls.find((call) => call.url.startsWith("https://api.anthropic.com"));
    assert.equal(anthropic.url, "https://api.anthropic.com/v1/models/claude-haiku-5-5");
    assert.equal(anthropic.headers["x-api-key"], "anthropic-secreta");
    assert.equal(anthropic.headers["anthropic-version"], "2023-06-01");
    assert.equal(network.calls.filter((call) => call.url.includes("/plans/get")).length, 2, "sólo los planes de pago");

    const raw = JSON.stringify(data);
    for (const secret of ["anthropic-secreta", "flow-secreta", "flow-api", "service-role-fake", "publishable-fake", keys.privatePem.slice(40, 80)]) {
      assert.equal(raw.includes(secret), false, "ningún valor de secreto en la respuesta");
    }
  });
});

test("salud dice qué falla: firma sin clave, Anthropic que rechaza la clave, plan de Flow con otro monto y Flow de pruebas", async () => {
  const { saludEnv, services } = saludFixture({ LICENSE_PRIVATE_KEY_PEM: "", FLOW_BASE_URL: "https://sandbox.flow.cl/api", ANTHROPIC_BASE_URL: "https://upstream.test" });
  const network = saludNetwork({ anthropicStatus: 401, basicPlan: flowPlan("pteron-basic-2990-mensual", { amount: 2999 }), settings: [] });
  await withFetch(network.fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.equal(data.esencial, false);
    assert.equal(data.secretos.LICENSE_PRIVATE_KEY_PEM, false);
    assert.equal(data.firma, false);
    assert.equal(data.anthropic, false);
    assert.equal(data.anthropic_url_oficial, false);
    assert.equal(data.flow_produccion, false);
    assert.equal(data.ia_incluida_pausada, true, "sin fila, pausada");
    assert.equal(data.planes.find((row) => row.id === "basic").flow, false);
    assert.equal(data.venta, false, "Basic está a la venta y Flow cobraría otro monto");
  });
});

test("salud cuenta los intentos atascados en subscription_pending sin bloquear lo esencial, y dice null si no puede leerlos", async () => {
  const { saludEnv, services } = saludFixture();
  await withFetch(saludNetwork({ atascados: { body: [{ id: "i1" }, { id: "i2" }] } }).fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.equal(data.checkouts_atascados, 2);
    assert.equal(data.esencial, true);
    assert.equal(data.venta, true);
  });
  await withFetch(saludNetwork({ atascados: { status: 500, body: { message: "caído" } } }).fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.equal(data.checkouts_atascados, null);
    assert.equal(data.esencial, true);
  });
});

test("salud dice si los correos al cliente están configurados o exactamente qué nombres faltan, sin bloquear lo esencial ni la venta", async () => {
  const completo = { RESEND_API_KEY: "re_secreta_de_prueba", EMAIL_FROM: "pteron <no-reply@patagua.dev>", SELLER_NAME: "Vendedor Uno", SELLER_RUT: "1-9", SELLER_ADDRESS: "Calle 1", SELLER_EMAIL: "v@vendedor.test" };
  const casos = [
    [{}, { configurado: false, faltan: ["RESEND_API_KEY", "EMAIL_FROM", "SELLER_NAME", "SELLER_RUT", "SELLER_ADDRESS", "SELLER_EMAIL"] }],
    [{ ...completo, SELLER_RUT: "", SELLER_EMAIL: " " }, { configurado: false, faltan: ["SELLER_RUT", "SELLER_EMAIL"] }],
    [completo, { configurado: true, faltan: [] }],
  ];
  for (const [vars, esperado] of casos) {
    const { saludEnv, services } = saludFixture(vars);
    await withFetch(saludNetwork().fetch, async () => {
      const data = await (await salud(saludEnv, services)).json();
      assert.deepEqual(data.correos, esperado);
      assert.equal(data.esencial, true, "los correos no son esenciales");
      assert.equal(data.venta, true);
      assert.equal(JSON.stringify(data).includes("re_secreta_de_prueba") || JSON.stringify(data).includes("Vendedor Uno"), false, "sólo nombres, nunca valores");
    });
  }
});

test("salud muestra el último rechazo de la cuenta de Anthropic de los últimos 7 días, sin leer más que tres campos", async () => {
  const { saludEnv, services } = saludFixture();
  const cuando = new Date(Date.now() - 2 * 3_600_000).toISOString().replace("Z", "+00:00");
  const network = saludNetwork({ rechazos: { body: [{ finished_at: cuando, motivo: "tope", estado: "400" }] } });
  await withFetch(network.fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.deepEqual(data.anthropic_rechazos, { dias: 7, ultimo: { cuando, motivo: "tope", estado: 400 }, ultimo_ok: null });
    assert.equal(data.anthropic, true, "la clave responde por el modelo aunque el tope rechace cada petición");
    assert.equal(data.esencial, true, "no es esencial: es un aviso");
  });
  const [pausadas, aceptadas] = network.calls.filter((entry) => entry.url.includes("/rest/v1/ai_requests")).map((entry) => {
    assert.equal(entry.method, "GET");
    return new URL(entry.url).searchParams;
  });
  assert.equal(pausadas.get("event_metadata->>status"), "eq.provider_paused");
  assert.equal(pausadas.get("select"), "finished_at,motivo:event_metadata->>motivo,estado:event_metadata->>upstream_status");
  assert.equal(pausadas.get("order"), "finished_at.desc");
  assert.equal(pausadas.get("limit"), "1");
  const desde = Date.parse(pausadas.get("finished_at").replace(/^gte\./, ""));
  assert.ok(Math.abs(Date.now() - 7 * 86_400_000 - desde) < 60_000, "la ventana es de 7 días");
  // Después busca una petición aceptada posterior al rechazo, con un solo campo (el + de la zona horaria llega entero).
  assert.equal(aceptadas.get("event_metadata->>status"), "eq.ok");
  assert.equal(aceptadas.get("finished_at"), `gt.${cuando}`);
  assert.equal(aceptadas.get("select"), "finished_at");
  assert.equal(aceptadas.get("order"), "finished_at.desc");
  assert.equal(aceptadas.get("limit"), "1");
});

test("salud da el rechazo de Anthropic por superado si una petición funcionó después, y null si no pudo leerlo", async () => {
  const { saludEnv, services } = saludFixture();
  const cuando = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const despues = new Date(Date.now() - 10 * 60_000).toISOString();
  const rechazos = { body: [{ finished_at: cuando, motivo: "tope", estado: "400" }] };
  await withFetch(saludNetwork({ rechazos, aceptadas: { body: [{ finished_at: despues }] } }).fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.deepEqual(data.anthropic_rechazos, { dias: 7, ultimo: { cuando, motivo: "tope", estado: 400 }, ultimo_ok: despues });
  });
  await withFetch(saludNetwork({ rechazos, aceptadas: { status: 500, body: { message: "caído" } } }).fetch, async () => {
    const res = await salud(saludEnv, services);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.anthropic_rechazos, null, "sin saber si se arregló, no se afirma nada");
    assert.equal(data.esencial, true);
  });
});

test("salud dice ningún rechazo de Anthropic con ultimo null, y null si no los pudo leer, sin romper lo demás", async () => {
  const { saludEnv, services } = saludFixture();
  const network = saludNetwork();
  await withFetch(network.fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.deepEqual(data.anthropic_rechazos, { dias: 7, ultimo: null, ultimo_ok: null });
  });
  assert.equal(network.calls.filter((entry) => entry.url.includes("/rest/v1/ai_requests")).length, 1, "sin rechazo no busca aceptadas");
  await withFetch(saludNetwork({ rechazos: { status: 500, body: { message: "caído" } }, vigentes: { status: 500, body: { message: "caído" } } }).fetch, async () => {
    const res = await salud(saludEnv, services);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.anthropic_rechazos, null);
    assert.equal(data.anthropic_tope_sugerido, null);
    assert.equal(data.esencial, true);
    assert.equal(data.venta, true);
  });
});

const HORA = 3_600_000;
const PLANES = {
  basic: { display_name: "Basic", ai_units_limit: 6_000_000, license_plan: "basic" },
  pro: { display_name: "Pro", ai_units_limit: 30_000_000, license_plan: "pro" },
  tester: { display_name: "Tester", ai_units_limit: 6_000_000, license_plan: "basic" },
  free: { display_name: "Gratis", ai_units_limit: null, license_plan: null },
};
function vigente(plan, overrides = {}) {
  return {
    plan_id: plan,
    provider: "flow",
    status: "active",
    current_period_end: new Date(Date.now() + 20 * 24 * HORA).toISOString(),
    cancel_at_period_end: false,
    plan_catalog: PLANES[plan],
    ...overrides,
  };
}
const repetir = (n, row) => Array.from({ length: n }, () => row);

test("salud sugiere el tope de Anthropic: mínimo US$20 sin cuentas o con pocas", async () => {
  const { saludEnv, services } = saludFixture();
  await withFetch(saludNetwork().fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.deepEqual(data.anthropic_tope_sugerido, { usd: 20, minimo_usd: 20, factor: 1.5, unidades_mes: 0, sin_tope: 0, planes: [] });
  });
  // 10 Basic y 2 Pro: 1,5 × (6 + 6) = US$18, bajo el mínimo.
  await withFetch(saludNetwork({ vigentes: { body: [...repetir(10, vigente("basic")), ...repetir(2, vigente("pro"))] } }).fetch, async () => {
    const tope = (await (await salud(saludEnv, services)).json()).anthropic_tope_sugerido;
    assert.equal(tope.unidades_mes, 120_000_000);
    assert.equal(tope.usd, 20);
  });
});

test("salud sugiere el tope de Anthropic con la regla del gateway: cortesías vigentes, prueba, gracia de Flow, y nada más", async () => {
  const { saludEnv, services } = saludFixture();
  const antes = (horas) => new Date(Date.now() - horas * HORA).toISOString();
  const cuentan = [
    ...repetir(30, vigente("basic")),
    ...repetir(5, vigente("pro")),
    vigente("basic", { status: "trialing" }),
    vigente("basic", { status: "past_due", current_period_end: antes(48) }),
    vigente("tester", { provider: "comp" }),
    vigente("tester", { provider: "comp" }),
    vigente("pro", { provider: "comp" }),
  ];
  const noCuentan = [
    vigente("tester", { provider: "comp", current_period_end: antes(1) }),
    vigente("basic", { current_period_end: antes(73) }),
    vigente("basic", { current_period_end: antes(1), cancel_at_period_end: true }),
    vigente("basic", { status: "canceled" }),
    vigente("basic", { status: "paused" }),
    vigente("basic", { current_period_end: null }),
    vigente("free"),
  ];
  const network = saludNetwork({ vigentes: { body: [...cuentan, ...noCuentan] } });
  await withFetch(network.fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    // Basic 32 × 6 M + Pro 6 × 30 M + Tester 2 × 6 M = 384 M unidades = US$38,4; × 1,5 = 57,6 → US$58.
    assert.deepEqual(data.anthropic_tope_sugerido, {
      usd: 58,
      minimo_usd: 20,
      factor: 1.5,
      unidades_mes: 384_000_000,
      sin_tope: 0,
      planes: [
        { id: "basic", nombre: "Basic", cuentas: 32, cortesias: 0, unidades_mes: 192_000_000, sin_tope: 0 },
        { id: "pro", nombre: "Pro", cuentas: 6, cortesias: 1, unidades_mes: 180_000_000, sin_tope: 0 },
        { id: "tester", nombre: "Tester", cuentas: 2, cortesias: 2, unidades_mes: 12_000_000, sin_tope: 0 },
      ],
    });
  });
  const call = network.calls.find((entry) => entry.url.includes("/rest/v1/subscriptions"));
  const url = new URL(call.url);
  assert.equal(url.searchParams.get("status"), "in.(trialing,active,past_due)");
  assert.equal(url.searchParams.get("select"), "plan_id,provider,status,current_period_end,cancel_at_period_end,plan_catalog(display_name,ai_units_limit,license_plan)");
  assert.equal(url.searchParams.get("select").includes("user_id"), false, "sólo cuenta: ningún dato de las cuentas");
});

test("salud redondea el tope hacia arriba, cuenta aparte las cuentas de un plan sin tope de IA y lee por páginas", async () => {
  const { saludEnv, services } = saludFixture();
  const sinCuota = { display_name: "Ilimitado", ai_units_limit: null, license_plan: "pro" };
  // 134 Basic = 804 M unidades = US$80,4; × 1,5 = 120,6 → US$121. La primera página trae 1.000 filas.
  const filas = [...repetir(134, vigente("basic")), ...repetir(866, vigente("basic", { status: "canceled" })), vigente("pro", { plan_id: "ilimitado", plan_catalog: sinCuota })];
  const network = saludNetwork({ vigentes: (call) => {
    const offset = Number(new URL(call.url).searchParams.get("offset"));
    return { body: filas.slice(offset, offset + 1000) };
  } });
  await withFetch(network.fetch, async () => {
    const tope = (await (await salud(saludEnv, services)).json()).anthropic_tope_sugerido;
    assert.equal(tope.unidades_mes, 804_000_000);
    assert.equal(tope.usd, 121);
    assert.equal(tope.sin_tope, 1);
    assert.deepEqual(tope.planes.find((plan) => plan.id === "ilimitado"), { id: "ilimitado", nombre: "Ilimitado", cuentas: 1, cortesias: 0, unidades_mes: 0, sin_tope: 1 });
  });
  const paginas = network.calls.filter((entry) => entry.url.includes("/rest/v1/subscriptions")).map((entry) => new URL(entry.url).searchParams.get("offset"));
  assert.deepEqual(paginas, ["0", "1000"]);
});

test("salud sin clave de Anthropic ni modelo con precio no llama a Anthropic", async () => {
  const { saludEnv, services } = saludFixture({ ANTHROPIC_API_KEY: "", GATEWAY_MODEL_ID: "modelo-sin-precio" });
  const network = saludNetwork();
  await withFetch(network.fetch, async () => {
    const data = await (await salud(saludEnv, services)).json();
    assert.equal(data.secretos.ANTHROPIC_API_KEY, false);
    assert.equal(data.modelo_con_precio, false);
    assert.equal(data.anthropic, false);
    assert.equal(data.esencial, false);
    assert.equal(network.calls.some((call) => call.url.includes("anthropic.com")), false);
  });
});

test("un 401 o 403 de Supabase con la service role es configuración del servidor (503), no la sesión del administrador", async () => {
  for (const status of [401, 403]) {
    const network = fakeNetwork([
      meRoute(admin),
      { match: matches.supabase("app_settings", "POST"), respond: { status, body: { message: "Invalid API key" } } },
    ]);
    await withFetch(network.fetch, () => quietly(async () => {
      const res = await run(send("/api/admin/ajustes", "PATCH", { included_ai_paused: true }));
      assert.equal(res.status, 503, String(status));
      assert.equal((await res.json()).error, "server_misconfigured");
    }));
  }
});

test("una ruta de administración desconocida responde 404 después de autenticar", async () => {
  await withFetch(fakeNetwork([meRoute(admin)]).fetch, async () => {
    const res = await run(get("/api/admin/nada"));
    assert.equal(res.status, 404);
  });
});
