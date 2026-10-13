import { test } from "node:test";
import assert from "node:assert/strict";
import { jsoncAObjeto, leerWrangler, leerArgumentos, leerOpciones, refDeSupabase } from "../scripts/operador.mjs";
import { main, suscripcionesVivas, verificar } from "../scripts/supabase-esquema.mjs";

const TOKEN = "sbp_token_de_prueba_0123456789";
const REF = "abcdefghijklmnopqrst";
const WRANGLER = { vars: { SUPABASE_URL: `https://${REF}.supabase.co` } };

const PLANES_OK = [
  { id: "basic", monthly_price_clp: 2990, trial_period_days: 7, ai_units_limit: 6000000, trial_ai_units_limit: 1500000, for_sale: false },
  { id: "free", monthly_price_clp: 0, trial_period_days: 0, ai_units_limit: null, trial_ai_units_limit: null, for_sale: false },
  { id: "pro", monthly_price_clp: 9990, trial_period_days: 0, ai_units_limit: 30000000, trial_ai_units_limit: null, for_sale: false },
  { id: "tester", monthly_price_clp: 0, trial_period_days: 0, ai_units_limit: 6000000, trial_ai_units_limit: null, for_sale: false },
];

/**
 * Supabase simulado: responde por el texto de la consulta y apunta cada llamada.
 * `estado` permite cambiar lo que devuelve cada consulta.
 */
function simular(estado = {}) {
  const e = { existeTabla: true, datos: {}, vivas: [], planes: PLANES_OK, ajustes: [{ key: "included_ai_paused", value: false }], sinRls: [], cuentas: { cuentas: 5, perfiles: 5 }, ...estado };
  const llamadas = [];
  const fetch = async (url, init) => {
    const cuerpo = JSON.parse(init.body);
    llamadas.push({ url, metodo: init.method, auth: init.headers.Authorization, cuerpo });
    const q = cuerpo.query;
    let filas = [];
    if (q.includes("begin;")) filas = []; // el esquema entero
    else if (q.includes("to_regclass('public.' ||")) filas = e.existeTabla ? ["subscriptions", "licenses", "activation_intents", "usage_events", "ai_requests", "billing_events"].map((tabla) => ({ tabla })) : [];
    else if (q.startsWith("select exists(select 1 from public.")) filas = [{ hay: Boolean(e.datos[q.match(/public\.(\w+)\)/)[1]]) }];
    else if (q.startsWith("select to_regclass")) filas = [{ existe: e.existeTabla }];
    else if (q.includes("from public.subscriptions")) filas = e.vivas;
    else if (q.includes("from public.plan_catalog")) filas = e.planes;
    else if (q.includes("from public.app_settings")) filas = e.ajustes;
    else if (q.includes("pg_tables")) filas = e.sinRls;
    else if (q.includes("auth.users")) filas = [e.cuentas];
    else filas = [];
    return new Response(JSON.stringify(filas), { status: 201, headers: { "content-type": "application/json" } });
  };
  return { fetch, llamadas };
}

async function correr(argv, estado, extra = {}) {
  const sim = simular(estado);
  const lineas = [];
  const codigo = await main({ argv, env: { SUPABASE_ACCESS_TOKEN: TOKEN }, fetch: sim.fetch, log: (l) => lineas.push(l), wrangler: WRANGLER, ...extra });
  return { codigo, lineas, salida: lineas.join("\n"), llamadas: sim.llamadas };
}

const esquemaEjecutado = (llamadas) => llamadas.filter((l) => l.cuerpo.query.includes("begin;") && l.cuerpo.query.includes("commit;"));

test("el ensayo no ejecuta el esquema: sólo lee, con read_only", async () => {
  const r = await correr([]);
  assert.equal(r.codigo, 0);
  assert.equal(esquemaEjecutado(r.llamadas).length, 0);
  assert.ok(r.llamadas.length > 0 && r.llamadas.every((l) => l.cuerpo.read_only === true), "todas las llamadas del ensayo son de sólo lectura");
  assert.ok(r.llamadas.every((l) => l.url === `https://api.supabase.com/v1/projects/${REF}/database/query` && l.metodo === "POST"));
  assert.match(r.salida, /Ensayo/);
  assert.match(r.salida, /Suscripciones de Flow vivas: 0/);
  assert.match(r.salida, /Todo calza/);
});

