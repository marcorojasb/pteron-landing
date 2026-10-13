import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { sha256Hex } from "../src/lib/crypto.js";
import { reconcilePendingCheckouts } from "../src/lib/flow-sync.js";
import { trialEligible } from "../src/routes/billing.js";
import { TERMS_VERSION } from "../src/lib/terms.js";
import { fakeExecution, fakeNetwork, formRequest, jsonRequest, matches, testEnv, testServices, withFetch } from "./helpers/fakes.js";
import { FLOW_ERROR, REGISTER, basicEnPrueba, cliente, cobroMensual, pago, planFlow, registro } from "./helpers/flow-fixtures.js";

const env = testEnv({
  FLOW_API_KEY: "flow-api",
  FLOW_SECRET_KEY: "flow-secret",
  FLOW_BASE_URL: "https://sandbox.flow.cl/api",
  FLOW_BASIC_PLAN_ID: "pteron-basic-2990-mensual",
  FLOW_PRO_PLAN_ID: "pteron-pro-9990-mensual",
});
const user = { id: "11111111-1111-4111-8111-111111111111", email: "profe@escuela.cl", user_metadata: { full_name: "Profe Uno" } };
const INTENT = "22222222-2222-4222-8222-222222222222";
const CALLBACK = "https://pteron.test/api/billing/flow-callback";
const BASIC = { id: "basic", display_name: "Basic", monthly_price_clp: 2990, trial_period_days: 7, license_plan: "basic" };
const PLAN_BASIC = planFlow({ planId: "pteron-basic-2990-mensual", name: "pteron Basic", amount: 2990, created: "2026-10-13 10:00:00", trial_period_days: 7, periods_number: 0, urlCallback: CALLBACK });

function run(request, runEnv = env) {
  return worker.fetch(request, runEnv, fakeExecution());
}

// Se pide al mismo sitio que PUBLIC_SITE_URL: desde otro host la guarda responde 421.
function pedirCheckout(payload, runEnv = env) {
  const sitio = runEnv.PUBLIC_SITE_URL || "https://pteron.test";
  return run(jsonRequest(`${sitio}/api/billing/checkout`, payload, { headers: { authorization: "Bearer sesion" } }), runEnv);
}

const conTerminos = (plan) => ({ plan, acceptedTerms: true, termsVersion: TERMS_VERSION });

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

/**
 * Red del checkout. `planGet` son las respuestas sucesivas de plans/get;
 * `previas`, las suscripciones Flow que la cuenta ya tuvo (deciden la prueba);
 * `pendientes`, los intentos suyos en subscription_pending.
 */
function checkoutNetwork({ catalogo = [BASIC], vigentes = [], previas = [], guardado = [], intentosPrevios = [], pendientes = [], planGet = [{ body: PLAN_BASIC }], extra = [] } = {}) {
  let lecturasPlan = 0;
  return fakeNetwork([
    ...extra,
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("plan_catalog"), respond: { body: catalogo } },
    { match: (url, m) => m === "GET" && url.includes("/rest/v1/subscriptions") && url.includes("provider=eq.flow"), respond: { body: previas } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: vigentes } },
    { match: matches.supabase("billing_customers", "GET"), respond: { body: guardado } },
    { match: matches.supabase("billing_customers", "POST"), respond: { body: [{ user_id: user.id }] } },
    { match: (url, m) => matches.supabase("billing_checkout_intents", "GET")(url, m) && url.includes("status=eq.subscription_pending"), respond: { body: pendientes } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: intentosPrevios } },
    { match: matches.supabase("billing_checkout_intents", "POST"), respond: { body: [{ id: INTENT }] } },
    { match: matches.flow("/plans/get"), respond: () => planGet[Math.min(lecturasPlan++, planGet.length - 1)] },
    { match: matches.flow("/plans/create"), respond: { body: PLAN_BASIC } },
    { match: matches.flow("/customer/create"), respond: { body: cliente({ customerId: "cus_1", email: user.email, name: "Profe Uno", externalId: user.id }) } },
    { match: matches.flow("/customer/register"), respond: { body: REGISTER } },
  ]);
}

test("checkout vende el plan del catálogo: valida el plan de Flow, guarda el cliente nuevo y deja un intento de 2 h con la prueba y los Términos", async () => {
  const network = checkoutNetwork();
  await withFetch(network.fetch, async () => {
    const before = Date.now();
    const res = await pedirCheckout(conTerminos("Basic"));
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.plan, "basic");
    assert.equal(payload.trialPeriodDays, 7);
    assert.equal(payload.redirectUrl, `${REGISTER.url}?token=${REGISTER.token}`);
    const expires = Date.parse(payload.expiresAt);
    assert.ok(expires >= before + 2 * 3_600_000 && expires <= Date.now() + 2 * 3_600_000, payload.expiresAt);

    const catalogo = network.calls.find((call) => call.url.includes("/rest/v1/plan_catalog"));
    assert.match(catalogo.url, /id=eq\.basic&active=eq\.true&listed=eq\.true&for_sale=eq\.true/);
    const lectura = network.calls.find((call) => call.url.includes("/plans/get"));
    assert.equal(lectura.method, "GET");
    assert.match(lectura.url, /[?&]planId=pteron-basic-2990-mensual(&|$)/);
    assert.match(lectura.url, /[?&]s=[0-9a-f]{64}(&|$)/, "toda petición a Flow va firmada");
    assert.equal(network.calls.some((call) => call.url.includes("/plans/create")), false, "el plan ya existía con el monto correcto");

    const creado = network.calls.find((call) => call.url.includes("/customer/create"));
    assert.deepEqual([creado.body.email, creado.body.externalId, creado.body.name], [user.email, user.id, "Profe Uno"]);
    const orden = network.calls.map((call) => call.url);
    const guardado = orden.findIndex((url) => url.includes("/rest/v1/billing_customers") && !url.includes("select="));
    const intento = network.calls.findIndex((call) => call.url.includes("/rest/v1/billing_checkout_intents") && call.method === "POST");
    assert.ok(guardado >= 0 && guardado < intento, "el cliente se guarda apenas Flow lo crea");
    assert.deepEqual(network.calls[guardado].body, { user_id: user.id, provider: "flow", provider_customer_id: "cus_1" });

    const intent = network.calls[intento];
    assert.deepEqual(intent.body, {
      user_id: user.id,
      plan_id: "basic",
      provider_customer_id: "cus_1",
      provider_plan_id: "pteron-basic-2990-mensual",
      status: "card_registration_pending",
      expires_at: payload.expiresAt,
      trial_days: 7,
      terms_version: TERMS_VERSION,
    });
    assert.equal(intent.headers.Authorization, "Bearer service-role-fake", "las escrituras van con la service role");
    const register = network.calls.find((call) => call.url.includes("/customer/register"));
    assert.equal(register.body.url_return, `https://pteron.test/api/billing/card-callback?intent=${INTENT}`);
    assert.equal(register.headers["Content-Type"], "application/x-www-form-urlencoded;charset=UTF-8");
  });
});

