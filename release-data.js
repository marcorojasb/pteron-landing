(function exposeReleaseData(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PTERON_RELEASES = api;
})(typeof globalThis === "object" ? globalThis : this, function createReleaseData() {
  "use strict";

  const REPOSITORY = "marcorojasb/pteron-beta";
  const BUNDLED_RELEASES_URL = "/docs/data/releases.json";
  const GITHUB_RELEASES_API_URL = `https://api.github.com/repos/${REPOSITORY}/releases?per_page=20`;
  const PUBLIC_KEY_URL = "/descargar/pteron-releases-public.asc";
  const PUBLIC_KEY_FINGERPRINT = "5DDC 795B EFB7 EC2F EC93 0227 EAFB 54AE A175 0DCF";
  const FALLBACK_VERSION = "0.2.12";
  const FETCH_TIMEOUT_MS = 5000;

  const parseSemver = value => {
    const match = String(value || "").trim().match(
      /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
    );
    if (!match) return null;
    return {
      version: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ? `-${match[4]}` : ""}`,
      numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
      prerelease: match[4] ? match[4].split(".") : [],
    };
  };

  const comparePrerelease = (left, right) => {
    if (!left.length && !right.length) return 0;
    if (!left.length) return 1;
    if (!right.length) return -1;

    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      if (left[index] === undefined) return -1;
      if (right[index] === undefined) return 1;
      if (left[index] === right[index]) continue;

      const leftNumeric = /^\d+$/.test(left[index]);
      const rightNumeric = /^\d+$/.test(right[index]);
      if (leftNumeric && rightNumeric) return Number(left[index]) - Number(right[index]);
      if (leftNumeric) return -1;
      if (rightNumeric) return 1;
      return left[index].localeCompare(right[index], "en");
    }
    return 0;
  };

  const compareSemver = (leftValue, rightValue) => {
    const left = parseSemver(leftValue);
    const right = parseSemver(rightValue);
    if (!left || !right) return 0;

    for (let index = 0; index < left.numbers.length; index += 1) {
      if (left.numbers[index] !== right.numbers[index]) {
        return left.numbers[index] - right.numbers[index];
      }
    }
    return comparePrerelease(left.prerelease, right.prerelease);
  };

  const artifactNames = version => ({
    macosDmg: `pteron-${version}-arm64.dmg`,
    macosDmgBlockmap: `pteron-${version}-arm64.dmg.blockmap`,
    macosZip: `pteron-${version}-arm64.zip`,
    macosZipBlockmap: `pteron-${version}-arm64.zip.blockmap`,
    windowsExe: `pteron-${version}-x64.exe`,
    windowsExeBlockmap: `pteron-${version}-x64.exe.blockmap`,
    linuxDeb: `pteron-${version}-amd64.deb`,
    linuxRpm: `pteron-${version}-x86_64.rpm`,
    linuxTar: `pteron-${version}-x64.tar.gz`,
    linuxAppImage: `pteron-${version}-x86_64.AppImage`,
  });

  const requiredAssetNames = version => {
    const names = artifactNames(version);
    const linuxArtifacts = [names.linuxDeb, names.linuxRpm, names.linuxTar, names.linuxAppImage];
    return [
      "beta-mac.yml",
      "beta.yml",
      "beta-linux.yml",
      names.macosDmg,
      names.macosDmgBlockmap,
      names.macosZip,
      names.macosZipBlockmap,
      names.windowsExe,
      names.windowsExeBlockmap,
      ...linuxArtifacts,
      ...linuxArtifacts.map(name => `${name}.asc`),
      "pteron-releases-public.asc",
    ];
  };

  const releaseUrl = version => `https://github.com/${REPOSITORY}/releases/tag/v${version}`;
  const assetUrl = (version, name) =>
    `https://github.com/${REPOSITORY}/releases/download/v${version}/${encodeURIComponent(name)}`;

  const isTrustedGithubUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        && url.hostname === "github.com"
        && url.pathname.startsWith(`/${REPOSITORY}/releases/`);
    } catch {
      return false;
    }
  };

  const normalizeAsset = (asset, version) => {
    const name = String(asset?.name || "").trim();
    if (!name || !/^[0-9A-Za-z._+-]+$/.test(name)) return null;
    const candidateUrl = asset?.url || asset?.browser_download_url;
    return {
      name,
      url: isTrustedGithubUrl(candidateUrl) ? candidateUrl : assetUrl(version, name),
      bytes: Number.isFinite(Number(asset?.bytes ?? asset?.size))
        ? Number(asset.bytes ?? asset.size)
        : null,
    };
  };

  const publishedLabel = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "agosto de 2026";
    return new Intl.DateTimeFormat("es-CL", {
      month: "long",
      year: "numeric",
      timeZone: "America/Santiago",
    }).format(date);
  };

  const cleanNote = value => String(value || "")
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .slice(0, 600);

  const releaseNotes = raw => {
    const source = Array.isArray(raw?.notes)
      ? raw.notes
      : typeof raw?.body === "string"
        ? raw.body.split("\n")
        : [];
    return source.map(cleanNote).filter(Boolean).slice(0, 8);
  };

  const normalizeRelease = raw => {
    if (!raw || raw.draft) return null;
    const parsed = parseSemver(raw.version || raw.tag_name);
    if (!parsed) return null;
    const version = parsed.version;
    const assets = Array.isArray(raw.assets)
      ? raw.assets.map(asset => normalizeAsset(asset, version)).filter(Boolean)
      : [];
    const candidateUrl = raw.url || raw.html_url;
    const publishedAt = raw.publishedAt || raw.published_at || raw.created_at || "";
    return {
      version,
      publishedAt,
      publishedLabel: raw.publishedLabel || publishedLabel(publishedAt),
      url: isTrustedGithubUrl(candidateUrl) ? candidateUrl : releaseUrl(version),
      assets,
      notes: releaseNotes(raw),
      channel: raw.channel === "stable" ? "stable" : "beta",
    };
  };

  const fallbackAssets = requiredAssetNames(FALLBACK_VERSION).map(name => ({
    name,
    url: assetUrl(FALLBACK_VERSION, name),
    bytes: null,
  }));

  const FALLBACK_RELEASE = Object.freeze({
    version: FALLBACK_VERSION,
    publishedAt: "",
    publishedLabel: "agosto de 2026",
    url: releaseUrl(FALLBACK_VERSION),
    assets: fallbackAssets,
    notes: ["Compatibilidad beta con Linux x86_64, además de macOS con Apple Silicon y Windows 11."],
    channel: "beta",
  });

  const isCompleteRelease = release => {
    if (!release) return false;
    const names = new Set(release.assets.map(asset => asset.name));
    return requiredAssetNames(release.version).every(name => names.has(name));
  };

  const releasesFromPayload = payload => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    return [
      ...(Array.isArray(payload.releases) ? payload.releases : []),
      ...(payload.latest ? [payload.latest] : []),
      ...(payload.stable ? [payload.stable] : []),
    ];
  };

  const mergeRelease = (current, next) => {
    if (!current) return next;
    const assets = new Map(current.assets.map(asset => [asset.name, asset]));
    next.assets.forEach(asset => assets.set(asset.name, asset));
    return {
      ...current,
      ...next,
      publishedAt: next.publishedAt || current.publishedAt,
      publishedLabel:
        next.publishedAt || next.publishedLabel !== "agosto de 2026"
          ? next.publishedLabel
          : current.publishedLabel,
      assets: [...assets.values()],
      notes: next.notes.length ? next.notes : current.notes,
      channel: current.channel === "stable" || next.channel === "stable" ? "stable" : "beta",
    };
  };

  const buildReleaseCatalog = payloads => {
    const byVersion = new Map();
    [FALLBACK_RELEASE, ...payloads.flatMap(releasesFromPayload)]
      .map(normalizeRelease)
      .filter(Boolean)
      .forEach(release => {
        byVersion.set(release.version, mergeRelease(byVersion.get(release.version), release));
      });

    const ordered = [...byVersion.values()].sort((left, right) => compareSemver(right.version, left.version));
    const latest = ordered.find(isCompleteRelease) || normalizeRelease(FALLBACK_RELEASE);
    const releases = ordered.filter(release => compareSemver(release.version, latest.version) <= 0);
    return {
      latest,
      stable: releases.find(release => release.channel === "stable") || null,
      releases,
    };
  };

  const fetchJson = async (fetchImpl, url, options, timeoutMs) => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller?.abort();
        reject(new Error("Release data unavailable: timeout"));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        fetchImpl(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }),
        timeout,
      ]);
      if (!response?.ok) throw new Error(`Release data unavailable: ${response?.status || "network"}`);
      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const loadReleaseCatalog = async ({
    fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : null,
    bundledUrl = BUNDLED_RELEASES_URL,
    apiUrl = GITHUB_RELEASES_API_URL,
    timeoutMs = FETCH_TIMEOUT_MS,
  } = {}) => {
    if (!fetchImpl) return buildReleaseCatalog([]);
    const results = await Promise.allSettled([
      fetchJson(fetchImpl, bundledUrl, { cache: "no-store" }, timeoutMs),
      fetchJson(fetchImpl, apiUrl, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      }, timeoutMs),
    ]);
    return buildReleaseCatalog(
      results.filter(result => result.status === "fulfilled").map(result => result.value)
    );
  };

  const findAsset = (release, kind) => {
    const name = artifactNames(release?.version || FALLBACK_VERSION)[kind];
    return release?.assets?.find(asset => asset.name === name) || null;
  };

  const findSignature = (release, kind) => {
    const asset = findAsset(release, kind);
    if (!asset) return null;
    return release.assets.find(candidate => candidate.name === `${asset.name}.asc`) || null;
  };

  return {
    BUNDLED_RELEASES_URL,
    FALLBACK_RELEASE,
    FALLBACK_VERSION,
    FETCH_TIMEOUT_MS,
    GITHUB_RELEASES_API_URL,
    PUBLIC_KEY_FINGERPRINT,
    PUBLIC_KEY_URL,
    artifactNames,
    buildReleaseCatalog,
    compareSemver,
    findAsset,
    findSignature,
    isCompleteRelease,
    loadReleaseCatalog,
    normalizeRelease,
    requiredAssetNames,
  };
});
