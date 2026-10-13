import { TERMS_RETRACTO } from "./terms.js";

/**
 * Texto de los correos al cliente: sólo contenido, sin red ni base de datos.
 * Repiten lo que dicen los Términos (public/terminos.html) y los borradores de
 * LEGAL-PENDIENTE.md, puntos 3 y 11; no inventan política. Cada correo sale en
 * texto plano y en HTML simple con estilos en línea (los clientes de correo
 * ignoran las hojas de estilo): una columna, letra de 16 px, contraste alto,
 * enlaces subrayados y títulos reales para los lectores de pantalla.
 *
 * Un párrafo es una lista de trozos: texto o un enlace {href, texto}. De la
 * misma estructura salen el texto plano y el HTML, así no se desfasan y todo
 * lo que viene de la base (nombres, domicilio) pasa por escapar() al
 * convertirse en HTML.
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

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);
}

const enlace = (href, texto = href) => ({ href, texto });

/** La cuota de un período: la del plan o, en la prueba, la de prueba (un cuarto si el catálogo no fija otra); como /cuenta. */
export function cuotaDelPeriodo(plan, prueba) {
  if (plan?.ai_units_limit == null) return null;
  const completa = Number(plan.ai_units_limit);
  if (!Number.isFinite(completa) || completa < 0) return null;
  if (!prueba) return completa;
  const reducida = plan.trial_ai_units_limit == null ? NaN : Number(plan.trial_ai_units_limit);
  return Number.isFinite(reducida) && reducida >= 0 ? reducida : Math.floor(completa / 4);
}

function linea(vendedor) {
  return `${vendedor.nombre}, RUT ${vendedor.rut}, domicilio ${vendedor.domicilio}, correo ${vendedor.correo}`;
}

function bloqueVendedor(vendedor) {
  return { h: "Quién vende", p: [[`${linea(vendedor)}.`]] };
}

function pie(vendedor) {
  return { p: [[`pteron lo vende ${linea(vendedor)}. Si respondes este correo, tu mensaje llega a ${vendedor.correo}.`]], pie: true };
}

// Lo que los Términos dicen en §5, repetido tal cual.
const CANCELAR_EN_PRUEBA = (nombre) => `Si cancelas durante la prueba, no se cobra nada y ${nombre} termina el día en que terminaba la prueba.`;
const CANCELAR_PAGADO = "Si ya pagaste, el plan sigue hasta el fin del período pagado y no se renueva.";

// ── Los tres correos ──────────────────────────────────────────────────────

