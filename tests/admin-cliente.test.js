import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// admin.js corre sin navegador sobre un DOM mínimo: lo que importa es qué queda a la vista y qué se pide al servidor.
const source = readFileSync(new URL("../public/admin/admin.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/admin/index.html", import.meta.url), "utf8");
const SESSION_KEY = "pteron-account-session";
// Lo que index.html trae oculto al cargar, leído de la página y no supuesto aquí.
const OCULTOS_AL_CARGAR = new Set([...html.matchAll(/<[^>]*\b(data-admin-(?:notice|login|app|noaccess))\b[^>]*\bhidden\b[^>]*>/g)].map((match) => `[${match[1]}]`));

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (sub, extra = {}) => `${base64url({ alg: "HS256" })}.${base64url({ sub, ...extra })}.firma`;
const session = (sub) => JSON.stringify({ access_token: token(sub), refresh_token: `refresco-${sub}` });
const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const FORBIDDEN = { error: "forbidden", message: "Esta cuenta no administra pteron." };
const RESUMEN = { cuentas: 1, pagando: 0, en_prueba: 0, cortesias: 0, clp_mes_recurrente: 0, mes: "2026-10", unidades_mes: 0, cuentas_con_uso: 0, licencias_vigentes: 0, a_la_venta: [], ia_incluida_pausada: false };

function element(selector) {
  const node = {
    selector, hidden: OCULTOS_AL_CARGAR.has(selector), textContent: "", dataset: {}, attributes: {}, children: [], listeners: {}, value: "",
    addEventListener(type, listener) { (node.listeners[type] ||= []).push(listener); },
    setAttribute(name, value) { node.attributes[name] = value; },
    removeAttribute(name) { delete node.attributes[name]; },
    replaceChildren(...children) { node.children = children; },
    append(...children) { node.children.push(...children); },
    querySelector(child) { return element(`${selector} ${child}`); },
    querySelectorAll: () => [],
  };
  return node;
}

/** Carga admin.js con una sesión guardada (o ninguna) y un fetch falso. */
async function load({ stored, routes, hash = "" }) {
  const nodes = new Map();
  const $ = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, element(selector));
    return nodes.get(selector);
  };
  const store = new Map(stored ? [[SESSION_KEY, stored]] : []);
  const calls = [];
  const created = [];
  const windowListeners = {};
  const page = { reloads: 0 };
  const fetch = async (path) => {
    calls.push(String(path));
    const route = routes[String(path).split("?")[0]];
    return route ? route() : respond(404, { error: "not_found" });
  };
  const context = {
    document: {
      querySelector: $,
      querySelectorAll: () => [],
      createElement: (tag) => {
        const node = element(tag);
        created.push(node);
        return node;
      },
    },
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    location: { hash, reload: () => { page.reloads++; } },
    history: { pushState() {} },
    window: { addEventListener: (type, listener) => { (windowListeners[type] ||= []).push(listener); }, confirm: () => true },
    fetch, Headers, Response, FormData, atob, Intl, JSON, URL, console,
  };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const storage = (key, value) => {
    if (value === null) store.delete(key);
    else store.set(key, value);
    for (const listener of windowListeners.storage || []) listener({ key });
  };
  return { $, calls, created, page, store, storage };
}

test("index.html trae ocultos el aviso, la invitación, el panel y la salida", () => {
  assert.deepEqual([...OCULTOS_AL_CARGAR].sort(), ["[data-admin-app]", "[data-admin-login]", "[data-admin-noaccess]", "[data-admin-notice]"]);
});

test("una cuenta que no administra no ve el panel: sólo el aviso y la salida, sin pedir datos ni recargar", async () => {
  const { $, calls, page } = await load({ stored: session("profe"), routes: { "/api/admin/sesion": () => respond(403, FORBIDDEN) } });
  assert.deepEqual(calls, ["/api/admin/sesion"]);
  assert.equal(page.reloads, 0);
  assert.equal($("[data-admin-app]").hidden, true);
  assert.equal($("[data-admin-login]").hidden, true);
  assert.equal($("[data-admin-noaccess]").hidden, false);
  assert.equal($("[data-admin-notice]").hidden, false);
  assert.equal($("[data-admin-notice]").dataset.tone, "error");
  assert.equal($("[data-admin-notice]").textContent, "Esta cuenta no administra pteron.");
  assert.equal($("[data-admin-email]").textContent, "");
});

test("quien administra ve el panel con el correo que confirma el servidor, y después se cargan los datos", async () => {
  const { $, calls } = await load({
    stored: session("admin"),
    routes: {
      "/api/admin/sesion": () => respond(200, { email: "marcorojas@me.com" }),
      "/api/admin/resumen": () => respond(200, RESUMEN),
      "/api/admin/cuentas": () => respond(200, { total: 0, cuentas: [] }),
    },
  });
  assert.equal(calls[0], "/api/admin/sesion");
  assert.ok(calls.includes("/api/admin/resumen") && calls.includes("/api/admin/cuentas"));
  assert.equal(calls.includes("/api/auth/me"), false);
  assert.equal($("[data-admin-app]").hidden, false);
  assert.equal($("[data-admin-noaccess]").hidden, true);
  assert.equal($("[data-admin-email]").textContent, "marcorojas@me.com");
});

