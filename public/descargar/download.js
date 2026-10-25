/* pteron · descargar (2026-10-12.12)
   Enlaces y rótulos de la última versión completa (release-data.js) y la plataforma del visitante destacada.
   Sin catálogo no se anuncia ninguna versión: los enlaces quedan en la página de versiones y la página lo dice. */
(() => {
  "use strict";
  const releaseData = window.PTERON_RELEASES;
  const $ = (selector) => document.querySelector(selector);
  const links = { windows: $("[data-download-windows]"), macos: $("[data-download-macos]"), linux: $("[data-download-linux]") };
  const releaseLink = $("[data-download-release]");
  const status = $("[data-download-status]");
  const releasesPageUrl = releaseData?.RELEASES_PAGE_URL || "https://github.com/marcorojasb/pteron-beta/releases";
  // script.js marca un teléfono o una tableta: ahí los botones llevan a la versión en GitHub, no al instalador
  const movil = document.documentElement.dataset.equipo === "movil";

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

  const PLATFORM = { windows: "windowsExe", macos: "macosDmg", linux: "linuxAppImage" };

  const loadLatestRelease = async () => {
    if (!releaseData) return;
    const { latest } = await releaseData.loadReleaseCatalog();
    if (!latest) {
      announceUnavailable();
      return;
    }
    Object.entries(PLATFORM).forEach(([platform, kind]) => {
      const asset = releaseData.findAsset(latest, kind);
      if (!asset || !links[platform]) return;
      links[platform].href = movil ? latest.url || releasesPageUrl : asset.url;
    });
    Object.entries({ linuxDeb: "[data-download-linux-deb]", linuxRpm: "[data-download-linux-rpm]", linuxTar: "[data-download-linux-tar]" }).forEach(([kind, selector]) => {
      const link = $(selector);
      const asset = releaseData.findAsset(latest, kind);
      if (link && asset && !movil) link.href = asset.url;
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

  // En el teléfono, lo primero es mandarse el enlace para abrirlo en el computador
  const telefono = $("[data-en-telefono]");
  if (movil && telefono) {
    const enlace = new URL("/descargar", location.origin).href;
    telefono.hidden = false;
    telefono.querySelector("[data-copy]")?.setAttribute("data-copy", enlace);
    telefono.querySelector("[data-enviar-enlace]")?.addEventListener("click", async () => {
      const asunto = "pteron para el computador";
      if (navigator.share) {
        try {
          await navigator.share({ title: asunto, url: enlace });
        } catch {
          // Cerrar la hoja de compartir no es un error
        }
        return;
      }
      location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(enlace)}`;
    });
  }

  loadLatestRelease().catch(announceUnavailable);
})();
