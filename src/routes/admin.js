import { HttpError, body, json, method, requireAuth } from "../lib/http.js";

/**
 * Administración de cuentas y consumo. Sólo para los correos de ADMIN_EMAILS,
 * autenticados con la misma sesión de Supabase que usa /cuenta. Todas las
 * lecturas y escrituras van con la service role; nada de esto es público.
 */
const CURRENT = "in.(incomplete,trialing,active,past_due,paused)";
const ACTIVE_STATES = new Set(["trialing", "active", "past_due", "paused"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminEmails(env) {
  return String(env?.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin({ request, env, services }) {
  const emails = adminEmails(env);
  if (!emails.length) throw new HttpError(503, "admin_not_configured", "La administración todavía no está configurada.");
  const user = await services.supabase.authUser(requireAuth(request));
  const email = String(user.email || "").toLowerCase();
  if (!email || !emails.includes(email)) throw new HttpError(403, "forbidden", "Esta cuenta no administra pteron.");
  return user;
}

/** Mes calendario en UTC, igual que la cuota del gateway. */
export function monthRange(value, now = new Date()) {
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
    if (month < 0 || month > 11) throw new HttpError(400, "invalid_month", "El mes no es válido.");
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start: start.toISOString(), end: end.toISOString(), label: `${year}-${String(month + 1).padStart(2, "0")}` };
}

/** Usuarios de Supabase Auth con la service role, paginados; el catálogo es pequeño. */
async function listUsers(supabase) {
  const users = new Map();
  for (let page = 1; page <= 10; page++) {
    const data = await supabase.request(`/auth/v1/admin/users?page=${page}&per_page=200`, { admin: true, token: supabase.adminKey() });
    const batch = Array.isArray(data?.users) ? data.users : [];
    for (const user of batch) {
      if (user?.id) users.set(user.id, { id: user.id, email: user.email || null, created_at: user.created_at || null, last_sign_in_at: user.last_sign_in_at || null });
    }
    if (batch.length < 200) break;
  }
  return users;
}

async function getUser(supabase, id) {
  const user = await supabase.request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { admin: true, token: supabase.adminKey() });
  if (!user?.id) throw new HttpError(404, "not_found", "No existe esa cuenta.");
  return { id: user.id, email: user.email || null, created_at: user.created_at || null, last_sign_in_at: user.last_sign_in_at || null };
}

function latestBy(rows, key = "created_at") {
  return [...(rows || [])].sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")));
}

function requireId(value) {
  if (!UUID.test(String(value || ""))) throw new HttpError(404, "not_found", "No existe esa cuenta.");
  return value;
}

async function resumen({ services }) {
  const { supabase } = services;
  const period = monthRange();
  const [users, subscriptions, plans, usage, licenses] = await Promise.all([
    listUsers(supabase),
    supabase.select("subscriptions", `status=${CURRENT}&select=user_id,plan_id,provider,status`, { admin: true }),
    supabase.select("plan_catalog", "select=id,display_name,monthly_price_clp,ai_units_limit,active,listed", { admin: true }),
    supabase.select("usage_periods", `period_start=eq.${encodeURIComponent(period.start)}&select=user_id,ai_units_used`, { admin: true }),
    supabase.select("licenses", `status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`, { admin: true }),
  ]);
  const price = new Map((plans || []).map((plan) => [plan.id, Number(plan.monthly_price_clp) || 0]));
  let pagando = 0;
  let cortesias = 0;
  let enPrueba = 0;
  let clpMes = 0;
  for (const row of subscriptions || []) {
    if (!ACTIVE_STATES.has(row.status)) continue;
    if (row.provider === "comp") cortesias += 1;
    else {
      pagando += 1;
      if (row.status === "active") clpMes += price.get(row.plan_id) || 0;
    }
    if (row.status === "trialing") enPrueba += 1;
  }
  const tokensMes = (usage || []).reduce((total, row) => total + (Number(row.ai_units_used) || 0), 0);
  return json(200, {
    mes: period.label,
    cuentas: users.size,
    pagando,
    cortesias,
    en_prueba: enPrueba,
    clp_mes_recurrente: clpMes,
    tokens_mes: tokensMes,
    cuentas_con_uso: (usage || []).filter((row) => (Number(row.ai_units_used) || 0) > 0).length,
    licencias_vigentes: (licenses || []).length,
  });
}

async function cuentas({ url, services }) {
  const { supabase } = services;
  const period = monthRange();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const [users, subscriptions, licenses, usage] = await Promise.all([
    listUsers(supabase),
    supabase.select("subscriptions", `status=${CURRENT}&select=user_id,plan_id,provider,status,trial_ends_at,current_period_end,cancel_at_period_end`, { admin: true }),
    supabase.select("licenses", "select=user_id,plan_id,status,expires_at,key_id,issued_at&order=issued_at.desc", { admin: true }),
    supabase.select("usage_periods", `period_start=eq.${encodeURIComponent(period.start)}&select=user_id,ai_units_used,ai_units_limit`, { admin: true }),
  ]);
  const subscriptionBy = new Map((subscriptions || []).map((row) => [row.user_id, row]));
  const licenseBy = new Map();
  for (const row of licenses || []) if (!licenseBy.has(row.user_id)) licenseBy.set(row.user_id, row);
  const usageBy = new Map((usage || []).map((row) => [row.user_id, row]));
  const rows = [...users.values()]
    .filter((user) => !q || String(user.email || "").toLowerCase().includes(q))
    .map((user) => ({
      ...user,
      suscripcion: subscriptionBy.get(user.id) || null,
      licencia: licenseBy.get(user.id) || null,
      consumo_mes: usageBy.get(user.id) || null,
    }));
  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return json(200, { mes: period.label, total: rows.length, cuentas: rows.slice(0, 500) });
}

async function cuenta({ services }, id) {
  const { supabase } = services;
  const userId = encodeURIComponent(requireId(id));
  const [user, subscriptions, licenses, activations, periods, events, billing] = await Promise.all([
    getUser(supabase, id),
    supabase.select("subscriptions", `user_id=eq.${userId}&select=id,plan_id,provider,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at&order=created_at.desc`, { admin: true }),
    supabase.select("licenses", `user_id=eq.${userId}&select=id,plan_id,status,issued_at,expires_at,key_id&order=issued_at.desc`, { admin: true }),
    supabase.select("activation_intents", `user_id=eq.${userId}&select=id,app_instance_id,status,expires_at,consumed_at,created_at&order=created_at.desc&limit=10`, { admin: true }),
    supabase.select("usage_periods", `user_id=eq.${userId}&select=period_start,period_end,plan_id,ai_units_used,ai_units_limit&order=period_start.desc&limit=12`, { admin: true }),
    supabase.select("usage_events", `user_id=eq.${userId}&select=created_at,event_type,units,event_metadata&order=created_at.desc&limit=30`, { admin: true }),
    supabase.select("billing_events", `user_id=eq.${userId}&select=created_at,event_type,status,event_metadata&order=created_at.desc&limit=20`, { admin: true }),
  ]);
  return json(200, { cuenta: user, suscripciones: subscriptions || [], licencias: licenses || [], activaciones: activations || [], consumo: periods || [], eventos: events || [], cobros: billing || [] });
}

/** Cortesía: igual que admin.dar_plan en la base, pero desde el Worker. */
async function darCortesia({ request, services }, id) {
  method(request, "POST");
  const { supabase } = services;
  const userId = requireId(id);
  const input = await body(request);
  const plan = String(input.plan || "tester").trim();
  const meses = Number(input.meses ?? 12);
  if (!Number.isInteger(meses) || meses < 1 || meses > 36) throw new HttpError(400, "invalid_input", "Los meses deben ser un entero entre 1 y 36.");
  const plans = await supabase.select("plan_catalog", `id=eq.${encodeURIComponent(plan)}&active=eq.true&select=id`, { admin: true });
  if (!plans?.length) throw new HttpError(400, "invalid_plan", "Ese plan no existe o está inactivo.");
  await getUser(supabase, userId);
  const now = new Date();
  await supabase.update("subscriptions", `user_id=eq.${encodeURIComponent(userId)}&status=${CURRENT}`, { status: "canceled", canceled_at: now.toISOString() }, { admin: true });
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + meses, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));
  const rows = await supabase.insert("subscriptions", {
    user_id: userId,
    plan_id: plan,
    provider: "comp",
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
  }, { admin: true });
  return json(200, { ok: true, suscripcion: rows[0] || null });
}

