import { json, method, requireAuth } from "../lib/http.js";

/** GET /api/account: perfil, catálogo de planes, suscripciones y licencias del profesor autenticado. */
export async function account({ request, services }) {
  method(request, "GET");
  const { supabase } = services;
  const token = requireAuth(request);
  const user = await supabase.authUser(token);
  const userId = encodeURIComponent(user.id);
  const [profiles, plans, subscriptions, licenses] = await Promise.all([
    supabase.select("profiles", `id=eq.${userId}&select=display_name`, { token }),
    supabase.select("plan_catalog", "active=eq.true&select=id,display_name,monthly_price_clp,trial_period_days,ai_units_limit&order=monthly_price_clp.asc", { token }),
    supabase.select("subscriptions", `user_id=eq.${userId}&select=id,plan_id,status,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at&order=created_at.desc&limit=10`, { token }),
    supabase.select("licenses", `user_id=eq.${userId}&select=id,plan_id,status,issued_at,expires_at,key_id&order=created_at.desc&limit=10`, { token }),
  ]);
  return json(200, {
    user: { id: user.id, email: user.email || null, createdAt: user.created_at || null },
    profile: profiles?.[0] || { display_name: null },
    plans: plans || [],
    subscriptions: subscriptions || [],
    licenses: licenses || [],
  });
}
