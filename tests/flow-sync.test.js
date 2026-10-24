import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { HttpError } from "../src/lib/http.js";
import { createFlow, flowRejected, readInvoice, readPaymentStatus, readPlan, readRegisterResult, readSubscription } from "../src/lib/flow.js";
import { estadoLocal, inicioDelDiaChile, leerFechaFlow, pagadoHasta, syncAfterPayment, syncDueSubscriptions, syncFlowSubscription, valoresDesdeFlow } from "../src/lib/flow-sync.js";
import { fakeExecution, fakeNetwork, matches, testEnv, testServices, withFetch } from "./helpers/fakes.js";
import { CUSTOMER, INVOICE, PAYMENT_STATUS, PLAN, REGISTER_RESULT, SUBSCRIPTION, basicEnPrueba, cobroMensual, conCampos, factura, soloDocumentados, suscripcion } from "./helpers/flow-fixtures.js";

const env = testEnv({ FLOW_API_KEY: "flow-api", FLOW_SECRET_KEY: "flow-secret", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });

/** La suscripción ya cobrada: el primer mes (20-oct al 19-nov) pagado. */
function basicCobrada(cambios = {}) {
  return basicEnPrueba({
    status: 1,
    period_start: "2026-10-20 00:00:00",
    period_end: "2026-11-19 00:00:00",
    next_invoice_date: "2026-11-20 00:00:00",
    invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: true, flowOrder: 9000001 })],
    ...cambios,
  });
}

test("los lectores leen sólo campos del esquema oficial de Flow y normalizan sus números", () => {
  const s = readSubscription(soloDocumentados(SUBSCRIPTION));
  assert.equal(s.subscriptionId, "sus_azcyjj9ycd");
  assert.equal(s.status, 1);
  assert.equal(s.trial_end, "2018-06-26 00:00:00");
  assert.equal(s.cancel_at, null);
  assert.equal(s.trial_period_days, 1);
  assert.equal(s.created, "2018-06-26 17:29:06");
  assert.deepEqual(s.invoices, [{
    id: 1034,
    status: 0,
    period_start: "2018-06-27 00:00:00",
    period_end: "2018-07-26 00:00:00",
    paymentLink: INVOICE.paymentLink,
    payment: { flowOrder: 3567899 },
  }]);
  assert.equal(readInvoice(soloDocumentados(INVOICE)).payment.flowOrder, PAYMENT_STATUS.flowOrder);
  const plan = readPlan(soloDocumentados(PLAN));
  assert.deepEqual([plan.amount, plan.currency, plan.interval, plan.interval_count, plan.status], [20000, "CLP", 3, 1, 1]);
  assert.deepEqual(readPaymentStatus(soloDocumentados(PAYMENT_STATUS)), { flowOrder: 3567899, commerceOrder: "sf12377", status: 1, amount: 12000, payer: "pperez@gamil.com" });
  // RegisterResult trae el estado como texto ('1').
  assert.deepEqual(readRegisterResult(soloDocumentados(REGISTER_RESULT)), { status: 1, customerId: "cus_onoolldvec" });
  // Los ejemplos no admiten campos nuevos: así ninguna prueba vuelve a simular uno inventado.
  assert.throws(() => conCampos(PAYMENT_STATUS, { subscriptionId: "sus_1" }), /no trae el campo subscriptionId/);
  assert.throws(() => soloDocumentados(CUSTOMER).customer_id, /no está en el esquema de Flow/);
});

test("las fechas de Flow son del calendario de Chile: medianoche en verano (UTC-3) y en invierno (UTC-4)", () => {
  assert.equal(inicioDelDiaChile("2026-10-20").toISOString(), "2026-10-20T03:00:00.000Z");
  assert.equal(inicioDelDiaChile("2026-06-15 00:00:00").toISOString(), "2026-06-15T04:00:00.000Z");
  // 5-sep, todavía invierno; el 6 el reloj salta de 00:00 a 01:00 y el día empieza a las 04:00Z.
  assert.equal(inicioDelDiaChile("2026-09-05").toISOString(), "2026-09-05T04:00:00.000Z");
  assert.equal(inicioDelDiaChile("2026-09-06").toISOString(), "2026-09-06T04:00:00.000Z");
  assert.equal(inicioDelDiaChile("2026-09-07").toISOString(), "2026-09-07T03:00:00.000Z");
  // 4-abr, último día de verano; el 5 el reloj vuelve de 00:00 a 23:00 del 4.
  assert.equal(inicioDelDiaChile("2026-04-04").toISOString(), "2026-04-04T03:00:00.000Z");
  assert.equal(inicioDelDiaChile("2026-04-05").toISOString(), "2026-04-05T04:00:00.000Z");
  for (const malo of ["2026-02-30", "2026-10-20 25:00:00", "20-10-2026", "", null]) assert.equal(inicioDelDiaChile(malo), null, String(malo));
  assert.deepEqual(leerFechaFlow("2026-10-19 17:29:06"), { year: 2026, month: 10, day: 19, hour: 17, minute: 29, second: 6 });
});

