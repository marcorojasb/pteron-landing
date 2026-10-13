#!/usr/bin/env node
/**
 * Deja la configuración de Auth de pteron en Supabase con la API de
 * administración (GET y PATCH /v1/projects/{ref}/config/auth):
 *
 *  - site_url: https://pteron.patagua.dev/cuenta
 *  - uri_allow_list: lo que ya hay más esa dirección; nunca se quita una entrada.
 *  - Los correos en español de supabase/correos/ (asunto y HTML del enlace
 *    mágico y de la confirmación de correo, que son los que /auth/v1/otp con
 *    create_user envía a una cuenta existente y a una nueva).
 *  - rate_limit_email_sent: se deja como está; sólo cambia con --limite-correos N.
 *  - SMTP: NO se toca. Ya funciona con su propia clave de Resend. Sólo con
 *    --smtp (y RESEND_SMTP_KEY en el entorno) se vuelve a fijar: smtp.resend.com,
 *    465, usuario resend, esa clave y el remitente no-reply@patagua.dev / pteron.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-auth.mjs            # ensayo
 *   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-auth.mjs --aplicar
 *   ... --limite-correos 60      # cambia el límite de correos por hora
 *   RESEND_SMTP_KEY=... ... --smtp --aplicar
 *
 * Por omisión es un ensayo: lee la configuración, imprime sólo los campos que
 * no son secretos y el cambio previsto. Los tokens salen únicamente del entorno
 * y no se imprimen, ni en parte.
 *
 * Los nombres de los campos son los del OpenAPI de la API de administración
 * (https://api.supabase.com/api/v1-json, UpdateAuthConfigBody): site_url,
 * uri_allow_list (texto separado por comas), rate_limit_email_sent (entero),
 * mailer_subjects_magic_link, mailer_templates_magic_link_content,
 * mailer_subjects_confirmation, mailer_templates_confirmation_content y
 * smtp_host, smtp_port (texto), smtp_user, smtp_pass, smtp_admin_email,
 * smtp_sender_name.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, ErrorOperador, crearSalida, ejecutar, esPrincipal, leerOpciones, leerWrangler, pedir, refDeSupabase } from "./operador.mjs";

const API = "https://api.supabase.com/v1/projects";

export const SITE_URL = "https://pteron.patagua.dev/cuenta";

// El SMTP que se fija sólo con --smtp. El remitente es el de Supabase Auth, no
// el EMAIL_FROM del Worker (que usa su propia clave de Resend).
export const SMTP = {
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_admin_email: "no-reply@patagua.dev",
  smtp_sender_name: "pteron",
};

// Archivo → campos del correo en la API de administración.
export const PLANTILLAS = [
  { archivo: "enlace-magico.html", nombre: "enlace mágico", asunto: "mailer_subjects_magic_link", contenido: "mailer_templates_magic_link_content" },
  { archivo: "confirmacion.html", nombre: "confirmación de correo", asunto: "mailer_subjects_confirmation", contenido: "mailer_templates_confirmation_content" },
];

/**
 * Lee una plantilla de supabase/correos/: la primera línea es
 * `<!-- asunto: ... -->` y el resto es el HTML del correo.
 */
export function leerPlantilla(raiz, archivo) {
  const crudo = readFileSync(path.join(raiz, "supabase", "correos", archivo), "utf8");
  const m = /^\s*<!--\s*asunto:\s*(.+?)\s*-->\s*\n/.exec(crudo);
  if (!m) throw new ErrorOperador(`supabase/correos/${archivo} debe empezar con <!-- asunto: ... -->.`);
  const html = crudo.slice(m[0].length).trim();
  if (!html.includes("{{ .ConfirmationURL }}")) throw new ErrorOperador(`supabase/correos/${archivo} no usa {{ .ConfirmationURL }}.`);
  return { asunto: m[1], html };
}

/** { campo: valor } de todas las plantillas, listo para el PATCH. */
export function leerPlantillas(raiz = RAIZ) {
  const campos = {};
  for (const p of PLANTILLAS) {
    const { asunto, html } = leerPlantilla(raiz, p.archivo);
    campos[p.asunto] = asunto;
    campos[p.contenido] = html;
  }
  return campos;
}

