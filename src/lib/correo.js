import { HttpError } from "./http.js";
import { componerCorreo, documentoTerminos } from "./correo-textos.js";
import { TERMS_VERSION } from "./terms.js";

/**
 * Correos al cliente por la API HTTP de Resend. Apagados hasta que todo esté
 * configurado: RESEND_API_KEY (secreto) + EMAIL_FROM + los cuatro datos del
 * vendedor (SELLER_NAME, SELLER_RUT, SELLER_ADDRESS, SELLER_EMAIL, que la ley de
 * consumo pide decir a quien contrata; LEGAL-PENDIENTE.md, punto 1). Si falta
 * algo no se envía nada y queda un evento `<tipo>_email_skipped` con los
 * nombres que faltan. SELLER_REPRESENTATIVE (representante legal de una
 * persona jurídica) es opcional y no detiene el envío: una persona natural no
 * tiene.
 *
 * Enviar nunca cambia el resultado de cobrar: ninguna función de aquí lanza.
 * Todo devuelve un resultado tipado y el error, si lo hay, queda en el evento
 * como código, sin direcciones ni texto del proveedor.
 *
 * Tipos (también los event_type de billing_events, con el sufijo _email):
 * - purchase: confirmación de compra, una vez por suscripción (art. 12 A de la
 *   Ley 19.496), cuando se anota la suscripción.
 * - trial_ending: aviso a quien termina su prueba en menos de 48 horas.
 * - cancellation: confirmación de «Cancelar renovación».
 *
 * `enviarCorreosDePrueba` manda los tres, con datos de ejemplo y un asunto con
 * «[Prueba] », sólo a quien administra, para ver el envío de punta a punta sin
 * una compra: no toca la base ni los eventos de los correos reales.
 */

const RESEND_URL = "https://api.resend.com/emails";
const REQUERIDOS = ["RESEND_API_KEY", "EMAIL_FROM", "SELLER_NAME", "SELLER_RUT", "SELLER_ADDRESS", "SELLER_EMAIL"];
export const TIPOS = ["purchase", "trial_ending", "cancellation"];

const HORA = 3_600_000;
const DIA = 24 * HORA;
// Un fallo se reintenta en el Cron durante tres días, hasta 20 por corrida.
const VIDA_REINTENTOS = 3 * DIA;
const LIMITE_REINTENTOS = 20;
// Un evento que sigue en `received` pasada media hora murió con el Worker a
// medio envío; se reenvía con la misma Idempotency-Key.
const ESPERA_RECIBIDO = 30 * 60_000;
const VENTANA_FIN_DE_PRUEBA = 48 * HORA;
const LIMITE_AVISOS = 100;
// Ids de evento por consulta al buscar los ya atendidos (recuperarSinEvento).
const TANDA_EVENTOS = 50;
const CAMPOS_SUSCRIPCION = "id,user_id,plan_id,provider,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,terms_version";
const CAMPOS_PLAN = "id,display_name,monthly_price_clp,trial_period_days,ai_units_limit,trial_ai_units_limit";
const SITIO = "https://pteron.patagua.dev";

const eventoDe = (tipo) => `${tipo}_email`;
const idDeEvento = (tipo, suscripcion) => `email:${tipo}:${suscripcion}`;
const codificar = encodeURIComponent;

const baseDe = (env) => String(env?.PUBLIC_SITE_URL || "").trim().replace(/\/$/, "") || SITIO;

/** Quién vende, de la configuración; el representante legal sólo existe en una persona jurídica. */
function vendedorDe(env) {
  return {
    nombre: String(env.SELLER_NAME).trim(),
    rut: String(env.SELLER_RUT).trim(),
    domicilio: String(env.SELLER_ADDRESS).trim(),
    correo: String(env.SELLER_EMAIL).trim(),
    representante: String(env.SELLER_REPRESENTATIVE ?? "").trim(),
  };
}

/** Los nombres (de secreto o variable) que faltan para enviar; vacío = listo. Nunca valores. */
export function faltantesCorreo(env) {
  return REQUERIDOS.filter((nombre) => !String(env?.[nombre] ?? "").trim());
}