test("sin datos de zona horaria el inicio del día cae a las 04:00Z, nunca antes de la medianoche de Chile", () => {
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = () => {
    throw new RangeError("sin datos de zona");
  };
  try {
    assert.equal(inicioDelDiaChile("2026-10-20").toISOString(), "2026-10-20T04:00:00.000Z");
    assert.equal(inicioDelDiaChile("2026-06-15").toISOString(), "2026-06-15T04:00:00.000Z");
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = original;
  }
});

test("pagado hasta: el fin inclusivo de la última factura pagada; en prueba, el fin de la prueba; nada sin ninguno", () => {
  assert.equal(pagadoHasta(readSubscription(basicEnPrueba())).toISOString(), "2026-10-20T03:00:00.000Z");
  assert.equal(pagadoHasta(readSubscription(basicCobrada())).toISOString(), "2026-11-20T03:00:00.000Z");
  const dosMeses = basicCobrada({
    invoices: [
      cobroMensual({ id: 2002, desde: "2026-11-20", hasta: "2026-12-19", pagado: true, flowOrder: 9000003 }),
      cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: true, flowOrder: 9000001 }),
      cobroMensual({ id: 2003, desde: "2026-12-20", hasta: "2027-01-19", pagado: false, flowOrder: 9000004 }),
    ],
  });
  assert.equal(pagadoHasta(readSubscription(dosMeses)).toISOString(), "2026-12-20T03:00:00.000Z", "lo impago no cuenta");
  // Un Pro sin prueba antes de su primer cobro: todavía nada pagado.
  const pro = suscripcion({ status: 1, trial_period_days: 0, trial_start: null, trial_end: null, invoices: [factura({ status: 0 })] });
  assert.equal(pagadoHasta(readSubscription(pro)), null);
  // Sin prueba (trial_period_days 0) las fechas de prueba que Flow devuelva no dan acceso.
  const sinPrueba = basicEnPrueba({ status: 1, trial_period_days: 0, invoices: [cobroMensual({ id: 2101, desde: "2026-10-13", hasta: "2026-11-12", pagado: false, flowOrder: 9000101 })] });
  assert.equal(pagadoHasta(readSubscription(sinPrueba)), null);
  assert.equal(pagadoHasta(readSubscription({ ...sinPrueba, status: 2 })).toISOString(), "2026-10-20T03:00:00.000Z", "en prueba (status 2) la prueba cuenta aunque falte el día");
});

test("estado local desde status y morose de Flow, y la cancelación al cierre cuando se acaba lo pagado", () => {
  const ahora = new Date("2026-10-15T12:00:00Z");
  const hasta = new Date("2026-10-20T03:00:00Z");
  const casos = [
    [{ status: 4, morose: 0 }, "canceled"],
    [{ status: 2, morose: 0 }, "trialing"],
    [{ status: 1, morose: 1 }, "past_due"],
    [{ status: 1, morose: 2 }, "active"],
    [{ status: 1, morose: 0 }, "active"],
    [{ status: 0, morose: 0 }, "incomplete"],
    // Un estado que Flow no documenta no da acceso.
    [{ status: 3, morose: 0 }, "incomplete"],
  ];
  for (const [campos, esperado] of casos) {
    assert.equal(estadoLocal({ cancel_at_period_end: 0, ...campos }, hasta, ahora), esperado, JSON.stringify(campos));
  }
  assert.equal(estadoLocal({ status: 2, morose: 0, cancel_at_period_end: 1 }, hasta, ahora), "trialing");
  assert.equal(estadoLocal({ status: 2, morose: 0, cancel_at_period_end: 1 }, hasta, hasta), "canceled");
  assert.equal(estadoLocal({ status: 1, morose: 0, cancel_at_period_end: 1 }, null, ahora), "canceled", "sin nada pagado no hay cierre que esperar");
});

