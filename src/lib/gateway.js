import { HttpError, bearerToken, json } from "./http.js";
import { verifyLicense } from "./license.js";

/**
 * Error del gateway con la forma que la app sabe leer: el SDK de Anthropic arma
 * su mensaje con `status + " " + body.message`, así que el código va al
 * comienzo del texto y la app lo reconoce aunque el texto cambie. `extras` va
 * en el cuerpo y `headers` en la respuesta.
 */
export class GatewayError extends HttpError {
  constructor(status, code, text, extras = {}, headers = {}) {
    super(status, code, `${code}: ${text}`);
    this.name = "GatewayError";
    this.extras = extras;
    this.headers = headers;
  }
}

export function gatewayErrorResponse(error) {
  return json(error.status, { error: error.code, message: error.message, ...error.extras }, error.headers);
}

// Reintentar no arregla una IA sin configurar, pausada o con la cuenta del
// proveedor detenida: el SDK obedece x-should-retry y avisa de inmediato. Una
// falla de la base o de la red sí puede pasar sola.
const PERMANENT_REASONS = new Set(["not_configured", "paused", "provider_paused"]);

/** 503 included_ai_unavailable; `reason` dice por qué, para Marco y para la app. */
export function includedAiUnavailable(reason) {
  return new GatewayError(
    503,
    "included_ai_unavailable",
    "La IA incluida no está disponible ahora.",
    { reason },
    PERMANENT_REASONS.has(reason) ? { "x-should-retry": "false" } : {},
  );
}

/**
 * Autentica una llamada al gateway con la licencia como credencial (ADR-054/055):
 * sin sesión, sin base de sesiones propia — la misma firma que ya verifica el
 * cliente. A diferencia de la renovación, acá el vencimiento sí importa: una
 * licencia vencida no debe poder seguir gastando cuota. Que la suscripción
 * siga vigente se revisa después, contra la base.
 */
export async function authenticateGateway(request, keys) {
  // El SDK de Anthropic manda la credencial en x-api-key; la salud de la app consulta /v1/models con Bearer.
  const token = bearerToken(request) || String(request.headers.get("x-api-key") || "").trim();
  if (!token) throw new GatewayError(401, "not_authenticated", "Falta la licencia.");
  const verified = await verifyLicense(token, keys);
  if (!verified) throw new GatewayError(401, "invalid_license", "La licencia no pudo verificarse.");
  if (Date.parse(verified.exp) <= Date.now()) throw new GatewayError(401, "license_expired", "La licencia venció.");
  return verified;
}

const HOUR = 3_600_000;
// Tras el fin de lo pagado, los 3 días que Flow da para pagar el cobro del mes
// siguiente; sin gracia si la persona canceló al cierre.
const FLOW_GRACE_MS = 72 * HOUR;
// Los estados que emiten licencia; canceled, incomplete, expired y paused no.
const INCLUDED_STATUSES = new Set(["trialing", "active", "past_due"]);

/** Hasta cuándo da acceso una suscripción, en milisegundos; null sin fecha de término (falla cerrado). */
export function accessUntil(subscription) {
  const end = Date.parse(subscription?.current_period_end ?? "");
  if (!Number.isFinite(end)) return null;
  return end + (subscription.provider === "flow" && !subscription.cancel_at_period_end ? FLOW_GRACE_MS : 0);
}

/**
 * La licencia es portable hasta su `exp` (a lo más 7 días): la suscripción
 * vigente se revisa en cada petición, así una cortesía retirada, un plan que
 * dejó de pagarse o una licencia vieja de 12 meses dejan de gastar al tiro. El
 * plan debe emitir licencia: uno sin `license_plan` no incluye la IA.
 */
export function includedAiSubscription(subscription, now = new Date()) {
  if (!subscription || !INCLUDED_STATUSES.has(subscription.status)) return false;
  if (!subscription.plan_catalog?.license_plan) return false;
  const until = accessUntil(subscription);
  return until !== null && until > now.getTime();
}

const CHILE = "America/Santiago";
const CHILE_WINTER_OFFSET_MS = 4 * HOUR;
let chileFormat = null;

/** Fecha de calendario en Chile de un instante; null si el entorno no trae la zona horaria. */
function chileDate(instant) {
  try {
    chileFormat ??= new Intl.DateTimeFormat("en-US", { timeZone: CHILE, year: "numeric", month: "numeric", day: "numeric" });
    const parts = {};
    for (const part of chileFormat.formatToParts(new Date(instant))) parts[part.type] = part.value;
    return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day) };
  } catch {
    return null;
  }
}

/**
 * Medianoche de Chile de un día, como instante UTC: 03:00Z en horario de
 * verano, 04:00Z en el de invierno. El día que empieza el horario de verano no
 * hay medianoche y el día empieza a la 01:00, que también son las 04:00Z; sin
 * la zona horaria, se supone invierno.
 */
