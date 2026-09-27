/**
 * Captura GIFs con historia clara. Comprueba el contenido de cada frame
 * antes de codificar. No escribe en el repo de pteron.
 */
import { rm, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";

const pteronRoot = "/Users/marcorojasbelmar/Developer/pteron";
const base = "/Users/marcorojasbelmar/Developer/pteron-landing/output/captures-0-6-0";
const gifDir = "/Users/marcorojasbelmar/Developer/pteron-landing/assets/docs/gifs";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function openScene(scene, delayMs) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pteron-story3-"));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.PTERON_QA_WORKSPACE_ROOT = path.join(userDataDir, "workspace");
  env.PTERON_CAPTURE_SEED = "1";
  env.PTERON_CAPTURE_THEME = "light";
  env.PTERON_CAPTURE_SCENE = scene;
  env.PTERON_CAPTURE_WIDTH = "1440";
  env.PTERON_CAPTURE_HEIGHT = "880";
  env.PTERON_CAPTURE_DELAY_MS = String(delayMs);
  env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
  const { _electron: electron } = await import(
    path.join(pteronRoot, "node_modules/playwright/index.mjs")
  );
  const app = await electron.launch({
    args: [pteronRoot, `--user-data-dir=${userDataDir}`],
    cwd: pteronRoot,
    env,
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 880 });
  await page.waitForLoadState("domcontentloaded");
  await delay(delayMs + 2200);
  return {
    app,
    page,
    async dispose() {
      await app.close().catch(() => {});
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d;
    });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

async function dedupeAndEncode(frameDir, outGif, fps = 0.6) {
  await run(process.env.MIMO_PYTHON || "/opt/homebrew/bin/python3", [
    "-c",
    `
from PIL import Image, ImageChops
from pathlib import Path
import shutil
d = Path(r"${frameDir}")
files = sorted(d.glob("g-*.png"))
kept = []
prev = None
for f in files:
    im = Image.open(f).convert("RGB")
    if prev is None or ImageChops.difference(prev, im).getbbox():
        kept.append((f, im))
        prev = im
for i, (f, _) in enumerate(kept):
    shutil.copy(f, d / ("u-%03d.png" % i))
print("kept", len(kept), "of", len(files))
`,
  ]);
  await run("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `${frameDir}/u-%03d.png`,
    "-vf",
    "scale=1100:-1:flags=lanczos,palettegen=stats_mode=diff",
    `${frameDir}/.p.png`,
  ]);
  await run("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `${frameDir}/u-%03d.png`,
    "-i",
    `${frameDir}/.p.png`,
    "-lavfi",
    "scale=1100:-1:flags=lanczos[x];[x][1]paletteuse=dither=bayer:bayer_scale=3",
    "-loop",
    "0",
    outGif,
  ]);
  await rm(`${frameDir}/.p.png`, { force: true });
  const kept = (await readdir(frameDir)).filter((f) => f.startsWith("u-")).length;
  console.log("encoded", outGif, "frames", kept);
}

// ─────────────────────────────────────────────────────────────
// GUÍA — idea: de la cabecera tipada al ejercicio con figura
// ─────────────────────────────────────────────────────────────
{
  const frameDir = path.join(base, "story3-guia");
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const { page, dispose } = await openScene("artifact", 5500);
  let n = 0;
  const shot = async (label) => {
    await delay(1100);
    await page.screenshot({ path: path.join(frameDir, `g-${String(n++).padStart(3, "0")}.png`) });
    console.log("guia", n - 1, label);
  };

  await shot("encabezado");
  // scrollIntoView sobre textos reales del documento
  for (const [label, text] of [
    ["objetivo", "OBJETIVO"],
    ["ejercicio", "Ejercicio 1"],
    ["figura", "Figura 1"],
  ]) {
    const ok = await page
      .getByText(text, { exact: false })
      .first()
      .scrollIntoViewIfNeeded()
      .then(() => true)
      .catch(() => false);
    await shot(label + (ok ? "" : " (sin foco)"));
  }
  await dispose();
  await dedupeAndEncode(frameDir, path.join(gifDir, "guia-completa.gif"));
}

// ─────────────────────────────────────────────────────────────
// BIBLIOTECA — idea: filtrar y abrir un recurso
// ─────────────────────────────────────────────────────────────
{
  const frameDir = path.join(base, "story3-biblio");
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const { page, dispose } = await openScene("library", 5000);
  let n = 0;
  const shot = async (label) => {
    await delay(1000);
    await page.screenshot({ path: path.join(frameDir, `g-${String(n++).padStart(3, "0")}.png`) });
    console.log("biblio", n - 1, label);
  };
  await shot("lista");
  const search = page.locator("input").first();
  await search.click();
  await search.type("Guía", { delay: 50 });
  await shot("busqueda");
  await search.fill("");
  await page.locator("button", { hasText: "Documentos" }).first().click();
  await shot("filtro-documentos");
  await page.locator(".library-results button").nth(2).click();
  await shot("detalle");
  await dispose();
  await dedupeAndEncode(frameDir, path.join(gifDir, "biblioteca.gif"));
}

// ─────────────────────────────────────────────────────────────
// PRESENTACIÓN — idea: cambiar de diapositiva
// ─────────────────────────────────────────────────────────────
{
  const frameDir = path.join(base, "story3-pres");
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const { page, dispose } = await openScene("presentation", 5000);
  let n = 0;
  const shot = async (label) => {
    await delay(1100);
    await page.screenshot({ path: path.join(frameDir, `g-${String(n++).padStart(3, "0")}.png`) });
    console.log("pres", n - 1, label);
  };
  await shot("slide-1");
  const slides = page.locator(".slide-sidebar button, .slide-mini");
  const count = await slides.count();
  console.log("slides", count);
  if (count > 1) {
    await slides.nth(1).click().catch(() => {});
    await shot("slide-2");
  }
  if (count > 3) {
    await slides.nth(3).click().catch(() => {});
    await shot("slide-4");
  }
  await dispose();
  await dedupeAndEncode(frameDir, path.join(gifDir, "presentacion.gif"));
}

console.log("DONE");