test("prueba de 7 días: la fila queda en prueba hasta la medianoche de Chile del día 20", () => {
  const ahora = new Date("2026-10-13T18:30:00Z");
  assert.deepEqual(valoresDesdeFlow(readSubscription(basicEnPrueba()), {}, ahora), {
    status: "trialing",
    trial_starts_at: "2026-10-13T03:00:00.000Z",
    trial_ends_at: "2026-10-20T03:00:00.000Z",
    current_period_start: "2026-10-13T03:00:00.000Z",
    current_period_end: "2026-10-20T03:00:00.000Z",
    cancel_at_period_end: false,
    canceled_at: null,
    provider_status: 2,
    morose: 0,
    next_invoice_at: "2026-10-20T03:00:00.000Z",
    payment_link: null,
    provider_plan_id: "pteron-basic-2990-mensual",
    last_synced_at: "2026-10-13T18:30:00.000Z",
  });
});

test("la prueba termina y cobra: el período pagado pasa al mes del cobro", () => {
  const valores = valoresDesdeFlow(readSubscription(basicCobrada()), {}, new Date("2026-10-20T12:00:00Z"));
  assert.equal(valores.status, "active");
  assert.equal(valores.current_period_start, "2026-10-20T03:00:00.000Z");
  assert.equal(valores.current_period_end, "2026-11-20T03:00:00.000Z");
  assert.equal(valores.trial_ends_at, "2026-10-20T03:00:00.000Z", "la prueba sigue registrada");
  assert.equal(valores.next_invoice_at, "2026-11-20T03:00:00.000Z");
  assert.equal(valores.payment_link, null);
});

test("cobro rechazado: past_due con el link de pago, y lo pagado sigue siendo la prueba", () => {
  const rechazada = basicEnPrueba({
    status: 1,
    morose: 1,
    period_start: "2026-10-20 00:00:00",
    period_end: "2026-11-19 00:00:00",
    next_invoice_date: "2026-11-20 00:00:00",
    invoices: [cobroMensual({ id: 2001, desde: "2026-10-20", hasta: "2026-11-19", pagado: false, flowOrder: 9000002 })],
  });
  const valores = valoresDesdeFlow(readSubscription(rechazada), {}, new Date("2026-10-21T12:00:00Z"));
  assert.equal(valores.status, "past_due");
  assert.equal(valores.morose, 1);
  assert.equal(valores.current_period_start, "2026-10-13T03:00:00.000Z");
  assert.equal(valores.current_period_end, "2026-10-20T03:00:00.000Z");
  assert.equal(valores.payment_link, "https://www.flow.cl/app/web/pay.php?token=PAGO2001");
});

test("cancelación al cierre: sigue en prueba hasta lo pagado y después queda cancelada, con la fecha de Flow si la trae", () => {
  const cancelada = readSubscription(basicEnPrueba({ cancel_at_period_end: 1 }));
  const antes = valoresDesdeFlow(cancelada, {}, new Date("2026-10-19T23:00:00Z"));
  assert.equal(antes.status, "trialing");
  assert.equal(antes.cancel_at_period_end, true);
  const despues = valoresDesdeFlow(cancelada, {}, new Date("2026-10-20T03:00:00Z"));
  assert.equal(despues.status, "canceled");
  assert.equal(despues.canceled_at, "2026-10-20T03:00:00.000Z");
  const enFlow = readSubscription(basicEnPrueba({ status: 4, cancel_at_period_end: 1, cancel_at: "2026-10-20 00:00:00" }));
  assert.equal(valoresDesdeFlow(enFlow, {}, new Date("2026-10-22T12:00:00Z")).canceled_at, "2026-10-20T03:00:00.000Z");
  assert.equal(valoresDesdeFlow(enFlow, { canceled_at: "2026-10-21T00:00:00.000Z" }, new Date("2026-10-22T12:00:00Z")).canceled_at, "2026-10-21T00:00:00.000Z", "una cancelación anotada no se mueve");
});

