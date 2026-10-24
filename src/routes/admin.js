import { HttpError, body, json, method, requireAuth, requireString } from "../lib/http.js";
import { enviarCorreosDePrueba, faltantesCorreo } from "../lib/correo.js";
import { faltaParaVender, salud } from "./health.js";

/**
 * Administración de cuentas y consumo. Sólo para los correos de ADMIN_EMAILS,
 * autenticados con la misma sesión de Supabase que usa /cuenta. Todas las
 * lecturas y escrituras van con la service role; nada de esto es público.
 */
const CURRENT = "in.(incomplete,trialing,active,past_due,paused)";
const ACTIVE_STATES = new Set(["trialing", "active", "past_due", "paused"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Las cuotas son `integer` en Postgres: un valor mayor lo rechaza la base con un error opaco.
const MAX_UNITS = 2_147_483_647;

function adminEmails(env) {
  return String(env?.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * El correo sólo prueba que la cuenta es de quien administra si Supabase lo
 * confirmó: sin email_confirmed_at, alguien con la clave publicable podría
 * registrar directo en Supabase un correo de la lista que aún no tiene cuenta.
 * Un correo sin confirmar recibe el mismo 403, sin revelar que está en la lista.
 */
export async function requireAdmin({ request, env, services }) {
  const emails = adminEmails(env);
  if (!emails.length) throw new HttpError(503, "admin_not_configured", "La administración todavía no está configurada.");
  const user = await services.supabase.authUser(requireAuth(request));
  const email = String(user.email || "").toLowerCase();
  if (!email || !emails.includes(email) || !user.email_confirmed_at) throw new HttpError(403, "forbidden", "Esta cuenta no administra pteron.");
  return user;
}

/**
 * Mes calendario en UTC. El consumo se agrupa por la fecha de cada petición,
 * no por el período de cuota de cada cuenta, que sigue a su cobro.
 */
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

function requireId(value) {
  if (!UUID.test(String(value || ""))) throw new HttpError(404, "not_found", "No existe esa cuenta.");
  return value;
}

/**
 * Consumo de IA agregado en la base (admin_usage_by_account y
 * admin_usage_by_model): traer las peticiones y sumarlas aquí se truncaba en
 * silencio a las 1.000 filas que entrega Supabase por consulta.
 */
async function usage(supabase, rpc, period) {
  const rows = await supabase.request(`/rest/v1/rpc/${rpc}`, { method: "POST", admin: true, body: { p_from: period.start, p_to: period.end } });
  return Array.isArray(rows) ? rows : [];
}

function total(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

/** Como lo lee begin_ai_request: la IA incluida queda pausada salvo que la fila diga exactamente false. */
function paused(rows) {
  return rows?.[0]?.value !== false;
}

async function resumen({ services }) {
  const { supabase } = services;
  const period = monthRange();
  const [users, subscriptions, plans, byAccount, byModel, licenses, settings] = await Promise.all([
    listUsers(supabase),
    supabase.select("subscriptions", `status=${CURRENT}&select=user_id,plan_id,provider,status`, { admin: true }),
    supabase.select("plan_catalog", "select=id,display_name,monthly_price_clp,for_sale&order=monthly_price_clp.asc", { admin: true }),
    usage(supabase, "admin_usage_by_account", period),
    usage(supabase, "admin_usage_by_model", period),
    supabase.select("licenses", `status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`, { admin: true }),
    supabase.select("app_settings", "key=eq.included_ai_paused&select=value", { admin: true }),
  ]);
  // Ingreso a precio de catálogo: quien contrató a otro precio no se distingue aquí.
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
  return json(200, {
    mes: period.label,
    cuentas: users.size,
    pagando,
    cortesias,
    en_prueba: enPrueba,
    clp_mes_recurrente: clpMes,
    unidades_mes: total(byModel, "units"),
    cuentas_con_uso: byAccount.filter((row) => (Number(row.units) || 0) > 0).length,
    licencias_vigentes: (licenses || []).length,
    a_la_venta: (plans || []).filter((plan) => plan.for_sale === true).map((plan) => plan.display_name || plan.id),
    ia_incluida_pausada: paused(settings),
  });
}

async function cuentas({ url, services }) {
  const { supabase } = services;
  const now = encodeURIComponent(new Date().toISOString());
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const [users, subscriptions, licenses, periods] = await Promise.all([
    listUsers(supabase),
    supabase.select("subscriptions", `status=${CURRENT}&select=user_id,plan_id,provider,status,trial_ends_at,current_period_end,cancel_at_period_end`, { admin: true }),
    supabase.select("licenses", "select=user_id,plan_id,status,expires_at,key_id,issued_at&order=issued_at.desc", { admin: true }),
    // El período de cuota que contiene ahora; cada cuenta tiene el suyo, que sigue a su cobro.
    supabase.select("usage_periods", `period_start=lte.${now}&period_end=gt.${now}&select=user_id,period_start,period_end,ai_units_used,ai_units_limit&order=period_start.desc`, { admin: true }),
  ]);
  const subscriptionBy = new Map((subscriptions || []).map((row) => [row.user_id, row]));
  const licenseBy = new Map();
  for (const row of licenses || []) if (!licenseBy.has(row.user_id)) licenseBy.set(row.user_id, row);
  const usageBy = new Map();
  for (const row of periods || []) if (!usageBy.has(row.user_id)) usageBy.set(row.user_id, row);
  const rows = [...users.values()]
    .filter((user) => !q || String(user.email || "").toLowerCase().includes(q))
    .map((user) => ({
      ...user,
      suscripcion: subscriptionBy.get(user.id) || null,
      licencia: licenseBy.get(user.id) || null,
      consumo_periodo: usageBy.get(user.id) || null,
    }));
  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return json(200, { total: rows.length, cuentas: rows.slice(0, 500) });
}

async function cuenta({ services }, id) {
  const { supabase } = services;
  const userId = encodeURIComponent(requireId(id));
  const [user, subscriptions, licenses, activations, periods, events, billing] = await Promise.all([
    getUser(supabase, id),
    supabase.select("subscriptions", `user_id=eq.${userId}&select=id,plan_id,provider,provider_subscription_id,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,next_invoice_at,morose,last_synced_at,created_at&order=created_at.desc`, { admin: true }),
    supabase.select("licenses", `user_id=eq.${userId}&select=id,plan_id,status,issued_at,expires_at,key_id&order=issued_at.desc`, { admin: true }),
    supabase.select("activation_intents", `user_id=eq.${userId}&select=id,app_instance_id,status,expires_at,consumed_at,created_at&order=created_at.desc&limit=10`, { admin: true }),
    supabase.select("usage_periods", `user_id=eq.${userId}&select=period_start,period_end,plan_id,ai_units_used,ai_units_limit&order=period_start.desc&limit=12`, { admin: true }),
    supabase.select("usage_events", `user_id=eq.${userId}&select=created_at,event_type,units,event_metadata&order=created_at.desc&limit=30`, { admin: true }),
    supabase.select("billing_events", `user_id=eq.${userId}&select=created_at,event_type,status,event_metadata&order=created_at.desc&limit=20`, { admin: true }),
  ]);
  return json(200, { cuenta: user, suscripciones: subscriptions || [], licencias: licenses || [], activaciones: activations || [], consumo: periods || [], eventos: events || [], cobros: billing || [] });
}

/**
 * Cortesía: un plan sin cobro que se da desde /admin. Sólo reemplaza a otra
 * cortesía. Si la cuenta paga en Flow se niega: cancelar sólo
 * la fila local dejaría a la persona pagando un plan que ya no tiene.
 */
async function darCortesia({ request, services }, id) {
  method(request, "POST");
  const { supabase } = services;
  const userId = requireId(id);
  const input = await body(request);
  const plan = String(input.plan || "tester").trim();
  const meses = Number(input.meses ?? 12);
  if (!Number.isInteger(meses) || meses < 1 || meses > 36) throw new HttpError(400, "invalid_input", "Los meses deben ser un entero entre 1 y 36.");
  const [plans, current] = await Promise.all([
    supabase.select("plan_catalog", `id=eq.${encodeURIComponent(plan)}&active=eq.true&select=id`, { admin: true }),
    supabase.select("subscriptions", `user_id=eq.${encodeURIComponent(userId)}&status=${CURRENT}&select=id,provider`, { admin: true }),
  ]);
  if (!plans?.length) throw new HttpError(400, "invalid_plan", "Ese plan no existe o está inactivo.");
  if ((current || []).some((row) => row.provider === "flow")) {
    throw new HttpError(409, "flow_subscription_active", "Esta cuenta paga un plan en Flow. Termínalo primero con «Terminar ahora»: una cortesía no detiene los cobros.");
  }
  await getUser(supabase, userId);
  const now = new Date();
  // Sólo cortesías: si entre medio apareció un plan de Flow, el índice de una
  // suscripción vigente por cuenta rechaza el insert en vez de pisarlo.
  await supabase.update("subscriptions", `user_id=eq.${encodeURIComponent(userId)}&provider=eq.comp&status=${CURRENT}`, { status: "canceled", canceled_at: now.toISOString() }, { admin: true });
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

/**
 * Revoca en el registro las licencias activas de una cuenta que ya no tiene
 * plan vigente. La firma ya emitida vale hasta su `exp`, pero sin plan el
 * gateway no la atiende y la renovación no la reemite.
 */
async function revokeLicenses(supabase, userId) {
  return supabase.update("licenses", `user_id=eq.${encodeURIComponent(userId)}&status=eq.active`, { status: "revoked" }, { admin: true });
}

async function quitarCortesia({ request, services }, id) {
  method(request, "DELETE");
  const { supabase } = services;
  const userId = requireId(id);
  const rows = await supabase.update(
    "subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}&provider=eq.comp&status=in.(trialing,active,past_due,paused)`,
    { status: "canceled", canceled_at: new Date().toISOString() },
    { admin: true },
  );
  // Se mira lo vigente después de cancelar, no las filas recién canceladas:
  // así un reintento también revoca, y nunca se toca la licencia de un plan pagado.
  const current = await supabase.select("subscriptions", `user_id=eq.${encodeURIComponent(userId)}&status=${CURRENT}&select=id&limit=1`, { admin: true });
  const revoked = current?.length ? [] : await revokeLicenses(supabase, userId);
  return json(200, { ok: true, retiradas: rows.length, licencias_revocadas: revoked.length });
}

/**
 * Cancela en Flow en el acto. Si Flow lo rechaza porque ya estaba cancelada
 * (el reintento de una cancelación que sí ocurrió), se sigue: lo que importa
 * es que deje de cobrar. Subscription.status 4 = cancelada.
 */
async function cancelInFlowNow(flow, subscriptionId) {
  try {
    await flow.cancelSubscription({ subscriptionId, atPeriodEnd: 0 });
  } catch (error) {
    const current = await flow.request("/subscription/get", { subscriptionId }, "GET").catch(() => null);
    if (current?.subscriptionId !== subscriptionId || Number(current?.status) !== 4) throw error;
  }
}

/**
 * «Terminar ahora», para un retracto, un reembolso o un contracargo: cancela
 * en Flow sin esperar el cierre del período (at_period_end 0), deja el motivo
 * en un evento de cobro, revoca las licencias y cierra la fila. La IA
 * incluida se corta de inmediato y la licencia ya no se renueva. No
 * reembolsa: eso se hace aparte, en Flow.
 */
async function terminarAhora({ request, services }, id, adminUser) {
  method(request, "POST");
  const { supabase, flow } = services;
  const userId = requireId(id);
  const input = await body(request);
  const reason = requireString(input.motivo, "motivo", 500);
  const [subscription] = (await supabase.select(
    "subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}&provider=eq.flow&status=${CURRENT}&select=id,plan_id,status,provider_subscription_id&order=created_at.desc&limit=1`,
    { admin: true },
  )) || [];
  if (!subscription) throw new HttpError(404, "subscription_missing", "Esta cuenta no tiene un plan pagado vigente.");
  // Una fila sin id de Flow no tiene nada que cancelar allá; la respuesta lo
  // dice, para revisar en el panel de Flow que no quede un cobro huérfano.
  const flowCanceled = Boolean(subscription.provider_subscription_id);
  if (flowCanceled) await cancelInFlowNow(flow, subscription.provider_subscription_id);
  const now = new Date().toISOString();
  // La fila se cierra al final: si algo falla antes, el reintento todavía la
  // encuentra vigente y rehace cada paso (el evento tiene un id por suscripción).
  await supabase.upsert("billing_events", {
    user_id: userId,
    external_event_id: `admin:terminate:${subscription.id}`,
    event_type: "subscription_terminated_by_admin",
    status: "processed",
    event_metadata: {
      reason,
      subscriptionId: subscription.id,
      providerSubscriptionId: subscription.provider_subscription_id || null,
      planId: subscription.plan_id,
      adminEmail: adminUser?.email || null,
    },
    processed_at: now,
  }, { admin: true, query: "on_conflict=external_event_id" });
  const revoked = await revokeLicenses(supabase, userId);
  const rows = await supabase.update("subscriptions", `id=eq.${encodeURIComponent(subscription.id)}&status=${CURRENT}`, { status: "canceled", canceled_at: now }, { admin: true });
  return json(200, { ok: true, flow_cancelada: flowCanceled, suscripcion: rows[0] || null, licencias_revocadas: revoked.length });
}

async function consumo({ url, services }) {
  const { supabase } = services;
  const period = monthRange(url.searchParams.get("mes"));
  const [users, subscriptions, byAccount, byModel] = await Promise.all([
    listUsers(supabase),
    supabase.select("subscriptions", `status=${CURRENT}&select=user_id,plan_id,provider`, { admin: true }),
    usage(supabase, "admin_usage_by_account", period),
    usage(supabase, "admin_usage_by_model", period),
  ]);
  const subscriptionBy = new Map((subscriptions || []).map((row) => [row.user_id, row]));
  return json(200, {
    mes: period.label,
    // Los totales salen de los modelos, que son pocas filas: la lista de cuentas podría cortarse.
    total_unidades: total(byModel, "units"),
    total_peticiones: total(byModel, "requests"),
    modelos: byModel.map((row) => ({ modelo: row.route_model || "sin modelo", peticiones: Number(row.requests) || 0, unidades: Number(row.units) || 0 })),
    cuentas: byAccount.map((row) => ({
      user_id: row.user_id,
      correo: users.get(row.user_id)?.email || null,
      plan_id: subscriptionBy.get(row.user_id)?.plan_id || null,
      cortesia: subscriptionBy.get(row.user_id)?.provider === "comp",
      peticiones: Number(row.requests) || 0,
      unidades: Number(row.units) || 0,
    })),
  });
}

async function planes({ services }) {
  const rows = await services.supabase.select("plan_catalog", "select=id,display_name,monthly_price_clp,trial_period_days,ai_units_limit,trial_ai_units_limit,license_plan,active,listed,for_sale&order=monthly_price_clp.asc", { admin: true });
  return json(200, { planes: rows || [] });
}

const NOT_READY = {
  activo: "estar activo",
  visible: "estar visible",
  precio: "tener precio",
  cuota: "tener cuota de IA",
  licencia: "emitir licencia",
};

function quotaValue(value, field) {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_UNITS)) {
    throw new HttpError(400, "invalid_input", `${field} debe ser un entero de 0 a ${MAX_UNITS} unidades, o nulo.`);
  }
  return value;
}

/**
 * Edita el catálogo. Una cuota nueva rige desde el período siguiente de cada
 * cuenta: el período en curso guarda la que tenía al abrirse (begin_ai_request),
 * así que bajarla nunca corta a nadie a mitad de un mes pagado. Abrir la venta
 * exige un plan completo, y un plan a la venta no puede quedar sin cuota.
 */
async function actualizarPlan({ request, services }, id) {
  method(request, "PATCH");
  const { supabase } = services;
  const planId = String(id || "").trim();
  if (!/^[a-z0-9_-]{1,40}$/.test(planId)) throw new HttpError(404, "not_found", "No existe ese plan.");
  const input = await body(request);
  const values = {};
  for (const field of ["ai_units_limit", "trial_ai_units_limit"]) {
    if (field in input) values[field] = quotaValue(input[field], field);
  }
  // Booleanos de verdad: Boolean("false") abriría la venta.
  for (const field of ["listed", "for_sale"]) {
    if (!(field in input)) continue;
    if (typeof input[field] !== "boolean") throw new HttpError(400, "invalid_input", `${field} debe ser true o false.`);
    values[field] = input[field];
  }
  if (!Object.keys(values).length) throw new HttpError(400, "invalid_input", "No hay nada que actualizar.");
  const [current] = (await supabase.select("plan_catalog", `id=eq.${encodeURIComponent(planId)}&select=id,active,listed,for_sale,monthly_price_clp,ai_units_limit,license_plan`, { admin: true })) || [];
  if (!current) throw new HttpError(404, "not_found", "No existe ese plan.");
  const next = { ...current, ...values };
  const missing = faltaParaVender(next);
  if (next.for_sale === true && missing.length) {
    const text = missing.map((code) => NOT_READY[code]).join(", ");
    throw new HttpError(409, "plan_not_ready", current.for_sale === true
      ? `${planId} está a la venta y debe ${text}. Para cambiarlo, cierra antes su venta.`
      : `Para abrir la venta, ${planId} debe ${text}.`);
  }
  values.updated_at = new Date().toISOString();
  const rows = await supabase.update("plan_catalog", `id=eq.${encodeURIComponent(planId)}`, values, { admin: true });
  if (!rows.length) throw new HttpError(404, "not_found", "No existe ese plan.");
  return json(200, { ok: true, plan: rows[0] });
}

/** Pausa o reanuda la IA incluida para todas las cuentas: el gateway responde 503 con motivo `paused`. */
async function actualizarAjustes({ request, services }) {
  method(request, "PATCH");
  const input = await body(request);
  if (typeof input.included_ai_paused !== "boolean") throw new HttpError(400, "invalid_input", "included_ai_paused debe ser true o false.");
  const rows = await services.supabase.upsert(
    "app_settings",
    { key: "included_ai_paused", value: input.included_ai_paused, updated_at: new Date().toISOString() },
    { admin: true, query: "on_conflict=key" },
  );
  return json(200, { ok: true, included_ai_paused: paused(rows) });
}

// Un clic accidental de más no manda seis correos: una prueba por administrador cada 60 segundos.
// El registro vive en la memoria del isolate, así que es un freno razonable, no una garantía.
const ESPERA_PRUEBA_MS = 60_000;
const ultimaPrueba = new Map();

/**
 * POST /api/admin/correo-prueba. Manda los tres correos al cliente, con datos de
 * ejemplo, al correo de quien administra (el de su sesión; el cuerpo se ignora) para
 * comprobar la clave de Resend y el remitente sin una compra. No escribe en la
 * base ni usa las cerraduras de los correos reales. Sin configuración completa
 * responde 409 con los nombres que faltan y no envía nada.
 */
async function correoPrueba({ request, env }, adminUser) {
  method(request, "POST");
  const destinatario = String(adminUser?.email || "").trim();
  const faltan = faltantesCorreo(env);
  if (faltan.length) {
    return json(409, { error: "email_not_configured", message: `Faltan ${faltan.join(", ")}: no se envió ningún correo.`, faltan });
  }
  const ahora = Date.now();
  for (const [correo, instante] of ultimaPrueba) if (ahora - instante >= ESPERA_PRUEBA_MS) ultimaPrueba.delete(correo);
  const llave = destinatario.toLowerCase();
  const desde = ultimaPrueba.get(llave);
  if (desde !== undefined) {
    const espera = Math.max(1, Math.ceil((ESPERA_PRUEBA_MS - (ahora - desde)) / 1000));
    return json(429, { error: "rate_limited", message: `Ya se enviaron correos de prueba hace un momento. Espera ${espera} segundos.`, retry_after_seconds: espera }, { "Retry-After": String(espera) });
  }
  ultimaPrueba.set(llave, ahora);
  const { resultados } = await enviarCorreosDePrueba(env, destinatario);
  return json(200, { ok: resultados.every((resultado) => resultado.estado === "enviado"), destinatario, resultados });
}

/** Enruta /api/admin/<resto>. Toda ruta exige administrador antes de leer nada. */
export async function admin(ctx, rest) {
  const adminUser = await requireAdmin(ctx);
  const { request } = ctx;
  const parts = rest.split("/").filter(Boolean);
  // /admin abre el panel sólo cuando esta ruta responde: que haya sesión no basta.
  if (parts.length === 1 && parts[0] === "sesion" && request.method === "GET") return json(200, { email: adminUser.email });
  if (parts.length === 1 && parts[0] === "resumen" && request.method === "GET") return resumen(ctx);
  if (parts.length === 1 && parts[0] === "salud" && request.method === "GET") return salud(ctx);
  if (parts.length === 1 && parts[0] === "ajustes") return actualizarAjustes(ctx);
  if (parts.length === 1 && parts[0] === "cuentas" && request.method === "GET") return cuentas(ctx);
  if (parts.length === 2 && parts[0] === "cuentas" && request.method === "GET") return cuenta(ctx, parts[1]);
  if (parts.length === 3 && parts[0] === "cuentas" && parts[2] === "cortesia") {
    if (request.method === "POST") return darCortesia(ctx, parts[1]);
    if (request.method === "DELETE") return quitarCortesia(ctx, parts[1]);
    throw new HttpError(405, "method_not_allowed", "Método no permitido.");
  }
  if (parts.length === 3 && parts[0] === "cuentas" && parts[2] === "terminar") return terminarAhora(ctx, parts[1], adminUser);
  if (parts.length === 1 && parts[0] === "correo-prueba") return correoPrueba(ctx, adminUser);
  if (parts.length === 1 && parts[0] === "consumo" && request.method === "GET") return consumo(ctx);
  if (parts.length === 1 && parts[0] === "planes" && request.method === "GET") return planes(ctx);
  if (parts.length === 2 && parts[0] === "planes") return actualizarPlan(ctx, parts[1]);
  throw new HttpError(404, "not_found", "Ruta no encontrada.");
}
