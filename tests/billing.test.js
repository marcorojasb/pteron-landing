import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { sha256Hex } from "../src/lib/crypto.js";
import { TERMS_VERSION } from "../src/lib/terms.js";
import { fakeExecution, fakeNetwork, formRequest, jsonRequest, matches, testEnv, withFetch } from "./helpers/fakes.js";
import { FLOW_ERROR, REGISTER, basicEnPrueba, cliente, cobroMensual, pago, planFlow, registro } from "./helpers/flow-fixtures.js";

const env = testEnv({
  FLOW_API_KEY: "flow-api",
  FLOW_SECRET_KEY: "flow-secret",
  FLOW_BASE_URL: "https://sandbox.flow.cl/api",
  FLOW_BASIC_PLAN_ID: "pteron-basic-1990-mensual",
  FLOW_PRO_PLAN_ID: "pteron-pro-monthly",
});
const user = { id: "11111111-1111-4111-8111-111111111111", email: "profe@escuela.cl", user_metadata: { full_name: "Profe Uno" } };
const INTENT = "22222222-2222-4222-8222-222222222222";
const CALLBACK = "https://pteron.test/api/billing/flow-callback";
const BASIC = { id: "basic", display_name: "Basic", monthly_price_clp: 1990, trial_period_days: 7, license_plan: "basic" };
const PLAN_BASIC = planFlow({ planId: "pteron-basic-1990-mensual", name: "pteron Basic", amount: 1990, created: "2026-10-13 10:00:00", trial_period_days: 7, periods_number: 0, urlCallback: CALLBACK });

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
 * `previas`, las suscripciones Flow que la cuenta ya tuvo (deciden la prueba).
 */
function checkoutNetwork({ catalogo = [BASIC], vigentes = [], previas = [], guardado = [], intentosPrevios = [], planGet = [{ body: PLAN_BASIC }], extra = [] } = {}) {
  let lecturasPlan = 0;
  return fakeNetwork([
    ...extra,
    { match: matches.auth("user"), respond: { body: user } },
    { match: matches.supabase("plan_catalog"), respond: { body: catalogo } },
    { match: (url, m) => m === "GET" && url.includes("/rest/v1/subscriptions") && url.includes("provider=eq.flow"), respond: { body: previas } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: vigentes } },
    { match: matches.supabase("billing_customers", "GET"), respond: { body: guardado } },
    { match: matches.supabase("billing_customers", "POST"), respond: { body: [{ user_id: user.id }] } },
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
    assert.match(lectura.url, /[?&]planId=pteron-basic-1990-mensual(&|$)/);
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
      provider_plan_id: "pteron-basic-1990-mensual",
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
      { planId: "pteron-basic-1990-mensual", name: "pteron Basic", currency: "CLP", amount: "1990", interval: "3", interval_count: "1", trial_period_days: "7", days_until_due: "3", urlCallback: CALLBACK },
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
    assert.equal(network.calls.some((call) => call.url.includes("/customer/") || call.url.includes("billing_checkout_intents")), false, campo);
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

test("reutiliza el cliente de Flow de la cuenta, también el que sólo quedó en un checkout anterior", async () => {
  const guardado = checkoutNetwork({ guardado: [{ provider_customer_id: "cus_9" }] });
  await withFetch(guardado.fetch, async () => assert.equal((await pedirCheckout(conTerminos("basic"))).status, 200));
  assert.equal(guardado.calls.some((call) => call.url.includes("/customer/create")), false);
  assert.equal(guardado.calls.some((call) => call.url.includes("billing_customers") && call.method === "POST"), false);
  assert.equal(guardado.calls.find((call) => call.url.includes("billing_checkout_intents") && call.method === "POST").body.provider_customer_id, "cus_9");

  const heredado = checkoutNetwork({ intentosPrevios: [{ provider_customer_id: "cus_8" }] });
  await withFetch(heredado.fetch, async () => assert.equal((await pedirCheckout(conTerminos("basic"))).status, 200));
  assert.equal(heredado.calls.some((call) => call.url.includes("/customer/create")), false);
  assert.deepEqual(heredado.calls.find((call) => call.url.includes("billing_customers") && call.method === "POST").body, { user_id: user.id, provider: "flow", provider_customer_id: "cus_8" });
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
    provider_plan_id: "pteron-basic-1990-mensual",
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
function callbackNetwork({ intent = intentoPendiente(), registrado = registro({ customerId: "cus_1" }), vigentes = [], creada = basicEnPrueba(), insertFalla = false, registroFalla = false } = {}) {
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
      { match: matches.flow("/subscription/create"), respond: { body: creada } },
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
  assert.deepEqual([creacion.body.planId, creacion.body.customerId, creacion.body.trial_period_days], ["pteron-basic-1990-mensual", "cus_1", "7"]);

  const guardaId = network.calls.findIndex((call) => call.url.includes("billing_checkout_intents") && call.body?.provider_subscription_id === "sus_basic01");
  const insert = network.calls.findIndex((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "POST");
  assert.ok(guardaId >= 0 && guardaId < insert, "el subscriptionId queda en el intento antes de insertar la fila");
  const fila = network.calls[insert].body;
  assert.equal(fila.status, "trialing");
  assert.equal(fila.provider, "flow");
  assert.equal(fila.provider_subscription_id, "sus_basic01");
  assert.equal(fila.provider_plan_id, "pteron-basic-1990-mensual");
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

// ── Aviso de pago y cancelación ────────────────────────────────────────────

function avisoNetwork({ previo = [], filas = [{ id: "fila-1", user_id: user.id, provider_subscription_id: "sus_basic01", canceled_at: null }], flowGet = { body: basicEnPrueba({ status: 1, invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: true, flowOrder: 9000001 })] }) } } = {}) {
  return fakeNetwork([
    { match: matches.flow("/payment/getStatus"), respond: { body: pago({ flowOrder: 9000001, commerceOrder: "2001", requestDate: "2026-10-20 00:05:00", status: 2, subject: "pteron Basic - período 2026-10-20 / 2026-11-19", amount: 1990, payer: "Profe@Escuela.cl" }) } },
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
    amount: 1990,
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
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "fila-1", provider_subscription_id: "sus_basic01", provider_plan_id: "pteron-basic-1990-mensual", canceled_at: null, current_period_end: "2026-10-20T03:00:00.000Z" }] } },
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
