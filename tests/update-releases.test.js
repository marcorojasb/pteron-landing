import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

import "../public/release-data.js";

function completeAssets(version) {
  return globalThis.PTERON_RELEASES.requiredAssetNames(version).map((name) => ({
    name,
    browser_download_url: `https://github.com/marcorojasb/pteron-beta/releases/download/v${version}/${name}`,
  }));
}

test("el script de versiones carga release-data desde public/ y escribe el catálogo en public/docs/data", (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "pteron-releases-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const preload = path.join(cwd, "preload.mjs");
  const releases = [{ tag_name: "v9.9.9", published_at: "2026-10-01T00:00:00.000Z", html_url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v9.9.9", assets: completeAssets("9.9.9"), body: "## Novedades\n- Prueba" }];
  writeFileSync(preload, `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify(releases))}, { status: 200, headers: { "content-type": "application/json" } });\n`);
  // Sin las variables del script que pueda traer la terminal: el resultado no depende de quién lo corre.
  const env = { ...process.env, GITHUB_TOKEN: "", PTERON_STABLE_VERSION: "", PTERON_RELEASE_REPOSITORY: "" };
  const output = execFileSync(process.execPath, ["--import", preload, path.join(root, "scripts/update-pteron-releases.mjs")], { cwd, encoding: "utf8", env });
  const written = JSON.parse(readFileSync(path.join(cwd, "public/docs/data/releases.json"), "utf8"));
  assert.ok(Array.isArray(written.releases) && written.releases.length >= 1, output);
  const latest = written.releases.find((release) => release.version === "9.9.9");
  assert.ok(latest, "la versión completa queda en el catálogo");
  assert.equal(latest.assets.length, completeAssets("9.9.9").length);
});
