const { randomBytes, createHash } = require("node:crypto");
const { body, handler, HttpError, json, method, requireAuth, requireString, siteUrl } = require("../_lib/http");
const { issueLicense } = require("../_lib/license");
const { authUser, insert, select, update } = require("../_lib/supabase");

// Un solo archivo detrás de /api/activation/{start,exchange,complete} —
// mismo motivo que api/billing/[action].js: volver a caber en el límite de
// funciones del plan Hobby sin cambiar ninguna URL externa.

async function start(req, res) {
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
}

async function exchange(req, res) {
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
}

async function complete(req, res) {
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
}

const ACTIONS = { start, exchange, complete };

module.exports = handler(async (req, res) => {
  const action = req.query?.action;
  const fn = typeof action === "string" ? ACTIONS[action] : undefined;
  if (!fn) throw new HttpError(404, "not_found", "Ruta no encontrada.");
  await fn(req, res);
});
