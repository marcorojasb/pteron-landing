const { body, handler, HttpError, json, method, requireString } = require("../_lib/http");
const { issueLicense, verifyLicense } = require("../_lib/license");

/**
 * Renueva a partir de la licencia firmada que la app ya tiene guardada, no de
 * una sesión: es el mismo modelo de confianza que ADR-054/055 ya definieron
 * para el gateway, y el único que la app de escritorio puede cumplir sin
 * guardar una sesión de Supabase (que hoy no adquiere en ningún punto).
 */
module.exports = handler(async (req, res) => {
  method(req, "POST");
  const input = await body(req);
  const token = requireString(input.token, "token", 4000);
  const verified = verifyLicense(token);
  if (!verified) throw new HttpError(401, "invalid_license", "La licencia no pudo verificarse.");
  const license = await issueLicense(verified.sub);
  json(res, 200, { ok: true, token: license.token, plan: license.plan, expiresAt: license.expiresAt, keyId: license.keyId });
});
