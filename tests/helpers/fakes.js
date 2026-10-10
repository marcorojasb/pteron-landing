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
    LICENSE_KID: "k1",
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
