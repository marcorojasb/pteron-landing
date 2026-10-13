/**
 * Sincronización de las suscripciones Flow. Flow es la fuente de verdad de lo
 * pagado: se consulta con subscription/get y se copia a `subscriptions`. Los
 * avisos de pago, el retorno de tarjeta, la renovación de licencias y el Cron
 * diario sólo deciden cuándo consultar; lo que se escribe sale siempre de la
 * suscripción completa, así que da lo mismo en qué orden lleguen.
 *
 * Todo recibe `now` para poder probarlo con un reloj fijo.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Estados locales de una fila Flow que todavía pueden cambiar en Flow. */
const SINCRONIZABLES = "status=in.(incomplete,trialing,active,past_due)";
const CAMPOS = "select=id,user_id,provider_subscription_id,provider_plan_id,status,canceled_at";
// Pocas consultas a la vez: Flow no publica su límite de tasa.
const EN_PARALELO = 4;
// Un intento en subscription_pending más joven que esto puede seguir dentro de
// un card-callback (updated_at es cuando lo reclamó): no se concilia ni se cuenta.
export const ESPERA_CONCILIACION = 10 * MINUTO;
const LIMITE_CONCILIACION = 20;
const INTENTO_CONCILIAR = "id,user_id,plan_id,provider_customer_id,provider_plan_id,status,trial_days,terms_version,provider_subscription_id";

// ── Fechas de Flow ────────────────────────────────────────────────────────
// Flow escribe 'yyyy-mm-dd hh:mm:ss' sin zona: son fechas del calendario de
// Chile (America/Santiago). Los fines de período (period_end, trial_end) son
// inclusivos: un importe del 20-oct al 19-nov cubre todo el 19 de noviembre, y
// una prueba con trial_start = trial_end dura ese día entero.

/** Partes de 'yyyy-mm-dd' o 'yyyy-mm-dd hh:mm:ss'; null si no es una fecha que exista. */
export function leerFechaFlow(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?:[:.](\d{2}))?)?$/.exec(String(texto ?? "").trim());
  if (!partes) return null;
  const [year, month, day, hour, minute, second] = partes.slice(1).map((valor) => Number(valor ?? 0));
  const calendario = new Date(Date.UTC(year, month - 1, day));
  if (calendario.getUTCFullYear() !== year || calendario.getUTCMonth() !== month - 1 || calendario.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { year, month, day, hour, minute, second };
}

let formatoChile = null;

/** El reloj de Chile en `instante`, escrito como si fuera UTC (para restar y obtener el desfase). */
function relojChile(instante) {
  formatoChile ??= new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const partes = {};
  for (const { type, value } of formatoChile.formatToParts(new Date(instante))) partes[type] = Number(value);
  return Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour % 24, partes.minute, partes.second);
}

/**
 * Instante UTC de una hora del reloj de Chile. Se prueba el desfase vigente
 * dos veces porque el cambio de hora cae justo a medianoche: si esa hora se
 * repite, gana la primera; si no existe (el día que el reloj se adelanta, las
 * 00:00 saltan a la 01:00), gana el primer instante después del salto.
 */
function instanteDesdeReloj(reloj) {
  const primero = reloj - (relojChile(reloj) - reloj);
  const segundo = reloj - (relojChile(primero) - primero);
  const exactos = [primero, segundo].filter((instante) => relojChile(instante) === reloj);
  return exactos.length ? Math.min(...exactos) : Math.max(primero, segundo);
}

/**
 * Pasa una hora del reloj de Chile a instante. Sin datos de zona horaria se
 * supone UTC-4, el horario de invierno: en verano eso cae una hora después,
 * así que un período pagado nunca termina antes de la medianoche de Chile.
 */
function desdeRelojChile({ year, month, day, hour, minute, second }) {
  const reloj = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    const instante = instanteDesdeReloj(reloj);
    if (Number.isFinite(instante)) return new Date(instante);
  } catch {
    // Sin Intl o sin la zona: se usa el respaldo de abajo.
  }
  return new Date(reloj + 4 * HORA);
}

/** La medianoche de Chile del día de `fecha` ('yyyy-mm-dd…'), como instante UTC; respaldo 04:00Z. */
export function inicioDelDiaChile(fecha) {
  const partes = leerFechaFlow(fecha);
  return partes ? desdeRelojChile({ ...partes, hour: 0, minute: 0, second: 0 }) : null;
}

