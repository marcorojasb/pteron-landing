import { SECURITY_HEADERS, json, method } from "../lib/http.js";
import {
  GatewayError,
  authenticateGateway,
  createUsageTracker,
  currentUsagePeriod,
  gatewayErrorResponse,
  includedAiSubscription,
  includedAiUnavailable,
} from "../lib/gateway.js";
import { allowedBetas, clientInfo, opaqueUserId, readMessagesBody, sanitizeMessagesRequest } from "../lib/gateway-request.js";
import { estimatedOutputTokens, hasKnownPrice, reservationEstimate, unitsFromUsage } from "../lib/units.js";

const ANTHROPIC_VERSION = "2023-06-01";
const OFFICIAL_BASE_URL = "https://api.anthropic.com";
const PRODUCTION_SITE = "https://pteron.patagua.dev";
const DEFAULT_MAX_IN_FLIGHT = 3;
const CONCURRENCY_RETRY_SECONDS = 5;
// Si el período ya terminó y el cobro todavía no se sincroniza, la cuota se
// renueva cuando llegue: se pide volver en un minuto, no en 0 segundos.
const MIN_QUOTA_RETRY_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUOTA_EXCEEDED =
  "Se agotó la capacidad de IA incluida de este período. Se renueva con tu próximo cobro. Puedes seguir con el motor local o con tu propia clave.";
// Errores de la cuenta de pteron en Anthropic (sin crédito, tope de gasto propio
// o del workspace): reintentar no los arregla y no son culpa del docente.
const ACCOUNT_LIMIT_MESSAGE = /credit balance|specified API usage limits|workspace API usage limits|anthropic-workspace-id/i;

/**
 * El proveedor detrás del plan es Anthropic y el modelo lo decide el servidor
 * (ADR-056): el cliente sólo pide "pteron-managed". La clave de Anthropic es
 * de pteron, nunca del profesor (ADR-055). El modelo debe tener precio conocido
 * (sin precio no hay cuota que valga), y en producción la clave sólo viaja a
 * Anthropic: una ANTHROPIC_BASE_URL olvidada de las pruebas la entregaría a otro.
 */
function gatewayConfig(env) {
  const apiKey = String(env?.ANTHROPIC_API_KEY || "").trim();
  const modelId = String(env?.GATEWAY_MODEL_ID || "").trim();
  const signingKey = String(env?.LICENSE_PRIVATE_KEY_PEM || "").trim();
  const baseUrl = String(env?.ANTHROPIC_BASE_URL || OFFICIAL_BASE_URL).trim().replace(/\/+$/, "");
  const production = String(env?.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "") === PRODUCTION_SITE;
  const invalid = [];
  if (!apiKey) invalid.push("ANTHROPIC_API_KEY");
  if (!hasKnownPrice(modelId)) invalid.push("GATEWAY_MODEL_ID");
  if (!signingKey) invalid.push("LICENSE_PRIVATE_KEY_PEM");
  if (production && baseUrl !== OFFICIAL_BASE_URL) invalid.push("ANTHROPIC_BASE_URL");
  if (invalid.length) {
    console.error("pteron gateway config", { invalid });
    throw includedAiUnavailable("not_configured");
  }
  const maxInFlight = Number(env?.GATEWAY_MAX_IN_FLIGHT);
  return {
    apiKey,
    modelId,
    signingKey,
    baseUrl,
    maxInFlight: Number.isInteger(maxInFlight) && maxInFlight >= 1 ? maxInFlight : DEFAULT_MAX_IN_FLIGHT,
  };
}

/** Un GatewayError se responde con la forma del contrato; cualquier otra cosa sigue a handleError. */
function gatewayFailure(error) {
  if (error instanceof GatewayError) return gatewayErrorResponse(error);
  throw error;
}

/** Si la base no responde, la IA incluida no atiende: sin contabilidad no hay cuota que aplicar. */
function accountingUnavailable(step, error) {
  console.error("pteron gateway accounting", { step, error: error instanceof Error ? error.message : String(error) });
  return includedAiUnavailable("accounting_unavailable");
}

function licenseRevoked() {
  return new GatewayError(401, "license_revoked", "La licencia ya no corresponde a un plan vigente.");
}

