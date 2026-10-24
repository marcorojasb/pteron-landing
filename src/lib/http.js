/**
 * Ayudantes HTTP sobre la API Fetch estándar (Request/Response), que es lo que
 * ejecuta Cloudflare Workers. Sustituyen al par req/res de Node que usaban las
 * funciones de Vercel; el contrato público de la API (rutas, códigos y cuerpos
 * de error) no cambia.
 */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Las mismas cabeceras que public/_headers aplica a los assets; aquí para lo que genera el Worker. */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  ...SECURITY_HEADERS,
};

export function json(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function redirect(location, status = 303) {
  return new Response(null, { status, headers: { ...BASE_HEADERS, Location: location } });
}

export function method(request, expected) {
  if (request.method !== expected) {
    throw new HttpError(405, "method_not_allowed", `Método no permitido. Usa ${expected}.`);
  }
}

export function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || "";
}

export function requireAuth(request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "not_authenticated", "Inicia sesión para continuar.");
  return token;
}

/** Origen público del sitio: la variable configurada o, en su defecto, el origen de la petición. */
export function siteUrl(env, request) {
  const configured = String(env?.PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

// `wrangler dev` y la prueba de humo corren en el equipo, con el
// PUBLIC_SITE_URL de producción que trae wrangler.jsonc.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Guarda de host. El mismo Worker, con sus secretos, también responde en
 * *.workers.dev y en las URLs de cada versión: sin esto, una rama empujada
 * podría cobrar, firmar licencias o gastar IA con las claves de producción
 * desde una dirección que nadie revisa. Con PUBLIC_SITE_URL fijado, sólo ese
 * host (o el equipo local) pasa; un valor que no se puede leer no deja pasar
 * a nadie más.
 */
export function requireSiteHost(env, url) {
  const configured = String(env?.PUBLIC_SITE_URL || "").trim();
  if (!configured || LOCAL_HOSTS.has(url.hostname)) return;
  let expected = null;
  try {
    expected = new URL(configured).host;
  } catch {
    expected = null;
  }
  if (url.host !== expected) {
    throw new HttpError(421, "misdirected_request", "Esta dirección no atiende la cuenta, el cobro ni la IA incluida de pteron.");
  }
}

/**
 * Lee el cuerpo como texto con un tope de bytes. Corta la lectura en cuanto se
 * supera el límite en vez de acumular primero y comprobar después.
 */
export async function readText(request, maxBytes) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function body(request, maxBytes = 65536) {
  return parseBody(await readText(request, maxBytes), request.headers.get("content-type") || "");
}

export function parseBody(raw, contentType = "") {
  if (!raw.trim()) return {};
  if (String(contentType).toLowerCase().includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return parseJsonObject(raw);
}

/** Sólo un objeto JSON es un cuerpo válido: `null`, un número o una lista no lo son. */
export function parseJsonObject(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "La solicitud no tiene un formato válido.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "invalid_json", "La solicitud no tiene un formato válido.");
  }
  return parsed;
}

export function requireString(value, field, maxLength = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, "invalid_input", `El campo ${field} no es válido.`);
  }
  return value.trim();
}

export function requireEmail(value) {
  const email = requireString(value, "email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "invalid_email", "Escribe un correo válido.");
  }
  return email;
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return json(error.status, { error: error.code, message: error.message });
  }
  // La pila sólo trae lugares del código, y con upload_source_maps Workers Logs la lleva a la línea.
  console.error("pteron api error", error instanceof Error ? error.stack || error.message : error);
  return json(500, { error: "server_error", message: "No pudimos completar la solicitud." });
}
