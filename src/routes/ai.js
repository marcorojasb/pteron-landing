import { HttpError, SECURITY_HEADERS, json, method, parseJsonObject, readText } from "../lib/http.js";
import {
  authenticateGateway,
  createMessagesTracker,
  createSseTracker,
  totalTokensFromAnthropicUsage,
  totalTokensFromUsage,
} from "../lib/gateway.js";

const ANTHROPIC_VERSION = "2023-06-01";

/**
 * El proveedor detrás del plan es Anthropic; el modelo lo decide el servidor
 * (ADR-056): el cliente sólo pide "pteron-managed". La clave de Anthropic es
 * de pteron, nunca del profesor (ADR-055).
 */
function upstreamConfig(env) {
  const baseUrl = String(env?.ANTHROPIC_BASE_URL || "https://api.anthropic.com").trim().replace(/\/$/, "");
  const apiKey = String(env?.ANTHROPIC_API_KEY || "").trim();
  const modelId = String(env?.GATEWAY_MODEL_ID || "claude-haiku-5-5").trim();
  if (!apiKey) throw new HttpError(503, "gateway_not_configured", "El motor incluido todavía no está configurado.");
  return { baseUrl, apiKey, modelId };
}

// Deliberadamente más grande que el límite de 64 KB de lib/http: una
// conversación larga con las herramientas del agente no cabe en ese tope.
async function readJsonBody(request, maxBytes = 4_000_000) {
  const raw = await readText(request, maxBytes);
  if (!raw.trim()) throw new HttpError(400, "invalid_json", "Falta el cuerpo de la solicitud.");
  return parseJsonObject(raw);
}

// route_model queda en event_metadata (jsonb, sin contenido) precisamente
// para que "qué modelo usó" siga siendo respondible (ADR-056) aunque el
// cliente sólo haya pedido el id virtual "pteron-managed".
async function recordUsage(gateway, verified, totalTokens, model) {
  if (totalTokens <= 0) return;
  try {
    const metadata = model ? { route_model: model } : {};
    const result = await gateway.reserveAiUsage(verified.sub, verified.plan, totalTokens, metadata);
    // La función de la base rechaza el registro que cruza el tope y no anota
    // nada. Sin esto el período nunca se llenaba y el 429 era inalcanzable:
    // se anota lo que cabe, el período queda lleno y la próxima petición se
    // detiene en el chequeo previo. El excedente real queda en el log.
    if (!result.allowed && result.limit !== null) {
      const remaining = Math.max(0, result.limit - (Number(result.unitsUsed) || 0));
      console.error("pteron gateway quota crossed", { requested: totalTokens, recorded: remaining });
      if (remaining > 0) await gateway.reserveAiUsage(verified.sub, verified.plan, remaining, metadata);
    }
  } catch (error) {
    console.error("pteron gateway usage accounting failed", error instanceof Error ? error.message : error);
  }
}

/**
 * Copia el cuerpo del proveedor hacia el cliente byte a byte mientras observa
 * el texto para contabilizar tokens. Si el cliente corta la conexión, se
 * registra lo visto hasta entonces: el Worker sigue vivo gracias a waitUntil.
 */