function admissionDenied(decision, period, now) {
  if (decision?.reason === "paused") return includedAiUnavailable("paused");
  if (decision?.reason === "concurrency_limited") {
    return new GatewayError(
      429,
      "concurrency_limited",
      "Ya hay varias peticiones a la IA incluida en curso con esta cuenta. Inténtalo en unos segundos.",
      {},
      { "retry-after": String(CONCURRENCY_RETRY_SECONDS) },
    );
  }
  if (decision?.reason === "quota_exceeded") {
    const resetsAt = Date.parse(decision.period_end ?? period.end);
    return new GatewayError(
      429,
      "quota_exceeded",
      QUOTA_EXCEEDED,
      { resets_at: new Date(resetsAt).toISOString(), used: decision.units_used ?? null, limit: decision.units_limit ?? null },
      {
        "retry-after": String(Math.max(MIN_QUOTA_RETRY_SECONDS, Math.ceil((resetsAt - now.getTime()) / 1000))),
        // La espera es de días: el SDK no debe dormir hasta entonces.
        "x-should-retry": "false",
      },
    );
  }
  // Una respuesta que no se entiende niega: la cuota no se abre por defecto.
  console.error("pteron gateway accounting", { step: "begin", reason: decision?.reason ?? null });
  return includedAiUnavailable("accounting_unavailable");
}

/**
 * Admisión: suscripción vigente, período y límite (con el plan de la
 * suscripción) y la reserva en begin_ai_request, que decide pausa, peticiones
 * en vuelo y cuota en una sola transacción. Devuelve el id de la reserva.
 */
async function admit(gateway, { sub, now, estimate, maxInFlight }) {
  // Un sub que no es un uuid no puede ser una cuenta.
  if (!UUID.test(sub)) throw licenseRevoked();
  let subscription;
  try {
    subscription = await gateway.currentSubscription(sub);
  } catch (error) {
    throw accountingUnavailable("subscription", error);
  }
  if (!includedAiSubscription(subscription, now)) throw licenseRevoked();
  const period = currentUsagePeriod(subscription, subscription.plan_catalog, now);
  const requestId = crypto.randomUUID();
  let decision;
  try {
    decision = await gateway.beginAiRequest({ userId: sub, requestId, planId: subscription.plan_id, period, estimate, maxInFlight });
  } catch (error) {
    throw accountingUnavailable("begin", error);
  }
  if (decision?.allowed === true && decision.reason === "ok") return requestId;
  throw admissionDenied(decision, period, now);
}

