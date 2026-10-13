/**
 * El kit del lenguaje visual de pteron: todo lo necesario para aplicar la marca y alinear la app, en una carpeta y en
 * un .zip que no varían. No dibuja nada: junta los archivos que ya escribieron scripts/marca.mjs (public/assets y
 * kit/archivos) y scripts/kit-letras.py, escribe los tokens en CSS y TypeScript desde kit/tokens.json, mide los
 * contrastes, y arma un manifiesto con el SHA-256 de cada archivo.
 *
 *   node scripts/kit.mjs             escribe dist/kit/pteron-lenguaje-<versión>/, dist/pteron-lenguaje-<versión>.zip
 *                                    (completo, con lo de la app) y public/assets/marca/pteron-marca-<versión>.zip
 *                                    (lo público: marca, icono, color y letras, con su guía)
 *   node scripts/kit.mjs --revisar   sólo comprueba que el .zip público esté al día (lo usa la prueba)
 *
 * Los .zip guardan cada archivo sin comprimir, en orden y con una fecha fija: el mismo contenido da los mismos bytes en
 * cualquier máquina, y su suma no cambia si nada cambió. Sin dependencias.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { raiz } from "./marca-dibujos.mjs";

const tokens = JSON.parse(readFileSync(path.join(raiz, "kit/tokens.json"), "utf8"));
export const VERSION = tokens.$extensions.pteron.version;
export const FECHA = tokens.$extensions.pteron.fecha;
const CARPETA = `pteron-lenguaje-${VERSION}`;

const sitio = (rel) => path.join(raiz, "public", rel);
const kit = (rel) => path.join(raiz, "kit", rel);

// ——— Tokens: de kit/tokens.json a CSS y TypeScript ———

/** Los colores de un grupo como [nombre, valor, descripción], aplanando los subgrupos (estado.ok → estado-ok). */
function colores(grupo, prefijo = "") {
  return Object.entries(grupo).flatMap(([nombre, valor]) => {
    if (nombre.startsWith("$")) return [];
    if (valor && typeof valor === "object" && "$value" in valor) return [[`${prefijo}${nombre}`, valor.$value, valor.$description || ""]];
    return colores(valor, `${prefijo}${nombre}-`);
  });
}
export const COLORES = colores(tokens.color);
export const COLORES_OSCURO = colores(tokens["color-oscuro"]);
/** Lo que sólo usa la app (el rótulo y el lavado): no está en el CSS del sitio. */
export const COLORES_APP = colores(tokens["color-app"]);

function tokensCSS() {
  const claro = [...COLORES, ...COLORES_APP.filter(([n]) => !n.endsWith("-oscuro"))]
    .map(([n, v, desc]) => `  --pteron-${n}: ${v};${desc ? ` /* ${desc} */` : ""}`)
    .join("\n");
  const enOscuro = [...COLORES_OSCURO, ...COLORES_APP.filter(([n]) => n.endsWith("-oscuro")).map(([n, v]) => [n.replace(/-oscuro$/, ""), v])];
  const oscuro = enOscuro.map(([n, v]) => `    --pteron-${n}: ${v};`).join("\n");
  const oscuroForzado = enOscuro.map(([n, v]) => `  --pteron-${n}: ${v};`).join("\n");
  const curva = tokens.movimiento.curva.$value.join(", ");
  return `/* Lenguaje visual de pteron ${VERSION} (${FECHA}): los colores y medidas de kit/tokens.json, como variables CSS.
   Generado por scripts/kit.mjs; no se edita a mano. Claro por omisión; oscuro con prefers-color-scheme o
   data-theme="dark" en un ancestro. */
:root {
${claro}
  --pteron-letra-web: ${tokens.letra.web.$value.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ")};
  --pteron-letra-interfaz: ${tokens.letra["interfaz-app"].$value.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ")};
  --pteron-radio: ${tokens.forma.radio.$value};
  --pteron-radio-hoja: ${tokens.forma["radio-hoja"].$value};
  --pteron-toque: ${tokens.forma.toque.$value};
  --pteron-curva: cubic-bezier(${curva});
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${oscuro}
  }
}

[data-theme="dark"] {
${oscuroForzado}
}
`;
}

