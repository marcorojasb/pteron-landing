/**
 * Prueba de humo contra `wrangler dev` real: lo que las pruebas unitarias no
 * pueden ver porque simulan el binding ASSETS. Cubre URLs limpias, la 404,
 * cabeceras, el fallback de /docs/:slug y, sobre todo, que una navegación del
 * navegador (Sec-Fetch-Mode: navigate) a /api/* y /docs/:slug llegue al Worker.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = 8700 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
if (!existsSync(wrangler)) {
  console.error("Falta wrangler en node_modules: ejecuta `npm ci` antes de `npm run smoke`.");
  process.exit(1);
}

const server = spawn(wrangler, ["dev", "--ip", "127.0.0.1", "--port", String(port), "--log-level", "error"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
});
let logs = "";
server.stdout.on("data", (chunk) => { logs += chunk; });
server.stderr.on("data", (chunk) => { logs += chunk; });

async function waitReady() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const res = await fetch(`${base}/`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // todavía arrancando
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`wrangler dev no respondió en ${base}\n${logs}`);
}

const failures = [];
async function expect(name, request, check) {
  const res = await fetch(`${base}${request.path}`, { method: request.method || "GET", headers: request.headers || {}, body: request.body, redirect: "manual" });
  const body = await res.text();
  const problem = check(res, body);
  if (problem) failures.push(`${name}: ${problem}`);
}
const status = (expected) => (res) => (res.status === expected ? null : `esperaba ${expected}, llegó ${res.status}`);
const redirectTo = (location) => (res) => {
  if (![301, 302, 307, 308].includes(res.status)) return `esperaba redirección, llegó ${res.status}`;
  const got = res.headers.get("location") || "";
  return got.endsWith(location) ? null : `redirige a ${got}, esperaba ${location}`;
};
const jsonError = (code, expectedStatus) => (res, body) => {
  if (res.status !== expectedStatus) return `esperaba ${expectedStatus}, llegó ${res.status}`;
  try {
    const parsed = JSON.parse(body);
    return parsed.error === code ? null : `error ${parsed.error}, esperaba ${code}`;
  } catch {
    return `cuerpo no JSON: ${body.slice(0, 80)}`;
  }
};
const navigate = { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", Accept: "text/html" };

try {
  await waitReady();
  await expect("home", { path: "/" }, (res, body) => (res.status === 200 && body.includes("<title>") ? null : `status ${res.status}`));
  await expect("planes limpio", { path: "/planes" }, status(200));
  await expect("planes con barra redirige", { path: "/planes/" }, redirectTo("/planes"));
  await expect("marca limpia", { path: "/marca" }, (res, body) => (res.status === 200 && body.includes("<h1>Marca</h1>") ? null : `status ${res.status}`));
  await expect("marca descargable", { path: "/assets/marca/pteron-azul.svg" }, (res) => (res.status === 200 && /svg/.test(res.headers.get("content-type") || "") ? null : `status ${res.status}`));
  await expect("html explícito redirige", { path: "/privacidad.html" }, redirectTo("/privacidad"));
  await expect("cuenta sin barra", { path: "/cuenta", headers: navigate }, status(200));
  await expect("404 propia", { path: "/no-existe", headers: navigate }, (res, body) => (res.status === 404 && body.includes("Página no encontrada") ? null : `status ${res.status}`));
  await expect("docs slug por navegación", { path: "/docs/instalar-macos", headers: navigate }, (res, body) => (res.status === 200 && body.includes("Documentación") ? null : `status ${res.status}`));
  await expect("docs slug con barra", { path: "/docs/instalar-macos/", headers: navigate }, redirectTo("/docs/instalar-macos"));
  await expect("docs archivo real", { path: "/docs/app.js" }, (res) => (res.status === 200 && /javascript/.test(res.headers.get("content-type") || "") ? null : `status ${res.status}`));
  await expect("docs datos", { path: "/docs/data/releases.json" }, status(200));
  await expect("cabeceras assets", { path: "/" }, (res) => (res.headers.get("x-frame-options") === "DENY" ? null : "falta X-Frame-Options"));
  await expect("caché immutable", { path: "/assets/favicon-v3-32.png" }, (res) => (/immutable/.test(res.headers.get("cache-control") || "") ? null : `cache-control ${res.headers.get("cache-control")}`));
  await expect("api desconocida", { path: "/api/nada" }, jsonError("not_found", 404));
  await expect("api desconocida por navegación", { path: "/api/nada", headers: navigate }, jsonError("not_found", 404));
  await expect("retorno de Flow por navegación", { path: "/api/billing/card-callback?intent=x", method: "POST", headers: { ...navigate, "content-type": "application/x-www-form-urlencoded" }, body: "token=abc" }, jsonError("checkout_expired", 410));
  await expect("api sin sesión", { path: "/api/account" }, jsonError("not_authenticated", 401));
  await expect("api con cabeceras de seguridad", { path: "/api/nada" }, (res) => (res.headers.get("x-frame-options") === "DENY" && res.headers.get("cache-control") === "no-store" ? null : "faltan cabeceras"));
  await expect("fuente no publicada", { path: "/wrangler.jsonc" }, status(404));
  await expect("migraciones no publicadas", { path: "/supabase/migrations/20260803120000_initial_billing_and_activation.sql" }, status(404));
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  server.kill("SIGTERM");
}

if (failures.length) {
  console.error(`Humo con ${failures.length} fallo(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Humo contra wrangler dev: todas las rutas responden como se espera.");