test("si el plan no existe en Flow se crea con los valores del catálogo y se vuelve a leer antes de cobrar", async () => {
  const network = checkoutNetwork({ planGet: [{ status: 400, body: FLOW_ERROR }, { body: PLAN_BASIC }] });
  await withFetch(network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 200);
    const creado = network.calls.find((call) => call.url.includes("/plans/create"));
    assert.deepEqual(
      { planId: creado.body.planId, name: creado.body.name, currency: creado.body.currency, amount: creado.body.amount, interval: creado.body.interval, interval_count: creado.body.interval_count, trial_period_days: creado.body.trial_period_days, days_until_due: creado.body.days_until_due, urlCallback: creado.body.urlCallback },
      { planId: "pteron-basic-2990-mensual", name: "pteron Basic", currency: "CLP", amount: "2990", interval: "3", interval_count: "1", trial_period_days: "7", days_until_due: "3", urlCallback: CALLBACK },
    );
    assert.equal(network.calls.filter((call) => call.url.includes("/plans/get")).length, 2);
  });
});

test("un plan de Flow con otro monto o con otro aviso detiene la venta (503 billing_plan_mismatch) antes de crear el cliente", async () => {
  for (const [cambio, campo] of [[{ amount: 2999 }, "amount"], [{ urlCallback: "https://otro.test/callback" }, "urlCallback"], [{ status: 0 }, "status"]]) {
    const network = checkoutNetwork({ planGet: [{ body: { ...PLAN_BASIC, ...cambio } }] });
    const errores = await registrando(() => withFetch(network.fetch, async () => {
      const res = await pedirCheckout(conTerminos("basic"));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "billing_plan_mismatch");
    }));
    assert.equal(errores[0][0], "pteron flow plan");
    assert.equal(errores[0][1].campo, campo);
    assert.equal(network.calls.some((call) => call.url.includes("/customer/") || (call.url.includes("billing_checkout_intents") && call.method !== "GET")), false, campo);
  }
});

test("checkout exige aceptar los Términos vigentes (400 terms_required) sin tocar el catálogo ni Flow", async () => {
  const network = checkoutNetwork();
  await withFetch(network.fetch, async () => {
    for (const payload of [{ plan: "basic" }, { plan: "basic", acceptedTerms: "true", termsVersion: TERMS_VERSION }, { plan: "basic", acceptedTerms: true, termsVersion: "2026-01-01" }]) {
      const res = await pedirCheckout(payload);
      assert.equal(res.status, 400, JSON.stringify(payload));
      assert.equal((await res.json()).error, "terms_required");
    }
  });
  assert.ok(network.calls.every((call) => call.url.includes("/auth/v1/user")));
});

test("un plan que no está a la venta responde 409 plan_not_for_sale y uno con otra forma, 400", async () => {
  const network = checkoutNetwork({ catalogo: [] });
  await withFetch(network.fetch, async () => {
    for (const plan of ["pro", "oro"]) {
      const res = await pedirCheckout(conTerminos(plan));
      assert.equal(res.status, 409, plan);
      const payload = await res.json();
      assert.equal(payload.error, "plan_not_for_sale");
      assert.equal(payload.message, "Este plan todavía no está a la venta.");
    }
    const raro = await pedirCheckout(conTerminos("x'--"));
    assert.equal(raro.status, 400);
    assert.equal((await raro.json()).error, "invalid_plan");
  });
  assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false);
});

test("un plan sin precio o que no emite licencia tampoco se vende, aunque esté marcado a la venta", async () => {
  for (const catalogo of [{ ...BASIC, monthly_price_clp: 0 }, { ...BASIC, license_plan: null }]) {
    const network = checkoutNetwork({ catalogo: [catalogo] });
    await withFetch(network.fetch, async () => {
      const res = await pedirCheckout(conTerminos("basic"));
      assert.equal(res.status, 409);
    });
  }
});

test("con un plan en curso responde 409 subscription_exists sin tocar Flow", async () => {
  const futuro = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const network = checkoutNetwork({ vigentes: [{ id: "fila-1", plan_id: "basic", status: "active", provider: "flow", provider_subscription_id: "sus_1", cancel_at_period_end: false, current_period_end: futuro }] });
  await withFetch(network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "subscription_exists");
  });
  assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false);
});

test("la prueba es una por persona: quien ya tuvo una suscripción Flow parte sin días gratis", async () => {
  const network = checkoutNetwork({ previas: [{ id: "fila-vieja" }] });
  await withFetch(network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).trialPeriodDays, 0);
  });
  const intent = network.calls.find((call) => call.url.includes("billing_checkout_intents") && call.method === "POST");
  assert.equal(intent.body.trial_days, 0);
});

test("reutiliza el cliente de Flow guardado en billing_customers; los checkouts anteriores no son fuente de clientes", async () => {
  const guardado = checkoutNetwork({ guardado: [{ provider_customer_id: "cus_9" }] });
  await withFetch(guardado.fetch, async () => assert.equal((await pedirCheckout(conTerminos("basic"))).status, 200));
  assert.equal(guardado.calls.some((call) => call.url.includes("/customer/create")), false);
  assert.equal(guardado.calls.some((call) => call.url.includes("billing_customers") && call.method === "POST"), false);
  assert.equal(guardado.calls.find((call) => call.url.includes("billing_checkout_intents") && call.method === "POST").body.provider_customer_id, "cus_9");

  const sinGuardar = checkoutNetwork({ intentosPrevios: [{ provider_customer_id: "cus_8" }] });
  await withFetch(sinGuardar.fetch, async () => assert.equal((await pedirCheckout(conTerminos("basic"))).status, 200));
  assert.equal(sinGuardar.calls.some((call) => call.url.includes("/customer/create")), true);
  assert.deepEqual(sinGuardar.calls.find((call) => call.url.includes("billing_customers") && call.method === "POST").body, { user_id: user.id, provider: "flow", provider_customer_id: "cus_1" });
});

