const { createHash } = require("node:crypto");
const { body, handler, HttpError, redirect, requestUrl, siteUrl } = require("../_lib/http");
const { flowSuccess, createSubscription, registerStatus, flowValue } = require("../_lib/flow");
const { select, update, insert } = require("../_lib/supabase");

function flowDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

module.exports = handler(async (req, res) => {
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
});