/** Fin de un día inclusivo de Flow: la medianoche de Chile del día siguiente. */
function finDelDiaChile(fecha) {
  const partes = leerFechaFlow(fecha);
  if (!partes) return null;
  const siguiente = new Date(Date.UTC(partes.year, partes.month - 1, partes.day + 1));
  return desdeRelojChile({ year: siguiente.getUTCFullYear(), month: siguiente.getUTCMonth() + 1, day: siguiente.getUTCDate(), hour: 0, minute: 0, second: 0 });
}

/** Una fecha y hora de Flow (cancel_at, next_invoice_date) como instante. */
function instanteChile(texto) {
  const partes = leerFechaFlow(texto);
  return partes ? desdeRelojChile(partes) : null;
}

function iso(fecha) {
  return fecha ? fecha.toISOString() : null;
}

// ── De la suscripción de Flow a la fila local ─────────────────────────────

/** La factura pagada (status 1) que cubre hasta más tarde, con el fin de su período. */
function ultimaFacturaPagada(s) {
  let ultima = null;
  for (const factura of s.invoices) {
    if (factura.status !== 1) continue;
    const fin = finDelDiaChile(factura.period_end);
    if (fin && (!ultima || fin > ultima.fin)) ultima = { factura, fin };
  }
  return ultima;
}

/** La factura impaga (status 0) más reciente: su paymentLink es el camino para pagar. */
function ultimaFacturaImpaga(s) {
  let ultima = null;
  for (const factura of s.invoices) {
    if (factura.status !== 0) continue;
    const inicio = inicioDelDiaChile(factura.period_start);
    if (!ultima || (inicio && (!ultima.inicio || inicio > ultima.inicio))) ultima = { factura, inicio };
  }
  return ultima?.factura ?? null;
}

/**
 * Hasta cuándo está pagado: el fin de la última factura pagada; en prueba (o
 * si nunca hubo un cobro pagado) también el fin de la prueba. null si no hay
 * ninguno de los dos: un Pro antes de su primer cobro todavía no tiene acceso.
 * La prueba sólo cuenta si la suscripción la tiene: con trial_period_days 0
 * (quien ya tuvo la suya) Flow puede devolver igual fechas de prueba.
 */
export function pagadoHasta(s) {
  const pagada = ultimaFacturaPagada(s);
  let hasta = pagada?.fin ?? null;
  const finPrueba = s.status === 2 || s.trial_period_days > 0 ? finDelDiaChile(s.trial_end) : null;
  if (finPrueba && (s.status === 2 || !pagada) && (!hasta || finPrueba > hasta)) hasta = finPrueba;
  return hasta;
}

/**
 * Estado local desde Subscription.status y morose. Un estado que Flow no
 * documenta cae en incomplete, que no emite licencias: ante la duda, sin
 * acceso. Cancelar al cierre deja la fila viva hasta que se acaba lo pagado.
 */
export function estadoLocal(s, hasta, now) {
  let estado = "incomplete";
  if (s.status === 4) estado = "canceled";
  else if (s.status === 2) estado = "trialing";
  else if (s.status === 1) estado = s.morose === 1 ? "past_due" : "active";
  if (estado !== "canceled" && s.cancel_at_period_end === 1 && (!hasta || now >= hasta)) estado = "canceled";
  return estado;
}

/** Los valores de `subscriptions` que salen de una Subscription de Flow. */
export function valoresDesdeFlow(s, fila, now) {
  const hasta = pagadoHasta(s);
  const status = estadoLocal(s, hasta, now);
  const pagada = ultimaFacturaPagada(s);
  const inicioPrueba = inicioDelDiaChile(s.trial_start);
  return {
    status,
    trial_starts_at: iso(inicioPrueba),
    trial_ends_at: iso(finDelDiaChile(s.trial_end)),
    // El período pagado vigente; en prueba, la prueba.
    current_period_start: iso(s.status === 2 || !pagada ? inicioPrueba : inicioDelDiaChile(pagada.factura.period_start)),
    current_period_end: iso(hasta),
    cancel_at_period_end: s.cancel_at_period_end === 1,
    // La fecha de una fila ya cancelada no se mueve: sincronizar dos veces da lo mismo.
    canceled_at: status === "canceled" ? fila.canceled_at || iso(instanteChile(s.cancel_at) || now) : null,
    provider_status: s.status,
    morose: s.morose,
    next_invoice_at: iso(instanteChile(s.next_invoice_date)),
    payment_link: ultimaFacturaImpaga(s)?.paymentLink ?? null,
    provider_plan_id: s.planId || fila.provider_plan_id || null,
    last_synced_at: now.toISOString(),
  };
}

