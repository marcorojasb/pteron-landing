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

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
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
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "La solicitud no tiene un formato válido.");
  }
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
  console.error("pteron api error", error instanceof Error ? error.message : error);
  return json(500, { error: "server_error", message: "No pudimos completar la solicitud." });
}
