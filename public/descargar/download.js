(() => {
  const releaseData = window.PTERON_RELEASES;
  const windowsDownload = document.querySelector("[data-download-windows]");
  const macosDownload = document.querySelector("[data-download-macos]");
  const linuxDownload = document.querySelector("[data-download-linux]");
  const windowsLabel = document.querySelector("[data-download-windows-label]");
  const macosLabel = document.querySelector("[data-download-macos-label]");
  const linuxLabel = document.querySelector("[data-download-linux-label]");
  const releaseLink = document.querySelector("[data-download-release]");
  const status = document.querySelector("[data-download-status]");
  const releasesPageUrl =
    releaseData?.RELEASES_PAGE_URL || "https://github.com/marcorojasb/pteron-beta/releases";

  // Sin catálogo no se anuncia ninguna versión: los enlaces quedan en la página
  // oficial de versiones y la página lo dice, en vez de ofrecer una versión vieja.
  const announceUnavailable = () => {
    if (releaseLink) releaseLink.href = releasesPageUrl;
    if (!status) return;
    const link = document.createElement("a");
    link.href = releasesPageUrl;
    link.textContent = "la página de versiones en GitHub";
    status.replaceChildren(
      document.createTextNode("No pudimos comprobar la última versión publicada. Consulta "),
      link,
      document.createTextNode(" para elegir el archivo de tu equipo.")
    );
  };

  const loadLatestRelease = async () => {
    if (!releaseData) return;
    const { latest } = await releaseData.loadReleaseCatalog();
    if (!latest) {
      announceUnavailable();
      return;
    }
    const windowsAsset = releaseData.findAsset(latest, "windowsExe");
    const macosAsset = releaseData.findAsset(latest, "macosDmg");
    const linuxAsset = releaseData.findAsset(latest, "linuxAppImage");

    if (windowsAsset && windowsDownload && windowsLabel) {
      windowsDownload.href = windowsAsset.url;
      windowsLabel.textContent = `Windows 11 · x64 · versión ${latest.version}`;
    }

    if (macosAsset && macosDownload && macosLabel) {
      macosDownload.href = macosAsset.url;
      macosLabel.textContent = `Apple Silicon · versión ${latest.version}`;
    }

    if (linuxAsset && linuxDownload && linuxLabel) {
      linuxDownload.href = linuxAsset.url;
      linuxLabel.textContent = `x86_64 · AppImage · versión ${latest.version}`;
    }

    const assetLinks = {
      linuxDeb: "[data-download-linux-deb]",
      linuxRpm: "[data-download-linux-rpm]",
      linuxTar: "[data-download-linux-tar]",
    };
    Object.entries(assetLinks).forEach(([kind, selector]) => {
      const link = document.querySelector(selector);
      const asset = releaseData.findAsset(latest, kind);
      if (link && asset) link.href = asset.url;
    });

    const signatureLinks = {
      linuxAppImage: "[data-download-linux-appimage-signature]",
      linuxDeb: "[data-download-linux-deb-signature]",
      linuxRpm: "[data-download-linux-rpm-signature]",
      linuxTar: "[data-download-linux-tar-signature]",
    };
    Object.entries(signatureLinks).forEach(([kind, selector]) => {
      const link = document.querySelector(selector);
      const signature = releaseData.findSignature(latest, kind);
      if (link && signature) link.href = signature.url;
    });

    if (latest?.url && releaseLink) releaseLink.href = latest.url;
  };

  // Se destaca la plataforma desde la que se visita la página sólo cuando se
  // reconoce con claridad: sin detección (o desde un teléfono, una tableta,
  // ChromeOS o Linux ARM) no se marca ninguna, en vez de suponer Windows.
  const detectPlatform = () => {
    const ua = navigator.userAgent || "";
    const hint = navigator.userAgentData?.platform || "";
    if (/Android|iPhone|iPad|iPod|CrOS/i.test(ua)) return null;
    if (/Win/i.test(hint) || /Windows NT/i.test(ua)) return windowsDownload;
    if (/mac/i.test(hint) || /Macintosh|Mac OS X/i.test(ua)) {
      return navigator.maxTouchPoints > 1 ? null : macosDownload;
    }
    if ((/Linux/i.test(hint) || /Linux|X11/i.test(ua)) && !/aarch64|arm64|armv\d/i.test(ua)) {
      return linuxDownload;
    }
    return null;
  };

  // El enlace lleva download-option-primary (botón ámbar) y su tarjeta
  // .platform, is-detected (borde ámbar y rótulo «Tu equipo»).
  const highlightPlatform = () => {
    const target = detectPlatform();
    [windowsDownload, macosDownload, linuxDownload].forEach((option) => {
      if (!option) return;
      const active = option === target;
      option.classList.toggle("download-option-primary", active);
      option.closest(".platform")?.classList.toggle("is-detected", active);
    });
  };

  highlightPlatform();

  loadLatestRelease().catch(announceUnavailable);

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
