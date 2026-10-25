import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { createServices, matchApi } from "../src/worker.js";
import { createLicenseService } from "../src/lib/license.js";
import { messages, models } from "../src/routes/ai.js";
import { fakeAssets, fakeAssetsWithEtags, fakeExecution, fakeSupabase, jsonRequest, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";
import { fakeNetwork, matches } from "./helpers/fakes.js";

const env = testEnv();

test("matchApi resuelve las rutas públicas y rechaza nombres heredados del prototipo", () => {
  assert.equal(typeof matchApi("/api/auth/me"), "function");
  assert.equal(matchApi("/api/auth/me/"), matchApi("/api/auth/me"));
  assert.equal(typeof matchApi("/api/billing/card-callback"), "function");
  assert.equal(typeof matchApi("/api/activation/exchange"), "function");
  assert.equal(typeof matchApi("/api/license/renew"), "function");
  assert.equal(typeof matchApi("/api/account"), "function");
  assert.equal(typeof matchApi("/api/ai/v1/models"), "function");
  assert.equal(typeof matchApi("/api/ai/v1/messages"), "function");
  assert.equal(matchApi("/api/ai/v1/chat/completions"), null);
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
  const gatewayEnv = testEnv({ LICENSE_PRIVATE_KEY_PEM: keys.privatePem, ANTHROPIC_API_KEY: "upstream-key", ANTHROPIC_BASE_URL: "https://upstream.test", GATEWAY_MODEL_ID: "claude-haiku-5-5" });
  const services = testServices(gatewayEnv, { k2: keys.publicPem });
  const sign = (overrides = {}) => createLicenseService(gatewayEnv, null).signLicense({ subject: "profe-1", plan: "pro", expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides });
  return { keys, gatewayEnv, services, sign };
}

test("models exige licencia y devuelve el único modelo virtual", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  // El gateway responde sus errores con la forma del contrato, sin pasar por handleError.
  const missing = await models({ request: new Request("https://pteron.test/api/ai/v1/models"), env: gatewayEnv, services });
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: "not_authenticated", message: "not_authenticated: Falta la licencia." });
  const token = await sign();
  const settings = fakeSupabase([{ table: "app_settings", method: "GET", respond: { body: [{ value: false }] } }]);
  await withFetch(settings.fetch, async () => {
    const ok = await models({ request: new Request("https://pteron.test/api/ai/v1/models", { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, services });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
  });
});

test("el puente chat/completions ya no existe: responde 404 not_found como cualquier ruta /api desconocida", async () => {
  await withFetch(async () => { throw new Error("no debe llamar a la red"); }, async () => {
    const res = await worker.fetch(jsonRequest("https://pteron.test/api/ai/v1/chat/completions", { messages: [] }), env, fakeExecution());
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "not_found", message: "Ruta no encontrada." });
  });
});

test("messages sin clave del proveedor responde 503 not_configured antes de validar la licencia", async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const res = await worker.fetch(jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [] }), env, fakeExecution());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "included_ai_unavailable", message: "included_ai_unavailable: La IA incluida no está disponible ahora.", reason: "not_configured" });
  } finally {
    console.error = originalError;
  }
  // El log nombra lo que falta, nunca un valor.
  assert.deepEqual(logged, [["pteron gateway config", { invalid: ["ANTHROPIC_API_KEY", "GATEWAY_MODEL_ID", "LICENSE_PRIVATE_KEY_PEM"] }]]);
});

