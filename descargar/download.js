(() => {
  const windowsDownload = document.querySelector("[data-download-windows]");
  const macosDownload = document.querySelector("[data-download-macos]");
  const windowsLabel = document.querySelector("[data-download-windows-label]");
  const macosLabel = document.querySelector("[data-download-macos-label]");
  const releaseLink = document.querySelector("[data-download-release]");

  const loadLatestRelease = async () => {
    try {
      const response = await fetch("/docs/data/releases.json", { cache: "no-store" });
      if (!response.ok) throw new Error("release data unavailable");

      const { latest } = await response.json();
      const windowsAsset = latest?.assets?.find(asset => asset.name.endsWith("-x64.exe"));
      const macosAsset = latest?.assets?.find(asset => asset.name.endsWith("-arm64.dmg"));

      if (windowsAsset && windowsDownload && windowsLabel) {
        windowsDownload.href = windowsAsset.url;
        windowsLabel.textContent = `Windows 11 · x64 · versión ${latest.version}`;
      }

      if (macosAsset && macosDownload && macosLabel) {
        macosDownload.href = macosAsset.url;
        macosLabel.textContent = `Apple Silicon · versión ${latest.version}`;
      }

      if (latest?.url && releaseLink) releaseLink.href = latest.url;
    } catch (error) {
      console.warn("No se pudo cargar la versión más reciente; se conservan los enlaces incluidos.", error);
    }
  };

  loadLatestRelease();

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
