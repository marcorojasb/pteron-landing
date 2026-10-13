import { SECURITY_HEADERS, handleError, json, requireSiteHost } from "./lib/http.js";
import { createSupabase } from "./lib/supabase.js";
import { createFlow } from "./lib/flow.js";
import { syncDueSubscriptions } from "./lib/flow-sync.js";
import { PUBLIC_KEYS, createLicenseService } from "./lib/license.js";
import { createGateway } from "./lib/gateway.js";
import { ACTIONS as auth } from "./routes/auth.js";
import { ACTIONS as billing } from "./routes/billing.js";
import { ACTIONS as activation } from "./routes/activation.js";
import { ACTIONS as license } from "./routes/license.js";
import { account } from "./routes/account.js";
import { chatCompletions, messages, models } from "./routes/ai.js";
import { admin } from "./routes/admin.js";
import { health } from "./routes/health.js";

/**
 * Worker de pteron-landing. La web estática la sirve Cloudflare como assets
 * antes de llegar acá; el Worker atiende /api/* y el fallback de /docs/:slug,
 * que antes era una regla de reescritura de vercel.json.
 */
const ACTION_ROUTES = { auth, billing, activation, license };

const EXACT_ROUTES = {
  "/api/account": account,
  "/api/health": health,
  "/api/ai/v1/models": models,
  "/api/ai/v1/messages": messages,
  "/api/ai/v1/chat/completions": chatCompletions,
};

export function createServices(env) {
  const supabase = createSupabase(env);
  return {
    supabase,
    flow: createFlow(env),
    license: createLicenseService(env, supabase),
    gateway: createGateway(supabase),
    publicKeys: PUBLIC_KEYS,
  };
}

export function matchApi(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (Object.hasOwn(EXACT_ROUTES, path)) return EXACT_ROUTES[path];
  if (path === "/api/admin" || path.startsWith("/api/admin/")) return (ctx) => admin(ctx, path.slice("/api/admin".length));
  const match = /^\/api\/(auth|billing|activation|license)\/([a-z-]+)$/.exec(path);
  if (!match) return null;
  const actions = ACTION_ROUTES[match[1]];
  return Object.hasOwn(actions, match[2]) ? actions[match[2]] : null;
}

// Lo que cobra, firma licencias, gasta IA o lee cuentas usa los secretos de
// producción: fuera del host de PUBLIC_SITE_URL responde 421. /api/health no.
const SITE_ONLY = /^\/api\/(?:(?:ai|billing|license|activation|auth|account)(?:\/|$)|admin)/;

async function handleApi(request, env, execution) {
  const url = new URL(request.url);
  try {
    if (SITE_ONLY.test(url.pathname)) requireSiteHost(env, url);
    const route = matchApi(url.pathname);
    if (!route) return json(404, { error: "not_found", message: "Ruta no encontrada." });
    return await route({ request, env, url, execution, services: createServices(env) });
  } catch (error) {
    return handleError(error);
  }
}

const DOCS_PAGE = /^\/docs\/[^/]+$/;

/**
 * Los assets resuelven URLs limpias y la 404 por sí solos. Lo único que el
 * Worker añade es /docs/:slug → docs/index.html, porque la documentación es
 * una página única que lee el slug del navegador.
 */
async function handleAssets(request, env) {
  const url = new URL(request.url);
  const navigation = request.method === "GET" || request.method === "HEAD";
  if (/^\/docs\/[^/]+\/$/.test(url.pathname) && navigation) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    return new Response(null, { status: 308, headers: { Location: url.toString(), ...SECURITY_HEADERS } });
  }
  if (!DOCS_PAGE.test(url.pathname) || !navigation) return env.ASSETS.fetch(request);
  // La sonda va sin cabeceras condicionales: si el navegador guardó la 404 de
  // este slug, un 304 la haría pasar por página válida. El 404 real decide.
  const probeHeaders = new Headers(request.headers);
  probeHeaders.delete("if-none-match");
  probeHeaders.delete("if-modified-since");
  const response = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers: probeHeaders }));
  if (response.status !== 404) return response;
  // Aquí sí se reenvían las condicionales: un 304 de la página de docs es tan válido como el 200.
  const page = await env.ASSETS.fetch(new Request(new URL("/docs", url), { method: request.method, headers: request.headers }));
  return page.ok || page.status === 304 ? page : response;
}

export default {
  async fetch(request, env, execution) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return handleApi(request, env, execution);
    return handleAssets(request, env);
  },
  // Cron diario (triggers.crons en wrangler.jsonc): pone al día con Flow las
  // suscripciones cerca del fin de lo pagado, aunque el aviso de pago no llegue
  // y el docente no abra la app.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(syncDueSubscriptions(createServices(env), new Date()));
  },
};
