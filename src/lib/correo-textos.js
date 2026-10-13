import { TERMS_RETRACTO } from "./terms.js";
import { escapar, maquetar } from "./correo-diseno.js";

export { escapar };

/**
 * Texto de los correos al cliente: sólo contenido, sin red ni base de datos.
 * Repiten lo que dicen los Términos (public/terminos.html) y los borradores de
 * LEGAL-PENDIENTE.md, puntos 3 y 11; no inventan política. Cada compositor
 * arma el modelo del correo (asunto, preheader, encabezado, bloques y pie) y
 * correo-diseno.js lo convierte en la hoja HTML y en el texto plano, que dice
 * lo mismo completo.
 *
 * Todo sale de datos reales (la suscripción, el plan del catálogo, el vendedor
 * de la configuración y el correo de la cuenta): aquí no hay marcadores de
 * «por definir». Lo que la base trae (nombres, domicilio) pasa por escapar()
 * al convertirse en HTML.
 */

const ZONA = "America/Santiago";
const TINTA = "#1F2A3D";
const AZUL = "#1E3F94";
const GRAFITO = "#5B6B82";
const MESA = "#E9EDF1";

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
let formatoFecha = null;

export const pesos = (monto) => `$${numero.format(monto)}`;
export const unidades = (cantidad) => numero.format(cantidad);

/** «20 de octubre de 2026» en el calendario de Chile, como /cuenta; "" si no hay fecha. */
export function fechaLarga(valor) {
  const tiempo = typeof valor === "number" ? valor : Date.parse(valor ?? "");
  if (!Number.isFinite(tiempo)) return "";
  try {
    formatoFecha ??= new Intl.DateTimeFormat("es-CL", { timeZone: ZONA, day: "numeric", month: "long", year: "numeric" });
    return formatoFecha.format(tiempo);
  } catch {
    return new Date(tiempo).toISOString().slice(0, 10);
  }
}

