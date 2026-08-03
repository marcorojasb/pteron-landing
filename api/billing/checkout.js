const { body, handler, HttpError, json, method, requireAuth, requireString, siteUrl } = require("../_lib/http");
const { authUser, insert, select, update } = require("../_lib/supabase");
const { createCustomer, createPlan, planId, registerCustomer } = require("../_lib/flow");

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
    // Flow identifies an already-created plan as an API error. Keeping the
    // configured id lets retries proceed without creating duplicate plans.
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("exist") && !message.includes("duplic") && !message.includes("already")) throw error;
  }
  return id;
}

module.exports = handler(async (req, res) => {
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
});
