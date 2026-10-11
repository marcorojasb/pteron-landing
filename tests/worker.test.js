import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { createServices, matchApi } from "../src/worker.js";
import { createLicenseService } from "../src/lib/license.js";
import { chatCompletions, messages, models } from "../src/routes/ai.js";
import { fakeAssets, fakeAssetsWithEtags, fakeExecution, fakeSupabase, jsonRequest, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";

const env = testEnv();

test("matchApi resuelve las rutas públicas y rechaza nombres heredados del prototipo", () => {
  assert.equal(typeof matchApi("/api/auth/me"), "function");
  assert.equal(matchApi("/api/auth/me/"), matchApi("/api/auth/me"));
  assert.equal(typeof matchApi("/api/billing/card-callback"), "function");
  assert.equal(typeof matchApi("/api/activation/exchange"), "function");
  assert.equal(typeof matchApi("/api/license/renew"), "function");
  assert.equal(typeof matchApi("/api/account"), "function");
  assert.equal(typeof matchApi("/api/ai/v1/models"), "function");
  assert.equal(typeof matchApi("/api/ai/v1/chat/completions"), "function");
  assert.equal(matchApi("/api/auth/constructor"), null);
  assert.equal(matchApi("/api/auth/__proto__"), null);
  assert.equal(matchApi("/api/nada"), null);
  assert.equal(matchApi("/api"), null);
  assert.equal(matchApi("/api/auth/me/extra"), null);
});

test("una ruta de API desconocida responde 404 JSON", async () => {
  const res = await worker.fetch(new Request("https://pteron.test/api/nada"), env, fakeExecution());
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "not_found", message: "Ruta no encontrada." });
});

test("método incorrecto y falta de sesión se rechazan antes de tocar Supabase", async () => {
  await withFetch(async () => { throw new Error("no debe llamar a la red"); }, async () => {
    const wrongMethod = await worker.fetch(new Request("https://pteron.test/api/auth/me", { method: "POST" }), env, fakeExecution());
    assert.equal(wrongMethod.status, 405);
    const noAuth = await worker.fetch(new Request("https://pteron.test/api/account"), env, fakeExecution());
    assert.equal(noAuth.status, 401);
    assert.equal((await noAuth.json()).error, "not_authenticated");
  });
});

test("sin configuración de Supabase la API responde 503 en vez de fallar con 500", async () => {
  const res = await worker.fetch(new Request("https://pteron.test/api/account", { headers: { authorization: "Bearer x" } }), { PUBLIC_SITE_URL: "https://pteron.test" }, fakeExecution());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "supabase_not_configured");
});

test("request-magic-link apunta el retorno a /cuenta sin barra final", async () => {
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }, async () => {
    const res = await worker.fetch(jsonRequest("https://pteron.test/api/auth/request-magic-link", { email: "Profe@Escuela.cl" }), env, fakeExecution());
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/auth\/v1\/otp\?redirect_to=https%3A%2F%2Fpteron\.test%2Fcuenta$/);
    assert.deepEqual(calls[0].body, { email: "profe@escuela.cl", create_user: true });
  });
});

test("los assets se sirven tal cual y /docs/:slug cae a la página de documentación", async () => {
  const assets = fakeAssets({ "/docs": "<html>docs</html>", "/docs/data/releases.json": "{}" });
  const bound = { ...env, ASSETS: assets };
  const page = await worker.fetch(new Request("https://pteron.test/docs/instalacion"), bound, fakeExecution());
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "<html>docs</html>");
  assert.deepEqual(assets.calls, ["/docs/instalacion", "/docs"]);

  const data = await worker.fetch(new Request("https://pteron.test/docs/data/releases.json"), bound, fakeExecution());
  assert.equal(data.status, 200);

  const missing = await worker.fetch(new Request("https://pteron.test/no-existe"), bound, fakeExecution());
  assert.equal(missing.status, 404);

  const nested = await worker.fetch(new Request("https://pteron.test/docs/a/b"), bound, fakeExecution());
  assert.equal(nested.status, 404, "sólo un segmento se reescribe, como la regla anterior /docs/:slug");

  const slash = await worker.fetch(new Request("https://pteron.test/docs/instalacion/"), bound, fakeExecution());
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.get("location"), "https://pteron.test/docs/instalacion");

  const post = await worker.fetch(new Request("https://pteron.test/docs/instalacion", { method: "POST" }), bound, fakeExecution());
  assert.equal(post.status, 404, "un POST no se reescribe a la página");
});