function tokensTS() {
  const lista = (pares) => pares.map(([n, v, desc]) => `${desc ? `  /** ${desc} */\n` : ""}  ${JSON.stringify(n)}: ${JSON.stringify(v)},`).join("\n");
  return `/**
 * Lenguaje visual de pteron ${VERSION} (${FECHA}): los valores de kit/tokens.json para TypeScript.
 * Generado por scripts/kit.mjs; no se edita a mano.
 */
export const COLOR = {
${lista(COLORES)}
} as const;

export const COLOR_OSCURO = {
${lista(COLORES_OSCURO)}
} as const;

/** Lo que sólo usa la app. */
export const COLOR_APP = {
${lista(COLORES_APP)}
} as const;

export const MARCA = {
  viewBox: ${JSON.stringify(tokens.marca.viewbox.$value)},
  /** El espacio libre por lado, en unidades del contorno: el alto de la «o». */
  aire: ${tokens.marca.aire.$value},
  minimoPantallaPx: ${parseFloat(tokens.marca["minimo-pantalla"].$value)},
  minimoPapelMm: ${parseFloat(tokens.marca["minimo-papel"].$value)},
} as const;

export const ICONO = {
  lienzo: ${tokens.icono.lienzo.$value},
  radio: ${tokens.icono.radio.$value},
  radioFavicon: ${tokens.icono["radio-favicon"].$value},
} as const;

export type ColorPteron = keyof typeof COLOR;
`;
}

// ——— Contraste (WCAG 2.2) ———

const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Los pares de texto que el lenguaje usa, con el mínimo que deben cumplir (4,5 texto; 3 texto grande o controles). */
export const PARES = [
  ["tinta", "mesa", 4.5], ["tinta", "hoja", 4.5], ["azul", "mesa", 4.5], ["azul", "hoja", 4.5],
  ["grafito", "mesa", 4.5], ["grafito", "hoja", 4.5], ["suave", "hoja", 4.5], ["hoja", "azul", 4.5],
  ["azul-hondo", "lapiz", 4.5], ["tinta", "lapiz", 4.5], ["sobre-azul", "azul", 4.5], ["sobre-azul-claro", "azul", 4.5],
  ["estado-ok", "estado-ok-papel", 4.5], ["estado-error", "estado-error-papel", 4.5], ["linea", "hoja", 1],
];
export const PARES_OSCURO = [
  ["tinta", "mesa", 4.5], ["tinta", "hoja", 4.5], ["azul", "mesa", 4.5], ["azul", "hoja", 4.5], ["grafito", "mesa", 4.5],
  ["grafito", "hoja", 4.5], ["suave", "mesa", 4.5], ["suave", "hoja", 4.5], ["mesa", "azul", 4.5], ["mesa", "lapiz", 4.5],
];
/** Los niveles de texto de la app sobre la mesa, la hoja y el lavado (paleta clara más lo de la app). */
export const PARES_APP = [
  ["rotulo", "mesa", 4.5], ["rotulo", "hoja", 4.5], ["rotulo", "lavado", 4.5], ["grafito", "lavado", 4.5], ["tinta", "lavado", 4.5],
];

function tablaContraste() {
  const valor = (pares, nombre) => Object.fromEntries(pares)[nombre];
  const fila = (pares, [a, b, minimo]) => {
    const c = contraste(valor(pares, a), valor(pares, b));
    return `| ${a} sobre ${b} | ${valor(pares, a)} / ${valor(pares, b)} | ${c.toFixed(2).replace(".", ",")} : 1 | ${minimo > 1 ? (c >= minimo ? "cumple" : "NO CUMPLE") : "borde, no texto"} |`;
  };
  return [
    `# Contrastes del lenguaje ${VERSION}`,
    "",
    "Medidos con la fórmula de WCAG 2.2. Texto normal: 4,5 : 1 como mínimo. Generado por scripts/kit.mjs.",
    "",
    "## Claro",
    "",
    "| Par | Colores | Contraste | |",
    "| --- | --- | --- | --- |",
    ...PARES.map((p) => fila(COLORES, p)),
    "",
    "## Oscuro (la app)",
    "",
    "| Par | Colores | Contraste | |",
    "| --- | --- | --- | --- |",
    ...PARES_OSCURO.map((p) => fila(COLORES_OSCURO, p)),
    "",
    "## La app, claro (el rótulo y el lavado)",
    "",
    "| Par | Colores | Contraste | |",
    "| --- | --- | --- | --- |",
    ...PARES_APP.map((p) => fila([...COLORES, ...COLORES_APP], p)),
    "",
  ].join("\n");
}

// ——— El plan del kit: qué va, de dónde sale y si va también en el .zip público ———

const PUBLICO = true;
const INTERNO = false;

