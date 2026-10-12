/* pteron · comportamiento compartido del sitio (revisión 2026-10-12.5).
   Sin dependencias. Todo lo que mueve algo respeta prefers-reduced-motion,
   y el contenido es visible aunque este archivo no llegue a cargar. */
(() => {
  "use strict";
  const doc = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
  const canMove = () => motion.matches;
  const narrowQuery = window.matchMedia("(max-width: 760px)");
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  // Ahorro de datos o red lenta: sin vídeo, sólo la imagen fija.
  const constrained = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(connection && (connection.saveData || /2g|3g/.test(connection.effectiveType || "")));
  };
  const VERSION = "?v=2026-10-12.7";

  /* Año en el pie y donde se pida. */
  $$("[data-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });

  /* Navegación: barra completa arriba, píldora de vidrio al desplazarse.
     Con el menú móvil abierto, el resto de la página queda inerte: el foco no se escapa bajo el velo. */
  const nav = document.querySelector("[data-nav]");
  const menuButton = document.querySelector("[data-menu-button]");
  const menu = menuButton ? document.getElementById(menuButton.getAttribute("aria-controls")) : null;

  const setMenu = (open, { restoreFocus = false } = {}) => {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.hidden = !open;
    for (const node of document.body.children) {
      if (node !== nav && !node.contains(nav) && node.tagName !== "SCRIPT") node.inert = open;
    }
    nav?.classList.toggle("is-open", open);
    if (!open && restoreFocus) menuButton.focus();
  };

  if (menuButton && menu) {
    menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") setMenu(false, { restoreFocus: true });
    });
    // El velo que oscurece la página pertenece a la cabecera: un clic ahí cierra el menú.
    nav?.addEventListener("click", (event) => { if (event.target === nav) setMenu(false, { restoreFocus: true }); });
    window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => { if (event.matches) setMenu(false); });
  }

  /* Apariciones escalonadas. Sólo se ocultan los elementos que todavía no se ven,
     así no hay parpadeo en el primer pantallazo ni contenido oculto sin JavaScript. */
  const revealables = $$("[data-reveal]");
  const showAll = () => revealables.forEach((node) => node.classList.add("is-in"));
  let revealObserver = null;
  if (!canMove() || !("IntersectionObserver" in window)) {
    showAll();
  } else if (revealables.length) {
    const viewport = window.innerHeight;
    revealables.forEach((node) => {
      const box = node.getBoundingClientRect();
      if (box.top < viewport * 0.92 && box.bottom > 0) node.classList.add("is-in");
    });
    doc.classList.add("reveal-on");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealObserver = observer;
    revealables.forEach((node) => { if (!node.classList.contains("is-in")) observer.observe(node); });
    // Red de seguridad: ninguna sección queda invisible si el observador no dispara.
    window.addEventListener("load", () => setTimeout(() => {
      revealables.forEach((node) => {
        const box = node.getBoundingClientRect();
        if (box.bottom < 0) node.classList.add("is-in");
      });
    }, 1200), { once: true });
  }

  /* Película con desplazamiento (inicio): el cielo queda fijo mientras pasan el texto y la ventana,
     y el vídeo avanza fotograma a fotograma con el scroll. Sin movimiento, con ahorro de datos
     o sin un formato reproducible queda el primer fotograma (el póster). */
  const film = document.querySelector("[data-scroll-film]");
  const filmVideo = film?.querySelector("video") || null;
  const filmBackdrop = film?.querySelector(".film-backdrop") || null;
  const filmWindow = film?.querySelector("[data-film-window]") || null;
  const filmState = { ready: false, seeking: false, target: 0, stuck: 0, blob: false, url: "", requested: false };
  // La altura del escenario se fija en píxeles una sola vez (y al cambiar el ancho): sin saltos
  // cuando la barra del navegador móvil aparece o desaparece.
  let filmWidth = window.innerWidth;
  const lockFilmHeight = () => film?.style.setProperty("--fh", `${Math.round(window.innerHeight)}px`);
  if (film) {
    lockFilmHeight();
    window.addEventListener("resize", () => {
      if (window.innerWidth === filmWidth) return;
      filmWidth = window.innerWidth;
      lockFilmHeight();
    });
  }

  const pickFilmSource = () => {
    const base = narrowQuery.matches ? filmVideo?.dataset.filmNarrow : filmVideo?.dataset.filmWide;
    if (!base) return "";
    if (filmVideo.canPlayType('video/mp4; codecs="avc1.640028"')) return `${base}.mp4${VERSION}`;
    if (filmVideo.canPlayType('video/webm; codecs="vp9"')) return `${base}.webm${VERSION}`;
    return "";
  };
  // Safari (macOS e iOS) sólo avanza fotograma a fotograma con el archivo completo en memoria.
  const needsBlob = () => {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return iOS || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua));
  };
  const waitFor = (target, type, timeout) => new Promise((resolve, reject) => {
    const finish = (ok) => {
      clearTimeout(timer);
      target.removeEventListener(type, onReady);
      target.removeEventListener("error", onError);
      if (ok) resolve(); else reject(new Error(`${type} sin respuesta`));
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(onError, timeout);
    target.addEventListener(type, onReady);
    target.addEventListener("error", onError);
  });

  const attachFilm = async (src) => {
    filmVideo.muted = true;
    filmVideo.playsInline = true;
    filmVideo.src = src;
    filmVideo.load();
    const loaded = waitFor(filmVideo, "loadeddata", 20000);
    // Un play() breve despierta el decodificador (iOS); se pausa en cuanto hay un fotograma.
    filmVideo.play()?.catch(() => {});
    await loaded;
    filmVideo.pause();
    filmState.ready = true;
    filmBackdrop?.classList.add("is-ready");
    requestUpdate();
  };

  const loadFilm = async () => {
    const url = pickFilmSource();
    if (!url) return;
    filmState.url = url;
    let src = url;
    if (needsBlob()) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`vídeo ${response.status}`);
      src = URL.createObjectURL(await response.blob());
      filmState.blob = true;
    } else {
      // 206 = el servidor entrega rangos y el vídeo puede transmitirse; si no, se usa la misma descarga.
      const probe = await fetch(url, { headers: { Range: "bytes=0-1" } });
      if (probe.status === 206) {
        probe.body?.cancel?.().catch?.(() => {});
      } else if (probe.ok) {
        src = URL.createObjectURL(await probe.blob());
        filmState.blob = true;
      } else {
        throw new Error(`vídeo ${probe.status}`);
      }
    }
    await attachFilm(src);
  };

  // Un salto atascado tres veces seguidas pasa el vídeo a memoria completa.
  const promoteFilm = async () => {
    if (filmState.blob || !filmState.url) return;
    filmState.blob = true;
    filmState.ready = false;
    try {
      const response = await fetch(filmState.url);
      if (!response.ok) throw new Error(`vídeo ${response.status}`);
      await attachFilm(URL.createObjectURL(await response.blob()));
    } catch {
      filmBackdrop?.classList.remove("is-ready");
    }
  };

  // Un solo salto en vuelo; el siguiente toma el destino más reciente.
  const seekFilm = () => {
    if (!filmState.ready || filmState.seeking || !filmVideo || filmVideo.readyState < 1) return;
    const target = filmState.target;
    if (Math.abs(filmVideo.currentTime - target) < 0.03) return;
    filmState.seeking = true;
    let watch = 0;
    const finish = (stuck) => {
      clearTimeout(watch);
      filmVideo.removeEventListener("seeked", onSeeked);
      filmState.seeking = false;
      if (stuck) {
        filmState.stuck += 1;
        if (filmState.stuck >= 3) promoteFilm();
      } else {
        filmState.stuck = 0;
      }
      if (Math.abs(filmState.target - filmVideo.currentTime) >= 0.03) requestAnimationFrame(seekFilm);
    };
    const onSeeked = () => finish(false);
    watch = setTimeout(() => finish(true), 2500);
    filmVideo.addEventListener("seeked", onSeeked);
    filmVideo.currentTime = target;
  };

  const updateFilm = (vh) => {
    const box = film.getBoundingClientRect();
    if (box.bottom < -vh * 0.5 || box.top > vh * 1.5) {
      filmWindow?.style.setProperty("--tilt", "0");
      filmWindow?.style.setProperty("--lift", "0");
      return;
    }
    const travel = box.height - vh;
    const progress = travel > 0 ? clamp01(-box.top / travel) : 0;
    if (filmState.ready && Number.isFinite(filmVideo.duration)) {
      filmState.target = progress * Math.max(0, filmVideo.duration - 0.05) * 0.88;
      seekFilm();
    }
    if (filmWindow) {
      // Se endereza al entrar por abajo; fuera de la vista queda recta (nadie la ve y las capturas no la tuercen).
      const top = filmWindow.getBoundingClientRect().top;
      const enter = top >= vh ? 1 : clamp01((vh - top) / (vh * 0.75));
      filmWindow.style.setProperty("--tilt", (7 * (1 - enter)).toFixed(2));
      filmWindow.style.setProperty("--lift", (44 * (1 - enter)).toFixed(1));
    }
  };

  const requestFilm = () => {
    if (filmState.requested || !filmVideo || !canMove() || constrained()) return;
    filmState.requested = true;
    loadFilm().catch(() => {
      filmState.ready = false;
      filmBackdrop?.classList.remove("is-ready");
    });
  };
  if (film && filmVideo && "IntersectionObserver" in window) {
    // Se prepara cuando la película está a menos de una pantalla de distancia.
    const filmObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        filmObserver.disconnect();
        requestFilm();
      }
    }, { rootMargin: "100% 0px 100% 0px" });
    filmObserver.observe(film);
  }

  /* Profundidad: parallax suave de fotos y baldosas, la ventana del héroe que se endereza y la película. */
  const collectScenes = () => $$("[data-parallax]").map((node) => ({ node, speed: parseFloat(node.dataset.parallax) || 0.1, hero: Boolean(node.closest(".hero")) }));
  let scenes = collectScenes();
  const heroWindow = document.querySelector("[data-hero-window]");
  const tetrisWell = document.querySelector("[data-tetris]");
  let lastSp = "";
  const wide = window.matchMedia("(min-width: 761px)");
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (nav && !nav.classList.contains("nav--solid")) nav.classList.toggle("is-scrolled", y > 24);
    if (!canMove()) return;
    scenes.forEach(({ node, speed, hero }) => {
      if (hero) {
        if (y < vh * 1.6) node.style.setProperty("--py", `${(y * speed).toFixed(1)}px`);
        return;
      }
      const box = node.parentElement.getBoundingClientRect();
      if (box.bottom < -100 || box.top > vh + 100) return;
      const offset = box.top + box.height / 2 - vh / 2;
      node.style.setProperty("--py", `${(-offset * speed).toFixed(1)}px`);
    });
    if (tetrisWell) {
      // Vista explosionada del pozo: al bajar, las piezas se separan, suben y se apagan (--sp de 0 a 1).
      const narrow = narrowQuery.matches;
      const sp = clamp01((y - (narrow ? 120 : 30)) / (narrow ? 460 : 560)).toFixed(3);
      if (sp !== lastSp) { lastSp = sp; tetrisWell.style.setProperty("--sp", sp); }
    }
    if (heroWindow) {
      const progress = wide.matches ? Math.min(1, y / 520) : 1;
      heroWindow.style.setProperty("--tilt", (6 * (1 - progress)).toFixed(2));
      heroWindow.style.setProperty("--lift", (-22 * progress).toFixed(1));
    }
    if (film) updateFilm(vh);
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  motion.addEventListener("change", () => {
    if (!canMove()) {
      scenes.forEach(({ node }) => node.style.removeProperty("--py"));
      tetrisWell?.style.removeProperty("--sp");
      lastSp = "";
      [heroWindow, filmWindow].forEach((node) => { node?.style.removeProperty("--tilt"); node?.style.removeProperty("--lift"); });
      filmBackdrop?.classList.remove("is-ready");
      filmVideo?.pause();
      showAll();
    }
    requestUpdate();
  });
  update();

  /* Una página que pinta contenido después de cargar (docs/app.js) avisa con «pteron:content»:
     se vuelven a medir las capas con parallax y aparece lo nuevo marcado con data-reveal. */
  document.addEventListener("pteron:content", () => {
    scenes = collectScenes();
    $$("[data-reveal]:not(.is-in)").forEach((node) => {
      if (revealObserver) revealObserver.observe(node);
      else node.classList.add("is-in");
    });
    requestUpdate();
  });

  /* Vídeo de fondo en bucle (<video data-bg-video data-src-wide data-src-narrow>, sin extensión):
     sólo con movimiento y sin ahorro de datos; se pausa fuera de pantalla. La imagen fija queda debajo. */
  $$("video[data-bg-video]").forEach((video) => {
    if (!canMove() || constrained() || !("IntersectionObserver" in window)) return;
    const base = narrowQuery.matches ? video.dataset.srcNarrow : video.dataset.srcWide;
    const type = video.canPlayType('video/webm; codecs="vp9"') ? "webm" : video.canPlayType('video/mp4; codecs="avc1.640028"') ? "mp4" : "";
    if (!base || !type) return;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener("playing", () => video.classList.add("is-ready"), { once: true });
    video.addEventListener("error", () => video.classList.remove("is-ready"));
    video.src = `${base}.${type}${VERSION}`;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && canMove()) video.play()?.catch(() => {});
        else video.pause();
      });
    });
    observer.observe(video);
    motion.addEventListener("change", () => {
      if (canMove()) return;
      video.pause();
      video.classList.remove("is-ready");
    });
  });

  /* Aurora generativa (<canvas data-aurora>): cortinas de luz que derivan despacio, a 30 cuadros
     por segundo como máximo y en pausa fuera de pantalla. Con movimiento reducido, un solo cuadro. */
  $$("canvas[data-aurora]").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const TAU = Math.PI * 2;
    const curtains = [
      { base: 0.32, amp: 0.07, k: 1.3, speed: 0.021, phase: 0.4, height: 0.5, alpha: 0.6, rgb: [72, 210, 196] },
      { base: 0.25, amp: 0.06, k: 2.1, speed: -0.017, phase: 2.1, height: 0.42, alpha: 0.5, rgb: [96, 146, 255] },
      { base: 0.4, amp: 0.05, k: 0.9, speed: 0.013, phase: 4.2, height: 0.3, alpha: 0.34, rgb: [168, 118, 255] },
      { base: 0.36, amp: 0.045, k: 1.7, speed: -0.011, phase: 3.1, height: 0.26, alpha: 0.3, rgb: [255, 122, 176] },
      { base: 0.44, amp: 0.035, k: 3.2, speed: 0.026, phase: 1.3, height: 0.1, alpha: 0.3, rgb: [250, 172, 92] },
    ].map((curtain) => {
      // Cada cortina es una tira vertical: borde inferior brillante que se desvanece hacia arriba.
      const strip = document.createElement("canvas");
      strip.width = 1;
      strip.height = 64;
      const g = strip.getContext("2d");
      const [r, gr, b] = curtain.rgb;
      const gradient = g.createLinearGradient(0, 0, 0, 64);
      gradient.addColorStop(0, `rgba(${r},${gr},${b},0)`);
      gradient.addColorStop(0.62, `rgba(${r},${gr},${b},0.38)`);
      gradient.addColorStop(0.9, `rgba(${r},${gr},${b},1)`);
      gradient.addColorStop(1, `rgba(${r},${gr},${b},0)`);
      g.fillStyle = gradient;
      g.fillRect(0, 0, 1, 64);
      return { ...curtain, strip };
    });
    const draw = (t) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      curtains.forEach((c) => {
        for (let x = 0; x < W; x += 1) {
          const u = x / W;
          const y = H * (c.base
            + c.amp * Math.sin(TAU * (c.k * u + c.speed * t) + c.phase)
            + c.amp * 0.45 * Math.sin(TAU * (c.k * 2.3 * u - c.speed * 1.6 * t) + c.phase * 1.7));
          const glow = 0.5 + 0.5 * Math.sin(TAU * (1.7 * u + c.speed * 0.8 * t) + c.phase * 2.3);
          // Rayos: modulación fina a lo largo de la cortina, que también recorta su borde superior.
          const rays = 0.62 + 0.38 * Math.sin(TAU * (c.k * 11 * u + c.speed * 2.4 * t) + c.phase * 3) * Math.sin(TAU * (c.k * 4.3 * u - c.speed * 1.1 * t));
          const height = H * c.height * (0.7 + 0.3 * Math.sin(TAU * (2.4 * u + c.speed * 0.5 * t) + c.phase)) * (0.82 + 0.3 * rays);
          ctx.globalAlpha = Math.min(1, c.alpha * (0.2 + 0.8 * glow * glow) * (0.55 + 0.6 * rays));
          ctx.drawImage(c.strip, x, y - height, 1, height);
        }
      });
      ctx.globalAlpha = 1;
    };
    const start = 37;
    draw(start);
    canvas.classList.add("is-drawn");
    if (!("IntersectionObserver" in window)) return;
    let visible = false;
    let frame = 0;
    let last = 0;
    let clock = start;
    const loop = (now) => {
      frame = 0;
      if (!visible || !canMove() || document.hidden) return;
      if (now - last >= 33) {
        clock += last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        draw(clock);
      }
      frame = requestAnimationFrame(loop);
    };
    const play = () => { if (!frame && visible && canMove() && !document.hidden) { last = 0; frame = requestAnimationFrame(loop); } };
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      play();
    }).observe(canvas);
    document.addEventListener("visibilitychange", play);
    motion.addEventListener("change", play);
  });

  /* Plataforma del visitante. Sin una detección clara no se marca ninguna
     (ni iOS, Android, ChromeOS, Linux ARM ni iPad): la misma regla que descargar/download.js. */
  const detectPlatform = () => {
    const ua = navigator.userAgent || "";
    const hint = navigator.userAgentData?.platform || "";
    if (/Android|iPhone|iPad|iPod|CrOS/i.test(ua)) return "";
    if (/Win/i.test(hint) || /Windows NT/i.test(ua)) return "windows";
    if (/mac/i.test(hint) || /Macintosh|Mac OS X/i.test(ua)) return navigator.maxTouchPoints > 1 ? "" : "macos";
    if ((/Linux|X11/i.test(hint) || /Linux|X11/i.test(ua)) && !/aarch64|arm64|armv\d/i.test(ua)) return "linux";
    return "";
  };
  const platform = detectPlatform();
  if (platform) $$(`[data-platform="${platform}"]`).forEach((node) => node.classList.add("is-detected"));

  /* Datos de la versión publicada (release-data.js): versión, archivo y peso reales.
     Si el catálogo no responde, la página conserva su texto sin versión. */
  const releaseHooks = $$("[data-release-version], [data-release-file], [data-release-asset], [data-release-date], [data-release-link]");
  const releaseData = window.PTERON_RELEASES;
  if (releaseHooks.length && releaseData?.loadReleaseCatalog) {
    const megabytes = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
    const size = (bytes) => (Number.isFinite(bytes) && bytes > 0 ? `${megabytes.format(bytes / 1e6)} MB` : "");
    releaseData.loadReleaseCatalog().then(({ latest }) => {
      if (!latest) return;
      $$("[data-release-version]").forEach((node) => { node.textContent = latest.version; node.hidden = false; });
      $$("[data-release-date]").forEach((node) => { node.textContent = latest.publishedLabel; node.hidden = false; });
      $$("[data-release-link]").forEach((node) => { node.href = latest.url; });
      $$("[data-release-file]").forEach((node) => {
        const asset = releaseData.findAsset(latest, node.dataset.releaseFile);
        if (asset) node.textContent = [asset.name, size(asset.bytes)].filter(Boolean).join(" · ");
      });
      $$("[data-release-asset]").forEach((node) => {
        const asset = releaseData.findAsset(latest, node.dataset.releaseAsset);
        if (asset) node.href = asset.url;
      });
    }).catch(() => {});
  }

  /* Copiar al portapapeles: <button data-copy="texto"> o data-copy-target="#id". */
  $$("[data-copy], [data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.dataset.copyTarget ? document.querySelector(button.dataset.copyTarget) : null;
      const text = button.dataset.copy || target?.textContent?.trim() || "";
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        button.dataset.copied = "true";
        const label = button.querySelector("[data-copy-label]");
        const previous = label?.textContent;
        if (label) label.textContent = "Copiado";
        setTimeout(() => { delete button.dataset.copied; if (label) label.textContent = previous; }, 2000);
      } catch {
        button.dataset.copied = "false";
      }
    });
  });
  /* Luz de color que sigue al puntero en las secciones .glow-follow (sólo con puntero fino). */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".glow-follow").forEach((section) => {
      section.addEventListener("pointermove", (event) => {
        const rect = section.getBoundingClientRect();
        section.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
        section.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
      }, { passive: true });
    });
  }
  /* Recortes del atlas: las piezas siguen al puntero según su profundidad (--z); sólo con puntero fino y movimiento. */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$("[data-cutouts]").forEach((box) => {
      const host = box.parentElement;
      let frame = 0;
      host.addEventListener("pointermove", (event) => {
        if (!canMove() || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = host.getBoundingClientRect();
          box.style.setProperty("--mx1", (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
          box.style.setProperty("--my1", (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
        });
      }, { passive: true });
      host.addEventListener("pointerleave", () => { box.style.setProperty("--mx1", "0"); box.style.setProperty("--my1", "0"); });
    });
  }
  /* Pozo de tetris del inicio: la partida arranca cuando las láminas están decodificadas (como mucho 1,5 s)
     y la pestaña está a la vista. Sin movimiento no se anima nada y el CSS muestra la estructura final.
     Con el dedo, un toque voltea una pieza y muestra su asignatura; otro toque, o tocar fuera, la devuelve. */
  if (tetrisWell) {
    const start = () => tetrisWell.classList.add("is-ready");
    const whenVisible = () => {
      if (!document.hidden) { start(); return; }
      const wake = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", wake);
        start();
      };
      document.addEventListener("visibilitychange", wake);
    };
    if (canMove()) {
      const decoded = $$("img", tetrisWell).map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
      Promise.race([Promise.all(decoded), new Promise((resolve) => { setTimeout(resolve, 1500); })]).then(whenVisible);
    } else {
      start();
    }
    const closeAll = (except) => $$(".cutout.is-flipped", tetrisWell).forEach((node) => { if (node !== except) node.classList.remove("is-flipped"); });
    tetrisWell.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      const piece = event.target.closest(".cutout");
      if (!piece) return;
      closeAll(piece);
      piece.classList.toggle("is-flipped");
    }, { passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" && !tetrisWell.contains(event.target)) closeAll();
    }, { passive: true });
  }
  /* Demo con scroll: el rumbo que cruza el centro de la pantalla activa su captura en la ventana fija. */
  const demo = document.querySelector("[data-demo]");
  if (demo && "IntersectionObserver" in window) {
    const steps = $$("[data-demo-step]", demo);
    const shots = $$(".demo-shots img");
    const bar = document.querySelector(".demo-progress i");
    const activate = (index) => {
      steps.forEach((step, k) => step.classList.toggle("is-active", k === index));
      shots.forEach((shot, k) => shot.classList.toggle("is-active", k === index));
      if (bar) { bar.style.translate = `${index * 100}% 0`; bar.style.backgroundColor = getComputedStyle(steps[index]).getPropertyValue("--ac"); }
    };
    const watcher = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) activate(steps.indexOf(entry.target)); });
    }, { rootMargin: "-42% 0px -46% 0px", threshold: 0 });
    steps.forEach((step) => watcher.observe(step));
  }

  /* Botones magnéticos: la acción principal se inclina hacia el puntero (puntero fino y movimiento). */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".button-ember, .nav-cta").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        if (!canMove()) return;
        const rect = button.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        button.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
      }, { passive: true });
      button.addEventListener("pointerleave", () => { button.style.translate = ""; });
    });
  }
})();
