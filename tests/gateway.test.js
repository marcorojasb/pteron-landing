import { test } from "node:test";
import assert from "node:assert/strict";
import { createLicenseService } from "../src/lib/license.js";
import { authenticateGateway, createSseTracker, latestUsageAndModelFromSseChunk, totalTokensFromUsage } from "../src/lib/gateway.js";
import { testKeyPair } from "./helpers/fakes.js";

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

test("authenticateGateway exige un Authorization Bearer", async () => {
  await assert.rejects(authenticateGateway(reqWithToken(""), testKeys), { code: "not_authenticated" });
});

test("authenticateGateway rechaza una firma que no verifica", async () => {
  const otra = testKeyPair();
  const token = await firmar({ subject: "sub-x" }, { LICENSE_PRIVATE_KEY_PEM: otra.privatePem, LICENSE_KID: "k1" });
  await assert.rejects(authenticateGateway(reqWithToken(token), testKeys), { code: "invalid_license" });
});

test("authenticateGateway rechaza una licencia vencida — a diferencia de la renovación, acá sí importa", async () => {
  const vencida = await firmar({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  await assert.rejects(authenticateGateway(reqWithToken(vencida), testKeys), { code: "license_expired" });
});

test("authenticateGateway rechaza formato inválido sin lanzar un error distinto", async () => {
  await assert.rejects(authenticateGateway(reqWithToken("no-es-una-licencia"), testKeys), { code: "invalid_license" });
});

test("latestUsageAndModelFromSseChunk toma el usage y el modelo real del último evento con datos", () => {
  const chunk =
    'data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"hola"}}]}\n\n' +
    'data: {"model":"deepseek-v4-flash","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n' +
    "data: [DONE]\n\n";
  assert.deepEqual(latestUsageAndModelFromSseChunk(chunk), {
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    model: "deepseek-v4-flash",
  });
});

test("latestUsageAndModelFromSseChunk no lanza con un fragmento cortado a mitad de un chunk", () => {
  assert.deepEqual(latestUsageAndModelFromSseChunk('data: {"choices":[{"delta":{"conte'), { usage: null, model: null });
});

test("latestUsageAndModelFromSseChunk devuelve null sin ningún evento de usage", () => {
  assert.deepEqual(latestUsageAndModelFromSseChunk('data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"hola"}}]}\n\n'), {
    usage: null,
    model: "deepseek-v4-flash",
  });
});

test("createSseTracker recompone una línea data: partida entre dos chunks", () => {
  const tracker = createSseTracker();
  tracker.push('data: {"model":"deepseek-v4-flash","choices":[],"usage":{"prompt_tok');
  assert.deepEqual(tracker.current(), { usage: null, model: null });
  tracker.push('ens":10,"completion_tokens":5,"total_tokens":15}}\n\ndata: [DONE]');
  assert.deepEqual(tracker.flush(), {
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    model: "deepseek-v4-flash",
  });
});

test("createSseTracker procesa en flush una última línea sin salto final", () => {
  const tracker = createSseTracker();
  tracker.push('data: {"model":"m","usage":{"total_tokens":3}}');
  assert.deepEqual(tracker.current(), { usage: null, model: null });
  assert.deepEqual(tracker.flush(), { usage: { total_tokens: 3 }, model: "m" });
});

test("totalTokensFromUsage usa total_tokens cuando está presente", () => {
  assert.equal(totalTokensFromUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }), 15);
});

test("totalTokensFromUsage suma prompt+completion si falta total_tokens", () => {
  assert.equal(totalTokensFromUsage({ prompt_tokens: 10, completion_tokens: 5 }), 15);
});

test("totalTokensFromUsage devuelve 0 ante datos ausentes o inválidos", () => {
  assert.equal(totalTokensFromUsage(null), 0);
  assert.equal(totalTokensFromUsage({}), 0);
  assert.equal(totalTokensFromUsage("no-es-un-objeto"), 0);
});
