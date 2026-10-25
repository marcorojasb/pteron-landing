#!/usr/bin/env node
/**
 * Corre supabase/esquema.sql en el proyecto de Supabase de pteron con la API de
 * administración (POST /v1/projects/{ref}/database/query) y comprueba el
 * resultado con las consultas de LANZAR-BASIC.md, sección 1.
 *
 * Por omisión es un ensayo: sólo lee. Con --aplicar ejecuta el archivo entero en
 * una sola llamada (el archivo trae su propio begin/commit).
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-esquema.mjs            # ensayo
 *   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-esquema.mjs --aplicar
 *   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-esquema.mjs --verificar
 *
 * --forzar sigue aunque haya suscripciones de Flow vivas (el esquema las borra y
 * nada volvería a encontrarlas para cancelarlas en Flow).
 * --aplicar se niega si alguna tabla de datos ya tiene filas (suscripciones,
 * licencias, uso, eventos de cobro...): el esquema las borra. Sólo --borrar-datos
 * lo permite, y es para un proyecto que se quiere vaciar a propósito.
 * --verificar no cambia nada: sólo corre las comprobaciones.
 *
 * El proyecto es el subdominio de SUPABASE_URL en wrangler.jsonc. El token
 * (SUPABASE_ACCESS_TOKEN, de supabase.com/dashboard/account/tokens) sólo se lee
 * del entorno y nunca se imprime.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, ErrorOperador, crearSalida, ejecutar, esPrincipal, leerArgumentos, leerWrangler, pedir, refDeSupabase } from "./operador.mjs";

const API = "https://api.supabase.com/v1/projects";

// Las mismas consultas que LANZAR-BASIC.md, sección 1.
const SQL_EXISTE_SUSCRIPCIONES = "select to_regclass('public.subscriptions') is not null as existe";
const SQL_SUSCRIPCIONES_VIVAS = `select user_id, provider_subscription_id, status
from public.subscriptions
where provider = 'flow' and status in ('incomplete', 'trialing', 'active', 'past_due', 'paused')`;
// Tablas cuyo contenido borra el esquema y no se recrea solo (el catálogo y
// app_settings se siembran de nuevo, por eso no cuentan).
const TABLAS_CON_DATOS = ["subscriptions", "licenses", "activation_intents", "usage_events", "ai_requests", "billing_events"];
const SQL_TABLAS_EXISTENTES = `select t.tabla from (values ${TABLAS_CON_DATOS.map((t) => `('${t}')`).join(", ")}) as t(tabla)
where to_regclass('public.' || t.tabla) is not null`;
const sqlHayFilas = (tabla) => `select exists(select 1 from public.${tabla}) as hay`;
const SQL_PLANES = `select id, monthly_price_clp, trial_period_days, ai_units_limit, trial_ai_units_limit, for_sale
from public.plan_catalog order by id`;
const SQL_AJUSTES = "select key, value from public.app_settings";
const SQL_SIN_RLS = "select tablename from pg_tables where schemaname = 'public' and not rowsecurity";
const SQL_CUENTAS = `select (select count(*) from auth.users) as cuentas, (select count(*) from public.profiles) as perfiles`;
// Lo que el navegador nunca debe poder tocar, aunque alguien agregue una política por error: las tablas sólo del
// servidor (esquema.sql les quita los permisos de anon y authenticated) y las funciones SECURITY DEFINER, que saltan
// RLS (esquema.sql les quita EXECUTE). Las dos consultas deben volver vacías.
export const TABLAS_DEL_SERVIDOR = ["billing_customers", "app_settings", "ai_requests", "billing_events", "billing_checkout_intents"];
// Cualquier permiso de tabla o de columna cuenta: un `grant select (columna)` abre filas igual que uno de tabla
const PERMISOS_DE_TABLA = "SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER";
const SQL_TABLAS_ABIERTAS = `select c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (${TABLAS_DEL_SERVIDOR.map((t) => `'${t}'`).join(", ")})
  and (${["anon", "authenticated"].map((rol) => `has_table_privilege('${rol}', c.oid, '${PERMISOS_DE_TABLA}') or has_any_column_privilege('${rol}', c.oid, 'SELECT,INSERT,UPDATE')`).join("\n    or ")})`;
// Lo que sí debe quedar abierto: sin leer plan_catalog, GET /api/plans no sabe qué plan se vende y /planes no lo ofrece
const SQL_CATALOGO_PUBLICO = "select has_table_privilege('anon', 'public.plan_catalog', 'SELECT') as anon_lee_catalogo";
const SQL_FUNCIONES_ABIERTAS = `select p.oid::regprocedure::text as funcion from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`;

// Lo que debe quedar: id → [precio, días de prueba, unidades, unidades de prueba]. `for_sale` no se exige: el
// esquema siembra false, pero al abrir la venta es true y --verificar sólo lo informa.
const PLANES_ESPERADOS = {
  basic: [2990, 7, 6_000_000, 1_500_000],
  pro: [9990, 0, 30_000_000, null],
};
const UNIDADES_TESTER = 6_000_000;

/** Corre SQL en el proyecto. Devuelve las filas (la API responde un arreglo de objetos). */
async function consulta(contexto, sql, { soloLectura }) {
  const { datos } = await pedir(contexto.fetch, "Supabase (database/query)", `${API}/${contexto.ref}/database/query`, {
    metodo: "POST",
    token: contexto.token,
    cuerpo: { query: sql, ...(soloLectura ? { read_only: true } : {}) },
  });
  if (Array.isArray(datos)) return datos;
  if (Array.isArray(datos?.result)) return datos.result;
  return [];
}