function gatewayFixture() {
  const keys = testKeyPair();
  const gatewayEnv = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem, ANTHROPIC_API_KEY: "upstream-key", ANTHROPIC_BASE_URL: "https://upstream.test", GATEWAY_MODEL_ID: "modelo-real" });
  const services = testServices(gatewayEnv, { k1: keys.publicPem });
  const sign = (overrides = {}) => createLicenseService(gatewayEnv, null).signLicense({ subject: "profe-1", plan: "pro", expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides });
  return { keys, gatewayEnv, services, sign };
}

test("models exige licencia y devuelve el único modelo virtual", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  // Las rutas lanzan HttpError; es handleApi quien lo convierte en respuesta.
  await assert.rejects(models({ request: new Request("https://pteron.test/api/ai/v1/models"), env: gatewayEnv, services }), { status: 401, code: "not_authenticated" });
  const token = await sign();
  const ok = await models({ request: new Request("https://pteron.test/api/ai/v1/models", { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, services });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
});

test("chat/completions retransmite el stream byte a byte y contabiliza los tokens al terminar", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const token = await sign();
  const sse = [
    'data: {"model":"modelo-real","choices":[{"delta":{"content":"ho',
    'la"}}]}\n\ndata: {"model":"modelo-real","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
    "data: [DONE]\n\n",
  ];
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} });
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: null }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: true, units_used: 0 }]);
    if (target === "https://upstream.test/v1/chat/completions") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of sse) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/chat/completions", { model: "pteron-managed", stream: true, temperature: 0.2, messages: [{ role: "user", content: "hola" }] }, { headers: { authorization: `Bearer ${token}` } });
    const res = await chatCompletions({ request, env: gatewayEnv, execution, services });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(await res.text(), sse.join(""));
    await execution.settle();

    const upstream = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.equal(upstream.body.model, "modelo-real", "el cliente nunca elige el modelo real");
    assert.equal("temperature" in upstream.body, false, "Haiku 5.5 rechaza temperature; el puente la omite");
    assert.equal(upstream.headers.authorization, "Bearer upstream-key");
    assert.deepEqual(upstream.body.stream_options, { include_usage: true });
    const reservations = calls.filter((call) => call.url.includes("reserve_ai_usage")).map((call) => call.body);
    assert.equal(reservations.length, 2, "chequeo previo con 0 y registro final con el gasto real");
    assert.equal(reservations[0].p_units, 0);
    assert.equal(reservations[1].p_units, 15);
    assert.deepEqual(reservations[1].p_metadata, { route_model: "modelo-real" });
    assert.equal(reservations[1].p_user_id, "profe-1");
  });
});

test("chat/completions sin stream devuelve el JSON del proveedor y contabiliza desde él", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const token = await sign({ plan: "basic" });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, body: init.body ? JSON.parse(init.body) : null });
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: 1000 }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: true, units_used: 7 }]);
    if (target.endsWith("/chat/completions")) return Response.json({ id: "x", model: "modelo-real", choices: [], usage: { prompt_tokens: 4, completion_tokens: 3 } });
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/chat/completions", { messages: [] }, { headers: { authorization: `Bearer ${token}` } });
    const res = await chatCompletions({ request, env: gatewayEnv, execution, services });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).model, "modelo-real");
    await execution.settle();
    const final = calls.filter((call) => call.url.includes("reserve_ai_usage")).at(-1).body;
    assert.equal(final.p_units, 7);
    assert.equal(final.p_limit, 1000);
    assert.equal(final.p_plan_id, "basic");
  });
});

