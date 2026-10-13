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
import { syncFlowSubscription } from "./flow-sync.js";

/**
 * Debe coincidir con PUBLIC_KEYS de pteron/src/main/services/license.ts: es la
 * misma clave, sólo que acá sirve para verificar (nunca para firmar) al
 * renovar una licencia que el cliente ya tenía guardada.
 */
export const PUBLIC_KEYS = {
  // k2: la única clave; su privada es LICENSE_PRIVATE_KEY_PEM. Una licencia con
  // otro kid no se acepta.
  k2: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAIWGm5jH/yZJ2b5hsQ3UusUn+HIxC5dGiqc1gwOqvrrY=\n-----END PUBLIC KEY-----\n",
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
 * presentado — así un profesor que abrió la app después de semanas sin conexión no
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

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
// Una licencia vale a lo más una semana: la app renueva a diario, así que una
// cortesía retirada o un plan que dejó de pagarse se cortan en días, no meses.
const VIDA_MAXIMA = 7 * DIA;
// Tras el fin de lo pagado, los 3 días que Flow da para pagar un importe
// (days_until_due): el cobro del mes siguiente alcanza a llegar sin cortar.
const GRACIA_FLOW = 72 * HORA;
// Sólo estos estados emiten; canceled, incomplete y expired no.
const EMITEN = new Set(["trialing", "active", "past_due"]);
// Cada renovación cerca del fin de lo pagado consulta Flow, a lo más una vez
// cada 15 minutos por cuenta.
const SINCRONIZAR_CADA = 15 * MINUTO;
const SINCRONIZAR_ANTES = 24 * HORA;

/**
 * Hasta cuándo da acceso una suscripción: lo pagado más la gracia en Flow (sin
 * gracia si canceló al cierre: se va cuando termina lo que pagó); una cortesía,
 * hasta su fin. Sin fecha no hay acceso: ningún respaldo inventa un período.
 */
export function accesoHasta(subscription) {
  const fin = Date.parse(subscription?.current_period_end ?? "");
  if (!Number.isFinite(fin)) return null;
  const gracia = subscription.provider === "flow" && !subscription.cancel_at_period_end ? GRACIA_FLOW : 0;
  return new Date(fin + gracia);
}

function isoONull(value) {
  const instante = Date.parse(value ?? "");
  return Number.isFinite(instante) ? new Date(instante).toISOString() : null;
}

/** Lo que la app muestra del plan. Campos nuevos: las versiones que no los conocen los ignoran. */
function resumenSuscripcion(subscription, acceso) {
  const cobra = subscription.provider === "flow" && !subscription.cancel_at_period_end;
  return {
    planId: subscription.plan_id,
    status: subscription.status,
    paidThrough: isoONull(subscription.current_period_end),
    accessUntil: acceso.toISOString(),
    trialEndsAt: isoONull(subscription.trial_ends_at),
    nextChargeAt: cobra ? isoONull(subscription.next_invoice_at) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    priceClp: subscription.plan_catalog?.monthly_price_clp ?? null,
  };
}

/**
 * Consultar Flow antes de firmar cuando lo local puede haberse quedado atrás:
 * faltan menos de 24 h de acceso, la fila está en prueba, morosa o sin
 * iniciar, o nunca se sincronizó. Nunca más de una vez cada 15 minutos.
 */
function convieneSincronizar(subscription, now) {
  if (subscription.provider !== "flow" || !subscription.provider_subscription_id) return false;
  const sincronizada = Date.parse(subscription.last_synced_at ?? "");
  if (Number.isFinite(sincronizada) && now.getTime() - sincronizada <= SINCRONIZAR_CADA) return false;
  const acceso = accesoHasta(subscription);
  return (
    !Number.isFinite(sincronizada) ||
    !acceso ||
    acceso.getTime() - now.getTime() < SINCRONIZAR_ANTES ||
    ["trialing", "past_due", "incomplete"].includes(subscription.status)
  );
}

export function createLicenseService(env, supabase) {
  // Sin valor por defecto: con un kid equivocado cada licencia sale firmada por
  // una clave y rotulada con otra, y nadie la acepta.
  function keyId() {
    const kid = String(env?.LICENSE_KID || "").trim();
    if (!kid) throw new HttpError(503, "license_not_configured", "La firma de licencias todavía no está configurada.");
    return kid;
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

  async function signLicense({ subject, plan, expiresAt, issuedAt = new Date() }) {
    if (!subject || !["basic", "pro"].includes(plan)) throw new HttpError(400, "invalid_license", "La licencia no es válida.");
    const payload = {
      v: 1,
      sub: subject,
      plan,
      iat: issuedAt.toISOString(),
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
      `user_id=eq.${encodeURIComponent(userId)}&status=in.(incomplete,trialing,active,past_due)&select=id,user_id,plan_id,provider,provider_customer_id,provider_subscription_id,provider_plan_id,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,next_invoice_at,last_synced_at,plan_catalog(license_plan,monthly_price_clp)&order=created_at.desc&limit=1`,
      { admin: true },
    );
    return rows?.[0] || null;
  }

  /**
   * Firma la licencia de la suscripción vigente. Recibe el cliente de Flow
   * (para ponerla al día antes) y las claves públicas con que se comprueba la
   * firma recién hecha; `now` es el reloj, inyectable para probar.
   */
  async function issueLicense(userId, { flow, publicKeys, now = new Date() }) {
    let subscription = await currentSubscription(userId);
    if (!subscription) {
      throw new HttpError(403, "plan_required", "Necesitas un plan activo para activar pteron.");
    }
    if (convieneSincronizar(subscription, now)) {
      try {
        subscription = await syncFlowSubscription({ supabase, flow }, subscription, now);
      } catch (error) {
        // Si Flow no responde se sigue con lo local, que ya acota el acceso a
        // lo pagado más la gracia.
        console.error("pteron license sync", { subscription: subscription.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (subscription.status === "incomplete") {
      throw new HttpError(403, "plan_pending", "Tu plan todavía espera la confirmación del pago en Flow. Vuelve a intentarlo en unos minutos.");
    }
    if (!EMITEN.has(subscription.status)) throw new HttpError(403, "plan_expired", "Tu plan ya no está vigente.");
    // El plan que va dentro de la licencia no siempre es el de la suscripción:
    // la app sólo reconoce 'basic' y 'pro', así que un plan de cortesía se firma
    // como el que sí entiende. `plan_catalog.license_plan` en null significa que
    // ese plan no emite licencia — es el caso de 'free'.
    const licensePlan = subscription.plan_catalog?.license_plan || null;
    if (!licensePlan) {
      // Distinto del caso anterior a propósito: aquí sí hay suscripción vigente.
      // O el plan no emite licencia, o el catálogo no llegó embebido en la
      // consulta — y con un solo mensaje para ambos no habría forma de saberlo.
      throw new HttpError(403, "plan_without_license", `Tu plan (${subscription.plan_id}) no emite licencia para este equipo.`);
    }
    const acceso = accesoHasta(subscription);
    // Un Pro cuyo primer cobro Flow todavía no confirma no tiene período pagado.
    if (!acceso) {
      throw new HttpError(403, "plan_pending", "Tu plan todavía espera la confirmación del pago en Flow. Vuelve a intentarlo en unos minutos.");
    }
    if (acceso <= now) throw new HttpError(403, "plan_expired", "Tu plan ya no está vigente.");
    const expiresAt = new Date(Math.min(acceso.getTime(), now.getTime() + VIDA_MAXIMA)).toISOString();
    const kid = keyId();
    const token = await signLicense({ subject: userId, plan: licensePlan, expiresAt, issuedAt: now });
    // La privada puede no ser la del kid: entonces la app y el gateway
    // rechazarían cada licencia sin que el Worker lo notara. Se comprueba con
    // la clave pública publicada antes de entregarla.
    const verified = await verifyLicense(token, publicKeys);
    if (!verified || verified.kid !== kid || verified.sub !== userId) {
      console.error("pteron license", { kid, reason: "key_mismatch" });
      throw new HttpError(503, "license_key_mismatch", "La clave de firma no corresponde a la clave pública de LICENSE_KID: revisa LICENSE_PRIVATE_KEY_PEM.");
    }
    await supabase.upsert("licenses", {
      user_id: userId,
      subject: userId,
      plan_id: subscription.plan_id,
      status: "active",
      issued_at: now.toISOString(),
      expires_at: expiresAt,
      key_id: kid,
      token_hash: await tokenHash(token),
    }, { admin: true, query: "on_conflict=subject" });
    return { token, plan: licensePlan, expiresAt, keyId: kid, subscription: resumenSuscripcion(subscription, acceso) };
  }

  return { currentSubscription, issueLicense, signLicense };
}