test("períodos en invierno, cruzando el cambio de hora y terminando el día que vuelve el horario de invierno", () => {
  const conPago = (desde, hasta) => readSubscription(basicCobrada({ invoices: [cobroMensual({ id: 3001, desde, hasta, pagado: true, flowOrder: 9100001 })] }));
  const invierno = valoresDesdeFlow(conPago("2026-06-01", "2026-06-30"), {}, new Date("2026-06-10T12:00:00Z"));
  assert.deepEqual([invierno.current_period_start, invierno.current_period_end], ["2026-06-01T04:00:00.000Z", "2026-07-01T04:00:00.000Z"]);
  const cruce = valoresDesdeFlow(conPago("2026-08-20", "2026-09-19"), {}, new Date("2026-09-01T12:00:00Z"));
  assert.deepEqual([cruce.current_period_start, cruce.current_period_end], ["2026-08-20T04:00:00.000Z", "2026-09-20T03:00:00.000Z"]);
  const abril = valoresDesdeFlow(conPago("2026-03-05", "2026-04-04"), {}, new Date("2026-03-10T12:00:00Z"));
  assert.deepEqual([abril.current_period_start, abril.current_period_end], ["2026-03-05T03:00:00.000Z", "2026-04-05T04:00:00.000Z"]);
});

test("syncFlowSubscription consulta subscription/get, escribe la fila sin pisar una sincronización más nueva y no la toca si Flow falla", async () => {
  let flowStatus = 200;
  const network = fakeNetwork([
    { match: matches.flow("/subscription/get"), respond: () => (flowStatus === 200 ? { body: basicCobrada() } : { status: flowStatus, body: { message: "caído" } }) },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
  ]);
  const ahora = new Date("2026-10-20T12:00:00Z");
  await withFetch(network.fetch, async () => {
    const fila = await syncFlowSubscription(testServices(env), { id: "fila-1", provider_subscription_id: "sus_basic01", canceled_at: null }, ahora);
    assert.equal(fila.status, "active");
    assert.equal(fila.current_period_end, "2026-11-20T03:00:00.000Z");
    const consulta = network.calls.find((call) => call.url.includes("/subscription/get"));
    assert.equal(consulta.method, "GET");
    assert.match(consulta.url, /[?&]subscriptionId=sus_basic01(&|$)/);
    const patch = network.calls.find((call) => call.method === "PATCH");
    assert.match(patch.url, /id=eq\.fila-1/);
    assert.match(decodeURIComponent(patch.url), /or=\(last_synced_at\.is\.null,last_synced_at\.lt\."2026-10-20T12:00:00\.000Z"\)/);
    assert.deepEqual(patch.body, valoresDesdeFlow(readSubscription(basicCobrada()), { canceled_at: null }, ahora));

    flowStatus = 500;
    network.calls.length = 0;
    await assert.rejects(syncFlowSubscription(testServices(env), { id: "fila-1", provider_subscription_id: "sus_basic01" }, ahora), { code: "flow_error" });
    assert.equal(network.calls.some((call) => call.method === "PATCH"), false, "si Flow falla la fila queda como estaba");
  });
});

test("syncFlowSubscription rechaza una respuesta de otra suscripción en vez de copiarla", async () => {
  const network = fakeNetwork([{ match: matches.flow("/subscription/get"), respond: { body: basicCobrada({ subscriptionId: "sus_otra" }) } }]);
  await withFetch(network.fetch, async () => {
    await assert.rejects(syncFlowSubscription(testServices(env), { id: "fila-1", provider_subscription_id: "sus_basic01" }), { code: "flow_error" });
  });
});

