import { HttpError, body, json, method, redirect, requireAuth, requireString, siteUrl } from "../lib/http.js";
import { sha256Hex } from "../lib/crypto.js";
import { flowRejected } from "../lib/flow.js";
import { reconcilePendingCheckouts, recordBillingEvent, recordFlowSubscription, syncAfterPayment, syncFlowSubscription } from "../lib/flow-sync.js";
import { accesoHasta } from "../lib/license.js";
import { TERMS_VERSION } from "../lib/terms.js";

// Acciones detrás de /api/billing/{checkout,cancel,card-callback,flow-callback}.
// Flow y la cuenta web siguen llamando exactamente a esas URLs.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAN_ID = /^[a-z0-9_-]+$/;
const VIGENTES = ["incomplete", "trialing", "active", "past_due", "paused"];
// El intento dura lo que tarda alguien en buscar la tarjeta y aprobarla en la
// app del banco. Su id es un uuid y el token de Flow sirve una vez, así que
// alargarlo no abre nada.
const VIDA_CHECKOUT = 2 * 60 * 60 * 1000;
const INTENTO = "id,user_id,plan_id,provider_customer_id,provider_plan_id,status,expires_at,trial_days,terms_version";

function porId(id) {
  return `id=eq.${encodeURIComponent(id)}`;
}

/** La prueba se da una vez por persona: sólo a una cuenta que nunca tuvo una suscripción Flow. */
export async function trialEligible(supabase, userId) {
  const previas = await supabase.select("subscriptions", `user_id=eq.${encodeURIComponent(userId)}&provider=eq.flow&select=id&limit=1`, { admin: true });
  return !previas?.length;
}

/**
 * Niega la compra si la cuenta ya tiene un plan en curso. Una fila Flow que ya
 * no da acceso (canceló al cierre y se acabó lo pagado, o el cobro nunca
 * llegó) puede estar desactualizada: se consulta Flow antes de negar.
 */
