import { json, method, siteUrl } from "../lib/http.js";
import { ESPERA_CONCILIACION } from "../lib/flow-sync.js";
import { faltantesCorreo } from "../lib/correo.js";
import { includedAiSubscription } from "../lib/gateway.js";
import { verifyLicense } from "../lib/license.js";
import { hasKnownPrice } from "../lib/units.js";

/**
 * Salud del servicio. Un secreto ausente sólo se descubría cuando un docente
 * fallaba: así pasó con la clave de Anthropic. /api/health es público y sólo
 * dice si lo esencial está en orden, sin nombres ni detalles, para que un
 * monitor lo consulte después de cada despliegue. /api/admin/salud (sólo
 * administración; lo enruta admin.js) dice qué falla, chequeo por chequeo, y
 * siempre con booleanos: nunca devuelve el valor de un secreto.
 */

// La clave que conocen las apps 0.7.x (PUBLIC_KEYS en lib/license.js).
const CLAVE_VIGENTE = "k2";
// El token de prueba no es de ninguna cuenta y nunca sale del Worker.
const SUJETO_DE_PRUEBA = "pteron-salud";
const FLOW_PRODUCCION = "https://www.flow.cl/api";
const ANTHROPIC_API = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
// Los rechazos de la cuenta de Anthropic que se miran hacia atrás.
const DIAS_RECHAZOS = 7;
// 10.000.000 unidades = US$1 (lib/units.js).
const UNIDADES_POR_USD = 10_000_000;
// El tope de gasto del workspace de Anthropic (LANZAR-BASIC.md, sección 3):
// 1,5 veces la cuota mensual de las cuentas con IA incluida, nunca bajo US$20.
const TOPE_MINIMO_USD = 20;
// Supabase entrega como máximo 1.000 filas por consulta: se pide por páginas.
const PAGINA = 1000;
const PAGINAS_MAXIMAS = 20;

// Por nombre, como los lista el README.
const SECRETOS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FLOW_API_KEY",
  "FLOW_SECRET_KEY",
  "LICENSE_PRIVATE_KEY_PEM",
  "ANTHROPIC_API_KEY",
  "ADMIN_EMAILS",
];
const VARIABLES = ["PUBLIC_SITE_URL", "SUPABASE_URL", "LICENSE_KID", "GATEWAY_MODEL_ID", "FLOW_BASE_URL", "FLOW_BASIC_PLAN_ID", "FLOW_PRO_PLAN_ID"];

function presente(env, name) {
  return Boolean(String(env?.[name] ?? "").trim());
}

function modeloDelGateway(env) {
  return String(env?.GATEWAY_MODEL_ID || "").trim();
}

// Una ANTHROPIC_BASE_URL olvidada de las pruebas mandaría la clave real a otro host.
function anthropicOficial(env) {
  return String(env?.ANTHROPIC_BASE_URL || ANTHROPIC_API).trim().replace(/\/+$/, "") === ANTHROPIC_API;
}

// Flow manda algunos números como texto ('1').
function numero(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return null;
}

function texto(value) {
  return typeof value === "string" ? value.trim() : null;
}

/**
 * Lo que le falta a un plan del catálogo para venderse: activo, visible, con
 * precio, con cuota (sin cuota el gasto de IA no tiene techo) y con una
 * licencia que la app entienda. Vacío = listo. /admin no abre la venta de un
 * plan incompleto ni deja incompleto uno que está a la venta.
 */
export function faltaParaVender(plan) {
  const falta = [];
  if (plan?.active !== true) falta.push("activo");
  if (plan?.listed !== true) falta.push("visible");
  if (!(Number(plan?.monthly_price_clp) > 0)) falta.push("precio");
  if (plan?.ai_units_limit === null || plan?.ai_units_limit === undefined) falta.push("cuota");
  if (!plan?.license_plan) falta.push("licencia");
  return falta;
}

/**
 * Firma un token de prueba con el servicio de licencias y lo verifica con la
 * clave pública publicada: así se sabe que la privada es la del kid vigente.
 * El token no se guarda ni se devuelve.
 */
