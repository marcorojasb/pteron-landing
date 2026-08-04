const { createHash } = require("node:crypto");
const {
  body,
  handler,
  HttpError,
  json,
  method,
  redirect,
  requestUrl,
  requireAuth,
  requireString,
  siteUrl,
} = require("../_lib/http");
const { authUser, insert, select, update } = require("../_lib/supabase");
const {
  cancelSubscription,
  createCustomer,
  createPlan,
  createSubscription,
  flowSuccess,
  flowValue,
  paymentStatus,
  planId,
  registerCustomer,
  registerStatus,
} = require("../_lib/flow");

// Un solo archivo detrás de las cuatro rutas de /api/billing/*: el plan
// Hobby de Vercel tope a 12 funciones por deployment, y el proyecto ya
// estaba en el límite antes de sumar el gateway. Las URLs externas no
// cambian — Flow y la cuenta web siguen llamando exactamente a
// /api/billing/checkout, /cancel, /card-callback y /flow-callback.

const PLAN_DEFAULTS = {
  basic: { name: "pteron Basic", amount: 2999, trialPeriodDays: 7 },
  pro: { name: "pteron Pro", amount: 9990, trialPeriodDays: 0 },
};

function existingCustomer(rows) {
  return rows?.find((row) => row.provider_customer_id)?.provider_customer_id || null;
}

async function ensureFlowPlan(plan, callbackUrl) {
  const defaults = PLAN_DEFAULTS[plan];
  const id = planId(plan);
  try {
    await createPlan({ id, ...defaults, callbackUrl });
  } catch (error) {
    // Flow identifica un plan ya creado como error de API. Conservar el id
    // configurado deja que los reintentos avancen sin crear duplicados.
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("exist") && !message.includes("duplic") && !message.includes("already")) throw error;
  }
  return id;
}

function paymentState(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (["1", "paid", "success", "successful", "approved"].includes(normalized)) return "active";
  if (["2", "rejected", "failed", "error"].includes(normalized)) return "past_due";
  if (["3", "pending", "processing"].includes(normalized)) return null;
  if (["4", "cancelled", "canceled"].includes(normalized)) return "canceled";
  return null;
}

function flowDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function checkout(req, res) {
  method(req, "POST");
  const token = requireAuth(req);
  const user = await authUser(token);
  const input = await body(req);
  const plan = requireString(input.plan, "plan", 20).toLowerCase();
  if (!PLAN_DEFAULTS[plan]) throw new HttpError(400, "invalid_plan", "Ese plan no está disponible.");

  const userId = encodeURIComponent(user.id);
  const current = await select(
    "subscriptions",
    `user_id=eq.${userId}&status=in.(incomplete,trialing,active,past_due,paused)&select=id,plan_id,status&limit=1`,
    { admin: true },
  );
  if (current?.[0]) throw new HttpError(409, "subscription_exists", "Ya tienes un plan en curso. Puedes administrarlo desde tu cuenta.");

  const previousIntents = await select(
    "billing_checkout_intents",
    `user_id=eq.${userId}&provider_customer_id=not.is.null&select=provider_customer_id&order=created_at.desc&limit=5`,
    { admin: true },
  );
  const customerId = existingCustomer(previousIntents) || String((await createCustomer({
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "pteron",
    email: user.email,
    externalId: user.id,
  })).customerId || "").trim();
  if (!customerId) throw new HttpError(502, "flow_error", "Flow no entregó el identificador del cliente.");

  const providerPlanId = await ensureFlowPlan(plan, `${siteUrl(req)}/api/billing/flow-callback`);
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const intentRows = await insert("billing_checkout_intents", {
    user_id: user.id,
    plan_id: plan,
    provider_customer_id: customerId,
    provider_plan_id: providerPlanId,
    status: "card_registration_pending",
    expires_at: expiresAt,
  }, { admin: true });
  const intent = intentRows[0];
  if (!intent?.id) throw new HttpError(502, "server_error", "No pudimos preparar el checkout.");
  try {
    const registration = await registerCustomer({
      customerId,
      returnUrl: `${siteUrl(req)}/api/billing/card-callback?intent=${encodeURIComponent(intent.id)}`,
    });
    json(res, 200, {
      ok: true,
      redirectUrl: registration.redirectUrl,
      plan,
      trialPeriodDays: PLAN_DEFAULTS[plan].trialPeriodDays,
      expiresAt,
    });
  } catch (error) {
    await update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "failed" }, { admin: true }).catch(() => undefined);
    throw error;
  }
}

async function cancel(req, res) {
  method(req, "POST");
  const user = await authUser(requireAuth(req));
  await body(req);
  const userId = encodeURIComponent(user.id);
  const rows = await select(
    "subscriptions",
    `user_id=eq.${userId}&status=in.(trialing,active,past_due,paused)&select=id,provider_subscription_id,current_period_end&order=created_at.desc&limit=1`,
    { admin: true },
  );
  const subscription = rows?.[0];
  if (!subscription) throw new HttpError(404, "subscription_missing", "No encontramos un plan activo.");
  if (!subscription.provider_subscription_id) throw new HttpError(409, "subscription_pending", "El plan todavía está terminando de configurarse.");
  await cancelSubscription({ subscriptionId: subscription.provider_subscription_id, atPeriodEnd: 1 });
  await update(
    "subscriptions",
    `id=eq.${encodeURIComponent(subscription.id)}`,
    { cancel_at_period_end: true },
    { admin: true },
  );
  json(res, 200, { ok: true, cancelAt: subscription.current_period_end || null });
}