function codigoDe(error) {
  return error instanceof HttpError ? error.code : "server_error";
}

/**
 * POST https://api.resend.com/emails (https://resend.com/docs/api-reference/emails/send-email):
 * Authorization Bearer, cuerpo JSON {from, to, subject, html, text, reply_to,
 * attachments: [{filename, content en base64}]} e Idempotency-Key, que Resend
 * recuerda 24 horas y admite hasta 256 caracteres. Responde {id}; un error trae
 * {name, message}. Devuelve {ok: true, id} o {ok: false, code}: nunca lanza.
 */
export async function sendEmail(env, { to, subject, html, text, idempotencyKey, attachments }) {
  const cuerpo = {
    from: String(env?.EMAIL_FROM ?? "").trim(),
    to: [to],
    subject,
    html,
    text,
    // Las respuestas llegan a quien vende, no al remitente no-reply.
    ...(String(env?.SELLER_EMAIL ?? "").trim() ? { reply_to: String(env.SELLER_EMAIL).trim() } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(env?.RESEND_API_KEY ?? "").trim()}`,
        "Content-Type": "application/json",
        "User-Agent": "pteron-landing",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
    });
    let datos = null;
    try {
      datos = await response.json();
    } catch {
      // Un cuerpo ilegible se trata por su estado HTTP.
    }
    if (response.ok) return typeof datos?.id === "string" ? { ok: true, id: datos.id } : { ok: false, code: "invalid_response" };
    const nombre = typeof datos?.name === "string" && /^[a-z0-9_]{1,60}$/.test(datos.name) ? datos.name : null;
    return { ok: false, code: nombre || `http_${response.status}`, status: response.status };
  } catch (error) {
    return { ok: false, code: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network" };
  }
}

function base64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

/**
 * La copia fija de los Términos aceptados, para adjuntarla: se lee de los
 * assets (public/terminos/<versión>.html) y se arma un documento propio con
 * sólo la hoja, que se lee sin conexión. Si algo no calza (otra versión,
 * un asset que falta, una página que cambió de forma) devuelve null y el correo
 * lleva sólo el enlace.
 */
async function adjuntoTerminos(env, version, base) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(version ?? "")) || typeof env?.ASSETS?.fetch !== "function") return null;
  try {
    const respuesta = await env.ASSETS.fetch(new Request(`${base}/terminos/${version}`));
    if (!respuesta.ok) return null;
    const pagina = await respuesta.text();
    const hoja = /<article class="legal-hoja"[\s\S]*?<\/article>/.exec(pagina)?.[0];
    if (!hoja || hoja.length > 200_000 || !hoja.includes(`versión ${version} de los términos`)) return null;
    return { filename: `terminos-pteron-${version}.html`, content: base64(documentoTerminos({ version, hoja, base })) };
  } catch {
    return null;
  }
}

/**
 * El servicio de correos de una petición o corrida. `execution` es el de
 * Cloudflare (waitUntil): con él, enviar sigue después de responder; sin él, se
 * espera en el momento. `resumen` cuenta lo que pasó, para el resumen del Cron.
 */
export function createCorreo(env, supabase, execution = null) {
  const resumen = { enviados: 0, omitidos: 0, fallidos: 0 };
  // Los eventos que esta corrida ya intentó: un fallo de hace un instante no se reintenta en la misma pasada.
  const intentados = new Set();
  const base = baseDe(env);

  const insertarUnico = (valores) => supabase.upsert("billing_events", valores, {
    admin: true,
    query: "on_conflict=external_event_id",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
  });
  const actualizarEvento = (id, valores) => supabase.update("billing_events", `external_event_id=eq.${codificar(id)}`, valores, { admin: true });

  async function cargarSuscripcion(id) {
    const [fila] = (await supabase.select("subscriptions", `id=eq.${codificar(id)}&select=${CAMPOS_SUSCRIPCION}&limit=1`, { admin: true })) || [];
    return fila || null;
  }

  /** El correo de la cuenta, de Supabase Auth con la service role (como /admin). */
  async function correoDeLaCuenta(userId) {
    const usuario = await supabase.request(`/auth/v1/admin/users/${codificar(userId)}`, { admin: true, token: supabase.adminKey() });
    const correo = String(usuario?.email ?? "").trim();
    return /^[^\s@<>"]+@[^\s@<>"]+$/.test(correo) ? correo : null;
  }

  /** Lo que el correo dice sólo vale mientras la suscripción siga así; si cambió, no se envía. */
  function aplica(tipo, suscripcion, ahora) {
    if (tipo === "trial_ending") {
      const fin = Date.parse(suscripcion.trial_ends_at ?? "");
      return suscripcion.status === "trialing" && !suscripcion.cancel_at_period_end && fin > ahora.getTime();
    }
    if (tipo === "cancellation") return suscripcion.cancel_at_period_end === true;
    return true;
  }

  async function omitir(tipo, suscripcion, faltan) {
    // Un solo evento por suscripción y tipo: el Cron diario no lo repite.
    await insertarUnico({
      user_id: suscripcion.user_id ?? null,
      external_event_id: `${idDeEvento(tipo, suscripcion.id)}:skipped`,
      event_type: `${eventoDe(tipo)}_skipped`,
      status: "ignored",
      event_metadata: { tipo, subscriptionId: suscripcion.id, faltan },
      processed_at: new Date().toISOString(),
    });
  }

  /**
   * Un correo de `tipo` para la suscripción `fila` (con id; el resto se lee si
   * falta). `reclamado` es el evento de un reintento ya reclamado. Nunca lanza.
   */
  async function entregar(tipo, fila, { reclamado = null, ahora = new Date() } = {}) {
    let evento = reclamado?.id ?? null;
    try {
      // Sin configuración no se lee nada ni se envía nada: sólo queda el evento.
      const faltan = faltantesCorreo(env);
      if (faltan.length) {
        await omitir(tipo, fila, faltan);
        resumen.omitidos += 1;
        return { estado: "omitido", faltan };
      }
      const suscripcion = fila?.plan_id ? fila : await cargarSuscripcion(fila?.id);
      if (!suscripcion) {
        resumen.fallidos += 1;
        console.error("pteron correo", { tipo, subscription: fila?.id ?? null, error: "subscription_missing" });
        return { estado: "fallido", code: "subscription_missing" };
      }

      // El evento es la cerradura: un conflicto en external_event_id quiere
      // decir que otro intento ya se hizo cargo y no se envía de nuevo.
      if (!evento) {
        evento = idDeEvento(tipo, suscripcion.id);
        const creados = await insertarUnico({
          user_id: suscripcion.user_id,
          external_event_id: evento,
          event_type: eventoDe(tipo),
          status: "received",
          event_metadata: { tipo, subscriptionId: suscripcion.id },
        });
        if (!creados.length) return { estado: "duplicado" };
      }
      intentados.add(evento);
      const metadatos = { ...(reclamado?.metadata ?? {}), tipo, subscriptionId: suscripcion.id };
      const cerrar = (valores) => actualizarEvento(evento, { processed_at: new Date().toISOString(), ...valores });

      const fallar = async (codigo) => {
        resumen.fallidos += 1;
        console.error("pteron correo", { tipo, subscription: suscripcion.id, error: codigo });
        await cerrar({ status: "failed", event_metadata: { ...metadatos, error: codigo } }).catch(() => undefined);
        return { estado: "fallido", code: codigo };
      };

      try {
        if (!aplica(tipo, suscripcion, ahora)) {
          await cerrar({ status: "ignored", event_metadata: { ...metadatos, motivo: "no_aplica" } });
          resumen.omitidos += 1;
          return { estado: "omitido", motivo: "no_aplica" };
        }
        const [plan] = (await supabase.select("plan_catalog", `id=eq.${codificar(suscripcion.plan_id)}&select=${CAMPOS_PLAN}&limit=1`, { admin: true })) || [];
        const destinatario = await correoDeLaCuenta(suscripcion.user_id);
        if (!destinatario) return await fallar("no_recipient");
        if (!plan?.display_name || !(Number(plan.monthly_price_clp) > 0)) return await fallar("plan_invalid");

        const vendedor = vendedorDe(env);
        const componer = (copiaAdjunta) => componerCorreo(tipo, { suscripcion, plan, vendedor, base, destinatario, enPrueba: suscripcion.status === "trialing", copiaAdjunta });
        // La copia fija de los Términos va adjunta si se puede leer bien; si no, sólo el enlace.
        const adjunto = tipo === "purchase" ? await adjuntoTerminos(env, suscripcion.terms_version, base) : null;
        const respuesta = await sendEmail(env, {
          to: destinatario,
          ...componer(Boolean(adjunto)),
          idempotencyKey: evento,
          attachments: adjunto ? [adjunto] : undefined,
        });
        if (!respuesta.ok) return await fallar(respuesta.code);
        await cerrar({ status: "processed", event_metadata: { ...metadatos, resendId: respuesta.id, adjunto: Boolean(adjunto) } });
        resumen.enviados += 1;
        return { estado: "enviado", id: respuesta.id };
      } catch (error) {
        return await fallar(codigoDe(error));
      }
    } catch (error) {
      // Lo que falla antes de tener evento (leer la suscripción, anotar el
      // evento): queda sin enviar y en el log.
      resumen.fallidos += 1;
      console.error("pteron correo", { tipo, subscription: fila?.id ?? null, error: codigoDe(error) });
      return { estado: "fallido", code: codigoDe(error) };
    }
  }

  /** Con `execution`, sigue después de responder; sin él, se espera aquí. */
  function segundoPlano(promesa) {
    if (typeof execution?.waitUntil === "function") {
      execution.waitUntil(promesa);
      return Promise.resolve();
    }
    return promesa;
  }

  const enviar = (tipo, suscripcion, userId) => segundoPlano(suscripcion ? entregar(tipo, { id: suscripcion, user_id: userId ?? null }) : Promise.resolve());

  /** A quienes terminan su prueba dentro de las próximas 48 horas y no cancelaron. */
  async function avisarFinDePrueba(ahora = new Date()) {
    try {
      const hasta = new Date(ahora.getTime() + VENTANA_FIN_DE_PRUEBA);
      const filas = await supabase.select(
        "subscriptions",
        `provider=eq.flow&status=eq.trialing&cancel_at_period_end=is.false&trial_ends_at=gt.${codificar(ahora.toISOString())}&trial_ends_at=lte.${codificar(hasta.toISOString())}&select=${CAMPOS_SUSCRIPCION}&order=trial_ends_at.asc&limit=${LIMITE_AVISOS}`,
        { admin: true },
      );
      for (const fila of filas || []) await entregar("trial_ending", fila, { ahora });
    } catch (error) {
      console.error("pteron correo", { tipo: "trial_ending", error: codigoDe(error) });
    }
  }

  /** Reintenta los fallidos de los últimos 3 días (y los que quedaron a medio envío), hasta 20 por corrida. */
  async function reintentar(ahora = new Date()) {
    try {
      if (faltantesCorreo(env).length) return;
      const desde = new Date(ahora.getTime() - VIDA_REINTENTOS).toISOString();
      const tipos = TIPOS.map(eventoDe).join(",");
      const filtro = `event_type=in.(${tipos})&created_at=gte.${codificar(desde)}&select=external_event_id,event_type,event_metadata,status`;
      const fallidos = (await supabase.select("billing_events", `${filtro}&status=eq.failed&order=created_at.asc&limit=${LIMITE_REINTENTOS}`, { admin: true })) || [];
      const restan = LIMITE_REINTENTOS - fallidos.length;
      const antes = new Date(ahora.getTime() - ESPERA_RECIBIDO).toISOString();
      const colgados = restan > 0
        ? (await supabase.select("billing_events", `${filtro}&status=eq.received&created_at=lt.${codificar(antes)}&order=created_at.asc&limit=${restan}`, { admin: true })) || []
        : [];
      for (const evento of [...fallidos, ...colgados]) {
        const tipo = TIPOS.find((candidato) => eventoDe(candidato) === evento.event_type);
        const suscripcion = evento.event_metadata?.subscriptionId;
        if (!tipo || typeof suscripcion !== "string" || evento.external_event_id !== idDeEvento(tipo, suscripcion) || intentados.has(evento.external_event_id)) continue;
        const metadata = { ...(evento.event_metadata ?? {}), intentos: Number(evento.event_metadata?.intentos || 1) + 1 };
        delete metadata.error;
        if (evento.status === "failed") {
          // Reclamarlo evita que dos corridas lo reenvíen a la vez.
          const reclamados = await supabase.update(
            "billing_events",
            `external_event_id=eq.${codificar(evento.external_event_id)}&status=eq.failed`,
            { status: "received", event_metadata: metadata },
            { admin: true },
          );
          if (!reclamados.length) continue;
        }
        await entregar(tipo, { id: suscripcion }, { reclamado: { id: evento.external_event_id, metadata }, ahora });
      }
    } catch (error) {
      console.error("pteron correo", { tipo: "reintentos", error: codigoDe(error) });
    }
  }

  /**
   * Compras y cancelaciones de los últimos 3 días a las que nunca se les anotó
   * evento (falló leer la suscripción o anotar la cerradura, o el Worker murió
   * antes): `reintentar` sólo ve eventos ya escritos, así que aquí se buscan por
   * la suscripción. Cuenta como atendida la que tiene su evento, también el
   * `:skipped`. Pasan por `entregar`, que sigue siendo la cerradura; hasta 20 por
   * corrida. Los últimos 30 minutos se dejan: el envío del retorno puede estar en curso.
   */
  async function recuperarSinEvento(ahora = new Date()) {
    try {
      if (faltantesCorreo(env).length) return;
      const desde = codificar(new Date(ahora.getTime() - VIDA_REINTENTOS).toISOString());
      const hasta = codificar(new Date(ahora.getTime() - ESPERA_RECIBIDO).toISOString());
      const candidatas = {
        purchase: (await supabase.select(
          "subscriptions",
          `provider=eq.flow&provider_subscription_id=not.is.null&status=in.(trialing,active,past_due)&created_at=gte.${desde}&created_at=lt.${hasta}&select=${CAMPOS_SUSCRIPCION}&order=created_at.asc&limit=${LIMITE_AVISOS}`,
          { admin: true },
        )) || [],
        cancellation: (await supabase.select(
          "subscriptions",
          `provider=eq.flow&cancel_at_period_end=is.true&updated_at=gte.${desde}&updated_at=lt.${hasta}&select=${CAMPOS_SUSCRIPCION}&order=updated_at.asc&limit=${LIMITE_AVISOS}`,
          { admin: true },
        )) || [],
      };
      const ids = Object.entries(candidatas).flatMap(([tipo, filas]) => filas.flatMap((fila) => [idDeEvento(tipo, fila.id), `${idDeEvento(tipo, fila.id)}:skipped`]));
      if (!ids.length) return;
      // En tandas: con todas las ids en una sola URL, unas cien ventas en tres
      // días pasan el tope de largo de URL frente a Supabase (unos 16 KB) y esta
      // recuperación deja de correr sin aviso. 50 ids son unos 3,7 KB.
      const existentes = new Set();
      for (let i = 0; i < ids.length; i += TANDA_EVENTOS) {
        const tanda = ids.slice(i, i + TANDA_EVENTOS);
        const lista = tanda.map((id) => codificar(`"${id}"`)).join(",");
        const eventos = (await supabase.select("billing_events", `external_event_id=in.(${lista})&select=external_event_id&limit=${tanda.length}`, { admin: true })) || [];
        for (const evento of eventos) existentes.add(evento.external_event_id);
      }
      let restan = LIMITE_REINTENTOS;
      for (const [tipo, filas] of Object.entries(candidatas)) {
        for (const fila of filas) {
          if (restan <= 0) return;
          const id = idDeEvento(tipo, fila.id);
          if (existentes.has(id) || existentes.has(`${id}:skipped`) || intentados.has(id)) continue;
          restan -= 1;
          await entregar(tipo, fila, { ahora });
        }
      }
    } catch (error) {
      console.error("pteron correo", { tipo: "sin_evento", error: codigoDe(error) });
    }
  }

  return {
    resumen,
    faltantes: () => faltantesCorreo(env),
    /** Confirmación de compra de la suscripción recién anotada. */
    confirmacionCompra: (suscripcion, userId) => enviar("purchase", suscripcion, userId),
    /** Confirmación de «Cancelar renovación». */
    confirmacionCancelacion: (suscripcion, userId) => enviar("cancellation", suscripcion, userId),
    avisarFinDePrueba,
    reintentar,
    recuperarSinEvento,
    entregar,
  };
}

// Un plan de ejemplo, no el del catálogo: la prueba no lee la base.
const PLAN_DE_PRUEBA = { id: "basic", display_name: "Basic", monthly_price_clp: 2990, trial_period_days: 7, ai_units_limit: 6_000_000, trial_ai_units_limit: 1_500_000 };

/** Una suscripción de ejemplo por tipo, con fechas relativas a `ahora`. Ninguna existe en la base. */
function suscripcionDePrueba(tipo, ahora) {
  const en = (horas) => new Date(ahora.getTime() + horas * HORA).toISOString();
  const [inicio, fin] = { purchase: [0, 7 * 24], trial_ending: [-6 * 24, 36], cancellation: [-2 * 24, 5 * 24] }[tipo];
  return {
    id: "prueba",
    user_id: null,
    plan_id: PLAN_DE_PRUEBA.id,
    provider: "flow",
    status: "trialing",
    trial_ends_at: en(fin),
    current_period_start: en(inicio),
    current_period_end: en(fin),
    cancel_at_period_end: tipo === "cancellation",
    terms_version: TERMS_VERSION,
  };
}

/**
 * Los tres correos al cliente con datos de ejemplo (Basic con prueba, aviso de
 * fin de prueba, cancelación), con el configurado de verdad: los mismos
 * compositores, el remitente y la clave del Worker. Va a `destinatario` y a
 * nadie más, con asunto «[Prueba] …» y una Idempotency-Key nueva por envío, así
 * que no choca con la de ningún correo real. No lee ni escribe la base. Con algo
 * sin configurar no envía nada y devuelve los nombres que faltan. Nunca lanza.
 * Devuelve {faltan} o {resultados: [{tipo, asunto, estado: "enviado" | "error", codigo?}]}.
 */
export async function enviarCorreosDePrueba(env, destinatario, { ahora = new Date() } = {}) {
  const faltan = faltantesCorreo(env);
  if (faltan.length) return { faltan };
  const base = baseDe(env);
  const vendedor = vendedorDe(env);
  const resultados = [];
  for (const tipo of TIPOS) {
    try {
      const suscripcion = suscripcionDePrueba(tipo, ahora);
      const adjunto = tipo === "purchase" ? await adjuntoTerminos(env, suscripcion.terms_version, base) : null;
      const correo = componerCorreo(tipo, { suscripcion, plan: PLAN_DE_PRUEBA, vendedor, base, destinatario, enPrueba: true, copiaAdjunta: Boolean(adjunto) });
      const asunto = `[Prueba] ${correo.subject}`;
      const respuesta = await sendEmail(env, {
        to: destinatario,
        ...correo,
        subject: asunto,
        idempotencyKey: `prueba:${tipo}:${crypto.randomUUID()}`,
        attachments: adjunto ? [adjunto] : undefined,
      });
      resultados.push(respuesta.ok ? { tipo, asunto, estado: "enviado" } : { tipo, asunto, estado: "error", codigo: respuesta.code });
    } catch (error) {
      resultados.push({ tipo, asunto: null, estado: "error", codigo: codigoDe(error) });
    }
  }
  return { resultados };
}
