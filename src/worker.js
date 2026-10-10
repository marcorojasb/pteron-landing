import { handleError, json } from "./lib/http.js";
import { createSupabase } from "./lib/supabase.js";
import { createFlow } from "./lib/flow.js";
import { PUBLIC_KEYS, createLicenseService } from "./lib/license.js";
import { createGateway } from "./lib/gateway.js";
import { ACTIONS as auth } from "./routes/auth.js";
import { ACTIONS as billing } from "./routes/billing.js";
import { ACTIONS as activation } from "./routes/activation.js";
import { ACTIONS as license } from "./routes/license.js";
import { account } from "./routes/account.js";
import { chatCompletions, models } from "./routes/ai.js";

/**
 * Worker de pteron-landing. La web estática la sirve Cloudflare como assets
 * antes de llegar acá; el Worker atiende /api/* y el fallback de /docs/:slug,
 * que antes era una regla de reescritura de vercel.json.
 */
const ACTION_ROUTES = { auth, billing, activation, license };

const EXACT_ROUTES = {
  "/api/account": account,
  "/api/ai/v1/models": models,
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
  const match = /^\/api\/(auth|billing|activation|license)\/([a-z-]+)$/.exec(path);
  if (!match) return null;
  const actions = ACTION_ROUTES[match[1]];
  return Object.hasOwn(actions, match[2]) ? actions[match[2]] : null;
}

async function handleApi(request, env, execution) {
  const url = new URL(request.url);
  const route = matchApi(url.pathname);
  if (!route) return json(404, { error: "not_found", message: "Ruta no encontrada." });
  try {
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
  if (/^\/docs\/[^/]+\/$/.test(url.pathname) && (request.method === "GET" || request.method === "HEAD")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    return Response.redirect(url.toString(), 308);
  }
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || !DOCS_PAGE.test(url.pathname)) return response;
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  // Se reenvían las cabeceras condicionales: un 304 por ETag es tan válido como el 200.
  const page = await env.ASSETS.fetch(new Request(new URL("/docs", url), { method: request.method, headers: request.headers }));
  return page.ok || page.status === 304 ? page : response;
}

export default {
  async fetch(request, env, execution) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return handleApi(request, env, execution);
    return handleAssets(request, env);
  },
};
