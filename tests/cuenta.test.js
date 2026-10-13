import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// cuenta.js corre sin navegador: sin el panel de la cuenta en el documento, sólo deja sus cálculos en window.pteronCuenta
const source = readFileSync(new URL("../public/cuenta/cuenta.js", import.meta.url), "utf8");
function load() {
  const window = {};
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(source, { window, document, URL, console });
  return window.pteronCuenta;
}
// Los valores vienen de otro contexto de vm (otro Array): se comparan como datos
const plain = (value) => JSON.parse(JSON.stringify(value));
const cuenta = load();

// El catálogo como lo entrega /api/account con la venta ya abierta
const BASIC = { id: "basic", monthly_price_clp: 2990, trial_period_days: 7, ai_units_limit: 6000000, trial_ai_units_limit: 1500000, for_sale: true };
const PRO = { id: "pro", monthly_price_clp: 9990, trial_period_days: 0, ai_units_limit: 30000000, trial_ai_units_limit: null, for_sale: true };
const account = (overrides = {}) => ({ plans: [BASIC, PRO], subscriptions: [], trialEligible: true, termsVersion: "2026-10-13", usage: null, ...overrides });
// 13 de octubre de 2026 a mediodía en Chile (UTC-3: horario de verano)
const NOW = Date.parse("2026-10-13T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

test("el resumen antes de Flow: precio con IVA, hoy no se cobra y el día del primer cobro; el checkout lleva los Términos", () => {
  const summary = cuenta.checkoutSummary("basic", account(), NOW);
  assert.equal(summary.name, "Basic");
  assert.equal(summary.price, "$2.990 al mes, IVA incluido");
  assert.equal(summary.trialDays, 7);
  assert.deepEqual(plain(summary.rows), [
    ["Hoy", "No se cobra nada. Empiezan 7 días de prueba."],
    ["Primer cobro", "$2.990 el 20 de octubre de 2026, si no cancelas antes; luego cada mes, hasta que canceles."],
    ["IA incluida", "6.000.000 unidades por período (1.500.000 durante la prueba). Se renueva con tu cobro."],
    ["Cancelar", "Desde esta página, cuando quieras."],
  ]);
  assert.deepEqual(plain(cuenta.checkoutBody(summary)), { plan: "basic", acceptedTerms: true, termsVersion: "2026-10-13" });
});

test("el día del primer cobro se cuenta en el calendario de Chile, no en UTC", () => {
  const firstCharge = (now) => plain(cuenta.checkoutSummary("basic", account(), now).rows)[1][1];
  // 23:30 del 13 en Chile ya es 14 en UTC: la prueba empieza el 13 y se cobra el 20
  assert.match(firstCharge(Date.parse("2026-10-14T02:30:00Z")), /el 20 de octubre de 2026/);
  // 00:30 del 14 en Chile: se cobra el 21
  assert.match(firstCharge(Date.parse("2026-10-14T03:30:00Z")), /el 21 de octubre de 2026/);
  // El cambio de hora de abril no corre el día
  assert.match(firstCharge(Date.parse("2027-04-01T15:00:00Z")), /el 8 de abril de 2027/);
});

test("sin prueba: quien ya la usó, Pro y una cuenta que no informa si le corresponde", () => {
  const used = plain(cuenta.checkoutSummary("basic", account({ trialEligible: false }), NOW));
  assert.equal(used.trialDays, 0);
  assert.deepEqual(used.rows.slice(0, 2), [
    ["Primer cobro", "$2.990 al contratar; luego cada mes, hasta que canceles."],
    ["Prueba", "Ya usaste la prueba gratis: es una por persona."],
  ]);
  assert.equal(used.rows[2][1], "6.000.000 unidades por período. Se renueva con tu cobro.");
  // Ante la duda no se promete una prueba: sólo con trialEligible === true
  assert.equal(cuenta.checkoutSummary("basic", account({ trialEligible: undefined }), NOW).trialDays, 0);
  const pro = plain(cuenta.checkoutSummary("pro", account(), NOW));
  assert.equal(pro.price, "$9.990 al mes, IVA incluido");
  assert.deepEqual(pro.rows.map(([label]) => label), ["Primer cobro", "IA incluida", "Cancelar"]);
  assert.equal(pro.rows[1][1], "30.000.000 unidades por período. Se renueva con tu cobro.");
});

test("un plan que no está a la venta, o sin precio, no tiene resumen: su botón dice «Disponible pronto»", () => {
  const without = (changes) => account({ plans: [{ ...BASIC, ...changes }, PRO] });
  assert.equal(cuenta.checkoutSummary("basic", without({ for_sale: false }), NOW), null);
  assert.equal(cuenta.checkoutSummary("basic", without({ for_sale: undefined }), NOW), null, "sin for_sale, cerrado");
  assert.equal(cuenta.checkoutSummary("basic", without({ for_sale: "true" }), NOW), null, "sólo el booleano abre la venta");
  assert.equal(cuenta.checkoutSummary("basic", without({ monthly_price_clp: 0 }), NOW), null);
  assert.equal(cuenta.checkoutSummary("basic", without({ monthly_price_clp: null }), NOW), null);
  assert.equal(cuenta.checkoutSummary("basic", account({ plans: [PRO] }), NOW), null, "un plan que el catálogo no lista");
  assert.equal(cuenta.checkoutSummary("basic", null, NOW), null);
  // Sin una versión de los Términos con forma de fecha no hay nada que aceptar
  assert.equal(cuenta.checkoutSummary("basic", account({ termsVersion: undefined }), NOW).termsVersion, null);
  assert.equal(cuenta.checkoutSummary("basic", account({ termsVersion: "vigente" }), NOW).termsVersion, null);
});

test("el estado del plan: en prueba, próximo cobro, termina, pago pendiente y cortesía", () => {
  const state = (subscription, plan = BASIC) => plain(cuenta.subscriptionState(subscription, plan));
  assert.deepEqual(state({ status: "trialing", trial_ends_at: "2026-10-20T03:00:00.000Z", current_period_end: "2026-10-20T03:00:00.000Z" }), {
    label: "En prueba",
    text: "En prueba hasta el 20 de octubre de 2026; ese día se cobran $2.990.",
    pay: "",
  });
  assert.equal(state({ status: "trialing", trial_ends_at: "2026-10-20T03:00:00.000Z" }, null).text, "En prueba hasta el 20 de octubre de 2026; ese día se hace el primer cobro.");
  assert.equal(state({ status: "active", next_invoice_at: "2026-11-20T03:00:00.000Z", current_period_end: "2026-11-20T03:00:00.000Z" }).text, "Próximo cobro: 20 de noviembre de 2026.");
  assert.equal(state({ status: "active", current_period_end: "2026-11-20T03:00:00.000Z" }).text, "Próximo cobro: 20 de noviembre de 2026.", "sin next_invoice_at, el fin de lo pagado");
  assert.deepEqual(state({ status: "active", cancel_at_period_end: true, current_period_end: "2026-11-20T03:00:00.000Z" }), {
    label: "No se renueva",
    text: "Termina el 20 de noviembre de 2026.",
    pay: "",
  });
  const pending = state({ status: "past_due", payment_link: "https://www.flow.cl/btn.php?token=abc" });
  assert.equal(pending.label, "Pago pendiente");
  assert.equal(pending.pay, "https://www.flow.cl/btn.php?token=abc");
  // Flow la marca morosa (morose = 1): se ofrece pagar, no se anuncia un próximo cobro
  const morose = state({ status: "active", morose: 1, next_invoice_at: "2026-11-20T03:00:00.000Z", payment_link: "https://www.flow.cl/btn.php?token=abc" });
  assert.equal(morose.label, "Pago pendiente");
  assert.equal(morose.pay, "https://www.flow.cl/btn.php?token=abc");
  assert.equal(state({ status: "active", morose: 0, payment_link: "https://www.flow.cl/btn.php?token=abc" }).pay, "", "sin cobro pendiente no hay enlace de pago");
  // Un enlace de pago que no es de Flow no se ofrece
  const foreign = state({ status: "past_due", payment_link: "https://flow.cl.example.com/pagar" });
  assert.equal(foreign.pay, "");
  assert.match(foreign.text, /escríbenos a pteron@patagua\.dev/);
  assert.deepEqual(state({ status: "active", provider: "comp", plan_id: "tester", current_period_end: "2027-10-13T15:00:00.000Z" }), {
    label: "Cortesía",
    text: "Cortesía hasta el 13 de octubre de 2027.",
    pay: "",
  });
});

test("el uso de la IA incluida del período: «Usada: N de M unidades · se renueva el X»", () => {
  const trialing = { status: "trialing", trial_ends_at: "2026-10-20T03:00:00.000Z", current_period_end: "2026-10-20T03:00:00.000Z" };
  const usage = { periodStart: "2026-10-13T03:00:00.000Z", periodEnd: "2026-10-20T03:00:00.000Z", unitsUsed: 120000, unitsLimit: 1500000 };
  assert.deepEqual(plain(cuenta.usageState(usage, trialing, BASIC, NOW)), { line: "Usada: 120.000 de 1.500.000 unidades · se renueva el 20 de octubre de 2026", exhausted: false });
  // Sin uso todavía: la cuota del catálogo, la de prueba en la prueba
  assert.equal(cuenta.usageState(null, trialing, BASIC, NOW).line, "Usada: 0 de 1.500.000 unidades · se renueva el 20 de octubre de 2026");
  // Empezó un período pagado y el más reciente con uso es el anterior: en éste no se ha usado nada
  const active = { status: "active", current_period_start: "2026-10-20T03:00:00.000Z", current_period_end: "2026-11-20T03:00:00.000Z" };
  const later = Date.parse("2026-10-25T15:00:00Z");
  assert.equal(cuenta.usageState(usage, active, BASIC, later).line, "Usada: 0 de 6.000.000 unidades · se renueva el 20 de noviembre de 2026");
  // Esperando el cobro (la gracia): el gateway sigue en el período pagado, y se renueva con el cobro
  const waiting = { status: "past_due", current_period_end: "2026-11-20T03:00:00.000Z" };
  const lastPeriod = { periodStart: "2026-10-20T03:00:00.000Z", periodEnd: "2026-11-20T03:00:00.000Z", unitsUsed: 6000100, unitsLimit: 6000000 };
  assert.deepEqual(plain(cuenta.usageState(lastPeriod, waiting, BASIC, Date.parse("2026-11-21T15:00:00Z"))), {
    line: "Usada: 6.000.100 de 6.000.000 unidades · se renueva con tu próximo cobro",
    exhausted: true,
  });
  // Un período con uso pero sin tope en su foto
  assert.equal(cuenta.usageState({ ...usage, unitsLimit: null }, trialing, BASIC, NOW).line, "Usada: 120.000 unidades · se renueva el 20 de octubre de 2026");
  // Una cortesía sin uso en su mes y sin plan público: no se inventa la cuota
  assert.equal(cuenta.usageState(null, { status: "active", provider: "comp", plan_id: "tester", current_period_end: "2027-10-13T15:00:00.000Z" }, null, NOW).line, "Todavía no usas la IA incluida en este período.");
  // Sin acceso todavía no hay uso que mostrar
  assert.equal(cuenta.usageState(usage, { status: "incomplete" }, BASIC, NOW), null);
});

test("la suscripción en curso: una cancelada al cierre cuyo período ya pasó deja de estarlo", () => {
  const ended = { status: "active", cancel_at_period_end: true, current_period_end: "2026-10-12T03:00:00.000Z" };
  const running = { status: "trialing", current_period_end: "2026-10-20T03:00:00.000Z" };
  assert.equal(cuenta.currentSubscription({ subscriptions: [ended] }, NOW), null);
  assert.equal(cuenta.currentSubscription({ subscriptions: [{ status: "canceled" }, running] }, NOW).status, "trialing");
  assert.equal(cuenta.currentSubscription({ subscriptions: [{ ...ended, current_period_end: "2026-10-20T03:00:00.000Z" }] }, NOW).status, "active");
  assert.equal(cuenta.currentSubscription(null, NOW), null);
});

test("el retorno de Flow: un aviso por resultado, y el código sólo si tiene forma de código", () => {
  assert.deepEqual(plain(cuenta.billingMessage("success")), { text: "Listo: tu plan quedó registrado.", tone: "success" });
  assert.equal(cuenta.billingMessage("cancelled").text, "El registro de tarjeta se canceló. No se creó ningún plan.");
  assert.match(cuenta.billingMessage("processing").text, /Flow todavía está confirmando tu tarjeta/);
  assert.equal(cuenta.billingMessage("expired").tone, "error");
  assert.equal(cuenta.billingMessage("error", "subscription_exists").text, "Ya tienes un plan en curso: no se creó otro. (código: subscription_exists)");
  assert.match(cuenta.billingMessage("error", "flow_error").text, /^No pudimos completar el registro con Flow\..*\(código: flow_error\)$/);
  // La URL la puede armar cualquiera: un texto libre no se muestra como si fuera nuestro
  const forged = cuenta.billingMessage("error", "Llama al 600 000 0000 para validar tu tarjeta");
  assert.doesNotMatch(forged.text, /Llama|600/);
  assert.doesNotMatch(forged.text, /código/);
  assert.equal(cuenta.billingMessage("otra-cosa"), null);
  assert.equal(cuenta.billingMessage(null), null);
});

test("fuera del sitio sólo se enlaza a Flow por https", () => {
  assert.equal(cuenta.flowLink("https://www.flow.cl/app/web/customerRegister.php?token=t"), "https://www.flow.cl/app/web/customerRegister.php?token=t");
  assert.equal(cuenta.flowLink("https://sandbox.flow.cl/app/web/pay.php?token=t"), "https://sandbox.flow.cl/app/web/pay.php?token=t");
  for (const value of ["http://www.flow.cl/pay", "https://evilflow.cl/pay", "https://flow.cl.example.com/pay", "javascript:alert(1)", "/cuenta", "", null]) {
    assert.equal(cuenta.flowLink(value), "", String(value));
  }
});

/** Un localStorage de pruebas; `broken` imita el almacenamiento bloqueado, que lanza en cada llamada. */
function fakeStorage({ broken = false } = {}) {
  const data = new Map();
  const guard = () => {
    if (broken) throw new Error("SecurityError");
  };
  return {
    data,
    getItem: (key) => (guard(), data.has(key) ? data.get(key) : null),
    setItem: (key, value) => (guard(), data.set(key, String(value))),
    removeItem: (key) => (guard(), data.delete(key)),
  };
}

test("lo guardado con vencimiento: vigente se lee, vencido o sin vencimiento se borra, sin almacenamiento no falla", () => {
  const storage = fakeStorage();
  cuenta.remember(storage, "k", "valor", 1000, NOW);
  assert.equal(cuenta.recall(storage, "k", NOW + 999).value, "valor");
  assert.equal(cuenta.recall(storage, "k", NOW + 1000), null);
  assert.equal(storage.data.has("k"), false, "lo vencido se borra");
  storage.setItem("viejo", "ab".repeat(32));
  assert.equal(cuenta.recall(storage, "viejo", NOW), null);
  assert.equal(storage.data.has("viejo"), false, "el código guardado sin vencimiento se descarta");
  const broken = fakeStorage({ broken: true });
  assert.doesNotThrow(() => cuenta.remember(broken, "k", "valor", 1000, NOW));
  assert.equal(cuenta.recall(broken, "k", NOW), null);
  assert.equal(cuenta.recall(null, "k", NOW), null);
});

test("la activación pedida desde la app pasa el enlace mágico y el viaje a Flow, pero vence a los 60 minutos, como en el servidor", () => {
  const storage = fakeStorage();
  const code = "a1".repeat(32);
  const opened = cuenta.pendingActivationFrom(new URL(`https://pteron.patagua.dev/cuenta?activate=${code}`), storage, NOW);
  assert.deepEqual(plain(opened), { code, expiresAt: NOW + 60 * 60 * 1000 });
  // De vuelta del enlace mágico o de Flow la URL ya no lo trae: sale de lo guardado
  const back = new URL("https://pteron.patagua.dev/cuenta?billing=success");
  assert.equal(cuenta.pendingActivationFrom(back, storage, NOW + 59 * 60 * 1000).code, code);
  // Volver a abrir el mismo enlace no alarga el plazo
  assert.equal(cuenta.pendingActivationFrom(new URL(`https://pteron.patagua.dev/cuenta?activate=${code}`), storage, NOW + 5 * 60 * 1000).expiresAt, NOW + 60 * 60 * 1000);
  assert.equal(cuenta.pendingActivationFrom(back, storage, NOW + 60 * 60 * 1000), null);
  // Un código que no tiene la forma de los que entrega la app no se guarda
  assert.equal(cuenta.pendingActivationFrom(new URL("https://pteron.patagua.dev/cuenta?activate=hola"), storage, NOW), null);
  assert.equal(storage.data.size, 0);
  // Sin almacenamiento, el código de la URL sirve igual mientras la página esté abierta
  assert.equal(cuenta.pendingActivationFrom(new URL(`https://pteron.patagua.dev/cuenta?activate=${code}`), fakeStorage({ broken: true }), NOW).code, code);
});

test("las fechas se escriben en la zona de Chile, la de los cobros de Flow", () => {
  // 23:00 del 19 de octubre en Chile es 02:00 del 20 en UTC
  assert.equal(cuenta.formatDate("2026-10-20T02:00:00.000Z"), "19 oct 2026");
  assert.equal(cuenta.formatLongDate("2026-10-20T03:00:00.000Z"), "20 de octubre de 2026");
  assert.equal(cuenta.formatDate(null), "—");
  assert.equal(cuenta.formatLongDate("no es una fecha"), "");
  assert.equal(cuenta.chileDay(Date.parse("2026-10-14T02:30:00Z")), Date.UTC(2026, 9, 13));
  assert.equal(cuenta.chileDay(Date.parse("2026-10-14T02:30:00Z") + DAY), Date.UTC(2026, 9, 14));
});

test("la cuota del período: la del plan, la de prueba o un cuarto si el catálogo no fija la de prueba", () => {
  assert.equal(cuenta.periodLimit(BASIC, false), 6000000);
  assert.equal(cuenta.periodLimit(BASIC, true), 1500000);
  assert.equal(cuenta.periodLimit({ ai_units_limit: 6000000, trial_ai_units_limit: null }, true), 1500000);
  assert.equal(cuenta.periodLimit({ ai_units_limit: 30000000 }, true), 7500000);
  assert.equal(cuenta.periodLimit({ ai_units_limit: null }, false), null);
  assert.equal(cuenta.periodLimit(null, false), null);
});