function plan() {
  const archivos = [
    ["LEEME.md", kit("LEEME.md"), PUBLICO, "Qué hay en el kit y por dónde empezar."],
    ["LENGUAJE.md", kit("LENGUAJE.md"), PUBLICO, "El lenguaje visual completo: marca, icono, color, letra, geometría, láminas, la hoja, la interfaz y la voz."],
    ["CAMBIOS.md", kit("CAMBIOS.md"), PUBLICO, "Las versiones del lenguaje."],
    // La marca
    ["marca/marca.svg", sitio("assets/marca.svg"), PUBLICO, "El dibujo original: el contorno de la marca como <symbol id=\"pteron\">. Todo lo demás sale de aquí."],
    ...["azul", "tinta", "blanco"].flatMap((c) => [
      [`marca/pteron-${c}.svg`, sitio(`assets/marca/pteron-${c}.svg`), PUBLICO, `La marca en ${c}, con su espacio libre (el alto de la «o»).`],
      [`marca/pteron-${c}.png`, sitio(`assets/marca/pteron-${c}.png`), PUBLICO, `La marca en ${c}, con su espacio libre, 2160 px de ancho.`],
      [`marca/pteron-${c}-ajustada.svg`, kit(`archivos/marca/pteron-${c}-ajustada.svg`), PUBLICO, `La marca en ${c}, ajustada a su dibujo (para imprenta o interfaz: el aire se mide aparte).`],
      [`marca/pteron-${c}-ajustada.png`, kit(`archivos/marca/pteron-${c}-ajustada.png`), PUBLICO, `La marca en ${c}, ajustada a su dibujo, 1600 px de ancho.`],
    ]),
    // El icono
    ["icono/p-azul.svg", sitio("assets/marca/p-azul.svg"), PUBLICO, "El icono: la «p» blanca sobre el azul, radio 229 en 1024."],
    ["icono/p-azul.png", sitio("assets/marca/p-azul.png"), PUBLICO, "El icono, 1024 px."],
    ["icono/p-blanco.svg", sitio("assets/marca/p-blanco.svg"), PUBLICO, "La «p» azul sobre blanco, radio 229."],
    ["icono/p-blanco.png", kit("archivos/icono/p-blanco.png"), PUBLICO, "La «p» azul sobre blanco, 1024 px."],
    ["icono/p-azul-sangre.svg", kit("archivos/icono/p-azul-sangre.svg"), PUBLICO, "El icono a sangre, sin radio: para sistemas que ponen su propia máscara."],
    ["icono/p-azul-sangre.png", kit("archivos/icono/p-azul-sangre.png"), PUBLICO, "El icono a sangre, 1024 px."],
    ["icono/p-azul-perfil.svg", kit("archivos/icono/p-azul-perfil.svg"), PUBLICO, "Para fotos de perfil que se recortan en círculo: la letra en el 80 % central."],
    ["icono/p-azul-perfil.png", kit("archivos/icono/p-azul-perfil.png"), PUBLICO, "Foto de perfil, 1024 px."],
    ["icono/favicon.svg", sitio("assets/icono-v4.svg"), PUBLICO, "El favicon: la letra más grande y radio 200."],
    ["icono/favicon.ico", sitio("favicon.ico"), PUBLICO, "El favicon para navegadores y accesos directos (16, 32 y 48 px)."],
    ["icono/favicon-16.png", sitio("assets/favicon-v5-16.png"), PUBLICO, "16 px, con la letra engruesada."],
    ["icono/favicon-32.png", sitio("assets/favicon-v5-32.png"), PUBLICO, "32 px, con la letra engruesada."],
    ["icono/favicon-48.png", sitio("assets/favicon-v5-48.png"), PUBLICO, "48 px."],
    ["icono/apple-touch-icon.png", sitio("assets/apple-touch-icon-v4.png"), PUBLICO, "iPhone y iPad (180 px, a sangre: el sistema pone la máscara)."],
    ["icono/android-192.png", sitio("assets/app-icon-v5-192.png"), PUBLICO, "Android y accesos directos, 192 px."],
    ["icono/android-512.png", sitio("assets/app-icon-v5-512.png"), PUBLICO, "Android y accesos directos, 512 px."],
    ["icono/android-mascara.png", sitio("assets/app-icon-v4-mascara.png"), PUBLICO, "Android con máscara (círculo o gota), 512 px."],
    ["icono/p-azul-macos.svg", kit("archivos/icono/p-azul-macos.svg"), PUBLICO, "El icono en la cuadrícula de macOS: el cuadrado de 824 en el lienzo de 1024."],
    ["icono/p-azul-macos.png", kit("archivos/icono/p-azul-macos.png"), PUBLICO, "El icono en la cuadrícula de macOS, 1024 px."],
    // El icono de la app
    ["app/build/icon.svg", kit("archivos/app/icon.svg"), PUBLICO, "Para reemplazar build/icon.svg en la app: el mismo dibujo del icono, radio 229."],
    ["app/build/icon.png", kit("archivos/app/icon.png"), PUBLICO, "build/icon.png para Linux y respaldo, 1024 px."],
    ["app/build/icon.ico", kit("archivos/app/icon.ico"), PUBLICO, "build/icon.ico para Windows (16 a 256 px; hasta 32 px con la letra engruesada)."],
    ["app/build/icon.icns", kit("archivos/app/icon.icns"), PUBLICO, "build/icon.icns para macOS (16 a 1024 px), en el cuadrado de 824 de su cuadrícula."],
    ...[16, 24, 32, 48, 64, 128, 256, 512].map((px) => [`app/build/icons/${px}x${px}.png`, kit(`archivos/app/icons/${px}x${px}.png`), PUBLICO, `build/icons/ para Linux: ${px} px${px <= 32 ? ", con la letra engruesada" : ""}.`]),
    // Color
    ["color/tokens.json", kit("tokens.json"), PUBLICO, "La fuente única: colores (claro y oscuro), letra, marca, icono, geometría, hoja, forma y movimiento."],
    ["color/tokens.css", { texto: tokensCSS }, PUBLICO, "Los mismos valores como variables CSS (--pteron-*), con el tema oscuro."],
    ["color/tokens.ts", { texto: tokensTS }, PUBLICO, "Los mismos valores para TypeScript."],
    ["color/CONTRASTES.md", { texto: tablaContraste }, PUBLICO, "El contraste de cada par de texto, claro y oscuro."],
    // Letras
    ["letras/Archivo.ttf", kit("archivos/letras/Archivo.ttf"), PUBLICO, "Archivo, variable (peso 100 a 900, ancho 62 a 125 %), para instalar en el computador."],
    ["letras/Outfit.ttf", kit("archivos/letras/Outfit.ttf"), PUBLICO, "Outfit, variable (peso 100 a 900): la misma de pteron (pteron-design 6.0.0), con los signos de sus figuras, para instalar en el computador."],
    ["letras/web/archivo-latin-wdth-normal.woff2", sitio("assets/fonts/archivo-latin-wdth-normal.woff2"), PUBLICO, "Archivo para la web (latín)."],
    ["letras/web/archivo-latin-ext-wdth-normal.woff2", sitio("assets/fonts/archivo-latin-ext-wdth-normal.woff2"), PUBLICO, "Archivo para la web (latín extendido)."],
    ["letras/web/outfit-latin-wght-normal.woff2", sitio("assets/fonts/outfit-latin-wght-normal.woff2"), PUBLICO, "Outfit para la web (latín)."],
    ["letras/web/outfit-latin-ext-wght-normal.woff2", sitio("assets/fonts/outfit-latin-ext-wght-normal.woff2"), PUBLICO, "Outfit para la web (latín extendido)."],
    ["letras/LICENCIA-OFL.txt", sitio("assets/fonts/LICENSE-OFL.txt"), PUBLICO, "La licencia de Archivo y Outfit (SIL Open Font License 1.1)."],
    // Verificación
    ["verificar.mjs", kit("verificar.mjs"), PUBLICO, "Comprueba, con Node y sin dependencias, que cada archivo coincida con su suma del manifiesto."],
  ];
  // Muestras y la alineación de la app: lo que haya en kit/muestras y kit/app (lo de la app es interno)
  for (const [carpeta, publico] of [["muestras", PUBLICO], ["app", INTERNO]]) {
    const base = kit(carpeta);
    if (!existsSync(base)) continue;
    for (const rel of listar(base)) {
      const descripcion = DESCRIPCIONES[`${carpeta}/${rel}`];
      // Cada archivo del kit dice para qué es: uno nuevo sin descripción detiene el armado en vez de entrar mudo.
      if (!descripcion) throw new Error(`kit/descripciones.json no describe ${carpeta}/${rel}`);
      archivos.push([`${carpeta === "app" ? "app" : carpeta}/${rel}`, path.join(base, rel), publico, descripcion]);
    }
  }
  return archivos;
}

