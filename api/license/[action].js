const { body, handler, HttpError, json, method, requireAuth, requireString } = require("../_lib/http");
const { issueLicense, verifyLicense } = require("../_lib/license");
const { authUser } = require("../_lib/supabase");

// Un solo archivo detrás de /api/license/{refresh,renew} — mismo motivo que
// los otros [action].js: caber en el límite de funciones del plan Hobby sin
// cambiar ninguna URL externa.
//
// refresh reemite a partir de una sesión de Supabase (la cuenta web);
// renew reemite a partir de la licencia firmada que ya tiene el escritorio,
// que nunca guarda esa sesión (ver el commit que agregó /license/renew).

async function refresh(req, res) {
  method(req, "POST");
  const user = await authUser(requireAuth(req));
  const license = await issueLicense(user.id);
  json(res, 200, { ok: true, token: license.token, plan: license.plan, expiresAt: license.expiresAt, keyId: license.keyId });
}

async function renew(req, res) {
  method(req, "POST");
  const input = await body(req);
  const token = requireString(input.token, "token", 4000);
  const verified = verifyLicense(token);
  if (!verified) throw new HttpError(401, "invalid_license", "La licencia no pudo verificarse.");
  const license = await issueLicense(verified.sub);
  json(res, 200, { ok: true, token: license.token, plan: license.plan, expiresAt: license.expiresAt, keyId: license.keyId });
}

const ACTIONS = { refresh, renew };

module.exports = handler(async (req, res) => {
  const action = req.query?.action;
  const fn = typeof action === "string" ? ACTIONS[action] : undefined;
  if (!fn) throw new HttpError(404, "not_found", "Ruta no encontrada.");
  await fn(req, res);
});