test("license/renew reemite a partir de una licencia firmada aunque esté vencida", async () => {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const old = await sign({ expiresAt: new Date(Date.now() - 86400000).toISOString() });
  const supabase = fakeSupabase([
    { table: "subscriptions", method: "GET", respond: { body: [{ plan_id: "pro", status: "active", current_period_end: new Date(Date.now() + 86400000).toISOString(), plan_catalog: { license_plan: "pro" } }] } },
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
  assert.equal(typeof services.publicKeys.k2, "string");
  assert.match(services.publicKeys.k2, /BEGIN PUBLIC KEY/);
});

const PROFE = "8a6e0804-2bd0-4672-b79d-d97027f9071a";

function messagesFixture() {
  const { gatewayEnv, services, sign } = gatewayFixture();
  const sse = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"claude-haiku-5-5","usage":{"input_tokens":100,"cache_creation_input_tokens":20,"cache_read_input_tokens":30,"output_tokens":1}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ho',
    'la"}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":50}}\n\n',
    "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
  ];
  const subscription = {
    plan_id: "pro",
    provider: "flow",
    status: "active",
    current_period_start: new Date(Date.now() - 86400000).toISOString(),
    current_period_end: new Date(Date.now() + 29 * 86400000).toISOString(),
    cancel_at_period_end: false,
    plan_catalog: { ai_units_limit: 30_000_000, trial_ai_units_limit: null, license_plan: "pro" },
  };
  return { gatewayEnv, services, sign: (overrides = {}) => sign({ subject: PROFE, ...overrides }), sse, subscription };
}

/** Supabase (suscripción y reservas) y Anthropic simulados para la ruta de mensajes. */
function messagesFetch(subscription, upstream, begin = { allowed: true, reason: "ok", units_used: 0, units_reserved: 1, units_limit: 30_000_000 }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} });
    if (target.includes("/rest/v1/subscriptions")) return Response.json([subscription]);
    if (target.includes("/rest/v1/rpc/begin_ai_request")) return Response.json([{ period_end: subscription.current_period_end, ...begin }]);
    if (target.includes("/rest/v1/rpc/finish_ai_request")) return Response.json([{ units_used: 1 }]);
    if (target === "https://upstream.test/v1/messages") return upstream();
    throw new Error(`Sin mock para ${target}`);
  };
  return { calls, fetchImpl, finishes: () => calls.filter((call) => call.url.includes("finish_ai_request")).map((call) => call.body) };
}

test("messages retransmite la API Messages de Anthropic con la licencia en x-api-key y anota unidades, no tokens brutos", async () => {
  const { gatewayEnv, services, sign, sse, subscription } = messagesFixture();
  const token = await sign();
  const upstream = () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sse) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
  };
  const { calls, fetchImpl, finishes } = messagesFetch(subscription, upstream);
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

    const upstreamCall = calls.find((call) => call.url === "https://upstream.test/v1/messages");
    assert.equal(upstreamCall.body.model, "claude-haiku-5-5", "el cliente nunca elige el modelo real");
    assert.equal(upstreamCall.body.max_tokens, 1000);
    assert.deepEqual(upstreamCall.body.output_config, { effort: "low" }, "esfuerzo bajo forzado (ADR-169)");
    assert.equal(upstreamCall.headers["x-api-key"], "upstream-key", "la clave real sólo la pone el Worker");
    assert.equal(upstreamCall.headers["anthropic-version"], "2023-06-01");
    assert.equal("anthropic-beta" in upstreamCall.headers, false, "una beta fuera de la lista blanca no se reenvía");
    assert.equal("authorization" in upstreamCall.headers, false);

    const [finish] = finishes();
    // Entrada 100 + caché escrita 20 ×1,25 + leída 30 ×0,1 + salida 50 ×5 = 378 unidades.
    assert.equal(finish.p_units, 378);
    assert.equal(finish.p_metadata.route_model, "claude-haiku-5-5");
    assert.equal(finish.p_metadata.status, "ok");
  });
});

test("messages sin stream contabiliza desde el JSON de la respuesta", async () => {
  const { gatewayEnv, services, sign, subscription } = messagesFixture();
  const token = await sign();
  const { fetchImpl, finishes } = messagesFetch(subscription, () => Response.json({ id: "msg", model: "claude-haiku-5-5", content: [], usage: { input_tokens: 10, output_tokens: 5 } }));
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [{ role: "user", content: "hola" }], max_tokens: 10 }, { headers: { authorization: `Bearer ${token}` } });
    const res = await messages({ request, env: gatewayEnv, execution, services });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).model, "claude-haiku-5-5");
    await execution.settle();
    assert.equal(finishes()[0].p_units, 35, "10 de entrada + 5 de salida ×5");
  });
});