test("el Cron sincroniza las filas cerca del fin de lo pagado, sigue si una falla y vence los checkouts abandonados y las cortesías terminadas", async () => {
  const filas = [
    { id: "fila-1", user_id: "u1", provider_subscription_id: "sus_basic01", status: "trialing", canceled_at: null },
    { id: "fila-2", user_id: "u2", provider_subscription_id: "sus_caida", status: "active", canceled_at: null },
  ];
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: filas } },
    { match: (url) => url.includes("/subscription/get") && url.includes("sus_caida"), respond: { status: 500, body: { message: "caído" } } },
    { match: matches.flow("/subscription/get"), respond: { body: basicCobrada() } },
    { match: (url, m) => matches.supabase("subscriptions", "PATCH")(url, m) && url.includes("provider=eq.comp"), respond: { body: [{ id: "cortesia-1" }] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [{ id: "i1" }, { id: "i2" }] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
    // Los avisos de fin de prueba (sin correo configurado) sólo dejan su evento *_email_skipped.
    { match: matches.supabase("billing_events", "POST"), respond: { body: [] } },
  ]);
  const ahora = new Date("2026-10-20T12:17:00Z");
  const errores = [];
  const consoleError = console.error;
  console.error = (...args) => errores.push(args);
  try {
    await withFetch(network.fetch, async () => {
      assert.deepEqual(await syncDueSubscriptions(testServices(env), ahora), {
        sincronizadas: 1,
        fallidas: 1,
        correosEnviados: 0,
        correosOmitidos: 2,
        correosFallidos: 0,
        checkoutsVencidos: 2,
        cortesiasVencidas: 1,
        checkoutsConciliados: 0,
        checkoutsSinSuscripcion: 0,
        checkoutsPendientes: 0,
      });
    });
  } finally {
    console.error = consoleError;
  }
  const seleccion = decodeURIComponent(network.calls[0].url);
  assert.match(seleccion, /provider=eq\.flow/);
  assert.match(seleccion, /status=in\.\(incomplete,trialing,active,past_due\)/);
  assert.match(seleccion, /current_period_end\.gte\."2026-10-16T12:17:00\.000Z",current_period_end\.lte\."2026-10-22T12:17:00\.000Z"/);
  assert.match(seleccion, /cancel_at_period_end\.is\.true/);
  assert.match(seleccion, /last_synced_at\.lt\."2026-10-13T12:17:00\.000Z"/);
  assert.match(seleccion, /order=last_synced_at\.asc\.nullsfirst&limit=100/);
  const parches = network.calls.filter((call) => call.url.includes("/rest/v1/subscriptions") && call.method === "PATCH");
  assert.equal(parches.length, 2, "la fila sincronizada y las cortesías terminadas");
  const cortesias = parches.find((call) => call.url.includes("provider=eq.comp"));
  assert.match(decodeURIComponent(cortesias.url), /status=in\.\(trialing,active,past_due\)&current_period_end=lt\.2026-10-20T12:17:00\.000Z/);
  assert.deepEqual(cortesias.body, { status: "expired" });
  const vencidos = network.calls.find((call) => call.url.includes("billing_checkout_intents"));
  assert.match(decodeURIComponent(vencidos.url), /status=eq\.card_registration_pending&expires_at=lt\.2026-10-20T12:17:00\.000Z/);
  assert.deepEqual(vencidos.body, { status: "expired" });
  assert.equal(errores.length, 1, "la fila que falló queda en el registro");
  assert.deepEqual(errores[0][1].subscription, "fila-2");
});

test("tras un aviso de pago se sincronizan las filas cerca de ahora y se reconoce la cuenta por el flowOrder de su factura", async () => {
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "fila-1", user_id: "u1", provider_subscription_id: "sus_basic01", canceled_at: null }] } },
    { match: matches.flow("/subscription/get"), respond: { body: basicCobrada() } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const ahora = new Date("2026-10-20T03:10:00Z");
    assert.deepEqual(await syncAfterPayment(testServices(env), { flowOrder: 9000001 }, ahora), { sincronizadas: 1, fallidas: 0, userId: "u1" });
    assert.deepEqual(await syncAfterPayment(testServices(env), { flowOrder: 1 }, ahora), { sincronizadas: 1, fallidas: 0, userId: null });
    const seleccion = decodeURIComponent(network.calls[0].url);
    assert.match(seleccion, /current_period_end\.gte\."2026-10-16T03:10:00\.000Z",current_period_end\.lte\."2026-10-24T03:10:00\.000Z"\),current_period_end\.is\.null/);
    assert.match(seleccion, /limit=50/);
  });
});

test("el handler scheduled del Worker corre la sincronización del Cron dentro de waitUntil", async () => {
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
  ]);
  const resumen = {
    sincronizadas: 0,
    fallidas: 0,
    correosEnviados: 0,
    correosOmitidos: 0,
    correosFallidos: 0,
    checkoutsVencidos: 0,
    cortesiasVencidas: 0,
    checkoutsConciliados: 0,
    checkoutsSinSuscripcion: 0,
    checkoutsPendientes: 0,
  };
  const lineas = [];
  const consoleLog = console.log;
  console.log = (...args) => lineas.push(args);
  try {
    await withFetch(network.fetch, async () => {
      const ctx = fakeExecution();
      await worker.scheduled({ cron: "17 12 * * *", scheduledTime: Date.now() }, env, ctx);
      assert.equal(ctx.promises.length, 1);
      assert.deepEqual(await ctx.promises[0], resumen);
      // El último GET es la búsqueda de pruebas por terminar, de los avisos por correo.
      assert.deepEqual(network.calls.map((call) => call.method), ["GET", "PATCH", "PATCH", "GET", "GET"]);
    });
  } finally {
    console.log = consoleLog;
  }
  // El resumen queda en Workers Logs: una línea JSON, sólo cuentas.
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].length, 1);
  assert.deepEqual(JSON.parse(lineas[0][0]), { event: "pteron_cron", ...resumen });
});