async function firmaAutoverificada(services) {
  try {
    const token = await services.license.signLicense({
      subject: SUJETO_DE_PRUEBA,
      plan: "basic",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const verified = await verifyLicense(token, services.publicKeys);
    return verified?.kid === CLAVE_VIGENTE && verified.sub === SUJETO_DE_PRUEBA;
  } catch {
    return false;
  }
}

/**
 * El interruptor de la IA incluida, leído con la service role: de paso prueba
 * que Supabase responde, que la clave del servidor vale y que el esquema
 * está aplicado. Pausada salvo que la fila diga exactamente false, como lo lee
 * begin_ai_request.
 */
async function leerAjustes(services) {
  try {
    const rows = await services.supabase.select("app_settings", "key=eq.included_ai_paused&select=value", { admin: true });
    return { supabase: true, pausada: rows?.[0]?.value !== false };
  } catch {
    return { supabase: false, pausada: null };
  }
}

function flowConfigurado(env, services) {
  if (!presente(env, "FLOW_API_KEY") || !presente(env, "FLOW_SECRET_KEY")) return false;
  try {
    services.flow.flowBaseUrl();
    return true;
  } catch {
    return false;
  }
}

function flowDeProduccion(services) {
  try {
    return services.flow.flowBaseUrl() === FLOW_PRODUCCION;
  } catch {
    return false;
  }
}

/**
 * Lo esencial, sin llamar a Flow ni a Anthropic: una ruta pública no debe
 * gastar los límites de tasa de los proveedores. Supabase sí se consulta,
 * porque cualquier ruta de la cuenta ya lo hace.
 */
async function esencial(env, services) {
  const [ajustes, firma] = await Promise.all([leerAjustes(services), firmaAutoverificada(services)]);
  return {
    ajustes,
    checks: {
      supabase: ajustes.supabase && presente(env, "SUPABASE_PUBLISHABLE_KEY"),
      firma,
      flow: flowConfigurado(env, services),
      anthropic: presente(env, "ANTHROPIC_API_KEY") && hasKnownPrice(modeloDelGateway(env)),
    },
  };
}

/** GET /api/health: 200 {ok: true} o 503 {ok: false}. Qué falló queda en el log, no en la respuesta. */
export async function health({ request, env, services }) {
  method(request, "GET");
  const { checks } = await esencial(env, services);
  const ok = Object.values(checks).every(Boolean);
  if (!ok) console.error("pteron health", checks);
  return json(ok ? 200 : 503, { ok });
}

/** La clave responde por el modelo del gateway: leer un modelo no consume tokens. */
async function claveDeAnthropicValida(env) {
  const apiKey = String(env?.ANTHROPIC_API_KEY || "").trim();
  const model = modeloDelGateway(env);
  if (!apiKey || !model) return false;
  try {
    const response = await fetch(`${ANTHROPIC_API}/v1/models/${encodeURIComponent(model)}`, {
      headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, accept: "application/json" },
    });
    await response.arrayBuffer();
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * El plan de Flow cobra exactamente lo publicado: el monto del catálogo, en
 * CLP, cada mes, activo y avisando a este sitio. Es lo mismo que el checkout
 * exige antes de registrar una tarjeta.
 */
async function planDeFlowCoincide(services, plan, callbackUrl) {
  try {
    const flowPlan = await services.flow.request("/plans/get", { planId: services.flow.planId(plan.id) }, "GET");
    return (
      numero(flowPlan?.amount) === Number(plan.monthly_price_clp) &&
      texto(flowPlan?.currency) === "CLP" &&
      numero(flowPlan?.interval) === 3 &&
      numero(flowPlan?.interval_count) === 1 &&
      numero(flowPlan?.status) === 1 &&
      texto(flowPlan?.urlCallback) === callbackUrl
    );
  } catch {
    return false;
  }
}

async function leerCatalogo(services) {
  try {
    const rows = await services.supabase.select(
      "plan_catalog",
      "active=eq.true&select=id,display_name,active,listed,for_sale,monthly_price_clp,ai_units_limit,license_plan&order=monthly_price_clp.asc",
      { admin: true },
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return null;
  }
}

/**
 * Compras que Flow pudo cobrar sin que pteron lo supiera: intentos en
 * subscription_pending desde hace más de 10 minutos, los que el Cron y el
 * siguiente checkout concilian. Lo esperado es 0; null si no se pudo leer.
 * No bloquea nada: es una alerta para revisar.
 */
async function checkoutsAtascados(services) {
  try {
    const antes = new Date(Date.now() - ESPERA_CONCILIACION).toISOString();
    const rows = await services.supabase.select(
      "billing_checkout_intents",
      `status=eq.subscription_pending&updated_at=lt.${encodeURIComponent(antes)}&select=id`,
      { admin: true },
    );
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

/**
 * El rechazo más reciente de la cuenta de pteron en Anthropic (el gateway lo
 * anota como `provider_paused`, con su motivo y el estado HTTP): el tope de
 * gasto, el crédito o la clave. La clave puede responder por el modelo y aun
 * así cada petición rebotar en el tope, así que sólo esto lo muestra. Se leen
 * tres campos de event_metadata, nunca la fila entera. Si hubo un rechazo, se
 * busca además la última petición aceptada (`ok`) después de él: `ultimo_ok`
 * dice que ya se arregló. `ultimo` null = ninguno en la ventana; todo null si
 * no se pudo leer.
 */
async function rechazosDeAnthropic(services) {
  try {
    const desde = new Date(Date.now() - DIAS_RECHAZOS * 86_400_000).toISOString();
    const rows = await services.supabase.select(
      "ai_requests",
      `event_metadata->>status=eq.provider_paused&finished_at=gte.${encodeURIComponent(desde)}` +
        "&select=finished_at,motivo:event_metadata->>motivo,estado:event_metadata->>upstream_status&order=finished_at.desc&limit=1",
      { admin: true },
    );
    if (!Array.isArray(rows)) return null;
    const [fila] = rows;
    if (!fila) return { dias: DIAS_RECHAZOS, ultimo: null, ultimo_ok: null };
    const estado = Number(fila.estado);
    let ultimoOk = null;
    if (fila.finished_at) {
      const aceptadas = await services.supabase.select(
        "ai_requests",
        `event_metadata->>status=eq.ok&finished_at=gt.${encodeURIComponent(fila.finished_at)}&select=finished_at&order=finished_at.desc&limit=1`,
        { admin: true },
      );
      if (!Array.isArray(aceptadas)) return null;
      ultimoOk = aceptadas[0]?.finished_at ?? null;
    }
    return {
      dias: DIAS_RECHAZOS,
      ultimo: { cuando: fila.finished_at ?? null, motivo: texto(fila.motivo) || null, estado: Number.isInteger(estado) ? estado : null },
      ultimo_ok: ultimoOk,
    };
  } catch {
    return null;
  }
}

async function suscripcionesVigentes(services) {
  const filas = [];
  for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina++) {
    const lote = await services.supabase.select(
      "subscriptions",
      "status=in.(trialing,active,past_due)" +
        "&select=plan_id,provider,status,current_period_end,cancel_at_period_end,plan_catalog(display_name,ai_units_limit,license_plan)" +
        `&order=id.asc&limit=${PAGINA}&offset=${pagina * PAGINA}`,
      { admin: true },
    );
    if (!Array.isArray(lote)) throw new Error("subscriptions ilegible");
    filas.push(...lote);
    if (lote.length < PAGINA) return filas;
  }
  // Más filas de las que se leyeron: un tope calculado con una parte sería bajo.
  throw new Error("demasiadas suscripciones");
}

/**
 * Tope mensual sugerido para el workspace de Anthropic, con las cuentas que hoy
 * pueden usar la IA incluida. La regla es la del gateway (includedAiSubscription):
 * suscripción trialing, active o past_due, de un plan que emite licencia, con
 * acceso vigente (lo pagado más 72 h de gracia en Flow, sin gracia si canceló al
 * cierre; una cortesía `comp`, hasta su fin). Las cortesías cuentan con la cuota
 * de su plan (tester), y una prueba con la cuota mensual del plan, no la de
 * prueba: pasa a pagar dentro del mismo mes. Una cuenta por fila: la base admite
 * una sola suscripción vigente por cuenta. Un plan sin tope (ai_units_limit
 * null) no tiene techo que sumar: se cuenta aparte en `sin_tope`, en total y
 * por plan. Sólo números, ningún dato de las cuentas; null si no se pudo leer.
 */
async function topeSugerido(services) {
  let filas;
  try {
    filas = await suscripcionesVigentes(services);
  } catch {
    return null;
  }
  const ahora = new Date();
  const porPlan = new Map();
  let unidades = 0;
  let sinTope = 0;
  for (const fila of filas) {
    if (!includedAiSubscription(fila, ahora)) continue;
    const limite = fila.plan_catalog.ai_units_limit;
    const plan = porPlan.get(fila.plan_id) ?? { id: fila.plan_id, nombre: fila.plan_catalog.display_name || fila.plan_id, cuentas: 0, cortesias: 0, unidades_mes: 0, sin_tope: 0 };
    plan.cuentas += 1;
    if (fila.provider === "comp") plan.cortesias += 1;
    if (limite === null || limite === undefined) {
      plan.sin_tope += 1;
      sinTope += 1;
    } else {
      // Como en el gateway, una cuota inválida cuenta como 0.
      const cuota = Number.isInteger(limite) && limite > 0 ? limite : 0;
      plan.unidades_mes += cuota;
      unidades += cuota;
    }
    porPlan.set(fila.plan_id, plan);
  }
  // 1,5 × unidades / 10.000.000, redondeado hacia arriba, en enteros para no arrastrar decimales.
  const usd = Math.max(TOPE_MINIMO_USD, Math.ceil((unidades * 3) / (UNIDADES_POR_USD * 2)));
  return {
    usd,
    minimo_usd: TOPE_MINIMO_USD,
    factor: 1.5,
    unidades_mes: unidades,
    sin_tope: sinTope,
    planes: [...porPlan.values()].sort((a, b) => b.unidades_mes - a.unidades_mes || a.id.localeCompare(b.id)),
  };
}

function correosAlCliente(env) {
  const faltan = faltantesCorreo(env);
  return { configurado: faltan.length === 0, faltan };
}

/**
 * GET /api/admin/salud. Los planes de pago se comparan con Flow aunque no
 * estén a la venta: así se revisa el plan antes de abrirla. Uno gratuito no
 * pasa por Flow (`flow: null`).
 */
export async function salud({ request, env, services }) {
  const callbackUrl = `${siteUrl(env, request)}/api/billing/flow-callback`;
  const [base, catalogo, anthropic, atascados, rechazos, tope] = await Promise.all([
    esencial(env, services),
    leerCatalogo(services),
    claveDeAnthropicValida(env),
    checkoutsAtascados(services),
    rechazosDeAnthropic(services),
    topeSugerido(services),
  ]);
  const planes = await Promise.all((catalogo || []).map(async (plan) => {
    const falta = faltaParaVender(plan);
    const pagado = !falta.includes("precio");
    return {
      id: plan.id,
      nombre: plan.display_name || plan.id,
      for_sale: plan.for_sale === true,
      visible: !falta.includes("visible"),
      precio: pagado,
      cuota: !falta.includes("cuota"),
      licencia: !falta.includes("licencia"),
      flow: pagado ? await planDeFlowCoincide(services, plan, callbackUrl) : null,
    };
  }));
  const aLaVenta = planes.filter((plan) => plan.for_sale);
  return json(200, {
    esencial: Object.values(base.checks).every(Boolean),
    secretos: Object.fromEntries(SECRETOS.map((name) => [name, presente(env, name)])),
    variables: Object.fromEntries(VARIABLES.map((name) => [name, presente(env, name)])),
    supabase: base.checks.supabase,
    firma: base.checks.firma,
    flow: base.checks.flow,
    flow_produccion: flowDeProduccion(services),
    modelo_con_precio: hasKnownPrice(modeloDelGateway(env)),
    anthropic,
    anthropic_url_oficial: anthropicOficial(env),
    // No es esencial: avisa que Anthropic rechaza las peticiones aunque la clave responda.
    anthropic_rechazos: rechazos,
    anthropic_tope_sugerido: tope,
    ia_incluida_pausada: base.ajustes.pausada,
    catalogo: catalogo !== null,
    checkouts_atascados: atascados,
    // Los correos al cliente salen apagados hasta tener la clave de Resend y los
    // datos del vendedor. No es esencial ni bloquea la venta: sólo dice qué
    // nombres faltan (nunca sus valores).
    correos: correosAlCliente(env),
    planes,
    // Sin planes a la venta no hay nada que revisar: null, no true.
    venta: aLaVenta.length ? aLaVenta.every((plan) => plan.visible && plan.precio && plan.cuota && plan.licencia && plan.flow === true) : null,
  });
}
