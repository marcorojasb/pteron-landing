#!/usr/bin/env node
/**
 * Comprueba (y, con --aplicar, completa) el dominio patagua.dev de Resend y sus
 * registros DNS en Cloudflare, para que los correos del Worker salgan firmados.
 *
 *   RESEND_API_KEY=... CLOUDFLARE_API_TOKEN=... node scripts/resend-dns.mjs            # ensayo
 *   RESEND_API_KEY=... CLOUDFLARE_API_TOKEN=... node scripts/resend-dns.mjs --aplicar
 *
 * Qué hace:
 *  1. Busca el dominio en Resend (GET /domains). Si no existe, el ensayo lo
 *     avisa y --aplicar lo crea (POST /domains).
 *  2. Lee sus registros (GET /domains/{id}): SPF, DKIM, etc.
 *  3. Con CLOUDFLARE_API_TOKEN busca la zona (GET /zones?name=...) y lee sus
 *     registros DNS (GET /zones/{id}/dns_records).
 *  4. Compara. Cada registro de Resend queda como: ya está, falta o conflicto
 *     (por ejemplo otro SPF en el mismo nombre). Nunca se modifica ni se borra un
 *     registro existente, y nunca se crea uno que choque con otro.
 *  5. Con --aplicar crea los que faltan (POST /zones/{id}/dns_records, sin proxy)
 *     y pide a Resend que verifique (POST /domains/{id}/verify). Imprime el
 *     estado de cada registro.
 *
 * Los tokens salen sólo del entorno y no se imprimen, ni en parte. El código de
 * salida es 1 si hay conflictos o un error, 0 si no.
 *
 * Documentación: resend.com/docs/api-reference/domains/{create,get,list,verify}-domain
 * y developers.cloudflare.com/api (zones, dns_records).
 */
import { ErrorOperador, crearSalida, ejecutar, esPrincipal, leerArgumentos, pedir } from "./operador.mjs";

const RESEND = "https://api.resend.com";
const CLOUDFLARE = "https://api.cloudflare.com/client/v4";
export const DOMINIO = "patagua.dev";

/** Nombre completo en minúsculas, sin punto final: "send" -> "send.patagua.dev". */
export function nombreCompleto(nombre, dominio = DOMINIO) {
  const n = String(nombre ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!n || n === "@" || n === dominio) return dominio;
  return n.endsWith(`.${dominio}`) ? n : `${n}.${dominio}`;
}

