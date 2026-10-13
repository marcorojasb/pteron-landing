import { json, method, siteUrl } from "../lib/http.js";
import { ESPERA_CONCILIACION } from "../lib/flow-sync.js";
import { faltantesCorreo } from "../lib/correo.js";
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
  const [base, catalogo, anthropic, atascados] = await Promise.all([esencial(env, services), leerCatalogo(services), claveDeAnthropicValida(env), checkoutsAtascados(services)]);
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
