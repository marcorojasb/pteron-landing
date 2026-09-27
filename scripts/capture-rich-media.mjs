/**
 * Extrae del build de pteron 0.6.0 figuras ricas y GIFs.
 * No escribe en el repositorio de pteron.
 *
 * Uso: node scripts/capture-rich-media.mjs
 */
import { mkdir, rm, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";

const pteronRoot = "/Users/marcorojasbelmar/Developer/pteron";
const outDir = "/Users/marcorojasbelmar/Developer/pteron-landing/output/captures-0-6-0";
const framesDir = path.join(outDir, "frames");
const gifDir = path.join(outDir, "gifs");

const WIDTH = 1440;
const HEIGHT = 880;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function encodeGif(framePattern, outGif, fps = 6) {
  // paleta + gif con ffmpeg (determinista y sin dependencias extra)
  const palette = outGif.replace(/\.gif$/, "-palette.png");
  await new Promise((resolve, reject) => {
    const p = spawn(
      "/opt/homebrew/bin/ffmpeg",
      ["-y", "-framerate", String(fps), "-i", framePattern, "-vf", "palettegen=stats_mode=diff", palette],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("palette " + c))));
  });
  await new Promise((resolve, reject) => {
    const p = spawn(
      "/opt/homebrew/bin/ffmpeg",
      [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        framePattern,
        "-i",
        palette,
        "-lavfi",
        "paletteuse=dither=bayer:bayer_scale=3",
        "-loop",
        "0",
        outGif,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("gif " + c))));
  });
  await rm(palette, { force: true });
}

async function launchWithScene(scene, fn) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pteron-rich-"));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.PTERON_QA_WORKSPACE_ROOT = path.join(userDataDir, "workspace");
  env.PTERON_CAPTURE_SEED = "1";
  env.PTERON_CAPTURE_THEME = "light";
  env.PTERON_CAPTURE_SCENE = scene;
  env.PTERON_CAPTURE_WIDTH = String(WIDTH);
  env.PTERON_CAPTURE_HEIGHT = String(HEIGHT);
  env.PTERON_CAPTURE_DELAY_MS = "3500";
  env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

  const { _electron: electron } = await import(path.join(pteronRoot, "node_modules/playwright/index.mjs"));
  const app = await electron.launch({
    args: [pteronRoot, `--user-data-dir=${userDataDir}`],
    cwd: pteronRoot,
    env,
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  try {
    return await fn(page);
  } finally {
    await app.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(gifDir, { recursive: true });

  // ── 1) Guía rica (artifact abre capture-seed-guide-ready aunque el gate falle)
  console.log("== Guía rica ==");
  await launchWithScene("artifact", async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await delay(4500);
    const state = await page.evaluate(() => ({
      editor: !!document.querySelector(".meridian-editor"),
      surface: document.querySelector("[data-artifact-surface]")?.getAttribute("data-artifact-surface"),
      text: document.body.innerText.slice(0, 280),
    }));
    console.log("estado artifact:", JSON.stringify(state));
    await page.screenshot({ path: path.join(outDir, "app-guia-top-1440x880.png") });

    // scroll suave hacia abajo para GIF del documento
    const scroller = await page.$(".canvas-pane .workspace-scroll, .workspace-scroll, [data-artifact-surface]");
    for (let i = 0; i < 10; i++) {
      await page.evaluate((step) => {
        const el =
          document.querySelector(".canvas-pane .workspace-scroll") ||
          document.querySelector(".workspace-scroll") ||
          document.scrollingElement;
        if (el) el.scrollTop = (el.scrollHeight - el.clientHeight) * (step / 9);
      }, i);
      await delay(350);
      await page.screenshot({ path: path.join(framesDir, `guia-scroll-%03d.png`.replace("%03d", String(i).padStart(3, "0"))) });
    }
  });

  // ── 2) Writer con contenido real
  console.log("== Writer ==");
  await launchWithScene("writer", async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await delay(4500);
    await page.screenshot({ path: path.join(outDir, "app-write-doc-1440x880.png") });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
    console.log("writer text:", text.slice(0, 120));
  });

  // ── 3) Home rumbo → compositor (GIF corto de la interacción)
  console.log("== Home rumbo ==");
  await launchWithScene("home-rumbo", async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await delay(3500);
    for (let i = 0; i < 8; i++) {
      await page.screenshot({ path: path.join(framesDir, `home-rumbo-${String(i).padStart(3, "0")}.png`) });
      await delay(280);
    }
    await page.screenshot({ path: path.join(outDir, "app-rumbo-compositor-1440x880.png") });
  });

  // ── 4) Biblioteca (GIF de lista → detalle)
  console.log("== Biblioteca ==");
  await launchWithScene("library", async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await delay(4000);
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: path.join(framesDir, `biblioteca-${String(i).padStart(3, "0")}.png`) });
      await delay(400);
    }
    await page.screenshot({ path: path.join(outDir, "app-biblioteca-detalle-1440x880.png") });
  });

  // ── 5) Presentación
  console.log("== Presentación ==");
  await launchWithScene("presentation", async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await delay(4000);
    await page.screenshot({ path: path.join(outDir, "app-presentacion-lienzo-1440x880.png") });
    for (let i = 0; i < 5; i++) {
      await page.screenshot({ path: path.join(framesDir, `presentacion-${String(i).padStart(3, "0")}.png`) });
      await delay(350);
    }
  });

  // ── GIFs
  console.log("== GIFs ==");
  await encodeGif(path.join(framesDir, "guia-scroll-*.png"), path.join(gifDir, "guia-scroll.gif"), 5);
  await encodeGif(path.join(framesDir, "home-rumbo-*.png"), path.join(gifDir, "home-rumbo.gif"), 5);
  await encodeGif(path.join(framesDir, "biblioteca-*.png"), path.join(gifDir, "biblioteca.gif"), 4);
  await encodeGif(path.join(framesDir, "presentacion-*.png"), path.join(gifDir, "presentacion.gif"), 4);

  console.log("Listo en", outDir);
  console.log((await readdir(gifDir)).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
