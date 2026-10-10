import { HttpError, json, method, readText } from "../lib/http.js";
import { authenticateGateway, createSseTracker, totalTokensFromUsage } from "../lib/gateway.js";

function upstreamConfig(env) {
  const baseUrl = String(env?.GATEWAY_UPSTREAM_BASE_URL || "https://opencode.ai/zen/go/v1").trim().replace(/\/$/, "");
  const apiKey = String(env?.GATEWAY_UPSTREAM_API_KEY || "").trim();
  const modelId = String(env?.GATEWAY_UPSTREAM_MODEL_ID || "deepseek-v4-flash").trim();
  if (!apiKey) throw new HttpError(503, "gateway_not_configured", "El motor incluido todavía no está configurado.");
  return { baseUrl, apiKey, modelId };
}

// Deliberadamente más grande que el límite de 64 KB de lib/http: una
// conversación larga con las herramientas del agente no cabe en ese tope.
async function readJsonBody(request, maxBytes = 4_000_000) {
  const raw = await readText(request, maxBytes);
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
async function recordUsage(gateway, verified, usage, model) {
  const totalTokens = totalTokensFromUsage(usage);
  if (totalTokens <= 0) return;
  try {
    await gateway.reserveAiUsage(verified.sub, verified.plan, totalTokens, model ? { route_model: model } : {});
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
 * Proxy de chat completions con la cuenta propia de pteron, nunca la del
 * profesor (ADR-055): el profesor no configura nada para este plan. El
 * servidor no registra prompts ni respuestas, sólo tokens (ADR-055): nada de
 * lo que pasa por acá se guarda en `console.error` salvo el estado de un error.
 *
 * Una vez que la respuesta empieza a transmitirse ya no puede convertirse en
 * un error JSON — por eso todo lo que puede fallar antes del primer byte
 * (configuración, licencia, cuota) se resuelve primero.
 */
export async function chatCompletions({ request, env, execution, services }) {
  method(request, "POST");
  const upstream = upstreamConfig(env);
  const verified = await authenticateGateway(request, services.publicKeys);

  const precheck = await services.gateway.reserveAiUsage(verified.sub, verified.plan, 0);
  if (!precheck.allowed) {
    return json(429, {
      error: "quota_exceeded",
      message: "Se agotó la capacidad de IA incluida de este mes. Puedes seguir trabajando con el motor local o con tu propia clave.",
    });
  }

  const input = await readJsonBody(request);
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
    return json(502, {
      error: "gateway_upstream_error",
      message: "El motor incluido no respondió. Puedes seguir con el motor local.",
    });
  }

  // A partir de acá la respuesta ya se decidió en 200: cualquier falla se
  // registra y corta la transmisión, nunca se convierte en un JSON de error.
  const decoder = new TextDecoder();
  const tracker = createSseTracker();
  let buffered = "";
  const observe = (chunk) => {
    const text = decoder.decode(chunk, { stream: true });
    if (stream) tracker.push(text);
    else buffered += text;
  };
  const summarize = () => {
    if (stream) return tracker.flush();
    try {
      const parsed = JSON.parse(buffered);
      return { usage: parsed?.usage || null, model: typeof parsed?.model === "string" ? parsed.model : null };
    } catch {
      return { usage: null, model: null };
    }
  };

  const { readable, writable } = new TransformStream();
  execution.waitUntil(
    relay(upstreamResponse.body, writable, observe).then(() => {
      const { usage, model } = summarize();
      return recordUsage(services.gateway, verified, usage, model);
    }),
  );

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") || (stream ? "text/event-stream" : "application/json"),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
