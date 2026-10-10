import { HttpError, body, json, method, requireAuth, requireEmail, requireString, siteUrl } from "../lib/http.js";

// Acciones detrás de /api/auth/{request-magic-link,me,refresh}. Las URLs
// externas son las mismas que usaban las funciones de Vercel.

async function requestMagicLink({ request, env, services }) {
  method(request, "POST");
  const input = await body(request);
  const email = requireEmail(input.email);
  // El destino de retorno va como parámetro de consulta: `options.email_redirect_to`
  // es la firma de los SDK, no la de la API REST, y GoTrue descarta el campo sin
  // avisar. Sin barra final porque drop-trailing-slash haría que /cuenta/
  // respondiera 308, y el enlace trae los tokens en el fragmento.
  const redirectTo = `${siteUrl(env, request)}/cuenta`;
  await services.supabase.request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: { email, create_user: true },
  });
  return json(200, { ok: true, message: "Si el correo puede recibir el enlace, lo enviaremos ahora." });
}

async function me({ request, services }) {
  method(request, "GET");
  const user = await services.supabase.authUser(requireAuth(request));
  return json(200, { user: { id: user.id, email: user.email || null, createdAt: user.created_at || null } });
}

async function refresh({ request, services }) {
  method(request, "POST");
  const input = await body(request);
  const refreshToken = requireString(input.refresh_token, "refresh_token", 1000);
  const result = await services.supabase.request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  if (!result?.access_token || !result?.refresh_token) throw new HttpError(502, "auth_error", "No pudimos renovar la sesión.");
  return json(200, {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
    token_type: result.token_type,
  });
}

export const ACTIONS = { "request-magic-link": requestMagicLink, me, refresh };