test("messages pasa al cliente un 429 del proveedor con su cuerpo y traduce un 401 de la clave propia a 503 provider_paused", async () => {
  const { gatewayEnv, services, sign, subscription } = messagesFixture();
  const token = await sign();
  let upstreamStatus = 429;
  const { fetchImpl } = messagesFetch(subscription, () =>
    Response.json({ type: "error", error: { type: upstreamStatus === 429 ? "rate_limit_error" : "authentication_error", message: "x" } }, { status: upstreamStatus, headers: { "retry-after": "3", "request-id": "req_9" } }),
  );
  const originalError = console.error;
  console.error = () => {};
  try {
    await withFetch(fetchImpl, async () => {
      const send = async () => {
        const execution = fakeExecution();
        const res = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [{ role: "user", content: "hola" }] }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution, services });
        await execution.settle();
        return res;
      };
      const rateLimited = await send();
      assert.equal(rateLimited.status, 429);
      assert.equal(rateLimited.headers.get("retry-after"), "3");
      assert.equal(rateLimited.headers.get("request-id"), "req_9");
      assert.equal((await rateLimited.json()).error.type, "rate_limit_error");
      upstreamStatus = 401;
      const badKey = await send();
      assert.equal(badKey.status, 503);
      assert.deepEqual(await badKey.json(), { error: "included_ai_unavailable", message: "included_ai_unavailable: La IA incluida no está disponible ahora.", reason: "provider_paused" });
    });
  } finally {
    console.error = originalError;
  }
});

test("la cuota se reserva antes de llamar al proveedor y el gasto que cruza el tope se anota completo", async () => {
  const { gatewayEnv, services, sign, subscription } = messagesFixture();
  const token = await sign();
  const { calls, fetchImpl, finishes } = messagesFetch(
    subscription,
    () => Response.json({ id: "msg", model: "claude-haiku-5-5", content: [], usage: { input_tokens: 400, output_tokens: 100 } }),
    // Quedan 300 unidades: basta que quede algo libre para entrar.
    { allowed: true, reason: "ok", units_used: 29_999_700, units_reserved: 6000, units_limit: 30_000_000 },
  );
  await withFetch(fetchImpl, async () => {
    const execution = fakeExecution();
    const crossing = await messages({ request: jsonRequest("https://pteron.test/api/ai/v1/messages", { messages: [{ role: "user", content: "hola" }], max_tokens: 1000 }, { headers: { authorization: `Bearer ${token}` } }), env: gatewayEnv, execution, services });
    assert.equal(crossing.status, 200);
    await crossing.text();
    await execution.settle();
  });
  const order = calls.map((call) => (call.url.includes("rpc/") ? call.url.split("rpc/")[1] : call.url.includes("upstream") ? "anthropic" : "subscriptions"));
  assert.deepEqual(order, ["subscriptions", "begin_ai_request", "anthropic", "finish_ai_request"]);
  assert.equal(finishes()[0].p_units, 900, "400 de entrada + 100 ×5: el gasto real completo, aunque pase el tope");
});