async function cardCallback(req, res) {
  const url = requestUrl(req);
  const input = await body(req);
  const intentId = String(url.searchParams.get("intent") || "").trim();
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!intentId || !token) throw new HttpError(400, "invalid_callback", "El retorno de Flow no está completo.");
  const intents = await select(
    "billing_checkout_intents",
    `id=eq.${encodeURIComponent(intentId)}&select=id,user_id,plan_id,provider_customer_id,provider_plan_id,status,expires_at&limit=1`,
    { admin: true },
  );
  const intent = intents?.[0];
  if (!intent || Date.parse(intent.expires_at) <= Date.now()) throw new HttpError(410, "checkout_expired", "Este checkout ya venció.");
  if (intent.status === "completed") {
    redirect(res, `${siteUrl(req)}/cuenta/?billing=success`);
    return;
  }
  const status = await registerStatus(token);
  if (!flowSuccess(status)) {
    await update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "failed" }, { admin: true });
    redirect(res, `${siteUrl(req)}/cuenta/?billing=cancelled`);
    return;
  }
  const customerId = String(flowValue(status, "customerId", "customer_id") || intent.provider_customer_id || "");
  if (!customerId) throw new HttpError(502, "flow_error", "Flow no confirmó el cliente.");
  await update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "subscription_pending" }, { admin: true });
  const trialDays = intent.plan_id === "basic" ? 7 : 0;
  const subscriptionResult = await createSubscription({ planId: intent.provider_plan_id, customerId, trialPeriodDays: trialDays });
  const now = new Date();
  const trialEnd = flowDate(flowValue(subscriptionResult, "trial_end", "trialEnd")) || (trialDays ? new Date(now.getTime() + trialDays * 86400000).toISOString() : null);
  const trialStart = flowDate(flowValue(subscriptionResult, "trial_start", "trialStart")) || (trialEnd ? now.toISOString() : null);
  const providerSubscriptionId = flowValue(subscriptionResult, "subscriptionId", "subscription_id", "id");
  const currentPeriodStart = flowDate(flowValue(subscriptionResult, "currentPeriodStart", "current_period_start", "period_start", "periodStart", "subscription_start", "subscriptionStart")) || now.toISOString();
  const currentPeriodEnd = flowDate(flowValue(subscriptionResult, "currentPeriodEnd", "current_period_end", "period_end", "periodEnd", "nextBillingDate", "next_billing_date", "next_invoice_date", "nextInvoiceDate", "subscription_end", "subscriptionEnd")) || trialEnd || new Date(now.getTime() + 30 * 86400000).toISOString();
  try {
    await insert("subscriptions", {
      user_id: intent.user_id,
      plan_id: intent.plan_id,
      provider: "flow",
      provider_customer_id: customerId,
      provider_subscription_id: providerSubscriptionId,
      status: trialDays ? "trialing" : "active",
      trial_starts_at: trialDays ? trialStart : null,
      trial_ends_at: trialEnd,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
    }, { admin: true });
    await update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "completed" }, { admin: true });
  } catch (error) {
    const externalEventId = createHash("sha256").update(`${intent.id}:${providerSubscriptionId || token}`).digest("hex");
    await insert("billing_events", {
      user_id: intent.user_id,
      external_event_id: externalEventId,
      event_type: "subscription_creation_failed",
      status: "failed",
      event_metadata: { intentId: intent.id },
    }, { admin: true }).catch(() => undefined);
    throw error;
  }
  redirect(res, `${siteUrl(req)}/cuenta/?billing=success`);
}

async function flowCallback(req, res) {
  const url = requestUrl(req);
  const input = await body(req);
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!token) throw new HttpError(400, "invalid_callback", "Falta el token de Flow.");
  const status = await paymentStatus(token);
  const externalEventId = createHash("sha256").update(token).digest("hex");
  const providerSubscriptionId = flowValue(status, "subscriptionId", "subscription_id");
  const providerPaymentId = flowValue(status, "paymentId", "payment_id", "order");
  const mapped = paymentState(flowValue(status, "status", "paymentStatus", "payment_status"));
  let subscription = null;
  if (providerSubscriptionId) {
    const rows = await select(
      "subscriptions",
      `provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&select=id,user_id,status&limit=1`,
      { admin: true },
    );
    subscription = rows?.[0] || null;
  }
  await insert("billing_events", {
    user_id: subscription?.user_id || null,
    external_event_id: externalEventId,
    event_type: "flow_payment_callback",
    status: "processed",
    event_metadata: { providerPaymentId, providerSubscriptionId, state: mapped },
    processed_at: new Date().toISOString(),
  }, { admin: true }).catch(() => undefined);
  if (subscription) {
    const values = {};
    if (mapped && mapped !== subscription.status) values.status = mapped;
    const nextPeriodEnd = flowDate(flowValue(status, "next_invoice_date", "nextInvoiceDate", "current_period_end", "currentPeriodEnd", "subscription_end", "subscriptionEnd"));
    if (nextPeriodEnd) values.current_period_end = nextPeriodEnd;
    if (Object.keys(values).length) {
      await update("subscriptions", `id=eq.${encodeURIComponent(subscription.id)}`, values, { admin: true });
    }
  }
  json(res, 200, { ok: true });
}

const ACTIONS = { checkout, cancel, "card-callback": cardCallback, "flow-callback": flowCallback };

module.exports = handler(async (req, res) => {
  const action = req.query?.action;
  const fn = typeof action === "string" ? ACTIONS[action] : undefined;
  if (!fn) throw new HttpError(404, "not_found", "Ruta no encontrada.");
  await fn(req, res);
});
