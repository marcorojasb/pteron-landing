const { createPrivateKey, createHash, sign } = require("node:crypto");
const { HttpError } = require("./http");
const { insert, select, upsert } = require("./supabase");

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function privateKey() {
  const pem = String(process.env.LICENSE_PRIVATE_KEY_PEM || "").trim();
  if (!pem) throw new HttpError(503, "license_not_configured", "La firma de licencias todavía no está configurada.");
  return createPrivateKey(pem);
}

function signLicense({ subject, plan, expiresAt }) {
  if (!subject || !["basic", "pro"].includes(plan)) throw new HttpError(400, "invalid_license", "La licencia no es válida.");
  const now = new Date();
  const payload = {
    v: 1,
    sub: subject,
    plan,
    iat: now.toISOString(),
    exp: new Date(expiresAt).toISOString(),
    kid: String(process.env.LICENSE_KID || "k1").trim(),
  };
  const segment = base64url(JSON.stringify(payload));
  const signature = sign(null, Buffer.from(segment, "utf8"), privateKey()).toString("base64url");
  return `${segment}.${signature}`;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function currentSubscription(userId) {
  const rows = await select(
    "subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}&status=in.(trialing,active,past_due,paused)&select=id,plan_id,provider_customer_id,provider_subscription_id,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at&order=created_at.desc&limit=1`,
    { admin: true },
  );
  return rows?.[0] || null;
}

async function issueLicense(userId) {
  const subscription = await currentSubscription(userId);
  if (!subscription || !["basic", "pro"].includes(subscription.plan_id)) {
    throw new HttpError(403, "plan_required", "Necesitas un plan activo para activar pteron.");
  }
  const expiresAt = subscription.current_period_end || subscription.trial_ends_at || new Date(Date.now() + 30 * 86400000).toISOString();
  if (Date.parse(expiresAt) <= Date.now()) throw new HttpError(403, "plan_expired", "Tu plan ya no está vigente.");
  const token = signLicense({ subject: userId, plan: subscription.plan_id, expiresAt });
  const keyId = String(process.env.LICENSE_KID || "k1").trim();
  await upsert("licenses", {
    user_id: userId,
    subject: userId,
    plan_id: subscription.plan_id,
    status: "active",
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
    key_id: keyId,
    token_hash: tokenHash(token),
  }, { admin: true, query: "on_conflict=subject" });
  return { token, plan: subscription.plan_id, expiresAt, keyId };
}

module.exports = { currentSubscription, issueLicense, signLicense, tokenHash };
