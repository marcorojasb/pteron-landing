const { HttpError } = require("./http");

function supabaseUrl() {
  const value = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (!value) throw new HttpError(503, "supabase_not_configured", "La cuenta todavía no está configurada.");
  return value;
}

function publicKey() {
  const value = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!value) throw new HttpError(503, "supabase_not_configured", "La cuenta todavía no está configurada.");
  return value;
}

function adminKey() {
  const value = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
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
  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${supabaseUrl()}${path}`, {
    method: options.method || (body ? "POST" : "GET"),
    headers,
    body,
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

async function insert(table, rows, options = {}) {
  const data = await request(tablePath(table), {
    ...options,
    method: "POST",
    body: rows,
    headers: { Prefer: "return=representation", ...(options.headers || {}) },
  });
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function update(table, query, values, options = {}) {
  const data = await request(tablePath(table, query), {
    ...options,
    method: "PATCH",
    body: values,
    headers: { Prefer: "return=representation", ...(options.headers || {}) },
  });
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function upsert(table, rows, options = {}) {
  const data = await request(tablePath(table, options.query || ""), {
    ...options,
    method: "POST",
    body: rows,
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(options.headers || {}),
    },
  });
  return Array.isArray(data) ? data : data ? [data] : [];
}

module.exports = {
  adminKey,
  authUser,
  insert,
  request,
  select,
  supabaseUrl,
  update,
  upsert,
};