test("si un paso del Cron queda sin dato, el handler scheduled corre los demás, deja el resumen y termina en error", async () => {
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { status: 500, body: { message: "caído" } } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
  ]);
  const lineas = [];
  const consoleLog = console.log;
  const consoleError = console.error;
  console.log = (...args) => lineas.push(args);
  console.error = () => {};
  try {
    await withFetch(network.fetch, async () => {
      const ctx = fakeExecution();
      await worker.scheduled({ cron: "17 12 * * *", scheduledTime: Date.now() }, env, ctx);
      await assert.rejects(ctx.promises[0], /pteron cron: quedaron sin dato checkoutsVencidos/);
      // Igual buscó las pruebas por terminar, para los avisos por correo.
      assert.match(decodeURIComponent(network.calls.at(-1).url), /trial_ends_at/);
    });
  } finally {
    console.log = consoleLog;
    console.error = consoleError;
  }
  assert.equal(lineas.length, 1, "el resumen queda en el registro antes del error");
  assert.equal(JSON.parse(lineas[0][0]).checkoutsVencidos, null);
});

test("si vencer los checkouts o las cortesías falla, el Cron sigue: concilia, avisa el fin de prueba y el resumen lo muestra en null", async () => {
  for (const caido of ["billing_checkout_intents", "cortesias"]) {
    const network = fakeNetwork([
      { match: matches.supabase("subscriptions", "GET"), respond: { body: [] } },
      { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: caido === "billing_checkout_intents" ? { status: 500, body: { message: "caído" } } : { body: [{ id: "i1" }] } },
      { match: matches.supabase("subscriptions", "PATCH"), respond: caido === "cortesias" ? { status: 500, body: { message: "caído" } } : { body: [{ id: "cortesia-1" }] } },
      { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
    ]);
    const errores = [];
    const consoleError = console.error;
    console.error = (...args) => errores.push(args);
    let resumen;
    try {
      resumen = await withFetch(network.fetch, () => syncDueSubscriptions(testServices(env), new Date("2026-10-20T12:17:00Z")));
    } finally {
      console.error = consoleError;
    }
    assert.equal(resumen.checkoutsVencidos, caido === "billing_checkout_intents" ? null : 1, caido);
    assert.equal(resumen.cortesiasVencidas, caido === "cortesias" ? null : 1, caido);
    assert.equal(resumen.sincronizadas, 0);
    // Después del paso caído corren los dos PATCH, la conciliación y la búsqueda de pruebas por terminar.
    assert.deepEqual(network.calls.map((call) => call.method), ["GET", "PATCH", "PATCH", "GET", "GET"], caido);
    assert.ok(network.calls.at(-1).url.includes("/rest/v1/subscriptions") && network.calls.at(-1).url.includes("trial_ends_at"), "el aviso de fin de prueba se buscó igual");
    assert.equal(errores.length, 1);
    assert.equal(errores[0][0], "pteron cron");
    assert.deepEqual(errores[0][1], { paso: caido === "cortesias" ? "cortesias_vencidas" : "checkouts_vencidos", error: "caído" });
  }
});

test("si la búsqueda de suscripciones del Cron falla, igual vence, concilia y avisa; sincronizadas y fallidas quedan en null", async () => {
  const network = fakeNetwork([
    { match: (url, m) => matches.supabase("subscriptions", "GET")(url, m) && url.includes("provider_subscription_id=not.is.null"), respond: { status: 500, body: { message: "caído" } } },
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { body: [] } },
  ]);
  const errores = [];
  const consoleError = console.error;
  console.error = (...args) => errores.push(args);
  let resumen;
  try {
    resumen = await withFetch(network.fetch, () => syncDueSubscriptions(testServices(env), new Date("2026-10-20T12:17:00Z")));
  } finally {
    console.error = consoleError;
  }
  assert.equal(resumen.sincronizadas, null);
  assert.equal(resumen.fallidas, null);
  assert.equal(resumen.checkoutsVencidos, 0);
  assert.deepEqual(network.calls.map((call) => call.method), ["GET", "PATCH", "PATCH", "GET", "GET"]);
  assert.ok(network.calls.at(-1).url.includes("trial_ends_at"));
  assert.deepEqual(errores, [["pteron cron", { paso: "suscripciones", error: "caído" }]]);
});