function compra({ suscripcion, plan, vendedor, base, copiaAdjunta, enPrueba }) {
  const nombre = plan.display_name;
  const precio = pesos(plan.monthly_price_clp);
  const cuenta = enlace(`${base}/cuenta`);
  const bloques = [bloqueVendedor(vendedor)];

  const cobro = [`${nombre}: ${precio} al mes, IVA incluido. Se paga con tarjeta a través de Flow, que registra la tarjeta en su propio sitio: pteron no la recibe.`];
  const fin = fechaLarga(suscripcion.trial_ends_at || suscripcion.current_period_end);
  const primerCobro = fechaLarga(suscripcion.current_period_start);
  // El cobro sólo se da por hecho con un período pagado: activa y con un fin de período
  // que no sea el de la prueba (Flow puede traer fechas de prueba aunque no haya pago).
  const cobroHecho = suscripcion.status === "active" && Boolean(suscripcion.current_period_end) && suscripcion.current_period_end !== suscripcion.trial_ends_at;
  const fechas = [];
  if (enPrueba && fin) {
    fechas.push(`Tu prueba termina el ${fin}. Ese día se cobran ${precio}, y luego cada mes, hasta que canceles.`);
  } else if (enPrueba) {
    fechas.push(`Tu prueba termina al cerrar el período de prueba. Ese día se cobran ${precio}, y luego cada mes, hasta que canceles.`);
  } else if (cobroHecho && primerCobro) {
    fechas.push(`El primer cobro de ${precio} se hizo el ${primerCobro}. Luego se cobra cada mes, hasta que canceles.`);
  } else if (suscripcion.status === "past_due") {
    // Los Términos (§6): un cobro que no se pudo hacer queda como «Pago pendiente».
    fechas.push(`El primer cobro de ${precio} todavía no se pudo hacer: tu cuenta muestra «Pago pendiente» y, cuando Flow lo entrega, el enlace para pagarlo. Luego se cobra cada mes, hasta que canceles.`);
  } else {
    fechas.push("Los planes se renuevan solos cada mes, hasta que canceles. Tu cuenta muestra la fecha del próximo cobro.");
  }
  bloques.push({ h: "Tu plan", p: [cobro, fechas] });

  bloques.push({
    h: "Cancelar",
    p: [
      ["Cancelas cuando quieras desde tu cuenta, en ", cuenta, ", con «Cancelar renovación»."],
      [enPrueba ? CANCELAR_EN_PRUEBA(nombre) : CANCELAR_PAGADO],
    ],
  });

  if (TERMS_RETRACTO.trim()) bloques.push({ h: "Retracto y devoluciones", p: [[TERMS_RETRACTO.trim()]] });

  const cuota = cuotaDelPeriodo(plan, false);
  if (cuota !== null) {
    const prueba = enPrueba ? cuotaDelPeriodo(plan, true) : null;
    const dePrueba = prueba !== null ? ` (${unidades(prueba)} durante la prueba)` : "";
    bloques.push({
      h: "Tu cuota de IA incluida",
      p: [[`${nombre} incluye ${unidades(cuota)} unidades de IA por período${dePrueba}. Lo que no usas no pasa al siguiente.`]],
    });
  }

  const version = /^\d{4}-\d{2}-\d{2}$/.test(String(suscripcion.terms_version ?? "")) ? suscripcion.terms_version : null;
  if (version) {
    const copia = enlace(`${base}/terminos/${version}`);
    bloques.push({
      h: "Términos aceptados",
      p: [[`Al contratar aceptaste los Términos de uso, versión ${version}. Esta es la copia de esa versión, que no cambia: `, copia, copiaAdjunta ? ". También va adjunta a este correo." : "."]],
    });
  }
  bloques.push(pie(vendedor));
  return { subject: `Tu plan ${nombre} de pteron`, titulo: `Tu plan ${nombre} de pteron`, intro: `Confirmamos tu contratación de ${nombre}.`, bloques };
}

function finDePrueba({ suscripcion, plan, vendedor, base }) {
  const nombre = plan.display_name;
  const precio = pesos(plan.monthly_price_clp);
  const fecha = fechaLarga(suscripcion.trial_ends_at || suscripcion.current_period_end);
  const cuenta = enlace(`${base}/cuenta`);
  return {
    subject: fecha ? `Tu prueba de ${nombre} termina el ${fecha}` : `Tu prueba de ${nombre} está por terminar`,
    titulo: `Tu prueba de ${nombre} está por terminar`,
    intro: null,
    bloques: [
      { p: [[`Tu prueba de ${nombre} termina el ${fecha || "día en que cierra el período de prueba"}. Ese día se cobran ${precio}, salvo que canceles antes en `, cuenta, "."]] },
      { p: [[CANCELAR_EN_PRUEBA(nombre), ` Si no cancelas, se cobran ${precio} y luego cada mes, hasta que canceles.`]] },
      pie(vendedor),
    ],
  };
}

