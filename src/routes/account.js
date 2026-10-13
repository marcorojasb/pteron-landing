import { json, method, requireAuth } from "../lib/http.js";
import { TERMS_VERSION } from "../lib/terms.js";

function isoOrNull(value) {
  const instant = Date.parse(value ?? "");
  return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
}

/**
 * El período de cuota que se muestra en /cuenta: el que contiene ahora o, si
 * ninguno lo contiene, el más reciente. Durante la gracia del cobro el gateway
 * sigue contando en el período que ya terminó, y un período nuevo no tiene
 * fila hasta su primer uso de IA: por eso van las fechas, para que la página
 * diga de qué período habla. `rows` viene del más reciente al más antiguo.
 */
function currentUsage(rows, now = new Date()) {
  const periods = Array.isArray(rows) ? rows : [];
  const row = periods.find((period) => Date.parse(period.period_end) > now.getTime()) || periods[0];
  if (!row) return null;
  return {
    periodStart: isoOrNull(row.period_start),
    periodEnd: isoOrNull(row.period_end),
    unitsUsed: Number(row.ai_units_used) || 0,
    unitsLimit: row.ai_units_limit ?? null,
  };
}

/**
 * GET /api/account: perfil, catálogo de planes, suscripciones, licencias y uso
 * de IA del profesor autenticado. Todo se lee con su sesión: las políticas de
 * la base sólo le muestran lo suyo.
 */
export async function account({ request, services }) {
  method(request, "GET");
  const { supabase } = services;
  const token = requireAuth(request);
  const user = await supabase.authUser(token);
  const userId = encodeURIComponent(user.id);
  const now = new Date();
  const [profiles, plans, subscriptions, licenses, flowSubscriptions, periods] = await Promise.all([
    supabase.select("profiles", `id=eq.${userId}&select=display_name`, { token }),
    supabase.select("plan_catalog", "active=eq.true&select=id,display_name,monthly_price_clp,trial_period_days,ai_units_limit,trial_ai_units_limit,for_sale&order=monthly_price_clp.asc", { token }),
    supabase.select("subscriptions", `user_id=eq.${userId}&select=id,plan_id,provider,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,next_invoice_at,morose,payment_link,created_at&order=created_at.desc&limit=10`, { token }),
    supabase.select("licenses", `user_id=eq.${userId}&select=id,plan_id,status,issued_at,expires_at,key_id&order=created_at.desc&limit=10`, { token }),
    // La prueba es una por persona: sólo para quien nunca tuvo una suscripción Flow.
    supabase.select("subscriptions", `user_id=eq.${userId}&provider=eq.flow&select=id&limit=1`, { token }),
    supabase.select("usage_periods", `user_id=eq.${userId}&period_start=lte.${encodeURIComponent(now.toISOString())}&select=period_start,period_end,ai_units_used,ai_units_limit&order=period_start.desc&limit=5`, { token }),
  ]);
  return json(200, {
    user: { id: user.id, email: user.email || null, createdAt: user.created_at || null },
    profile: profiles?.[0] || { display_name: null },
    plans: plans || [],
    subscriptions: subscriptions || [],
    licenses: licenses || [],
    trialEligible: !flowSubscriptions?.length,
    termsVersion: TERMS_VERSION,
    usage: currentUsage(periods, now),
  });
}
