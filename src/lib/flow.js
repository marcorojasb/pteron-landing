import { HttpError } from "./http.js";
import { hmacSha256Hex } from "./crypto.js";

/** La API de producción de Flow: la única que cobra de verdad. */
export const FLOW_PRODUCTION_URL = "https://www.flow.cl/api";
const FLOW_SANDBOX_URL = "https://sandbox.flow.cl/api";
const PRODUCTION_HOST = "pteron.patagua.dev";
// Flow no publica un tiempo de respuesta: sin tope, una llamada colgada deja
// esperando al docente y, en subscription/create, sin saber qué pasó.
const FLOW_TIMEOUT_MS = 10_000;

// Lectores tipados. Cada respuesta de Flow se lee con los nombres de su esquema
// oficial (apiFlow.yaml: Subscription, Invoice, Plan, PaymentStatus,
// RegisterResult y Customer) y con ningún otro: un alias que Flow no envía
// nunca llega, y una prueba que lo simula sólo valida un contrato inventado.
// Flow manda algunos números como texto ('1'), así que se normalizan; lo que no
// viene, o viene con otra forma, queda en null.

function flowNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function flowText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Invoice: un importe de la suscripción. status 0 impago, 1 pagado, 2 anulado. */
export function readInvoice(raw) {
  return {
    id: flowNumber(raw?.id),
    status: flowNumber(raw?.status),
    period_start: flowText(raw?.period_start),
    period_end: flowText(raw?.period_end),
    paymentLink: flowText(raw?.paymentLink),
    // El pago del importe (PaymentStatus): su flowOrder es lo que permite
    // reconocer de qué suscripción habla un aviso de pago.
    payment: raw?.payment ? { flowOrder: flowNumber(raw.payment.flowOrder) } : null,
  };
}

/**
 * Subscription. status 0 no iniciada, 1 activa, 2 en prueba, 4 cancelada;
 * morose 0 al día, 1 con importes vencidos, 2 con importes por vencer.
 */
export function readSubscription(raw) {
  return {
    subscriptionId: flowText(raw?.subscriptionId),
    planId: flowText(raw?.planId),
    customerId: flowText(raw?.customerId),
    status: flowNumber(raw?.status),
    morose: flowNumber(raw?.morose),
    cancel_at_period_end: flowNumber(raw?.cancel_at_period_end),
    cancel_at: flowText(raw?.cancel_at),
    created: flowText(raw?.created),
    trial_period_days: flowNumber(raw?.trial_period_days),
    trial_start: flowText(raw?.trial_start),
    trial_end: flowText(raw?.trial_end),
    next_invoice_date: flowText(raw?.next_invoice_date),
    invoices: Array.isArray(raw?.invoices) ? raw.invoices.map(readInvoice) : [],
  };
}

/** Plan. interval 3 = mensual; status 1 activo, 0 eliminado. */
export function readPlan(raw) {
  return {
    planId: flowText(raw?.planId),
    name: flowText(raw?.name),
    currency: flowText(raw?.currency),
    amount: flowNumber(raw?.amount),
    interval: flowNumber(raw?.interval),
    interval_count: flowNumber(raw?.interval_count),
    trial_period_days: flowNumber(raw?.trial_period_days),
    urlCallback: flowText(raw?.urlCallback),
    status: flowNumber(raw?.status),
  };
}

/** PaymentStatus. status 1 pendiente de pago, 2 pagada, 3 rechazada, 4 anulada. */
export function readPaymentStatus(raw) {
  return {
    flowOrder: flowNumber(raw?.flowOrder),
    commerceOrder: flowText(raw?.commerceOrder),
    status: flowNumber(raw?.status),
    amount: flowNumber(raw?.amount),
    payer: flowText(raw?.payer),
  };
}

/** RegisterResult. status 1 tarjeta registrada, 0 no registrada. */
export function readRegisterResult(raw) {
  return { status: flowNumber(raw?.status), customerId: flowText(raw?.customerId) };
}

/**
 * Flow respondió con su objeto Error (HTTP 400 o 401): rechazó la operación y
 * no la hizo. Un 5xx o una red caída no dicen nada de lo que pasó allá.
 */
