/**
 * Diseño de los correos al cliente: la hoja, sus bloques y el texto plano.
 * Sin red, sin datos y sin dependencias; lo que dice cada correo vive en
 * correo-textos.js. Es el diseño del kit de correos (hoja blanca sobre la mesa,
 * banda azul hondo con la marca, título en azul, ficha de datos y un solo botón
 * lápiz), el mismo de las plantillas de Supabase Auth en supabase/correos/.
 *
 * Todo el diseño va en estilos en línea y atributos bgcolor, así el correo se
 * ve completo aunque el cliente descarte el <style>; ese bloque sólo agrega el
 * modo oscuro y los ajustes de pantallas chicas. Del mismo modelo salen el
 * HTML y el texto plano, así no se desfasan, y todo lo que viene de datos
 * (correo de la cuenta, vendedor, fechas) pasa por escapar() en el HTML.
 *
 * Trozos de texto (un párrafo o el valor de una fila de la ficha): un texto,
 * un enlace {href, texto}, un destacado {b: texto} o una lista de ellos.
 * Bloques: {p: trozos}, {h: subtítulo}, {ficha: [[etiqueta, trozos]]} y
 * {boton: {href, texto}}.
 */

const SITIO = "https://pteron.patagua.dev";
// La marca en blanco sobre un fondo opaco del mismo azul de la banda (311×96, se
// muestra a 104×32): si un cliente pierde el bgcolor, queda una placa azul
// legible. Con las imágenes bloqueadas se lee el alt «pteron» en blanco.
// public/assets/correo/pteron-banda-correo.png.
export const LOGO_URL = `${SITIO}/assets/correo/pteron-banda-correo.png`;

const C = {
  mesa: "#E9EDF1", hoja: "#FFFFFF", banda: "#162F70", tinta: "#1F2A3D", azul: "#1E3F94", grafito: "#5B6B82",
  pie: "#4A5A72", regla: "#DCE3EE", notaPapel: "#F2F6FC", notaBorde: "#D6E0EF",
  lapiz: "#F0C060", lapizHondo: "#E2AC3A", sobreLapiz: "#162F70",
};
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const T = `font-family:${FUENTE};color:${C.tinta};`;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);
}

/** Trozos → {html, text}. Un enlace cuyo texto es su propia dirección sale en el texto plano sólo como dirección. */
export function enLinea(trozo) {
  if (Array.isArray(trozo)) {
    return trozo.map(enLinea).reduce((suma, parte) => ({ html: suma.html + parte.html, text: suma.text + parte.text }), { html: "", text: "" });
  }
  if (trozo && typeof trozo === "object" && "href" in trozo) {
    const destino = trozo.href.startsWith("mailto:") ? trozo.href.slice(7) : trozo.href;
    const igual = trozo.texto === destino || trozo.texto === destino.replace(/^https?:\/\//, "");
    return {
      html: `<a href="${escapar(trozo.href)}" class="lnk" style="color:${C.azul};text-decoration:underline;">${escapar(trozo.texto)}</a>`,
      text: igual ? destino : `${trozo.texto} (${destino})`,
    };
  }
  if (trozo && typeof trozo === "object" && "b" in trozo) {
    return { html: `<strong style="font-weight:700;">${escapar(trozo.b)}</strong>`, text: String(trozo.b ?? "") };
  }
  return { html: escapar(trozo), text: String(trozo ?? "") };
}

// ── Bloques ────────────────────────────────────────────────────────────────

const fila = (interior, relleno = "0 40px 16px") => `<tr><td class="px" style="padding:${relleno};">${interior}</td></tr>`;

const regla = () => fila(
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" height="1" style="height:1px;font-size:1px;line-height:1px;border-top:1px solid ${C.regla};">&nbsp;</td></tr></table>`,
  "8px 40px 20px",
);

// Botón a prueba de clientes: celda de 48 px con bgcolor y el enlace dentro.
// Píldora salvo en Outlook de escritorio (esquinas rectas; mso-padding-alt le da el mismo ancho).
function boton({ href, texto }) {
  return fila(
    `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="center" valign="middle" height="48" bgcolor="${C.lapiz}" style="height:48px;background-color:${C.lapiz};border:1px solid ${C.lapizHondo};border-radius:999px;mso-padding-alt:0 32px;">` +
      `<a href="${escapar(href)}" class="btn-a" style="display:inline-block;padding:14px 32px;font-family:${FUENTE};font-size:17px;line-height:20px;font-weight:700;color:${C.sobreLapiz};text-decoration:none;border-radius:999px;">${escapar(texto)}</a>` +
      `</td></tr></table>`,
    "8px 40px 24px",
  );
}

// Ficha de datos: cada fila es la etiqueta arriba y el valor debajo, en una
// sola celda de ancho completo. Se lee igual a 600 que a 320 px y sin <style>.
function ficha(filas) {
  const celdas = filas.map(([etiqueta, valor], i) => {
    const arriba = i ? `border-top:1px solid ${C.notaBorde};` : "";
    return `<tr><td class="bd" valign="top" style="${arriba}padding:11px 0 12px;">` +
      `<p class="dk-mut" style="margin:0 0 2px;${T}font-size:14px;line-height:20px;color:${C.grafito};">${escapar(etiqueta)}</p>` +
      `<p class="dk-t" style="margin:0;${T}font-size:16px;line-height:24px;font-weight:600;">${enLinea(valor).html}</p></td></tr>`;
  }).join("");
  return fila(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.notaPapel}" class="nota" style="background-color:${C.notaPapel};border:1px solid ${C.notaBorde};border-radius:8px;">` +
      `<tr><td style="padding:4px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${celdas}</table></td></tr></table>`,
    "0 40px 24px",
  );
}

