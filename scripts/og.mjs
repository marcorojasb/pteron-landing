/**
 * Las imágenes para compartir (Open Graph, 1200 × 630), con la plantilla de scripts/og/tarjeta.html: la marca, el título
 * de la página y un dato, en el cuadrado del centro (lo que WhatsApp deja en su vista previa chica); a los lados, una
 * lámina y su reverso, la figura que pteron dibuja para ella, tal como están en el inicio.
 *
 *   PLAYWRIGHT=/ruta/a/playwright/index.mjs node scripts/og.mjs
 *
 * Levanta un servidor propio de public/ en un puerto libre, fotografía cada tarjeta con Chromium, escribe
 * public/assets/og/<nombre>-v8.jpg y deja al día, en cada página, og:image, twitter:image y el texto alternativo.
 * /assets se sirve inmutable: una tarjeta que cambia cambia de nombre (VERSION).
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAMINAS } from "./pteron-hojas/materiales.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const salida = path.join(pub, "assets/og");
export const VERSION = "v8";

export const TARJETAS = [
  { nombre: "inicio", pagina: "index.html", titulo: "Construido por profes, para profes.", lineas: 3, linea: "Guías, pruebas y planificaciones, en tu computador.", lamina: "matematica-pizarra" },
  { nombre: "planes", pagina: "planes/index.html", titulo: "Planes", linea: "El núcleo local es gratis para siempre.", nota: "Basic y Pro agregan IA incluida.", lamina: "ciencias-luna" },
  { nombre: "descargar", pagina: "descargar/index.html", titulo: "Descargar", linea: "Mac con chip M1, Windows 11 y Linux.", nota: "Beta gratuita. El instalador de Windows aún no tiene firma.", lamina: "historia-ovalle" },
  { nombre: "docs", pagina: "docs/index.html", titulo: "Documentación", linea: "Instalar, planificar, crear, evaluar y adaptar.", lamina: "lenguaje-yciar" },
  { nombre: "marca", pagina: "marca/index.html", titulo: "Marca", linea: "El nombre, los colores y la letra de pteron.", lamina: "lenguaje-muestrario" },
  { nombre: "privacidad", pagina: "privacidad.html", titulo: "Privacidad", linea: "Cómo pteron protege tus archivos y datos.", lamina: "historia-portulano" },
  { nombre: "terminos", pagina: "terminos.html", titulo: "Términos de uso", linea: "Las condiciones de la beta pública.", lamina: "ciencias-andes" },
  { nombre: "cuenta", pagina: "cuenta/index.html", titulo: "Cuenta", linea: "Tu plan y la activación de tus equipos.", lamina: "matematica-byrne-cuadrados" },
];

/** El reverso de una lámina, tal como lo arma el inicio (scripts/pteron-hojas.mjs): su recorte, su figura y su pie. */
export function reverso(archivo, inicio = readFileSync(path.join(pub, "index.html"), "utf8")) {
  const desde = inicio.indexOf(`data-lamina="${archivo}"`);
  const abre = inicio.indexOf('<div class="lamina-reverso"', desde);
  if (desde < 0 || abre < 0) throw new Error(`og: el inicio no trae el reverso de ${archivo}`);
  // El bloque termina donde se cierra su div (lleva divs adentro)
  const etiquetas = /<\/?div\b[^>]*>/g;
  etiquetas.lastIndex = abre;
  let nivel = 0;
  for (let m; (m = etiquetas.exec(inicio)); ) {
    nivel += m[0].startsWith("</") ? -1 : 1;
    if (nivel === 0) return inicio.slice(abre, m.index + m[0].length);
  }
  throw new Error(`og: el reverso de ${archivo} no se cierra`);
}

/** El texto alternativo: lo que dice la tarjeta y qué lámina y figura van a los lados, con su crédito. */
export function textoAlternativo(tarjeta, inicio) {
  const lamina = LAMINAS.find((item) => item.archivo === tarjeta.lamina);
  const figura = /<title[^>]*>([^<]+)<\/title>/.exec(reverso(tarjeta.lamina, inicio))?.[1];
  const origen = lamina.fuente === "Pieza propia" ? `una pieza propia, ${lamina.obra.toLocaleLowerCase("es")},` : `${lamina.obra} (${lamina.fuente})`;
  return `«${tarjeta.titulo}» junto a la marca pteron; a los lados, ${origen} y la figura que pteron dibuja para ella: ${figura}.`;
}

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const modulo = process.env.PLAYWRIGHT;
  if (!modulo) throw new Error("scripts/og.mjs necesita PLAYWRIGHT=/ruta/a/playwright/index.mjs");
  const { chromium } = await import(modulo);
  const inicio = readFileSync(path.join(pub, "index.html"), "utf8");

  // public/ y la tarjeta en /__og/
  const server = createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = ruta.startsWith("/__og/") ? path.join(root, "scripts/og", ruta.slice(6)) : path.join(pub, ruta);
    try {
      if (statSync(file).isDirectory()) file = path.join(file, "index.html");
      res.writeHead(200, { "content-type": TIPOS[path.extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  mkdirSync(salida, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();

  for (const tarjeta of TARJETAS) {
    const q = new URLSearchParams({ titulo: tarjeta.titulo, linea: tarjeta.linea, nota: tarjeta.nota || "", lineas: String(tarjeta.lineas || 2), lamina: tarjeta.lamina });
    await page.goto(`${base}/__og/tarjeta.html?${q}`, { waitUntil: "networkidle" });
    await page.evaluate((html) => {
      document.getElementById("reverso").innerHTML = html;
      return window.armar();
    }, reverso(tarjeta.lamina, inicio));
    await page.waitForSelector("body[data-listo]");
    await page.waitForLoadState("networkidle");
    const imagen = `${tarjeta.nombre}-${VERSION}.jpg`;
    await page.screenshot({ path: path.join(salida, imagen), type: "jpeg", quality: 86 });

    // La página enlaza su tarjeta y la describe
    const archivo = path.join(pub, tarjeta.pagina);
    const url = `https://pteron.patagua.dev/assets/og/${imagen}`;
    const alt = textoAlternativo(tarjeta, inicio).replace(/"/g, "&quot;");
    let html = readFileSync(archivo, "utf8");
    const antes = html;
    html = html
      .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${url}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${url}$2`)
      .replace(/(<meta property="og:image:alt" content=")[^"]*(">)/, `$1${alt}$2`);
    if (!html.includes(url)) throw new Error(`og: ${tarjeta.pagina} no trae sus etiquetas og:image y twitter:image`);
    if (html !== antes) writeFileSync(archivo, html);
    console.log(`og: assets/og/${imagen} · ${tarjeta.pagina}`);
  }
  await browser.close();
  server.close();
}
