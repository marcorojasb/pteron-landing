(() => {
  const loader = document.querySelector('[data-page-loader]');
  const loaderCanvas = document.querySelector('[data-loader-medusa]');
  let loaderFrameId = 0;
  let loaderTime = 0;
  let loaderLastPaint = 0;

  const drawMedusa = (now = 0) => {
    if (!loaderCanvas || loader?.classList.contains('is-complete')) return;
    loaderFrameId = window.requestAnimationFrame(drawMedusa);
    if (now - loaderLastPaint < 32) return;
    loaderLastPaint = now;

    const context = loaderCanvas.getContext('2d');
    const size = 400;
    context.fillStyle = 'rgb(247, 243, 236)';
    context.fillRect(0, 0, size, size);
    loaderTime += Math.PI / 80;

    for (let index = 10000; index > 0; index -= 1) {
      const y = index / 235;
      const k = (4 + Math.cos(index / 9 - loaderTime * 2)) * Math.cos(index / 35);
      const e = y / 7 - 13;
      const d = Math.hypot(k, e) + Math.sin(e / 9 + loaderTime / 2) - 4;
      const q = 2 * Math.sin(k * 3) - y / 35 * k * (9 + k * Math.sin(Math.cos(e) * 9 - d * 2 + loaderTime));
      const c = d - loaderTime;
      const x = q + 40 * Math.cos(c) + 200;
      const pointY = q * Math.sin(c) + d * 35;
      context.fillStyle = index % 19 === 0
        ? 'rgba(189, 120, 35, .42)'
        : 'rgba(16, 36, 59, .38)';
      context.fillRect(x, pointY, 1, 1);
    }
  };

  const finishLoading = () => {
    window.cancelAnimationFrame(loaderFrameId);
    loader?.classList.add('is-complete');
    document.documentElement.classList.remove('is-loading');
  };

  drawMedusa();

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
  if (!film || !video) {
    finishLoading();
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const filmStage = film.querySelector('.scroll-film-sticky');
  let frameId = 0;
  let targetTime = 0;

  video.pause();

  const waitForVideo = (eventName, readyState, timeout = 20000) => new Promise((resolve, reject) => {
    if (video.readyState >= readyState) {
      resolve();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      video.removeEventListener(eventName, onReady);
      reject(new Error(`Video ${eventName} timeout`));
    }, timeout);
    const onReady = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    video.addEventListener(eventName, onReady, { once: true });
  });

  const prepareVideo = async () => {
    try {
      const response = await fetch('/assets/pteron-scroll.mp4');
      if (!response.ok) throw new Error(`Video request failed: ${response.status}`);
      const blob = await response.blob();
      video.src = URL.createObjectURL(blob);
      video.load();
    } catch {
      video.load();
    }

    await waitForVideo('loadedmetadata', 1);
    const playback = video.play();
    if (playback) await playback.catch(() => {});
    await waitForVideo('loadeddata', 2);
    video.pause();
    video.currentTime = 0;
    filmStage?.classList.add('is-video-ready');
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
      const startOffset = window.innerWidth <= 560 ? 48 : 62;
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
  Promise.all([
    prepareVideo(),
    new Promise((resolve) => window.setTimeout(resolve, 800))
  ]).catch(() => {
    filmStage?.classList.remove('is-video-ready');
  }).finally(() => {
    updateFilm();
    finishLoading();
  });
})();