async function quitarCortesia({ request, services }, id) {
  method(request, "DELETE");
  const userId = requireId(id);
  const rows = await services.supabase.update(
    "subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}&provider=eq.comp&status=in.(trialing,active,past_due,paused)`,
    { status: "canceled", canceled_at: new Date().toISOString() },
    { admin: true },
  );
  return json(200, { ok: true, retiradas: rows.length });
}

async function consumo({ url, services }) {
  const { supabase } = services;
  const period = monthRange(url.searchParams.get("mes"));
  const [users, periods, events] = await Promise.all([
    listUsers(supabase),
    supabase.select("usage_periods", `period_start=eq.${encodeURIComponent(period.start)}&select=user_id,plan_id,ai_units_used,ai_units_limit&order=ai_units_used.desc`, { admin: true }),
    supabase.select("usage_events", `created_at=gte.${encodeURIComponent(period.start)}&created_at=lt.${encodeURIComponent(period.end)}&select=user_id,units,event_metadata&limit=5000`, { admin: true }),
  ]);
  const porModelo = new Map();
  const peticiones = new Map();
  for (const event of events || []) {
    const model = String(event.event_metadata?.route_model || "sin modelo");
    porModelo.set(model, (porModelo.get(model) || 0) + (Number(event.units) || 0));
    peticiones.set(event.user_id, (peticiones.get(event.user_id) || 0) + 1);
  }
  const cuentas = (periods || []).map((row) => ({
    user_id: row.user_id,
    correo: users.get(row.user_id)?.email || null,
    plan_id: row.plan_id,
    tokens: Number(row.ai_units_used) || 0,
    limite: row.ai_units_limit,
    peticiones: peticiones.get(row.user_id) || 0,
  }));
  return json(200, {
    mes: period.label,
    total_tokens: cuentas.reduce((sum, row) => sum + row.tokens, 0),
    total_peticiones: (events || []).length,
    modelos: [...porModelo.entries()].map(([modelo, tokens]) => ({ modelo, tokens })).sort((a, b) => b.tokens - a.tokens),
    cuentas,
  });
}