test("--aplicar ejecuta supabase/esquema.sql entero en una sola llamada y luego verifica", async () => {
  const r = await correr(["--aplicar"]);
  assert.equal(r.codigo, 0);
  const llamadas = esquemaEjecutado(r.llamadas);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].cuerpo.read_only, undefined);
  assert.equal(llamadas[0].auth, `Bearer ${TOKEN}`);
  assert.match(llamadas[0].cuerpo.query, /create table|create or replace function/i);
  const despues = r.llamadas.slice(r.llamadas.indexOf(llamadas[0]) + 1);
  assert.equal(despues.length, 4, "las comprobaciones corren después del esquema");
  assert.match(r.salida, /Esquema ejecutado/);
  assert.match(r.salida, /basic 2990\/7\/6000000\/1500000 \(for_sale false\)/);
});

test("con suscripciones de Flow vivas se detiene sin tocar nada, también con --aplicar", async () => {
  const vivas = [{ user_id: "u1", provider_subscription_id: "sus_123", status: "active" }];
  for (const argv of [[], ["--aplicar"]]) {
    const r = await correr(argv, { vivas });
    assert.equal(r.codigo, 1);
    assert.equal(esquemaEjecutado(r.llamadas).length, 0);
    assert.match(r.salida, /Suscripciones de Flow vivas: 1/);
    assert.match(r.salida, /sus_123 \(active\)/);
    assert.match(r.salida, /--forzar/);
  }
});

test("--forzar sigue pese a las suscripciones vivas", async () => {
  const r = await correr(["--aplicar", "--forzar", "--borrar-datos"], { vivas: [{ user_id: "u1", provider_subscription_id: "sus_1", status: "trialing" }] });
  assert.equal(r.codigo, 0);
  assert.equal(esquemaEjecutado(r.llamadas).length, 1);
});

test("--aplicar se niega si hay datos y no toca nada; --borrar-datos lo permite", async () => {
  const datos = { subscriptions: true, billing_events: true };
  const ensayo = await correr([], { datos });
  assert.equal(ensayo.codigo, 0);
  assert.match(ensayo.salida, /Tablas con datos: subscriptions, billing_events/);
  assert.ok(ensayo.llamadas.every((l) => l.cuerpo.read_only === true));

  const negado = await correr(["--aplicar"], { datos });
  assert.equal(negado.codigo, 1);
  assert.equal(esquemaEjecutado(negado.llamadas).length, 0);
  assert.match(negado.salida, /--borrar-datos/);

  const forzado = await correr(["--aplicar", "--forzar"], { datos });
  assert.equal(forzado.codigo, 1, "--forzar sólo cubre las suscripciones vivas, no los datos");
  assert.equal(esquemaEjecutado(forzado.llamadas).length, 0);

  const permitido = await correr(["--aplicar", "--borrar-datos"], { datos });
  assert.equal(permitido.codigo, 0);
  assert.equal(esquemaEjecutado(permitido.llamadas).length, 1);
});

test("si la tabla subscriptions no existe cuenta como 0 y no la consulta", async () => {
  const sim = simular({ existeTabla: false });
  const vivas = await suscripcionesVivas({ fetch: sim.fetch, token: TOKEN, ref: REF });
  assert.deepEqual(vivas, []);
  assert.equal(sim.llamadas.length, 1);
  const r = await correr(["--aplicar"], { existeTabla: false });
  assert.equal(r.codigo, 0);
  assert.equal(esquemaEjecutado(r.llamadas).length, 1);
});

test("la verificación sale con código 1 y dice qué difiere", async () => {
  const planes = PLANES_OK.map((p) => (p.id === "basic" ? { ...p, monthly_price_clp: 3990 } : p));
  const r = await correr(["--verificar"], { planes, ajustes: [{ key: "included_ai_paused", value: true }], sinRls: [{ tablename: "x" }], cuentas: { cuentas: 6, perfiles: 5 } });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /DIFIERE: plan basic: esperado 2990\/7\/6000000\/1500000, hay 3990\//);
  assert.match(r.salida, /DIFIERE: included_ai_paused/);
  assert.match(r.salida, /DIFIERE: tablas sin RLS: x/);
  assert.match(r.salida, /DIFIERE: perfiles \(5\) no igualan a las cuentas \(6\)/);
  assert.equal(esquemaEjecutado(r.llamadas).length, 0);
});

test("la venta abierta (for_sale true) no hace fallar la verificación: se informa", async () => {
  const planes = PLANES_OK.map((p) => (p.id === "basic" || p.id === "pro" ? { ...p, for_sale: true } : p));
  const r = await correr(["--verificar"], { planes });
  assert.equal(r.codigo, 0);
  assert.match(r.salida, /basic 2990\/7\/6000000\/1500000 \(for_sale true\)/);
  assert.match(r.salida, /pro 9990\/0\/30000000\/ \(for_sale true\)/);
  assert.match(r.salida, /Todo calza con lo esperado/);
  assert.doesNotMatch(r.salida, /DIFIERE/);
  // Un precio distinto sigue fallando aunque la venta esté abierta
  const caro = await correr(["--verificar"], { planes: planes.map((p) => (p.id === "basic" ? { ...p, monthly_price_clp: 3990 } : p)) });
  assert.equal(caro.codigo, 1);
});