test("recompra tras cancelar al cierre: la fila que ya no da acceso se sincroniza, queda cancelada y la compra sigue sin prueba", async () => {
  // Una prueba de hace un año, cancelada al cierre: lo local quedó en trialing.
  const cancelada = basicEnPrueba({ status: 4, cancel_at_period_end: 1, cancel_at: "2025-10-20 00:00:00", trial_start: "2025-10-13 00:00:00", trial_end: "2025-10-19 00:00:00" });
  const network = checkoutNetwork({
    vigentes: [{ id: "fila-1", plan_id: "basic", status: "trialing", provider: "flow", provider_subscription_id: "sus_basic01", cancel_at_period_end: true, canceled_at: null, current_period_end: "2025-10-20T03:00:00.000Z" }],
    previas: [{ id: "fila-1" }],
    extra: [
      { match: matches.flow("/subscription/get"), respond: { body: cancelada } },
      { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    ],
  });
  await withFetch(network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).trialPeriodDays, 0);
  });
  const sync = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "PATCH");
  assert.equal(sync.body.status, "canceled");
  assert.equal(sync.body.canceled_at, "2025-10-20T03:00:00.000Z");
});

test("en el sitio de producción, Flow de sandbox no cobra (503 billing_misconfigured) salvo FLOW_ALLOW_SANDBOX", async () => {
  const produccion = { ...env, PUBLIC_SITE_URL: "https://pteron.patagua.dev" };
  const network = checkoutNetwork();
  const errores = await registrando(() => withFetch(network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"), produccion);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, "billing_misconfigured");
  }));
  assert.equal(errores[0][0], "pteron flow config");
  assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false);
  // Con FLOW_ALLOW_SANDBOX pasa la guarda; el plan igual debe avisar al sitio de producción.
  const planProduccion = { ...PLAN_BASIC, urlCallback: "https://pteron.patagua.dev/api/billing/flow-callback" };
  await withFetch(checkoutNetwork({ planGet: [{ body: planProduccion }] }).fetch, async () => {
    assert.equal((await pedirCheckout(conTerminos("basic"), { ...produccion, FLOW_ALLOW_SANDBOX: "1" })).status, 200);
  });
});

// ── Retorno de la tarjeta ──────────────────────────────────────────────────

function intentoPendiente(cambios = {}) {
  return {
    id: INTENT,
    user_id: user.id,
    plan_id: "basic",
    provider_customer_id: "cus_1",
    provider_plan_id: "pteron-basic-2990-mensual",
    status: "card_registration_pending",
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    trial_days: 7,
    terms_version: TERMS_VERSION,
    ...cambios,
  };
}

/**
 * Red del retorno con un intento que cambia como en la base: el PATCH
 * condicional sólo reclama un intento pendiente y vigente.
 */
function callbackNetwork({ intent = intentoPendiente(), registrado = registro({ customerId: "cus_1" }), vigentes = [], creada = basicEnPrueba(), creacion = { body: creada }, insertFalla = false, registroFalla = false } = {}) {
  const estado = { ...intent };
  return {
    estado,
    network: fakeNetwork([
      {
        match: matches.supabase("billing_checkout_intents", "PATCH"),
        respond: (call) => {
          if (call.url.includes("status=eq.card_registration_pending")) {
            if (estado.status !== "card_registration_pending" || Date.parse(estado.expires_at) <= Date.now()) return { body: [] };
          } else if (call.url.includes("status=eq.subscription_pending") && estado.status !== "subscription_pending") {
            return { body: [] };
          }
          Object.assign(estado, call.body);
          return { body: [{ ...estado }] };
        },
      },
      { match: matches.supabase("billing_checkout_intents", "GET"), respond: () => ({ body: [{ status: estado.status, expires_at: estado.expires_at }] }) },
      { match: matches.flow("/customer/getRegisterStatus"), respond: registroFalla ? { status: 500, body: { message: "Flow no responde" } } : { body: registrado } },
      { match: matches.supabase("subscriptions", "GET"), respond: { body: vigentes } },
      { match: matches.flow("/subscription/create"), respond: creacion },
      {
        match: matches.supabase("subscriptions", "POST"),
        respond: (call) => (insertFalla
          ? { status: 409, body: { message: 'duplicate key value violates unique constraint "subscriptions_one_current_per_user"' } }
          : { body: [{ id: "fila-1", canceled_at: null, ...call.body }] }),
      },
      { match: matches.flow("/subscription/get"), respond: { body: creada } },
      { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
      { match: matches.flow("/subscription/cancel"), respond: { body: basicEnPrueba({ status: 4 }) } },
      { match: matches.supabase("billing_events", "POST"), respond: { body: [{ id: "evento-1" }] } },
    ]),
  };
}

function retorno(fields = { token: "tok_1" }, intent = INTENT) {
  return run(formRequest(`https://pteron.test/api/billing/card-callback?intent=${intent}`, fields));
}

test("card-callback reclama el intento, crea la suscripción con la prueba del intento, la sincroniza y redirige a la cuenta", async () => {
  const { network, estado } = callbackNetwork();
  await withFetch(network.fetch, async () => {
    const res = await retorno();
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=success");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
  });
  const reclamo = network.calls[0];
  assert.equal(reclamo.method, "PATCH");
  assert.match(decodeURIComponent(reclamo.url), /id=eq\.22222222-2222-4222-8222-222222222222&status=eq\.card_registration_pending&expires_at=gt\./);
  assert.deepEqual(reclamo.body, { status: "subscription_pending" });
  const consulta = network.calls.find((call) => call.url.includes("/customer/getRegisterStatus"));
  assert.equal(consulta.method, "GET");
  assert.match(consulta.url, /[?&]token=tok_1(&|$)/);
  assert.match(consulta.url, /[?&]s=[0-9a-f]{64}(&|$)/);
  const creacion = network.calls.find((call) => call.url.includes("/subscription/create"));
  assert.deepEqual([creacion.body.planId, creacion.body.customerId, creacion.body.trial_period_days], ["pteron-basic-2990-mensual", "cus_1", "7"]);

  const guardaId = network.calls.findIndex((call) => call.url.includes("billing_checkout_intents") && call.body?.provider_subscription_id === "sus_basic01");
  const insert = network.calls.findIndex((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST");
  assert.ok(guardaId >= 0 && guardaId < insert, "el subscriptionId queda en el intento antes de insertar la fila");
  const fila = network.calls[insert].body;
  assert.equal(fila.status, "trialing");
  assert.equal(fila.provider, "flow");
  assert.equal(fila.provider_subscription_id, "sus_basic01");
  assert.equal(fila.provider_plan_id, "pteron-basic-2990-mensual");
  assert.equal(fila.trial_ends_at, "2026-10-20T03:00:00.000Z");
  assert.equal(fila.current_period_end, "2026-10-20T03:00:00.000Z");
  assert.equal(fila.terms_version, TERMS_VERSION);
  assert.equal(fila.last_synced_at, null);
  assert.ok(network.calls.some((call) => call.url.includes("/subscription/get")), "después de crear, se sincroniza con subscription/get");
  const sync = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "PATCH");
  assert.match(sync.body.last_synced_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(estado.status, "completed");
});

test("un doble retorno simultáneo crea una sola suscripción en Flow", async () => {
  const { network } = callbackNetwork();
  await withFetch(network.fetch, async () => {
    const [a, b] = await Promise.all([retorno(), retorno()]);
    const destinos = [a, b].map((res) => res.headers.get("location"));
    assert.ok(destinos.includes("https://pteron.test/cuenta?billing=success"), destinos.join(" "));
    assert.ok(destinos.every((destino) => /billing=(success|processing)$/.test(destino)), destinos.join(" "));
  });
  assert.equal(network.calls.filter((call) => call.url.includes("/subscription/create")).length, 1);
});

test("un registro de tarjeta fallido deja el intento failed y vuelve como cancelado, sin crear nada", async () => {
  const { network, estado } = callbackNetwork({ registrado: registro({ status: "0", customerId: "cus_1" }) });
  await withFetch(network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=cancelled");
  });
  assert.equal(estado.status, "failed");
  assert.equal(network.calls.some((call) => call.url.includes("/subscription/create")), false);
});

test("un registro de otro cliente de Flow o una cuenta con plan vigente no crean otra suscripción", async () => {
  const otro = callbackNetwork({ registrado: registro({ customerId: "cus_otro" }) });
  const errores = await registrando(() => withFetch(otro.network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=error&code=customer_mismatch");
  }));
  assert.equal(errores[0][1].reason, "customer_mismatch");
  assert.equal(otro.estado.status, "failed");
  const vigente = callbackNetwork({ vigentes: [{ id: "fila-0" }] });
  await withFetch(vigente.network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=error&code=subscription_exists");
  });
  for (const { network } of [otro, vigente]) assert.equal(network.calls.some((call) => call.url.includes("/subscription/create")), false);
});

