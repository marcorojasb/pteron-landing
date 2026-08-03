const { createPrivateKey, createPublicKey, createHash, sign, verify } = require("node:crypto");
const { HttpError } = require("./http");
const { insert, select, upsert } = require("./supabase");

/**
 * Debe coincidir con PUBLIC_KEYS de pteron/src/main/services/license.ts: es la
 * misma clave, sólo que acá sirve para verificar (nunca para firmar) al
 * renovar una licencia que el cliente ya tenía guardada.
 */
const PUBLIC_KEYS = {
  k1: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAIiyVbE5TARxOvkmsybhjZimWX0D9DMulrhT6ToBw4PY=\n-----END PUBLIC KEY-----\n",
};

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

/**
 * Verifica un token ya emitido, sin importar si venció: quien decide si se
 * renueva es la suscripción vigente en `subscriptions`, no el `exp` del token
 * viejo — así un profesor que abrió la app después de semanas sin conexión no
 * queda bloqueado por un reloj. Nunca lanza; null ante cualquier problema.
 */
function verifyLicense(token, keys = PUBLIC_KEYS) {
  if (typeof token !== "string" || !token.trim()) return null;
  const [payloadSegment, signatureSegment, ...rest] = token.trim().split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.v !== 1) return null;
  if (payload.plan !== "basic" && payload.plan !== "pro") return null;
  for (const field of ["sub", "iat", "exp", "kid"]) {
    if (typeof payload[field] !== "string" || !payload[field]) return null;
  }

  const pem = keys[payload.kid];
  if (!pem) return null;
  let authentic = false;
  try {
    authentic = verify(
      null,
      Buffer.from(payloadSegment, "utf8"),
      createPublicKey(pem),
      Buffer.from(signatureSegment, "base64url"),
    );
  } catch {
    authentic = false;
  }
  if (!authentic) return null;

  return { sub: payload.sub, plan: payload.plan, kid: payload.kid };
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

module.exports = { currentSubscription, issueLicense, signLicense, tokenHash, verifyLicense };
