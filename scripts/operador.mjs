/**
 * Piezas comunes de los scripts de operación (supabase-esquema, supabase-auth y
 * resend-dns). Sin dependencias, Node 22.
 *
 * Reglas que comparten:
 *  - Van en seco por omisión y sólo actúan con --aplicar.
 *  - Los tokens salen únicamente del entorno y no se imprimen, ni enteros ni en
 *    parte: toda línea de salida y todo mensaje de error pasan por `crearSalida`,
 *    que reemplaza el valor de cada secreto conocido.
 *  - Cada script exporta su función principal para probarla sin lanzar procesos.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Error esperado del operador: se imprime su mensaje, sin traza. */
export class ErrorOperador extends Error {
  constructor(mensaje, codigo = 1) {
    super(mensaje);
    this.name = "ErrorOperador";
    this.codigo = codigo;
  }
}

/** Banderas `--nombre`; cualquier otra cosa es un error de uso. */
export function leerArgumentos(argv, permitidas) {
  const banderas = new Set();
  for (const arg of argv) {
    if (!arg.startsWith("--") || !permitidas.includes(arg.slice(2))) {
      throw new ErrorOperador(`Argumento desconocido: ${arg.slice(0, 40)}. Admitidos: ${permitidas.map((p) => `--${p}`).join(", ")}.`, 2);
    }
    banderas.add(arg.slice(2));
  }
  return banderas;
}

/**
 * Banderas y opciones con valor (`--nombre valor` o `--nombre=valor`). Devuelve
 * { banderas: Set, valores: Map }. Lo demás es un error de uso, y el valor de
 * una opción no se repite en el mensaje.
 */
export function leerOpciones(argv, { banderas: permitidas = [], valores: conValor = [] } = {}) {
  const banderas = new Set();
  const valores = new Map();
  const admitidos = [...permitidas, ...conValor].map((p) => `--${p}`).join(", ");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const igual = arg.indexOf("=");
    const nombre = arg.startsWith("--") ? arg.slice(2, igual === -1 ? undefined : igual) : "";
    if (permitidas.includes(nombre) && igual === -1) {
      banderas.add(nombre);
    } else if (conValor.includes(nombre)) {
      const valor = igual === -1 ? argv[++i] : arg.slice(igual + 1);
      if (valor === undefined || valor === "" || valor.startsWith("--")) throw new ErrorOperador(`--${nombre} necesita un valor.`, 2);
      valores.set(nombre, valor);
    } else {
      throw new ErrorOperador(`Argumento desconocido: ${arg.slice(0, 40)}. Admitidos: ${admitidos}.`, 2);
    }
  }
  return { banderas, valores };
}

/**
 * Salida que nunca imprime un secreto. `secretos` son los valores del entorno
 * (token de Supabase, clave de Resend, token de Cloudflare); se reemplazan
 * donde aparezcan, también si un mensaje de error los repite.
 */
export function crearSalida(log, secretos) {
  const valores = secretos.filter((s) => typeof s === "string" && s.length >= 6);
  const redactar = (texto) => valores.reduce((t, v) => t.split(v).join("[oculto]"), String(texto));
  return {
    redactar,
    linea: (texto = "") => log(redactar(texto)),
  };
}

/** Quita comentarios `//` y `/* *\/` fuera de las cadenas y las comas finales. */
export function jsoncAObjeto(texto) {
  let salida = "";
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (c === '"') {
      let j = i + 1;
      while (j < texto.length && texto[j] !== '"') j += texto[j] === "\\" ? 2 : 1;
      salida += texto.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && texto[i + 1] === "/") {
      while (i < texto.length && texto[i] !== "\n") i++;
    } else if (c === "/" && texto[i + 1] === "*") {
      const fin = texto.indexOf("*/", i + 2);
      i = fin === -1 ? texto.length : fin + 2;
    } else {
      salida += c;
      i++;
    }
  }
  return JSON.parse(salida.replace(/,(\s*[}\]])/g, "$1"));
}

export function leerWrangler(raiz = RAIZ) {
  return jsoncAObjeto(readFileSync(path.join(raiz, "wrangler.jsonc"), "utf8"));
}

/** Referencia del proyecto: el subdominio de SUPABASE_URL (20 letras minúsculas). */
export function refDeSupabase(wrangler) {
  const url = wrangler?.vars?.SUPABASE_URL;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new ErrorOperador("wrangler.jsonc no tiene un SUPABASE_URL válido.");
  }
  const ref = host.split(".")[0];
  if (!/^[a-z]{20}$/.test(ref)) throw new ErrorOperador("El subdominio de SUPABASE_URL no es una referencia de proyecto de Supabase.");
  return ref;
}

/**
 * Remitente desde EMAIL_FROM de wrangler.jsonc: `Nombre <correo>` o sólo el
 * correo. Sin la variable, pteron@patagua.dev / pteron.
 */
export function leerRemitente(wrangler) {
  const crudo = String(wrangler?.vars?.EMAIL_FROM || "").trim();
  const conNombre = /^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/.exec(crudo);
  if (conNombre) return { correo: conNombre[2], nombre: conNombre[1].replace(/^"|"$/g, "").trim() || "pteron" };
  if (/^[^<>\s]+@[^<>\s]+$/.test(crudo)) return { correo: crudo, nombre: "pteron" };
  return { correo: "pteron@patagua.dev", nombre: "pteron" };
}

/** Texto corto y seguro de una respuesta de error de API. */
function detalleDeError(datos) {
  const candidato =
    datos?.message ||
    datos?.error?.message ||
    (typeof datos?.error === "string" ? datos.error : "") ||
    datos?.errors?.[0]?.message ||
    "";
  return typeof candidato === "string" ? candidato.replace(/\s+/g, " ").slice(0, 300) : "";
}

/**
 * Una llamada JSON. Devuelve { estado, datos }. Si la respuesta no es 2xx
 * lanza ErrorOperador con el estado y el mensaje de la API, sin cabeceras ni
 * cuerpo enviado (ahí van las credenciales).
 */
export async function pedir(fetchFn, nombre, url, { metodo = "GET", token, cuerpo, tolerar = [] } = {}) {
  const init = {
    method: metodo,
    headers: {
      Accept: "application/json",
      "User-Agent": "pteron-operador",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
    signal: AbortSignal.timeout(120_000),
  };
  let respuesta;
  try {
    respuesta = await fetchFn(url, init);
  } catch {
    throw new ErrorOperador(`${nombre}: no hubo respuesta de la red.`);
  }
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  if (!respuesta.ok && !tolerar.includes(respuesta.status)) {
    const detalle = detalleDeError(datos);
    throw new ErrorOperador(`${nombre}: respuesta ${respuesta.status}${detalle ? ` (${detalle})` : ""}.`);
  }
  return { estado: respuesta.status, datos };
}

/** Punto de entrada común: imprime el error esperado y devuelve el código de salida. */
export async function ejecutar(principal, opciones, salida) {
  try {
    return await principal(opciones);
  } catch (error) {
    const mensaje = error instanceof ErrorOperador ? error.message : "Falló de forma inesperada.";
    salida.linea(`Error: ${mensaje}`);
    return error instanceof ErrorOperador ? error.codigo : 1;
  }
}

/** ¿Este módulo es el que se lanzó desde la línea de comandos? */
export function esPrincipal(importMetaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}