export function flowRejected(error) {
  return error instanceof HttpError && error.code === "flow_error" && [400, 401].includes(error.details?.flowStatus);
}

/** Cliente de Flow (registro de tarjeta, planes, suscripciones y cobros) con firma HMAC-SHA256. */
export function createFlow(env) {
  function misconfigured(reason) {
    console.error("pteron flow config", { reason });
    return new HttpError(503, "billing_misconfigured", "El cobro está mal configurado; no se cobra nada hasta corregirlo.");
  }

  function productionSite() {
    try {
      return new URL(String(env?.PUBLIC_SITE_URL || "").trim()).hostname === PRODUCTION_HOST;
    } catch {
      return false;
    }
  }

  // Sin valor por defecto: una base ausente o desconocida no cobra en ningún
  // lado. El sitio de producción sólo cobra en la API de producción; el sandbox
  // con ese sitio exige FLOW_ALLOW_SANDBOX = "1", pensado para el desarrollo
  // local, donde PUBLIC_SITE_URL sigue siendo el de wrangler.jsonc. Con llaves
  // de sandbox en producción, la tarjeta de prueba pública de Flow regalaría el plan.
  function flowBaseUrl() {
    const base = String(env?.FLOW_BASE_URL || "").trim().replace(/\/+$/, "");
    if (base !== FLOW_PRODUCTION_URL && base !== FLOW_SANDBOX_URL) throw misconfigured("FLOW_BASE_URL ausente o desconocida");
    if (base !== FLOW_PRODUCTION_URL && productionSite() && String(env?.FLOW_ALLOW_SANDBOX || "").trim() !== "1") {
      throw misconfigured("FLOW_BASE_URL no es la de producción en el sitio de producción");
    }
    return base;
  }

  function flowCredentials() {
    const apiKey = String(env?.FLOW_API_KEY || "").trim();
    const secretKey = String(env?.FLOW_SECRET_KEY || "").trim();
    if (!apiKey || !secretKey) {
      throw new HttpError(503, "billing_not_configured", "El cobro todavía no está configurado.");
    }
    return { apiKey, secretKey };
  }

  async function signedParams(params, secretKey) {
    const canonical = Object.keys(params)
      .filter((key) => key !== "s" && params[key] !== undefined && params[key] !== null)
      .sort()
      .map((key) => `${key}${String(params[key])}`)
      .join("");
    return hmacSha256Hex(secretKey, canonical);
  }

  async function request(path, params = {}, requestMethod = "POST") {
    const baseUrl = flowBaseUrl();
    const { apiKey, secretKey } = flowCredentials();
    const values = { ...params, apiKey };
    values.s = await signedParams(values, secretKey);
    const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    // Un vencimiento rechaza el fetch como una red caída: no es un rechazo de Flow.
    const init = { method: requestMethod, headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FLOW_TIMEOUT_MS) };
    if (requestMethod === "GET") {
      for (const [key, value] of Object.entries(values)) url.searchParams.set(key, String(value));
    } else {
      init.headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      init.body = new URLSearchParams(
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
      );
    }
    const response = await fetch(url, init);
    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { raw };
    }
    if (!response.ok || data?.error) {
      const message = typeof data?.message === "string" ? data.message : "Flow rechazó la solicitud.";
      throw new HttpError(502, "flow_error", message, { flowStatus: response.status });
    }
    return data || {};
  }

  // La cuenta de Flow es compartida con otros productos de Patagua: el prefijo
  // pteron- evita confundir un plan propio con uno ajeno. Flow fija el monto al
  // crear el plan y no deja cambiarlo si tiene suscriptores, así que cada precio
  // tiene su id (pteron-basic-1990-mensual) en wrangler.jsonc. Sin id no hay
  // cobro: un id por defecto podría apuntar a un plan viejo con otro monto.
  function planId(plan) {
    const configured = plan === "basic" ? env?.FLOW_BASIC_PLAN_ID : plan === "pro" ? env?.FLOW_PRO_PLAN_ID : null;
    const id = String(configured || "").trim();
    if (!id) throw misconfigured(`sin id de plan de Flow para ${plan}`);
    return id;
  }

  async function createPlan({ id, name, amount, trialPeriodDays, callbackUrl }) {
    return readPlan(await request("/plans/create", {
      planId: id,
      name,
      currency: "CLP",
      amount,
      interval: 3,
      interval_count: 1,
      trial_period_days: trialPeriodDays,
      days_until_due: 3,
      periods_number: 0,
      charges_retries_number: 3,
      urlCallback: callbackUrl,
    }));
  }

  /** GET /plans/get. null si Flow lo rechaza (el plan no existe, o no es de esta cuenta). */
  async function getPlan(id) {
    try {
      return readPlan(await request("/plans/get", { planId: id }, "GET"));
    } catch (error) {
      if (flowRejected(error)) return null;
      throw error;
    }
  }

  async function createCustomer({ name, email, externalId }) {
    const customerId = flowText((await request("/customer/create", { name, email, externalId }))?.customerId);
    if (!customerId) throw new HttpError(502, "flow_error", "Flow no entregó el identificador del cliente.");
    return { customerId };
  }

  async function registerCustomer({ customerId, returnUrl }) {
    const result = await request("/customer/register", { customerId, url_return: returnUrl });
    const url = flowText(result?.url);
    const token = flowText(result?.token);
    if (!url || !token) throw new HttpError(502, "flow_error", "Flow no entregó el enlace de registro.");
    return { url, token, redirectUrl: `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` };
  }

  async function registerStatus(token) {
    return readRegisterResult(await request("/customer/getRegisterStatus", { token }, "GET"));
  }

  async function createSubscription({ planId: id, customerId, trialPeriodDays }) {
    const subscription = readSubscription(await request("/subscription/create", { planId: id, customerId, trial_period_days: trialPeriodDays }));
    if (!subscription.subscriptionId) throw new HttpError(502, "flow_error", "Flow no entregó el identificador de la suscripción.");
    return subscription;
  }

  /** GET /subscription/get: la fuente de verdad del estado y de lo pagado. */
  async function getSubscription(subscriptionId) {
    const subscription = readSubscription(await request("/subscription/get", { subscriptionId }, "GET"));
    if (subscription.subscriptionId !== subscriptionId || subscription.status === null) {
      throw new HttpError(502, "flow_error", "Flow no entregó la suscripción pedida.");
    }
    return subscription;
  }

  /**
   * GET /customer/getSubscriptions: la primera página (hasta 100) de las
   * suscripciones del cliente, como el List de Flow. `data` llega como arreglo
   * o como texto JSON; si no se puede leer, el error sube: una lista vacía
   * por error haría pasar por no creada una suscripción que sí existe.
   */
  async function customerSubscriptions(customerId) {
    const list = await request("/customer/getSubscriptions", { customerId, start: 0, limit: 100 }, "GET");
    let items = list.data;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = null;
      }
    }
    if (!Array.isArray(items)) throw new HttpError(502, "flow_error", "Flow no entregó la lista de suscripciones.");
    return {
      total: flowNumber(list.total),
      hasMore: list.hasMore === true || flowNumber(list.hasMore) === 1,
      data: items.map(readSubscription),
    };
  }

  // Sin valor por defecto: cancelar en el acto (0) o al cierre del período
  // pagado (1) lo decide quien llama, nunca un olvido.
  async function cancelSubscription({ subscriptionId, atPeriodEnd }) {
    const flag = atPeriodEnd === true ? 1 : atPeriodEnd === false ? 0 : atPeriodEnd;
    if (flag !== 0 && flag !== 1) throw new TypeError("cancelSubscription exige atPeriodEnd 0 o 1.");
    return readSubscription(await request("/subscription/cancel", { subscriptionId, at_period_end: flag }));
  }

  async function paymentStatus(token) {
    const payment = readPaymentStatus(await request("/payment/getStatus", { token }, "GET"));
    if (payment.flowOrder === null || ![1, 2, 3, 4].includes(payment.status)) {
      throw new HttpError(502, "flow_error", "Flow no entregó el estado del pago.");
    }
    return payment;
  }

  return {
    cancelSubscription,
    createCustomer,
    createPlan,
    createSubscription,
    customerSubscriptions,
    flowBaseUrl,
    getPlan,
    getSubscription,
    paymentStatus,
    planId,
    registerCustomer,
    registerStatus,
    request,
    signedParams,
  };
}