test("la base de Flow no tiene valor por defecto y el sitio de producción sólo cobra en la API de producción", () => {
  const consoleError = console.error;
  console.error = () => {};
  try {
    const base = (vars) => createFlow({ FLOW_API_KEY: "a", FLOW_SECRET_KEY: "b", ...vars }).flowBaseUrl();
    assert.equal(base({ PUBLIC_SITE_URL: "https://pteron.patagua.dev", FLOW_BASE_URL: "https://www.flow.cl/api/" }), "https://www.flow.cl/api");
    assert.throws(() => base({ PUBLIC_SITE_URL: "https://pteron.patagua.dev", FLOW_BASE_URL: "https://sandbox.flow.cl/api" }), { status: 503, code: "billing_misconfigured" });
    assert.equal(base({ PUBLIC_SITE_URL: "https://pteron.patagua.dev", FLOW_BASE_URL: "https://sandbox.flow.cl/api", FLOW_ALLOW_SANDBOX: "1" }), "https://sandbox.flow.cl/api");
    assert.equal(base({ PUBLIC_SITE_URL: "https://pteron.test", FLOW_BASE_URL: "https://sandbox.flow.cl/api" }), "https://sandbox.flow.cl/api");
    assert.throws(() => base({ PUBLIC_SITE_URL: "https://pteron.test" }), { code: "billing_misconfigured" });
    assert.throws(() => base({ PUBLIC_SITE_URL: "https://pteron.test", FLOW_BASE_URL: "https://flow.example/api" }), { code: "billing_misconfigured" });
    // Sin id de plan configurado no se cobra: un id por defecto podría ser un plan viejo con otro monto.
    assert.throws(() => createFlow({}).planId("basic"), { code: "billing_misconfigured" });
    assert.equal(createFlow({ FLOW_BASIC_PLAN_ID: " pteron-basic-2990-mensual " }).planId("basic"), "pteron-basic-2990-mensual");
    assert.throws(() => createFlow({ FLOW_BASIC_PLAN_ID: "x" }).planId("tester"), { code: "billing_misconfigured" });
  } finally {
    console.error = consoleError;
  }
});

test("si la conciliación del Cron falla, la sincronización de las suscripciones ya corrió y el resumen lo cuenta en cero", async () => {
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions", "GET"), respond: { body: [{ id: "fila-1", user_id: "u1", provider_subscription_id: "sus_basic01", status: "trialing", canceled_at: null }] } },
    { match: matches.flow("/subscription/get"), respond: { body: basicCobrada() } },
    { match: (url, m) => matches.supabase("subscriptions", "PATCH")(url, m) && url.includes("provider=eq.comp"), respond: { body: [] } },
    { match: matches.supabase("subscriptions", "PATCH"), respond: { body: [{ id: "fila-1" }] } },
    { match: matches.supabase("billing_checkout_intents", "PATCH"), respond: { body: [] } },
    { match: matches.supabase("billing_checkout_intents", "GET"), respond: { status: 500, body: { message: "caído" } } },
    { match: matches.supabase("billing_events", "POST"), respond: { body: [] } },
  ]);
  const errores = [];
  const consoleError = console.error;
  console.error = (...args) => errores.push(args);
  try {
    await withFetch(network.fetch, async () => {
      assert.deepEqual(await syncDueSubscriptions(testServices(env), new Date("2026-10-20T12:17:00Z")), {
        sincronizadas: 1,
        fallidas: 0,
        correosEnviados: 0,
        correosOmitidos: 1,
        correosFallidos: 0,
        checkoutsVencidos: 0,
        cortesiasVencidas: 0,
        checkoutsConciliados: 0,
        checkoutsSinSuscripcion: 0,
        checkoutsPendientes: 0,
      });
    });
  } finally {
    console.error = consoleError;
  }
  assert.equal(errores.length, 1);
  assert.equal(errores[0][0], "pteron reconcile");
});