async function relay(upstreamBody, writable, observe) {
  const reader = upstreamBody.getReader();
  const writer = writable.getWriter();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      observe(value);
      await writer.write(value);
    }
    await writer.close();
  } catch (error) {
    console.error("pteron gateway streaming failed", error instanceof Error ? error.message : error);
    await writer.abort(error).catch(() => undefined);
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Todo lo que puede fallar antes del primer byte (configuración, licencia,
 * cuota) se resuelve acá; después la respuesta ya es 200 y cualquier falla se
 * registra y corta la transmisión, nunca se convierte en un JSON de error.
 */
async function prepare({ request, env, services }) {
  const upstream = upstreamConfig(env);
  const verified = await authenticateGateway(request, services.publicKeys);
  const precheck = await services.gateway.reserveAiUsage(verified.sub, verified.plan, 0);
  // Con 0 unidades la base siempre permite; el tope se aplica acá comparando lo usado.
  const exhausted = precheck.limit !== null && (Number(precheck.unitsUsed) || 0) >= precheck.limit;
  if (!precheck.allowed || exhausted) {
    return {
      denied: json(429, {
        error: "quota_exceeded",
        message: "Se agotó la capacidad de IA incluida de este mes. Puedes seguir trabajando con el motor local o con tu propia clave.",
      }),
    };
  }
  return { upstream, verified, input: await readJsonBody(request) };
}

/**
 * Un error del proveedor pasa al cliente con su estado y cuerpo cuando son
 * cosa de la petición (400, 429, 529…): pi-ai sabe reintentar una sobrecarga.
 * Un 401/403 es un problema de la clave de pteron, no de la licencia del
 * profesor, y se traduce para no confundir a la app.
 */
function upstreamFailure(upstreamResponse) {
  console.error("pteron gateway upstream error", upstreamResponse.status);
  if (upstreamResponse.status === 401 || upstreamResponse.status === 403 || !upstreamResponse.body) {
    return json(502, {
      error: "gateway_upstream_error",
      message: "El motor incluido no respondió. Puedes seguir con el motor local.",
    });
  }
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

function streamBack({ execution, services, verified, upstreamResponse, observe, summarize, fallbackContentType }) {
  const { readable, writable } = new TransformStream();
  execution.waitUntil(
    relay(upstreamResponse.body, writable, observe).then(() => {
      const { totalTokens, model } = summarize();
      return recordUsage(services.gateway, verified, totalTokens, model);
    }),
  );
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") || fallbackContentType,
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

/**
 * Un único modelo virtual: el profesor nunca ve el proveedor real detrás del
 * plan (ADR-056), y el gateway queda libre de cambiarlo sin que el cliente
 * tenga que hacer nada. Exige licencia igual que el chat: una licencia vencida
 * no debería poder ni siquiera listar el modelo.
 */
export async function models({ request, services }) {
  method(request, "GET");
  await authenticateGateway(request, services.publicKeys);
  return json(200, { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
}

/**
 * POST /api/ai/v1/messages: la API Messages de Anthropic tal cual, con la
 * licencia como credencial y el modelo decidido acá. La app de escritorio
 * (pi-ai sobre el SDK oficial) envía la licencia en `x-api-key` y sus betas en
 * `anthropic-beta`; ambas se respetan, la clave real se añade sólo aquí.
 */
export async function messages(ctx) {
  const { request, env, execution, services } = ctx;
  method(request, "POST");
  const prepared = await prepare(ctx);
  if (prepared.denied) return prepared.denied;
  const { upstream, verified, input } = prepared;
  const stream = Boolean(input.stream);
  const headers = {
    "content-type": "application/json",
    "x-api-key": upstream.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
  const betas = request.headers.get("anthropic-beta");
  if (betas) headers["anthropic-beta"] = betas;

  const upstreamResponse = await fetch(`${upstream.baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...input, model: upstream.modelId }),
  });
  if (!upstreamResponse.ok || !upstreamResponse.body) return upstreamFailure(upstreamResponse);

  const decoder = new TextDecoder();
  const tracker = createMessagesTracker();
  let buffered = "";
  return streamBack({
    execution,
    services,
    verified,
    upstreamResponse,
    fallbackContentType: stream ? "text/event-stream" : "application/json",
    observe: (chunk) => {
      const text = decoder.decode(chunk, { stream: true });
      if (stream) tracker.push(text);
      else buffered += text;
    },
    summarize: () => {
      if (stream) {
        const { usage, model } = tracker.flush();
        return { totalTokens: totalTokensFromAnthropicUsage(usage), model };
      }
      try {
        const parsed = JSON.parse(buffered);
        return {
          totalTokens: totalTokensFromAnthropicUsage(parsed?.usage),
          model: typeof parsed?.model === "string" ? parsed.model : null,
        };
      } catch {
        return { totalTokens: 0, model: null };
      }
    },
  });
}

/**
 * POST /api/ai/v1/chat/completions: puente transitorio para la app 0.6.0, que
 * todavía habla el formato de chat completions. Va por la capa compatible con
 * OpenAI de Anthropic, que ésta documenta como apta para pruebas y no como
 * solución de largo plazo; la ruta nativa es /v1/messages y la app 0.7.0 la usa.
 * Se retira cuando ya no queden instalaciones 0.6.0 activas.
 */
export async function chatCompletions(ctx) {
  const { request, execution, services } = ctx;
  method(request, "POST");
  const prepared = await prepare(ctx);
  if (prepared.denied) return prepared.denied;
  const { upstream, verified, input } = prepared;
  const stream = Boolean(input.stream);
  // Haiku 5.5 rechaza temperature y top_p distintos del valor por defecto; el
  // cliente 0.6.0 no los necesita y la capa compatible recomienda omitirlos.
  const { temperature: _temperature, top_p: _topP, ...rest } = input;
  const upstreamBody = {
    ...rest,
    model: upstream.modelId,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };

  const upstreamResponse = await fetch(`${upstream.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${upstream.apiKey}` },
    body: JSON.stringify(upstreamBody),
  });
  if (!upstreamResponse.ok || !upstreamResponse.body) return upstreamFailure(upstreamResponse);

  const decoder = new TextDecoder();
  const tracker = createSseTracker();
  let buffered = "";
  return streamBack({
    execution,
    services,
    verified,
    upstreamResponse,
    fallbackContentType: stream ? "text/event-stream" : "application/json",
    observe: (chunk) => {
      const text = decoder.decode(chunk, { stream: true });
      if (stream) tracker.push(text);
      else buffered += text;
    },
    summarize: () => {
      if (stream) {
        const { usage, model } = tracker.flush();
        return { totalTokens: totalTokensFromUsage(usage), model };
      }
      try {
        const parsed = JSON.parse(buffered);
        return {
          totalTokens: totalTokensFromUsage(parsed?.usage),
          model: typeof parsed?.model === "string" ? parsed.model : null,
        };
      } catch {
        return { totalTokens: 0, model: null };
      }
    },
  });
}
