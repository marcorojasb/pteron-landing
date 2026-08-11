const { test } = require("node:test");
const assert = require("node:assert/strict");
const releases = require("../release-data");

const completeRelease = (version, overrides = {}) => ({
  version,
  publishedAt: "2026-08-11T12:00:00.000Z",
  url: `https://github.com/marcorojasb/pteron-beta/releases/tag/v${version}`,
  assets: releases.requiredAssetNames(version).map(name => ({
    name,
    url: `https://github.com/marcorojasb/pteron-beta/releases/download/v${version}/${name}`,
  })),
  notes: ["Versión completa"],
  ...overrides,
});

test("compareSemver ordena versiones y deja una final sobre su prerelease", () => {
  assert.ok(releases.compareSemver("0.2.13", "0.2.12") > 0);
  assert.ok(releases.compareSemver("0.2.12", "0.2.12-beta.1") > 0);
  assert.ok(releases.compareSemver("0.2.12-beta.2", "0.2.12-beta.10") < 0);
});

test("la matriz completa incluye formatos Linux, firmas y manifiestos de actualización", () => {
  const names = releases.requiredAssetNames("0.2.12");
  for (const expected of [
    "beta-mac.yml",
    "beta.yml",
    "beta-linux.yml",
    "pteron-0.2.12-arm64.dmg.blockmap",
    "pteron-0.2.12-x86_64.AppImage",
    "pteron-0.2.12-amd64.deb",
    "pteron-0.2.12-x86_64.rpm",
    "pteron-0.2.12-x64.tar.gz",
    "pteron-0.2.12-x86_64.AppImage.asc",
    "pteron-releases-public.asc",
  ]) assert.ok(names.includes(expected), `falta ${expected}`);
});

test("una versión semver más nueva no desplaza a la última si está incompleta", () => {
  const catalog = releases.buildReleaseCatalog([
    { releases: [completeRelease("0.2.12"), {
      ...completeRelease("0.2.13"),
      assets: completeRelease("0.2.13").assets.filter(asset => !asset.name.endsWith(".rpm.asc")),
    }] },
  ]);
  assert.equal(catalog.latest.version, "0.2.12");
  assert.equal(catalog.releases.some(release => release.version === "0.2.13"), false);
});

test("una versión semver más nueva y completa se convierte en la actual", () => {
  const catalog = releases.buildReleaseCatalog([{ releases: [completeRelease("0.2.13")] }]);
  assert.equal(catalog.latest.version, "0.2.13");
  assert.equal(releases.findAsset(catalog.latest, "linuxAppImage").name, "pteron-0.2.13-x86_64.AppImage");
  assert.equal(releases.findSignature(catalog.latest, "linuxAppImage").name, "pteron-0.2.13-x86_64.AppImage.asc");
});

test("combina el JSON incluido y la API pública antes de escoger la versión", async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    const body = url.startsWith("/docs/")
      ? { releases: [completeRelease("0.2.12", { notes: ["Incluida"] })] }
      : [{
          tag_name: "v0.2.13",
          published_at: "2026-08-12T12:00:00.000Z",
          html_url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v0.2.13",
          assets: completeRelease("0.2.13").assets.map(asset => ({
            name: asset.name,
            browser_download_url: asset.url,
          })),
          body: "## Novedades\n- Nota desde API",
        }];
    return { ok: true, json: async () => body };
  };

  const catalog = await releases.loadReleaseCatalog({ fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(catalog.latest.version, "0.2.13");
  assert.deepEqual(catalog.latest.notes, ["Novedades", "Nota desde API"]);
});

test("si ambas fuentes fallan conserva el fallback completo 0.2.12", async () => {
  const catalog = await releases.loadReleaseCatalog({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(catalog.latest.version, "0.2.12");
  assert.equal(releases.isCompleteRelease(catalog.latest), true);
  assert.match(releases.findAsset(catalog.latest, "linuxDeb").url, /v0\.2\.12\/pteron-0\.2\.12-amd64\.deb$/);
});

test("una API que no responde no bloquea el catálogo incluido", async () => {
  const bundled = { releases: [completeRelease("0.2.13")] };
  const catalog = await releases.loadReleaseCatalog({
    timeoutMs: 20,
    fetchImpl: url => url.startsWith("/docs/")
      ? Promise.resolve({ ok: true, json: async () => bundled })
      : new Promise(() => {}),
  });
  assert.equal(catalog.latest.version, "0.2.13");
});

test("las notas remotas se conservan como texto acotado para render seguro", () => {
  const normalized = releases.normalizeRelease({
    tag_name: "v0.2.13",
    html_url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v0.2.13",
    assets: [],
    body: "- <img src=x onerror=alert(1)>",
  });
  assert.deepEqual(normalized.notes, ["<img src=x onerror=alert(1)>"]);
});
