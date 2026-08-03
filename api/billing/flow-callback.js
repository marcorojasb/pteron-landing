const { createHash } = require("node:crypto");
const { body, handler, HttpError, json, requestUrl } = require("../_lib/http");
const { paymentStatus, flowValue } = require("../_lib/flow");
const { insert, select, update } = require("../_lib/supabase");

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

module.exports = handler(async (req, res) => {
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
});