test("sin sesión guardada, la invitación a entrar y ninguna petición", async () => {
  const { $, calls } = await load({ stored: null, routes: {} });
  assert.deepEqual(calls, []);
  assert.equal($("[data-admin-login]").hidden, false);
  assert.equal($("[data-admin-app]").hidden, true);
  assert.equal($("[data-admin-noaccess]").hidden, true);
});

test("con la sesión vencida y sin poder renovarla, se pide entrar de nuevo", async () => {
  // Supabase rechaza el token de renovación con 400 y el Worker lo entrega como 502 (src/lib/supabase.js).
  const { $, calls, page } = await load({
    stored: session("admin"),
    routes: {
      "/api/admin/sesion": () => respond(401, { error: "not_authenticated" }),
      "/api/auth/refresh": () => respond(502, { error: "supabase_error", message: "Invalid Refresh Token: Refresh Token Not Found" }),
    },
  });
  assert.deepEqual(calls, ["/api/admin/sesion", "/api/auth/refresh"]);
  assert.equal(page.reloads, 0);
  assert.equal($("[data-admin-app]").hidden, true);
  assert.equal($("[data-admin-login]").hidden, false);
  assert.equal($("[data-admin-noaccess]").hidden, true);
  assert.equal($("[data-admin-notice]").textContent, "Tu sesión expiró. Entra de nuevo desde tu cuenta.");
});

test("si el servidor no puede decidir (503), el aviso y la salida, sin panel", async () => {
  const { $, page } = await load({
    stored: session("admin"),
    routes: { "/api/admin/sesion": () => respond(503, { error: "admin_not_configured", message: "La administración todavía no está configurada." }) },
  });
  assert.equal($("[data-admin-app]").hidden, true);
  assert.equal($("[data-admin-login]").hidden, true);
  assert.equal($("[data-admin-noaccess]").hidden, false);
  assert.equal($("[data-admin-notice]").textContent, "La administración todavía no está configurada.");
  assert.equal(page.reloads, 0);
});

test("con el panel abierto, un 403 o una sesión que no se renueva recargan la página en vez de dejar los datos a la vista", async () => {
  const abierto = { "/api/admin/sesion": () => respond(200, { email: "marcorojas@me.com" }), "/api/admin/cuentas": () => respond(200, { total: 0, cuentas: [] }) };
  const prohibido = await load({ stored: session("admin"), routes: { ...abierto, "/api/admin/resumen": () => respond(403, FORBIDDEN) } });
  assert.equal(prohibido.page.reloads, 1);
  const vencida = await load({
    stored: session("admin"),
    routes: {
      ...abierto,
      "/api/admin/resumen": () => respond(401, { error: "not_authenticated" }),
      "/api/auth/refresh": () => respond(502, { error: "supabase_error", message: "Invalid Refresh Token: Refresh Token Not Found" }),
    },
  });
  assert.equal(vencida.page.reloads, 1);
});

test("otra pestaña que sale o entra con otra cuenta recarga /admin; renovar el token de la misma cuenta no", async () => {
  const routes = {
    "/api/admin/sesion": () => respond(200, { email: "marcorojas@me.com" }),
    "/api/admin/resumen": () => respond(200, RESUMEN),
    "/api/admin/cuentas": () => respond(200, { total: 0, cuentas: [] }),
  };
  const abierta = await load({ stored: session("admin"), routes });
  abierta.storage("otra-clave", "x");
  abierta.storage(SESSION_KEY, JSON.stringify({ access_token: token("admin", { iat: 2 }), refresh_token: "renovado" }));
  assert.equal(abierta.page.reloads, 0, "misma cuenta, token nuevo");
  abierta.storage(SESSION_KEY, session("profe"));
  assert.equal(abierta.page.reloads, 1, "otra cuenta");

  const saliendo = await load({ stored: session("admin"), routes });
  saliendo.storage(SESSION_KEY, null);
  assert.equal(saliendo.page.reloads, 1, "sesión cerrada");

  const sinSesion = await load({ stored: null, routes });
  sinSesion.storage(SESSION_KEY, session("admin"));
  assert.equal(sinSesion.page.reloads, 1, "entró en otra pestaña");

  // Con la sesión vencida, volver a entrar con la misma cuenta en otra pestaña también reabre /admin.
  const vencida = await load({
    stored: session("admin"),
    routes: {
      "/api/admin/sesion": () => respond(401, { error: "not_authenticated" }),
      "/api/auth/refresh": () => respond(502, { error: "supabase_error", message: "Invalid Refresh Token: Refresh Token Not Found" }),
    },
  });
  vencida.storage(SESSION_KEY, JSON.stringify({ access_token: token("admin", { iat: 3 }), refresh_token: "nueva" }));
  assert.equal(vencida.page.reloads, 1, "volvió a entrar con la misma cuenta");
});

test("si los correos de prueba reciben un 403 con el panel abierto, se recarga como en el resto", async () => {
  const { created, page } = await load({
    hash: "#salud",
    stored: session("admin"),
    routes: {
      "/api/admin/sesion": () => respond(200, { email: "marcorojas@me.com" }),
      "/api/admin/salud": () => respond(200, { secretos: {}, variables: {}, planes: [], ia_incluida_pausada: false, correos: { configurado: true } }),
      "/api/admin/correo-prueba": () => respond(403, FORBIDDEN),
    },
  });
  const boton = created.find((node) => node.textContent === "Enviarme los correos de prueba");
  assert.ok(boton, "Salud arma el botón");
  assert.equal(page.reloads, 0);
  await boton.listeners.click[0]();
  assert.equal(page.reloads, 1);
});
