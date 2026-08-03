const { Readable } = require("node:stream");
const { HttpError, handler, json, method } = require("../../../_lib/http");
const {
  authenticateGateway,
  latestUsageAndModelFromSseChunk,
  reserveAiUsage,
  totalTokensFromUsage,
} = require("../../../_lib/gateway");

function upstreamConfig() {
  const baseUrl = String(process.env.GATEWAY_UPSTREAM_BASE_URL || "https://opencode.ai/zen/go/v1").trim().replace(/\/$/, "");
  const apiKey = String(process.env.GATEWAY_UPSTREAM_API_KEY || "").trim();
  const modelId = String(process.env.GATEWAY_UPSTREAM_MODEL_ID || "deepseek-v4-flash").trim();
  if (!apiKey) throw new HttpError(503, "gateway_not_configured", "El motor incluido todavía no está configurado.");
  return { baseUrl, apiKey, modelId };
}

// Deliberadamente más grande que el límite de 64 KB de _lib/http: una
// conversación larga con las herramientas del agente no cabe en ese tope.
async function readJsonBody(req, maxBytes = 4_000_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > maxBytes) throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
  }
  if (!raw.trim()) throw new HttpError(400, "invalid_json", "Falta el cuerpo de la solicitud.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "La solicitud no tiene un formato válido.");
  }
}

// route_model queda en event_metadata (jsonb, sin contenido) precisamente
// para que "qué modelo usó" siga siendo respondible (ADR-056) aunque el
// cliente sólo haya pedido el id virtual "pteron-managed".
function recordUsageInBackground(sub, plan, usage, model) {
  const totalTokens = totalTokensFromUsage(usage);
  if (totalTokens <= 0) return;
  reserveAiUsage(sub, plan, totalTokens, model ? { route_model: model } : {}).catch((error) => {
    console.error("pteron gateway usage accounting failed", error instanceof Error ? error.message : error);
  });
}

/**
 * Proxy de chat completions con la cuenta propia de pteron, nunca la del
 * profesor (ADR-055): el profesor no configura nada para este plan. El
 * upstream de hoy es fijo — DeepSeek Flash vía OpenCode Go, el ancla de costo
 * de docs/PLAN-0.3.md §3.5 —; elegirlo por tipo de tarea es P5 (ADR-056), no
 * este endpoint. El servidor no registra prompts ni respuestas, sólo tokens
 * (ADR-055): nada de lo que pasa por acá se guarda en `console.error` salvo
 * el estado de un error.
 *
 * Una vez que la respuesta empieza a transmitirse ya no puede convertirse en
 * un error JSON — por eso todo lo que puede fallar antes del primer byte
 * (configuración, licencia, cuota) se resuelve primero y queda que
 * `handler()` lo convierta en un error normal.
 */
module.exports = handler(async (req, res) => {
  method(req, "POST");
  const upstream = upstreamConfig();
  const verified = authenticateGateway(req);

  const precheck = await reserveAiUsage(verified.sub, verified.plan, 0);
  if (!precheck.allowed) {
    json(res, 429, {
      error: "quota_exceeded",
      message: "Se agotó la capacidad de IA incluida de este mes. Puedes seguir trabajando con el motor local o con tu propia clave.",
    });
    return;
  }

  const input = await readJsonBody(req);
  const stream = Boolean(input.stream);
  const upstreamBody = {
    ...input,
    model: upstream.modelId,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };

  const upstreamResponse = await fetch(`${upstream.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${upstream.apiKey}` },
    body: JSON.stringify(upstreamBody),
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    console.error("pteron gateway upstream error", upstreamResponse.status);
    json(res, 502, {
      error: "gateway_upstream_error",
      message: "El motor incluido no respondió. Puedes seguir con el motor local.",
    });
    return;
  }

  // A partir de acá la respuesta ya se decidió en 200: cualquier falla se
  // registra y corta la transmisión, nunca se convierte en un JSON de error.
  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    upstreamResponse.headers.get("content-type") || (stream ? "text/event-stream" : "application/json"),
  );
  res.setHeader("Cache-Control", "no-store");

  let usage = null;
  let model = null;
  let buffered = "";
  try {
    const decoder = new TextDecoder();
    for await (const chunk of Readable.fromWeb(upstreamResponse.body)) {
      const text = decoder.decode(chunk, { stream: true });
      if (stream) {
        const found = latestUsageAndModelFromSseChunk(text);
        usage = found.usage || usage;
        model = found.model || model;
      } else {
        buffered += text;
      }
      res.write(chunk);
    }
    if (!stream) {
      try {
        const parsed = JSON.parse(buffered);
        usage = parsed?.usage || null;
        model = typeof parsed?.model === "string" ? parsed.model : null;
      } catch {
        usage = null;
        model = null;
      }
    }
  } catch (error) {
    console.error("pteron gateway streaming failed", error instanceof Error ? error.message : error);
  } finally {
    res.end();
  }

  recordUsageInBackground(verified.sub, verified.plan, usage, model);
});