/** Suscripciones de Flow que siguen cobrando. Sin la tabla, no hay ninguna. */
export async function suscripcionesVivas(contexto) {
  const existe = await consulta(contexto, SQL_EXISTE_SUSCRIPCIONES, { soloLectura: true });
  if (existe[0]?.existe !== true) return [];
  return consulta(contexto, SQL_SUSCRIPCIONES_VIVAS, { soloLectura: true });
}

/** Tablas de datos que ya tienen filas (las que el esquema borraría). Sin la tabla, no cuenta. */
export async function tablasConDatos(contexto) {
  const existentes = await consulta(contexto, SQL_TABLAS_EXISTENTES, { soloLectura: true });
  const con = [];
  for (const { tabla } of existentes) {
    if (!TABLAS_CON_DATOS.includes(tabla)) continue;
    const [fila] = await consulta(contexto, sqlHayFilas(tabla), { soloLectura: true });
    if (fila?.hay === true) con.push(tabla);
  }
  return con;
}

const num = (valor) => (valor === null || valor === undefined ? null : Number(valor));

/**
 * Corre las comprobaciones de la sección 1.2. Devuelve { resumen, diferencias }:
 * `diferencias` vacío significa que todo calza.
 */
export async function verificar(contexto) {
  const diferencias = [];
  const resumen = [];

  const planes = await consulta(contexto, SQL_PLANES, { soloLectura: true });
  const porId = Object.fromEntries(planes.map((p) => [p.id, p]));
  for (const [id, esperado] of Object.entries(PLANES_ESPERADOS)) {
    const p = porId[id];
    const real = p ? [num(p.monthly_price_clp), num(p.trial_period_days), num(p.ai_units_limit), num(p.trial_ai_units_limit)] : null;
    resumen.push(`${id} ${real ? `${real.join("/")} (for_sale ${p.for_sale === true})` : "(no existe)"}`);
    if (!real || real.some((v, i) => v !== esperado[i])) {
      diferencias.push(`plan ${id}: esperado ${esperado.join("/")}, hay ${real ? real.join("/") : "nada"}`);
    }
  }
  const tester = num(porId.tester?.ai_units_limit);
  resumen.push(`tester ${tester ?? "(no existe)"}`);
  if (tester !== UNIDADES_TESTER) diferencias.push(`plan tester: esperado ${UNIDADES_TESTER} unidades, hay ${tester ?? "nada"}`);

  const ajustes = await consulta(contexto, SQL_AJUSTES, { soloLectura: true });
  const pausa = ajustes.find((a) => a.key === "included_ai_paused")?.value;
  const pausada = pausa === true || pausa === "true";
  resumen.push(`included_ai_paused ${pausa === undefined ? "(falta)" : pausada}`);
  if (pausa === undefined || pausada) diferencias.push(`included_ai_paused: esperado false, hay ${pausa === undefined ? "nada" : String(pausa)}`);

  const sinRls = await consulta(contexto, SQL_SIN_RLS, { soloLectura: true });
  resumen.push(`tablas sin RLS ${sinRls.length}`);
  if (sinRls.length) diferencias.push(`tablas sin RLS: ${sinRls.map((t) => t.tablename).join(", ")}`);

  const tablasAbiertas = await consulta(contexto, SQL_TABLAS_ABIERTAS, { soloLectura: true });
  resumen.push(`tablas del servidor abiertas ${tablasAbiertas.length}`);
  if (tablasAbiertas.length) diferencias.push(`anon o authenticated tienen permisos en tablas del servidor: ${tablasAbiertas.map((t) => t.tabla).join(", ")}`);

  const [catalogo] = await consulta(contexto, SQL_CATALOGO_PUBLICO, { soloLectura: true });
  const leeCatalogo = catalogo?.anon_lee_catalogo === true || catalogo?.anon_lee_catalogo === "true";
  resumen.push(`anon lee el catálogo ${leeCatalogo}`);
  if (!leeCatalogo) diferencias.push("anon no puede leer plan_catalog: GET /api/plans no sabría qué plan se vende y /planes no ofrecería ninguno");

  const funcionesAbiertas = await consulta(contexto, SQL_FUNCIONES_ABIERTAS, { soloLectura: true });
  resumen.push(`funciones SECURITY DEFINER abiertas ${funcionesAbiertas.length}`);
  if (funcionesAbiertas.length) diferencias.push(`anon o authenticated pueden ejecutar: ${funcionesAbiertas.map((f) => f.funcion).join(", ")}`);

  const [conteo] = await consulta(contexto, SQL_CUENTAS, { soloLectura: true });
  const cuentas = num(conteo?.cuentas);
  const perfiles = num(conteo?.perfiles);
  resumen.push(`cuentas ${cuentas} / perfiles ${perfiles}`);
  if (cuentas === null || cuentas !== perfiles) diferencias.push(`perfiles (${perfiles}) no igualan a las cuentas (${cuentas})`);

  return { resumen, diferencias };
}