test("un intent que no es uuid vuelve como vencido sin tocar la red, y uno sin token, como error; nunca JSON", async () => {
  await withFetch(async () => { throw new Error("no debe tocar la red"); }, async () => {
    const bogus = await retorno({ token: "tok" }, "x'--");
    assert.equal(bogus.status, 303);
    assert.equal(bogus.headers.get("location"), "https://pteron.test/cuenta?billing=expired");
    const missing = await retorno({});
    assert.equal(missing.status, 303);
    assert.equal(missing.headers.get("location"), "https://pteron.test/cuenta?billing=error&code=invalid_callback");
    assert.equal(missing.headers.get("content-type"), null);
  });
});

test("un intento que ya no se puede reclamar: completed vuelve como éxito aunque haya vencido; vencido, expired; fallido, error", async () => {
  const pasado = new Date(Date.now() - 60_000).toISOString();
  const casos = [
    [{ status: "completed", expires_at: pasado }, "billing=success"],
    [{ status: "card_registration_pending", expires_at: pasado }, "billing=expired"],
    [{ status: "expired" }, "billing=expired"],
    [{ status: "failed" }, "billing=error&code=checkout_failed"],
    [{ status: "subscription_pending" }, "billing=processing"],
  ];
  for (const [cambios, esperado] of casos) {
    const { network } = callbackNetwork({ intent: intentoPendiente(cambios) });
    await withFetch(network.fetch, async () => {
      assert.equal((await retorno()).headers.get("location"), `https://pteron.test/cuenta?${esperado}`, JSON.stringify(cambios));
    });
    assert.equal(network.calls.some((call) => call.url.includes("flow.cl")), false, JSON.stringify(cambios));
  }
});

test("si el insert falla, la suscripción se cancela en Flow en el acto y queda el evento con su subscriptionId", async () => {
  const { network, estado } = callbackNetwork({ insertFalla: true });
  await withFetch(network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=error&code=subscription_failed");
  });
  const cancelacion = network.calls.find((call) => call.url.includes("/subscription/cancel"));
  assert.deepEqual([cancelacion.body.subscriptionId, cancelacion.body.at_period_end], ["sus_basic01", "0"]);
  const evento = network.calls.find((call) => call.url.includes("billing_events"));
  assert.equal(evento.body.event_type, "subscription_creation_failed");
  assert.equal(evento.body.external_event_id, "flow:subscription:sus_basic01:creation_failed");
  assert.deepEqual(evento.body.event_metadata, { intentId: INTENT, subscriptionId: "sus_basic01", canceled: true, error: "supabase_error" });
  assert.equal(estado.status, "failed");
  assert.equal(estado.provider_subscription_id, "sus_basic01");
});

test("si Flow no responde al confirmar la tarjeta, vuelve a la cuenta con el error y libera el intento para reintentar", async () => {
  const { network, estado } = callbackNetwork({ registroFalla: true });
  await withFetch(network.fetch, async () => {
    const res = await retorno();
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "https://pteron.test/cuenta?billing=error&code=flow_error");
  });
  assert.equal(estado.status, "card_registration_pending");
  assert.equal(network.calls.some((call) => call.url.includes("/subscription/create")), false);
});

test("la segunda prueba negada llega a Flow como trial_period_days 0", async () => {
  const sinPrueba = basicEnPrueba({ status: 1, trial_period_days: 0, trial_start: null, trial_end: null, period_start: "2026-10-13 00:00:00", period_end: "2026-11-12 00:00:00", next_invoice_date: "2026-11-13 00:00:00", invoices: [cobroMensual({ id: 2101, desde: "2026-10-13", hasta: "2026-11-12", pagado: true, flowOrder: 9000101 })] });
  const { network } = callbackNetwork({ intent: intentoPendiente({ trial_days: 0 }), creada: sinPrueba });
  await withFetch(network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=success");
  });
  assert.equal(network.calls.find((call) => call.url.includes("/subscription/create")).body.trial_period_days, "0");
  const fila = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST").body;
  assert.equal(fila.status, "active");
  assert.equal(fila.trial_ends_at, null);
  assert.equal(fila.current_period_end, "2026-11-13T03:00:00.000Z");
});