test("un vencimiento de Flow rechaza el fetch como una red caída: no es un rechazo de Flow y la creación de la suscripción queda incierta", async () => {
  const flow = createFlow({ FLOW_API_KEY: "a", FLOW_SECRET_KEY: "b", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });
  const señales = [];
  const vencido = async (url, init) => {
    señales.push(init.signal);
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  await withFetch(vencido, async () => {
    const lecturas = [
      flow.getSubscription("sus_basic01"),
      flow.createSubscription({ planId: "pteron-basic-2990-mensual", customerId: "cus_1", trialPeriodDays: 0 }),
    ];
    for (const lectura of lecturas) {
      const error = await lectura.then(() => null, (falla) => falla);
      assert.equal(error?.name, "TimeoutError");
      assert.equal(flowRejected(error), false, "un vencimiento no dice qué pasó en Flow");
    }
  });
  assert.equal(señales.length, 2);
  assert.ok(señales.every((señal) => señal instanceof AbortSignal && !señal.aborted), "cada llamada lleva su propio tope de tiempo");
  assert.equal(flowRejected(new HttpError(502, "flow_error", "x", { flowStatus: 500 })), false);
  assert.equal(flowRejected(new HttpError(502, "flow_error", "x", { flowStatus: 400 })), true);
});

test("customerSubscriptions pide la primera página firmada y lee data como arreglo o como texto JSON", async () => {
  const flow = createFlow({ FLOW_API_KEY: "a", FLOW_SECRET_KEY: "b", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });
  const items = [basicEnPrueba(), basicCobrada({ subscriptionId: "sus_otra" })];
  for (const data of [items, JSON.stringify(items)]) {
    const network = fakeNetwork([{ match: matches.flow("/customer/getSubscriptions"), respond: { body: { total: "2", hasMore: 1, data } } }]);
    await withFetch(network.fetch, async () => {
      const lista = await flow.customerSubscriptions("cus_1");
      assert.equal(lista.total, 2);
      assert.equal(lista.hasMore, true);
      assert.deepEqual(lista.data.map((s) => [s.subscriptionId, s.planId, s.status, s.created]), [
        ["sus_basic01", "pteron-basic-2990-mensual", 2, "2026-10-13 15:20:00"],
        ["sus_otra", "pteron-basic-2990-mensual", 1, "2026-10-13 15:20:00"],
      ]);
    });
    const [llamada] = network.calls;
    assert.equal(llamada.method, "GET");
    const consulta = new URL(llamada.url).searchParams;
    assert.deepEqual([consulta.get("customerId"), consulta.get("start"), consulta.get("limit")], ["cus_1", "0", "100"]);
    assert.match(consulta.get("s"), /^[0-9a-f]{64}$/);
  }
  for (const body of [{ total: 1, hasMore: 0, data: "no es json" }, { total: 0, hasMore: 0 }, { total: 1, hasMore: 0, data: { 0: {} } }]) {
    const network = fakeNetwork([{ match: matches.flow("/customer/getSubscriptions"), respond: { body } }]);
    await withFetch(network.fetch, async () => {
      await assert.rejects(flow.customerSubscriptions("cus_1"), { code: "flow_error" }, JSON.stringify(body));
    });
  }
  const vacia = fakeNetwork([{ match: matches.flow("/customer/getSubscriptions"), respond: { body: { total: 0, hasMore: 0, data: [] } } }]);
  await withFetch(vacia.fetch, async () => assert.deepEqual(await flow.customerSubscriptions("cus_1"), { total: 0, hasMore: false, data: [] }));
});

test("cancelar en Flow exige decir si es en el acto o al cierre", async () => {
  const flow = createFlow({ FLOW_API_KEY: "a", FLOW_SECRET_KEY: "b", FLOW_BASE_URL: "https://sandbox.flow.cl/api" });
  await assert.rejects(flow.cancelSubscription({ subscriptionId: "sus_1" }), TypeError);
  const network = fakeNetwork([{ match: matches.flow("/subscription/cancel"), respond: { body: basicEnPrueba({ status: 4 }) } }]);
  await withFetch(network.fetch, async () => {
    await flow.cancelSubscription({ subscriptionId: "sus_1", atPeriodEnd: 0 });
    await flow.cancelSubscription({ subscriptionId: "sus_1", atPeriodEnd: true });
  });
  assert.deepEqual(network.calls.map((call) => call.body.at_period_end), ["0", "1"]);
});
