const { body, handler, HttpError, json, method, requireAuth } = require("../_lib/http");
const { authUser, select, update } = require("../_lib/supabase");
const { cancelSubscription } = require("../_lib/flow");

module.exports = handler(async (req, res) => {
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
});
