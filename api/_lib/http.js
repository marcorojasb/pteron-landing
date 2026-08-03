const { URL } = require("node:url");

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function redirect(res, location, status = 303) {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function method(req, expected) {
  if (req.method !== expected) {
    throw new HttpError(405, "method_not_allowed", `Método no permitido. Usa ${expected}.`);
  }
}

function bearerToken(req) {
  const header = req.headers?.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || "";
}

function requestUrl(req) {
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  const host = req.headers?.host || "localhost";
  return new URL(req.url || "/", `${proto}://${host}`);
}

function siteUrl(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return requestUrl(req).origin;
}

async function body(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return parseBody(req.body, req.headers?.["content-type"]);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 65536) throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
  }
  return parseBody(raw, req.headers?.["content-type"]);
}

function parseBody(raw, contentType = "") {
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

function requireString(value, field, maxLength = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, "invalid_input", `El campo ${field} no es válido.`);
  }
  return value.trim();
}

function requireEmail(value) {
  const email = requireString(value, "email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "invalid_email", "Escribe un correo válido.");
  }
  return email;
}

function requireAuth(req) {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "not_authenticated", "Inicia sesión para continuar.");
  return token;
}

function handleError(res, error) {
  if (error instanceof HttpError) {
    json(res, error.status, { error: error.code, message: error.message });
    return;
  }
  console.error("pteron api error", error instanceof Error ? error.message : error);
  json(res, 500, { error: "server_error", message: "No pudimos completar la solicitud." });
}

function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };
}

module.exports = {
  HttpError,
  body,
  bearerToken,
  handler,
  json,
  method,
  redirect,
  requestUrl,
  requireAuth,
  requireEmail,
  requireString,
  siteUrl,
};
