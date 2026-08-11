(() => {
  const releaseData = window.PTERON_RELEASES;
  const windowsDownload = document.querySelector("[data-download-windows]");
  const macosDownload = document.querySelector("[data-download-macos]");
  const linuxDownload = document.querySelector("[data-download-linux]");
  const windowsLabel = document.querySelector("[data-download-windows-label]");
  const macosLabel = document.querySelector("[data-download-macos-label]");
  const linuxLabel = document.querySelector("[data-download-linux-label]");
  const releaseLink = document.querySelector("[data-download-release]");

  const loadLatestRelease = async () => {
    if (!releaseData) return;
    const { latest } = await releaseData.loadReleaseCatalog();
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

  loadLatestRelease().catch(() => {});

  const video = document.querySelector("[data-download-video]");
  const year = document.querySelector("[data-year]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 700px)").matches;

  if (year) year.textContent = new Date().getFullYear();
  if (!video || reducedMotion) return;

  const reveal = () => {
    video.classList.add("is-ready");
    video.play().catch(() => {});
  };

  video.addEventListener("canplay", reveal, { once: true });
  video.src = mobile
    ? "/assets/download-jellyfish-mobile.mp4"
    : "/assets/download-jellyfish.mp4";
  video.load();
})();
