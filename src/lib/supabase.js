import { HttpError } from "./http.js";

/**
 * Cliente mínimo de Supabase (Auth + PostgREST) sobre fetch. Recibe `env`
 * explícitamente: en Workers la configuración llega como bindings, no por
 * process.env, y pasarla hace a cada servicio verificable sin estado global.
 */
export function createSupabase(env) {
  function supabaseUrl() {
    const value = String(env?.SUPABASE_URL || "").trim().replace(/\/$/, "");
    if (!value) throw new HttpError(503, "supabase_not_configured", "La cuenta todavía no está configurada.");
    return value;
  }

  function publicKey() {
    const value = String(env?.SUPABASE_PUBLISHABLE_KEY || "").trim();
    if (!value) throw new HttpError(503, "supabase_not_configured", "La cuenta todavía no está configurada.");
    return value;
  }

  function adminKey() {
    const value = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!value) throw new HttpError(503, "server_not_configured", "El servidor todavía no está configurado.");
    return value;
  }

  async function request(path, options = {}) {
    const admin = Boolean(options.admin);
    const key = admin ? adminKey() : publicKey();
    const token = String(options.token || "").trim();
    const headers = {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      Accept: "application/json",
      ...(options.headers || {}),
    };
    let requestBody;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(options.body);
    }
    const response = await fetch(`${supabaseUrl()}${path}`, {
      method: options.method || (requestBody ? "POST" : "GET"),
      headers,
      body: requestBody,
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    if (!response.ok) {
      // Con la service role, un 401 o un 403 no es la sesión del profesor: es
      // la clave del servidor, vencida, revocada o de otro proyecto. Pasarlo
      // como 401 haría que la cuenta web le pidiera entrar de nuevo, en vano.
      if (admin && (response.status === 401 || response.status === 403)) {
        console.error("pteron supabase service role", { status: response.status });
        throw new HttpError(503, "server_misconfigured", "El servidor no está bien configurado. Inténtalo más tarde.");
      }
      const message = typeof data?.message === "string"
        ? data.message
        : typeof data?.msg === "string"
          ? data.msg
          : "El servicio de cuenta rechazó la solicitud.";
      throw new HttpError(response.status === 401 ? 401 : 502, response.status === 401 ? "not_authenticated" : "supabase_error", message);
    }
    return data;
  }

  async function authUser(token) {
    const user = await request("/auth/v1/user", { token });
    if (!user?.id) throw new HttpError(401, "not_authenticated", "La sesión ya no es válida.");
    return user;
  }

  function tablePath(table, query = "") {
    return `/rest/v1/${table}${query ? `?${query}` : ""}`;
  }

  async function select(table, query, options = {}) {
    return request(tablePath(table, query), { ...options, method: "GET" });
  }

  function rows(data) {
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async function insert(table, values, options = {}) {
    return rows(await request(tablePath(table), {
      ...options,
      method: "POST",
      body: values,
      headers: { Prefer: "return=representation", ...(options.headers || {}) },
    }));
  }

  async function update(table, query, values, options = {}) {
    return rows(await request(tablePath(table, query), {
      ...options,
      method: "PATCH",
      body: values,
      headers: { Prefer: "return=representation", ...(options.headers || {}) },
    }));
  }

  async function upsert(table, values, options = {}) {
    return rows(await request(tablePath(table, options.query || ""), {
      ...options,
      method: "POST",
      body: values,
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
        ...(options.headers || {}),
      },
    }));
  }

  return { adminKey, authUser, insert, request, select, supabaseUrl, update, upsert };
}
