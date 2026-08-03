const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { signLicense } = require("../api/_lib/license");
const { authenticateGateway, latestUsageFromSseChunk, totalTokensFromUsage } = require("../api/_lib/gateway");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.LICENSE_KID = "k1";
const testKeys = { k1: publicKey.export({ type: "spki", format: "pem" }).toString() };

function reqWithToken(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : "" } };
}

function firmar(overrides = {}) {
  // Vuelve a fijar la clave en cada llamada: otro test de este archivo puede
  // haberla cambiado a propósito para probar un rechazo por firma.
  process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.LICENSE_KID = "k1";
  return signLicense({
    subject: "sub-opaco-1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  });
}

test("authenticateGateway acepta una licencia Basic o Pro vigente", () => {
  const verified = authenticateGateway(reqWithToken(firmar({ plan: "pro" })), testKeys);
  assert.equal(verified.sub, "sub-opaco-1");
  assert.equal(verified.plan, "pro");
});

test("authenticateGateway exige un Authorization Bearer", () => {
  assert.throws(() => authenticateGateway(reqWithToken(""), testKeys), { code: "not_authenticated" });
});

test("authenticateGateway rechaza una firma que no verifica", () => {
  const originalPem = process.env.LICENSE_PRIVATE_KEY_PEM;
  const otra = generateKeyPairSync("ed25519");
  process.env.LICENSE_PRIVATE_KEY_PEM = otra.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  try {
    const token = signLicense({ subject: "sub-x", plan: "pro", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    assert.throws(() => authenticateGateway(reqWithToken(token), testKeys), { code: "invalid_license" });
  } finally {
    // Los demás tests de este archivo firman con la clave original vía firmar().
    process.env.LICENSE_PRIVATE_KEY_PEM = originalPem;
  }
});

test("authenticateGateway rechaza una licencia vencida — a diferencia de la renovación, acá sí importa", () => {
  const vencida = firmar({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.throws(() => authenticateGateway(reqWithToken(vencida), testKeys), { code: "license_expired" });
});

test("authenticateGateway rechaza formato inválido sin lanzar un error distinto", () => {
  assert.throws(() => authenticateGateway(reqWithToken("no-es-una-licencia"), testKeys), { code: "invalid_license" });
});

test("latestUsageFromSseChunk toma el usage del último evento con datos", () => {
  const chunk =
    'data: {"choices":[{"delta":{"content":"hola"}}]}\n\n' +
    'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n' +
    "data: [DONE]\n\n";
  assert.deepEqual(latestUsageFromSseChunk(chunk), { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
});

test("latestUsageFromSseChunk no lanza con un fragmento cortado a mitad de un chunk", () => {
  assert.equal(latestUsageFromSseChunk('data: {"choices":[{"delta":{"conte'), null);
});

test("latestUsageFromSseChunk devuelve null sin ningún evento de usage", () => {
  assert.equal(latestUsageFromSseChunk('data: {"choices":[{"delta":{"content":"hola"}}]}\n\n'), null);
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
