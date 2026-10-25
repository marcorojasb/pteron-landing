import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// cuenta.js corre sin navegador: sin el panel de la cuenta en el documento, sólo deja sus cálculos en window.pteronCuenta
const source = readFileSync(new URL("../public/cuenta/cuenta.js", import.meta.url), "utf8");
function load() {
  const window = {};
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(source, { window, document, URL, console, atob, btoa, TextDecoder, TextEncoder, crypto });
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

test("antes de pagar se dice a qué correo llegan la confirmación y la copia de los Términos (Ley 19.496, art. 12 A)", () => {
  const withEmail = cuenta.checkoutSummary("basic", account({ user: { email: " profe@colegio.cl " } }), NOW);
  assert.equal(withEmail.confirmation, "Te enviaremos la confirmación de la compra y una copia de los Términos a profe@colegio.cl.");
  assert.equal(cuenta.checkoutSummary("pro", account({ user: { email: "profe@colegio.cl" } }), NOW).confirmation, withEmail.confirmation, "igual para todos los planes");
  // Sin correo conocido no se inventa uno
  for (const user of [undefined, null, {}, { email: "" }]) {
    assert.equal(cuenta.checkoutSummary("basic", account({ user }), NOW).confirmation, "Te enviaremos la confirmación de la compra y una copia de los Términos al correo de tu cuenta.");
  }
  // La línea es parte del resumen: la página la rellena con textContent y trae el mismo texto de respaldo
  assert.match(source, /\[data-summary-confirmation\]"\)\.textContent = summary\.confirmation/);
  const html = readFileSync(new URL("../public/cuenta/index.html", import.meta.url), "utf8");
  const panel = html.slice(html.indexOf("data-checkout-summary"), html.indexOf("data-summary-form"));
  assert.match(panel, /<p class="nota" data-summary-confirmation>Te enviaremos la confirmación de la compra y una copia de los Términos al correo de tu cuenta\.<\/p>/);
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

/* ---------- La página, sobre un documento de mentira ---------- */

// Lo justo del DOM para seguir el foco. Como en el navegador, un nodo que se deshabilita u oculta con el foco encima
// lo suelta a <body>, y focus() no hace nada sobre él. Cada selector es un solo nodo, que se crea al pedirlo.
class Nodo {
  constructor(documento, selector = "") {
    this.documento = documento;
    this.selector = selector;
    this.attrs = new Map();
    this.estilo = new Map();
    this.oyentes = new Map();
    this.dataset = {};
    this.hijos = [];
    this.textContent = "";
    this.estado = { disabled: false, hidden: false };
    this.style = { setProperty: (k, v) => this.estilo.set(k, String(v)) };
    const clases = new Set();
    this.classList = { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c) };
  }
  get disabled() {
    return this.estado.disabled;
  }
  set disabled(valor) {
    this.estado.disabled = Boolean(valor);
    this.soltar();
  }
  get hidden() {
    return this.estado.hidden;
  }
  set hidden(valor) {
    this.estado.hidden = Boolean(valor);
    this.soltar();
  }
  soltar() {
    if ((this.estado.disabled || this.estado.hidden) && this.documento.activeElement === this) this.documento.activeElement = this.documento.body;
  }
  focus() {
    if (!this.estado.disabled && !this.estado.hidden) this.documento.activeElement = this;
  }
  getAttribute(nombre) {
    return this.attrs.has(nombre) ? this.attrs.get(nombre) : null;
  }
  setAttribute(nombre, valor) {
    this.attrs.set(nombre, String(valor));
  }
  removeAttribute(nombre) {
    this.attrs.delete(nombre);
  }
  toggleAttribute(nombre, force = !this.attrs.has(nombre)) {
    if (force) this.attrs.set(nombre, "");
    else this.attrs.delete(nombre);
    return Boolean(force);
  }
  querySelector(selector) {
    return this.documento.querySelector(selector);
  }
  querySelectorAll(selector) {
    return this.documento.querySelectorAll(selector);
  }
  addEventListener(tipo, fn) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, []);
    this.oyentes.get(tipo).push(fn);
  }
  /** Dispara un evento y espera a sus manejadores, que en cuenta.js son asíncronos. */
  disparar(tipo) {
    const evento = { type: tipo, preventDefault() {} };
    return Promise.all((this.oyentes.get(tipo) ?? []).map((fn) => fn(evento)));
  }
  replaceChildren(...hijos) {
    this.hijos = hijos;
  }
  append(...hijos) {
    this.hijos.push(...hijos);
  }
  scrollIntoView() {}
  contains(nodo) {
    return nodo === this;
  }
}

const SESION = JSON.stringify({ access_token: "acceso", refresh_token: "renovar" });
const CODIGO = "ab".repeat(16);
const enPrueba = () => {
  const fin = new Date(Date.now() + 5 * DAY).toISOString();
  return account({ subscriptions: [{ plan_id: "basic", status: "trialing", provider: "flow", trial_ends_at: fin, current_period_end: fin }] });
};

// Deja correr las promesas pendientes (la carga de /api/account al abrir la página)
async function asentar() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

/** /api/auth/me como el servidor: el correo del token si es válido (aquí, si se lee), y si no, 401. */
function quienEs(opciones) {
  const bearer = new Headers(opciones.headers).get("authorization")?.replace(/^Bearer /, "") ?? "";
  let email = null;
  try {
    email = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()).email ?? null;
  } catch {
    email = null;
  }
  return email ? { body: { user: { email } } } : { status: 401, body: { error: "not_authenticated", message: "La sesión ya no es válida." } };
}

/**
 * /cuenta sobre el documento de mentira. `api` responde por ruta con { status, body } o una función que lo devuelve;
 * /api/account entrega `datos`. El aviso mide 77 px a la vista y 0 oculto.
 */
