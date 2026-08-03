const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { signLicense, verifyLicense } = require("../api/_lib/license");

// Par de pruebas, nunca la clave real: verifyLicense acepta un mapa de claves
// propio para no depender de PUBLIC_KEYS ni de variables de entorno reales.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const testKeys = { k1: publicKey.export({ type: "spki", format: "pem" }).toString() };

function firmar(overrides = {}) {
  process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.LICENSE_KID = "k1";
  return signLicense({
    subject: "sub-opaco-1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    ...overrides,
  });
}

test("signLicense + verifyLicense: mismo contrato de bytes que el cliente", () => {
  const token = firmar({ plan: "pro" });
  const verificado = verifyLicense(token, testKeys);
  assert.equal(verificado?.sub, "sub-opaco-1");
  assert.equal(verificado?.plan, "pro");
  assert.equal(verificado?.kid, "k1");
});

test("verifyLicense distingue básico de pro", () => {
  assert.equal(verifyLicense(firmar({ plan: "basic" }), testKeys)?.plan, "basic");
  assert.equal(verifyLicense(firmar({ plan: "pro" }), testKeys)?.plan, "pro");
});

test("verifyLicense renueva incluso si el token ya venció: decide la suscripción, no el reloj del token", () => {
  const vencido = firmar({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(verifyLicense(vencido, testKeys)?.sub, "sub-opaco-1");
});

test("verifyLicense rechaza una licencia alterada en un solo byte", () => {
  const token = firmar({ plan: "basic" });
  const [segmento, firma] = token.split(".");
  const alterado = Buffer.from(segmento, "base64url").toString("utf8").replace('"basic"', '"pro"');
  const falsificado = `${Buffer.from(alterado, "utf8").toString("base64url")}.${firma}`;
  assert.equal(verifyLicense(falsificado, testKeys), null);
});

test("verifyLicense rechaza una licencia firmada por otra clave", () => {
  const otra = generateKeyPairSync("ed25519");
  process.env.LICENSE_PRIVATE_KEY_PEM = otra.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.LICENSE_KID = "k1";
  const token = signLicense({ subject: "sub-opaco-2", plan: "pro", expiresAt: new Date(Date.now() + 1000).toISOString() });
  assert.equal(verifyLicense(token, testKeys), null);
});

test("verifyLicense rechaza un kid que el servidor no reconoce", () => {
  const token = firmar();
  assert.equal(verifyLicense(token, {}), null);
});

test("verifyLicense rechaza formatos que no son una licencia, sin lanzar", () => {
  for (const valor of ["", "   ", "sin-punto", "a.b.c", undefined, null, 42]) {
    assert.equal(verifyLicense(valor, testKeys), null);
  }
});

test("verifyLicense rechaza una versión que no entiende", () => {
  // signLicense siempre firma v:1; para probar el rechazo hay que construir el
  // payload a mano — la firma nunca llega a comprobarse porque v se valida antes.
  const payload = {
    v: 2,
    sub: "sub-opaco-3",
    plan: "pro",
    iat: new Date().toISOString(),
    exp: new Date(Date.now() + 1000).toISOString(),
    kid: "k1",
  };
  const segmento = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  assert.equal(verifyLicense(`${segmento}.firma-cualquiera`, testKeys), null);
});
