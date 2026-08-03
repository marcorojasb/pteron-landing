const { createHash } = require("node:crypto");
const { body, handler, HttpError, json, method, requireString } = require("../_lib/http");
const { issueLicense } = require("../_lib/license");
const { select, update } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const input = await body(req);
  const code = requireString(input.code, "code", 200);
  const codeHash = createHash("sha256").update(code).digest("hex");
  const rows = await select(
    "activation_intents",
    `code_hash=eq.${encodeURIComponent(codeHash)}&status=eq.pending&user_id=not.is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,expires_at&limit=1`,
    { admin: true },
  );
  const intent = rows?.[0];
  if (!intent?.user_id) throw new HttpError(410, "activation_not_ready", "Autoriza primero este equipo desde tu cuenta web.");
  const license = await issueLicense(intent.user_id);
  const consumed = await update(
    "activation_intents",
    `id=eq.${encodeURIComponent(intent.id)}&status=eq.pending`,
    { status: "consumed", consumed_at: new Date().toISOString() },
    { admin: true },
  );
  if (!consumed.length) throw new HttpError(409, "activation_used", "Este enlace de activación ya fue usado.");
  json(res, 200, { ok: true, token: license.token, plan: license.plan, expiresAt: license.expiresAt, keyId: license.keyId });
});