test("un subscription/create sin respuesta (error 5xx o vencimiento) anota subscription_create_uncertain y deja el intento pendiente", async () => {
  const casos = [
    [{ status: 500, body: { message: "Flow no responde" } }, "flow_error"],
    [() => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }, "server_error"],
  ];
  for (const [creacion, codigo] of casos) {
    const { network, estado } = callbackNetwork({ creacion });
    await registrando(() => withFetch(network.fetch, async () => {
      assert.equal((await retorno()).headers.get("location"), `https://pteron.test/cuenta?billing=error&code=${codigo}`);
    }));
    assert.equal(estado.status, "subscription_pending", "pudo quedar creada en Flow: no se libera ni se da por fallida");
    const evento = network.calls.find((call) => call.url.includes("billing_events"));
    assert.deepEqual(evento.body, {
      user_id: user.id,
      external_event_id: `flow:intent:${INTENT}:subscription_create_uncertain`,
      event_type: "subscription_create_uncertain",
      status: "received",
      event_metadata: { intentId: INTENT, customerId: "cus_1", planId: "pteron-basic-2990-mensual" },
    });
    assert.equal(network.calls.some((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST"), false);
  }
  // Un rechazo de Flow (400) sí es seguro: no se creó nada, el intento falla y no hay evento.
  const rechazo = callbackNetwork({ creacion: { status: 400, body: FLOW_ERROR } });
  await registrando(() => withFetch(rechazo.network.fetch, async () => {
    assert.equal((await retorno()).headers.get("location"), "https://pteron.test/cuenta?billing=error&code=flow_error");
  }));
  assert.equal(rechazo.estado.status, "failed");
  assert.equal(rechazo.network.calls.some((call) => call.url.includes("billing_events")), false);
});

// ── Conciliar los checkouts inciertos ──────────────────────────────────────

const haceMinutos = (minutos) => new Date(Date.now() - minutos * 60_000).toISOString();
const HUERFANA = basicEnPrueba({ subscriptionId: "sus_huerfana", created: "2026-10-13 15:20:00" });

/**
 * Supabase y Flow con estado: los intentos y las filas cambian como en la base
 * (el filtro por status, updated_at y user_id lo aplica el mock) y Flow lista
 * `enFlow` como las suscripciones del cliente. `carrera` es una fila que otra
 * conciliación anota justo antes del insert, que entonces falla por duplicado.
 */
function conciliacionNetwork({ intentos = [], filas = [], enFlow = [], lista = null, carrera = null } = {}) {
  const intents = intentos.map((intent) => ({ ...intent }));
  const subs = filas.map((fila) => ({ ...fila }));
  const eventos = [];
  const param = (call, nombre) => new URL(call.url).searchParams.get(nombre)?.replace(/^(eq|lt)\./, "") ?? null;
  const listaFlow = lista ?? { body: { total: enFlow.length, hasMore: false, data: enFlow } };
  let carreraPendiente = carrera;
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("plan_catalog"), respond: { body: [BASIC] } },
    {
      match: matches.supabase("billing_checkout_intents", "GET"),
      respond: (call) => {
        const [status, antes, usuario] = ["status", "updated_at", "user_id"].map((nombre) => param(call, nombre));
        return { body: intents.filter((intent) => (!status || intent.status === status) && (!antes || Date.parse(intent.updated_at) < Date.parse(antes)) && (!usuario || intent.user_id === usuario)).map((intent) => ({ ...intent })) };
      },
    },
    {
      match: matches.supabase("billing_checkout_intents", "PATCH"),
      respond: (call) => {
        const [id, status] = [param(call, "id"), param(call, "status")];
        const intent = intents.find((fila) => fila.id === id && (!status || fila.status === status));
        if (!intent) return { body: [] };
        Object.assign(intent, call.body, { updated_at: new Date().toISOString() });
        return { body: [{ ...intent }] };
      },
    },
    {
      match: matches.supabase("subscriptions", "GET"),
      respond: (call) => {
        const ids = [...(new URL(call.url).searchParams.get("provider_subscription_id") ?? "").matchAll(/"([^"]+)"/g)].map(([, id]) => id);
        const unico = /^eq\./.test(new URL(call.url).searchParams.get("provider_subscription_id") ?? "") ? param(call, "provider_subscription_id") : null;
        const estados = /^in\.\((.*)\)$/.exec(new URL(call.url).searchParams.get("status") ?? "")?.[1].split(",");
        const usuario = param(call, "user_id");
        return { body: subs.filter((fila) => (!ids.length || ids.includes(fila.provider_subscription_id)) && (!unico || unico === fila.provider_subscription_id) && (!estados || estados.includes(fila.status)) && (!usuario || fila.user_id === usuario)) };
      },
    },
    {
      match: matches.supabase("subscriptions", "POST"),
      respond: (call) => {
        if (carreraPendiente) {
          subs.push({ id: "fila-carrera", ...carreraPendiente });
          carreraPendiente = null;
        }
        if (subs.some((fila) => fila.provider_subscription_id === call.body.provider_subscription_id)) {
          return { status: 409, body: { message: 'duplicate key value violates unique constraint "subscriptions_provider_subscription_id_key"' } };
        }
        const fila = { id: `fila-${subs.length + 1}`, canceled_at: null, ...call.body };
        subs.push(fila);
        return { body: [{ ...fila }] };
      },
    },
    { match: matches.supabase("subscriptions", "PATCH"), respond: (call) => ({ body: param(call, "id") ? [{ id: param(call, "id") }] : [] }) },
    { match: matches.supabase("billing_events", "POST"), respond: (call) => { eventos.push(call.body); return { body: [{ id: "evento-1" }] }; } },
    // Lo que el checkout sigue necesitando si la conciliación lo deja pasar.
    { match: matches.supabase("billing_customers", "GET"), respond: { body: [{ provider_customer_id: "cus_1" }] } },
    {
      match: matches.supabase("billing_checkout_intents", "POST"),
      respond: (call) => {
        const intent = { id: "55555555-5555-4555-8555-555555555555", updated_at: new Date().toISOString(), ...call.body };
        intents.push(intent);
        return { body: [{ ...intent }] };
      },
    },
    { match: matches.flow("/plans/get"), respond: { body: PLAN_BASIC } },
    { match: matches.flow("/customer/register"), respond: { body: REGISTER } },
    { match: matches.flow("/customer/getSubscriptions"), respond: listaFlow },
    {
      match: matches.flow("/subscription/get"),
      respond: (call) => {
        const encontrada = enFlow.find((s) => call.url.includes(`subscriptionId=${s.subscriptionId}`));
        return encontrada ? { body: encontrada } : { status: 400, body: FLOW_ERROR };
      },
    },
  ]);
  return { network, intents, subs, eventos };
}

