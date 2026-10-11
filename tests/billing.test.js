import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { fakeExecution, fakeNetwork, formRequest, jsonRequest, matches, testEnv, withFetch } from "./helpers/fakes.js";

const env = testEnv({ FLOW_API_KEY: "flow-api", FLOW_SECRET_KEY: "flow-secret", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });
const user = { id: "11111111-1111-4111-8111-111111111111", email: "profe@escuela.cl", user_metadata: { full_name: "Profe Uno" } };
const INTENT = "22222222-2222-4222-8222-222222222222";

function run(request) {
  return worker.fetch(request, env, fakeExecution());
}

test("checkout crea cliente y plan en Flow, guarda el intent y devuelve el enlace de registro de tarjeta", async () => {
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("subscriptions"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
    { match: matches.flow("/customer/create"), respond: { body: { customerId: "cus_1" } } },
    { match: matches.flow("/plans/create"), respond: { body: { planId: "pteron-basic-monthly" } } },
    { match: matches.supabase("billing_checkout_intents", "POST"), respond: { body: [{ id: INTENT }] } },
    { match: matches.flow("/customer/register"), respond: { body: { url: "https://sandbox.flow.cl/app/register", token: "tok_1" } } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(jsonRequest("https://pteron.test/api/billing/checkout", { plan: "Basic" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.plan, "basic");
    assert.equal(payload.trialPeriodDays, 7);
    assert.equal(payload.redirectUrl, "https://sandbox.flow.cl/app/register?token=tok_1");

    const plan = network.calls.find((call) => call.url.includes("/plans/create"));
    assert.equal(plan.body.planId, "pteron-basic-monthly");
    assert.equal(plan.body.urlCallback, "https://pteron.test/api/billing/flow-callback");
    assert.equal(plan.body.amount, "2999");
    assert.match(plan.body.s, /^[0-9a-f]{64}$/, "toda petición a Flow va firmada");
    assert.equal(plan.headers["Content-Type"], "application/x-www-form-urlencoded;charset=UTF-8");

    const register = network.calls.find((call) => call.url.includes("/customer/register"));
    assert.equal(register.body.url_return, `https://pteron.test/api/billing/card-callback?intent=${INTENT}`);

    const intent = network.calls.find((call) => call.url.includes("/rest/v1/billing_checkout_intents") && call.method === "POST");
    assert.equal(intent.body.status, "card_registration_pending");
    assert.equal(intent.body.provider_customer_id, "cus_1");
    assert.equal(intent.headers.Authorization, "Bearer service-role-fake", "las escrituras van con la service role");
  });
});

test("checkout rechaza un plan desconocido y un plan ya en curso sin tocar Flow", async () => {
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("subscriptions"), respond: { body: [{ id: "s", plan_id: "pro", status: "active" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const unknown = await run(jsonRequest("https://pteron.test/api/billing/checkout", { plan: "oro" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json()).error, "invalid_plan");
    const existing = await run(jsonRequest("https://pteron.test/api/billing/checkout", { plan: "pro" }, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(existing.status, 409);
    assert.equal((await existing.json()).error, "subscription_exists");
    assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false);
  });
});

test("card-callback recibe el formulario de Flow, crea la suscripción y redirige a la cuenta sin barra final", async () => {
  const futureExpiry = new Date(Date.now() + 10 * 60_000).toISOString();
  const network = fakeNetwork([
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [{ id: INTENT, user_id: user.id, plan_id: "basic", provider_customer_id: "cus_1", provider_plan_id: "pteron-basic-monthly", status: "card_registration_pending", expires_at: futureExpiry }] } },
    { match: matches.flow("/customer/getRegisterStatus"), respond: { body: { status: 1, customerId: "cus_1" } } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [{ id: INTENT }] } },
    { match: matches.flow("/subscription/create"), respond: { body: { subscriptionId: "sub_1", trial_end: "2026-10-18 12:00:00", next_invoice_date: "2026-10-18 12:00:00" } } },
    { match: matches.supabase("subscriptions", "POST"), respond: { body: [{ id: "row" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(formRequest(`https://pteron.test/api/billing/card-callback?intent=${INTENT}`, { token: "tok_1" }));
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
    assert.equal(res.headers.get("x-frame-options"), "DENY");

    const status = network.calls.find((call) => call.url.includes("/customer/getRegisterStatus"));
    assert.equal(status.method, "GET");
    assert.match(status.url, /[?&]token=tok_1(&|$)/);
    assert.match(status.url, /[?&]s=[0-9a-f]{64}(&|$)/);

    const subscription = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST");
    assert.equal(subscription.body.status, "trialing");
    assert.equal(subscription.body.provider_subscription_id, "sub_1");
    assert.equal(subscription.body.trial_ends_at, "2026-10-18T12:00:00.000Z");

    const patches = network.calls.filter((call) => call.url.includes("billing_checkout_intents") && call.method === "PATCH").map((call) => call.body.status);
    assert.deepEqual(patches, ["subscription_pending", "completed"]);
  });
});

test("card-callback con registro fallido marca el intent y vuelve a la cuenta como cancelado", async () => {
  const futureExpiry = new Date(Date.now() + 10 * 60_000).toISOString();
  const network = fakeNetwork([
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [{ id: INTENT, user_id: user.id, plan_id: "basic", provider_customer_id: "cus_1", provider_plan_id: "p", status: "card_registration_pending", expires_at: futureExpiry }] } },
    { match: matches.flow("/customer/getRegisterStatus"), respond: { body: { status: 0 } } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [{ id: INTENT }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(formRequest(`https://pteron.test/api/billing/card-callback?intent=${INTENT}`, { token: "tok_1" }));
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=cancelled");
    const patch = network.calls.find((call) => call.method === "PATCH");
    assert.equal(patch.body.status, "failed");
    assert.equal(network.calls.some((call) => call.url.includes("/subscription/create")), false);
  });
});

test("card-callback rechaza un intent que no es uuid sin consultar la base, y exige token", async () => {
  await withFetch(async () => { throw new Error("no debe tocar la red"); }, async () => {
    const bogus = await run(formRequest("https://pteron.test/api/billing/card-callback?intent=x'--", { token: "tok" }));
    assert.equal(bogus.status, 410);
    assert.equal((await bogus.json()).error, "checkout_expired");
    const missing = await run(formRequest(`https://pteron.test/api/billing/card-callback?intent=${INTENT}`, {}));
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error, "invalid_callback");
  });
});

test("flow-callback registra el evento de pago y actualiza la suscripción con el nuevo período", async () => {
  const network = fakeNetwork([
    // Estado textual: los códigos numéricos de Flow se mantienen tal como los
    // interpretaba la implementación anterior y se revisan contra el sandbox.
    { match: matches.flow("/payment/getStatus"), respond: { body: { status: "paid", subscriptionId: "sub_1", paymentId: "pay_1", next_invoice_date: "2026-11-18 12:00:00" } } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "row", user_id: user.id, status: "trialing" }] } },
    { match: matches.supabase("billing_events", "POST"), respond: { body: [{ id: "ev" }] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "row" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(formRequest("https://pteron.test/api/billing/flow-callback", { token: "tok_pay" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    const event = network.calls.find((call) => call.url.includes("billing_events"));
    assert.equal(event.body.event_type, "flow_payment_callback");
    assert.match(event.body.external_event_id, /^[0-9a-f]{64}$/);
    assert.deepEqual(event.body.event_metadata, { providerPaymentId: "pay_1", providerSubscriptionId: "sub_1", state: "active" });
    const patch = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "PATCH");
    assert.deepEqual(patch.body, { status: "active", current_period_end: "2026-11-18T12:00:00.000Z" });
  });
});

test("cancel pide a Flow cancelar al final del período y lo deja anotado", async () => {
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "row", provider_subscription_id: "sub_1", current_period_end: "2026-11-01T00:00:00.000Z" }] } },
    { match: matches.flow("/subscription/cancel"), respond: { body: { status: 1 } } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "row" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(jsonRequest("https://pteron.test/api/billing/cancel", {}, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, cancelAt: "2026-11-01T00:00:00.000Z" });
    const cancel = network.calls.find((call) => call.url.includes("/subscription/cancel"));
    assert.equal(cancel.body.at_period_end, "1");
    const patch = network.calls.find((call) => call.method === "PATCH");
    assert.deepEqual(patch.body, { cancel_at_period_end: true });
  });
});
