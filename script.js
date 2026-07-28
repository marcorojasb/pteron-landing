(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-nav]');
  const year = document.querySelector('[data-year]');
  const toast = document.querySelector('[data-toast]');

  if (year) year.textContent = new Date().getFullYear();

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Abrir navegación');
    nav?.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Abrir navegación' : 'Cerrar navegación');
    nav?.classList.toggle('is-open', !open);
    document.body.classList.toggle('nav-open', !open);
  });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  window.addEventListener('keydown', (event) => event.key === 'Escape' && closeMenu());

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  document.querySelector('[data-copy-email]')?.addEventListener('click', async (event) => {
    const address = 'pteron@patagua.dev';
    try {
      await navigator.clipboard.writeText(address);
      event.currentTarget.querySelector('span').textContent = 'Correo copiado';
      showToast('Correo copiado.');
      window.setTimeout(() => { event.currentTarget.querySelector('span').textContent = address; }, 1800);
    } catch {
      window.location.href = `mailto:${address}`;
    }
  });

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -30px' });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }

  const film = document.querySelector('[data-scroll-film]');
  const video = document.querySelector('[data-scroll-video]');
  const progressLabel = document.querySelector('[data-scroll-progress]');
  const product = film?.querySelector('.hero-product');
  if (!film || !video) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frameId = 0;
  let targetTime = 0;

  video.pause();

  const prepareLocalVideo = async () => {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    try {
      const response = await fetch('/assets/pteron-scroll.mp4');
      const blob = await response.blob();
      video.src = URL.createObjectURL(blob);
    } catch {
      // Keep the original source when the local preview cannot create a seekable blob.
    }
  };

  const updateFilm = () => {
    frameId = 0;
    const start = film.offsetTop;
    const travel = Math.max(1, film.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / travel));
    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : 0;
    targetTime = reducedMotion ? 0 : progress * duration;
    if (duration && Math.abs(video.currentTime - targetTime) > .025) {
      video.currentTime = targetTime;
    }
    if (progressLabel) progressLabel.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')} — 100`;
    if (product) {
      const enter = Math.min(1, Math.max(0, progress / .16));
      const startOffset = window.innerWidth <= 560 ? 56 : 62;
      const offset = startOffset * (1 - enter);
      product.style.transform = `translate3d(-50%, ${offset}vh, 0)`;
    }
  };

  const requestFilmUpdate = () => {
    if (!frameId) frameId = window.requestAnimationFrame(updateFilm);
  };

  video.addEventListener('loadedmetadata', updateFilm);
  window.addEventListener('scroll', requestFilmUpdate, { passive: true });
  window.addEventListener('resize', requestFilmUpdate, { passive: true });
  prepareLocalVideo().finally(updateFilm);
})();