/** El intento de una compra que Flow pudo haber creado sin avisar: reclamado hace `minutos`. */
const intentoIncierto = (minutos = 15, cambios = {}) => intentoPendiente({ status: "subscription_pending", updated_at: haceMinutos(minutos), ...cambios });

test("conciliar adopta la suscripción de Flow que la base no conoce: fila con la primera sincronización, intento completado y evento", async () => {
  const canceladaAntes = basicEnPrueba({ subscriptionId: "sus_vieja", status: 4, created: "2026-09-01 10:00:00" });
  const deOtroPlan = basicEnPrueba({ subscriptionId: "sus_otroplan", planId: "pteron-pro-9990-mensual", created: "2026-10-13 16:00:00" });
  const yaAnotada = basicEnPrueba({ subscriptionId: "sus_anotada", created: "2026-10-01 10:00:00" });
  const world = conciliacionNetwork({
    intentos: [intentoIncierto()],
    filas: [{ id: "fila-0", user_id: "otro-usuario", status: "canceled", provider_subscription_id: "sus_anotada" }],
    enFlow: [canceladaAntes, yaAnotada, HUERFANA, deOtroPlan],
  });
  await withFetch(world.network.fetch, async () => {
    assert.deepEqual(await reconcilePendingCheckouts(testServices(env), { now: new Date() }), { conciliados: 1, sinSuscripcion: 0, pendientes: 0 });
  });
  const lista = world.network.calls.find((call) => call.url.includes("/customer/getSubscriptions"));
  assert.equal(lista.method, "GET");
  assert.match(lista.url, /[?&]customerId=cus_1(&|$)/);
  assert.match(lista.url, /[?&]start=0(&|$)/);
  assert.match(lista.url, /[?&]limit=100(&|$)/);
  assert.match(lista.url, /[?&]s=[0-9a-f]{64}(&|$)/);
  const insert = world.network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST").body;
  assert.deepEqual([insert.user_id, insert.plan_id, insert.provider, insert.provider_customer_id, insert.provider_subscription_id, insert.terms_version], [user.id, "basic", "flow", "cus_1", "sus_huerfana", TERMS_VERSION]);
  assert.equal(insert.status, "trialing");
  assert.equal(insert.last_synced_at, null);
  assert.ok(world.network.calls.some((call) => call.url.includes("/subscription/get") && call.url.includes("sus_huerfana")), "la primera sincronización");
  assert.deepEqual([world.intents[0].status, world.intents[0].provider_subscription_id], ["completed", "sus_huerfana"]);
  // Sin correo configurado, la confirmación de compra sólo deja su evento *_email_skipped.
  const [omitido, ...demas] = world.eventos;
  assert.deepEqual([omitido.event_type, omitido.status, omitido.user_id], ["purchase_email_skipped", "ignored", user.id]);
  assert.deepEqual(demas, [{
    user_id: user.id,
    external_event_id: `flow:intent:${INTENT}:subscription_reconciled`,
    event_type: "subscription_reconciled",
    status: "processed",
    event_metadata: { intentId: INTENT, subscriptionId: "sus_huerfana", customerId: "cus_1", planId: "pteron-basic-2990-mensual" },
  }]);
  const seleccion = decodeURIComponent(world.network.calls[0].url);
  assert.match(seleccion, /status=eq\.subscription_pending&updated_at=lt\./);
  assert.match(seleccion, /limit=20$/);
});

test("conciliar elige la suscripción más nueva y deja constancia cuando hay más de una; la lista de Flow también puede venir como texto JSON", async () => {
  const nueva = basicEnPrueba({ subscriptionId: "sus_nueva", created: "2026-10-13 15:25:00" });
  const world = conciliacionNetwork({
    intentos: [intentoIncierto()],
    enFlow: [HUERFANA, nueva],
    lista: { body: { total: 2, hasMore: 0, data: JSON.stringify([HUERFANA, nueva]) } },
  });
  const errores = await registrando(() => withFetch(world.network.fetch, async () => {
    assert.equal((await reconcilePendingCheckouts(testServices(env), { now: new Date() })).conciliados, 1);
  }));
  assert.equal(world.subs[0].provider_subscription_id, "sus_nueva");
  const aviso = errores.find(([etiqueta, detalle]) => etiqueta === "pteron reconcile" && detalle.reason === "several_subscriptions");
  assert.deepEqual(aviso[1].subscriptions, ["sus_nueva", "sus_huerfana"]);
});

test("conciliar sin ninguna suscripción de Flow para ese plan falla el intento y deja el evento, para que la persona pueda comprar de nuevo", async () => {
  const world = conciliacionNetwork({
    intentos: [intentoIncierto()],
    enFlow: [basicEnPrueba({ subscriptionId: "sus_vieja", status: 4 }), basicEnPrueba({ subscriptionId: "sus_otroplan", planId: "pteron-pro-9990-mensual" })],
  });
  await withFetch(world.network.fetch, async () => {
    assert.deepEqual(await reconcilePendingCheckouts(testServices(env), { now: new Date() }), { conciliados: 0, sinSuscripcion: 1, pendientes: 0 });
  });
  assert.equal(world.intents[0].status, "failed");
  assert.equal(world.network.calls.some((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST"), false);
  assert.deepEqual(world.eventos, [{
    user_id: user.id,
    external_event_id: `flow:intent:${INTENT}:subscription_create_not_found`,
    event_type: "subscription_create_not_found",
    status: "processed",
    event_metadata: { intentId: INTENT, customerId: "cus_1", planId: "pteron-basic-2990-mensual" },
  }]);
});

test("conciliar no toca los intentos de menos de 10 minutos, que pueden seguir dentro de un card-callback, ni los de otros estados", async () => {
  const world = conciliacionNetwork({
    intentos: [intentoIncierto(5), intentoIncierto(30, { id: "33333333-3333-4333-8333-333333333333", status: "card_registration_pending" })],
    enFlow: [HUERFANA],
  });
  await withFetch(world.network.fetch, async () => {
    const antes = Date.now();
    assert.deepEqual(await reconcilePendingCheckouts(testServices(env), { now: new Date(antes) }), { conciliados: 0, sinSuscripcion: 0, pendientes: 0 });
    const seleccion = decodeURIComponent(world.network.calls[0].url);
    assert.ok(seleccion.includes(`updated_at=lt.${new Date(antes - 10 * 60_000).toISOString()}`), seleccion);
  });
  assert.deepEqual(world.network.calls.map((call) => call.method), ["GET"], "ni Flow ni ninguna escritura");
  assert.deepEqual(world.intents.map((intent) => intent.status), ["subscription_pending", "card_registration_pending"]);
});

test("conciliar filtra por cuenta cuando se le pide y deja los intentos de otras cuentas", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto(), intentoIncierto(20, { id: "44444444-4444-4444-8444-444444444444", user_id: "otro-usuario" })], enFlow: [] });
  await withFetch(world.network.fetch, async () => {
    assert.equal((await reconcilePendingCheckouts(testServices(env), { now: new Date(), userId: user.id })).sinSuscripcion, 1);
  });
  assert.match(world.network.calls[0].url, new RegExp(`user_id=eq\\.${user.id}`));
  assert.deepEqual(world.intents.map((intent) => intent.status), ["failed", "subscription_pending"]);
});

