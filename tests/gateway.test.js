import { test } from "node:test";
import assert from "node:assert/strict";
import { createLicenseService } from "../src/lib/license.js";
import {
  accessUntil,
  authenticateGateway,
  createGateway,
  createUsageTracker,
  currentUsagePeriod,
  includedAiSubscription,
} from "../src/lib/gateway.js";
import { opaqueUserId } from "../src/lib/gateway-request.js";
import { reservationEstimate } from "../src/lib/units.js";
import { chatCompletions, messages, models } from "../src/routes/ai.js";
import { fakeExecution, fakeNetwork, jsonRequest, matches, testEnv, testKeyPair, testServices, withFetch } from "./helpers/fakes.js";

const keys = testKeyPair();
const env = { LICENSE_PRIVATE_KEY_PEM: keys.privatePem, LICENSE_KID: "k1" };
const testKeys = { k1: keys.publicPem };

function reqWithToken(token) {
  return new Request("https://pteron.test/api/ai/v1/models", { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

function firmar(overrides = {}, customEnv = env) {
  return createLicenseService(customEnv, null).signLicense({
    subject: "sub-opaco-1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  });
}

test("authenticateGateway acepta una licencia Basic o Pro vigente", async () => {
  const verified = await authenticateGateway(reqWithToken(await firmar({ plan: "pro" })), testKeys);
  assert.equal(verified.sub, "sub-opaco-1");
  assert.equal(verified.plan, "pro");
});

test("authenticateGateway exige la licencia en Authorization Bearer o x-api-key", async () => {
  await assert.rejects(authenticateGateway(reqWithToken(""), testKeys), { status: 401, code: "not_authenticated", message: "not_authenticated: Falta la licencia." });
  const viaApiKey = new Request("https://pteron.test/api/ai/v1/messages", { headers: { "x-api-key": await firmar() } });
  assert.equal((await authenticateGateway(viaApiKey, testKeys)).sub, "sub-opaco-1");
});

test("authenticateGateway rechaza una firma que no verifica", async () => {
  const otra = testKeyPair();
  const token = await firmar({ subject: "sub-x" }, { LICENSE_PRIVATE_KEY_PEM: otra.privatePem, LICENSE_KID: "k1" });
  await assert.rejects(authenticateGateway(reqWithToken(token), testKeys), { status: 401, code: "invalid_license", message: /^invalid_license: / });
});

test("authenticateGateway rechaza una licencia vencida — a diferencia de la renovación, acá sí importa", async () => {
  const vencida = await firmar({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  await assert.rejects(authenticateGateway(reqWithToken(vencida), testKeys), { status: 401, code: "license_expired", message: /^license_expired: / });
});

test("authenticateGateway rechaza formato inválido sin lanzar un error distinto", async () => {
  await assert.rejects(authenticateGateway(reqWithToken("no-es-una-licencia"), testKeys), { code: "invalid_license" });
});

const DAY = 86_400_000;
const HOUR = 3_600_000;
const BASIC_PLAN = { ai_units_limit: 6_000_000, trial_ai_units_limit: 1_500_000, license_plan: "basic" };

test("accessUntil: lo pagado más 72 h en Flow, sin gracia si canceló al cierre ni en una cortesía", () => {
  const end = "2026-11-13T03:00:00.000Z";
  assert.equal(accessUntil({ provider: "flow", current_period_end: end, cancel_at_period_end: false }), Date.parse(end) + 72 * HOUR);
  assert.equal(accessUntil({ provider: "flow", current_period_end: end, cancel_at_period_end: true }), Date.parse(end));
  assert.equal(accessUntil({ provider: "comp", current_period_end: end }), Date.parse(end));
  assert.equal(accessUntil({ provider: "flow", current_period_end: null }), null, "sin fin no hay acceso: ningún respaldo inventa un período");
});

test("includedAiSubscription exige un estado que emite, un plan con licencia y acceso vigente", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const sub = (overrides) => ({ provider: "flow", status: "active", cancel_at_period_end: false, current_period_end: "2026-11-01T03:00:00Z", plan_catalog: BASIC_PLAN, ...overrides });
  for (const status of ["trialing", "active", "past_due"]) assert.equal(includedAiSubscription(sub({ status }), now), true, status);
  for (const status of ["canceled", "incomplete", "paused", "expired"]) assert.equal(includedAiSubscription(sub({ status }), now), false, status);
  assert.equal(includedAiSubscription(null, now), false);
  assert.equal(includedAiSubscription(sub({ plan_catalog: { ...BASIC_PLAN, license_plan: null } }), now), false, "un plan sin licencia no incluye la IA");
  assert.equal(includedAiSubscription(sub({ plan_catalog: null }), now), false);
  assert.equal(includedAiSubscription(sub({ current_period_end: "2026-10-12T03:00:00Z" }), now), true, "dentro de la gracia de Flow");
  assert.equal(includedAiSubscription(sub({ current_period_end: "2026-10-10T03:00:00Z" }), now), false, "pasada la gracia");
  assert.equal(includedAiSubscription(sub({ current_period_end: "2026-10-12T03:00:00Z", cancel_at_period_end: true }), now), false, "canceló al cierre: sin gracia");
  assert.equal(includedAiSubscription(sub({ provider: "comp", current_period_end: "2026-10-13T11:00:00Z" }), now), false, "cortesía terminada");
});

test("currentUsagePeriod: la prueba de Flow es su propio período, con la cuota de prueba", () => {
  const trial = { provider: "flow", status: "trialing", trial_starts_at: "2026-10-10T15:00:00.000Z", current_period_start: "2026-10-10T15:00:00.000Z", current_period_end: "2026-10-18T03:00:00.000Z" };
  const now = new Date("2026-10-13T12:00:00Z");
  assert.deepEqual(currentUsagePeriod(trial, BASIC_PLAN, now), { start: "2026-10-10T15:00:00.000Z", end: "2026-10-18T03:00:00.000Z", limit: 1_500_000 });
  assert.equal(currentUsagePeriod(trial, { ai_units_limit: 30_000_000, trial_ai_units_limit: null }, now).limit, 7_500_000, "sin cuota propia, un cuarto de la del plan");
  assert.equal(currentUsagePeriod(trial, { ai_units_limit: null, trial_ai_units_limit: null }, now).limit, 0, "una prueba nunca queda sin tope");
  assert.equal(currentUsagePeriod({ ...trial, trial_starts_at: null }, BASIC_PLAN, now).start, "2026-10-10T15:00:00.000Z", "sin trial_starts_at, el inicio del período, que en la prueba es el mismo");
});

test("currentUsagePeriod: lo pagado en Flow es el período, también en la gracia: la cuota se renueva con el cobro", () => {
  const paid = { provider: "flow", status: "active", current_period_start: "2026-10-05T03:00:00.000Z", current_period_end: "2026-11-05T03:00:00.000Z" };
  const expected = { start: "2026-10-05T03:00:00.000Z", end: "2026-11-05T03:00:00.000Z", limit: 6_000_000 };
  assert.deepEqual(currentUsagePeriod(paid, BASIC_PLAN, new Date("2026-10-20T12:00:00Z")), expected);
  assert.deepEqual(currentUsagePeriod(paid, BASIC_PLAN, new Date("2026-11-06T12:00:00Z")), expected, "pasado el fin, en la gracia, sigue el mismo período");
  assert.deepEqual(currentUsagePeriod({ ...paid, status: "past_due" }, BASIC_PLAN, new Date("2026-11-06T12:00:00Z")), expected);
  assert.equal(currentUsagePeriod(paid, { ai_units_limit: null }, new Date("2026-10-20T12:00:00Z")).limit, null, "null en el catálogo es sin tope");
});

test("currentUsagePeriod: un límite inválido o ausente del plan cuenta como 0, no como sin tope", () => {
  const paid = { provider: "flow", status: "active", current_period_start: "2026-10-05T03:00:00.000Z", current_period_end: "2026-11-05T03:00:00.000Z" };
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(currentUsagePeriod(paid, { ai_units_limit: -5 }, now).limit, 0);
  assert.equal(currentUsagePeriod(paid, { ai_units_limit: "6000000" }, now).limit, 0);
  assert.equal(currentUsagePeriod(paid, {}, now).limit, 0);
  assert.equal(currentUsagePeriod(paid, null, now).limit, 0);
  assert.equal(currentUsagePeriod({ ...paid, status: "trialing", trial_starts_at: paid.current_period_start }, { ai_units_limit: 6_000_000 }, now).limit, 0);
});

test("currentUsagePeriod: una cortesía cuenta meses de aniversario desde su inicio, con la cuota de su plan", () => {
  const comp = { provider: "comp", status: "active", current_period_start: "2026-01-31T15:00:00.000Z", current_period_end: "2027-01-31T15:00:00.000Z" };
  const tester = { ai_units_limit: 6_000_000, trial_ai_units_limit: null, license_plan: "basic" };
  assert.deepEqual(currentUsagePeriod(comp, tester, new Date("2026-03-05T12:00:00Z")), { start: "2026-02-28T15:00:00.000Z", end: "2026-03-31T15:00:00.000Z", limit: 6_000_000 });
  assert.deepEqual(currentUsagePeriod(comp, tester, new Date("2026-02-28T14:59:59Z")), { start: "2026-01-31T15:00:00.000Z", end: "2026-02-28T15:00:00.000Z", limit: 6_000_000 });
  assert.equal(currentUsagePeriod(comp, tester, new Date("2026-01-01T00:00:00Z")).start, "2026-01-31T15:00:00.000Z", "antes de empezar, el primer mes");
  assert.deepEqual(currentUsagePeriod(comp, tester, new Date("2027-02-01T00:00:00Z")), { start: "2027-01-31T15:00:00.000Z", end: "2027-02-28T15:00:00.000Z", limit: 6_000_000 });
});

test("currentUsagePeriod: sin fechas usa el mes calendario de Chile, con su horario de verano", () => {
  const noDates = { provider: "flow", status: "active", current_period_start: null, current_period_end: "2026-11-05T03:00:00.000Z" };
  const month = (iso) => {
    const { start, end } = currentUsagePeriod(noDates, BASIC_PLAN, new Date(iso));
    return [start, end];
  };
  assert.deepEqual(month("2026-10-13T12:00:00Z"), ["2026-10-01T03:00:00.000Z", "2026-11-01T03:00:00.000Z"], "octubre en horario de verano (UTC-3)");
  assert.deepEqual(month("2026-07-15T12:00:00Z"), ["2026-07-01T04:00:00.000Z", "2026-08-01T04:00:00.000Z"], "julio en horario de invierno (UTC-4)");
  assert.deepEqual(month("2026-04-15T12:00:00Z"), ["2026-04-01T03:00:00.000Z", "2026-05-01T04:00:00.000Z"], "abril cambia de horario a mitad de mes");
  assert.deepEqual(month("2026-11-01T02:30:00Z"), ["2026-10-01T03:00:00.000Z", "2026-11-01T03:00:00.000Z"], "las 23:30 del 31 de octubre en Chile siguen en octubre");
  assert.deepEqual(month("2026-12-20T12:00:00Z"), ["2026-12-01T03:00:00.000Z", "2027-01-01T03:00:00.000Z"]);
  const compSinInicio = { provider: "comp", status: "active", current_period_start: null, current_period_end: "2027-01-01T00:00:00Z" };
  assert.equal(currentUsagePeriod(compSinInicio, BASIC_PLAN, new Date("2026-10-13T12:00:00Z")).start, "2026-10-01T03:00:00.000Z");
});

function sseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

const MODEL = "claude-haiku-5-5";
const START_USAGE = { input_tokens: 1200, cache_creation_input_tokens: 2000, cache_read_input_tokens: 9000, cache_creation: { ephemeral_5m_input_tokens: 2000, ephemeral_1h_input_tokens: 0 }, output_tokens: 1 };
const START = sseEvent("message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: MODEL, content: [], usage: START_USAGE } });
const THINKING = (thinking) => sseEvent("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking } });
const SIGNATURE = sseEvent("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "firma-larga" } });
const TEXT = (text) => sseEvent("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text } });
const JSON_DELTA = (partial_json) => sseEvent("content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json } });
// En la API actual message_delta repite el usage acumulado; un null no debe borrar lo que trajo message_start.
const DELTA = sseEvent("message_delta", {
  type: "message_delta",
  delta: { stop_reason: "end_turn" },
  usage: { input_tokens: 1200, cache_creation_input_tokens: 2000, cache_read_input_tokens: 9000, cache_creation: null, server_tool_use: null, output_tokens: 600 },
});
const STOP = sseEvent("message_stop", { type: "message_stop" });
const PING = sseEvent("ping", { type: "ping" });

test("createUsageTracker fusiona el usage de message_start y message_delta sin pisarlo con null", () => {
  const tracker = createUsageTracker();
  const stream = START + PING + THINKING("pensando") + SIGNATURE + TEXT("Hola") + JSON_DELTA('{"titulo":') + DELTA + STOP;
  // Cortado en lugares incómodos: a mitad de una línea data:, de una secuencia de escape y de un nombre de evento.
  const cuts = [17, stream.indexOf('"usage"') + 3, stream.indexOf('\\"titulo') + 1, stream.indexOf("message_delta") + 5, stream.length];
  let position = 0;
  for (const cut of cuts) {
    assert.ok(cut > position);
    tracker.push(stream.slice(position, cut));
    position = cut;
  }
  const seen = tracker.finish();
  assert.equal(seen.model, MODEL);
  assert.equal(seen.sawMessageDelta, true);
  assert.deepEqual(seen.usage, { ...START_USAGE, output_tokens: 600 });
  assert.equal(seen.forwardedChars, "Hola".length + '{"titulo":'.length, "texto y JSON de herramientas; el razonamiento y la firma no");
});

test("createUsageTracker cuenta caracteres reales: una secuencia de escape es un carácter", () => {
  // JSON.stringify escribe \n, \", \t y \\ con dos caracteres y un carácter de control como \u0007, con seis.
  const text = 'línea\n"citada"\tá\u0007';
  const json = '{"a":"\\d"}';
  assert.equal(TEXT(text).includes("\\u0007"), true);
  const tracker = createUsageTracker();
  tracker.push(TEXT(text) + JSON_DELTA(json));
  assert.equal(tracker.finish().forwardedChars, text.length + json.length);
});

test("createUsageTracker reconoce los eventos sin línea event:, con fines de línea \\r\\n y una última línea sin salto", () => {
  const tracker = createUsageTracker();
  const data = (payload) => `data: ${JSON.stringify(payload)}\r\n\r\n`;
  tracker.push(data({ type: "message_start", message: { model: MODEL, usage: { input_tokens: 5 } } }));
  tracker.push(data({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "abc" } }));
  tracker.push(`data: ${JSON.stringify({ type: "message_delta", usage: { output_tokens: 7 } })}`);
  assert.deepEqual(tracker.finish(), { usage: { input_tokens: 5, output_tokens: 7 }, model: MODEL, sawMessageDelta: true, forwardedChars: 3 });
});

test("createUsageTracker no lanza con JSON roto y sin message_delta lo dice", () => {
  const tracker = createUsageTracker();
  tracker.push('event: message_start\ndata: {"type":"message_start","message":{"usa\n\n');
  tracker.push(TEXT("ok"));
  tracker.push('event: message_delta\ndata: {"type":"message_delta","delta":{}}\n\n');
  assert.deepEqual(tracker.finish(), { usage: null, model: null, sawMessageDelta: false, forwardedChars: 2 });
});

/** El cliente real de Supabase sobre un env de pruebas; la red la pone cada prueba con withFetch. */
function testSupabase() {
  return testServices(testEnv()).supabase;
}

test("includedAiPaused sólo deja pasar la fila que dice exactamente false", async () => {
  for (const [body, paused] of [[[{ value: false }], false], [[{ value: true }], true], [[{ value: "false" }], true], [[], true]]) {
    const network = fakeNetwork([{ match: matches.supabase("app_settings"), respond: { body } }]);
    await withFetch(network.fetch, async () => {
      assert.equal(await createGateway(testSupabase()).includedAiPaused(), paused, JSON.stringify(body));
    });
    assert.match(network.calls[0].url, /app_settings\?key=eq\.included_ai_paused&select=value$/);
  }
});

async function capturingErrors(run) {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args);
  try {
    return { result: await run(), lines };
  } finally {
    console.error = original;
  }
}

test("finishAiRequest reintenta dos veces y, si igual falla, deja una línea JSON pteron_usage_unrecorded sin contenido", async () => {
  let failures = 2;
  const network = fakeNetwork([
    { match: matches.rpc("finish_ai_request"), respond: () => (failures-- > 0 ? { status: 500, body: { message: "caída" } } : { body: [{ units_used: 10 }] }) },
  ]);
  const gateway = createGateway(testSupabase(), { finishRetryDelaysMs: [0, 0] });
  await withFetch(network.fetch, async () => {
    const { result, lines } = await capturingErrors(() => gateway.finishAiRequest("req-1", 42, { units: 42, status: "ok" }));
    assert.equal(result, true);
    assert.equal(lines.length, 0);
  });
  assert.equal(network.calls.length, 3, "dos fallas y un tercer intento que anota");
  assert.deepEqual(network.calls[2].body, { p_request_id: "req-1", p_units: 42, p_metadata: { units: 42, status: "ok" } });

  failures = 99;
  network.calls.length = 0;
  await withFetch(network.fetch, async () => {
    const { result, lines } = await capturingErrors(() => gateway.finishAiRequest("req-2", 7, { units: 7, status: "client_abort" }));
    assert.equal(result, false);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].length, 1, "una sola línea, sin objetos aparte");
    const logged = JSON.parse(lines[0][0]);
    assert.equal(logged.event, "pteron_usage_unrecorded");
    assert.equal(logged.ai_request, "req-2");
    assert.equal(logged.units, 7);
    assert.deepEqual(logged.metadata, { units: 7, status: "client_abort" });
  });
  assert.equal(network.calls.length, 3);
});

// ── La ruta /api/ai/v1/messages contra el contrato de errores ────────────────

const PROFE = "8a6e0804-2bd0-4672-b79d-d97027f9071a";
const BODY = { model: "pteron-managed", stream: true, max_tokens: 32_768, messages: [{ role: "user", content: "Una guía de fracciones." }] };

function setup(envOverrides = {}) {
  const pair = testKeyPair();
  const gatewayEnv = testEnv({
    LICENSE_PRIVATE_KEY_PEM: pair.privatePem,
    ANTHROPIC_API_KEY: "upstream-key",
    ANTHROPIC_BASE_URL: "https://upstream.test",
    GATEWAY_MODEL_ID: MODEL,
    ...envOverrides,
  });
  const services = testServices(gatewayEnv, { k1: pair.publicPem });
  services.gateway = createGateway(services.supabase, { finishRetryDelaysMs: [0, 0] });
  const license = (claims = {}) =>
    createLicenseService(gatewayEnv, null).signLicense({ subject: PROFE, plan: "basic", expiresAt: new Date(Date.now() + HOUR).toISOString(), ...claims });
  return { env: gatewayEnv, services, license };
}

function paidSubscription(overrides = {}) {
  return {
    id: "sus-1",
    plan_id: "basic",
    provider: "flow",
    status: "active",
    trial_starts_at: null,
    current_period_start: new Date(Date.now() - 5 * DAY).toISOString(),
    current_period_end: new Date(Date.now() + 25 * DAY).toISOString(),
    cancel_at_period_end: false,
    plan_catalog: BASIC_PLAN,
    ...overrides,
  };
}

function sseResponse(chunks, headers = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  // Entrega un chunk por lectura, como la red: así el corte del cliente llega antes del final.
  const body = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
      else controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "request-id": "req_123", ...headers } });
}

function providerError(status, error, headers = {}) {
  return Response.json({ type: "error", error, request_id: "req_err" }, { status, headers: { "request-id": "req_err", ...headers } });
}

const COMPLETE = [START + TEXT("Ho").slice(0, 25), TEXT("Ho").slice(25) + TEXT("la"), DELTA + STOP];

/** Supabase y Anthropic simulados: cada prueba cambia sólo la respuesta que le importa. */
function world(overrides = {}) {
  const routes = {
    subscriptions: { body: [paidSubscription()] },
    settings: { body: [{ value: false }] },
    begin: { body: [{ allowed: true, reason: "ok", units_used: 0, units_reserved: 1, units_limit: 6_000_000, period_end: null }] },
    finish: { body: [{ units_used: 1 }] },
    upstream: () => sseResponse(COMPLETE),
    ...overrides,
  };
  const pick = (value, call) => (typeof value === "function" ? value(call) : value);
  const network = fakeNetwork([
    { match: matches.supabase("subscriptions"), respond: (call) => pick(routes.subscriptions, call) },
    { match: matches.supabase("app_settings"), respond: (call) => pick(routes.settings, call) },
    { match: matches.rpc("begin_ai_request"), respond: (call) => pick(routes.begin, call) },
    { match: matches.rpc("finish_ai_request"), respond: (call) => pick(routes.finish, call) },
    { match: (url) => url === "https://upstream.test/v1/messages", respond: (call) => routes.upstream(call) },
  ]);
  const bodies = (fragment) => network.calls.filter((call) => call.url.includes(fragment)).map((call) => call.body);
  return {
    network,
    begins: () => bodies("rpc/begin_ai_request"),
    finishes: () => bodies("rpc/finish_ai_request"),
    upstreamCalls: () => network.calls.filter((call) => call.url.startsWith("https://upstream.test")),
  };
}

const offline = { network: { fetch: async (url) => { throw new Error(`no debe llamar a ${url}`); } } };

/** Una petición completa: responde, se lee como lo haría el cliente y se espera el waitUntil. */
async function send(ctx, where, { token, body = BODY, headers = {}, read = (res) => res.text() } = {}) {
  return withFetch(where.network.fetch, async () => {
    const execution = fakeExecution();
    const request = jsonRequest("https://pteron.test/api/ai/v1/messages", body, { headers: { ...(token ? { "x-api-key": token } : {}), "anthropic-version": "2023-06-01", ...headers } });
    const { result, lines } = await capturingErrors(async () => {
      const response = await messages({ request, env: ctx.env, execution, services: ctx.services });
      const content = await read(response);
      await execution.settle();
      return { response, content };
    });
    return { ...result, logs: lines };
  });
}

function errorBody({ content }) {
  return JSON.parse(content);
}

test("messages retransmite el stream byte a byte y cierra la reserva con las unidades y su desglose", async () => {
  const ctx = setup();
  const where = world();
  const { response, content } = await send(ctx, where, {
    token: await ctx.license(),
    headers: {
      "anthropic-beta": "fine-grained-tool-streaming-2025-05-14,mid-conversation-output-config-2026-07-01,thinking-binding-controls-2026-08-01",
      "x-pteron-version": "0.7.2",
      "x-pteron-platform": "darwin",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(response.headers.get("request-id"), "req_123");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(content, COMPLETE.join(""));

  const [upstream] = where.upstreamCalls();
  assert.equal(upstream.headers["x-api-key"], "upstream-key", "la clave real sólo la pone el Worker");
  assert.equal(upstream.headers["anthropic-version"], "2023-06-01");
  assert.equal(upstream.headers["anthropic-beta"], "mid-conversation-output-config-2026-07-01,thinking-binding-controls-2026-08-01");
  assert.equal(upstream.body.model, MODEL);
  assert.deepEqual(upstream.body.output_config, { effort: "low" });
  assert.deepEqual(upstream.body.metadata, { user_id: await opaqueUserId(ctx.env.LICENSE_PRIVATE_KEY_PEM.trim(), PROFE) });

  const [begin] = where.begins();
  const subscription = paidSubscription();
  assert.match(begin.p_request_id, /^[0-9a-f-]{36}$/);
  assert.equal(begin.p_user_id, PROFE);
  assert.equal(begin.p_plan_id, "basic");
  assert.equal(begin.p_limit, 6_000_000);
  assert.equal(Math.abs(Date.parse(begin.p_period_end) - Date.parse(subscription.current_period_end)) < 5000, true);
  assert.equal(begin.p_estimate, reservationEstimate(new TextEncoder().encode(JSON.stringify(BODY)).byteLength, 32_768));
  assert.equal(begin.p_max_in_flight, 3);

  assert.deepEqual(where.finishes(), [{
    p_request_id: begin.p_request_id,
    p_units: 7600,
    p_metadata: {
      route_model: MODEL,
      in: 1200,
      cw5m: 2000,
      cw1h: 0,
      cr: 9000,
      out: 600,
      searches: 0,
      long_context: false,
      units: 7600,
      status: "ok",
      client_version: "0.7.2",
      platform: "darwin",
      request_id: "req_123",
    },
  }]);
});

test("un stream que el cliente corta antes de message_delta anota la salida estimada por lo reenviado", async () => {
  const ctx = setup();
  const where = world({
    upstream: () => sseResponse([START + THINKING("pensando") + TEXT("Hola, ") + JSON_DELTA('{"titulo":'), TEXT('guía:\n\n"uno"'), TEXT("resto"), DELTA + STOP]),
  });
  const { logs } = await send(ctx, where, {
    token: await ctx.license(),
    read: async (res) => {
      const reader = res.body.getReader();
      await reader.read();
      await reader.cancel();
    },
  });
  // 6 + 10 + 12 caracteres reenviados: ceil(28 / 3 · 1,5) = 14 tokens de salida estimados.
  const [finish] = where.finishes();
  assert.equal(finish.p_metadata.status, "client_abort");
  assert.equal(finish.p_metadata.out, 14);
  assert.equal(finish.p_units, (20 * 1200 + 25 * 2000 + 2 * 9000 + 100 * 14) / 20);
  assert.ok(logs.some(([label]) => label === "pteron gateway streaming failed"));
});

test("un stream que el proveedor corta antes de message_delta también se estima", async () => {
  const ctx = setup();
  const where = world({ upstream: () => sseResponse([START + TEXT("Hola")]) });
  const { content } = await send(ctx, where, { token: await ctx.license() });
  assert.equal(content, START + TEXT("Hola"));
  const [finish] = where.finishes();
  assert.equal(finish.p_metadata.status, "client_abort");
  assert.equal(finish.p_metadata.out, 2);
  assert.equal(finish.p_units, (20 * 1200 + 25 * 2000 + 2 * 9000 + 100 * 2) / 20);
});

test("si el proveedor responde con error, la reserva se cierra con 0 unidades y el error pasa tal cual", async () => {
  const ctx = setup();
  const error = { type: "invalid_request_error", message: "messages: roles must alternate between \"user\" and \"assistant\"" };
  const where = world({ upstream: () => providerError(400, error) });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.status, 400);
  assert.deepEqual(errorBody(result), { type: "error", error, request_id: "req_err" });
  assert.equal(result.response.headers.get("request-id"), "req_err");
  const [finish] = where.finishes();
  assert.equal(finish.p_units, 0);
  assert.equal(finish.p_metadata.status, "provider_error");
  assert.equal(finish.p_metadata.units, 0);
  assert.equal(finish.p_metadata.request_id, "req_err");
});

test("429 y 529 del proveedor pasan tal cual, con retry-after y request-id", async () => {
  const ctx = setup();
  for (const [status, type, headers] of [[429, "rate_limit_error", { "retry-after": "7", "x-should-retry": "true" }], [529, "overloaded_error", {}]]) {
    const where = world({ upstream: () => providerError(status, { type, message: "espera" }, headers) });
    const result = await send(ctx, where, { token: await ctx.license() });
    assert.equal(result.response.status, status);
    assert.equal(errorBody(result).error.type, type);
    assert.equal(result.response.headers.get("request-id"), "req_err");
    if (headers["retry-after"]) {
      assert.equal(result.response.headers.get("retry-after"), "7");
      assert.equal(result.response.headers.get("x-should-retry"), "true");
    }
    assert.equal(where.finishes()[0].p_units, 0);
  }
});

test("los errores de la cuenta de pteron en Anthropic se traducen a 503 provider_paused y quedan en el log", async () => {
  const ctx = setup();
  const cases = [
    [401, { type: "authentication_error", message: "invalid x-api-key" }],
    [402, { type: "billing_error", message: "payment required" }],
    [403, { type: "permission_error", message: "not allowed" }],
    [404, { type: "not_found_error", message: `model: ${MODEL}` }],
    [400, { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." }],
    [400, { type: "invalid_request_error", message: "You have reached your specified API usage limits. You will regain access on 2026-11-01." }],
    [400, { type: "invalid_request_error", message: "You have reached your specified workspace API usage limits." }],
    [400, { type: "invalid_request_error", message: "The anthropic-workspace-id header is required." }],
    [429, { type: "rate_limit_error", message: "spend limit", details: { error_code: "enforced_spend_limit_reached" } }],
  ];
  for (const [status, error] of cases) {
    const where = world({ upstream: () => providerError(status, error) });
    const result = await send(ctx, where, { token: await ctx.license() });
    assert.equal(result.response.status, 503, `${status} ${error.message}`);
    assert.deepEqual(errorBody(result), {
      error: "included_ai_unavailable",
      message: "included_ai_unavailable: La IA incluida no está disponible ahora.",
      reason: "provider_paused",
    });
    assert.equal(result.response.headers.get("x-should-retry"), "false");
    assert.deepEqual(result.logs.find(([label]) => label === "pteron gateway account")?.[1], { status, type: error.type });
    assert.equal(where.finishes()[0].p_units, 0);
  }
});

test("sin red hacia Anthropic responde 503 provider_unreachable y libera la reserva", async () => {
  const ctx = setup();
  const where = world({ upstream: () => { throw new TypeError("fetch failed"); } });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.status, 503);
  assert.equal(errorBody(result).reason, "provider_unreachable");
  assert.equal(result.response.headers.get("x-should-retry"), null, "puede pasar sola: el SDK reintenta");
  assert.deepEqual([where.finishes()[0].p_units, where.finishes()[0].p_metadata.status], [0, "provider_unreachable"]);
});

test("licencia ausente, inválida o vencida: 401 con el código al comienzo del mensaje, sin tocar Supabase", async () => {
  const ctx = setup();
  const other = setup();
  const cases = [
    [undefined, "not_authenticated"],
    [await other.license(), "invalid_license"],
    [await ctx.license({ expiresAt: new Date(Date.now() - 1000).toISOString() }), "license_expired"],
  ];
  for (const [token, code] of cases) {
    const result = await send(ctx, offline, { token });
    assert.equal(result.response.status, 401, code);
    const payload = errorBody(result);
    assert.equal(payload.error, code);
    assert.match(payload.message, new RegExp(`^${code}: `));
  }
});

test("sin suscripción vigente la licencia ya no vale: 401 license_revoked antes de reservar", async () => {
  const ctx = setup();
  const token = await ctx.license();
  const ended = (days) => new Date(Date.now() - days * DAY).toISOString();
  const cases = [
    { body: [] },
    { body: [paidSubscription({ current_period_end: ended(4) })] },
    { body: [paidSubscription({ current_period_end: ended(0.5), cancel_at_period_end: true })] },
    { body: [paidSubscription({ provider: "comp", plan_id: "tester", current_period_end: ended(0.1) })] },
    { body: [paidSubscription({ plan_id: "free", plan_catalog: { ai_units_limit: null, trial_ai_units_limit: null, license_plan: null } })] },
  ];
  for (const subscriptions of cases) {
    const where = world({ subscriptions });
    const result = await send(ctx, where, { token });
    assert.equal(result.response.status, 401, JSON.stringify(subscriptions.body));
    assert.equal(errorBody(result).error, "license_revoked");
    assert.match(errorBody(result).message, /^license_revoked: /);
    assert.equal(where.begins().length, 0);
    assert.equal(where.upstreamCalls().length, 0);
  }
  const query = world().network;
  await send(ctx, { network: query }, { token });
  assert.match(query.calls[0].url, /subscriptions\?user_id=eq\.8a6e0804-2bd0-4672-b79d-d97027f9071a&status=in\.\(trialing,active,past_due\)&select=.*plan_catalog\(ai_units_limit,trial_ai_units_limit,license_plan\)/);

  const forged = await ctx.license({ subject: "no-es-un-uuid" });
  const result = await send(ctx, offline, { token: forged });
  assert.equal(errorBody(result).error, "license_revoked", "un sub que no es uuid no consulta la base");
});

test("en la gracia de Flow la IA sigue atendiendo con el mismo período", async () => {
  const ctx = setup();
  const subscription = paidSubscription({ current_period_end: new Date(Date.now() - DAY).toISOString() });
  const where = world({ subscriptions: { body: [subscription] } });
  const { response } = await send(ctx, where, { token: await ctx.license() });
  assert.equal(response.status, 200);
  assert.equal(where.begins()[0].p_period_start, subscription.current_period_start);
  assert.equal(where.begins()[0].p_period_end, subscription.current_period_end);
});

test("la prueba reserva contra la cuota de prueba y una cortesía tester contra la de su propio plan", async () => {
  const ctx = setup();
  const trial = paidSubscription({ status: "trialing", trial_starts_at: new Date(Date.now() - 2 * DAY).toISOString(), current_period_end: new Date(Date.now() + 5 * DAY).toISOString() });
  let where = world({ subscriptions: { body: [trial] } });
  await send(ctx, where, { token: await ctx.license() });
  assert.equal(where.begins()[0].p_limit, 1_500_000);
  assert.equal(where.begins()[0].p_period_start, trial.trial_starts_at);

  const comp = paidSubscription({ provider: "comp", plan_id: "tester", current_period_start: new Date(Date.now() - 40 * DAY).toISOString(), current_period_end: new Date(Date.now() + 300 * DAY).toISOString(), plan_catalog: { ai_units_limit: 6_000_000, trial_ai_units_limit: null, license_plan: "basic" } });
  where = world({ subscriptions: { body: [comp] } });
  await send(ctx, where, { token: await ctx.license({ plan: "basic" }) });
  const [begin] = where.begins();
  assert.equal(begin.p_plan_id, "tester", "cuenta el plan de la suscripción, no el de la licencia");
  assert.equal(begin.p_limit, 6_000_000);
  assert.equal(Date.parse(begin.p_period_start) > Date.parse(comp.current_period_start), true, "segundo mes de aniversario");
});

test("cuota agotada: 429 quota_exceeded con resets_at, used y limit, sin llamar al proveedor", async () => {
  const ctx = setup();
  const periodEnd = new Date(Date.now() + 10 * DAY).toISOString();
  const where = world({ begin: { body: [{ allowed: false, reason: "quota_exceeded", units_used: 6_000_120, units_reserved: 0, units_limit: 6_000_000, period_end: periodEnd }] } });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.status, 429);
  const payload = errorBody(result);
  assert.equal(payload.error, "quota_exceeded");
  assert.match(payload.message, /^quota_exceeded: /);
  assert.match(payload.message, /capacidad de IA incluida/, "0.7.1 reconoce la cuota por este texto");
  assert.equal(payload.message, "quota_exceeded: Se agotó la capacidad de IA incluida de este período. Se renueva con tu próximo cobro. Puedes seguir con el motor local o con tu propia clave.");
  assert.deepEqual([payload.resets_at, payload.used, payload.limit], [periodEnd, 6_000_120, 6_000_000]);
  const retryAfter = Number(result.response.headers.get("retry-after"));
  assert.ok(Math.abs(retryAfter - 10 * 86_400) <= 5, `retry-after en segundos: ${retryAfter}`);
  assert.equal(result.response.headers.get("x-should-retry"), "false", "el SDK no debe dormir días");
  assert.equal(where.upstreamCalls().length, 0);
  assert.equal(where.finishes().length, 0, "sin reserva no hay nada que cerrar");
});

test("con el período ya vencido (cobro sin sincronizar) el 429 pide volver en un minuto, no en 0 segundos", async () => {
  const ctx = setup();
  const where = world({ begin: { body: [{ allowed: false, reason: "quota_exceeded", units_used: 10, units_reserved: 0, units_limit: 10, period_end: new Date(Date.now() - HOUR).toISOString() }] } });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.headers.get("retry-after"), "60");
});

test("con 3 peticiones en vuelo: 429 concurrency_limited con retry-after 5", async () => {
  const ctx = setup();
  const where = world({ begin: { body: [{ allowed: false, reason: "concurrency_limited", units_used: 0, units_reserved: 3, units_limit: 6_000_000, period_end: null }] } });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.status, 429);
  assert.equal(errorBody(result).error, "concurrency_limited");
  assert.match(errorBody(result).message, /^concurrency_limited: /);
  assert.equal(result.response.headers.get("retry-after"), "5");
  assert.equal(where.upstreamCalls().length, 0);
});

test("GATEWAY_MAX_IN_FLIGHT cambia el máximo en vuelo; un valor inválido vuelve a 3", async () => {
  for (const [value, expected] of [["5", 5], ["0", 3], ["muchas", 3]]) {
    const ctx = setup({ GATEWAY_MAX_IN_FLIGHT: value });
    const where = world();
    await send(ctx, where, { token: await ctx.license() });
    assert.equal(where.begins()[0].p_max_in_flight, expected, value);
  }
});

test("con la IA pausada: 503 included_ai_unavailable con motivo paused", async () => {
  const ctx = setup();
  const where = world({ begin: { body: [{ allowed: false, reason: "paused", units_used: null, units_reserved: null, units_limit: null, period_end: null }] } });
  const result = await send(ctx, where, { token: await ctx.license() });
  assert.equal(result.response.status, 503);
  assert.deepEqual(errorBody(result), { error: "included_ai_unavailable", message: "included_ai_unavailable: La IA incluida no está disponible ahora.", reason: "paused" });
  assert.equal(result.response.headers.get("x-should-retry"), "false");
  assert.equal(where.upstreamCalls().length, 0);
});

test("si Supabase falla en la admisión: 503 accounting_unavailable, nunca otro código ni una llamada al proveedor", async () => {
  const ctx = setup();
  const cases = [
    { subscriptions: { status: 500, body: { message: "caída" } } },
    { subscriptions: { status: 401, body: { message: "Invalid API key" } } },
    { begin: { status: 500, body: { message: "caída" } } },
    { begin: { status: 403, body: { message: "permission denied" } } },
    { begin: { body: [] } },
    { begin: { body: [{ allowed: true, reason: "otra cosa" }] } },
  ];
  for (const overrides of cases) {
    const where = world(overrides);
    const result = await send(ctx, where, { token: await ctx.license() });
    assert.equal(result.response.status, 503, JSON.stringify(overrides));
    assert.equal(errorBody(result).reason, "accounting_unavailable");
    assert.equal(where.upstreamCalls().length, 0);
    assert.equal(where.finishes().length, 0);
  }
});

test("sin configuración: 503 not_configured antes de leer la licencia, también con un modelo sin precio", async () => {
  const cases = [
    { ANTHROPIC_API_KEY: "" },
    { GATEWAY_MODEL_ID: "claude-otro" },
    { GATEWAY_MODEL_ID: "" },
    { LICENSE_PRIVATE_KEY_PEM: "" },
    // En producción la clave sólo viaja a Anthropic.
    { PUBLIC_SITE_URL: "https://pteron.patagua.dev", ANTHROPIC_BASE_URL: "https://upstream.test" },
  ];
  for (const overrides of cases) {
    const ctx = setup(overrides);
    const result = await send(ctx, offline, {});
    assert.equal(result.response.status, 503, JSON.stringify(overrides));
    assert.equal(errorBody(result).reason, "not_configured");
    assert.equal(result.response.headers.get("x-should-retry"), "false");
  }
  const production = setup({ PUBLIC_SITE_URL: "https://pteron.patagua.dev", ANTHROPIC_BASE_URL: "https://api.anthropic.com/" });
  const result = await send(production, offline, {});
  assert.equal(result.response.status, 401, "la URL oficial pasa la configuración");
});

test("cuerpo sobre 1.200.000 bytes: 413 prompt_too_long; cuerpo inválido: 400 request_not_allowed; ambos sin tocar Supabase", async () => {
  const ctx = setup();
  const token = await ctx.license();
  const big = await send(ctx, offline, { token, body: { ...BODY, messages: [{ role: "user", content: "x".repeat(1_200_000) }] } });
  assert.equal(big.response.status, 413);
  assert.equal(errorBody(big).error, "prompt_too_long");
  assert.match(errorBody(big).message, /^prompt_too_long: /);
  for (const body of [{ ...BODY, messages: [] }, { ...BODY, max_tokens: "mucho" }, ["no", "es", "un", "objeto"]]) {
    const invalid = await send(ctx, offline, { token, body });
    assert.equal(invalid.response.status, 400, JSON.stringify(body));
    assert.equal(errorBody(invalid).error, "request_not_allowed");
  }
});

test("models exige configuración y licencia, y respeta la pausa para que la salud de la app diga la verdad", async () => {
  const ctx = setup();
  const token = await ctx.license();
  const request = (auth) => new Request("https://pteron.test/api/ai/v1/models", { headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  const run = (where, auth, context = ctx) => withFetch(where.network.fetch, () => capturingErrors(() => models({ request: request(auth), env: context.env, services: context.services })));

  const unconfigured = await run(offline, token, setup({ ANTHROPIC_API_KEY: "" }));
  assert.equal(unconfigured.result.status, 503);
  assert.equal((await unconfigured.result.json()).reason, "not_configured");
  const noLicense = await run(offline, null);
  assert.equal(noLicense.result.status, 401);
  assert.equal((await noLicense.result.json()).error, "not_authenticated");

  for (const [settings, reason] of [[{ body: [{ value: true }] }, "paused"], [{ body: [] }, "paused"], [{ status: 500, body: { message: "caída" } }, "accounting_unavailable"]]) {
    const { result } = await run(world({ settings }), token);
    assert.equal(result.status, 503);
    assert.equal((await result.json()).reason, reason);
  }

  const ok = await run(world(), token);
  assert.equal(ok.result.status, 200);
  assert.deepEqual(await ok.result.json(), { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
});

test("chat/completions, el puente de 0.6.0, responde 410 gone sin mirar licencia ni configuración", async () => {
  const response = await chatCompletions({ request: new Request("https://pteron.test/api/ai/v1/chat/completions", { method: "POST" }) });
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: "gone", message: "gone: Actualiza pteron para usar la IA incluida." });
});
