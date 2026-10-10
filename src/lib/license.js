import { HttpError } from "./http.js";
import {
  base64urlToBytes,
  base64urlToUtf8,
  bytesToBase64url,
  ed25519Sign,
  ed25519Verify,
  importEd25519PrivateKey,
  importEd25519PublicKey,
  sha256Hex,
  utf8Encoder,
  utf8ToBase64url,
} from "./crypto.js";

/**
 * Debe coincidir con PUBLIC_KEYS de pteron/src/main/services/license.ts: es la
 * misma clave, sólo que acá sirve para verificar (nunca para firmar) al
 * renovar una licencia que el cliente ya tenía guardada.
 */
export const PUBLIC_KEYS = {
  k1: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAIiyVbE5TARxOvkmsybhjZimWX0D9DMulrhT6ToBw4PY=\n-----END PUBLIC KEY-----\n",
};

/**
 * Un PEM pegado en un panel web pierde los saltos de línea con facilidad: llega
 * con `\n` literales, o aplastado en una sola línea. El base64 sigue intacto,
 * así que se reconstruye el bloque antes de importarlo.
 */
export function normalizePem(raw) {
  const texto = String(raw).replace(/\\n/g, "\n").trim();
  if (texto.includes("\n")) return `${texto}\n`;
  const cuerpo = texto.match(/-----BEGIN ([A-Z ]+)-----(.*?)-----END \1-----/);
  if (!cuerpo) return texto;
  const base64 = cuerpo[2].replace(/\s+/g, "");
  const lineas = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${cuerpo[1]}-----\n${lineas.join("\n")}\n-----END ${cuerpo[1]}-----\n`;
}

// Importar una clave cuesta poco, pero no hace falta repetirlo por petición:
// la caché vive por PEM, así que distintas claves (las pruebas usan varias)
// nunca se confunden.
const privateKeys = new Map();
const publicKeys = new Map();

function cachedKey(cache, pem, importer) {
  let promise = cache.get(pem);
  if (!promise) {
    promise = importer(pem);
    cache.set(pem, promise);
    promise.catch(() => cache.delete(pem));
  }
  return promise;
}

export async function tokenHash(token) {
  return sha256Hex(token);
}

/**
 * Verifica un token ya emitido, sin importar si venció: quien decide si se
 * renueva es la suscripción vigente en `subscriptions`, no el `exp` del token
 * viejo — así un profesor que abrió la app después de semanas sin conexión no
 * queda bloqueado por un reloj. Nunca lanza; null ante cualquier problema.
 */
export async function verifyLicense(token, keys = PUBLIC_KEYS) {
  if (typeof token !== "string" || !token.trim()) return null;
  const [payloadSegment, signatureSegment, ...rest] = token.trim().split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) return null;

  let payload;
  try {
    payload = JSON.parse(base64urlToUtf8(payloadSegment));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.v !== 1) return null;
  if (payload.plan !== "basic" && payload.plan !== "pro") return null;
  for (const field of ["sub", "iat", "exp", "kid"]) {
    if (typeof payload[field] !== "string" || !payload[field]) return null;
  }

  const pem = Object.hasOwn(keys, payload.kid) ? keys[payload.kid] : null;
  if (!pem) return null;
  let authentic = false;
  try {
    const key = await cachedKey(publicKeys, pem, importEd25519PublicKey);
    authentic = await ed25519Verify(key, base64urlToBytes(signatureSegment), utf8Encoder.encode(payloadSegment));
  } catch {
    authentic = false;
  }
  if (!authentic) return null;

  // exp va en el resultado sin evaluarse acá a propósito: quien llama decide
  // si el vencimiento importa (no importa para renovar; sí para el gateway).
  return { sub: payload.sub, plan: payload.plan, kid: payload.kid, exp: payload.exp };
}

export function createLicenseService(env, supabase) {
  function keyId() {
    return String(env?.LICENSE_KID || "k1").trim();
  }

  async function privateKey() {
    const raw = String(env?.LICENSE_PRIVATE_KEY_PEM || "").trim();
    if (!raw) throw new HttpError(503, "license_not_configured", "La firma de licencias todavía no está configurada.");
    try {
      return await cachedKey(privateKeys, normalizePem(raw), importEd25519PrivateKey);
    } catch {
      throw new HttpError(503, "license_key_invalid", "La clave de firma de licencias está mal guardada: revisa LICENSE_PRIVATE_KEY_PEM.");
    }
  }

  async function signLicense({ subject, plan, expiresAt }) {
    if (!subject || !["basic", "pro"].includes(plan)) throw new HttpError(400, "invalid_license", "La licencia no es válida.");
    const now = new Date();
    const payload = {
      v: 1,
      sub: subject,
      plan,
      iat: now.toISOString(),
      exp: new Date(expiresAt).toISOString(),
      kid: keyId(),
    };
    const segment = utf8ToBase64url(JSON.stringify(payload));
    const signature = bytesToBase64url(await ed25519Sign(await privateKey(), utf8Encoder.encode(segment)));
    return `${segment}.${signature}`;
  }

  async function currentSubscription(userId) {
    const rows = await supabase.select(
      "subscriptions",
      `user_id=eq.${encodeURIComponent(userId)}&status=in.(trialing,active,past_due,paused)&select=id,plan_id,provider_customer_id,provider_subscription_id,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,plan_catalog(license_plan)&order=created_at.desc&limit=1`,
      { admin: true },
    );
    return rows?.[0] || null;
  }

  async function issueLicense(userId) {
    const subscription = await currentSubscription(userId);
    // El plan que va dentro de la licencia no siempre es el de la suscripción:
    // la app sólo reconoce 'basic' y 'pro', así que un plan de cortesía se firma
    // como el que sí entiende. `plan_catalog.license_plan` en null significa que
    // ese plan no emite licencia — es el caso de 'free'.
    if (!subscription) {
      throw new HttpError(403, "plan_required", "Necesitas un plan activo para activar pteron.");
    }
    const licensePlan = subscription.plan_catalog?.license_plan || null;
    if (!licensePlan) {
      // Distinto del caso anterior a propósito: aquí sí hay suscripción vigente.
      // O el plan no emite licencia, o el catálogo no llegó embebido en la
      // consulta — y con un solo mensaje para ambos no habría forma de saberlo.
      throw new HttpError(403, "plan_without_license", `Tu plan (${subscription.plan_id}) no emite licencia para este equipo.`);
    }
    const expiresAt = subscription.current_period_end || subscription.trial_ends_at || new Date(Date.now() + 30 * 86400000).toISOString();
    if (Date.parse(expiresAt) <= Date.now()) throw new HttpError(403, "plan_expired", "Tu plan ya no está vigente.");
    const token = await signLicense({ subject: userId, plan: licensePlan, expiresAt });
    await supabase.upsert("licenses", {
      user_id: userId,
      subject: userId,
      plan_id: subscription.plan_id,
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: expiresAt,
      key_id: keyId(),
      token_hash: await tokenHash(token),
    }, { admin: true, query: "on_conflict=subject" });
    return { token, plan: licensePlan, expiresAt, keyId: keyId() };
  }

  return { currentSubscription, issueLicense, signLicense };
}
