/**
 * Las imágenes para compartir (Open Graph, 1200 × 630): la del inicio es su portada tal cual (láminas, marca y lema);
 * las demás páginas usan la tarjeta de scripts/og/tarjeta.html con su título y tres láminas del atlas.
 *
 *   PLAYWRIGHT=/ruta/a/playwright/index.mjs node scripts/og.mjs
 *
 * Levanta un servidor propio de public/ en un puerto libre, fotografía cada tarjeta con Chromium y escribe
 * public/assets/og/<nombre>-v6.jpg. Las páginas las enlazan en su <meta property="og:image">.
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const salida = path.join(pub, "assets/og");
const VERSION = "v6";

export const TARJETAS = [
  { nombre: "planes", titulo: "Planes", linea: "El núcleo local es gratis para siempre.", laminas: ["matematica-byrne-cuadrados", "ciencias-luna", "lenguaje-enie"] },
  { nombre: "descargar", titulo: "Descargar", linea: "Beta pública para macOS, Windows y Linux.", laminas: ["historia-ovalle", "matematica-pizarra", "ciencias-espectro"] },
  { nombre: "docs", titulo: "Documentación", linea: "Instalar, planificar, crear, evaluar y adaptar.", laminas: ["lenguaje-yciar", "ciencias-loica", "matematica-hirschvogel"] },
  { nombre: "marca", titulo: "Marca", linea: "El nombre, los colores y la letra de pteron.", laminas: ["lenguaje-muestrario", "ciencias-eclipse", "lenguaje-araucana"] },
  { nombre: "privacidad", titulo: "Privacidad", linea: "Cómo pteron protege tus archivos y datos.", laminas: ["historia-portulano", "ciencias-diatomeas", "matematica-semicirculos"] },
  { nombre: "terminos", titulo: "Términos de uso", linea: "Las condiciones de la beta pública.", laminas: ["ciencias-andes", "lenguaje-yciar", "matematica-byrne-cuadrados"] },
];

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const modulo = process.env.PLAYWRIGHT;
  if (!modulo) throw new Error("scripts/og.mjs necesita PLAYWRIGHT=/ruta/a/playwright/index.mjs");
  const { chromium } = await import(modulo);

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

  // El inicio: su portada, sin los botones ni la esquina
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".portada-acciones,.portada-nota,.portada-texto,.esquina,.saltar{display:none!important}.portada-marca{font-size:72px!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(salida, `inicio-${VERSION}.jpg`), type: "jpeg", quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`og: assets/og/inicio-${VERSION}.jpg`);

  for (const tarjeta of TARJETAS) {
    const q = new URLSearchParams({ titulo: tarjeta.titulo, linea: tarjeta.linea, laminas: tarjeta.laminas.join(",") });
    await page.goto(`${base}/__og/tarjeta.html?${q}`, { waitUntil: "networkidle" });
    await page.waitForSelector("body[data-listo]");
    await page.screenshot({ path: path.join(salida, `${tarjeta.nombre}-${VERSION}.jpg`), type: "jpeg", quality: 86 });
    console.log(`og: assets/og/${tarjeta.nombre}-${VERSION}.jpg`);
  }
  await browser.close();
  server.close();
}
