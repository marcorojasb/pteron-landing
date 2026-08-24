const { createHmac } = require("node:crypto");
const { HttpError } = require("./http");

function flowBaseUrl() {
  return String(process.env.FLOW_BASE_URL || "https://sandbox.flow.cl/api").trim().replace(/\/$/, "");
}

function flowCredentials() {
  const apiKey = String(process.env.FLOW_API_KEY || "").trim();
  const secretKey = String(process.env.FLOW_SECRET_KEY || "").trim();
  if (!apiKey || !secretKey) {
    throw new HttpError(503, "billing_not_configured", "El cobro todavía no está configurado.");
  }
  return { apiKey, secretKey };
}

function signedParams(params, secretKey) {
  const canonical = Object.keys(params)
    .filter((key) => key !== "s" && params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}${String(params[key])}`)
    .join("");
  return createHmac("sha256", secretKey).update(canonical).digest("hex");
}

async function request(path, params = {}, method = "POST") {
  const { apiKey, secretKey } = flowCredentials();
  const values = { ...params, apiKey };
  values.s = signedParams(values, secretKey);
  const url = new URL(`${flowBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  const init = { method, headers: { Accept: "application/json" } };
  if (method === "GET") {
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
    throw new HttpError(502, "flow_error", message);
  }
  return data || {};
}

// La cuenta de Flow es compartida con otros productos de Patagua, cuyos planes
// siguen la forma `<producto>-monthly`. El prefijo evita que un id de pteron se
// confunda con uno ajeno: en la misma cuenta ya vive un plan llamado
// `pro-monthly` que cuesta otra cosa. Flow fija el monto al crear el plan y no
// lo actualiza después, así que cambiar este id crea un plan nuevo en vez de
// modificar el anterior.
function planId(plan) {
  const configured = plan === "basic" ? process.env.FLOW_BASIC_PLAN_ID : process.env.FLOW_PRO_PLAN_ID;
  return String(configured || `pteron-${plan}-monthly`).trim();
}

async function createPlan({ id, name, amount, trialPeriodDays, callbackUrl }) {
  return request("/plans/create", {
    planId: id,
    name,
    currency: "CLP",
    amount,
    interval: 3,
    interval_count: 1,
    trial_period_days: trialPeriodDays,
    periods_number: 0,
    charges_retries_number: 3,
    urlCallback: callbackUrl,
  });
}

async function createCustomer({ name, email, externalId }) {
  return request("/customer/create", { name, email, externalId });
}

async function registerCustomer({ customerId, returnUrl }) {
  const result = await request("/customer/register", { customerId, url_return: returnUrl });
  if (!result?.url || !result?.token) throw new HttpError(502, "flow_error", "Flow no entregó el enlace de registro.");
  return { ...result, redirectUrl: `${result.url}${String(result.url).includes("?") ? "&" : "?"}token=${encodeURIComponent(result.token)}` };
}

async function registerStatus(token) {
  return request("/customer/getRegisterStatus", { token }, "GET");
}

async function createSubscription({ planId: id, customerId, trialPeriodDays }) {
  return request("/subscription/create", {
    planId: id,
    customerId,
    trial_period_days: trialPeriodDays,
  });
}

async function cancelSubscription({ subscriptionId, atPeriodEnd = 1 }) {
  return request("/subscription/cancel", { subscriptionId, at_period_end: atPeriodEnd });
}

async function paymentStatus(token) {
  return request("/payment/getStatus", { token }, "GET");
}

function flowSuccess(result) {
  const value = result?.status ?? result?.registered ?? result?.success;
  return value === true || value === 1 || value === "1" || ["ok", "success", "successful", "registered", "active"].includes(String(value).toLowerCase());
}

function flowValue(result, ...keys) {
  for (const key of keys) {
    if (result?.[key] !== undefined && result?.[key] !== null && String(result[key])) return result[key];
  }
  return null;
}

module.exports = {
  cancelSubscription,
  createCustomer,
  createPlan,
  createSubscription,
  flowBaseUrl,
  flowSuccess,
  flowValue,
  paymentStatus,
  planId,
  registerCustomer,
  registerStatus,
  request,
};
