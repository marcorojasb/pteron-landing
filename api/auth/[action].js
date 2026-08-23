const { body, handler, HttpError, json, method, requireAuth, requireEmail, requireString, siteUrl } = require("../_lib/http");
const { authUser, request } = require("../_lib/supabase");

// Un solo archivo detrás de /api/auth/{request-magic-link,me,refresh} — mismo
// motivo que los otros [action].js: caber en el límite de funciones del plan
// Hobby sin cambiar ninguna URL externa.

async function requestMagicLink(req, res) {
  method(req, "POST");
  const input = await body(req);
  const email = requireEmail(input.email);
  // El destino de retorno va como parámetro de consulta: `options.email_redirect_to`
  // es la firma de los SDK, no la de la API REST, y GoTrue descarta el campo sin
  // avisar. Sin barra final porque `trailingSlash: false` haría que /cuenta/
  // respondiera 308, y el enlace trae los tokens en el fragmento.
  const redirectTo = `${siteUrl(req)}/cuenta`;
  await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: { email, create_user: true },
  });
  json(res, 200, { ok: true, message: "Si el correo puede recibir el enlace, lo enviaremos ahora." });
}

async function me(req, res) {
  method(req, "GET");
  const user = await authUser(requireAuth(req));
  json(res, 200, { user: { id: user.id, email: user.email || null, createdAt: user.created_at || null } });
}

async function refresh(req, res) {
  method(req, "POST");
  const input = await body(req);
  const refreshToken = requireString(input.refresh_token, "refresh_token", 1000);
  const result = await request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  if (!result?.access_token || !result?.refresh_token) throw new HttpError(502, "auth_error", "No pudimos renovar la sesión.");
  json(res, 200, {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
    token_type: result.token_type,
  });
}

const ACTIONS = { "request-magic-link": requestMagicLink, me, refresh };

module.exports = handler(async (req, res) => {
  const action = req.query?.action;
  const fn = typeof action === "string" ? ACTIONS[action] : undefined;
  if (!fn) throw new HttpError(404, "not_found", "Ruta no encontrada.");
  await fn(req, res);
});