function cancelacion({ suscripcion, plan, vendedor, enPrueba }) {
  const nombre = plan.display_name;
  const fecha = fechaLarga(suscripcion.current_period_end || suscripcion.trial_ends_at);
  const hasta = fecha ? `el ${fecha}` : enPrueba ? "al cerrar la prueba" : "al cierre del período pagado";
  const parrafos = enPrueba
    ? [[`Cancelaste ${nombre} durante la prueba: no se cobra nada y ${nombre} termina ${hasta}.`]]
    : [
      [`Cancelaste la renovación de ${nombre}. Tu plan sigue hasta ${hasta}, el fin del período pagado, y no se cobra nada más.`],
      ["Después, pteron vuelve al núcleo gratuito sin borrar tu trabajo local."],
    ];
  return {
    subject: `Cancelaste la renovación de ${nombre}`,
    titulo: `Cancelaste la renovación de ${nombre}`,
    intro: null,
    bloques: [...parrafos.map((parrafo) => ({ p: [parrafo] })), pie(vendedor)],
  };
}

const COMPOSITORES = { purchase: compra, trial_ending: finDePrueba, cancellation: cancelacion };

// ── Presentación ──────────────────────────────────────────────────────────

const textoDe = (trozo) => (typeof trozo === "string" ? trozo : trozo.href === trozo.texto ? trozo.href : `${trozo.texto} (${trozo.href})`);
const parrafoTexto = (parrafo) => parrafo.map(textoDe).join("");

function htmlDe(trozo) {
  if (typeof trozo === "string") return escapar(trozo);
  return `<a href="${escapar(trozo.href)}" style="color:${AZUL};text-decoration:underline;">${escapar(trozo.texto)}</a>`;
}

function aTexto({ titulo, intro, bloques }) {
  const partes = [titulo, ""];
  if (intro) partes.push(intro, "");
  for (const bloque of bloques) {
    if (bloque.h) partes.push(bloque.h.toUpperCase(), "");
    for (const parrafo of bloque.p) partes.push(parrafoTexto(parrafo), "");
  }
  return `${partes.join("\n").trim()}\n`;
}

function aHtml({ titulo, intro, bloques }) {
  const fuente = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const cuerpo = [];
  for (const bloque of bloques) {
    if (bloque.h) cuerpo.push(`<h2 style="${fuente}font-size:18px;line-height:1.3;color:${AZUL};margin:24px 0 8px;">${escapar(bloque.h)}</h2>`);
    for (const parrafo of bloque.p) {
      const estilo = bloque.pie ? `font-size:14px;color:${GRAFITO};margin:24px 0 0;` : `font-size:16px;color:${TINTA};margin:0 0 12px;`;
      cuerpo.push(`<p style="${fuente}${estilo}line-height:1.5;">${parrafo.map(htmlDe).join("")}</p>`);
    }
  }
  return [
    "<!doctype html>",
    '<html lang="es-CL">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    `<title>${escapar(titulo)}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background:${MESA};">`,
    `<div style="max-width:600px;margin:0 auto;padding:16px;">`,
    `<div style="background:#FFFFFF;padding:24px;border-radius:8px;">`,
    `<h1 style="${fuente}font-size:24px;line-height:1.25;color:${TINTA};margin:0 0 12px;">${escapar(titulo)}</h1>`,
    intro ? `<p style="${fuente}font-size:16px;line-height:1.5;color:${TINTA};margin:0 0 12px;">${escapar(intro)}</p>` : "",
    ...cuerpo,
    "</div>",
    "</div>",
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");
}

/**
 * El correo de `tipo` (purchase, trial_ending, cancellation) con sus tres
 * partes. `suscripcion` y `plan` son las filas de subscriptions y plan_catalog;
 * `enPrueba` dice si la suscripción está en su prueba; `vendedor` es
 * {nombre, rut, domicilio, correo}; `base` el origen del sitio.
 */
export function componerCorreo(tipo, datos) {
  const compositor = COMPOSITORES[tipo];
  if (!compositor) throw new Error(`Correo desconocido: ${tipo}`);
  const modelo = compositor(datos);
  return { subject: modelo.subject, text: aTexto(modelo), html: aHtml(modelo) };
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