// ── Sincronizar ───────────────────────────────────────────────────────────

/** Valor de PostgREST entre comillas: dentro de or=(…) los «:» y «.» de una fecha son reservados. */
function citado(valor) {
  return `"${valor}"`;
}

async function sincronizar(services, fila, now) {
  const s = await services.flow.getSubscription(fila.provider_subscription_id);
  if (![0, 1, 2, 4].includes(s.status)) console.error("pteron flow sync", { subscription: fila.id, providerStatus: s.status });
  const valores = valoresDesdeFlow(s, fila, now);
  // Sólo escribe si nadie sincronizó después: una consulta más lenta no pisa
  // a otra más reciente.
  const reciente = encodeURIComponent(`(last_synced_at.is.null,last_synced_at.lt.${citado(valores.last_synced_at)})`);
  await services.supabase.update("subscriptions", `id=eq.${encodeURIComponent(fila.id)}&or=${reciente}`, valores, { admin: true });
  return { fila: { ...fila, ...valores }, suscripcion: s };
}

/**
 * Consulta la suscripción en Flow y la copia a la fila. Idempotente. Si Flow o
 * Supabase fallan, la fila queda como estaba y el error sube: quien llama
 * decide si sigue con lo local. Devuelve la fila con los valores nuevos.
 */
export async function syncFlowSubscription(services, fila, now = new Date()) {
  return (await sincronizar(services, fila, now)).fila;
}

// ── Conciliar checkouts inciertos ─────────────────────────────────────────

/**
 * Un evento de cobro, sin romper a quien lo anota: es rastro para revisar, no
 * parte de la operación. Su id es único por intento y tipo.
 */
export function recordBillingEvent(supabase, intent, eventType, status, metadata = {}) {
  return supabase.insert("billing_events", {
    user_id: intent.user_id,
    external_event_id: `flow:intent:${intent.id}:${eventType}`,
    event_type: eventType,
    status,
    event_metadata: { intentId: intent.id, ...metadata },
  }, { admin: true }).catch(() => undefined);
}

/**
 * Anota una suscripción de Flow como la de este intento: su id en el intento,
 * la fila en `subscriptions` con lo que dijo Flow (sin marcarla sincronizada) y
 * la primera sincronización con subscription/get. La comparten el retorno de
 * la tarjeta y la conciliación. Si el id en el intento o el insert fallan, el
 * error sube; la sincronización que falla sólo se registra, porque la
 * renovación y el Cron la repiten.
 */
