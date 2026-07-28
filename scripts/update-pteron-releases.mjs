import { mkdir, writeFile } from "node:fs/promises";

const repository = process.env.PTERON_RELEASE_REPOSITORY || "marcorojasb/pteron-beta";
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
  .map(release => {
    const version = release.tag_name.replace(/^v/, "");
    const channel = release.prerelease || version.includes("beta") ? "beta" : "stable";
    const published = new Date(release.published_at || release.created_at);
    const assets = release.assets.map(asset => ({
      name: asset.name,
      url: asset.browser_download_url,
      bytes: asset.size
    }));
    const notes = release.body
      ? release.body.split("\n").map(line => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 8)
      : ["Correcciones y mejoras de la beta."];
    return {
      version,
      channel,
      publishedAt: published.toISOString(),
      publishedLabel: new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" }).format(published),
      url: release.html_url,
      assets,
      notes
    };
  });

if (!releases.length) throw new Error("No hay releases publicados; se conserva el archivo existente.");

const beta = releases.find(release => release.channel === "beta") || releases[0];
const stable = releases.find(release => release.channel === "stable") || null;
const data = {
  generatedAt: new Date().toISOString(),
  latest: beta,
  stable,
  releases
};

await mkdir("docs/data", { recursive: true });
await writeFile("docs/data/releases.json", `${JSON.stringify(data, null, 2)}\n`);
console.log(`Documentación actualizada con ${releases.length} release(s). Última beta: ${beta.version}`);