test("si Flow falla o devuelve una lista ilegible, el intento sigue pendiente y no se inventa que la suscripción no existe", async () => {
  const casos = [
    { status: 500, body: { message: "Flow no responde" } },
    { body: { total: 1, hasMore: false, data: "no es json" } },
    { body: { total: 1, hasMore: false } },
  ];
  for (const lista of casos) {
    const world = conciliacionNetwork({ intentos: [intentoIncierto()], lista });
    const errores = await registrando(() => withFetch(world.network.fetch, async () => {
      assert.deepEqual(await reconcilePendingCheckouts(testServices(env), { now: new Date() }), { conciliados: 0, sinSuscripcion: 0, pendientes: 1 });
    }));
    assert.equal(world.intents[0].status, "subscription_pending", JSON.stringify(lista));
    assert.equal(errores[0][0], "pteron reconcile");
    assert.equal(world.eventos.length, 0);
  }
  // Una lista con más páginas de las que se leen tampoco prueba que no exista.
  const larga = conciliacionNetwork({ intentos: [intentoIncierto()], lista: { body: { total: 150, hasMore: 1, data: [] } } });
  await registrando(() => withFetch(larga.network.fetch, async () => {
    assert.equal((await reconcilePendingCheckouts(testServices(env), { now: new Date() })).pendientes, 1);
  }));
  assert.equal(larga.intents[0].status, "subscription_pending");
});

test("si otra conciliación ya anotó la suscripción (provider_subscription_id es único), no es un error: el intento se completa", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto()], enFlow: [HUERFANA], carrera: { user_id: user.id, status: "trialing", provider_subscription_id: "sus_huerfana" } });
  await withFetch(world.network.fetch, async () => {
    assert.deepEqual(await reconcilePendingCheckouts(testServices(env), { now: new Date() }), { conciliados: 1, sinSuscripcion: 0, pendientes: 0 });
  });
  assert.equal(world.intents[0].status, "completed");
  assert.equal(world.subs.length, 1);
});

test("un intento cuya suscripción ya quedó anotada y sólo faltó cerrar se completa sin crear otra fila", async () => {
  const world = conciliacionNetwork({
    intentos: [intentoIncierto(15, { provider_subscription_id: "sus_huerfana" })],
    filas: [{ id: "fila-1", user_id: user.id, status: "trialing", provider_subscription_id: "sus_huerfana" }],
    enFlow: [HUERFANA],
  });
  await withFetch(world.network.fetch, async () => {
    assert.equal((await reconcilePendingCheckouts(testServices(env), { now: new Date() })).conciliados, 1);
  });
  assert.equal(world.intents[0].status, "completed");
  assert.equal(world.network.calls.some((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST"), false);
});

test("checkout con un intento reciente en subscription_pending responde 409 checkout_pending y no le pide nada a Flow", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto(2)], enFlow: [HUERFANA] });
  await withFetch(world.network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 409);
    const payload = await res.json();
    assert.equal(payload.error, "checkout_pending");
    assert.equal(payload.message, "Tu compra anterior todavía se está confirmando con Flow. Vuelve a intentarlo en unos minutos.");
  });
  assert.equal(world.network.calls.some((call) => call.url.includes("flow.cl")), false);
  assert.equal(world.network.calls.some((call) => call.method !== "GET" && !call.url.includes("/auth/")), false, "no se escribe nada");
});

test("checkout con un intento incierto de hace más de 10 minutos que Flow no puede confirmar sigue en 409 checkout_pending", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto(20)], lista: { status: 500, body: { message: "Flow no responde" } } });
  await registrando(() => withFetch(world.network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "checkout_pending");
  }));
  assert.equal(world.network.calls.some((call) => call.url.includes("/customer/register") || call.url.includes("/subscription/create")), false);
  assert.equal(world.intents[0].status, "subscription_pending");
});

test("checkout concilia primero: adopta la suscripción de Flow y responde 409 subscription_exists, sin segunda suscripción ni segunda prueba", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto(20)], enFlow: [HUERFANA] });
  await withFetch(world.network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "subscription_exists");
    assert.equal(world.subs.length, 1);
    assert.equal(world.subs[0].provider_subscription_id, "sus_huerfana");
    assert.equal(world.intents[0].status, "completed");
    assert.equal(await trialEligible(testServices(env).supabase, user.id), false, "la prueba ya se usó en esa suscripción");
  });
  assert.equal(world.network.calls.some((call) => call.url.includes("/customer/register") || call.url.includes("/subscription/create") || (call.url.includes("billing_checkout_intents") && call.method === "POST")), false);
});

test("checkout concilia primero: sin suscripción en Flow el intento falla y la compra sigue como nueva, con su prueba", async () => {
  const world = conciliacionNetwork({ intentos: [intentoIncierto(20)], enFlow: [] });
  await withFetch(world.network.fetch, async () => {
    const res = await pedirCheckout(conTerminos("basic"));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).trialPeriodDays, 7, "no hubo suscripción: la prueba sigue disponible");
  });
  assert.equal(world.intents[0].status, "failed");
  assert.equal(world.intents.length, 2);
  assert.equal(world.intents[1].status, "card_registration_pending");
});

