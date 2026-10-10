import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify as nodeVerify } from "node:crypto";
import { createLicenseService, normalizePem, verifyLicense } from "../src/lib/license.js";
import { testKeyPair } from "./helpers/fakes.js";

// Par de pruebas, nunca la clave real: verifyLicense acepta un mapa de claves
// propio para no depender de PUBLIC_KEYS ni de variables reales.
const keys = testKeyPair();
const testKeys = { k1: keys.publicPem };
const env = { LICENSE_PRIVATE_KEY_PEM: keys.privatePem, LICENSE_KID: "k1" };

function firmar(overrides = {}, customEnv = env) {
  return createLicenseService(customEnv, null).signLicense({
    subject: "sub-opaco-1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    ...overrides,
  });
}

test("signLicense + verifyLicense: mismo contrato de bytes que el cliente", async () => {
  const token = await firmar({ plan: "pro" });
  const verificado = await verifyLicense(token, testKeys);
  assert.equal(verificado?.sub, "sub-opaco-1");
  assert.equal(verificado?.plan, "pro");
  assert.equal(verificado?.kid, "k1");
});

test("la firma Web Crypto la verifica node:crypto, que es lo que usa la aplicación de escritorio", async () => {
  const token = await firmar({ plan: "basic" });
  const [segmento, firma] = token.split(".");
  const ok = nodeVerify(null, Buffer.from(segmento, "utf8"), createPublicKey(keys.publicPem), Buffer.from(firma, "base64url"));
  assert.equal(ok, true);
  const payload = JSON.parse(Buffer.from(segmento, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload), ["v", "sub", "plan", "iat", "exp", "kid"]);
});

test("verifyLicense distingue básico de pro", async () => {
  assert.equal((await verifyLicense(await firmar({ plan: "basic" }), testKeys))?.plan, "basic");
  assert.equal((await verifyLicense(await firmar({ plan: "pro" }), testKeys))?.plan, "pro");
});

test("verifyLicense renueva incluso si el token ya venció: decide la suscripción, no el reloj del token", async () => {
  const vencido = await firmar({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal((await verifyLicense(vencido, testKeys))?.sub, "sub-opaco-1");
});

test("verifyLicense rechaza una licencia alterada en un solo byte", async () => {
  const token = await firmar({ plan: "basic" });
  const [segmento, firma] = token.split(".");
  const alterado = Buffer.from(segmento, "base64url").toString("utf8").replace('"basic"', '"pro"');
  const falsificado = `${Buffer.from(alterado, "utf8").toString("base64url")}.${firma}`;
  assert.equal(await verifyLicense(falsificado, testKeys), null);
});

test("verifyLicense rechaza una licencia firmada por otra clave", async () => {
  const otra = testKeyPair();
  const token = await firmar({ subject: "sub-opaco-2" }, { LICENSE_PRIVATE_KEY_PEM: otra.privatePem, LICENSE_KID: "k1" });
  assert.equal(await verifyLicense(token, testKeys), null);
});

test("verifyLicense rechaza un kid que el servidor no reconoce, también los heredados del prototipo", async () => {
  assert.equal(await verifyLicense(await firmar(), {}), null);
  const token = await firmar({}, { LICENSE_PRIVATE_KEY_PEM: keys.privatePem, LICENSE_KID: "constructor" });
  assert.equal(await verifyLicense(token, testKeys), null);
});

test("verifyLicense rechaza formatos que no son una licencia, sin lanzar", async () => {
  for (const valor of ["", "   ", "sin-punto", "a.b.c", "!!!.***", undefined, null, 42]) {
    assert.equal(await verifyLicense(valor, testKeys), null);
  }
});

test("verifyLicense rechaza una versión que no entiende", async () => {
  const payload = {
    v: 2,
    sub: "sub-opaco-3",
    plan: "pro",
    iat: new Date().toISOString(),
    exp: new Date(Date.now() + 1000).toISOString(),
    kid: "k1",
  };
  const segmento = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  assert.equal(await verifyLicense(`${segmento}.firma-cualquiera`, testKeys), null);
});

test("signLicense acepta un PEM aplastado o con saltos literales, como llega desde un panel", async () => {
  const unaLinea = keys.privatePem.replace(/\n/g, "");
  const literales = keys.privatePem.replace(/\n/g, "\\n");
  for (const pem of [unaLinea, literales]) {
    const token = await firmar({}, { LICENSE_PRIVATE_KEY_PEM: pem, LICENSE_KID: "k1" });
    assert.equal((await verifyLicense(token, testKeys))?.sub, "sub-opaco-1");
  }
  assert.match(normalizePem(unaLinea), /^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n$/);
});

test("sin clave configurada o con una clave inválida responde 503 con un código distinto", async () => {
  await assert.rejects(firmar({}, { LICENSE_KID: "k1" }), { status: 503, code: "license_not_configured" });
  await assert.rejects(firmar({}, { LICENSE_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n" }), { status: 503, code: "license_key_invalid" });
});