function chileMidnight(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  const summer = Date.UTC(y, m, d, 3);
  const local = chileDate(summer);
  return local && local.year === y && local.month === m && local.day === d ? summer : Date.UTC(y, m, d, 4);
}

function chileMonth(now) {
  const winter = new Date(now.getTime() - CHILE_WINTER_OFFSET_MS);
  const local = chileDate(now.getTime()) ?? { year: winter.getUTCFullYear(), month: winter.getUTCMonth() };
  return { start: chileMidnight(local.year, local.month, 1), end: chileMidnight(local.year, local.month + 1, 1) };
}

function addMonthsUtc(instant, months) {
  const date = new Date(instant);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  // Un aniversario el 31 cae el último día de los meses más cortos, no en el mes siguiente.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
}

function anniversaryMonth(anchor, now) {
  const start = new Date(anchor);
  let months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth();
  if (addMonthsUtc(anchor, months) > now.getTime()) months -= 1;
  months = Math.max(0, months);
  return { start: addMonthsUtc(anchor, months), end: addMonthsUtc(anchor, months + 1) };
}

function dateRange(startValue, endValue) {
  const start = Date.parse(startValue ?? "");
  const end = Date.parse(endValue ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && start < end ? { start, end } : null;
}

/**
 * null = sin tope. Cualquier otra cosa que no sea un entero no negativo cuenta
 * como 0 (falla cerrado), también una columna ausente: un select que la olvidó
 * no debe abrir la cuota.
 */
function unitsLimit(value) {
  if (value === null) return null;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * Período de la cuota y su límite, con el plan de la suscripción (tester tiene
 * su propia cuota), no el de la licencia:
 * - Flow en prueba: la prueba, con la cuota de prueba (un cuarto de la del plan si no tiene una propia).
 * - Flow pagado: el período pagado vigente. Durante la gracia sigue el mismo:
 *   la cuota se renueva con el cobro, no con el calendario.
 * - Cortesía: meses de aniversario desde que empezó.
 * - Sin fechas utilizables: el mes calendario de Chile.
 * Función pura: `now` es el reloj, inyectable para probar.
 */
export function currentUsagePeriod(subscription, plan, now = new Date()) {
  const monthly = unitsLimit(plan?.ai_units_limit);
  let period;
  let limit = monthly;
  if (subscription?.provider === "flow") {
    const trial = subscription.status === "trialing";
    if (trial) {
      const own = unitsLimit(plan?.trial_ai_units_limit);
      // Un cuarto de «sin tope» no es sin tope: una prueba no se cobra, así
      // que sin cuota de prueba ni del plan queda en 0.
      limit = own ?? (monthly === null ? 0 : Math.floor(monthly / 4));
    }
    // En la prueba, current_period_start también es el inicio de la prueba.
    period = dateRange(trial ? subscription.trial_starts_at ?? subscription.current_period_start : subscription.current_period_start, subscription.current_period_end);
  } else {
    const anchor = Date.parse(subscription?.current_period_start ?? "");
    period = Number.isFinite(anchor) ? anniversaryMonth(anchor, now) : null;
  }
  period ??= chileMonth(now);
  return { start: new Date(period.start).toISOString(), end: new Date(period.end).toISOString(), limit };
}

const SUBSCRIPTION_FIELDS =
  "id,plan_id,provider,status,trial_starts_at,current_period_start,current_period_end,cancel_at_period_end,plan_catalog(ai_units_limit,trial_ai_units_limit,license_plan)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Contabilidad del gateway en Supabase, con la service role. Cada petición
 * reserva un estimado antes de llamar al proveedor (begin_ai_request: pausa,
 * peticiones en vuelo y cuota en una sola transacción) y anota su gasto real
 * al terminar (finish_ai_request), aunque cruce el tope.
 */
export function createGateway(supabase, { finishRetryDelaysMs = [250, 1000] } = {}) {
  async function currentSubscription(userId) {
    const rows = await supabase.select(
      "subscriptions",
      `user_id=eq.${encodeURIComponent(userId)}&status=in.(trialing,active,past_due)&select=${SUBSCRIPTION_FIELDS}&order=created_at.desc&limit=1`,
      { admin: true },
    );
    return rows?.[0] || null;
  }

  /** Pausada salvo que la fila diga exactamente false, igual que begin_ai_request. */
  async function includedAiPaused() {
    const rows = await supabase.select("app_settings", "key=eq.included_ai_paused&select=value", { admin: true });
    return rows?.[0]?.value !== false;
  }

  async function beginAiRequest({ userId, requestId, planId, period, estimate, maxInFlight }) {
    const rows = await supabase.request("/rest/v1/rpc/begin_ai_request", {
      method: "POST",
      admin: true,
      body: {
        p_user_id: userId,
        p_request_id: requestId,
        p_plan_id: planId,
        p_period_start: period.start,
        p_period_end: period.end,
        p_limit: period.limit,
        p_estimate: estimate,
        p_max_in_flight: maxInFlight,
      },
    });
    return (Array.isArray(rows) ? rows[0] : rows) || null;
  }

  /**
   * Cierra la reserva con el gasto real. Es idempotente en la base, así que se
   * reintenta dos veces; si igual falla, queda una línea JSON sin contenido
   * para conciliar a mano (la reserva vence sola a los 15 minutos).
   */
  async function finishAiRequest(requestId, units, metadata) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await supabase.request("/rest/v1/rpc/finish_ai_request", {
          method: "POST",
          admin: true,
          body: { p_request_id: requestId, p_units: units, p_metadata: metadata },
        });
        return true;
      } catch (error) {
        if (attempt >= finishRetryDelaysMs.length) {
          console.error(JSON.stringify({
            event: "pteron_usage_unrecorded",
            ai_request: requestId,
            units,
            metadata,
            error: error instanceof Error ? error.message : String(error),
          }));
          return false;
        }
        await sleep(finishRetryDelaysMs[attempt]);
      }
    }
  }

  return { beginAiRequest, currentSubscription, finishAiRequest, includedAiPaused };
}

