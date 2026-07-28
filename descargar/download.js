(() => {
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