export async function recordFlowSubscription(services, intent, subscription, now = new Date()) {
  const { supabase } = services;
  await supabase.update("billing_checkout_intents", `id=eq.${encodeURIComponent(intent.id)}`, { provider_subscription_id: subscription.subscriptionId }, { admin: true });
  const [row] = await supabase.insert("subscriptions", {
    user_id: intent.user_id,
    plan_id: intent.plan_id,
    provider: "flow",
    provider_customer_id: intent.provider_customer_id,
    provider_subscription_id: subscription.subscriptionId,
    terms_version: intent.terms_version,
    // Lo que dijo Flow, sin marcarlo sincronizado: si la consulta de abajo
    // falla, la renovación y el Cron la repiten.
    ...valoresDesdeFlow(subscription, { provider_plan_id: intent.provider_plan_id }, now),
    last_synced_at: null,
  }, { admin: true });
  if (row?.id) {
    try {
      await syncFlowSubscription(services, row, now);
    } catch (error) {
      console.error("pteron flow sync", { subscription: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return row;
}

/** Concilia un intento: "conciliados", "sinSuscripcion", o lanza si queda pendiente. */
async function conciliar(services, intent, now) {
  const { supabase, flow } = services;
  const cerrar = (status) => supabase.update(
    "billing_checkout_intents",
    `id=eq.${encodeURIComponent(intent.id)}&status=eq.subscription_pending`,
    { status },
    { admin: true },
  );
  const lista = await flow.customerSubscriptions(intent.provider_customer_id);
  const delPlan = lista.data.filter((s) => s.subscriptionId && s.planId === intent.provider_plan_id);
  const ids = encodeURIComponent(`(${delPlan.map((s) => citado(s.subscriptionId)).join(",")})`);
  const anotadas = new Set(
    delPlan.length
      ? ((await supabase.select("subscriptions", `provider_subscription_id=in.${ids}&select=provider_subscription_id`, { admin: true })) || []).map((fila) => fila.provider_subscription_id)
      : [],
  );
  // Ya quedó anotada y sólo faltó cerrar el intento.
  if (intent.provider_subscription_id && anotadas.has(intent.provider_subscription_id)) {
    await cerrar("completed");
    return "conciliados";
  }
  const candidatas = delPlan
    .filter((s) => s.status !== 4 && !anotadas.has(s.subscriptionId))
    .sort((a, b) => String(b.created ?? "").localeCompare(String(a.created ?? "")));
  if (!candidatas.length) {
    // Una lista que no cabe en la página no prueba que la suscripción no exista.
    if (lista.hasMore) throw new Error("la lista de suscripciones de Flow tiene más páginas");
    await cerrar("failed");
    await recordBillingEvent(supabase, intent, "subscription_create_not_found", "processed", { customerId: intent.provider_customer_id, planId: intent.provider_plan_id });
    return "sinSuscripcion";
  }
  const [elegida] = candidatas;
  if (candidatas.length > 1) {
    console.error("pteron reconcile", { intent: intent.id, reason: "several_subscriptions", subscriptions: candidatas.map((s) => s.subscriptionId) });
  }
  try {
    await recordFlowSubscription(services, intent, elegida, now);
  } catch (error) {
    // provider_subscription_id es único: si otra conciliación la anotó antes, ya está registrada.
    const [ya] = (await supabase.select("subscriptions", `provider_subscription_id=eq.${encodeURIComponent(elegida.subscriptionId)}&select=id&limit=1`, { admin: true })) || [];
    if (!ya) throw error;
  }
  await cerrar("completed");
  await recordBillingEvent(supabase, intent, "subscription_reconciled", "processed", { subscriptionId: elegida.subscriptionId, customerId: intent.provider_customer_id, planId: intent.provider_plan_id });
  return "conciliados";
}

/**
 * Un subscription/create que no respondió pudo crear la suscripción en Flow sin
 * que pteron la anotara: el intento queda en subscription_pending. Aquí se
 * busca en Flow, entre las suscripciones del cliente, la del plan del intento
 * que la base no conoce: si está, se anota y el intento se completa; si no,
 * el intento falla y la persona puede comprar de nuevo. Si Flow o la base
 * fallan, el intento sigue pendiente. Sólo toca intentos reclamados hace más
 * de 10 minutos (hasta 20), de `userId` si se indica.
 */
export async function reconcilePendingCheckouts(services, { now = new Date(), userId = null } = {}) {
  const antes = new Date(now.getTime() - ESPERA_CONCILIACION).toISOString();
  const deLaCuenta = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
  const intentos = await services.supabase.select(
    "billing_checkout_intents",
    `status=eq.subscription_pending&updated_at=lt.${encodeURIComponent(antes)}${deLaCuenta}&select=${INTENTO_CONCILIAR}&order=updated_at.asc&limit=${LIMITE_CONCILIACION}`,
    { admin: true },
  );
  const resultado = { conciliados: 0, sinSuscripcion: 0, pendientes: 0 };
  for (const intent of intentos || []) {
    try {
      resultado[await conciliar(services, intent, now)] += 1;
    } catch (error) {
      resultado.pendientes += 1;
      console.error("pteron reconcile", { intent: intent.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return resultado;
}

async function sincronizarFilas(services, filas, now) {
  const resultado = { sincronizadas: 0, fallidas: 0, suscripciones: [] };
  let siguiente = 0;
  async function trabajar() {
    while (siguiente < filas.length) {
      const fila = filas[siguiente++];
      try {
        const { suscripcion } = await sincronizar(services, fila, now);
        resultado.sincronizadas += 1;
        resultado.suscripciones.push({ fila, suscripcion });
      } catch (error) {
        resultado.fallidas += 1;
        console.error("pteron flow sync", { subscription: fila.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, filas.length) }, trabajar));
  return resultado;
}

/**
 * Tras un aviso de pago: payment/getStatus no dice de qué suscripción se trata,
 * así que se sincronizan las filas Flow cuyo período pagado termina cerca de
 * ahora (± 4 días) o que todavía no tienen ninguno (un Pro esperando su primer
 * cobro). Las menos recientes primero, hasta 50. `userId` es la cuenta cuya
 * factura trae ese flowOrder, si apareció.
 */
export async function syncAfterPayment(services, payment, now = new Date()) {
  const desde = new Date(now.getTime() - 4 * DIA).toISOString();
  const hasta = new Date(now.getTime() + 4 * DIA).toISOString();
  const cerca = encodeURIComponent(`(and(current_period_end.gte.${citado(desde)},current_period_end.lte.${citado(hasta)}),current_period_end.is.null)`);
  const filas = await services.supabase.select(
    "subscriptions",
    `provider=eq.flow&${SINCRONIZABLES}&provider_subscription_id=not.is.null&or=${cerca}&${CAMPOS}&order=last_synced_at.asc.nullsfirst&limit=50`,
    { admin: true },
  );
  const resultado = await sincronizarFilas(services, filas || [], now);
  const pagadora = resultado.suscripciones.find(({ suscripcion }) => suscripcion.invoices.some((factura) => factura.payment?.flowOrder === payment.flowOrder));
  return { sincronizadas: resultado.sincronizadas, fallidas: resultado.fallidas, userId: pagadora?.fila.user_id ?? null };
}

/**
 * Corrida del Cron diario: filas Flow vigentes cuyo período pagado termina
 * entre hace 4 días y dentro de 2, sin período todavía, que cancelan al cierre
 * o que no se sincronizan hace más de 7 días (o nunca). Hasta 100, las menos
 * recientes primero. También vence los checkouts que nadie completó y concilia
 * los que quedaron sin saber si Flow creó la suscripción.
 */
export async function syncDueSubscriptions(services, now = new Date()) {
  const { supabase } = services;
  const desde = new Date(now.getTime() - 4 * DIA).toISOString();
  const hasta = new Date(now.getTime() + 2 * DIA).toISOString();
  const antiguo = new Date(now.getTime() - 7 * DIA).toISOString();
  const pendientes = encodeURIComponent(
    `(and(current_period_end.gte.${citado(desde)},current_period_end.lte.${citado(hasta)}),current_period_end.is.null,cancel_at_period_end.is.true,last_synced_at.is.null,last_synced_at.lt.${citado(antiguo)})`,
  );
  const filas = await supabase.select(
    "subscriptions",
    `provider=eq.flow&${SINCRONIZABLES}&provider_subscription_id=not.is.null&or=${pendientes}&${CAMPOS}&order=last_synced_at.asc.nullsfirst&limit=100`,
    { admin: true },
  );
  const resultado = await sincronizarFilas(services, filas || [], now);
  // Sólo los que nunca volvieron de Flow. Uno en subscription_pending pudo
  // crear la suscripción allá: se concilia más abajo.
  const vencidos = await supabase.update(
    "billing_checkout_intents",
    `status=eq.card_registration_pending&expires_at=lt.${encodeURIComponent(now.toISOString())}&select=id`,
    { status: "expired" },
    { admin: true },
  );
  // Una cortesía no tiene a quién preguntarle: vence sola al terminar su período. Si
  // no, queda vigente para siempre y el índice de una suscripción vigente por cuenta
  // impide comprar un plan. La licencia ya no se emitía; esto ordena la fila.
  const cortesias = await supabase.update(
    "subscriptions",
    `provider=eq.comp&status=in.(trialing,active,past_due)&current_period_end=lt.${encodeURIComponent(now.toISOString())}&select=id`,
    { status: "expired" },
    { admin: true },
  );
  // Aparte: si la conciliación falla, la sincronización de arriba ya corrió.
  let conciliacion = { conciliados: 0, sinSuscripcion: 0, pendientes: 0 };
  try {
    conciliacion = await reconcilePendingCheckouts(services, { now });
  } catch (error) {
    console.error("pteron reconcile", { error: error instanceof Error ? error.message : String(error) });
  }
  return {
    sincronizadas: resultado.sincronizadas,
    fallidas: resultado.fallidas,
    checkoutsVencidos: vencidos.length,
    cortesiasVencidas: cortesias.length,
    checkoutsConciliados: conciliacion.conciliados,
    checkoutsSinSuscripcion: conciliacion.sinSuscripcion,
    checkoutsPendientes: conciliacion.pendientes,
  };
}
