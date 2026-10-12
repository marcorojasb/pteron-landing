/* pteron · descargar (2026-10-12.9)
   Enlaces y rótulos de la última versión completa (release-data.js) y la plataforma del visitante destacada.
   Sin catálogo no se anuncia ninguna versión: los enlaces quedan en la página de versiones y la página lo dice. */
(() => {
  "use strict";
  const releaseData = window.PTERON_RELEASES;
  const $ = (selector) => document.querySelector(selector);
  const links = { windows: $("[data-download-windows]"), macos: $("[data-download-macos]"), linux: $("[data-download-linux]") };
  const labels = { windows: $("[data-download-windows-label]"), macos: $("[data-download-macos-label]"), linux: $("[data-download-linux-label]") };
  const releaseLink = $("[data-download-release]");
  const status = $("[data-download-status]");
  const releasesPageUrl = releaseData?.RELEASES_PAGE_URL || "https://github.com/marcorojasb/pteron-beta/releases";

  const announceUnavailable = () => {
    if (releaseLink) releaseLink.href = releasesPageUrl;
    if (!status) return;
    const link = document.createElement("a");
    link.href = releasesPageUrl;
    link.textContent = "la página de versiones en GitHub";
    status.replaceChildren(
      document.createTextNode("No pudimos comprobar la última versión publicada. Consulta "),
      link,
      document.createTextNode(" para elegir el archivo de tu equipo."),
    );
  };

  const PLATFORM = {
    windows: ["windowsExe", (version) => `Windows 11 · x64 · versión ${version}`],
    macos: ["macosDmg", (version) => `Apple Silicon · versión ${version}`],
    linux: ["linuxAppImage", (version) => `x86_64 · AppImage · versión ${version}`],
  };

  const loadLatestRelease = async () => {
    if (!releaseData) return;
    const { latest } = await releaseData.loadReleaseCatalog();
    if (!latest) {
      announceUnavailable();
      return;
    }
    Object.entries(PLATFORM).forEach(([platform, [kind, label]]) => {
      const asset = releaseData.findAsset(latest, kind);
      if (!asset || !links[platform]) return;
      links[platform].href = asset.url;
      if (labels[platform]) labels[platform].textContent = label(latest.version);
    });
    Object.entries({ linuxDeb: "[data-download-linux-deb]", linuxRpm: "[data-download-linux-rpm]", linuxTar: "[data-download-linux-tar]" }).forEach(([kind, selector]) => {
      const link = $(selector);
      const asset = releaseData.findAsset(latest, kind);
      if (link && asset) link.href = asset.url;
    });
    Object.entries({
      linuxAppImage: "[data-download-linux-appimage-signature]",
      linuxDeb: "[data-download-linux-deb-signature]",
      linuxRpm: "[data-download-linux-rpm-signature]",
      linuxTar: "[data-download-linux-tar-signature]",
    }).forEach(([kind, selector]) => {
      const link = $(selector);
      const signature = releaseData.findSignature(latest, kind);
      if (link && signature) link.href = signature.url;
    });
    if (latest.url && releaseLink) releaseLink.href = latest.url;
  };

  // script.js marca la fila del visitante con is-detected (data-platform); aquí su botón pasa a ser el principal
  document.querySelectorAll(".plataforma").forEach((row) => {
    const button = row.querySelector(".boton");
    if (!button) return;
    const detected = row.classList.contains("is-detected");
    button.classList.toggle("boton-principal", detected);
    button.classList.toggle("boton-papel", !detected);
  });

  loadLatestRelease().catch(announceUnavailable);
})();