function bloque(b) {
  if (b.p !== undefined) {
    const { html, text } = enLinea(b.p);
    return { html: fila(`<p class="t" style="margin:0;${T}font-size:17px;line-height:27px;">${html}</p>`), text };
  }
  if (b.h !== undefined) {
    return {
      html: regla() + fila(`<h2 class="t" style="margin:0;${T}font-size:19px;line-height:26px;font-weight:700;">${escapar(b.h)}</h2>`, "0 40px 8px"),
      text: b.h.toUpperCase(),
      subtitulo: true,
    };
  }
  if (b.ficha) return { html: ficha(b.ficha), text: b.ficha.map(([etiqueta, valor]) => `${etiqueta}: ${enLinea(valor).text}`).join("\n") };
  if (b.boton) return { html: boton(b.boton), text: `${b.boton.texto}: ${b.boton.href}` };
  throw new Error(`Bloque de correo desconocido: ${Object.keys(b).join(",")}`);
}

// Texto plano: un bloque por párrafo; el subtítulo va pegado a lo que encabeza.
const cuerpoTexto = (partes) => partes
  .filter((parte) => parte.text)
  .map((parte, i, todas) => (i ? (todas[i - 1].subtitulo ? "\n" : "\n\n") : "") + parte.text)
  .join("");

const ESTILO = `:root{color-scheme:light dark;supported-color-schemes:light dark}
a{overflow-wrap:anywhere}
@media (max-width:540px){
  .wrap{padding:16px 0 !important}
  .px{padding-left:24px !important;padding-right:24px !important}
  .h1{font-size:28px !important;line-height:35px !important}
  .btn{width:100% !important}
  .btn-a{display:block !important;padding-left:12px !important;padding-right:12px !important}
  .card{border-radius:0 !important;border-left:0 !important;border-right:0 !important}
  .band{border-radius:0 !important}
}
@media (prefers-color-scheme:dark){
  body,.bg{background-color:#0E1522 !important}
  .card{background-color:#18212F !important;border-color:#2A3649 !important}
  .t{color:#E6EBF3 !important}
  .h1{color:#B5C7F5 !important}
  .mut{color:#A9B5C8 !important}
  .lnk{color:#A9C0FA !important}
  .rule{border-top-color:#2E3A4F !important}
  .nota{background-color:#202B3D !important;border-color:#33425C !important}
  .nota td{border-color:#33425C !important}
  .dk-mut,.foot-p{color:#A9B5C8 !important}
  .dk-t{color:#E6EBF3 !important}
}`;