test("los .txt de /docs salen declarados en UTF-8: el llms.txt no se lee como latin-1", async () => {
  const texto = "guías, rúbricas y Configuración › Modelo de IA";
  // Como los assets de Cloudflare: text/plain sin charset, con su ETag y la caché.
  const assets = {
    calls: [],
    async fetch(request) {
      const { pathname } = new URL(request.url);
      this.calls.push(pathname);
      const archivos = {
        "/docs/llms.txt": [texto, "text/plain"],
        "/docs/latin.txt": ["hola", "text/plain; charset=iso-8859-1"],
        "/docs/data/notas.txt": [texto, "text/plain"],
        "/docs/data/releases.json": ["{}", "application/json"],
      };
      if (!Object.hasOwn(archivos, pathname)) return new Response("<h1>404</h1>", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const [cuerpo, tipo] = archivos[pathname];
      return new Response(request.method === "HEAD" ? null : cuerpo, { headers: { "content-type": tipo, etag: '"llms"', "cache-control": "public, max-age=0, must-revalidate" } });
    },
  };
  const bound = { ...env, ASSETS: assets };
  const llms = await worker.fetch(new Request("https://pteron.test/docs/llms.txt"), bound, fakeExecution());
  assert.equal(llms.status, 200);
  assert.equal(llms.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(llms.headers.get("etag"), '"llms"', "las demás cabeceras siguen iguales");
  assert.equal(llms.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(await llms.text(), texto);
  assert.deepEqual(assets.calls, ["/docs/llms.txt"], "un archivo que existe no cae a la página de docs");

  const head = await worker.fetch(new Request("https://pteron.test/docs/llms.txt", { method: "HEAD" }), bound, fakeExecution());
  assert.equal(head.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await head.text(), "");

  const anidado = await worker.fetch(new Request("https://pteron.test/docs/data/notas.txt"), bound, fakeExecution());
  assert.equal(anidado.headers.get("content-type"), "text/plain; charset=utf-8");
  const declarado = await worker.fetch(new Request("https://pteron.test/docs/latin.txt"), bound, fakeExecution());
  assert.equal(declarado.headers.get("content-type"), "text/plain; charset=iso-8859-1", "un charset que ya viene no se toca");
  const json = await worker.fetch(new Request("https://pteron.test/docs/data/releases.json"), bound, fakeExecution());
  assert.equal(json.headers.get("content-type"), "application/json");
  const pagina = await worker.fetch(new Request("https://pteron.test/docs/no-existe.txt"), { ...env, ASSETS: fakeAssets({ "/docs": "<html>docs</html>" }) }, fakeExecution());
  assert.equal(pagina.headers.get("content-type"), "text/html; charset=utf-8", "la página de docs no cambia de tipo");
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

test("un archivo real de /docs (app.js, llms.txt) responde 304 a su ETag; sin condicionales se pide una sola vez", async () => {
  const assets = fakeAssetsWithEtags({
    "/docs": { body: "<html>docs</html>", etag: '"docs-etag"' },
    "/docs/app.js": { body: "/* app */", etag: '"app-etag"' },
  });
  const bound = { ...env, ASSETS: assets };
  const vigente = await worker.fetch(new Request("https://pteron.test/docs/app.js?v=1", { headers: { "if-none-match": '"app-etag"' } }), bound, fakeExecution());
  assert.equal(vigente.status, 304, "el navegador ya tiene app.js: no lo baja entero");
  assert.deepEqual(assets.calls.map((call) => call.ifNoneMatch), [null, '"app-etag"'], "la sonda va sin condicionales y el archivo real con ellas");

  const cambiado = await worker.fetch(new Request("https://pteron.test/docs/app.js?v=1", { headers: { "if-none-match": '"viejo"' } }), bound, fakeExecution());
  assert.equal(cambiado.status, 200);
  assert.equal(await cambiado.text(), "/* app */");

  assets.calls.length = 0;
  const primera = await worker.fetch(new Request("https://pteron.test/docs/app.js?v=1"), bound, fakeExecution());
  assert.equal(await primera.text(), "/* app */");
  assert.equal(assets.calls.length, 1, "sin condicionales basta la sonda");
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

test("la guarda de host responde 421 en las rutas con secretos fuera de PUBLIC_SITE_URL, sin tocar la red", async () => {
  await withFetch(async () => { throw new Error("no debe llamar a la red"); }, async () => {
    const paths = ["/api/ai/v1/messages", "/api/ai/v1/models", "/api/billing/checkout", "/api/billing/flow-callback", "/api/license/renew", "/api/activation/start", "/api/auth/request-magic-link", "/api/admin", "/api/admin/resumen", "/api/account", "/api/account/"];
    for (const host of ["https://pteron-landing.marco.workers.dev", "https://3f2a1b.pteron-landing.marco.workers.dev"]) {
      for (const path of paths) {
        const res = await worker.fetch(new Request(`${host}${path}`, { method: "POST" }), env, fakeExecution());
        assert.equal(res.status, 421, `${host}${path}`);
        assert.deepEqual(await res.json(), { error: "misdirected_request", message: "Esta dirección no atiende la cuenta, el cobro ni la IA incluida de pteron." });
      }
    }
    const unknown = await worker.fetch(new Request("https://pteron-landing.marco.workers.dev/api/nada"), env, fakeExecution());
    assert.equal(unknown.status, 404, "lo que no usa secretos no se guarda");
    const same = await worker.fetch(new Request("https://pteron.test/api/account"), env, fakeExecution());
    assert.equal(same.status, 401, "en el sitio publicado sigue de largo");
  });
});

test("la guarda deja pasar el equipo local y no rige sin PUBLIC_SITE_URL; uno ilegible no deja pasar a nadie", async () => {
  await withFetch(async () => { throw new Error("no debe llamar a la red"); }, async () => {
    for (const origin of ["http://localhost:8787", "http://127.0.0.1:8787"]) {
      const local = await worker.fetch(new Request(`${origin}/api/account`), { ...env, PUBLIC_SITE_URL: "https://pteron.patagua.dev" }, fakeExecution());
      assert.equal(local.status, 401, origin);
    }
    const unset = await worker.fetch(new Request("https://pteron-landing.marco.workers.dev/api/account"), { ...env, PUBLIC_SITE_URL: "" }, fakeExecution());
    assert.equal(unset.status, 401);
    const unreadable = await worker.fetch(new Request("https://pteron.test/api/account"), { ...env, PUBLIC_SITE_URL: "pteron sin esquema" }, fakeExecution());
    assert.equal(unreadable.status, 421);
  });
});

function healthFixture(overrides = {}) {
  const keys = testKeyPair();
  const healthEnv = testEnv({
    LICENSE_KID: "k2",
    LICENSE_PRIVATE_KEY_PEM: keys.privatePem,
    FLOW_API_KEY: "flow-api",
    FLOW_SECRET_KEY: "flow-secret",
    FLOW_BASE_URL: "https://www.flow.cl/api",
    ANTHROPIC_API_KEY: "anthropic-key",
    GATEWAY_MODEL_ID: "claude-haiku-5-5",
    ...overrides,
  });
  const services = testServices(healthEnv, { k2: keys.publicPem });
  const call = (init) => {
    const request = new Request("https://pteron.test/api/health", init);
    return matchApi("/api/health")({ request, env: healthEnv, url: new URL(request.url), execution: fakeExecution(), services });
  };
  return { healthEnv, call };
}

const settingsOnly = () => fakeNetwork([{ match: matches.supabase("app_settings"), respond: { body: [{ value: false }] } }]);

test("/api/health responde 200 {ok: true} con lo esencial en orden y no llama a Flow ni a Anthropic", async () => {
  const { call } = healthFixture();
  const network = settingsOnly();
  await withFetch(network.fetch, async () => {
    const res = await call();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(network.calls.every((call) => call.url.startsWith("https://fake.supabase.co/rest/v1/app_settings")), "sólo Supabase");
    assert.equal(network.calls[0].headers.Authorization, "Bearer service-role-fake");
    await assert.rejects(call({ method: "POST" }), { status: 405 });
  });
});

test("/api/health responde 503 {ok: false} sin nombrar lo que falta", async () => {
  const cases = [
    { ANTHROPIC_API_KEY: "" },
    { GATEWAY_MODEL_ID: "modelo-sin-precio" },
    { FLOW_SECRET_KEY: "" },
    { LICENSE_PRIVATE_KEY_PEM: "" },
    { LICENSE_KID: "k9" },
    { SUPABASE_PUBLISHABLE_KEY: "" },
  ];
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args);
  try {
    for (const overrides of cases) {
      const { call } = healthFixture(overrides);
      const res = await withFetch(settingsOnly().fetch, () => call());
      assert.equal(res.status, 503, JSON.stringify(overrides));
      assert.deepEqual(await res.json(), { ok: false });
    }
    const { call } = healthFixture();
    const down = await withFetch(fakeNetwork([{ match: matches.supabase("app_settings"), respond: { status: 500, body: { message: "caído" } } }]).fetch, () => call());
    assert.equal(down.status, 503, "Supabase no responde");
  } finally {
    console.error = originalError;
  }
  assert.ok(logged.every(([label, checks]) => label === "pteron health" && Object.values(checks).every((value) => typeof value === "boolean")), "el log sólo lleva booleanos");
  assert.equal(matchApi("/api/health"), matchApi("/api/health/"));
});

test("account informa trialEligible, termsVersion y el uso del período que contiene ahora o, si no hay, el más reciente", async () => {
  const day = 86400000;
  const base = Date.now();
  const at = (days) => new Date(base + days * day).toISOString();
  let flowRows = [];
  let periods = [];
  const network = fakeNetwork([
    { match: matches.auth("user"), respond: { body: { id: "user-1", email: "profe@escuela.cl", created_at: "2026-01-01T00:00:00.000Z" } } },
    { match: matches.supabase("profiles"), respond: { body: [{ display_name: "Profe" }] } },
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "basic", for_sale: false, trial_ai_units_limit: 1500000 }] } },
    { match: (url) => url.includes("/rest/v1/subscriptions") && url.includes("provider=eq.flow"), respond: () => ({ body: flowRows }) },
    { match: matches.supabase("subscriptions"), respond: { body: [{ id: "s1", plan_id: "basic", provider: "flow", status: "active", next_invoice_at: at(20), morose: 0, payment_link: null }] } },
    { match: matches.supabase("licenses"), respond: { body: [] } },
    { match: matches.supabase("usage_periods"), respond: () => ({ body: periods }) },
  ]);
  const read = async () => {
    const res = await worker.fetch(new Request("https://pteron.test/api/account", { headers: { authorization: "Bearer sesion" } }), env, fakeExecution());
    assert.equal(res.status, 200);
    return res.json();
  };
  await withFetch(network.fetch, async () => {
    const fresh = await read();
    assert.equal(fresh.trialEligible, true);
    assert.equal(fresh.termsVersion, "2026-10-13");
    assert.equal(fresh.usage, null);
    assert.equal(fresh.plans[0].trial_ai_units_limit, 1500000);
    assert.equal(fresh.subscriptions[0].next_invoice_at, at(20));

    flowRows = [{ id: "vieja" }];
    periods = [
      { period_start: at(-3), period_end: at(27), ai_units_used: 1200, ai_units_limit: 6000000 },
      { period_start: at(-33), period_end: at(-3), ai_units_used: 5900000, ai_units_limit: 6000000 },
    ];
    const current = await read();
    assert.equal(current.trialEligible, false, "la prueba es una por persona");
    assert.deepEqual(current.usage, { periodStart: at(-3), periodEnd: at(27), unitsUsed: 1200, unitsLimit: 6000000 });

    periods = [{ period_start: at(-31), period_end: at(-1), ai_units_used: "5900000", ai_units_limit: null }];
    const grace = await read();
    assert.deepEqual(grace.usage, { periodStart: at(-31), periodEnd: at(-1), unitsUsed: 5900000, unitsLimit: null }, "en la gracia del cobro, el último período");
  });
  const query = (fragment) => network.calls.find((call) => call.url.includes(fragment)).url;
  assert.match(query("/rest/v1/plan_catalog"), /trial_ai_units_limit,for_sale/);
  assert.match(query("/rest/v1/subscriptions?user_id=eq.user-1&select="), /cancel_at_period_end,canceled_at,next_invoice_at,morose,payment_link/);
  assert.match(query("/rest/v1/usage_periods"), /user_id=eq\.user-1&period_start=lte\.[^&]+&select=period_start,period_end,ai_units_used,ai_units_limit&order=period_start\.desc/);
  assert.ok(network.calls.filter((call) => call.url.includes("/rest/v1/")).every((call) => call.headers.Authorization === "Bearer sesion"), "todo con la sesión del profesor");
});

test("GET /api/plans dice qué planes se venden: sin sesión, con la clave publicable y caché de un minuto", async () => {
  const network = fakeNetwork([
    { match: matches.supabase("plan_catalog"), respond: { body: [{ id: "free", for_sale: false }, { id: "basic", for_sale: true }, { id: "pro", for_sale: false }] } },
  ]);
  await withFetch(network.fetch, async () => {
    const res = await worker.fetch(new Request("https://pteron.test/api/plans"), env, fakeExecution());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "public, max-age=60");
    assert.deepEqual(await res.json(), { plans: [{ id: "free", forSale: false }, { id: "basic", forSale: true }, { id: "pro", forSale: false }] });
    assert.equal(network.calls.length, 1);
    // La política pública de plan_catalog decide qué filas salen: activos y listados, sin la service role
    assert.match(network.calls[0].url, /\/rest\/v1\/plan_catalog\?active=eq\.true&listed=eq\.true&select=id,for_sale&/);
    assert.equal(network.calls[0].headers.Authorization, "Bearer publishable-fake");

    const post = await worker.fetch(new Request("https://pteron.test/api/plans", { method: "POST" }), env, fakeExecution());
    assert.equal(post.status, 405);
  });
});
