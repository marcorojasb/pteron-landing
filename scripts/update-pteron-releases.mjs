import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compareSemver, isCompleteRelease, normalizeRelease } = require("../release-data.js");

const repository = process.env.PTERON_RELEASE_REPOSITORY || "marcorojasb/pteron-beta";
// Durante la beta, pteron publica versiones X.Y.Z. Por eso el flag
// `prerelease` de GitHub no determina el canal de producto. El primer release
// estable se puede declarar explícitamente con PTERON_STABLE_VERSION.
const stableVersion = process.env.PTERON_STABLE_VERSION?.trim() || null;
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "pteron-docs-release-sync",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=20`, { headers });
if (!response.ok) throw new Error(`GitHub releases: ${response.status} ${response.statusText}`);

const releases = (await response.json())
  .filter(release => !release.draft)
  .map(normalizeRelease)
  .filter(Boolean)
  .sort((left, right) => compareSemver(right.version, left.version))
  .map(release => ({
    ...release,
    channel: stableVersion === release.version ? "stable" : "beta"
  }));

if (!releases.length) throw new Error("No hay releases publicados; se conserva el archivo existente.");

const latest = releases.find(isCompleteRelease);
if (!latest) throw new Error("No hay un release publicado con la matriz completa de artefactos.");
const stable = releases.find(release => release.channel === "stable") || null;
const outputPath = "docs/data/releases.json";
let previousData = null;

try {
  previousData = JSON.parse(await readFile(outputPath, "utf8"));
} catch {
  // La primera sincronización crea el archivo.
}

const releaseState = { latest, stable, releases };
const previousReleaseState = previousData
  ? { latest: previousData.latest, stable: previousData.stable, releases: previousData.releases }
  : null;
const releasesChanged = JSON.stringify(releaseState) !== JSON.stringify(previousReleaseState);
const data = {
  generatedAt: releasesChanged ? new Date().toISOString() : previousData.generatedAt,
  ...releaseState
};

await mkdir("docs/data", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(
  releasesChanged
    ? `Web actualizada con ${releases.length} release(s). Última publicación: ${latest.version}`
    : `Sin cambios. Última publicación: ${latest.version}`
);
