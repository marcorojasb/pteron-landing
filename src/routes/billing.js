import { HttpError, body, json, method, redirect, requireAuth, requireString, siteUrl } from "../lib/http.js";
import { sha256Hex } from "../lib/crypto.js";
import { flowSuccess, flowValue } from "../lib/flow.js";

// Acciones detrás de /api/billing/{checkout,cancel,card-callback,flow-callback}.
// Flow y la cuenta web siguen llamando exactamente a esas URLs.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLAN_DEFAULTS = {
  basic: { name: "pteron Basic", amount: 2999, trialPeriodDays: 7 },
  pro: { name: "pteron Pro", amount: 9990, trialPeriodDays: 0 },
};

function existingCustomer(rows) {
  return rows?.find((row) => row.provider_customer_id)?.provider_customer_id || null;
}

async function ensureFlowPlan(flow, plan, callbackUrl) {
  const defaults = PLAN_DEFAULTS[plan];
  const id = flow.planId(plan);
  try {
    await flow.createPlan({ id, ...defaults, callbackUrl });
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

async function checkout({ request, env, services }) {
  method(request, "POST");
  const { supabase, flow } = services;
  const token = requireAuth(request);
  const user = await supabase.authUser(token);
  const input = await body(request);
  const plan = requireString(input.plan, "plan", 20).toLowerCase();
  if (!Object.hasOwn(PLAN_DEFAULTS, plan)) throw new HttpError(400, "invalid_plan", "Ese plan no está disponible.");

  const userId = encodeURIComponent(user.id);
  const current = await supabase.select(
    "subscriptions",
    `user_id=eq.${userId}&status=in.(incomplete,trialing,active,past_due,paused)&select=id,plan_id,status&limit=1`,
    { admin: true },
  );
  if (current?.[0]) throw new HttpError(409, "subscription_exists", "Ya tienes un plan en curso. Puedes administrarlo desde tu cuenta.");

  const previousIntents = await supabase.select(
    "billing_checkout_intents",
    `user_id=eq.${userId}&provider_customer_id=not.is.null&select=provider_customer_id&order=created_at.desc&limit=5`,
    { admin: true },
  );
  const customerId = existingCustomer(previousIntents) || String((await flow.createCustomer({
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "pteron",
    email: user.email,
    externalId: user.id,
  })).customerId || "").trim();
  if (!customerId) throw new HttpError(502, "flow_error", "Flow no entregó el identificador del cliente.");

  const base = siteUrl(env, request);
  const providerPlanId = await ensureFlowPlan(flow, plan, `${base}/api/billing/flow-callback`);
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const intentRows = await supabase.insert("billing_checkout_intents", {
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
    const registration = await flow.registerCustomer({
      customerId,
      returnUrl: `${base}/api/billing/card-callback?intent=${encodeURIComponent(intent.id)}`,
    });
    return json(200, {
      ok: true,
      redirectUrl: registration.redirectUrl,
      plan,
      trialPeriodDays: PLAN_DEFAULTS[plan].trialPeriodDays,
      expiresAt,
    });
  } catch (error) {
    await supabase.update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "failed" }, { admin: true }).catch(() => undefined);
    throw error;
  }
}

async function cancel({ request, services }) {
  method(request, "POST");
  const { supabase, flow } = services;
  const user = await supabase.authUser(requireAuth(request));
  await body(request);
  const userId = encodeURIComponent(user.id);
  const rows = await supabase.select(
    "subscriptions",
    `user_id=eq.${userId}&status=in.(trialing,active,past_due,paused)&select=id,provider_subscription_id,current_period_end&order=created_at.desc&limit=1`,
    { admin: true },
  );
  const subscription = rows?.[0];
  if (!subscription) throw new HttpError(404, "subscription_missing", "No encontramos un plan activo.");
  if (!subscription.provider_subscription_id) throw new HttpError(409, "subscription_pending", "El plan todavía está terminando de configurarse.");
  await flow.cancelSubscription({ subscriptionId: subscription.provider_subscription_id, atPeriodEnd: 1 });
  await supabase.update(
    "subscriptions",
    `id=eq.${encodeURIComponent(subscription.id)}`,
    { cancel_at_period_end: true },
    { admin: true },
  );
  return json(200, { ok: true, cancelAt: subscription.current_period_end || null });
}

async function cardCallback({ request, env, url, services }) {
  const { supabase, flow } = services;
  const input = await body(request);
  const intentId = String(url.searchParams.get("intent") || "").trim();
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!intentId || !token) throw new HttpError(400, "invalid_callback", "El retorno de Flow no está completo.");
  // El id es un uuid generado por la base; otra forma no identifica ningún checkout.
  if (!UUID.test(intentId)) throw new HttpError(410, "checkout_expired", "Este checkout ya venció.");
  const intents = await supabase.select(
    "billing_checkout_intents",
    `id=eq.${encodeURIComponent(intentId)}&select=id,user_id,plan_id,provider_customer_id,provider_plan_id,status,expires_at&limit=1`,
    { admin: true },
  );
  const intent = intents?.[0];
  if (!intent || Date.parse(intent.expires_at) <= Date.now()) throw new HttpError(410, "checkout_expired", "Este checkout ya venció.");
  const base = siteUrl(env, request);
  if (intent.status === "completed") {
    return redirect(`${base}/cuenta?billing=success`);
  }
  const status = await flow.registerStatus(token);
  if (!flowSuccess(status)) {
    await supabase.update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "failed" }, { admin: true });
    return redirect(`${base}/cuenta?billing=cancelled`);
  }
  const customerId = String(flowValue(status, "customerId", "customer_id") || intent.provider_customer_id || "");
  if (!customerId) throw new HttpError(502, "flow_error", "Flow no confirmó el cliente.");
  await supabase.update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "subscription_pending" }, { admin: true });
  const trialDays = intent.plan_id === "basic" ? 7 : 0;
  const subscriptionResult = await flow.createSubscription({ planId: intent.provider_plan_id, customerId, trialPeriodDays: trialDays });
  const now = new Date();
  const trialEnd = flowDate(flowValue(subscriptionResult, "trial_end", "trialEnd")) || (trialDays ? new Date(now.getTime() + trialDays * 86400000).toISOString() : null);
  const trialStart = flowDate(flowValue(subscriptionResult, "trial_start", "trialStart")) || (trialEnd ? now.toISOString() : null);
  const providerSubscriptionId = flowValue(subscriptionResult, "subscriptionId", "subscription_id", "id");
  const currentPeriodStart = flowDate(flowValue(subscriptionResult, "currentPeriodStart", "current_period_start", "period_start", "periodStart", "subscription_start", "subscriptionStart")) || now.toISOString();
  const currentPeriodEnd = flowDate(flowValue(subscriptionResult, "currentPeriodEnd", "current_period_end", "period_end", "periodEnd", "nextBillingDate", "next_billing_date", "next_invoice_date", "nextInvoiceDate", "subscription_end", "subscriptionEnd")) || trialEnd || new Date(now.getTime() + 30 * 86400000).toISOString();
  try {
    await supabase.insert("subscriptions", {
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
    await supabase.update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { status: "completed" }, { admin: true });
  } catch (error) {
    const externalEventId = await sha256Hex(`${intent.id}:${providerSubscriptionId || token}`);
    await supabase.insert("billing_events", {
      user_id: intent.user_id,
      external_event_id: externalEventId,
      event_type: "subscription_creation_failed",
      status: "failed",
      event_metadata: { intentId: intent.id },
    }, { admin: true }).catch(() => undefined);
    throw error;
  }
  return redirect(`${base}/cuenta?billing=success`);
}

async function flowCallback({ request, url, services }) {
  const { supabase, flow } = services;
  const input = await body(request);
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!token) throw new HttpError(400, "invalid_callback", "Falta el token de Flow.");
  const status = await flow.paymentStatus(token);
  const externalEventId = await sha256Hex(token);
  const providerSubscriptionId = flowValue(status, "subscriptionId", "subscription_id");
  const providerPaymentId = flowValue(status, "paymentId", "payment_id", "order");
  const mapped = paymentState(flowValue(status, "status", "paymentStatus", "payment_status"));
  let subscription = null;
  if (providerSubscriptionId) {
    const rows = await supabase.select(
      "subscriptions",
      `provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&select=id,user_id,status&limit=1`,
      { admin: true },
    );
    subscription = rows?.[0] || null;
  }
  await supabase.insert("billing_events", {
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
      await supabase.update("subscriptions", `id=eq.${encodeURIComponent(subscription.id)}`, values, { admin: true });
    }
  }
  return json(200, { ok: true });
}

export const ACTIONS = { checkout, cancel, "card-callback": cardCallback, "flow-callback": flowCallback };