async function pagina({ url = "https://pteron.patagua.dev/cuenta", hash = "", sesion = false, guardado = {}, datos = account(), api = {}, observador = true, almacen = fakeStorage() } = {}) {
  const nodos = new Map();
  const documento = {
    listas: {},
    querySelector: (selector) => {
      if (!nodos.has(selector)) nodos.set(selector, new Nodo(documento, selector));
      return nodos.get(selector);
    },
    querySelectorAll: (selector) => documento.listas[selector] ?? [],
    createElement: (etiqueta) => new Nodo(documento, etiqueta),
  };
  const $ = documento.querySelector;
  documento.body = new Nodo(documento, "body");
  documento.documentElement = new Nodo(documento, "html");

  const storage = almacen;
  if (sesion) storage.setItem("pteron-account-session", sesion === true ? SESION : JSON.stringify(sesion));
  for (const [clave, valor] of Object.entries(guardado)) storage.setItem(clave, valor);
  const direccion = new URL(url);
  // Lo que hace el script en línea de /cuenta antes que cuenta.js: con una sesión guardada, recién llegada o por llegar
  // con el id_token de Google o Apple, el esqueleto
  const conIdToken = /(^|[#&])id_token=/.test(hash) && storage.data.has("pteron-oauth");
  if (sesion || /(^|[#&])access_token=/.test(hash) || conIdToken) documento.documentElement.classList.add("has-session");
  documento.activeElement = documento.body;
  // Lo que el HTML trae oculto
  for (const selector of ["[data-account-notice]", "[data-link-sent]", "[data-link-confirm]", "[data-link-current]", "[data-dashboard]", "[data-checkout-summary]", "[data-cancel-subscription]", "[data-activation-result]", "[data-activation-pending]"]) {
    $(selector).hidden = true;
  }
  Object.defineProperty($("[data-account-notice]"), "offsetHeight", { get() { return this.hidden ? 0 : 77; } });
  $('[data-checkout-plan="basic"]').dataset.checkoutPlan = "basic";
  documento.listas["[data-checkout-plan]"] = [$('[data-checkout-plan="basic"]')];
  $("#account-email").value = "profe@colegio.cl";
  // Los botones de Google y Apple, cada uno con su etiqueta
  const proveedores = ["google", "apple"].map((proveedor) => {
    const boton = $(`[data-oauth-provider="${proveedor}"]`);
    const etiqueta = new Nodo(documento, `${proveedor} [data-oauth-label]`);
    etiqueta.textContent = `Continuar con ${proveedor === "google" ? "Google" : "Apple"}`;
    boton.dataset.oauthProvider = proveedor;
    boton.etiqueta = etiqueta;
    boton.querySelector = (selector) => (selector === "[data-oauth-label]" ? etiqueta : documento.querySelector(selector));
    return boton;
  });
  documento.listas["[data-oauth-provider]"] = proveedores;

  const observadores = [];
  const salidas = [];
  const direcciones = [];
  const llamadas = [];
  const oyentes = new Map();
  const window = {
    location: { href: url + hash, hash, pathname: direccion.pathname, search: direccion.search, reload() {}, assign: (destino) => salidas.push(destino) },
    // Como en el navegador, replaceState cambia la dirección que ve la página
    history: {
      replaceState: (_estado, _titulo, destino) => {
        direcciones.push(destino);
        const nueva = new URL(destino, window.location.href);
        Object.assign(window.location, { href: nueva.href, pathname: nueva.pathname, search: nueva.search, hash: nueva.hash });
      },
    },
    localStorage: storage,
    addEventListener: (tipo, fn) => oyentes.set(tipo, [...(oyentes.get(tipo) ?? []), fn]),
    matchMedia: () => ({ matches: false }),
    confirm: () => true,
    setTimeout,
  };
  if (observador) {
    window.ResizeObserver = class {
      constructor(fn) {
        this.medir = fn;
        observadores.push(this);
      }
      observe(nodo) {
        this.nodo = nodo;
      }
    };
  }
  const fetch = async (ruta, opciones = {}) => {
    llamadas.push({ ruta, cuerpo: opciones.body ? JSON.parse(opciones.body) : null });
    const definida = api[ruta] ?? (ruta === "/api/account" ? { body: datos } : ruta === "/api/auth/me" ? quienEs : { status: 404, body: { error: "not_found" } });
    if (definida instanceof Error) throw definida;
    const { status = 200, body = {} } = typeof definida === "function" ? definida(opciones) : definida;
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  vm.runInNewContext(source, { window, document: documento, URL, URLSearchParams, Headers, fetch, console, atob, btoa, TextDecoder, TextEncoder, crypto });
  await asentar();
  const [google, apple] = proveedores;
  return { $, documento, observadores, storage, salidas, direcciones, llamadas, oyentes, google, apple, direccion: () => window.location.href };
}

test("tras pedir el enlace, el foco va al aviso de envío; con un correo rechazado vuelve al campo, marcado inválido", async () => {
  const html = readFileSync(new URL("../public/cuenta/index.html", import.meta.url), "utf8");
  assert.match(html, /<div class="acceso-enviado" data-link-sent role="status" tabindex="-1" hidden>/, "sin tabindex el aviso no recibe el foco");
  let respuesta = { body: { ok: true } };
  const { $, documento } = await pagina({ api: { "/api/auth/request-magic-link": () => respuesta } });
  const [form, boton, campo, enviado] = [$("[data-login-form]"), $("button"), $("#account-email"), $("[data-link-sent]")];
  boton.focus();
  await form.disparar("submit");
  assert.equal(enviado.hidden, false);
  assert.equal(documento.activeElement, enviado);
  assert.equal(campo.getAttribute("aria-invalid"), null);

  respuesta = { status: 400, body: { error: "invalid_email", message: "Escribe un correo válido." } };
  boton.focus();
  await form.disparar("submit");
  assert.equal(documento.activeElement, campo);
  assert.equal(campo.getAttribute("aria-invalid"), "true");
  assert.equal($("[data-login-message]").textContent, "Escribe un correo válido.");
  assert.equal(boton.disabled, false);

  // Una caída del servicio no hace inválido el correo: el foco vuelve al campo, sin la marca del intento anterior
  respuesta = { status: 502, body: { error: "upstream_error", message: "No pudimos enviar el enlace." } };
  boton.focus();
  await form.disparar("submit");
  assert.equal(documento.activeElement, campo);
  assert.equal(campo.getAttribute("aria-invalid"), null);
});

test("al autorizar el equipo el foco pasa a «Abrir pteron»; si falla, vuelve a «Autorizar equipo»", async () => {
  const url = `https://pteron.patagua.dev/cuenta?activate=${CODIGO}`;
  const deepLink = `pteron://activate?code=${CODIGO}`;
  const lista = await pagina({ url, sesion: true, datos: enPrueba(), api: { "/api/activation/complete": { body: { deepLink } } } });
  const autorizar = lista.$("[data-confirm-activation]");
  assert.equal(lista.$("[data-activation-pending]").hidden, false);
  autorizar.focus();
  await autorizar.disparar("click");
  assert.equal(lista.$("[data-activation-result]").hidden, false);
  assert.equal(lista.documento.activeElement, lista.$("[data-open-app]"));
  assert.equal(lista.$("[data-open-app]").href, deepLink);

  const error = { status: 500, body: { error: "server_error", message: "No pudimos autorizar el equipo." } };
  const falla = await pagina({ url, sesion: true, datos: enPrueba(), api: { "/api/activation/complete": error } });
  const otra = falla.$("[data-confirm-activation]");
  otra.focus();
  await otra.disparar("click");
  assert.equal(falla.documento.activeElement, otra);
  assert.equal(otra.disabled, false);
});

test("si Flow o la cancelación fallan, el foco vuelve al botón que hizo la petición", async () => {
  const flow = { status: 502, body: { error: "flow_error", message: "Flow no respondió." } };
  const compra = await pagina({ sesion: true, api: { "/api/billing/checkout": flow } });
  await compra.$('[data-checkout-plan="basic"]').disparar("click");
  assert.equal(compra.$("[data-checkout-summary]").hidden, false);
  compra.$("[data-terms-accept]").checked = true;
  const registrar = compra.$("[data-checkout-confirm]");
  registrar.focus();
  await compra.$("[data-summary-form]").disparar("submit");
  assert.equal(compra.documento.activeElement, registrar);
  assert.equal(registrar.disabled, false);
  assert.equal(compra.$("[data-summary-error]").textContent, "Flow no respondió.");

  const baja = await pagina({ sesion: true, datos: enPrueba(), api: { "/api/billing/cancel": flow } });
  const cancelar = baja.$("[data-cancel-subscription]");
  assert.equal(cancelar.hidden, false);
  cancelar.focus();
  await cancelar.disparar("click");
  assert.equal(baja.documento.activeElement, cancelar);
  assert.equal(cancelar.disabled, false);
});

test("el alto del aviso queda en --aviso-alto, con el que cuenta.css aparta el foco y alarga el colofón", async () => {
  const url = "https://pteron.patagua.dev/cuenta?billing=cancelled";
  const { $, documento, observadores } = await pagina({ url });
  const aviso = $("[data-account-notice]");
  assert.equal(aviso.hidden, false);
  // Al mostrarse ya está medido, antes de que el ResizeObserver llegue a correr: el foco que se devuelve justo
  // después de un aviso ya se aparta de él
  assert.equal(documento.documentElement.estilo.get("--aviso-alto"), "77px");
  assert.equal(observadores.length, 1);
  assert.equal(observadores[0].nodo, aviso);
  await $("[data-account-notice-close]").disparar("click");
  observadores[0].medir();
  assert.equal(documento.documentElement.estilo.get("--aviso-alto"), "0px");
  // Sin ResizeObserver, el alto igual queda al mostrarse el aviso
  const sin = await pagina({ url, observador: false });
  assert.equal(sin.$("[data-account-notice]").hidden, false);
  assert.equal(sin.documento.documentElement.estilo.get("--aviso-alto"), "77px");
  // Sólo en pantalla y hasta 820 px, donde el aviso va abajo, y sólo mientras se ve
  const css = readFileSync(new URL("../public/cuenta/cuenta.css", import.meta.url), "utf8");
  const bloque = css.slice(css.indexOf("@media screen and (max-width:820px){"));
  assert.match(bloque, /^@media screen and \(max-width:820px\)\{\s*html:has\(\.cuenta-aviso:not\(\[hidden\]\)\)\{scroll-padding-bottom:calc\(var\(--aviso-alto,0px\)/);
  assert.match(bloque, /body:has\(\.cuenta-aviso:not\(\[hidden\]\)\) \.colofon\{\s*padding-bottom:max\(calc\(clamp\(40px,6vw,72px\) \+ 64px\),calc\(var\(--aviso-alto,0px\)/);
});

// Un token de Supabase de mentira: sólo importa lo que dice su parte del medio (la firma la revisa el servidor)
const token = (datos) => ["e30", Buffer.from(JSON.stringify(datos)).toString("base64url"), "firma"].join(".");
const enlace = (correo) => `#access_token=${token({ sub: correo, email: correo })}&refresh_token=renovar-${correo}&expires_in=3600&token_type=bearer&type=magiclink`;
const pedido = (correo, vence = Date.now() + 60 * 60 * 1000) => ({ "pteron-login-request": JSON.stringify({ value: correo, expiresAt: vence }) });
const sesionDe = (correo) => ({ access_token: token({ email: correo }), refresh_token: `renovar-${correo}` });
const guardada = (storage) => JSON.parse(storage.getItem("pteron-account-session") || "null");

test("el correo de un token: el de su parte del medio, en minúsculas; ilegible o sin correo, vacío", () => {
  assert.equal(cuenta.tokenEmail(token({ email: " Profe@Colegio.CL " })), "profe@colegio.cl");
  // base64url (con - y _) y texto que no es ASCII
  assert.equal(cuenta.tokenEmail(token({ email: "ñandú@colegio.cl", nombre: "Ana María ~~~?>>>" })), "ñandú@colegio.cl");
  for (const malo of [undefined, "", "a.b.c", "sin-puntos", token({ sub: "x" }), token({ email: 7 }), "e30.%%%.firma"]) {
    assert.equal(cuenta.tokenEmail(malo), "", String(malo));
  }
});

test("un enlace entra sin preguntar si es la cuenta que se pidió aquí o la que ya está abierta; si no, pregunta", () => {
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "a@x.cl", ""), false);
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "", "a@x.cl"), false);
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "b@x.cl", "a@x.cl"), false);
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "", ""), true, "pedido en otro navegador, o mandado por otra persona");
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "b@x.cl", ""), true);
  assert.equal(cuenta.linkNeedsConfirmation("a@x.cl", "b@x.cl", "c@x.cl"), true);
  assert.equal(cuenta.linkNeedsConfirmation("", "", ""), true, "un token que no se lee");
});

test("pedir el enlace deja anotado el correo, en minúsculas y por una hora, para que su enlace entre sin preguntar", async () => {
  const { $, storage } = await pagina({ api: { "/api/auth/request-magic-link": { body: { ok: true } } } });
  $("#account-email").value = "  Profe@Colegio.CL ";
  const antes = Date.now();
  await $("[data-login-form]").disparar("submit");
  const anotado = JSON.parse(storage.getItem("pteron-login-request"));
  assert.equal(anotado.value, "profe@colegio.cl");
  assert.ok(anotado.expiresAt >= antes + 60 * 60 * 1000 && anotado.expiresAt <= Date.now() + 60 * 60 * 1000);
  // Si el envío falla no queda nada anotado
  const fallido = await pagina({ api: { "/api/auth/request-magic-link": { status: 502, body: { error: "upstream_error", message: "No." } } } });
  await fallido.$("[data-login-form]").disparar("submit");
  assert.equal(fallido.storage.getItem("pteron-login-request"), null);
});

test("el enlace de la cuenta que se pidió en este navegador abre la sesión sin preguntar", async () => {
  const { $, storage } = await pagina({ hash: enlace("profe@colegio.cl"), guardado: pedido("profe@colegio.cl") });
  assert.equal(guardada(storage).refresh_token, "renovar-profe@colegio.cl");
  assert.equal($("[data-link-confirm]").hidden, true);
  assert.equal($("[data-dashboard]").hidden, false);
  assert.equal(storage.getItem("pteron-login-request"), null, "lo anotado se usa una vez");
  // La misma cuenta que ya está abierta tampoco pregunta (pedido desde otro equipo, por ejemplo)
  const misma = await pagina({ hash: enlace("profe@colegio.cl"), sesion: sesionDe("profe@colegio.cl") });
  assert.equal(misma.$("[data-dashboard]").hidden, false);
  assert.equal(misma.$("[data-link-confirm]").hidden, true);
});

test("un enlace que no se pidió aquí pregunta antes de entrar; «Entrar» abre esa cuenta y el foco pasa a ella", async () => {
  const { $, documento, storage } = await pagina({ hash: enlace("otra@correo.cl"), guardado: pedido("profe@colegio.cl") });
  const pregunta = $("[data-link-confirm]");
  assert.equal(pregunta.hidden, false);
  assert.equal($("[data-login-form]").hidden, true);
  assert.equal($("[data-dashboard]").hidden, true);
  assert.equal(documento.documentElement.classList.contains("has-session"), false, "sin esqueleto: se ve la pregunta");
  assert.equal($("[data-link-title]").textContent, "¿Entrar como otra@correo.cl?");
  assert.equal($("[data-link-current]").hidden, true, "no había otra cuenta abierta");
  assert.equal(documento.activeElement, $("[data-link-title]"));
  assert.equal(guardada(storage), null, "mientras no responde, no hay sesión");

  await $("[data-link-accept]").disparar("click");
  await asentar();
  assert.equal(guardada(storage).refresh_token, "renovar-otra@correo.cl");
  assert.equal(pregunta.hidden, true);
  assert.equal($("[data-dashboard]").hidden, false);
  assert.equal(documento.activeElement, $("#sesion-titulo"));
  assert.ok(JSON.parse(storage.getItem("pteron-login-request")), "lo pedido para la otra cuenta sigue anotado");
});

test("con otra cuenta abierta, el enlace ajeno lo dice; «Cancelar» la deja abierta y el foco vuelve a ella", async () => {
  const { $, documento, storage } = await pagina({ hash: enlace("otra@correo.cl"), sesion: sesionDe("profe@colegio.cl") });
  assert.equal($("[data-link-confirm]").hidden, false);
  assert.equal($("[data-link-current]").hidden, false);
  assert.equal($("[data-link-current-email]").textContent, "profe@colegio.cl");
  assert.equal($("[data-dashboard]").hidden, true, "la cuenta abierta espera la respuesta");

  await $("[data-link-reject]").disparar("click");
  await asentar();
  assert.equal(guardada(storage).refresh_token, "renovar-profe@colegio.cl");
  assert.equal($("[data-link-confirm]").hidden, true);
  assert.equal($("[data-dashboard]").hidden, false);
  assert.equal(documento.documentElement.classList.contains("has-session"), true);
  assert.equal(documento.activeElement, $("#sesion-titulo"));
});

test("sin cuenta abierta, «Cancelar» deja el formulario con el foco en el correo", async () => {
  const { $, documento, storage } = await pagina({ hash: enlace("otra@correo.cl") });
  await $("[data-link-reject]").disparar("click");
  await asentar();
  assert.equal(guardada(storage), null);
  assert.equal($("[data-login-form]").hidden, false);
  assert.equal($("[data-dashboard]").hidden, true);
  assert.equal(documento.activeElement, $("#account-email"));
  const html = readFileSync(new URL("../public/cuenta/index.html", import.meta.url), "utf8");
  assert.match(html, /<h2 id="enlace-titulo" tabindex="-1" data-link-title>¿Entrar con este enlace\?<\/h2>/);
  assert.match(html, /<h2 id="sesion-titulo" tabindex="-1">/, "sin tabindex el título de la cuenta no recibe el foco");
});

test("el correo del enlace lo dice el servidor: un token alterado no entra sin preguntar ni reemplaza la sesión abierta", async () => {
  // Un token escrito a mano con el correo pedido, y un refresh_token de otra cuenta: el servidor no lo acepta
  const falso = `#access_token=${token({ email: "profe@colegio.cl" })}&refresh_token=renovar-de-otra&expires_in=3600`;
  const rechazo = { "/api/auth/me": { status: 401, body: { error: "not_authenticated", message: "La sesión ya no es válida." } } };
  const abierta = await pagina({ hash: falso, sesion: sesionDe("profe@colegio.cl"), guardado: pedido("profe@colegio.cl"), api: rechazo });
  assert.equal(guardada(abierta.storage).refresh_token, "renovar-profe@colegio.cl", "la sesión abierta sigue igual");
  assert.equal(abierta.$("[data-link-confirm]").hidden, true);
  assert.equal(abierta.$("[data-dashboard]").hidden, false);
  assert.equal(abierta.$("[data-account-notice-text]").textContent, "No pudimos comprobar ese enlace. Solicita uno nuevo para entrar.");
  assert.equal(abierta.$("[data-account-notice]").dataset.tone, "error");

  const sin = await pagina({ hash: falso, guardado: pedido("profe@colegio.cl"), api: rechazo });
  assert.equal(guardada(sin.storage), null);
  assert.equal(sin.$("[data-login-form]").hidden, false);
  assert.equal(sin.$("[data-dashboard]").hidden, true);
  assert.equal(sin.documento.documentElement.classList.contains("has-session"), false, "vuelve el formulario, no el esqueleto");

  // Si el servidor dice otra cuenta que la escrita en el token, manda la del servidor
  const otra = await pagina({ hash: falso, guardado: pedido("profe@colegio.cl"), api: { "/api/auth/me": { body: { user: { email: "Otra@Correo.cl" } } } } });
  assert.equal(otra.$("[data-link-confirm]").hidden, false);
  assert.equal(otra.$("[data-link-title]").textContent, "¿Entrar como otra@correo.cl?");
  assert.equal(guardada(otra.storage), null);
});

/* ---------- Entrar con Google o Apple (OpenID Connect con id_token) ---------- */

const STATE = "estado_de_prueba_0123456";
const NONCE = "nonce_de_prueba_0123456789abcdef";
const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.firma_del_proveedor";
const intento = (proveedor = "google", state = STATE, nonce = NONCE) => ({ "pteron-oauth": JSON.stringify({ value: `${proveedor}.${state}.${nonce}`, expiresAt: Date.now() + 30 * 60 * 1000 }) });
const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth?client_id=123-abc.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fpteron.patagua.dev%2Fcuenta&response_type=id_token";
const APPLE = "https://appleid.apple.com/auth/authorize?client_id=dev.patagua.pteron&response_mode=form_post";
const hex = (texto) => createHash("sha256").update(texto).digest("hex");

test("el nonce y el state: base64url al azar, y la huella del nonce es su SHA-256 en hex, la que Supabase compara", async () => {
  const [uno, otro] = [cuenta.randomToken(32), cuenta.randomToken(32)];
  assert.match(uno, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(uno, otro);
  assert.match(cuenta.randomToken(16), /^[A-Za-z0-9_-]{22}$/);
  assert.equal(await cuenta.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await cuenta.sha256Hex(uno), hex(uno));
});

test("el intento guardado al salir sólo vale con un proveedor nuestro, un state y un nonce con forma", () => {
  assert.deepEqual(plain(cuenta.oauthAttempt(`google.${STATE}.${NONCE}`)), { provider: "google", state: STATE, nonce: NONCE });
  assert.deepEqual(plain(cuenta.oauthAttempt(`apple.${STATE}.${NONCE}`)), { provider: "apple", state: STATE, nonce: NONCE });
  for (const malo of [`github.${STATE}.${NONCE}`, `constructor.${STATE}.${NONCE}`, `google.${STATE}`, `google..${NONCE}`, `google.corto.${NONCE}`, `google.${STATE}.${NONCE}.otro`, `google.${STATE}.${NONCE}+`, "", null, undefined]) {
    assert.equal(cuenta.oauthAttempt(malo), null, String(malo));
  }
});

test("la salida sólo se abre si es la dirección del proveedor elegido, por https", () => {
  assert.equal(cuenta.authorizeLink(GOOGLE, "google"), GOOGLE);
  assert.equal(cuenta.authorizeLink(APPLE, "apple"), APPLE);
  for (const [malo, proveedor] of [
    [GOOGLE, "apple"],
    [APPLE, "google"],
    [GOOGLE.replace("https:", "http:"), "google"],
    ["https://accounts.google.com.example.com/o/oauth2/v2/auth", "google"],
    ["https://accounts.google.com/o/oauth2/v2/auth/otra", "google"],
    ["https://usuario:clave@accounts.google.com/o/oauth2/v2/auth", "google"],
    ["https://fake.supabase.co/auth/v1/authorize?provider=google", "google"],
    ["javascript:alert(1)", "google"],
    [GOOGLE, "constructor"],
    ["", "google"],
    [null, "apple"],
  ]) {
    assert.equal(cuenta.authorizeLink(malo, proveedor), "", `${malo} (${proveedor})`);
  }
});

test("el error de la vuelta se dice con palabras nuestras; cancelar en Google o Apple no avisa nada", () => {
  const aviso = (consulta, proveedor) => cuenta.authErrorMessage(new URLSearchParams(consulta), proveedor);
  assert.equal(aviso("", "google"), "");
  assert.equal(aviso("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"), "El enlace venció o ya se usó. Pide uno nuevo.");
  assert.equal(aviso("error=access_denied&error_code=otp_expired", "google"), "El enlace venció o ya se usó. Pide uno nuevo.", "un enlace vencido es eso aunque haya un intento guardado");
  assert.equal(aviso("error=access_denied&state=x", "google"), "", "Google: el profe canceló");
  assert.equal(aviso("error=user_cancelled_authorize&state=x", "apple"), "", "Apple: el profe canceló");
  assert.equal(aviso("error=invalid_request&state=x", "apple"), "No pudimos completar la entrada con Apple. Vuelve a intentarlo o entra con tu correo.");
  // La URL la puede armar cualquiera: su texto no se muestra como si fuera nuestro
  const armado = aviso("error=server_error&error_description=Llama+al+600+000+0000+para+validar+tu+cuenta", "google");
  assert.equal(armado, "No pudimos completar la entrada con Google. Vuelve a intentarlo o entra con tu correo.");
  assert.doesNotMatch(armado, /Llama|600/);
  // Sin un intento de aquí, es un enlace que no se pudo abrir
  assert.equal(aviso("error=access_denied"), "No pudimos abrir ese enlace. Pide uno nuevo.");
  assert.equal(aviso("error_code=unexpected_failure", "constructor"), "No pudimos abrir ese enlace. Pide uno nuevo.");
});

test("«Continuar con Google» guarda el state y el nonce, manda sólo la huella del nonce y sale a Google", async () => {
  const p = await pagina({ api: { "/api/auth/oauth": { body: { url: GOOGLE } } } });
  assert.equal(p.$("[data-login-form]").hidden, false);
  const antes = p.llamadas.length;
  p.google.focus();
  const clic = p.google.disparar("click");
  // Mientras se arma la salida, los dos botones esperan y el elegido lo dice
  const durante = { google: p.google.disabled, apple: p.apple.disabled, etiqueta: p.google.etiqueta.textContent, otra: p.apple.etiqueta.textContent };
  await clic;
  assert.deepEqual(durante, { google: true, apple: true, etiqueta: "Abriendo Google…", otra: "Continuar con Apple" });
  const guardado = JSON.parse(p.storage.getItem("pteron-oauth"));
  const [proveedor, state, nonce] = guardado.value.split(".");
  assert.equal(proveedor, "google");
  assert.match(state, /^[A-Za-z0-9_-]{22}$/);
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(guardado.expiresAt > Date.now() && guardado.expiresAt <= Date.now() + 30 * 60 * 1000, "vence en media hora");
  // Al servidor (y al proveedor) va la huella del nonce, nunca el nonce
  const pedido = p.llamadas.slice(antes).find(({ ruta }) => ruta === "/api/auth/oauth");
  assert.deepEqual(pedido.cuerpo, { provider: "google", state, nonce_hash: hex(nonce) });
  assert.equal(JSON.stringify(p.llamadas).includes(nonce), false);
  assert.deepEqual(p.salidas, [GOOGLE]);
});

test("si el servidor no ofrece el proveedor, se dice junto a los botones, nada queda guardado y el foco vuelve al botón", async () => {
  const apagado = { status: 503, body: { error: "provider_unavailable", message: "La entrada con Apple no está disponible ahora. Entra con tu correo." } };
  const salida = (opciones) => (JSON.parse(opciones.body).provider === "apple" ? apagado : { body: { url: GOOGLE } });
  const p = await pagina({ api: { "/api/auth/oauth": salida } });
  p.apple.focus();
  await p.apple.disparar("click");
  assert.equal(p.$("[data-oauth-message]").textContent, "La entrada con Apple no está disponible ahora. Entra con tu correo.");
  assert.equal(p.storage.getItem("pteron-oauth"), null);
  assert.deepEqual(p.salidas, []);
  assert.equal(p.google.disabled, false);
  assert.equal(p.apple.disabled, false);
  assert.equal(p.apple.etiqueta.textContent, "Continuar con Apple");
  assert.equal(p.documento.activeElement, p.apple);
  // Con Google, que sí está, el aviso de Apple se va y sale
  await p.google.disparar("click");
  assert.equal(p.$("[data-oauth-message]").textContent, "");
  assert.deepEqual(p.salidas, [GOOGLE]);

  // Sin red, en castellano; una dirección que no es la del proveedor elegido no se abre
  const sinRed = await pagina({ api: { "/api/auth/oauth": new TypeError("Failed to fetch") } });
  await sinRed.google.disparar("click");
  assert.equal(sinRed.$("[data-oauth-message]").textContent, "No pudimos abrir Google. Revisa tu conexión y vuelve a intentarlo.");
  const ajena = await pagina({ api: { "/api/auth/oauth": { body: { url: APPLE } } } });
  await ajena.google.disparar("click");
  assert.deepEqual(ajena.salidas, []);
  assert.equal(ajena.storage.getItem("pteron-oauth"), null);
  assert.equal(ajena.$("[data-oauth-message]").textContent, "No pudimos abrir Google. Vuelve a intentarlo o entra con tu correo.");
});

test("un navegador que no deja guardar el intento no sale: la vuelta no tendría con qué entrar", async () => {
  const p = await pagina({ almacen: fakeStorage({ broken: true }), api: { "/api/auth/oauth": { body: { url: GOOGLE } } } });
  await p.google.disparar("click");
  assert.deepEqual(p.salidas, []);
  assert.equal(p.$("[data-oauth-message]").textContent, "Este navegador no deja guardar datos de este sitio, y sin eso la entrada con Google no se completa. Entra con tu correo.");
  assert.equal(p.google.disabled, false);
});

test("al volver con «Atrás» desde Google, los botones están libres otra vez", async () => {
  const p = await pagina({ api: { "/api/auth/oauth": { body: { url: GOOGLE } } } });
  await p.google.disparar("click");
  assert.equal(p.google.disabled, true, "salió: la página quedó esperando");
  for (const fn of p.oyentes.get("pageshow")) fn({ persisted: true });
  assert.equal(p.google.disabled, false);
  assert.equal(p.apple.disabled, false);
  assert.equal(p.google.etiqueta.textContent, "Continuar con Google");
});

test("la vuelta de Google con el id_token y el state de este navegador: se cambia por una sesión, una vez, y sale de la URL", async () => {
  const sesion = { body: { access_token: "acceso-g", refresh_token: "renovar-g", expires_in: 3600, token_type: "bearer" } };
  const hash = `#state=${STATE}&id_token=${ID_TOKEN}&authuser=0&prompt=consent`;
  const p = await pagina({ hash, guardado: intento("google"), api: { "/api/auth/id-token": sesion } });
  // A Supabase va el nonce guardado aquí, que es el que el proveedor firmó como huella
  assert.deepEqual(p.llamadas.find(({ ruta }) => ruta === "/api/auth/id-token").cuerpo, { provider: "google", id_token: ID_TOKEN, nonce: NONCE });
  const guardadaAhora = guardada(p.storage);
  assert.equal(guardadaAhora.access_token, "acceso-g");
  assert.equal(guardadaAhora.refresh_token, "renovar-g");
  assert.ok(guardadaAhora.expires_at > Date.now());
  assert.equal(p.storage.getItem("pteron-oauth"), null, "el intento se usa una vez");
  assert.equal(p.$("[data-dashboard]").hidden, false);
  assert.equal(p.$("[data-link-confirm]").hidden, true, "no pregunta: salió de este navegador");
  assert.equal(p.direccion(), "https://pteron.patagua.dev/cuenta", "el id_token no queda en la URL");
  // Apple vuelve por /api/auth/apple-callback, que agrega provider=apple
  const apple = await pagina({ hash: `#provider=apple&id_token=${ID_TOKEN}&state=${STATE}`, guardado: intento("apple"), api: { "/api/auth/id-token": sesion } });
  assert.equal(apple.llamadas.find(({ ruta }) => ruta === "/api/auth/id-token").cuerpo.provider, "apple");
  assert.equal(apple.$("[data-dashboard]").hidden, false);
});

test("un id_token sin el state de este navegador no se usa: ni uno ajeno ni el de otro proveedor", async () => {
  const intentos = (p) => p.llamadas.filter(({ ruta }) => ruta === "/api/auth/id-token").length;
  // Sin intento guardado (un enlace armado por otra persona): nada, ni esqueleto ni aviso
  const ajeno = await pagina({ hash: `#state=${STATE}&id_token=${ID_TOKEN}` });
  assert.equal(intentos(ajeno), 0);
  assert.equal(guardada(ajeno.storage), null);
  assert.equal(ajeno.$("[data-login-form]").hidden, false);
  assert.equal(ajeno.documento.documentElement.classList.contains("has-session"), false);
  assert.equal(ajeno.$("[data-account-notice]").hidden, true);
  assert.equal(ajeno.direccion(), "https://pteron.patagua.dev/cuenta");
  // Con un intento, pero otro state o el de otro proveedor: no entra, se descarta el intento y se dice
  for (const hash of [`#state=otro_estado_0123456789ab&id_token=${ID_TOKEN}`, `#provider=apple&id_token=${ID_TOKEN}&state=${STATE}`, `#id_token=${ID_TOKEN}`]) {
    const p = await pagina({ hash, guardado: intento("google") });
    assert.equal(intentos(p), 0, hash);
    assert.equal(guardada(p.storage), null);
    assert.equal(p.storage.getItem("pteron-oauth"), null);
    assert.equal(p.$("[data-account-notice-text]").textContent, "No pudimos completar la entrada con Google. Vuelve a intentarlo o entra con tu correo.");
  }
  // Una sesión ya abierta sigue como estaba
  const abierta = await pagina({ hash: `#state=${STATE}&id_token=${ID_TOKEN}`, sesion: sesionDe("profe@colegio.cl") });
  assert.equal(intentos(abierta), 0);
  assert.equal(guardada(abierta.storage).refresh_token, "renovar-profe@colegio.cl");
  assert.equal(abierta.$("[data-dashboard]").hidden, false);
});

test("si Supabase no acepta el id_token, no se abre nada: vuelve el formulario con el aviso y el intento se descarta", async () => {
  const rechazo = { status: 400, body: { error: "invalid_grant", message: "No pudimos completar la entrada con Apple. Vuelve a intentarlo o entra con tu correo." } };
  const hash = `#provider=apple&id_token=${ID_TOKEN}&state=${STATE}`;
  const p = await pagina({ hash, guardado: intento("apple"), api: { "/api/auth/id-token": rechazo } });
  assert.equal(guardada(p.storage), null);
  assert.equal(p.storage.getItem("pteron-oauth"), null);
  assert.equal(p.$("[data-login-form]").hidden, false);
  assert.equal(p.$("[data-dashboard]").hidden, true);
  assert.equal(p.documento.documentElement.classList.contains("has-session"), false, "sin esqueleto: vuelve el formulario");
  assert.equal(p.$("[data-account-notice-text]").textContent, "No pudimos completar la entrada con Apple. Vuelve a intentarlo o entra con tu correo.");
  assert.equal(p.$("[data-account-notice]").dataset.tone, "error");
  // Sin red, en castellano y con el proveedor
  const sinRed = await pagina({ hash, guardado: intento("apple"), api: { "/api/auth/id-token": new TypeError("Failed to fetch") } });
  assert.equal(sinRed.$("[data-account-notice-text]").textContent, "No pudimos completar la entrada con Apple. Vuelve a intentarlo.");
});

test("la vuelta con error: cancelar no avisa, otro error se dice con palabras nuestras y todo sale de la URL", async () => {
  const cancelo = await pagina({ hash: `#error=access_denied&state=${STATE}`, guardado: intento("google") });
  assert.equal(cancelo.$("[data-account-notice]").hidden, true);
  assert.equal(cancelo.$("[data-login-form]").hidden, false);
  assert.equal(cancelo.storage.getItem("pteron-oauth"), null, "el intento se descarta");
  assert.equal(cancelo.direccion(), "https://pteron.patagua.dev/cuenta");
  const apple = await pagina({ hash: `#error=user_cancelled_authorize&state=${STATE}`, guardado: intento("apple") });
  assert.equal(apple.$("[data-account-notice]").hidden, true);

  const fallo = await pagina({ hash: `#error=invalid_request&state=${STATE}`, guardado: intento("apple") });
  assert.equal(fallo.$("[data-account-notice-text]").textContent, "No pudimos completar la entrada con Apple. Vuelve a intentarlo o entra con tu correo.");
  assert.equal(fallo.$("[data-account-notice]").dataset.tone, "error");
  // Un error sin el state del intento no se atribuye a Google: es un enlace que no se pudo abrir
  const ajeno = await pagina({ hash: "#error=server_error", guardado: intento("google") });
  assert.equal(ajeno.$("[data-account-notice-text]").textContent, "No pudimos abrir ese enlace. Pide uno nuevo.");
});

test("un enlace mágico vencido lo dice en castellano, no con el texto (en inglés, o armado) que trae la URL", async () => {
  const p = await pagina({ hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired" });
  assert.equal(p.$("[data-account-notice-text]").textContent, "El enlace venció o ya se usó. Pide uno nuevo.");
  assert.equal(p.$("[data-login-message]").textContent, "");
  assert.equal(p.direccion(), "https://pteron.patagua.dev/cuenta");
  const armado = await pagina({ hash: "#error=server_error&error_description=Llama+al+600+000+0000" });
  assert.equal(armado.$("[data-account-notice-text]").textContent, "No pudimos abrir ese enlace. Pide uno nuevo.");
  // En la consulta, igual; y con la cuenta ya abierta, el aviso queda sobre ella
  const consulta = await pagina({ url: "https://pteron.patagua.dev/cuenta?error=access_denied&error_code=otp_expired&error_description=x" });
  assert.equal(consulta.$("[data-account-notice-text]").textContent, "El enlace venció o ya se usó. Pide uno nuevo.");
  assert.equal(consulta.direccion(), "https://pteron.patagua.dev/cuenta");
  const abierta = await pagina({ hash: "#error=access_denied&error_code=otp_expired", sesion: true });
  assert.equal(abierta.$("[data-dashboard]").hidden, false);
  assert.equal(abierta.$("[data-account-notice-text]").textContent, "El enlace venció o ya se usó. Pide uno nuevo.");
  // El code de Flow sigue siendo el aviso del pago
  const flow = await pagina({ url: "https://pteron.patagua.dev/cuenta?billing=error&code=flow_error", sesion: true, guardado: intento("google") });
  assert.match(flow.$("[data-account-notice-text]").textContent, /\(código: flow_error\)$/);
  assert.ok(flow.storage.getItem("pteron-oauth"), "no se gastó el intento");
});

test("el HTML: los botones de Google y Apple antes del correo, con su etiqueta, y el esqueleto para la vuelta con id_token", () => {
  const html = readFileSync(new URL("../public/cuenta/index.html", import.meta.url), "utf8");
  const form = html.slice(html.indexOf("<form class=\"acceso-hoja\" data-login-form"), html.indexOf("</form>"));
  const bloque = /<div class="acceso-proveedores" data-oauth[^>]*>([\s\S]*?)<\/div>/.exec(form);
  assert.ok(bloque, "el bloque de proveedores está en el formulario de entrada");
  assert.ok(form.indexOf("data-oauth") < form.indexOf('id="account-email"'), "antes del correo");
  for (const [proveedor, nombre] of [["google", "Google"], ["apple", "Apple"]]) {
    assert.match(bloque[1], new RegExp(`<button class="boton acceso-proveedor" type="button" data-oauth-provider="${proveedor}"><svg [^>]*aria-hidden="true"[^>]*>[\\s\\S]*?</svg><span data-oauth-label>Continuar con ${nombre}</span></button>`));
  }
  assert.match(bloque[1], /<p class="acceso-error" data-oauth-message role="alert"><\/p>/);
  // El script en línea: con un id_token en el fragmento y el intento guardado, espera la cuenta con el esqueleto
  const enLinea = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const corre = (hash, guardado) => {
    const clases = new Set();
    const documentElement = { classList: { replace() {}, add: (c) => clases.add(c) } };
    const localStorage = { getItem: (clave) => (clave === "pteron-oauth" ? guardado : null) };
    vm.runInNewContext(enLinea, { document: { documentElement }, localStorage, location: { search: "", hash } });
    return clases.has("has-session");
  };
  assert.equal(corre(`#state=x&id_token=${ID_TOKEN}`, "{}"), true);
  assert.equal(corre(`#provider=apple&id_token=${ID_TOKEN}`, "{}"), true);
  assert.equal(corre(`#id_token=${ID_TOKEN}`, null), false, "sin intento guardado, no");
  assert.equal(corre("#access_token=a&refresh_token=b", null), true, "el enlace mágico, como siempre");
  assert.equal(corre("#error=access_denied", "{}"), false);
  assert.equal(corre("#not_id_token=1", "{}"), false);
  const css = readFileSync(new URL("../public/cuenta/cuenta.css", import.meta.url), "utf8");
  assert.match(css, /\.no-js \.acceso-hoja \.campo,\.no-js \.acceso-enviar,\.no-js \.acceso-proveedores\{display:none\}/, "sin JavaScript no hay nonce");
});
