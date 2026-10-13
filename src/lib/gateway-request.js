import { HttpError, readText } from "./http.js";
import { hmacSha256Hex, utf8Encoder } from "./crypto.js";
import { GatewayError } from "./gateway.js";

/**
 * Lo que el gateway deja pasar a Anthropic. La licencia es una credencial
 * portable: cualquiera que la tenga podría pedir lo que la API cobre (búsquedas
 * web, caché de 1 hora, 128K de salida, un conector MCP). El costo lo fija este
 * archivo, no el cliente: una lista blanca de campos, herramientas y betas, el
 * esfuerzo bajo forzado (ADR-169) y topes de tamaño.
 */

// ~300K tokens: un tope contra el abuso, no contra conversaciones largas. Sobre
// 100K tokens se cobra el tramo largo en unidades, porque 0.7.0 y 0.7.1 no
// compactan por tokens y un rechazo cortaría sus sesiones.
export const MAX_BODY_BYTES = 1_200_000;
// La app pide 32.768 y, si la respuesta se corta por longitud, reintenta con 65.536.
export const MAX_OUTPUT_TOKENS = 65_536;
export const DEFAULT_OUTPUT_TOKENS = 32_768;
// Las betas que pi-ai 1.1.0 manda para pteron-managed. Sin thinking-binding-controls,
// la API rechazaría el block_binding que la app pone en cada petición.
export const ALLOWED_BETAS = Object.freeze([
  "mid-conversation-output-config-2026-07-01",
  "thinking-binding-controls-2026-08-01",
  "inline-tools-2026-09-15",
]);
// Siempre el mismo valor, arriba y en cada mensaje system: así la historia no
// cambia entre peticiones y ni la caché ni el razonamiento previo se invalidan.
const FORCED_EFFORT = "low";
const TOOL_FIELDS = ["name", "description", "input_schema", "cache_control", "eager_input_streaming", "strict"];
const CLIENT_HEADER_LENGTH = 40;

const PROMPT_TOO_LONG = "La conversación es demasiado larga para la IA incluida. Empieza una nueva o usa tu propia clave.";
const NOT_ALLOWED = "La solicitud no tiene un formato válido.";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function notAllowed() {
  return new GatewayError(400, "request_not_allowed", NOT_ALLOWED);
}

/** Lee el cuerpo con el tope del gateway y devuelve el JSON y cuántos bytes pesaba (la reserva se estima con ellos). */
export async function readMessagesBody(request) {
  let raw;
  try {
    raw = await readText(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof HttpError && error.status === 413) throw new GatewayError(413, "prompt_too_long", PROMPT_TOO_LONG);
    throw error;
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw notAllowed();
  }
  if (!isPlainObject(input)) throw notAllowed();
  return { input, bytes: utf8Encoder.encode(raw).byteLength };
}

/** Un ttl distinto de 5 minutos se quita: la escritura de 1 hora cuesta el doble. */
function shortCache(block) {
  if (isPlainObject(block) && isPlainObject(block.cache_control) && block.cache_control.ttl !== undefined && block.cache_control.ttl !== "5m") {
    delete block.cache_control.ttl;
  }
}

/** Sólo herramientas propias; las de servidor (búsqueda, ejecución de código) y mcp_toolset no pasan. */
function ownTool(tool) {
  if (!isPlainObject(tool) || (tool.type !== undefined && tool.type !== "custom")) return null;
  if (typeof tool.name !== "string" || !tool.name || !isPlainObject(tool.input_schema)) return null;
  const clean = {};
  for (const field of TOOL_FIELDS) {
    if (tool[field] !== undefined) clean[field] = tool[field];
  }
  shortCache(clean);
  return clean;
}

/**
 * Con inline-tools una herramienta también puede definirse dentro de un
 * mensaje system (`tool_addition` por valor): pasa por la misma lista blanca,
 * o la de `tools` se saltaría con un mensaje. Una adición por referencia
 * apunta a `tools`, que ya está saneado.
 */
