(() => {
  const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isAccountPage = window.location.pathname === '/cuenta' || window.location.pathname === '/cuenta/';
  if (authHash.has('access_token') && authHash.has('refresh_token') && !isAccountPage) {
    window.location.replace(`/cuenta/${window.location.search}${window.location.hash}`);
    return;
  }

  const loader = document.querySelector('[data-page-loader]');
  const loaderCanvas = document.querySelector('[data-loader-medusa]');
  let loaderFrameId = 0;
  let loaderTime = 0;
  let loaderLastPaint = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const drawMedusa = (now = 0) => {
    if (!loaderCanvas || loader?.classList.contains('is-complete')) return;
    if (!reducedMotion) loaderFrameId = window.requestAnimationFrame(drawMedusa);
    if (!reducedMotion && now - loaderLastPaint < 32) return;
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
    loader?.setAttribute('aria-hidden', 'true');
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
  const filmStage = film.querySelector('.scroll-film-sticky');
  let frameId = 0;
  let targetTime = 0;
  let pendingSeekTime = null;
  let isSeeking = false;

  video.pause();
  video.muted = true;
  video.playsInline = true;
  video.defaultMuted = true;

  const waitForVideo = (eventName, readyState, timeout = 30000) => new Promise((resolve, reject) => {
    if (video.readyState >= readyState) {
      resolve();
      return;
    }
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener('error', onError);
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Video ${eventName} timeout`));
    }, timeout);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video failed to load'));
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });

  const seekOnce = (time) => new Promise((resolve, reject) => {
    const target = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - .05)));
    if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - target) < .02) {
      resolve();
      return;
    }
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      if (video.readyState >= 2) resolve();
      else reject(new Error('Seek timeout'));
    }, 4000);
    const onSeeked = () => {
      cleanup();
      isSeeking = false;
      resolve();
    };
    const onError = () => {
      cleanup();
      isSeeking = false;
      reject(new Error('Seek failed'));
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    pendingSeekTime = null;
    isSeeking = true;
    video.currentTime = target;
  });

  const prepareVideo = async () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const constrainedConnection = connection?.saveData
      || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
    const useMobileVideo = window.matchMedia('(max-width: 767px)').matches
      || constrainedConnection;
    const useHighQualityVideo = window.matchMedia('(min-width: 1200px)').matches
      && window.devicePixelRatio > 1
      && !constrainedConnection;
    const videoUrl = useMobileVideo
      ? '/assets/pteron-scroll-mobile.mp4'
      : useHighQualityVideo
        ? '/assets/pteron-scroll-hq.mp4'
        : '/assets/pteron-scroll.mp4';

    // Blob first so iOS Safari can scrub the scroll film reliably.
    const response = await fetch(videoUrl, { priority: 'high' });
    if (!response.ok) throw new Error(`Video fetch failed: ${response.status}`);
    const blob = await response.blob();
    video.src = URL.createObjectURL(blob);
    video.load();

    await waitForVideo('loadedmetadata', 1, 20000);
    // Force a decode of the first frames on iOS without leaving playback on.
    const playback = video.play();
    playback?.catch(() => {});
    await waitForVideo('loadeddata', 2, 20000);
    video.pause();

    // Prove mid-timeline scrubbing before revealing the page.
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 1) {
      await seekOnce(duration * .5);
      await seekOnce(0);
    } else {
      await seekOnce(0);
    }
    isSeeking = false;
    filmStage?.classList.add('is-video-ready');
    updateFilm();
  };

  const commitSeek = () => {
    if (pendingSeekTime === null || isSeeking) return;
    const next = pendingSeekTime;
    pendingSeekTime = null;
    if (Math.abs(video.currentTime - next) < .025 && !video.seeking) return;
    isSeeking = true;
    const done = () => {
      video.removeEventListener('seeked', done);
      isSeeking = false;
      commitSeek();
    };
    video.addEventListener('seeked', done);
    video.currentTime = next;
  };

  const updateFilm = () => {
    frameId = 0;
    const start = film.offsetTop;
    const travel = Math.max(1, film.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / travel));
    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : 0;
    targetTime = reducedMotion ? 0 : progress * duration * .88;
    if (duration && filmStage?.classList.contains('is-video-ready')) {
      if (Math.abs(video.currentTime - targetTime) > .025) {
        pendingSeekTime = targetTime;
        commitSeek();
      }
    }
    if (progressLabel) progressLabel.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')} — 100`;
    if (product) {
      const isMobile = window.innerWidth <= 560;
      const enterDuration = isMobile ? .28 : .18;
      const enter = reducedMotion ? 1 : Math.min(1, Math.max(0, progress / enterDuration));
      // Start higher so the pteron window is already readable as the film arrives.
      const startOffset = isMobile ? 22 : 12;
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

  // Keep the medusa up until the scroll film is decoded and seekable.
  // Soft timeout only uncovers the page; preparation continues and enables the film after.
  const preparation = reducedMotion ? Promise.resolve() : prepareVideo().catch(() => {
    filmStage?.classList.remove('is-video-ready');
  });
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const minimumLoaderTime = new Promise((resolve) => window.setTimeout(resolve, 500));
  const softReveal = new Promise((resolve) => window.setTimeout(resolve, 45000));

  Promise.all([
    Promise.race([preparation, softReveal]),
    fontsReady,
    minimumLoaderTime
  ]).finally(() => {
    updateFilm();
    finishLoading();
    // If the film becomes ready after the soft reveal, arm scrubbing then.
    preparation.finally(() => updateFilm());
  });
})();