/** Entradas de uri_allow_list (Supabase las guarda separadas por comas). */
export function entradasDeLista(lista) {
  return String(lista ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * La lista de URLs permitidas con `url` al final si faltaba. Las entradas que
 * ya había se conservan tal cual y en su orden; nunca se quita ninguna.
 */
export function fusionarLista(actual, url) {
  const entradas = entradasDeLista(actual);
  const agregar = !entradas.includes(url);
  return { lista: (agregar ? [...entradas, url] : entradas).join(","), agregar };
}

const mismo = (a, b) => String(a ?? "").replace(/\s+/g, " ").trim() === String(b ?? "").replace(/\s+/g, " ").trim();

/** Plantillas cuyo asunto o HTML difieren de los de la configuración. */
export function plantillasQueDifieren(config, deseadas) {
  return PLANTILLAS.filter((p) => !mismo(config?.[p.asunto], deseadas[p.asunto]) || !mismo(config?.[p.contenido], deseadas[p.contenido])).map((p) => p.nombre);
}

/** ¿Hay SMTP propio? Sólo mira si están los campos, no la clave. */
export const hayCorreoPropio = (config) => Boolean(config?.smtp_host && config?.smtp_user && config?.smtp_admin_email);

/**
 * El cambio previsto: { cuerpo, plan }. `cuerpo` es lo que iría en el PATCH
 * (sólo lo que difiere); `plan` son líneas para imprimir, sin secretos.
 */
export function planear(config, { plantillas, limiteCorreos, smtp, claveSmtp }) {
  const cuerpo = {};
  const plan = [];

  if (config.site_url !== SITE_URL) {
    cuerpo.site_url = SITE_URL;
    plan.push(`site_url: ${config.site_url || "(vacío)"} -> ${SITE_URL}`);
  } else {
    plan.push("site_url: ya es la deseada");
  }

  const { lista, agregar } = fusionarLista(config.uri_allow_list, SITE_URL);
  if (agregar) {
    cuerpo.uri_allow_list = lista;
    plan.push(`uri_allow_list: se agrega ${SITE_URL} (se conservan las ${entradasDeLista(config.uri_allow_list).length} que ya hay)`);
  } else {
    plan.push("uri_allow_list: ya incluye la dirección; sin cambios");
  }

  const difieren = plantillasQueDifieren(config, plantillas);
  for (const p of PLANTILLAS) {
    if (!difieren.includes(p.nombre)) continue;
    cuerpo[p.asunto] = plantillas[p.asunto];
    cuerpo[p.contenido] = plantillas[p.contenido];
    plan.push(`correo de ${p.nombre}: asunto «${plantillas[p.asunto]}» y HTML de supabase/correos/${p.archivo}`);
  }
  if (!difieren.length) plan.push("correos: ya son los de supabase/correos/");

  if (limiteCorreos === undefined) {
    plan.push(`rate_limit_email_sent: se deja en ${config.rate_limit_email_sent ?? "(sin dato)"}`);
  } else if (config.rate_limit_email_sent === limiteCorreos) {
    plan.push(`rate_limit_email_sent: ya es ${limiteCorreos}`);
  } else {
    cuerpo.rate_limit_email_sent = limiteCorreos;
    plan.push(`rate_limit_email_sent: ${config.rate_limit_email_sent ?? "(sin dato)"} -> ${limiteCorreos}`);
  }

  if (smtp) {
    Object.assign(cuerpo, SMTP, { smtp_pass: claveSmtp });
    plan.push(`SMTP: --smtp fija ${SMTP.smtp_host}:${SMTP.smtp_port}, usuario ${SMTP.smtp_user}, la clave de RESEND_SMTP_KEY y remitente ${SMTP.smtp_sender_name} <${SMTP.smtp_admin_email}>`);
  } else {
    plan.push("SMTP: sin tocar (ya funciona con su propia clave de Resend; sólo --smtp lo cambia)");
  }

  return { cuerpo, plan };
}

function imprimirConfiguracion(salida, config, deseadas) {
  const dif = plantillasQueDifieren(config, deseadas);
  salida.linea("Configuración actual de Auth (sólo campos que no son secretos):");
  salida.linea(`  site_url: ${config.site_url || "(vacío)"}`);
  salida.linea(`  uri_allow_list: ${entradasDeLista(config.uri_allow_list).join(" , ") || "(vacía)"}`);
  salida.linea(`  SMTP propio: ${hayCorreoPropio(config) ? "sí" : "no"}`);
  salida.linea(`  remitente: ${config.smtp_sender_name || "(sin nombre)"} <${config.smtp_admin_email || "sin correo"}>`);
  salida.linea(`  rate_limit_email_sent: ${config.rate_limit_email_sent ?? "(sin dato)"}`);
  salida.linea(`  correos que difieren de supabase/correos/: ${dif.length ? dif.join(", ") : "ninguno"}`);
}

/**
 * @param {{argv?: string[], env?: object, fetch?: typeof fetch, log?: (l: string) => void,
 *          wrangler?: object, raiz?: string}} [opciones]
 * @returns {Promise<number>} código de salida
 */
export async function main({ argv = process.argv.slice(2), env = process.env, fetch: fetchFn = fetch, log = console.log, wrangler, raiz = RAIZ } = {}) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  const claveSmtp = env.RESEND_SMTP_KEY;
  const salida = crearSalida(log, [token, claveSmtp]);
  return ejecutar(
    async () => {
      const { banderas, valores } = leerOpciones(argv, { banderas: ["aplicar", "smtp"], valores: ["limite-correos"] });
      if (!token) throw new ErrorOperador("Falta SUPABASE_ACCESS_TOKEN en el entorno (se crea en supabase.com/dashboard/account/tokens).");
      if (banderas.has("smtp") && !claveSmtp) throw new ErrorOperador("--smtp necesita RESEND_SMTP_KEY en el entorno (la clave de Resend propia de Supabase).");

      let limiteCorreos;
      if (valores.has("limite-correos")) {
        const crudo = valores.get("limite-correos");
        limiteCorreos = /^\d{1,10}$/.test(crudo) ? Number(crudo) : NaN;
        if (!(limiteCorreos >= 1 && limiteCorreos <= 2147483647)) throw new ErrorOperador("--limite-correos debe ser un entero entre 1 y 2147483647.", 2);
      }

      const plantillas = leerPlantillas(raiz);
      const ref = refDeSupabase(wrangler ?? leerWrangler(raiz));
      const url = `${API}/${ref}/config/auth`;
      salida.linea(`Proyecto de Supabase: ${ref}`);

      const { datos: config } = await pedir(fetchFn, "Supabase (config/auth)", url, { token });
      if (!config || typeof config !== "object") throw new ErrorOperador("Supabase (config/auth): la respuesta no trae la configuración.");
      imprimirConfiguracion(salida, config, plantillas);

      const { cuerpo, plan } = planear(config, { plantillas, limiteCorreos, smtp: banderas.has("smtp"), claveSmtp });
      salida.linea("Cambio previsto:");
      for (const linea of plan) salida.linea(`  ${linea}`);

      if (!Object.keys(cuerpo).length) {
        salida.linea("Nada que cambiar.");
        return 0;
      }
      if (!banderas.has("aplicar")) {
        salida.linea("Ensayo: no se cambió nada. Para aplicarlo: node scripts/supabase-auth.mjs --aplicar");
        return 0;
      }

      salida.linea(`Aplicando ${Object.keys(cuerpo).filter((k) => k !== "smtp_pass").length} campos...`);
      const { datos: nueva } = await pedir(fetchFn, "Supabase (config/auth)", url, { metodo: "PATCH", token, cuerpo });
      salida.linea("Configuración aplicada.");

      // Lo que Supabase devuelve debe calzar con lo pedido (sin comparar secretos).
      const faltas = [];
      if ("site_url" in cuerpo && nueva?.site_url !== SITE_URL) faltas.push("site_url");
      if ("uri_allow_list" in cuerpo && !entradasDeLista(nueva?.uri_allow_list).includes(SITE_URL)) faltas.push("uri_allow_list");
      if ("rate_limit_email_sent" in cuerpo && nueva?.rate_limit_email_sent !== limiteCorreos) faltas.push("rate_limit_email_sent");
      const enviadas = PLANTILLAS.filter((p) => p.asunto in cuerpo).map((p) => p.nombre);
      const sinCalzar = plantillasQueDifieren(nueva, plantillas).filter((n) => enviadas.includes(n));
      if (sinCalzar.length) faltas.push(`correos (${sinCalzar.join(", ")})`);
      if (faltas.length) {
        salida.linea(`DIFIERE tras aplicar: ${faltas.join(", ")}. Revísalo en Authentication del panel de Supabase.`);
        return 1;
      }
      salida.linea("Comprobado: la respuesta de Supabase calza con lo pedido.");
      return 0;
    },
    {},
    salida,
  );
}

if (esPrincipal(import.meta.url)) process.exitCode = await main();