test("--aplicar sale con 1 si lo que queda no calza", async () => {
  const r = await correr(["--aplicar"], { planes: PLANES_OK.filter((p) => p.id !== "tester") });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /plan tester/);
});

test("verificar entiende los números como texto (bigint de Postgres)", async () => {
  const planes = PLANES_OK.map((p) => ({ ...p, ai_units_limit: p.ai_units_limit === null ? null : String(p.ai_units_limit) }));
  const sim = simular({ planes, cuentas: { cuentas: "5", perfiles: "5" } });
  const { diferencias } = await verificar({ fetch: sim.fetch, token: TOKEN, ref: REF });
  assert.deepEqual(diferencias, []);
});

test("ningún texto de salida contiene el token, ni en errores de la API", async () => {
  const lineas = [];
  const fetch = async () => new Response(JSON.stringify({ message: `token ${TOKEN} inválido` }), { status: 401 });
  const codigo = await main({ argv: ["--aplicar"], env: { SUPABASE_ACCESS_TOKEN: TOKEN }, fetch, log: (l) => lineas.push(l), wrangler: WRANGLER });
  assert.equal(codigo, 1);
  assert.match(lineas.join("\n"), /respuesta 401/);
  assert.ok(!lineas.join("\n").includes(TOKEN));
  assert.ok(!lineas.join("\n").includes(TOKEN.slice(0, 12)), "ni una parte");

  const ok = await correr(["--aplicar"]);
  assert.ok(!ok.salida.includes(TOKEN));
});

test("sin token, sin red y con argumentos desconocidos falla con mensaje y sin llamar", async () => {
  const lineas = [];
  let llamado = false;
  const fetch = async () => ((llamado = true), new Response("{}"));
  assert.equal(await main({ argv: [], env: {}, fetch, log: (l) => lineas.push(l), wrangler: WRANGLER }), 1);
  assert.match(lineas.join("\n"), /Falta SUPABASE_ACCESS_TOKEN/);
  assert.equal(await main({ argv: ["--borrar"], env: { SUPABASE_ACCESS_TOKEN: TOKEN }, fetch, log: (l) => lineas.push(l), wrangler: WRANGLER }), 2);
  assert.equal(llamado, false);
  const caido = await main({ argv: [], env: { SUPABASE_ACCESS_TOKEN: TOKEN }, fetch: async () => { throw new Error(`boom ${TOKEN}`); }, log: (l) => lineas.push(l), wrangler: WRANGLER });
  assert.equal(caido, 1);
  assert.ok(!lineas.join("\n").includes(TOKEN));
});

test("la referencia sale del subdominio de SUPABASE_URL en wrangler.jsonc", () => {
  const real = leerWrangler();
  assert.match(refDeSupabase(real), /^[a-z]{20}$/);
  assert.equal(refDeSupabase(WRANGLER), REF);
  assert.throws(() => refDeSupabase({ vars: { SUPABASE_URL: "https://fake.supabase.co" } }), /referencia/);
  assert.deepEqual(jsoncAObjeto('{ "a": "http://x", /* c */ "b": [1,], // fin\n}'), { a: "http://x", b: [1] });
});

test("leerArgumentos y leerOpciones rechazan lo desconocido", () => {
  assert.deepEqual([...leerArgumentos(["--aplicar"], ["aplicar"])], ["aplicar"]);
  assert.throws(() => leerArgumentos(["aplicar"], ["aplicar"]), /desconocido/);
  const { banderas, valores } = leerOpciones(["--smtp", "--limite-correos", "60"], { banderas: ["smtp"], valores: ["limite-correos"] });
  assert.ok(banderas.has("smtp"));
  assert.equal(valores.get("limite-correos"), "60");
  assert.equal(leerOpciones(["--limite-correos=7"], { valores: ["limite-correos"] }).valores.get("limite-correos"), "7");
  assert.throws(() => leerOpciones(["--limite-correos"], { valores: ["limite-correos"] }), /necesita un valor/);
  assert.throws(() => leerOpciones(["--limite-correos", "--smtp"], { banderas: ["smtp"], valores: ["limite-correos"] }), /necesita un valor/);
  assert.throws(() => leerOpciones(["--smtp=1"], { banderas: ["smtp"] }), /desconocido/);
});
