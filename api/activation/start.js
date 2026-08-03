const { randomBytes, createHash } = require("node:crypto");
const { body, handler, HttpError, json, method, requireString, siteUrl } = require("../_lib/http");
const { insert } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const input = await body(req);
  const appInstanceId = requireString(input.appInstanceId, "appInstanceId", 200);
  if (!/^[a-zA-Z0-9._:-]+$/.test(appInstanceId)) {
    throw new HttpError(400, "invalid_input", "El identificador de instalación no es válido.");
  }
  const code = randomBytes(32).toString("hex");
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await insert("activation_intents", {
    code_hash: codeHash,
    app_instance_id: appInstanceId,
    expires_at: expiresAt,
  }, { admin: true });
  const base = siteUrl(req);
  json(res, 200, {
    browserUrl: `${base}/cuenta/?activate=${encodeURIComponent(code)}`,
    deepLink: `pteron://activate?code=${encodeURIComponent(code)}`,
    expiresAt,
  });
});
