/**
 * Extrae capturas del producto pteron (build ya compilado en out/) hacia la
 * landing, sin escribir nada dentro del repositorio de pteron.
 *
 * Uso: node scripts/extract-pteron-captures.mjs
 * Requiere: /Users/marcorojasbelmar/Developer/pteron ya construido (out/main/index.js).
 */
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const landingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pteronRoot = "/Users/marcorojasbelmar/Developer/pteron";
const outDir = path.join(landingRoot, "output", "captures-0-6-0");

// Escena del arnés → nombre de figura en la documentación de la landing.
const SCENES = [
  ["home", "app-inicio"],
  ["home-rumbo", "app-rumbo"],
  ["tabs", "app-sesiones"],
  ["memory", "app-memoria"],
  ["conversacion", "app-conversacion"],
  ["library", "app-biblioteca"],
  ["plan-ready", "app-plan"],
  ["revision", "app-revision"],
  ["pdf", "app-referencia"],
  ["artifact", "app-artefacto"],
  ["writer", "app-write"],
  ["presentation", "app-presentacion"],
  ["privacy", "app-datos"],
  ["settings-model", "app-modelo"],
  ["export-error", "app-error-exportar"],
];

function delayFor(scene) {
  if (scene === "home" || scene === "home-rumbo" || scene === "privacy" || scene === "library") return "2400";
  if (scene === "library-begonia") return "9000";
  if (scene === "artifact-fin" || scene === "presentation-fin" || scene === "diagrama") return "2600";
  if (scene === "pdf") return "4800";
  return "4200";
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function runCapture({ scene, width, height, outFile }) {
  return new Promise((resolve, reject) => {
    void mkdtemp(path.join(os.tmpdir(), "pteron-extract-"))
      .then(async (userDataDir) => {
        if (scene === "library") {
          const { seedLibraryQa } = await import(path.join(pteronRoot, "scripts/library-qa-fixture.mjs"));
          await seedLibraryQa(path.join(userDataDir, "workspace"));
        }
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        delete env.PTERON_CAPTURE_FRAMES;
        delete env.PTERON_CAPTURE_STATE;
        delete env.PTERON_CAPTURE_MATERIAL_ID;
        delete env.PTERON_CAPTURE_ARTIFACT_ID;
        delete env.PTERON_CAPTURE_SETTLE_MS;
        const child = spawn(
          path.join(pteronRoot, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"),
          [".", `--user-data-dir=${userDataDir}`],
          {
            cwd: pteronRoot,
            env: {
              ...env,
              PTERON_CAPTURE_PATH: outFile,
              PTERON_CAPTURE_SCENE: scene,
              PTERON_CAPTURE_WIDTH: String(width),
              PTERON_CAPTURE_HEIGHT: String(height),
              PTERON_CAPTURE_DELAY_MS: delayFor(scene),
              PTERON_CAPTURE_SEED: "1",
              PTERON_CAPTURE_THEME: "light",
              PTERON_QA_WORKSPACE_ROOT: path.join(userDataDir, "workspace"),
              PTERON_CAPTURE_SHOW: scene.startsWith("planner-") || scene === "library-begonia" ? "1" : undefined,
              ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stderr = "";
        child.stderr.on("data", (c) => {
          stderr += String(c);
        });
        child.on("error", reject);
        child.on("exit", (code) => {
          void rm(userDataDir, { recursive: true, force: true }).finally(() => {
            if (code === 0) resolve();
            else reject(new Error(`Captura falló (${scene}) ${stderr.slice(-600)}`));
          });
        });
      })
      .catch(reject);
  });
}

async function main() {
  const electronMain = path.join(pteronRoot, "out", "main", "index.js");
  if (!(await exists(electronMain))) {
    throw new Error(`Falta el build de pteron en ${electronMain}`);
  }
  await mkdir(outDir, { recursive: true });

  const width = Number(process.env.EXTRACT_WIDTH || 1440);
  const height = Number(process.env.EXTRACT_HEIGHT || 880);
  const { copyFile } = await import("node:fs/promises");

  const failed = [];
  for (const [scene, name] of SCENES) {
    const outFile = path.join(outDir, `${name}-${width}x${height}.png`);
    process.stdout.write(`Capturando ${scene} → ${name} @ ${width}x${height}… `);
    try {
      await runCapture({ scene, width, height, outFile });
      const info = await stat(outFile);
      console.log(`ok (${info.size} bytes)`);
    } catch (error) {
      console.log(`FALLÓ: ${String(error.message).slice(0, 120)}`);
      failed.push({ scene, name });
    }
  }
  if (failed.length) console.log("Fallidas:", failed.map((f) => `${f.scene}→${f.name}`).join(", "));

  // La ventana de producto del hero parte de la misma home.
  const homeShot = path.join(outDir, `app-inicio-${width}x${height}.png`);
  const productShot = path.join(outDir, `product-home-window-${width}x${height}.png`);
  if (await exists(homeShot)) {
    await copyFile(homeShot, productShot);
    console.log("reusado app-inicio → product-home-window");
  }
  console.log(`Listo en ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