test("chat/completions corta con 429 cuando la cuota ya se agotó, sin llamar al proveedor", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const token = await sign();
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: 10 }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: false, units_used: 10 }]);
    throw new Error(`No debe llamar a ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const request = jsonRequest("https://pteron.test/api/ai/v1/chat/completions", { messages: [] }, { headers: { authorization: `Bearer ${token}` } });
    const res = await chatCompletions({ request, env: gatewayEnv, execution: fakeExecution(), services });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error, "quota_exceeded");
  });
});

test("chat/completions sin clave del proveedor responde 503 antes de validar la licencia", async () => {
  const res = await worker.fetch(jsonRequest("https://pteron.test/api/ai/v1/chat/completions", { messages: [] }), env, fakeExecution());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "gateway_not_configured");
});

test("license/renew reemite a partir de una licencia firmada aunque esté vencida", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const old = await sign({ expiresAt: new Date(Date.now() - 86400000).toISOString() });
  const supabase = fakeSupabase([
    { table: "subscriptions", method: "GET", respond: { body: [{ plan_id: "pro", current_period_end: new Date(Date.now() + 86400000).toISOString(), plan_catalog: { license_plan: "pro" } }] } },
    { table: "licenses", method: "POST", respond: { body: [{ id: "l" }] } },
  ]);
  await withFetch(supabase.fetch, async () => {
    const route = matchApi("/api/license/renew");
    const request = jsonRequest("https://pteron.test/api/license/renew", { token: old });
    const res = await route({ request, env: gatewayEnv, url: new URL(request.url), execution: fakeExecution(), services });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.plan, "pro");
    assert.notEqual(payload.token, old);
  });
  const bogus = await worker.fetch(jsonRequest("https://pteron.test/api/license/renew", { token: "x.y" }), gatewayEnv, fakeExecution());
  assert.equal(bogus.status, 401);
});

test("createServices expone las claves públicas reales para verificar licencias", () => {
  const services = createServices(env);
  assert.equal(typeof services.publicKeys.k1, "string");
  assert.match(services.publicKeys.k1, /BEGIN PUBLIC KEY/);
});

function messagesFixture() {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const sse = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"modelo-real","usage":{"input_tokens":100,"cache_creation_input_tokens":20,"cache_read_input_tokens":30,"output_tokens":1}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ho',
    'la"}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":50}}\n\n',
    "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
  ];
  return { gatewayEnv, services, sign, sse };
}

test("messages retransmite la API Messages de Anthropic con la licencia en x-api-key y suma todos los tokens", async () => {
  const { gatewayEnv, services, sign, sse } = messagesFixture();
  const token = await sign();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} });
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: null }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: true, units_used: 0 }]);
    if (target === "https://upstream.test/v1/messages") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of sse) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
    }
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/messages", { model: "pteron-managed", stream: true, max_tokens: 1000, messages: [{ role: "user", content: "hola" }] }, {
      headers: { "x-api-key": token, "anthropic-version": "2023-06-01", "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
    });
    const res = await messages({ request, env: gatewayEnv, execution, services });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(await res.text(), sse.join(""));
    await execution.settle();

    const upstream = calls.find((call) => call.url === "https://upstream.test/v1/messages");
    assert.equal(upstream.body.model, "modelo-real");
    assert.equal(upstream.body.max_tokens, 1000);
    assert.equal(upstream.headers["x-api-key"], "upstream-key", "la clave real sólo la pone el Worker");
    assert.equal(upstream.headers["anthropic-version"], "2023-06-01");
    assert.equal(upstream.headers["anthropic-beta"], "fine-grained-tool-streaming-2025-05-14", "las betas del cliente se reenvían");
    assert.equal("authorization" in upstream.headers, false);

    const reservations = calls.filter((call) => call.url.includes("reserve_ai_usage")).map((call) => call.body);
    assert.equal(reservations.length, 2);
    assert.equal(reservations[1].p_units, 200, "entrada 100 + caché 20 + 30 + salida 50");
    assert.deepEqual(reservations[1].p_metadata, { route_model: "modelo-real" });
  });
});

test("messages sin stream contabiliza desde el JSON de la respuesta", async () => {
  const { gatewayEnv, services, sign } = messagesFixture();
  const token = await sign();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, body: init.body ? JSON.parse(init.body) : null });
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: null }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: true, units_used: 0 }]);
    if (target.endsWith("/v1/messages")) return Response.json({ id: "msg", model: "modelo-real", content: [], usage: { input_tokens: 10, output_tokens: 5 } });
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [], max_tokens: 10 }, { headers: { authorization: `Bearer ${token}` } });
    const res = await messages({ request, env: gatewayEnv, execution, services });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).model, "modelo-real");
    await execution.settle();
    assert.equal(calls.filter((call) => call.url.includes("reserve_ai_usage")).at(-1).body.p_units, 15);
  });
});

test("messages pasa al cliente un 429 del proveedor con su cuerpo y traduce un 401 de la clave propia a 502", async () => {
  const { gatewayEnv, services, sign } = messagesFixture();
  const token = await sign();
  let upstreamStatus = 429;
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: null }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) return Response.json([{ allowed: true, units_used: 0 }]);
    if (target.endsWith("/v1/messages")) return Response.json({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }, { status: upstreamStatus });
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const rateLimited = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [] }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution: fakeExecution(), services });
    assert.equal(rateLimited.status, 429);
    assert.equal((await rateLimited.json()).error.type, "rate_limit_error");
    upstreamStatus = 401;
    const badKey = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [] }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution: fakeExecution(), services });
    assert.equal(badKey.status, 502);
    assert.equal((await badKey.json()).error, "gateway_upstream_error");
  });
});

test("la cuota se aplica en el chequeo previo cuando el período ya está lleno y el cruce registra lo que cabe", async () => {
  const { gatewayEnv, services, sign } = messagesFixture();
  const token = await sign();
  const reservations = [];
  let unitsUsed = 1000;
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/rest/v1/plan_catalog")) return Response.json([{ ai_units_limit: 1000 }]);
    if (target.includes("/rest/v1/rpc/reserve_ai_usage")) {
      const body = JSON.parse(init.body);
      reservations.push(body.p_units);
      const allowed = unitsUsed + body.p_units <= 1000;
      if (allowed) unitsUsed += body.p_units;
      return Response.json([{ allowed, units_used: unitsUsed }]);
    }
    if (target.endsWith("/v1/messages")) return Response.json({ id: "msg", model: "modelo-real", content: [], usage: { input_tokens: 400, output_tokens: 100 } });
    throw new Error(`Sin mock para ${target}`);
  };
  await withFetch(fetchImpl, async () => {
    const full = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [] }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution: fakeExecution(), services });
    assert.equal(full.status, 429, "con lo usado igual al tope no se llama al proveedor");

    unitsUsed = 700;
    reservations.length = 0;
    const execution = fakeExecution();
    const originalError = console.error;
    console.error = () => {};
    try {
      const crossing = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [] }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution, services });
      assert.equal(crossing.status, 200);
      await crossing.text();
      await execution.settle();
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(reservations, [0, 500, 300], "500 no cabe; se anotan los 300 restantes y el período queda lleno");
    assert.equal(unitsUsed, 1000);
  });
});

test("la sonda de /docs/:slug ignora una 404 cacheada y la página de docs sí acepta 304 y HEAD", async () => {
  const assets = fakeAssetsWithEtags({ "/docs": { body: "<html>docs</html>", etag: '"docs-etag"' } });
  const bound = { ...env, ASSETS: assets };
  const cached404 = await worker.fetch(new Request("https://pteron.test/docs/instalacion", { headers: { "if-none-match": '"etag-404"' } }), bound, fakeExecution());
  assert.equal(cached404.status, 200, "una 404 cacheada no debe convertirse en 304");
  assert.equal(await cached404.text(), "<html>docs</html>");
  assert.equal(assets.calls[0].ifNoneMatch, null, "la sonda va sin condicionales");

  const fresh = await worker.fetch(new Request("https://pteron.test/docs/instalacion", { headers: { "if-none-match": '"docs-etag"' } }), bound, fakeExecution());
  assert.equal(fresh.status, 304, "el ETag de la página de docs sí vale");

  const head = await worker.fetch(new Request("https://pteron.test/docs/instalacion", { method: "HEAD" }), bound, fakeExecution());
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(assets.calls.at(-1).method, "HEAD");
});

test("las respuestas del Worker llevan las mismas cabeceras de seguridad que los assets", async () => {
  const res = await worker.fetch(new Request("https://pteron.test/api/nada"), env, fakeExecution());
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(res.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  const redirect = await worker.fetch(new Request("https://pteron.test/docs/x/"), { ...env, ASSETS: fakeAssets({}) }, fakeExecution());
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("x-frame-options"), "DENY");
});