test("el Cron concilia los checkouts inciertos y suma sus cuentas al resumen", async () => {
  const world = conciliacionNetwork({
    intentos: [intentoIncierto(30), intentoIncierto(40, { id: "66666666-6666-4666-8666-666666666666", user_id: "otro-usuario", provider_customer_id: "cus_2" })],
    enFlow: [HUERFANA],
    lista: { body: { total: 1, hasMore: false, data: [HUERFANA] } },
  });
  await withFetch(world.network.fetch, async () => {
    const ctx = fakeExecution();
    await worker.scheduled({ cron: "17 12 * * *", scheduledTime: Date.now() }, env, ctx);
    const resumen = await ctx.promises[0];
    // El mismo cliente de la lista adopta la suscripción del primero; al segundo ya no le queda ninguna sin anotar.
    assert.deepEqual([resumen.checkoutsConciliados, resumen.checkoutsSinSuscripcion, resumen.checkoutsPendientes], [1, 1, 0]);
  });
  assert.deepEqual(world.intents.map((intent) => intent.status), ["completed", "failed"]);
  assert.match(decodeURIComponent(world.network.calls.find((call) => call.url.includes("updated_at=lt.")).url), /status=eq\.subscription_pending&updated_at=lt\.[^&]+&select=[^&]+&order=updated_at\.asc&limit=20$/, "todas las cuentas: sin user_id");
});

// ── Aviso de pago y cancelación ────────────────────────────────────────────

function avisoNetwork({ previo = [], filas = [{ id: "fila-1", user_id: user.id, provider_subscription_id: "sus_basic01", canceled_at: null }], flowGet = { body: basicEnPrueba({ status: 1, invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: true, flowOrder: 9000001 })] }) } } = {}) {
  return fakeNetwork([
    { match: matches.flow("/payment/getStatus"), respond: { body: pago({ flowOrder: 9000001, commerceOrder: "2001", requestDate: "2026-10-20 00:05:00", status: 2, subject: "pteron Basic - período 2026-10-20 / 2026-11-19", amount: 2990, payer: "Profe@Escuela.cl" }) } },
    { match: matches.supabase("billing_events", "GET"), respond: { body: previo } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: filas } },
    { match: matches.flow("/subscription/get"), respond: flowGet },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    { match: matches.supabase("billing_events", "POST"), respond: { body: [{ id: "evento-1" }] } },
  ]);
}

function aviso() {
  return run(formRequest("https://pteron.test/api/billing/flow-callback", { token: "tok_pay" }));
}

test("flow-callback lee el pago con los campos oficiales, sincroniza las suscripciones cerca de ahora y registra el aviso", async () => {
  const network = avisoNetwork();
  await withFetch(network.fetch, async () => {
    const res = await aviso();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
  const estado = network.calls.find((call) => call.url.includes("/payment/getStatus"));
  assert.equal(estado.method, "GET");
  assert.match(estado.url, /[?&]token=tok_pay(&|$)/);
  assert.ok(network.calls.some((call) => call.url.includes("/subscription/get")), "lo que mueve la fila es subscription/get");
  const sync = network.calls.find((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "PATCH");
  assert.equal(sync.body.status, "active");
  assert.equal(sync.body.current_period_end, "2026-11-20T03:00:00.000Z");
  const evento = network.calls.find((call) => call.url.includes("billing_events") && call.method === "POST");
  assert.match(evento.url, /on_conflict=external_event_id/);
  assert.deepEqual(evento.body.event_metadata, {
    flowOrder: 9000001,
    commerceOrder: "2001",
    status: 2,
    amount: 2990,
    payerHash: await sha256Hex("profe@escuela.cl"),
    synced: 1,
    failed: 0,
  });
  assert.equal(evento.body.external_event_id, "flow:payment:9000001:2");
  assert.equal(evento.body.event_type, "flow_payment_callback");
  assert.equal(evento.body.status, "processed");
  assert.equal(evento.body.user_id, user.id, "la cuenta se reconoce por el flowOrder de su factura");
});

test("un aviso ya procesado no vuelve a sincronizar; sin filas queda ignored y con una sincronización fallida, failed", async () => {
  const repetido = avisoNetwork({ previo: [{ status: "processed" }] });
  await withFetch(repetido.fetch, async () => assert.equal((await aviso()).status, 200));
  assert.equal(repetido.calls.some((call) => call.url.includes("/rest/v1/subscriptions")), false);

  const vacio = avisoNetwork({ filas: [] });
  await withFetch(vacio.fetch, async () => assert.equal((await aviso()).status, 200));
  assert.equal(vacio.calls.find((call) => call.url.includes("billing_events") && call.method === "POST").body.status, "ignored");

  const caido = avisoNetwork({ previo: [{ status: "failed" }], flowGet: { status: 500, body: { message: "Flow no responde" } } });
  await registrando(() => withFetch(caido.fetch, async () => assert.equal((await aviso()).status, 200)));
  const evento = caido.calls.find((call) => call.url.includes("billing_events") && call.method === "POST").body;
  assert.equal(evento.status, "failed");
  assert.equal(evento.user_id, null);
});

test("flow-callback exige token y, si Flow no confirma el pago, responde error para que el aviso se repita", async () => {
  const sinToken = await run(formRequest("https://pteron.test/api/billing/flow-callback", {}));
  assert.equal(sinToken.status, 400);
  assert.equal((await sinToken.json()).error, "invalid_callback");
  const network = fakeNetwork([{ match: matches.flow("/payment/getStatus"), respond: { status: 401, body: FLOW_ERROR } }]);
  await withFetch(network.fetch, async () => {
    const res = await aviso();
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, "flow_error");
  });
});

test("cancel pide a Flow cancelar al cierre, lo anota y sincroniza la fila", async () => {
  const alCierre = basicEnPrueba({ cancel_at_period_end: 1 });
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "fila-1", provider_subscription_id: "sus_basic01", provider_plan_id: "pteron-basic-2990-mensual", canceled_at: null, current_period_end: "2026-10-20T03:00:00.000Z" }] } },
    { match: matches.flow("/subscription/cancel"), respond: { body: alCierre } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    { match: matches.flow("/subscription/get"), respond: { body: alCierre } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await run(jsonRequest("https://pteron.test/api/billing/cancel", {}, { headers: { authorization: "Bearer sesion" } }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, cancelAt: "2026-10-20T03:00:00.000Z" });
  });
  const cancelacion = network.calls.find((call) => call.url.includes("/subscription/cancel"));
  assert.deepEqual([cancelacion.body.subscriptionId, cancelacion.body.at_period_end], ["sus_basic01", "1"]);
  const patches = network.calls.filter((call) => call.method === "PATCH").map((call) => call.body);
  assert.deepEqual(patches[0], { cancel_at_period_end: true });
  assert.equal(patches[1].cancel_at_period_end, true, "la sincronización confirma lo que dijo Flow");
  assert.equal(patches[1].provider_status, 2);
});