const enlace = (href, texto = href) => ({ href, texto });
const destacado = (texto) => ({ b: texto });
const sinEsquema = (url) => url.replace(/^https?:\/\//, "");
/** Un correo como enlace mailto si parece una dirección; si no, texto. */
const correoEnlazado = (correo) => (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(correo) ? enlace(`mailto:${correo}`, correo) : correo);

/** La cuota de un período: la del plan o, en la prueba, la de prueba (un cuarto si el catálogo no fija otra); como /cuenta. */
export function cuotaDelPeriodo(plan, prueba) {
  if (plan?.ai_units_limit == null) return null;
  const completa = Number(plan.ai_units_limit);
  if (!Number.isFinite(completa) || completa < 0) return null;
  if (!prueba) return completa;
  const reducida = plan.trial_ai_units_limit == null ? NaN : Number(plan.trial_ai_units_limit);
  return Number.isFinite(reducida) && reducida >= 0 ? reducida : Math.floor(completa / 4);
}

/**
 * La línea del pie con quién vende. El representante legal sólo existe para una
 * persona jurídica (Reglamento de comercio electrónico, art. 7 n.º 6) y sale
 * únicamente si SELLER_REPRESENTATIVE tiene valor.
 */
function lineaVendedor(vendedor) {
  const representante = vendedor.representante ? `, representante legal ${vendedor.representante}` : "";
  return `pteron lo vende ${vendedor.nombre}, RUT ${vendedor.rut}, domicilio ${vendedor.domicilio}${representante}. Si respondes este correo, tu mensaje llega a ${vendedor.correo}.`;
}

function fichaVendedor(vendedor) {
  return [
    ["Nombre o razón social", vendedor.nombre],
    ["RUT", vendedor.rut],
    ["Domicilio", vendedor.domicilio],
    ...(vendedor.representante ? [["Representante legal", vendedor.representante]] : []),
    ["Correo", correoEnlazado(vendedor.correo)],
  ];
}

// «con profe@escuela.cl» para el pie; sin destinatario conocido, nada.
const con = (destinatario) => (destinatario ? ` con ${destinatario}` : "");

// Lo que los Términos dicen en §5, repetido tal cual.
const CANCELAR_EN_PRUEBA = (nombre) => `Si cancelas durante la prueba, no se cobra nada y ${nombre} termina el día en que terminaba la prueba.`;
const CANCELAR_PAGADO = "Si ya pagaste, el plan sigue hasta el fin del período pagado y no se renueva.";
const DESPUES = "Después, pteron vuelve al núcleo gratuito sin borrar tu trabajo local.";
const BOTON_CANCELAR = "«Cancelar renovación»"; // el botón exacto de /cuenta y de los Términos §5

// ── Los tres correos ──────────────────────────────────────────────────────

function compra({ suscripcion, plan, vendedor, base, copiaAdjunta, enPrueba, destinatario }) {
  const nombre = plan.display_name;
  const precio = pesos(plan.monthly_price_clp);
  const cuenta = `${base}/cuenta`;
  const fin = fechaLarga(suscripcion.trial_ends_at || suscripcion.current_period_end);
  const primerCobro = fechaLarga(suscripcion.current_period_start);
  // El cobro sólo se da por hecho con un período pagado: activa y con un fin de período
  // que no sea el de la prueba (Flow puede traer fechas de prueba aunque no haya pago).
  const cobroHecho = suscripcion.status === "active" && Boolean(suscripcion.current_period_end) && suscripcion.current_period_end !== suscripcion.trial_ends_at;

  const ficha = [["Plan", `pteron ${nombre}`], ["Precio", `${precio} al mes, IVA incluido`]];
  let encabezado;
  let preheader;
  let inicio;
  if (enPrueba && fin) {
    encabezado = `Empezó tu prueba de ${nombre}`;
    preheader = `Prueba gratis hasta el ${fin}. Ese día se cobran ${precio}, salvo que canceles antes.`;
    inicio = ["Tu prueba termina el ", destacado(fin), `. Ese día se cobran ${precio}, y luego cada mes, hasta que canceles.`];
    ficha.push(["Prueba gratis", `Hasta el ${fin}`], ["Primer cobro", `${precio} el ${fin}`]);
  } else if (enPrueba) {
    encabezado = `Empezó tu prueba de ${nombre}`;
    preheader = `Al terminar la prueba se cobran ${precio}, salvo que canceles antes.`;
    inicio = [`Tu prueba termina al cerrar el período de prueba. Ese día se cobran ${precio}, y luego cada mes, hasta que canceles.`];
    ficha.push(["Primer cobro", `${precio} al terminar la prueba`]);
  } else if (cobroHecho && primerCobro) {
    encabezado = `Tu plan ${nombre} está activo`;
    preheader = `Se cobraron ${precio} el ${primerCobro}. Aquí está el detalle de tu plan y cómo cancelar.`;
    inicio = [`El primer cobro de ${precio} se hizo el `, destacado(primerCobro), ". Luego se cobra cada mes, hasta que canceles."];
    ficha.push(["Primer cobro", `${precio}, hecho el ${primerCobro}`]);
  } else if (suscripcion.status === "past_due") {
    // Los Términos (§6): un cobro que no se pudo hacer queda como «Pago pendiente».
    encabezado = `Contrataste ${nombre}`;
    preheader = `El primer cobro de ${precio} está pendiente: tu cuenta muestra «Pago pendiente».`;
    inicio = [`El primer cobro de ${precio} todavía no se pudo hacer: tu cuenta muestra «Pago pendiente» y, cuando Flow lo entrega, el enlace para pagarlo. Luego se cobra cada mes, hasta que canceles.`];
    ficha.push(["Primer cobro", "Pago pendiente"]);
  } else {
    encabezado = `Contrataste ${nombre}`;
    preheader = `${nombre}: ${precio} al mes, IVA incluido. Aquí está el detalle de tu plan y cómo cancelar.`;
    inicio = ["Los planes se renuevan solos cada mes, hasta que canceles. Tu cuenta muestra la fecha del próximo cobro."];
  }
  ficha.push(["Pago", "Con tarjeta a través de Flow, que registra la tarjeta en su propio sitio: pteron no la recibe"]);

  const cuota = cuotaDelPeriodo(plan, false);
  if (cuota !== null) {
    const prueba = enPrueba ? cuotaDelPeriodo(plan, true) : null;
    const dePrueba = prueba !== null ? ` (${unidades(prueba)} durante la prueba)` : "";
    ficha.push(["Cuota de IA incluida", `${unidades(cuota)} unidades de IA por período${dePrueba}; lo que no usas no pasa al siguiente`]);
  }

  const version = /^\d{4}-\d{2}-\d{2}$/.test(String(suscripcion.terms_version ?? "")) ? suscripcion.terms_version : null;
  if (version) {
    // El enlace lleva a la copia fija de esa versión; «adjunta» sólo si de verdad va el archivo.
    ficha.push(["Términos aceptados", [enlace(`${base}/terminos/${version}`, `Términos de uso, versión ${version}`), copiaAdjunta ? " · copia fija, también adjunta a este correo" : " · copia fija, que no cambia"]]);
  }

  const bloques = [
    { p: inicio },
    { ficha },
    { h: "Cómo cancelar" },
    { p: ["Cancelas cuando quieras desde tu cuenta, en ", enlace(cuenta, sinEsquema(cuenta)), `, con ${BOTON_CANCELAR}. `, enPrueba ? CANCELAR_EN_PRUEBA(nombre) : CANCELAR_PAGADO] },
    { boton: { href: cuenta, texto: "Ir a mi cuenta" } },
  ];
  if (TERMS_RETRACTO.trim()) bloques.push({ h: "Retracto y devoluciones" }, { p: TERMS_RETRACTO.trim() });
  bloques.push({ h: "Quién te vende" }, { ficha: fichaVendedor(vendedor) });

  return {
    subject: `Confirmación de compra: pteron ${nombre}`,
    preheader,
    antetitulo: "Confirmación de compra",
    encabezado,
    bloques,
    motivo: `Recibiste este correo porque contrataste pteron ${nombre}${con(destinatario)}. Guárdalo: es la confirmación de tu contratación y de los Términos que aceptaste.`,
  };
}

function finDePrueba({ suscripcion, plan, base, destinatario }) {
  const nombre = plan.display_name;
  const precio = pesos(plan.monthly_price_clp);
  const fecha = fechaLarga(suscripcion.trial_ends_at || suscripcion.current_period_end);
  const cuenta = `${base}/cuenta`;
  const titulo = fecha ? `Tu prueba de ${nombre} termina el ${fecha}` : `Tu prueba de ${nombre} está por terminar`;
  return {
    subject: fecha ? `Tu prueba de pteron ${nombre} termina el ${fecha}` : `Tu prueba de pteron ${nombre} está por terminar`,
    preheader: `${fecha ? "Ese día" : "Al terminar la prueba"} se cobran ${precio}, salvo que canceles antes desde tu cuenta.`,
    antetitulo: "Aviso de fin de prueba",
    encabezado: titulo,
    bloques: [
      { p: [fecha ? "Ese día se cobran " : "Al terminar la prueba se cobran ", destacado(precio), ", IVA incluido, salvo que canceles antes en ", enlace(cuenta, sinEsquema(cuenta)), "."] },
      {
        ficha: [
          ["Plan", `pteron ${nombre}`],
          ...(fecha ? [["Fin de la prueba", fecha]] : []),
          ["Cobro", `${precio} ${fecha ? `el ${fecha}` : "al terminar la prueba"}; luego cada mes, hasta que canceles`],
        ],
      },
      { boton: { href: cuenta, texto: "Ver mi plan" } },
      { p: [`Si quieres seguir, no tienes que hacer nada. Si no, cancela con ${BOTON_CANCELAR} en tu cuenta antes de que termine la prueba. `, CANCELAR_EN_PRUEBA(nombre)] },
    ],
    motivo: `Recibiste este correo porque tienes una prueba de pteron ${nombre}${con(destinatario)}.`,
  };
}

function cancelacion({ suscripcion, plan, vendedor, base, enPrueba, destinatario }) {
  const nombre = plan.display_name;
  const fecha = fechaLarga(suscripcion.current_period_end || suscripcion.trial_ends_at);
  const hasta = fecha ? `el ${fecha}` : enPrueba ? "al cerrar la prueba" : "al cierre del período pagado";
  const cuenta = `${base}/cuenta`;
  // Con un cobro pendiente (Términos §6) current_period_end es el fin del último período
  // pagado, que ya pasó: no se dice «activo hasta» ni se promete que no se cobra nada más.
  const pendiente = !enPrueba && suscripcion.status === "past_due";
  let encabezado;
  let preheader;
  let inicio;
  let filas;
  if (enPrueba) {
    encabezado = fecha ? `Tu prueba de ${nombre} sigue hasta el ${fecha}` : `Cancelaste tu prueba de ${nombre}`;
    preheader = `No se cobra nada y ${nombre} termina ${hasta}. Tu trabajo local se queda contigo.`;
    inicio = [`Cancelaste ${nombre} durante la prueba: no se cobra nada y ${nombre} termina `, destacado(hasta), `. ${DESPUES}`];
    filas = [...(fecha ? [["Prueba hasta", fecha]] : []), ["Cobros", "Ninguno"]];
  } else if (pendiente) {
    encabezado = `Cancelaste la renovación de ${nombre}`;
    preheader = `${nombre} no se renueva. El último cobro quedó pendiente: tu cuenta muestra su estado.`;
    inicio = [`Cancelaste la renovación de ${nombre}: no se renueva. El último cobro no se pudo hacer y tu cuenta lo muestra como «Pago pendiente»; ahí ves su estado. Sin ese pago, pteron vuelve al núcleo gratuito sin borrar tu trabajo local.`];
    filas = [...(fecha ? [["Período pagado hasta", fecha]] : []), ["Cobros", "No se renueva; el cobro pendiente se ve en tu cuenta"]];
  } else {
    encabezado = fecha ? `Tu plan ${nombre} sigue activo hasta el ${fecha}` : `Cancelaste la renovación de ${nombre}`;
    preheader = `${nombre} sigue activo hasta ${hasta}. No se cobra nada más y tu trabajo local se queda contigo.`;
    inicio = [`Cancelaste la renovación de ${nombre}. Tu plan sigue hasta `, destacado(hasta), `, el fin del período pagado, y no se cobra nada más. ${DESPUES}`];
    filas = [...(fecha ? [["Activo hasta", fecha]] : []), ["Cobros", "No se renueva; no se cobra nada más"]];
  }
  return {
    subject: `Cancelaste la renovación de pteron ${nombre}`,
    preheader,
    antetitulo: "Renovación cancelada",
    encabezado,
    bloques: [
      { p: inicio },
      { ficha: [["Plan", `pteron ${nombre}`], ...filas] },
      { h: "Si quieres volver" },
      // Términos §4: la prueba es una por persona.
      { p: [`Cuando termine ${enPrueba ? "la prueba" : "el plan"}, entra a tu cuenta y elige ${nombre} de nuevo. Esta vez el cobro se hace al contratar, sin prueba.`] },
      { boton: { href: cuenta, texto: "Ir a mi cuenta" } },
      { p: [`Si quieres mantener ${nombre} sin interrupción, o no pediste esta cancelación, escríbenos a `, correoEnlazado(vendedor.correo), "."] },
    ],
    motivo: `Recibiste este correo porque se canceló la renovación de pteron ${nombre}${destinatario ? ` en la cuenta ${destinatario}` : ""}.`,
  };
}

const COMPOSITORES = { purchase: compra, trial_ending: finDePrueba, cancellation: cancelacion };

/**
 * El correo de `tipo` (purchase, trial_ending, cancellation) con sus tres
 * partes. `suscripcion` y `plan` son las filas de subscriptions y plan_catalog;
 * `enPrueba` dice si la suscripción está en su prueba; `vendedor` es
 * {nombre, rut, domicilio, correo, representante?}; `destinatario` el correo de
 * la cuenta, que el pie nombra; `base` el origen del sitio.
 */
export function componerCorreo(tipo, datos) {
  const compositor = COMPOSITORES[tipo];
  if (!compositor) throw new Error(`Correo desconocido: ${tipo}`);
  const modelo = compositor(datos);
  const { html, text } = maquetar({
    titulo: modelo.subject,
    preheader: modelo.preheader,
    antetitulo: modelo.antetitulo,
    encabezado: modelo.encabezado,
    bloques: modelo.bloques,
    motivo: modelo.motivo,
    vendedor: lineaVendedor(datos.vendedor),
    base: datos.base,
  });
  return { subject: modelo.subject, text, html };
}

/** La copia de los Términos que va adjunta: sólo la hoja, con estilos propios y los enlaces absolutos, legible sin conexión. */
export function documentoTerminos({ version, hoja, base }) {
  const hojaAbsoluta = hoja.replace(/href="\/(?!\/)/g, `href="${escapar(base)}/`);
  return [
    "<!doctype html>",
    '<html lang="es-CL">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Términos de uso de pteron, versión ${escapar(version)}</title>`,
    `<style>body{margin:0;background:${MESA};color:${TINTA};font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}`,
    "main{max-width:42rem;margin:0 auto;padding:1.5rem 1rem}",
    `article{background:#fff;padding:1.5rem;border-radius:8px}h1{font-size:1.6rem;margin:0 0 .25rem}h2{font-size:1.15rem;color:${AZUL};margin:1.5rem 0 .5rem}`,
    `.legal-n{display:inline-block;min-width:1.5rem;color:${GRAFITO}}a{color:${AZUL}}.nota{color:${GRAFITO};font-size:.9rem}</style>`,
    "</head>",
    "<body>",
    "<main>",
    "<h1>Términos de uso de pteron</h1>",
    `<p class="nota">Versión ${escapar(version)}. Copia de esa versión, que no cambia. Los términos vigentes están en <a href="${escapar(base)}/terminos">${escapar(base)}/terminos</a>.</p>`,
    hojaAbsoluta,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
