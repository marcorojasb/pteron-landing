import { generateKeyPairSync } from "node:crypto";
import { createServices } from "../../src/worker.js";

/** Par Ed25519 de pruebas, nunca la clave real. */
export function testKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey,
    privateKey,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

export function testEnv(overrides = {}) {
  return {
    PUBLIC_SITE_URL: "https://pteron.test",
    SUPABASE_URL: "https://fake.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-fake",
    SUPABASE_PUBLISHABLE_KEY: "publishable-fake",
    LICENSE_KID: "k2",
    ...overrides,
  };
}

/** Servicios reales sobre un env de pruebas, con claves públicas propias. */
export function testServices(env, publicKeys) {
  return { ...createServices(env), ...(publicKeys ? { publicKeys } : {}) };
}

/**
 * Enruta por tabla + método: el mismo endpoint dispara varias llamadas
 * PostgREST distintas y cada prueba define sólo las que le importan.
 */
export function fakeSupabase(routes) {
  const calls = [];
  return {
    calls,
    async fetch(url, init = {}) {
      const requestMethod = init.method || "GET";
      calls.push({ url: String(url), method: requestMethod, body: init.body ? JSON.parse(init.body) : null });
      const route = routes.find((entry) => entry.method === requestMethod && String(url).includes(`/rest/v1/${entry.table}`));
      if (!route) throw new Error(`Sin mock para ${requestMethod} ${url}`);
      const result = typeof route.respond === "function" ? route.respond(calls.length) : route.respond;
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
}

export async function withFetch(fetchImpl, run) {
  const globalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    globalThis.fetch = globalFetch;
  }
}

export function fakeExecution() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(promise);
    },
    passThroughOnException() {},
    async settle() {
      await Promise.allSettled(promises);
    },
  };
}

export function jsonRequest(url, payload, init = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

/** Binding ASSETS simulado: sirve lo que haya en `files` y 404 para el resto. */
export function fakeAssets(files) {
  const calls = [];
  return {
    calls,
    async fetch(request) {
      const url = new URL(request.url);
      calls.push(url.pathname);
      if (Object.hasOwn(files, url.pathname)) {
        return new Response(files[url.pathname], { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("<h1>404</h1>", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
    },
  };
}

/**
 * Red simulada por rutas: cada entrada decide por URL y método. Sirve para
 * mezclar Supabase (REST y Auth) con Flow en una misma prueba.
 */
export function fakeNetwork(routes) {
  const calls = [];
  return {
    calls,
    async fetch(url, init = {}) {
      const target = String(url);
      const requestMethod = init.method || "GET";
      let parsedBody = null;
      if (init.body !== undefined && init.body !== null) {
        if (init.body instanceof URLSearchParams) parsedBody = Object.fromEntries(init.body);
        else if (typeof init.body === "string") {
          try {
            parsedBody = JSON.parse(init.body);
          } catch {
            parsedBody = init.body;
          }
        }
      }
      const call = { url: target, method: requestMethod, body: parsedBody, headers: init.headers || {} };
      calls.push(call);
      const route = routes.find((entry) => entry.match(target, requestMethod, call));
      if (!route) throw new Error(`Sin mock para ${requestMethod} ${target}`);
      const result = typeof route.respond === "function" ? route.respond(call, calls) : route.respond;
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
}

export const matches = {
  supabase: (table, requestMethod = "GET") => (url, m) => m === requestMethod && url.includes(`/rest/v1/${table}`),
  auth: (path) => (url) => url.includes(`/auth/v1/${path}`),
  flow: (path) => (url) => url.includes(`flow.cl/api${path}`),
  rpc: (name) => (url) => url.includes(`/rest/v1/rpc/${name}`),
};

/** Petición de formulario como la que Flow envía al retorno de tarjeta y al callback de pago. */
export function formRequest(url, fields, init = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(init.headers || {}) },
    body: new URLSearchParams(fields).toString(),
    ...init,
  });
}

/** Binding ASSETS con ETag: devuelve 304 cuando la petición trae el ETag del recurso. */
export function fakeAssetsWithEtags(files) {
  const calls = [];
  return {
    calls,
    async fetch(request) {
      const url = new URL(request.url);
      calls.push({ path: url.pathname, method: request.method, ifNoneMatch: request.headers.get("if-none-match") });
      const entry = Object.hasOwn(files, url.pathname) ? files[url.pathname] : { body: "<h1>404</h1>", status: 404, etag: '"etag-404"' };
      const status = entry.status ?? 200;
      if (request.headers.get("if-none-match") === entry.etag) {
        return new Response(null, { status: 304, headers: { etag: entry.etag } });
      }
      return new Response(request.method === "HEAD" ? null : entry.body, { status, headers: { "content-type": "text/html; charset=utf-8", etag: entry.etag } });
    },
  };
}