function imprimirVerificacion(salida, { resumen, diferencias }) {
  salida.linea("Comprobación:");
  salida.linea(`  ${resumen.join(" · ")}`);
  if (diferencias.length) {
    for (const d of diferencias) salida.linea(`  DIFIERE: ${d}`);
    return 1;
  }
  salida.linea("  Todo calza con lo esperado.");
  return 0;
}

/**
 * @param {{argv?: string[], env?: object, fetch?: typeof fetch, log?: (l: string) => void,
 *          wrangler?: object, raiz?: string}} [opciones]
 * @returns {Promise<number>} código de salida
 */
export async function main({ argv = process.argv.slice(2), env = process.env, fetch: fetchFn = fetch, log = console.log, wrangler, raiz = RAIZ } = {}) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  const salida = crearSalida(log, [token]);
  return ejecutar(
    async () => {
      const banderas = leerArgumentos(argv, ["aplicar", "forzar", "verificar", "borrar-datos"]);
      if (!token) throw new ErrorOperador("Falta SUPABASE_ACCESS_TOKEN en el entorno (se crea en supabase.com/dashboard/account/tokens).");
      const ref = refDeSupabase(wrangler ?? leerWrangler(raiz));
      const contexto = { fetch: fetchFn, token, ref };
      salida.linea(`Proyecto de Supabase: ${ref}`);

      if (banderas.has("verificar")) {
        return imprimirVerificacion(salida, await verificar(contexto));
      }

      const vivas = await suscripcionesVivas(contexto);
      if (vivas.length) {
        salida.linea(`Suscripciones de Flow vivas: ${vivas.length}. Flow las sigue cobrando y, después del esquema, nada las encuentra para cancelarlas:`);
        for (const s of vivas) salida.linea(`  - ${s.provider_subscription_id ?? "(sin id de Flow)"} (${s.status})`);
        if (!banderas.has("forzar")) {
          salida.linea("Cancélalas en el panel de Flow y vuelve a correr, o usa --forzar si ya sabes lo que haces. No se cambió nada.");
          return 1;
        }
        salida.linea("--forzar: se sigue de todos modos.");
      } else {
        salida.linea("Suscripciones de Flow vivas: 0.");
      }

      const conDatos = await tablasConDatos(contexto);
      if (conDatos.length) {
        salida.linea(`Tablas con datos: ${conDatos.join(", ")}. El esquema las borra y no se pueden recuperar.`);
        if (banderas.has("aplicar") && !banderas.has("borrar-datos")) {
          salida.linea("No se cambió nada. Este proyecto ya está en uso: para rehacerlo desde cero a propósito, usa --borrar-datos.");
          return 1;
        }
      } else {
        salida.linea("Tablas con datos: ninguna.");
      }

      const archivo = path.join(raiz, "supabase", "esquema.sql");
      const sql = readFileSync(archivo, "utf8");
      if (!sql.trim()) throw new ErrorOperador("supabase/esquema.sql está vacío.");
      const lineas = sql.split("\n").length;

      if (!banderas.has("aplicar")) {
        salida.linea(`Ensayo: se ejecutaría supabase/esquema.sql (${lineas} líneas) entero, en una llamada. Borra todos los datos de pteron.`);
        salida.linea("Para ejecutarlo: node scripts/supabase-esquema.mjs --aplicar");
        // Sólo informa: el ensayo no falla porque el estado actual difiera.
        try {
          salida.linea("Estado actual (sólo lectura):");
          imprimirVerificacion(salida, await verificar(contexto));
        } catch (error) {
          if (!(error instanceof ErrorOperador)) throw error;
          salida.linea(`  No se pudo leer el estado actual: ${error.message}`);
        }
        return 0;
      }

      salida.linea(`Ejecutando supabase/esquema.sql (${lineas} líneas)...`);
      await consulta(contexto, sql, { soloLectura: false });
      salida.linea("Esquema ejecutado.");
      return imprimirVerificacion(salida, await verificar(contexto));
    },
    {},
    salida,
  );
}

if (esPrincipal(import.meta.url)) process.exitCode = await main();