async function planes({ services }) {
  const rows = await services.supabase.select("plan_catalog", "select=id,display_name,monthly_price_clp,trial_period_days,ai_units_limit,license_plan,active,listed&order=monthly_price_clp.asc", { admin: true });
  return json(200, { planes: rows || [] });
}

async function actualizarPlan({ request, services }, id) {
  method(request, "PATCH");
  const planId = String(id || "").trim();
  if (!/^[a-z0-9_-]{1,40}$/.test(planId)) throw new HttpError(404, "not_found", "No existe ese plan.");
  const input = await body(request);
  const values = {};
  if ("ai_units_limit" in input) {
    const limit = input.ai_units_limit;
    if (limit !== null && (!Number.isInteger(limit) || limit < 0)) throw new HttpError(400, "invalid_input", "El límite debe ser un entero positivo o nulo.");
    values.ai_units_limit = limit;
  }
  if ("listed" in input) values.listed = Boolean(input.listed);
  if (!Object.keys(values).length) throw new HttpError(400, "invalid_input", "No hay nada que actualizar.");
  values.updated_at = new Date().toISOString();
  const rows = await services.supabase.update("plan_catalog", `id=eq.${encodeURIComponent(planId)}`, values, { admin: true });
  if (!rows.length) throw new HttpError(404, "not_found", "No existe ese plan.");
  return json(200, { ok: true, plan: rows[0] });
}

/** Enruta /api/admin/<resto>. Toda ruta exige administrador antes de leer nada. */
export async function admin(ctx, rest) {
  await requireAdmin(ctx);
  const { request } = ctx;
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "resumen" && request.method === "GET") return resumen(ctx);
  if (parts.length === 1 && parts[0] === "cuentas" && request.method === "GET") return cuentas(ctx);
  if (parts.length === 2 && parts[0] === "cuentas" && request.method === "GET") return cuenta(ctx, parts[1]);
  if (parts.length === 3 && parts[0] === "cuentas" && parts[2] === "cortesia") {
    if (request.method === "POST") return darCortesia(ctx, parts[1]);
    if (request.method === "DELETE") return quitarCortesia(ctx, parts[1]);
    throw new HttpError(405, "method_not_allowed", "Método no permitido.");
  }
  if (parts.length === 1 && parts[0] === "consumo" && request.method === "GET") return consumo(ctx);
  if (parts.length === 1 && parts[0] === "planes" && request.method === "GET") return planes(ctx);
  if (parts.length === 2 && parts[0] === "planes") return actualizarPlan(ctx, parts[1]);
  throw new HttpError(404, "not_found", "Ruta no encontrada.");
}
