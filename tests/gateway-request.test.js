import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_BETAS,
  MAX_BODY_BYTES,
  allowedBetas,
  clientInfo,
  opaqueUserId,
  readMessagesBody,
  sanitizeMessagesRequest,
} from "../src/lib/gateway-request.js";

const MODEL = "claude-haiku-5-5";
const options = { userId: "id-opaco", model: MODEL };

/** La forma que arma pi-ai 1.1.0 para pteron-managed: esfuerzo alto arriba y el de cada turno en mensajes system. */
function piAiRequest() {
  return {
    model: "pteron-managed",
    max_tokens: 32_768,
    stream: true,
    system: [{ type: "text", text: "Eres pteron.", cache_control: { type: "ephemeral" } }],
    tools: [
      {
        name: "crear_material",
        description: "Crea el material.",
        eager_input_streaming: true,
        input_schema: { type: "object", properties: { titulo: { type: "string" } }, required: ["titulo"] },
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive", display: "summarized", block_binding: { prefix_mismatch_behavior: "drop_block" } },
    output_config: { effort: "high" },
    messages: [
      { role: "user", content: [{ type: "text", text: "Una guía de fracciones." }] },
      { role: "system", content: [], output_config: { effort: "low" } },
      { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "firma" }, { type: "text", text: "Listo." }] },
      { role: "user", content: [{ type: "text", text: "Más corta.", cache_control: { type: "ephemeral" } }] },
      { role: "system", content: [], output_config: { effort: "low" } },
    ],
  };
}

test("la petición real de pi-ai sale igual, salvo el modelo, el esfuerzo de arriba y metadata.user_id", () => {
  const body = sanitizeMessagesRequest(piAiRequest(), options);
  const expected = piAiRequest();
  assert.deepEqual(body, {
    ...expected,
    model: MODEL,
    output_config: { effort: "low" },
    metadata: { user_id: "id-opaco" },
  });
});