const SNIFFED_EVENTS = ["content_block_delta", "message_delta", "message_start"].map((type) => [type, `{"type":"${type}"`]);

/** Caracteres de una cadena JSON desde `index` (justo después de la comilla de apertura) hasta su cierre. */
function jsonStringLength(text, index) {
  let length = 0;
  let cursor = index;
  while (cursor < text.length) {
    const code = text.charCodeAt(cursor);
    if (code === 34) break;
    // Una secuencia de escape es un solo carácter: \n, \" o \u0007.
    cursor += code === 92 ? (text.charCodeAt(cursor + 1) === 117 ? 6 : 2) : 1;
    length += 1;
  }
  return length;
}

/** Caracteres de texto o de JSON de herramienta que trae un content_block_delta; el razonamiento no cuenta. */
function deltaChars(payload) {
  const text = payload.indexOf('"text":"');
  if (text !== -1) return jsonStringLength(payload, text + 8);
  const partial = payload.indexOf('"partial_json":"');
  return partial === -1 ? 0 : jsonStringLength(payload, partial + 16);
}

/**
 * Observa el stream SSE de la API Messages mientras se retransmite, gastando
 * poca CPU: sólo se parsean message_start (modelo real y tokens de entrada) y
 * message_delta (salida, acumulada); de cada content_block_delta se cuentan
 * los caracteres reenviados sin parsearlo, para estimar la salida si el
 * stream se corta antes de message_delta. El usage se fusiona sin pisar con
 * null lo que ya se sabía. Nunca lanza.
 */
export function createUsageTracker() {
  let pending = "";
  let eventName = "";
  let usage = null;
  let model = null;
  let sawMessageDelta = false;
  let forwardedChars = 0;

  function merge(values) {
    if (!values || typeof values !== "object") return;
    usage ??= {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && value !== undefined) usage[key] = value;
    }
  }

  function absorb(type, payload) {
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    if (type === "message_start") {
      if (typeof event?.message?.model === "string" && event.message.model) model = event.message.model;
      merge(event?.message?.usage);
    } else if (event?.usage && typeof event.usage === "object") {
      merge(event.usage);
      sawMessageDelta = true;
    }
  }

  function line(text, start, stop) {
    const end = stop > start && text.charCodeAt(stop - 1) === 13 ? stop - 1 : stop;
    if (end === start) {
      eventName = "";
      return;
    }
    if (text.startsWith("event:", start)) {
      eventName = text.slice(start + 6, end).trim();
      return;
    }
    if (!text.startsWith("data:", start)) return;
    const from = text.charCodeAt(start + 5) === 32 ? start + 6 : start + 5;
    // El nombre viene en la línea event:; sin ella, en el comienzo del JSON.
    const type = eventName || SNIFFED_EVENTS.find(([, prefix]) => text.startsWith(prefix, from))?.[0];
    if (type === "content_block_delta") forwardedChars += deltaChars(text.slice(from, end));
    else if (type === "message_start" || type === "message_delta") absorb(type, text.slice(from, end));
  }

  return {
    push(text) {
      let end = text.indexOf("\n");
      if (end === -1) {
        pending += text;
        return;
      }
      // Sólo lo pendiente puede venir partido entre chunks, y nunca trae un salto de línea.
      const first = pending + text.slice(0, end);
      line(first, 0, first.length);
      let start = end + 1;
      for (end = text.indexOf("\n", start); end !== -1; end = text.indexOf("\n", start)) {
        line(text, start, end);
        start = end + 1;
      }
      pending = text.slice(start);
    },
    finish() {
      if (pending) line(pending, 0, pending.length);
      pending = "";
      return { usage, model, sawMessageDelta, forwardedChars };
    },
  };
}
