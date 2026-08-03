const { createHash } = require("node:crypto");
const { body, handler, HttpError, json, method, requireAuth, requireString } = require("../_lib/http");
const { authUser, select, update } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const token = requireAuth(req);
  const user = await authUser(token);
  const input = await body(req);
  const code = requireString(input.code, "code", 200);
  const codeHash = createHash("sha256").update(code).digest("hex");
  const rows = await select(
    "activation_intents",
    `code_hash=eq.${encodeURIComponent(codeHash)}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,expires_at&limit=1`,
    { admin: true },
  );
  const intent = rows?.[0];
  if (!intent) throw new HttpError(410, "activation_expired", "Este enlace de activación ya venció o fue usado.");
  if (intent.user_id && intent.user_id !== user.id) throw new HttpError(409, "activation_bound", "Este enlace ya pertenece a otra cuenta.");
  if (!intent.user_id) {
    const bound = await update(
      "activation_intents",
      `id=eq.${encodeURIComponent(intent.id)}&status=eq.pending&user_id=is.null`,
      { user_id: user.id },
      { admin: true },
    );
    if (!bound.length) throw new HttpError(409, "activation_bound", "Este enlace ya pertenece a otra cuenta.");
  }
  json(res, 200, {
    ok: true,
    deepLink: `pteron://activate?code=${encodeURIComponent(code)}`,
    expiresAt: intent.expires_at,
  });
});
