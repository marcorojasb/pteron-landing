import { HttpError, body, json, method, requireAuth, requireString, siteUrl } from "../lib/http.js";
import { randomHex, sha256Hex } from "../lib/crypto.js";

// Acciones detrás de /api/activation/{start,exchange,complete}.

async function start({ request, env, services }) {
  method(request, "POST");
  const input = await body(request);
  const appInstanceId = requireString(input.appInstanceId, "appInstanceId", 200);
  if (!/^[a-zA-Z0-9._:-]+$/.test(appInstanceId)) {
    throw new HttpError(400, "invalid_input", "El identificador de instalación no es válido.");
  }
  const code = randomHex(32);
  const codeHash = await sha256Hex(code);
  // Una hora: quien activa por primera vez suele pasar por el registro de la
  // tarjeta en Flow antes de volver a la app.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await services.supabase.insert("activation_intents", {
    code_hash: codeHash,
    app_instance_id: appInstanceId,
    expires_at: expiresAt,
  }, { admin: true });
  const base = siteUrl(env, request);
  return json(200, {
    browserUrl: `${base}/cuenta?activate=${encodeURIComponent(code)}`,
    deepLink: `pteron://activate?code=${encodeURIComponent(code)}`,
    expiresAt,
  });
}

async function exchange({ request, services }) {
  method(request, "POST");
  const { supabase, license } = services;
  const input = await body(request);
  const code = requireString(input.code, "code", 200);
  const codeHash = await sha256Hex(code);
  const rows = await supabase.select(
    "activation_intents",
    `code_hash=eq.${encodeURIComponent(codeHash)}&status=eq.pending&user_id=not.is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,expires_at&limit=1`,
    { admin: true },
  );
  const intent = rows?.[0];
  if (!intent?.user_id) throw new HttpError(410, "activation_not_ready", "Autoriza primero este equipo desde tu cuenta web.");
  const issued = await license.issueLicense(intent.user_id, services);
  const consumed = await supabase.update(
    "activation_intents",
    `id=eq.${encodeURIComponent(intent.id)}&status=eq.pending`,
    { status: "consumed", consumed_at: new Date().toISOString() },
    { admin: true },
  );
  if (!consumed.length) throw new HttpError(409, "activation_used", "Este enlace de activación ya fue usado.");
  // Lo mismo que /api/license/renew: la licencia y el estado del plan.
  return json(200, { ok: true, ...issued });
}

async function complete({ request, services }) {
  method(request, "POST");
  const { supabase } = services;
  const token = requireAuth(request);
  const user = await supabase.authUser(token);
  const input = await body(request);
  const code = requireString(input.code, "code", 200);
  const codeHash = await sha256Hex(code);
  const rows = await supabase.select(
    "activation_intents",
    `code_hash=eq.${encodeURIComponent(codeHash)}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,expires_at&limit=1`,
    { admin: true },
  );
  const intent = rows?.[0];
  if (!intent) throw new HttpError(410, "activation_expired", "Este enlace de activación ya venció o fue usado.");
  if (intent.user_id && intent.user_id !== user.id) throw new HttpError(409, "activation_bound", "Este enlace ya pertenece a otra cuenta.");
  if (!intent.user_id) {
    const bound = await supabase.update(
      "activation_intents",
      `id=eq.${encodeURIComponent(intent.id)}&status=eq.pending&user_id=is.null`,
      { user_id: user.id },
      { admin: true },
    );
    if (!bound.length) throw new HttpError(409, "activation_bound", "Este enlace ya pertenece a otra cuenta.");
  }
  return json(200, {
    ok: true,
    deepLink: `pteron://activate?code=${encodeURIComponent(code)}`,
    expiresAt: intent.expires_at,
  });
}

export const ACTIONS = { start, exchange, complete };
