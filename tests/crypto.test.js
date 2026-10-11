import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { base64urlToBytes, base64urlToUtf8, bytesToBase64url, hmacSha256Hex, pemToDer, randomHex, sha256Hex, utf8ToBase64url } from "../src/lib/crypto.js";
import { createFlow } from "../src/lib/flow.js";
import { testKeyPair } from "./helpers/fakes.js";

const samples = ["", "hola", "código de activación", "日本語 🎓", "a".repeat(5000)];

test("sha256Hex coincide con node:crypto para ASCII y UTF-8", async () => {
  for (const sample of samples) {
    assert.equal(await sha256Hex(sample), createHash("sha256").update(sample, "utf8").digest("hex"));
  }
});

test("hmacSha256Hex coincide con node:crypto, también con secretos no ASCII", async () => {
  for (const secret of ["secreto", "clavé-ñ", "x".repeat(200)]) {
    for (const sample of samples) {
      assert.equal(await hmacSha256Hex(secret, sample), createHmac("sha256", secret).update(sample, "utf8").digest("hex"));
    }
  }
});

test("base64url va y vuelve igual que Buffer, sin relleno", () => {
  for (const sample of samples) {
    const encoded = utf8ToBase64url(sample);
    assert.equal(encoded, Buffer.from(sample, "utf8").toString("base64url"));
    assert.equal(base64urlToUtf8(encoded), sample);
  }
  const bytes = Uint8Array.from([0, 255, 254, 63, 62, 1]);
  assert.deepEqual(base64urlToBytes(bytesToBase64url(bytes)), bytes);
  assert.throws(() => base64urlToBytes("!!!"));
});

test("pemToDer exige la etiqueta correcta y devuelve el DER exacto", () => {
  const keys = testKeyPair();
  const der = pemToDer(keys.publicPem, "PUBLIC KEY");
  assert.deepEqual(Buffer.from(der), keys.publicKey.export({ type: "spki", format: "der" }));
  assert.throws(() => pemToDer(keys.publicPem, "PRIVATE KEY"), /PEM inválido/);
  assert.throws(() => pemToDer("no es pem", "PUBLIC KEY"), /PEM inválido/);
});

test("randomHex produce hex del largo pedido y no se repite", () => {
  const a = randomHex(32);
  const b = randomHex(32);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("la firma de Flow ordena los parámetros, excluye s y nulos, y es el HMAC de node:crypto", async () => {
  const flow = createFlow({ FLOW_API_KEY: "api", FLOW_SECRET_KEY: "secreto" });
  const params = { planId: "pteron-basic-monthly", amount: 2999, apiKey: "api", s: "ignorar", nulo: null, indefinido: undefined, currency: "CLP" };
  const canonical = "amount2999apiKeyapicurrencyCLPplanIdpteron-basic-monthly";
  assert.equal(await flow.signedParams(params, "secreto"), createHmac("sha256", "secreto").update(canonical).digest("hex"));
});