/** Contenido sin comillas: `"a" "b"` y `ab` son el mismo TXT. */
export function limpiarContenido(tipo, valor) {
  let v = String(valor ?? "").trim();
  if (tipo === "TXT") {
    if (/^"/.test(v)) v = [...v.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("");
    return v;
  }
  return v.toLowerCase().replace(/\.$/, "");
}

/** Registro de Resend en la forma que compara y crea Cloudflare. */
export function normalizarRegistroResend(r, dominio = DOMINIO) {
  const tipo = String(r.type || "").toUpperCase();
  return {
    etiqueta: r.record || tipo,
    tipo,
    nombre: nombreCompleto(r.name, dominio),
    contenido: limpiarContenido(tipo, r.value),
    prioridad: tipo === "MX" ? Number(r.priority ?? 10) : undefined,
    estadoResend: r.status || "desconocido",
  };
}

const esSpf = (c) => /^v=spf1(\s|$)/i.test(c);
const esDkim = (c) => /^(v=dkim1|k=rsa|p=)/i.test(c);

/**
 * Compara un registro que Resend pide con los del mismo nombre en Cloudflare.
 * Devuelve { estado: "ok" | "falta" | "conflicto", motivo? }.
 */
export function compararRegistro(esperado, existentes) {
  const mismoNombre = existentes.filter((e) => nombreCompleto(e.name) === esperado.nombre);
  const mismoTipo = mismoNombre.filter((e) => String(e.type).toUpperCase() === esperado.tipo);
  const igual = mismoTipo.find(
    (e) => limpiarContenido(esperado.tipo, e.content) === esperado.contenido && (esperado.tipo !== "MX" || Number(e.priority) === esperado.prioridad),
  );
  if (igual) return { estado: "ok" };

  if (esperado.tipo === "CNAME") {
    // Un CNAME no convive con ningún otro registro del mismo nombre.
    if (mismoNombre.length) return { estado: "conflicto", motivo: `ya hay ${mismoNombre.map((e) => e.type).join("/")} en ${esperado.nombre}` };
  } else if (mismoNombre.some((e) => String(e.type).toUpperCase() === "CNAME")) {
    return { estado: "conflicto", motivo: `hay un CNAME en ${esperado.nombre}` };
  } else if (esperado.tipo === "MX") {
    const otro = mismoTipo[0];
    if (otro) return { estado: "conflicto", motivo: `ya hay otro MX en ${esperado.nombre} (${limpiarContenido("MX", otro.content)}, prioridad ${otro.priority})` };
  } else if (esperado.tipo === "TXT") {
    const otros = mismoTipo.map((e) => limpiarContenido("TXT", e.content));
    if (esSpf(esperado.contenido) && otros.some(esSpf)) return { estado: "conflicto", motivo: `ya hay otro SPF en ${esperado.nombre}` };
    if (esDkim(esperado.contenido) && otros.some(esDkim)) return { estado: "conflicto", motivo: `ya hay otra clave DKIM distinta en ${esperado.nombre}` };
  } else if (mismoTipo.length) {
    return { estado: "conflicto", motivo: `ya hay un ${esperado.tipo} distinto en ${esperado.nombre}` };
  }
  return { estado: "falta" };
}

/** Cuerpo de POST /zones/{id}/dns_records. Nunca con proxy; TTL 1 es «automático». */
export function cuerpoRegistroCloudflare(r) {
  return {
    type: r.tipo,
    name: r.nombre,
    content: r.contenido,
    ttl: 1,
    proxied: false,
    ...(r.tipo === "MX" ? { priority: r.prioridad } : {}),
    comment: "Resend (scripts/resend-dns.mjs)",
  };
}

const esperar = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * @param {{argv?: string[], env?: object, fetch?: typeof fetch, log?: (l: string) => void,
 *          pausa?: number}} [opciones]  `pausa`: ms entre llamadas a Resend (límite de 2 por segundo).
 * @returns {Promise<number>} código de salida
 */
export async function main({ argv = process.argv.slice(2), env = process.env, fetch: fetchFn = fetch, log = console.log, pausa = 600 } = {}) {
  const claveResend = env.RESEND_API_KEY;
  const tokenCloudflare = env.CLOUDFLARE_API_TOKEN;
  const salida = crearSalida(log, [claveResend, tokenCloudflare]);
  return ejecutar(
    async () => {
      const banderas = leerArgumentos(argv, ["aplicar"]);
      const aplicar = banderas.has("aplicar");
      if (!claveResend) throw new ErrorOperador("Falta RESEND_API_KEY en el entorno (la clave de Resend con acceso a dominios).");
      if (aplicar && !tokenCloudflare) throw new ErrorOperador("--aplicar necesita CLOUDFLARE_API_TOKEN en el entorno (permiso Zone › DNS › Edit sobre la zona).");

      let llamadas = 0;
      const resend = async (nombre, ruta, opciones = {}) => {
        if (llamadas++) await esperar(pausa);
        return pedir(fetchFn, `Resend (${nombre})`, `${RESEND}${ruta}`, { token: claveResend, ...opciones });
      };
      const cloudflare = async (nombre, ruta, opciones = {}) => {
        const r = await pedir(fetchFn, `Cloudflare (${nombre})`, `${CLOUDFLARE}${ruta}`, { token: tokenCloudflare, ...opciones });
        if (r.datos?.success === false) throw new ErrorOperador(`Cloudflare (${nombre}): la API respondió con error.`);
        return r;
      };

      salida.linea(`Dominio: ${DOMINIO}`);

      // 1. El dominio en Resend.
      const { datos: lista } = await resend("listar dominios", "/domains");
      let dominio = (Array.isArray(lista?.data) ? lista.data : []).find((d) => String(d.name).toLowerCase() === DOMINIO);
      if (!dominio) {
        if (!aplicar) {
          salida.linea(`Resend: ${DOMINIO} no está. Ensayo: --aplicar lo crearía (POST /domains) y luego compararía sus registros con Cloudflare.`);
          return 0;
        }
        const { datos } = await resend("crear dominio", "/domains", { metodo: "POST", cuerpo: { name: DOMINIO } });
        if (!datos?.id) throw new ErrorOperador("Resend (crear dominio): la respuesta no trae el id del dominio.");
        dominio = datos;
        salida.linea("Resend: dominio creado.");
      } else {
        salida.linea(`Resend: ${DOMINIO} existe, estado ${dominio.status ?? "desconocido"}.`);
      }

      // 2. Sus registros.
      let { datos: detalle } = await resend("leer dominio", `/domains/${encodeURIComponent(dominio.id)}`);
      const esperados = (Array.isArray(detalle?.records) ? detalle.records : []).map((r) => normalizarRegistroResend(r));
      if (!esperados.length) throw new ErrorOperador("Resend (leer dominio): el dominio no trae registros DNS.");

      // 3. Cloudflare.
      if (!tokenCloudflare) {
        salida.linea("Sin CLOUDFLARE_API_TOKEN: no se compara con Cloudflare. Registros que pide Resend:");
        for (const r of esperados) salida.linea(`  ${r.etiqueta} ${r.tipo} ${r.nombre}${r.prioridad !== undefined ? ` (prioridad ${r.prioridad})` : ""} · Resend: ${r.estadoResend}`);
        return 0;
      }
      const { datos: zonas } = await cloudflare("buscar zona", `/zones?name=${encodeURIComponent(DOMINIO)}`);
      const zona = (Array.isArray(zonas?.result) ? zonas.result : []).find((z) => String(z.name).toLowerCase() === DOMINIO);
      if (!zona?.id) throw new ErrorOperador(`Cloudflare: no hay una zona ${DOMINIO} visible para este token.`);

      const existentes = [];
      for (let pagina = 1, total = 1; pagina <= total && pagina <= 50; pagina++) {
        const { datos } = await cloudflare("leer DNS", `/zones/${encodeURIComponent(zona.id)}/dns_records?per_page=1000&page=${pagina}`);
        existentes.push(...(Array.isArray(datos?.result) ? datos.result : []));
        total = Number(datos?.result_info?.total_pages) || 1;
      }
      salida.linea(`Cloudflare: zona ${DOMINIO}, ${existentes.length} registros.`);

      // 4. Comparar.
      const filas = esperados.map((r) => ({ r, ...compararRegistro(r, existentes) }));
      const faltan = filas.filter((f) => f.estado === "falta");
      const conflictos = filas.filter((f) => f.estado === "conflicto");

      // 5. Crear lo que falta (nunca lo que choca).
      let creados = 0;
      if (aplicar) {
        for (const f of faltan) {
          await cloudflare(`crear ${f.r.tipo} ${f.r.nombre}`, `/zones/${encodeURIComponent(zona.id)}/dns_records`, { metodo: "POST", cuerpo: cuerpoRegistroCloudflare(f.r) });
          f.estado = "creado";
          creados++;
        }
        if (creados || detalle?.status !== "verified") {
          await resend("verificar dominio", `/domains/${encodeURIComponent(dominio.id)}/verify`, { metodo: "POST", cuerpo: {} });
          salida.linea("Resend: verificación pedida (corre aparte; puede tardar).");
          ({ datos: detalle } = await resend("leer dominio", `/domains/${encodeURIComponent(dominio.id)}`));
        }
      }

      const estadoResend = new Map((Array.isArray(detalle?.records) ? detalle.records : []).map((r) => [`${String(r.type).toUpperCase()} ${nombreCompleto(r.name)}`, r.status]));
      salida.linea("Registros:");
      for (const f of filas) {
        const etiqueta = { ok: "ya está", falta: aplicar ? "falta" : "falta (se crearía)", creado: "creado", conflicto: "CONFLICTO" }[f.estado];
        const enResend = estadoResend.get(`${f.r.tipo} ${f.r.nombre}`) ?? f.r.estadoResend;
        salida.linea(`  ${f.r.etiqueta} ${f.r.tipo} ${f.r.nombre}: ${etiqueta} · Resend: ${enResend}${f.motivo ? ` · ${f.motivo}` : ""}`);
      }
      if (conflictos.length) {
        salida.linea(`${conflictos.length} conflicto(s): no se tocó ningún registro existente ni se creó el que choca. Resuélvelos a mano en Cloudflare.`);
      }
      if (!aplicar && faltan.length) salida.linea(`Ensayo: faltan ${faltan.length} registro(s). Para crearlos: node scripts/resend-dns.mjs --aplicar`);
      if (aplicar) salida.linea(`Creados: ${creados}. Estado del dominio en Resend: ${detalle?.status ?? "desconocido"}.`);
      else if (!faltan.length && !conflictos.length) salida.linea(`Todo en orden. Estado del dominio en Resend: ${detalle?.status ?? dominio.status ?? "desconocido"}.`);
      return conflictos.length ? 1 : 0;
    },
    {},
    salida,
  );
}

if (esPrincipal(import.meta.url)) process.exitCode = await main();
