const { handler, json, method, requireAuth } = require("../_lib/http");
const { authUser } = require("../_lib/supabase");
const { issueLicense } = require("../_lib/license");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const user = await authUser(requireAuth(req));
  const license = await issueLicense(user.id);
  json(res, 200, { ok: true, token: license.token, plan: license.plan, expiresAt: license.expiresAt, keyId: license.keyId });
});