function contentBlocks(blocks) {
  const kept = [];
  for (const block of blocks) {
    // Un bloque de compactación puede traer `tool_changes` con herramientas por
    // valor, fuera de ownTool(). El gateway descarta context_management, así que
    // Anthropic nunca los produce para nuestras peticiones y la app no los envía.
    if (isPlainObject(block) && block.type === "compaction") continue;
    if (isPlainObject(block) && block.type === "tool_addition" && block.tool?.type === "tool_definition") {
      const definition = ownTool(block.tool.definition);
      if (!definition) continue;
      block.tool.definition = definition;
    }
    shortCache(block);
    if (isPlainObject(block) && block.type === "tool_result" && Array.isArray(block.content)) block.content.forEach(shortCache);
    kept.push(block);
  }
  return kept;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) throw notAllowed();
  for (const message of messages) {
    if (!isPlainObject(message)) throw notAllowed();
    // pi-ai pone «high» arriba y el esfuerzo de cada turno en mensajes system
    // con output_config: todos quedan en bajo, también los de la historia.
    if (message.output_config !== undefined) message.output_config = { effort: FORCED_EFFORT };
    if (Array.isArray(message.content)) message.content = contentBlocks(message.content);
  }
  return messages;
}

function maxTokens(value) {
  if (value === undefined || value === null) return DEFAULT_OUTPUT_TOKENS;
  if (!Number.isInteger(value) || value < 0) throw notAllowed();
  return Math.min(value, MAX_OUTPUT_TOKENS);
}

/**
 * El cuerpo que se envía a Anthropic, armado sólo con campos permitidos (el
 * resto, como mcp_servers, container, inference_geo, service_tier, speed,
 * fallbacks, context_management o el muestreo, se descarta). `model` es el del
 * gateway y `metadata.user_id`, el identificador opaco de la cuenta.
 */
export function sanitizeMessagesRequest(input, { userId, model }) {
  const body = {
    model,
    messages: sanitizeMessages(input.messages),
    max_tokens: maxTokens(input.max_tokens),
    stream: input.stream === true,
    output_config: { effort: FORCED_EFFORT, ...(isPlainObject(input.output_config?.format) ? { format: input.output_config.format } : {}) },
    metadata: { user_id: userId },
  };
  if (input.system !== undefined) {
    if (Array.isArray(input.system)) input.system.forEach(shortCache);
    body.system = input.system;
  }
  if (Array.isArray(input.tools)) {
    const tools = input.tools.map(ownTool).filter(Boolean);
    if (tools.length) body.tools = tools;
  }
  if (input.tool_choice !== undefined) body.tool_choice = input.tool_choice;
  if (isPlainObject(input.thinking) && input.thinking.type === "adaptive") {
    body.thinking = { type: "adaptive" };
    if (input.thinking.display !== undefined) body.thinking.display = input.thinking.display;
    if (input.thinking.block_binding !== undefined) body.thinking.block_binding = input.thinking.block_binding;
  }
  if (input.stop_sequences !== undefined) body.stop_sequences = input.stop_sequences;
  return body;
}

/** La cabecera anthropic-beta filtrada a las betas permitidas; null si no queda ninguna. */
export function allowedBetas(header) {
  const requested = String(header || "").split(",").map((beta) => beta.trim());
  const kept = [...new Set(requested.filter((beta) => ALLOWED_BETAS.includes(beta)))];
  return kept.length ? kept.join(",") : null;
}

/**
 * Identificador opaco y estable de la cuenta para `metadata.user_id`: Anthropic
 * lo usa para detectar abuso de una persona sin culpar a toda la organización,
 * y no puede volver al usuario sin la clave de firma de pteron.
 */
export async function opaqueUserId(secret, sub) {
  return (await hmacSha256Hex(secret, `pteron-usuario:${sub}`)).slice(0, 32);
}

function clientHeader(headers, name) {
  return String(headers.get(name) ?? "").trim().slice(0, CLIENT_HEADER_LENGTH) || null;
}

/** Versión y plataforma de la app (0.7.2 en adelante), para medir la adopción. Nada más de la petición se guarda. */
export function clientInfo(headers) {
  return { client_version: clientHeader(headers, "x-pteron-version"), platform: clientHeader(headers, "x-pteron-platform") };
}