async function rejectCurrentPlan(services, userId, now) {
  const rows = await services.supabase.select(
    "subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}&status=in.(${VIGENTES.join(",")})&select=id,plan_id,status,provider,provider_subscription_id,provider_plan_id,cancel_at_period_end,canceled_at,current_period_end&limit=1`,
    { admin: true },
  );
  let current = rows?.[0];
  if (!current) return;
  const acceso = accesoHasta(current);
  if (current.provider === "flow" && current.provider_subscription_id && (!acceso || acceso <= now)) {
    try {
      current = await syncFlowSubscription(services, current, now);
    } catch (error) {
      console.error("pteron checkout sync", { subscription: current.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (VIGENTES.includes(current.status)) {
    throw new HttpError(409, "subscription_exists", "Ya tienes un plan en curso. Puedes administrarlo desde tu cuenta.");
  }
}

/**
 * Un intento en subscription_pending pudo crear ya la suscripción en Flow: antes
 * de otra compra se concilia (los de más de 10 minutos), y si alguno sigue sin
 * resolverse se espera, porque otro checkout podría duplicar la suscripción y la prueba.
 */
async function rejectPendingCheckout(services, userId, now) {
  const pendientes = () => services.supabase.select(
    "billing_checkout_intents",
    `user_id=eq.${encodeURIComponent(userId)}&status=eq.subscription_pending&select=id&limit=1`,
    { admin: true },
  );
  if (!(await pendientes())?.length) return;
  await reconcilePendingCheckouts(services, { now, userId });
  if ((await pendientes())?.length) {
    throw new HttpError(409, "checkout_pending", "Tu compra anterior todavía se está confirmando con Flow. Vuelve a intentarlo en unos minutos.");
  }
}

/**
 * El primer campo en que el plan de Flow no cobra lo publicado (monto del
 * catálogo, en CLP, mensual, activo y avisando a este sitio), o null si calza.
 */
export function flowPlanMismatch(plan, catalogo, callbackUrl) {
  const esperado = { amount: catalogo.monthly_price_clp, currency: "CLP", interval: 3, interval_count: 1, status: 1, urlCallback: callbackUrl };
  for (const [campo, valor] of Object.entries(esperado)) {
    if (plan?.[campo] !== valor) return { campo, esperado: valor, flow: plan?.[campo] ?? null };
  }
  return null;
}

/**
 * El plan de Flow debe cobrar exactamente lo publicado. Si no existe se crea
 * con los valores del catálogo; exista o no, se lee de vuelta y cualquier
 * diferencia detiene la venta: nunca se cobra otro monto.
 */
async function ensureFlowPlan(flow, catalogo, callbackUrl) {
  const id = flow.planId(catalogo.id);
  let plan = await flow.getPlan(id);
  if (!plan) {
    await flow.createPlan({
      id,
      name: `pteron ${catalogo.display_name}`,
      amount: catalogo.monthly_price_clp,
      trialPeriodDays: Number(catalogo.trial_period_days) || 0,
      callbackUrl,
    });
    plan = await flow.getPlan(id);
  }
  const diferencia = flowPlanMismatch(plan, catalogo, callbackUrl);
  if (diferencia) {
    console.error("pteron flow plan", { planId: id, ...diferencia });
    throw new HttpError(503, "billing_plan_mismatch", "El plan de Flow no coincide con el publicado; la venta queda detenida hasta revisarlo.");
  }
  return id;
}

/**
 * Un cliente de Flow por cuenta, guardado en billing_customers apenas Flow lo
 * crea: si algo falla después, el siguiente checkout lo reutiliza en vez de
 * crear otro con el mismo externalId.
 */
async function flowCustomer({ supabase, flow }, user) {
  const userId = encodeURIComponent(user.id);
  const [guardado] = (await supabase.select("billing_customers", `user_id=eq.${userId}&select=provider_customer_id&limit=1`, { admin: true })) || [];
  if (guardado?.provider_customer_id) return guardado.provider_customer_id;
  const { customerId } = await flow.createCustomer({
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "pteron",
    email: user.email,
    externalId: user.id,
  });
  await supabase.insert("billing_customers", { user_id: user.id, provider: "flow", provider_customer_id: customerId }, { admin: true });
  return customerId;
}

async function checkout({ request, env, services }) {
  method(request, "POST");
  const { supabase, flow } = services;
  const user = await supabase.authUser(requireAuth(request));
  const input = await body(request);
  const plan = requireString(input.plan, "plan", 20).toLowerCase();
  if (!PLAN_ID.test(plan)) throw new HttpError(400, "invalid_plan", "Ese plan no está disponible.");
  if (input.acceptedTerms !== true || input.termsVersion !== TERMS_VERSION) {
    throw new HttpError(400, "terms_required", "Para continuar, acepta los Términos vigentes.");
  }
  const now = new Date();

  // El catálogo es la única fuente del precio y de la prueba: se cobra lo que
  // se publica. Un plan sin precio o que no emite licencia no se vende.
  const [catalogo] = (await supabase.select(
    "plan_catalog",
    `id=eq.${encodeURIComponent(plan)}&active=eq.true&listed=eq.true&for_sale=eq.true&select=id,display_name,monthly_price_clp,trial_period_days,license_plan&limit=1`,
    { admin: true },
  )) || [];
  if (!catalogo || !(catalogo.monthly_price_clp > 0) || !catalogo.license_plan) {
    throw new HttpError(409, "plan_not_for_sale", "Este plan todavía no está a la venta.");
  }
  await rejectPendingCheckout(services, user.id, now);
  await rejectCurrentPlan(services, user.id, now);
  const trialDays = (await trialEligible(supabase, user.id)) ? Number(catalogo.trial_period_days) || 0 : 0;

  const base = siteUrl(env, request);
  const providerPlanId = await ensureFlowPlan(flow, catalogo, `${base}/api/billing/flow-callback`);
  const customerId = await flowCustomer(services, user);
  const expiresAt = new Date(now.getTime() + VIDA_CHECKOUT).toISOString();
  const intentRows = await supabase.insert("billing_checkout_intents", {
    user_id: user.id,
    plan_id: plan,
    provider_customer_id: customerId,
    provider_plan_id: providerPlanId,
    status: "card_registration_pending",
    expires_at: expiresAt,
    trial_days: trialDays,
    terms_version: TERMS_VERSION,
  }, { admin: true });
  const intent = intentRows[0];
  if (!intent?.id) throw new HttpError(502, "server_error", "No pudimos preparar el checkout.");
  try {
    const registration = await flow.registerCustomer({
      customerId,
      returnUrl: `${base}/api/billing/card-callback?intent=${encodeURIComponent(intent.id)}`,
    });
    return json(200, { ok: true, redirectUrl: registration.redirectUrl, plan, trialPeriodDays: trialDays, expiresAt });
  } catch (error) {
    await supabase.update("billing_checkout_intents", porId(intent.id), { status: "failed" }, { admin: true }).catch(() => undefined);
    throw error;
  }
}

async function cancel({ request, services }) {
  method(request, "POST");
  const { supabase, flow } = services;
  const user = await supabase.authUser(requireAuth(request));
  await body(request);
  const userId = encodeURIComponent(user.id);
  const rows = await supabase.select(
    "subscriptions",
    `user_id=eq.${userId}&status=in.(trialing,active,past_due,paused)&select=id,provider_subscription_id,provider_plan_id,canceled_at,current_period_end&order=created_at.desc&limit=1`,
    { admin: true },
  );
  const subscription = rows?.[0];
  if (!subscription) throw new HttpError(404, "subscription_missing", "No encontramos un plan activo.");
  if (!subscription.provider_subscription_id) throw new HttpError(409, "subscription_pending", "El plan todavía está terminando de configurarse.");
  await flow.cancelSubscription({ subscriptionId: subscription.provider_subscription_id, atPeriodEnd: 1 });
  await supabase.update("subscriptions", porId(subscription.id), { cancel_at_period_end: true }, { admin: true });
  let current = { ...subscription, cancel_at_period_end: true };
  try {
    current = await syncFlowSubscription(services, current);
  } catch (error) {
    // La cancelación ya quedó en Flow y anotada; el Cron pone al día el resto.
    console.error("pteron cancel sync", { subscription: subscription.id, error: error instanceof Error ? error.message : String(error) });
  }
  // La respuesta no depende del correo: el servicio no lanza y, con waitUntil, sigue después de responder.
  await services.correo?.confirmacionCancelacion(subscription.id, user.id);
  return json(200, { ok: true, cancelAt: current.current_period_end || null });
}

/** El retorno de Flow es una navegación del navegador: toda salida vuelve a /cuenta, nunca un JSON. */
function backToAccount(base, billing, code) {
  const query = new URLSearchParams({ billing });
  if (code) query.set("code", code);
  return redirect(`${base}/cuenta?${query}`);
}

/** Otro retorno ya reclamó este intento, o ya no se puede usar: se responde según en qué quedó. */
async function settledIntent(supabase, intentId, now) {
  const [intent] = (await supabase.select("billing_checkout_intents", `${porId(intentId)}&select=status,expires_at&limit=1`, { admin: true })) || [];
  if (intent?.status === "completed") return ["success"];
  // El vencimiento se mira después de completed: un checkout terminado sigue terminado.
  if (!intent || intent.status === "expired" || Date.parse(intent.expires_at) <= now.getTime()) return ["expired"];
  if (intent.status === "failed") return ["error", "checkout_failed"];
  return ["processing"];
}

/**
 * La suscripción quedó creada en Flow pero no en la base: se cancela allá en el
 * acto para que nunca cobre algo que pteron no conoce, y queda el evento con su
 * subscriptionId para revisarlo.
 */
async function undoSubscription({ supabase, flow }, intent, subscriptionId, cause) {
  let canceled = true;
  try {
    await flow.cancelSubscription({ subscriptionId, atPeriodEnd: 0 });
  } catch {
    canceled = false;
    console.error("pteron card-callback", { intent: intent.id, subscriptionId, reason: "cancel_failed" });
  }
  await supabase.insert("billing_events", {
    user_id: intent.user_id,
    external_event_id: `flow:subscription:${subscriptionId}:creation_failed`,
    event_type: "subscription_creation_failed",
    status: "failed",
    event_metadata: { intentId: intent.id, subscriptionId, canceled, error: cause instanceof HttpError ? cause.code : "server_error" },
  }, { admin: true }).catch(() => undefined);
  await supabase.update("billing_checkout_intents", porId(intent.id), { status: "failed" }, { admin: true }).catch(() => undefined);
}

async function registerCard({ request, url, services, now }) {
  const { supabase, flow } = services;
  const input = await body(request);
  const intentId = String(url.searchParams.get("intent") || "").trim();
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!intentId || !token) return ["error", "invalid_callback"];
  // El id es un uuid generado por la base; otra forma no identifica ningún checkout.
  if (!UUID.test(intentId)) return ["expired"];

  // Reclamar el intento es lo que impide crear dos suscripciones: con dos
  // retornos a la vez (doble envío, recarga, otra pestaña) sólo uno cambia la fila.
  const [intent] = await supabase.update(
    "billing_checkout_intents",
    `${porId(intentId)}&status=eq.card_registration_pending&expires_at=gt.${encodeURIComponent(now.toISOString())}&select=${INTENTO}`,
    { status: "subscription_pending" },
    { admin: true },
  );
  if (!intent) return settledIntent(supabase, intentId, now);
  const mark = (status) => supabase.update("billing_checkout_intents", porId(intent.id), { status }, { admin: true });

  let registered;
  let current;
  try {
    registered = await flow.registerStatus(token);
    current = await supabase.select(
      "subscriptions",
      `user_id=eq.${encodeURIComponent(intent.user_id)}&status=in.(${VIGENTES.join(",")})&select=id&limit=1`,
      { admin: true },
    );
  } catch (error) {
    // Todavía no se creó nada en Flow: se libera el intento para que un
    // reintento del retorno pueda seguir.
    await supabase.update("billing_checkout_intents", `${porId(intent.id)}&status=eq.subscription_pending`, { status: "card_registration_pending" }, { admin: true }).catch(() => undefined);
    throw error;
  }
  if (registered.status !== 1) {
    await mark("failed");
    return ["cancelled"];
  }
  if (registered.customerId !== intent.provider_customer_id) {
    console.error("pteron card-callback", { intent: intent.id, reason: "customer_mismatch" });
    await mark("failed");
    return ["error", "customer_mismatch"];
  }
  if (current?.length) {
    await mark("failed");
    return ["error", "subscription_exists"];
  }

  let created;
  try {
    created = await flow.createSubscription({
      planId: intent.provider_plan_id,
      customerId: intent.provider_customer_id,
      // Siempre se envía: con 0 Flow no aplica la prueba del plan a quien ya la tuvo.
      trialPeriodDays: Number(intent.trial_days) || 0,
    });
  } catch (error) {
    if (flowRejected(error)) {
      await mark("failed").catch(() => undefined);
    } else {
      // Sin respuesta de Flow la suscripción pudo quedar creada allá: el intento
      // sigue en subscription_pending y, pasados 10 minutos, el Cron o el
      // siguiente checkout lo concilian con Flow.
      console.error("pteron card-callback", { intent: intent.id, customer: intent.provider_customer_id, reason: "subscription_create_uncertain" });
      await recordBillingEvent(supabase, intent, "subscription_create_uncertain", "received", { customerId: intent.provider_customer_id, planId: intent.provider_plan_id });
    }
    throw error;
  }

  const subscriptionId = created.subscriptionId;
  let recorded;
  try {
    recorded = await recordFlowSubscription(services, intent, created, now);
  } catch (error) {
    await undoSubscription(services, intent, subscriptionId, error);
    return ["error", "subscription_failed"];
  }
  try {
    await mark("completed");
  } catch (error) {
    // La suscripción existe; un retorno repetido verá processing en vez de crear otra.
    console.error("pteron card-callback", { intent: intent.id, reason: "complete_failed", error: error instanceof Error ? error.message : String(error) });
  }
  // La confirmación de compra sale una vez por suscripción; si falla, el retorno
  // no cambia (el servicio de correos no lanza) y el Cron lo reintenta; si ni
  // siquiera llegó a anotarse el evento, el Cron lo encuentra por la suscripción.
  await services.correo?.confirmacionCompra(recorded?.id, intent.user_id);
  return ["success"];
}

async function cardCallback({ request, env, url, services }) {
  const base = siteUrl(env, request);
  try {
    const [billing, code] = await registerCard({ request, url, services, now: new Date() });
    return backToAccount(base, billing, code);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("pteron card-callback", error instanceof Error ? error.message : error);
    return backToAccount(base, "error", error instanceof HttpError ? error.code : "server_error");
  }
}

async function flowCallback({ request, url, services }) {
  const { supabase, flow } = services;
  const input = await body(request);
  const token = String(url.searchParams.get("token") || input.token || "").trim();
  if (!token) throw new HttpError(400, "invalid_callback", "Falta el token de Flow.");
  // payment/getStatus es sólo un aviso: no dice de qué suscripción se trata ni
  // hasta cuándo quedó pagada. Lo que mueve las filas es subscription/get.
  const payment = await flow.paymentStatus(token);
  const externalEventId = `flow:payment:${payment.flowOrder}:${payment.status}`;
  const [previous] = (await supabase.select("billing_events", `external_event_id=eq.${encodeURIComponent(externalEventId)}&select=status&limit=1`, { admin: true })) || [];
  // Un aviso repetido no vuelve a recorrer las suscripciones, salvo que la vez
  // anterior haya fallado.
  if (previous && previous.status !== "failed") return json(200, { ok: true });
  const now = new Date();
  const result = await syncAfterPayment(services, payment, now);
  await supabase.upsert("billing_events", {
    user_id: result.userId,
    external_event_id: externalEventId,
    event_type: "flow_payment_callback",
    status: result.fallidas ? "failed" : result.sincronizadas ? "processed" : "ignored",
    event_metadata: {
      flowOrder: payment.flowOrder,
      commerceOrder: payment.commerceOrder,
      status: payment.status,
      amount: payment.amount,
      // El correo del pagador nunca se guarda; el hash basta para reconocerlo.
      payerHash: payment.payer ? await sha256Hex(payment.payer.toLowerCase()) : null,
      synced: result.sincronizadas,
      failed: result.fallidas,
    },
    processed_at: now.toISOString(),
  }, { admin: true, query: "on_conflict=external_event_id" }).catch((error) => {
    console.error("pteron flow-callback event", { externalEventId, error: error instanceof Error ? error.message : String(error) });
  });
  return json(200, { ok: true });
}

export const ACTIONS = { checkout, cancel, "card-callback": cardCallback, "flow-callback": flowCallback };