function relayHeaders(upstreamResponse, fallbackContentType) {
  const headers = {
    "Content-Type": upstreamResponse.headers.get("content-type") || fallbackContentType,
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  };
  // retry-after y x-should-retry guían los reintentos del SDK; request-id sirve para pedir ayuda a Anthropic.
  for (const name of ["retry-after", "x-should-retry", "request-id"]) {
    const value = upstreamResponse.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Un error del proveedor que es cosa de la petición (400, 429, 529, 5xx) pasa
 * al cliente con su estado y cuerpo: pi-ai sabe reintentar una sobrecarga.
 * Uno de la cuenta de pteron en Anthropic (clave, crédito, tope de gasto,
 * modelo no disponible) no es del docente: se traduce a 503 provider_paused y
 * queda en el log para Marco.
 */
async function providerFailure(upstreamResponse) {
  const raw = await upstreamResponse.text().catch(() => "");
  const error = parseJson(raw)?.error;
  const status = upstreamResponse.status;
  const type = typeof error?.type === "string" ? error.type : null;
  const account =
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 404 ||
    (status === 400 && ACCOUNT_LIMIT_MESSAGE.test(String(error?.message ?? ""))) ||
    (status === 429 && error?.details?.error_code === "enforced_spend_limit_reached");
  if (account) {
    console.error("pteron gateway account", { status, type });
    return gatewayErrorResponse(includedAiUnavailable("provider_paused"));
  }
  console.error("pteron gateway upstream error", { status, type });
  return new Response(raw, { status, headers: relayHeaders(upstreamResponse, "application/json") });
}

/**
 * Copia el cuerpo del proveedor hacia el cliente byte a byte mientras el
 * rastreador lo observa. Si el cliente corta, se deja de leer al proveedor (que
 * deja de generar) y se anota lo visto: el Worker sigue vivo gracias a waitUntil.
 */
async function relay(upstreamBody, writable, tracker) {
  const writer = writable.getWriter();
  let reader = null;
  try {
    reader = upstreamBody.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tracker.push(decoder.decode(value, { stream: true }));
      await writer.write(value);
    }
    tracker.push(decoder.decode());
    await writer.close();
  } catch (error) {
    console.error("pteron gateway streaming failed", error instanceof Error ? error.message : error);
    await writer.abort(error).catch(() => undefined);
    await reader?.cancel().catch(() => undefined);
  }
}

/**
 * Lo que se anota al cerrar la reserva. Sin message_delta (el cliente cortó
 * antes, o el stream se cayó) la salida se estima por lo reenviado: Anthropic
 * la cobra igual.
 */
function streamOutcome(seen) {
  if (seen.sawMessageDelta) return { status: "ok", usage: seen.usage, model: seen.model };
  const usage = { ...(seen.usage || {}) };
  usage.output_tokens = Math.max(Number(usage.output_tokens) || 0, estimatedOutputTokens(seen.forwardedChars));
  return { status: "client_abort", usage, model: seen.model };
}

function bufferedOutcome(text) {
  const parsed = parseJson(text);
  if (parsed?.usage && typeof parsed.usage === "object") {
    return { status: "ok", usage: parsed.usage, model: typeof parsed.model === "string" ? parsed.model : null };
  }
  return { status: "client_abort", usage: { output_tokens: estimatedOutputTokens(text.length) }, model: null };
}

/**
 * Un único modelo virtual: el profesor nunca ve el proveedor real detrás del
 * plan (ADR-056). Exige la misma configuración que el chat y respeta la pausa,
 * para que la salud de la app no muestre conectada una IA que no responde.
 */
export async function models({ request, env, services }) {
  method(request, "GET");
  try {
    gatewayConfig(env);
    await authenticateGateway(request, services.publicKeys);
    let paused;
    try {
      paused = await services.gateway.includedAiPaused();
    } catch (error) {
      throw accountingUnavailable("pause", error);
    }
    if (paused) throw includedAiUnavailable("paused");
    return json(200, { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
  } catch (error) {
    return gatewayFailure(error);
  }
}

/**
 * POST /api/ai/v1/messages: la API Messages de Anthropic con la licencia como
 * credencial. Orden: configuración, licencia, cuerpo con tope, saneamiento,
 * suscripción vigente con su período y límite, reserva, proveedor y relay. La
 * reserva se cierra siempre, en `finally` y dentro de waitUntil, con el gasto
 * real (0 si el proveedor respondió con error).
 */
export async function messages({ request, env, execution, services }) {
  method(request, "POST");
  try {
    const config = gatewayConfig(env);
    const verified = await authenticateGateway(request, services.publicKeys);
    const { input, bytes } = await readMessagesBody(request);
    const body = sanitizeMessagesRequest(input, { userId: await opaqueUserId(config.signingKey, verified.sub), model: config.modelId });
    const betas = allowedBetas(request.headers.get("anthropic-beta"));
    const client = clientInfo(request.headers);
    const estimate = reservationEstimate(bytes, body.max_tokens);
    const requestId = await admit(services.gateway, {
      sub: verified.sub,
      now: new Date(),
      estimate,
      maxInFlight: config.maxInFlight,
    });

    let outcome = { status: "gateway_error", usage: null, model: null };
    let providerRequestId = null;
    let relaying = null;
    try {
      let upstreamResponse;
      try {
        upstreamResponse = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            ...(betas ? { "anthropic-beta": betas } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        console.error("pteron gateway upstream unreachable", error instanceof Error ? error.message : error);
        outcome = { ...outcome, status: "provider_unreachable" };
        throw includedAiUnavailable("provider_unreachable");
      }
      providerRequestId = upstreamResponse.headers.get("request-id");
      if (upstreamResponse.status !== 200) {
        outcome = { ...outcome, status: "provider_error" };
        return await providerFailure(upstreamResponse);
      }
      if (!body.stream || !upstreamResponse.body) {
        let text;
        try {
          text = await upstreamResponse.text();
        } catch (error) {
          // Anthropic ya ejecutó la petición con su 200 y la cobra aunque el
          // cuerpo no llegue: se anota lo reservado, no 0.
          console.error("pteron gateway upstream read failed", error instanceof Error ? error.message : error);
          outcome = { status: "upstream_read_failed", usage: null, model: null, units: estimate };
          throw includedAiUnavailable("provider_unreachable");
        }
        outcome = bufferedOutcome(text);
        return new Response(text, { status: 200, headers: relayHeaders(upstreamResponse, "application/json") });
      }
      const tracker = createUsageTracker();
      const { readable, writable } = new TransformStream();
      relaying = relay(upstreamResponse.body, writable, tracker).then(() => {
        outcome = streamOutcome(tracker.finish());
      });
      return new Response(readable, { status: 200, headers: relayHeaders(upstreamResponse, "text/event-stream") });
    } finally {
      execution.waitUntil(
        Promise.resolve(relaying).then(() => {
          // Con error del proveedor o del gateway no hubo gasto: usage queda en null y se anota 0.
          // Si el proveedor ejecutó pero su respuesta no se pudo leer, outcome.units trae lo reservado.
          const breakdown = unitsFromUsage(outcome.usage ?? {}, config.modelId);
          const units = outcome.units ?? breakdown.units;
          return services.gateway.finishAiRequest(requestId, units, {
            route_model: outcome.model || config.modelId,
            ...breakdown,
            units,
            status: outcome.status,
            ...client,
            request_id: providerRequestId,
          });
        }),
      );
    }
  } catch (error) {
    return gatewayFailure(error);
  }
}