/** Descripciones de lo que vive en kit/muestras y kit/app (el resto la trae el plan). */
const DESCRIPCIONES = existsSync(kit("descripciones.json")) ? JSON.parse(readFileSync(kit("descripciones.json"), "utf8")) : {};

function listar(base, rel = "") {
  return readdirSync(path.join(base, rel))
    .sort()
    .flatMap((nombre) => {
      const r = rel ? `${rel}/${nombre}` : nombre;
      return statSync(path.join(base, r)).isDirectory() ? listar(base, r) : [r];
    });
}

// ——— El .zip, sin dependencias: cada archivo guardado tal cual, en orden y con fecha fija ———

function dosFecha(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  return { hora: 0, dia: ((a - 1980) << 9) | (m << 5) | d };
}

export function zip(entradas) {
  const { hora, dia } = dosFecha(FECHA);
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, datos] of entradas) {
    const n = Buffer.from(nombre, "utf8");
    const crc = crc32(datos) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(0, 8); // sin comprimir
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, n, datos);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4); // hecho en Unix, versión 3.0
    central.writeUInt16LE(10, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // archivo normal, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrales.push(central, n);
    offset += 30 + n.length + datos.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

const sha256 = (datos) => createHash("sha256").update(datos).digest("hex");

/** El contenido del kit: [ruta, bytes, público, descripción], más el manifiesto. */
export function armar() {
  const archivos = plan().map(([ruta, fuente, publico, descripcion]) => {
    const datos = typeof fuente === "string" ? readFileSync(fuente) : Buffer.from(fuente.texto(), "utf8");
    return { ruta, datos, publico, descripcion };
  });
  const rutas = new Set();
  for (const a of archivos) {
    if (rutas.has(a.ruta)) throw new Error(`kit: ${a.ruta} está dos veces`);
    rutas.add(a.ruta);
  }
  const manifiesto = (lista) =>
    Buffer.from(
      `${JSON.stringify(
        {
          nombre: "pteron · lenguaje visual",
          version: VERSION,
          fecha: FECHA,
          archivos: lista.map((a) => ({ ruta: a.ruta, bytes: a.datos.length, sha256: sha256(a.datos), descripcion: a.descripcion })),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  const completo = [...archivos].sort((a, b) => a.ruta.localeCompare(b.ruta, "en"));
  const publico = completo.filter((a) => a.publico);
  return {
    completo: [...completo, { ruta: "manifiesto.json", datos: manifiesto(completo) }],
    publico: [...publico, { ruta: "manifiesto.json", datos: manifiesto(publico) }],
  };
}

export const ZIP_PUBLICO = `assets/marca/pteron-marca-${VERSION}.zip`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(raiz, "scripts/kit.mjs")) {
  const { completo, publico } = armar();
  const zipPublico = zip(publico.map((a) => [`pteron-marca-${VERSION}/${a.ruta}`, a.datos]));
  if (process.argv.includes("--revisar")) {
    const actual = existsSync(sitio(ZIP_PUBLICO)) ? readFileSync(sitio(ZIP_PUBLICO)) : Buffer.alloc(0);
    if (!actual.equals(zipPublico)) {
      console.error(`desactualizado: public/${ZIP_PUBLICO} (node scripts/kit.mjs)`);
      process.exit(1);
    }
    process.exit(0);
  }
  // La carpeta del kit completo, para revisarlo sin descomprimir
  const destino = path.join(raiz, "dist/kit", CARPETA);
  rmSync(destino, { recursive: true, force: true });
  for (const a of completo) {
    mkdirSync(path.dirname(path.join(destino, a.ruta)), { recursive: true });
    writeFileSync(path.join(destino, a.ruta), a.datos);
  }
  const zipCompleto = zip(completo.map((a) => [`${CARPETA}/${a.ruta}`, a.datos]));
  writeFileSync(path.join(raiz, `dist/${CARPETA}.zip`), zipCompleto);
  writeFileSync(sitio(ZIP_PUBLICO), zipPublico);
  const kb = (b) => `${Math.round(b.length / 1024)} KB`;
  console.log(`kit: dist/${CARPETA}.zip (${completo.length} archivos, ${kb(zipCompleto)}) · sha256 ${sha256(zipCompleto)}`);
  console.log(`kit: public/${ZIP_PUBLICO} (${publico.length} archivos, ${kb(zipPublico)}) · sha256 ${sha256(zipPublico)}`);
}