test("sólo pasan los campos permitidos: el resto se descarta aunque Anthropic lo acepte", () => {
  const body = sanitizeMessagesRequest(
    {
      ...piAiRequest(),
      stop_sequences: ["FIN"],
      tool_choice: { type: "auto" },
      mcp_servers: [{ type: "url", url: "https://mcp.test", name: "x" }],
      container: "contenedor",
      inference_geo: "us",
      service_tier: "auto",
      speed: "fast",
      fallbacks: [{ model: "otro" }],
      context_management: { edits: [] },
      temperature: 0.2,
      top_p: 0.9,
      top_k: 5,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
    options,
  );
  assert.deepEqual(Object.keys(body).sort(), [
    "max_tokens",
    "messages",
    "metadata",
    "model",
    "output_config",
    "stop_sequences",
    "stream",
    "system",
    "thinking",
    "tool_choice",
    "tools",
  ]);
  assert.deepEqual(body.stop_sequences, ["FIN"]);
  assert.deepEqual(body.tool_choice, { type: "auto" });
});

test("max_tokens se acota a 65.536, falta = 32.768 y un valor que no es entero no pasa", () => {
  const withTokens = (max_tokens) => sanitizeMessagesRequest({ ...piAiRequest(), max_tokens }, options).max_tokens;
  assert.equal(withTokens(128_000), 65_536);
  assert.equal(withTokens(65_536), 65_536);
  assert.equal(withTokens(1000), 1000);
  assert.equal(withTokens(0), 0);
  assert.equal(withTokens(undefined), 32_768);
  assert.equal(withTokens(null), 32_768);
  for (const invalid of ["mucho", -1, 1.5]) {
    assert.throws(() => withTokens(invalid), { status: 400, code: "request_not_allowed", message: /^request_not_allowed: / });
  }
});

test("el esfuerzo queda en bajo arriba y en todo mensaje con output_config; format se conserva", () => {
  const input = piAiRequest();
  input.output_config = { effort: "max", format: { type: "json_schema", schema: { type: "object" } }, task_budget: { type: "tokens", total: 90_000 } };
  input.messages[1].output_config = { effort: "max" };
  input.messages[4].output_config = { effort: "xhigh", task_budget: { type: "tokens", total: 1 } };
  input.messages[3].output_config = { effort: "high" };
  const body = sanitizeMessagesRequest(input, options);
  assert.deepEqual(body.output_config, { effort: "low", format: { type: "json_schema", schema: { type: "object" } } });
  assert.deepEqual(body.messages[1].output_config, { effort: "low" });
  assert.deepEqual(body.messages[4].output_config, { effort: "low" });
  assert.deepEqual(body.messages[3].output_config, { effort: "low" });
  assert.equal("output_config" in body.messages[0], false, "no se agrega donde no venía");
  assert.deepEqual(sanitizeMessagesRequest({ messages: [{ role: "user", content: "hola" }] }, options).output_config, { effort: "low" });
});

test("thinking sólo pasa adaptativo, con display y block_binding si venían", () => {
  const thinking = (value) => sanitizeMessagesRequest({ ...piAiRequest(), thinking: value }, options).thinking;
  assert.deepEqual(thinking({ type: "adaptive" }), { type: "adaptive" });
  assert.deepEqual(thinking({ type: "adaptive", display: "omitted", budget_tokens: 50_000 }), { type: "adaptive", display: "omitted" });
  assert.equal(thinking({ type: "enabled", budget_tokens: 50_000 }), undefined);
  assert.equal(thinking({ type: "disabled" }), undefined);
  assert.equal(thinking("adaptive"), undefined);
});

test("tools: sólo herramientas propias con nombre y esquema, con sus campos permitidos", () => {
  const input = piAiRequest();
  input.tools = [
    {
      type: "custom",
      name: "propia",
      description: "d",
      input_schema: { type: "object" },
      strict: true,
      eager_input_streaming: true,
      defer_loading: true,
      input_examples: [{}],
      allowed_callers: ["code_execution_20260120"],
    },
    { type: "web_search_20260209", name: "web_search", max_uses: 99 },
    // Con un esquema agregado sigue siendo de servidor: no se convierte en una herramienta propia.
    { type: "web_fetch_20260209", name: "web_fetch", input_schema: { type: "object" } },
    { type: "code_execution_20260521", name: "code_execution" },
    { type: "mcp_toolset", mcp_server_name: "x" },
    { name: "sin_esquema", description: "d" },
    { name: "", input_schema: { type: "object" } },
    "no-es-una-herramienta",
  ];
  const body = sanitizeMessagesRequest(input, options);
  assert.deepEqual(body.tools, [{ name: "propia", description: "d", input_schema: { type: "object" }, strict: true, eager_input_streaming: true }]);
  input.tools = [{ type: "web_search_20260209", name: "web_search" }];
  assert.equal("tools" in sanitizeMessagesRequest(input, options), false, "sin herramientas válidas no se envía la lista");
});

test("cache_control con ttl distinto de 5 minutos pierde el ttl en system, tools y bloques de messages", () => {
  const input = piAiRequest();
  input.system[0].cache_control = { type: "ephemeral", ttl: "1h" };
  input.tools[0].cache_control = { type: "ephemeral", ttl: "1h" };
  input.messages[3].content[0].cache_control = { type: "ephemeral", ttl: "1h" };
  input.messages[0].content.push({
    type: "tool_result",
    tool_use_id: "t1",
    content: [{ type: "text", text: "resultado", cache_control: { type: "ephemeral", ttl: "1h" } }],
    cache_control: { type: "ephemeral", ttl: "5m" },
  });
  const body = sanitizeMessagesRequest(input, options);
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(body.tools[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(body.messages[3].content[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(body.messages[0].content[1].content[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(body.messages[0].content[1].cache_control, { type: "ephemeral", ttl: "5m" }, "5 minutos queda como venía");
});

test("una herramienta definida dentro de un mensaje (inline-tools) pasa por la misma lista blanca", () => {
  const input = piAiRequest();
  input.messages.splice(4, 0, {
    role: "system",
    content: [
      { type: "tool_removal", tool: { type: "tool_reference", name: "vieja" } },
      { type: "tool_addition", tool: { type: "tool_definition", definition: { type: "web_search_20260209", name: "web_search" } } },
      { type: "tool_addition", tool: { type: "tool_definition", definition: { type: "mcp_toolset", mcp_server_name: "x" } } },
      {
        type: "tool_addition",
        tool: { type: "tool_definition", definition: { name: "nueva", input_schema: { type: "object" }, defer_loading: true, cache_control: { type: "ephemeral", ttl: "1h" } } },
      },
      { type: "tool_addition", tool: { type: "tool_reference", name: "crear_material" } },
    ],
  });
  const body = sanitizeMessagesRequest(input, options);
  assert.deepEqual(body.messages[4].content, [
    { type: "tool_removal", tool: { type: "tool_reference", name: "vieja" } },
    { type: "tool_addition", tool: { type: "tool_definition", definition: { name: "nueva", input_schema: { type: "object" }, cache_control: { type: "ephemeral" } } } },
    { type: "tool_addition", tool: { type: "tool_reference", name: "crear_material" } },
  ]);
});

test("metadata siempre es el identificador opaco del gateway, nunca el que manda el cliente", () => {
  const body = sanitizeMessagesRequest({ ...piAiRequest(), metadata: { user_id: "correo@escuela.cl", otra: 1 } }, options);
  assert.deepEqual(body.metadata, { user_id: "id-opaco" });
});

test("stream sólo es true si el cliente lo pide con true", () => {
  assert.equal(sanitizeMessagesRequest({ ...piAiRequest(), stream: "sí" }, options).stream, false);
  assert.equal(sanitizeMessagesRequest({ ...piAiRequest(), stream: undefined }, options).stream, false);
});

test("un cuerpo sin mensajes o con mensajes que no son objetos es request_not_allowed", () => {
  for (const messages of [undefined, [], "hola", [null], ["texto"]]) {
    assert.throws(() => sanitizeMessagesRequest({ ...piAiRequest(), messages }, options), { status: 400, code: "request_not_allowed" });
  }
});

function postBody(body, headers = {}) {
  return new Request("https://pteron.test/api/ai/v1/messages", { method: "POST", headers, body, duplex: "half" });
}

test("readMessagesBody devuelve el JSON y su peso en bytes (UTF-8, no caracteres)", async () => {
  const raw = JSON.stringify({ messages: [{ role: "user", content: "fracción ñandú" }] });
  const { input, bytes } = await readMessagesBody(postBody(raw));
  assert.equal(input.messages[0].content, "fracción ñandú");
  assert.equal(bytes, raw.length + 3, "ó, ñ y ú pesan 2 bytes cada una");
});

test("readMessagesBody responde 413 prompt_too_long sobre 1.200.000 bytes, declarados o leídos", async () => {
  const big = `{"messages":[{"role":"user","content":"${"x".repeat(MAX_BODY_BYTES)}"}]}`;
  await assert.rejects(readMessagesBody(postBody("{}", { "content-length": String(MAX_BODY_BYTES + 1) })), {
    status: 413,
    code: "prompt_too_long",
    message: /^prompt_too_long: /,
  });
  const chunks = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(big));
      controller.close();
    },
  });
  await assert.rejects(readMessagesBody(postBody(chunks)), { status: 413, code: "prompt_too_long" });
  const exact = `{"m":"${"x".repeat(MAX_BODY_BYTES - 8)}"}`;
  assert.equal((await readMessagesBody(postBody(exact))).bytes, MAX_BODY_BYTES, "el tope mismo todavía cabe");
});

test("readMessagesBody responde request_not_allowed a lo que no es un objeto JSON", async () => {
  for (const raw of ["", "no es json", "[]", "null", "42"]) {
    await assert.rejects(readMessagesBody(postBody(raw)), { status: 400, code: "request_not_allowed", message: /^request_not_allowed: / });
  }
});

test("anthropic-beta sólo deja las tres betas de pi-ai, sin repetir", () => {
  assert.equal(
    allowedBetas("fine-grained-tool-streaming-2025-05-14, mid-conversation-output-config-2026-07-01,mcp-client-2025-11-20,thinking-binding-controls-2026-08-01,mid-conversation-output-config-2026-07-01"),
    "mid-conversation-output-config-2026-07-01,thinking-binding-controls-2026-08-01",
  );
  assert.equal(allowedBetas(ALLOWED_BETAS.join(",")), ALLOWED_BETAS.join(","));
  assert.equal(allowedBetas("server-side-fallback-2026-07-01,fast-mode-2026-02-01"), null);
  assert.equal(allowedBetas(null), null);
  assert.equal(allowedBetas(""), null);
});

test("metadata.user_id es un HMAC estable de 32 caracteres que no deja ver el sub", async () => {
  const sub = "8a6e0804-2bd0-4672-b79d-d97027f9071a";
  const first = await opaqueUserId("clave-de-firma", sub);
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.equal(await opaqueUserId("clave-de-firma", sub), first, "la misma cuenta siempre da el mismo id");
  assert.notEqual(await opaqueUserId("clave-de-firma", "0b0f8a50-7f3c-4f51-9b3e-5d2a8f6e1c11"), first);
  assert.notEqual(await opaqueUserId("otra-clave", sub), first, "sin la clave de firma no se puede recalcular");
  assert.equal(first.includes(sub.slice(0, 8)), false);
});

test("clientInfo guarda sólo la versión y la plataforma de la app, acotadas a 40 caracteres", () => {
  assert.deepEqual(clientInfo(new Headers({ "x-pteron-version": "0.7.2", "x-pteron-platform": "darwin", "user-agent": "pi" })), {
    client_version: "0.7.2",
    platform: "darwin",
  });
  assert.deepEqual(clientInfo(new Headers()), { client_version: null, platform: null });
  assert.equal(clientInfo(new Headers({ "x-pteron-version": "9".repeat(100) })).client_version.length, 40);
});