/**
 * La hoja completa: {titulo, preheader, antetitulo?, encabezado, bloques,
 * motivo, vendedor?, base} → {html, text}. `motivo` es la línea del pie que
 * dice por qué llegó el correo (nombra al destinatario); `vendedor` es la
 * línea de quién vende; `base` el origen del sitio para los enlaces del pie.
 */
export function maquetar({ titulo, preheader, antetitulo = null, encabezado, bloques, motivo, vendedor = null, base = SITIO }) {
  const partes = bloques.map(bloque);
  const cuenta = `${base}/cuenta`;
  const sitioCorto = base.replace(/^https?:\/\//, "");
  // Relleno invisible: que el cuerpo no se cuele en la vista previa tras el preheader.
  const relleno = "&#8199;&#847;".repeat(60);
  const pie = `font-family:${FUENTE};font-size:14px;line-height:22px;color:${C.pie};`;
  const enlacePie = `class="lnk" style="color:${C.azul};text-decoration:underline;"`;
  const html = `<!doctype html>
<html lang="es-CL" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapar(titulo)}</title>
<style>
${ESTILO}
</style>
<!--[if mso]><style>body,table,td,p,a,h1,h2,strong{font-family:'Segoe UI',Arial,sans-serif !important}</style><![endif]-->
</head>
<body class="bg" style="margin:0;padding:0;background-color:${C.mesa};" bgcolor="${C.mesa}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.mesa};">${escapar(preheader)}${relleno}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${C.mesa}" style="background-color:${C.mesa};">
<tr><td align="center" class="wrap" style="padding:32px 16px 40px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="${C.hoja}" style="width:100%;max-width:600px;background-color:${C.hoja};border:1px solid ${C.regla};border-radius:12px;overflow:hidden;">
<tr><td class="band px" bgcolor="${C.banda}" style="background-color:${C.banda};padding:14px 40px;border-radius:11px 11px 0 0;">
<a href="${escapar(base)}" style="text-decoration:none;color:#FFFFFF;"><img src="${LOGO_URL}" width="104" height="32" alt="pteron" style="display:block;border:0;outline:none;width:104px;height:32px;font-family:${FUENTE};font-size:24px;line-height:32px;font-weight:700;color:#FFFFFF;"></a>
</td></tr>
<tr><td class="px" style="padding:36px 40px 12px;">${antetitulo ? `
<p class="mut" style="margin:0 0 8px;${T}font-size:14px;line-height:20px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${C.grafito};">${escapar(antetitulo)}</p>` : ""}
<h1 class="h1" style="margin:0;font-family:${FUENTE};font-size:33px;line-height:40px;font-weight:700;letter-spacing:-.012em;color:${C.azul};">${escapar(encabezado)}</h1>
</td></tr>
<tr><td style="padding:8px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${partes.map((parte) => parte.html).join("\n")}
</table>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td class="foot px" style="padding:24px 40px 0;${pie}">
<p class="foot-p" style="margin:0 0 8px;${pie}">${escapar(motivo)}</p>
<p class="foot-p" style="margin:0 0 8px;${pie}"><a href="${escapar(cuenta)}" ${enlacePie}>Tu cuenta de pteron</a> · <a href="${escapar(base)}" ${enlacePie}>${escapar(sitioCorto)}</a></p>${vendedor ? `
<p class="foot-p" style="margin:0;${pie}">${escapar(vendedor)}</p>` : ""}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
  const text = [
    ...(antetitulo ? [antetitulo.toUpperCase()] : []),
    encabezado,
    "",
    cuerpoTexto(partes),
    "",
    "—",
    motivo,
    `Tu cuenta de pteron: ${cuenta}`,
    ...(vendedor ? [vendedor] : []),
  ].join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
  return { html, text };
}
