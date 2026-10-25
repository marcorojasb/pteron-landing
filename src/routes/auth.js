import { HttpError, body, json, method, redirect, requireAuth, requireEmail, requireString, siteUrl } from "../lib/http.js";

// Acciones detrás de /api/auth/{request-magic-link,me,refresh,oauth,apple-callback,id-token}.
// Las URLs externas son las mismas que usaban las funciones de Vercel.

// Entrar con Google o Apple es OpenID Connect con id_token, sin secretos y sin
// pasar por el dominio de Supabase. /cuenta guarda un nonce y un state, y aquí
// sólo llega la huella del nonce (SHA-256 en hex), que el proveedor firma dentro
// del id_token. Google vuelve a /cuenta con el id_token en el fragmento; Apple lo
// envía por POST (form_post, obligatorio al pedir el correo) a
// /api/auth/apple-callback, que lo devuelve a /cuenta en el fragmento. Supabase
// acepta el id_token sólo junto al nonce del navegador que salió: un id_token
// ajeno no abre nada en otro navegador.
const OAUTH = {
  google: {
    name: "Google",
    clientVar: "GOOGLE_CLIENT_ID",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  },
  apple: {
    name: "Apple",
    clientVar: "APPLE_SERVICES_ID",
    authorize: "https://appleid.apple.com/auth/authorize",
  },
};
const NONCE_HASH = /^[a-f0-9]{64}$/;
// El nonce y el state que arma /cuenta: base64url de 16 a 96 bytes al azar
const RANDOM = /^[A-Za-z0-9_-]{22,128}$/;
const ID_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ID_TOKEN_MAX = 8192;
// Los errores que Apple devuelve por form_post (user_cancelled_authorize, invalid_request…)
const PROVIDER_ERROR = /^[a-z_]{1,64}$/;

function oauthProvider(value) {
  return typeof value === "string" && Object.hasOwn(OAUTH, value) ? value : "";
}

const failed = (provider) => `No pudimos completar la entrada con ${OAUTH[provider].name}. Vuelve a intentarlo o entra con tu correo.`;

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

/**
 * La dirección del proveedor para salir hacia Google o Apple. Un proveedor que
 * Supabase no tiene encendido (o sin su Client ID aquí) lo dice antes de salir
 * del sitio, y el profe sigue con su correo.
 */
async function oauth({ request, env, services }) {
  method(request, "POST");
  const input = await body(request);
  const provider = oauthProvider(input.provider);
  if (!provider) throw new HttpError(400, "invalid_provider", "Ese proveedor no está disponible.");
  if (typeof input.nonce_hash !== "string" || !NONCE_HASH.test(input.nonce_hash) || typeof input.state !== "string" || !RANDOM.test(input.state)) {
    throw new HttpError(400, "invalid_input", "La solicitud no tiene un formato válido.");
  }
  const unavailable = new HttpError(503, "provider_unavailable", `La entrada con ${OAUTH[provider].name} no está disponible ahora. Entra con tu correo.`);
  const clientId = String(env?.[OAUTH[provider].clientVar] || "").trim();
  if (!clientId) throw unavailable;
  let settings = null;
  try {
    settings = await services.supabase.request("/auth/v1/settings");
  } catch (error) {
    // Supabase caído o con la clave mal puesta: para el profe es lo mismo, hoy no se puede. Sin configurar sigue siendo 503.
    if (!(error instanceof HttpError) || error.status === 503) throw error;
  }
  if (settings?.external?.[provider] !== true) throw unavailable;
  const site = siteUrl(env, request);
  const url = new URL(OAUTH[provider].authorize);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("nonce", input.nonce_hash);
  url.searchParams.set("state", input.state);
  if (provider === "google") {
    // Sin barra final: drop-trailing-slash haría que /cuenta/ respondiera 308, y el fragmento se perdería
    url.searchParams.set("redirect_uri", `${site}/cuenta`);
    url.searchParams.set("response_type", "id_token");
    url.searchParams.set("scope", "openid email profile");
    // En el computador de la sala de profesores, Google pregunta con qué cuenta entrar en vez de usar la que esté abierta
    url.searchParams.set("prompt", "select_account");
  } else {
    url.searchParams.set("redirect_uri", `${site}/api/auth/apple-callback`);
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("scope", "name email");
  }
  return json(200, { url: url.toString() });
}

/**
 * La vuelta de Apple (un POST desde appleid.apple.com): el id_token y el state
 * vuelven a /cuenta en el fragmento, que no llega a ningún servidor. Aquí no se
 * abre ninguna sesión: sin el nonce de quien salió, el id_token no sirve.
 */
async function appleCallback({ request, env }) {
  method(request, "POST");
  const input = await body(request);
  const back = new URLSearchParams();
  const state = typeof input.state === "string" && RANDOM.test(input.state) ? input.state : "";
  const idToken = typeof input.id_token === "string" && input.id_token.length <= ID_TOKEN_MAX && ID_TOKEN.test(input.id_token) ? input.id_token : "";
  if (typeof input.error === "string" && input.error) {
    back.set("error", PROVIDER_ERROR.test(input.error) ? input.error : "server_error");
  } else if (idToken && state) {
    back.set("provider", "apple");
    back.set("id_token", idToken);
  } else {
    back.set("error", "invalid_request");
  }
  if (state) back.set("state", state);
  return redirect(`${siteUrl(env, request)}/cuenta#${back.toString()}`);
}

/** El id_token de Google o Apple, con el nonce de este navegador, por una sesión de Supabase. */
async function idToken({ request, services }) {
  method(request, "POST");
  const input = await body(request);
  const provider = oauthProvider(input.provider);
  if (!provider) throw new HttpError(400, "invalid_provider", "Ese proveedor no está disponible.");
  const valid = typeof input.id_token === "string" && input.id_token.length <= ID_TOKEN_MAX && ID_TOKEN.test(input.id_token)
    && typeof input.nonce === "string" && RANDOM.test(input.nonce);
  if (!valid) throw new HttpError(400, "invalid_input", failed(provider));
  let result;
  try {
    // Supabase revisa la firma del proveedor, que el id_token sea para nuestro Client ID, su vencimiento y que su
    // nonce sea el SHA-256 de éste
    result = await services.supabase.request("/auth/v1/token?grant_type=id_token", {
      method: "POST",
      body: { provider, id_token: input.id_token, nonce: input.nonce },
    });
  } catch (error) {
    // Vencido, de otro navegador o con el proveedor apagado: Supabase lo dice en inglés; el profe lo lee una vez y en
    // castellano. Sin configuración (503) sigue siendo eso.
    if (error instanceof HttpError && error.status !== 503) throw new HttpError(400, "invalid_grant", failed(provider));
    throw error;
  }
  if (!result?.access_token || !result?.refresh_token) throw new HttpError(502, "auth_error", failed(provider));
  return json(200, {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
    token_type: result.token_type,
  });
}

export const ACTIONS = { "request-magic-link": requestMagicLink, me, refresh, oauth, "apple-callback": appleCallback, "id-token": idToken };
