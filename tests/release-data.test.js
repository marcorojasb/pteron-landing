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
  assert.ok(releases.compareSemver("1.2.4", "1.2.3") > 0);
  assert.ok(releases.compareSemver("1.2.3", "1.2.3-beta.1") > 0);
  assert.ok(releases.compareSemver("1.2.3-beta.2", "1.2.3-beta.10") < 0);
});

test("la matriz completa incluye formatos Linux, firmas y manifiestos de actualización", () => {
  const names = releases.requiredAssetNames("1.2.3");
  for (const expected of [
    "beta-mac.yml",
    "beta.yml",
    "beta-linux.yml",
    "pteron-1.2.3-arm64.dmg.blockmap",
    "pteron-1.2.3-x86_64.AppImage",
    "pteron-1.2.3-amd64.deb",
    "pteron-1.2.3-x86_64.rpm",
    "pteron-1.2.3-x64.tar.gz",
    "pteron-1.2.3-x86_64.AppImage.asc",
    "pteron-releases-public.asc",
  ]) assert.ok(names.includes(expected), `falta ${expected}`);
});

test("una versión semver más nueva no desplaza a la última si está incompleta", () => {
  const catalog = releases.buildReleaseCatalog([
    { releases: [completeRelease("1.2.3"), {
      ...completeRelease("1.2.4"),
      assets: completeRelease("1.2.4").assets.filter(asset => !asset.name.endsWith(".rpm.asc")),
    }] },
  ]);
  assert.equal(catalog.latest.version, "1.2.3");
  assert.equal(catalog.releases.some(release => release.version === "1.2.4"), false);
});

test("una versión semver más nueva y completa se convierte en la actual", () => {
  const catalog = releases.buildReleaseCatalog([{ releases: [completeRelease("1.2.4")] }]);
  assert.equal(catalog.latest.version, "1.2.4");
  assert.equal(releases.findAsset(catalog.latest, "linuxAppImage").name, "pteron-1.2.4-x86_64.AppImage");
  assert.equal(releases.findSignature(catalog.latest, "linuxAppImage").name, "pteron-1.2.4-x86_64.AppImage.asc");
});

test("combina el JSON incluido y la API pública antes de escoger la versión", async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    const body = url.startsWith("/docs/")
      ? { releases: [completeRelease("1.2.3", { notes: ["Incluida"] })] }
      : [{
          tag_name: "v1.2.4",
          published_at: "2026-08-12T12:00:00.000Z",
          html_url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v1.2.4",
          assets: completeRelease("1.2.4").assets.map(asset => ({
            name: asset.name,
            browser_download_url: asset.url,
          })),
          body: "## Novedades\n- Nota desde API",
        }];
    return { ok: true, json: async () => body };
  };

  const catalog = await releases.loadReleaseCatalog({ fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(catalog.latest.version, "1.2.4");
  assert.deepEqual(catalog.latest.notes, ["Novedades", "Nota desde API"]);
});

test("sin fuentes disponibles el catálogo queda vacío y no inventa una versión", async () => {
  const catalog = await releases.loadReleaseCatalog({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(catalog.latest, null);
  assert.deepEqual(catalog.releases, []);
  assert.equal(catalog.stable, null);
});

test("sin versión completa la última es nula aunque existan releases", () => {
  const incomplete = {
    ...completeRelease("1.2.3"),
    assets: [{ name: "beta-mac.yml", url: "https://github.com/marcorojasb/pteron-beta/releases/download/v1.2.3/beta-mac.yml" }],
  };
  const catalog = releases.buildReleaseCatalog([{ releases: [incomplete] }]);
  assert.equal(catalog.latest, null);
  assert.equal(releases.isCompleteRelease(incomplete), false);
  assert.equal(catalog.releases.length, 1);
});

test("un release ausente no rompe la búsqueda de artefactos ni firmas", () => {
  assert.equal(releases.findAsset(null, "linuxDeb"), null);
  assert.equal(releases.findSignature(null, "linuxDeb"), null);
  assert.equal(releases.findAsset({ version: "" }, "linuxDeb"), null);
  assert.equal(releases.findSignature({ version: "1.2.3", assets: [] }, "linuxDeb"), null);
});

test("una fecha inválida no publica una etiqueta de mes inventada", () => {
  const normalized = releases.normalizeRelease({
    tag_name: "v1.2.3",
    assets: [],
    published_at: "no es una fecha",
  });
  assert.equal(normalized.publishedLabel, "sin fecha");
});

test("una API que no responde no bloquea el catálogo incluido", async () => {
  const bundled = { releases: [completeRelease("1.2.4")] };
  const catalog = await releases.loadReleaseCatalog({
    timeoutMs: 20,
    fetchImpl: url => url.startsWith("/docs/")
      ? Promise.resolve({ ok: true, json: async () => bundled })
      : new Promise(() => {}),
  });
  assert.equal(catalog.latest.version, "1.2.4");
});

test("las notas remotas se conservan como texto acotado para render seguro", () => {
  const normalized = releases.normalizeRelease({
    tag_name: "v1.2.4",
    html_url: "https://github.com/marcorojasb/pteron-beta/releases/tag/v1.2.4",
    assets: [],
    body: "- <img src=x onerror=alert(1)>",
  });
  assert.deepEqual(normalized.notes, ["<img src=x onerror=alert(1)>"]);
});
