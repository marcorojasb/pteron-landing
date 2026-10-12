/* pteron · sitio — comportamiento compartido (2026-10-12.10)
   El índice que sale de la esquina doblada, Descargar con la plataforma del visitante y la versión publicada, el año del pie
   y los botones de copiar. Cada página agrega lo suyo en su propio script. */
(() => {
  "use strict";
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  $$("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  /* ——— Índice: la esquina doblada de arriba a la derecha abre la hoja azul con los capítulos de la página y las páginas
     del sitio. Mientras está abierta la página no se mueve. Sin <dialog>, el enlace lleva al pie. ——— */
  const indice = document.getElementById("indice");
  const oreja = document.querySelector("[data-indice]");
  if (indice && oreja && typeof indice.showModal === "function") {
    const raiz = document.documentElement;
    const hoja = indice.querySelector("[data-indice-hoja]") || indice;
    const bloque = indice.querySelector("[data-indice-capitulos]");
    const lista = bloque?.querySelector("ol");
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
    const suave = () => (quieto.matches ? "auto" : "smooth");
    let alCerrar = null; // qué hacer al terminar de cerrar (ir a un capítulo); sin nada, el foco vuelve a la esquina

    oreja.setAttribute("role", "button");
    oreja.setAttribute("aria-haspopup", "dialog");
    oreja.setAttribute("aria-expanded", "false");
    oreja.setAttribute("aria-controls", "indice");

    /** Los capítulos de la página: lo marcado con data-capitulo o, en la documentación, los títulos del artículo. */
    const capitulos = () => {
      let fuente = $$("main [data-capitulo]");
      if (!fuente.length) fuente = $$("[data-article] h2[id]");
      return fuente
        .filter((el) => el.id && el.getClientRects().length)
        // La lista ya numera: «1. Descarga pteron» queda «Descarga pteron»
        .map((el) => ({ el, nombre: (el.dataset.capitulo || el.textContent).trim().replace(/\s+/g, " ").replace(/^\d+[.)]\s+/, "") }));
    };

    /** Dónde empieza un capítulo. Dentro de la escena fija del inicio, un capítulo es un momento del recorrido. */
    const posicion = (el) => {
      const escena = el.closest("[data-escena][data-viva]");
      const avance = Number.parseFloat(el.dataset.capituloAvance);
      if (escena && Number.isFinite(avance)) {
        return escena.getBoundingClientRect().top + window.scrollY + (escena.offsetHeight - window.innerHeight) * avance;
      }
      const margen = Number.parseFloat(getComputedStyle(raiz).scrollPaddingTop) || 0;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - margen);
    };

    // El foco va al título del capítulo (o al capítulo mismo), sin volver a desplazar la página
    const enfocar = (el) => {
      const titulo = el.matches("h1, h2, h3") ? el : document.getElementById(el.getAttribute("aria-labelledby") || "") || el;
      if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    };

    const ir = (el) => {
      window.scrollTo({ top: posicion(el), behavior: suave() });
      history.replaceState(history.state, "", `#${el.id}`);
      enfocar(el);
    };

    /** Arma la lista de capítulos y marca dónde está el lector. */
    const llenar = () => {
      if (!bloque || !lista) return null;
      const items = capitulos();
      bloque.hidden = items.length < 2;
      if (bloque.hidden) return null;
      const linea = window.scrollY + window.innerHeight * 0.3;
      let actual = -1;
      items.forEach((item, i) => {
        if (posicion(item.el) <= linea) actual = i;
      });
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= raiz.scrollHeight - 2) actual = items.length - 1;
      const enlaces = items.map((item, i) => {
        const a = document.createElement("a");
        a.href = `#${item.el.id}`;
        a.textContent = item.nombre;
        if (i === actual) a.setAttribute("aria-current", "location");
        a.addEventListener("click", (event) => {
          event.preventDefault();
          cerrar(() => ir(item.el));
        });
        const li = document.createElement("li");
        li.append(a);
        return li;
      });
      lista.replaceChildren(...enlaces);
      return lista.querySelector("[aria-current]") || lista.querySelector("a");
    };

    const abrir = (event) => {
      event?.preventDefault();
      if (indice.open) return;
      const primero = llenar();
      // Sin la barra de desplazamiento la página no debe correrse: el ancho que deja libre se devuelve como relleno
      const barra = window.innerWidth - raiz.clientWidth;
      if (barra > 0) raiz.style.setProperty("--barra", `${barra}px`);
      raiz.classList.add("con-indice");
      indice.classList.remove("is-cerrando");
      indice.showModal();
      oreja.setAttribute("aria-expanded", "true");
      (primero || indice.querySelector('.indice-paginas [aria-current="page"]'))?.focus();
    };

    const cerrar = (despues = null) => {
      if (!indice.open) return;
      alCerrar = despues;
      if (quieto.matches || indice.classList.contains("is-cerrando")) {
        indice.close();
        return;
      }
      indice.classList.add("is-cerrando");
      let listo = false;
      const fin = () => {
        if (listo) return;
        listo = true;
        if (indice.open) indice.close();
      };
      hoja.addEventListener("animationend", fin, { once: true });
      setTimeout(fin, 340);
    };

    const soltar = () => {
      indice.classList.remove("is-cerrando");
      raiz.classList.remove("con-indice");
      raiz.style.removeProperty("--barra");
      oreja.setAttribute("aria-expanded", "false");
    };

    oreja.addEventListener("click", abrir);
    oreja.addEventListener("keydown", (event) => {
      if (event.key === " ") abrir(event);
    });
    // Escape: se cierra con la misma animación (si el navegador insiste, «close» limpia igual)
    indice.addEventListener("cancel", (event) => {
      event.preventDefault();
      cerrar();
    });
    indice.addEventListener("close", () => {
      soltar();
      const accion = alCerrar;
      alCerrar = null;
      if (accion) accion();
      else oreja.focus({ preventScroll: true });
    });
    $$("[data-indice-cerrar]", indice).forEach((button) => button.addEventListener("click", () => cerrar()));
    // Un clic fuera de la hoja (en el fondo del diálogo) la cierra
    indice.addEventListener("click", (event) => {
      if (event.target === indice) cerrar();
    });
    // La página en que uno ya está: se cierra y se vuelve al comienzo, sin recargar
    $$(".indice-paginas a, .indice-pie a", indice).forEach((link) => {
      link.addEventListener("click", (event) => {
        if (link.protocol === "mailto:" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.pathname !== location.pathname || link.search !== location.search) return;
        event.preventDefault();
        cerrar(() => {
          window.scrollTo({ top: 0, behavior: suave() });
          history.replaceState(history.state, "", location.pathname + location.search);
          const h1 = document.querySelector("main h1");
          if (h1) enfocar(h1);
        });
      });
    });
    // En iOS el fondo puede seguir el dedo aunque la página esté bloqueada: fuera de la hoja no se arrastra nada
    indice.addEventListener(
      "touchmove",
      (event) => {
        if (!hoja.contains(event.target) || hoja.scrollHeight <= hoja.clientHeight) event.preventDefault();
      },
      { passive: false },
    );
    // Al salir de la página con el índice abierto (y volver con «Atrás»), la página vuelve suelta
    window.addEventListener("pagehide", () => {
      if (!indice.open) return;
      alCerrar = () => {};
      indice.close();
      soltar();
    });
  }

  /* ——— Plataforma del visitante. Sin una detección clara (teléfono, tableta, ChromeOS, Linux ARM) no se marca nada. ——— */
  const detectPlatform = () => {
    const ua = navigator.userAgent || "";
    const hint = navigator.userAgentData?.platform || "";
    if (/Android|iPhone|iPad|iPod|CrOS/i.test(ua)) return null;
    if (/Win/i.test(hint) || /Windows NT/i.test(ua)) return "windows";
    if (/mac/i.test(hint) || /Macintosh|Mac OS X/i.test(ua)) return navigator.maxTouchPoints > 1 ? null : "macos";
    if ((/Linux/i.test(hint) || /Linux|X11/i.test(ua)) && !/aarch64|arm64|armv\d/i.test(ua)) return "linux";
    return null;
  };
  const platform = detectPlatform();
  const PLATFORM_NAME = { macos: "macOS", windows: "Windows", linux: "Linux" };
  const PLATFORM_ASSET = { macos: "macosDmg", windows: "windowsExe", linux: "linuxAppImage" };
  if (platform) {
    $$(`[data-platform="${platform}"]`).forEach((node) => node.classList.add("is-detected"));
    $$("[data-descargar]").forEach((link) => {
      link.textContent = `Descargar para ${PLATFORM_NAME[platform]}`;
      link.href = `/descargar#${platform}`;
    });
  }

  /* ——— Versión publicada (release-data.js): número, archivos y enlaces reales; sin datos no se anuncia ninguna. ——— */
  const releases = window.PTERON_RELEASES;
  const megabytes = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
  const size = (bytes) => (Number.isFinite(bytes) && bytes > 0 ? `${megabytes.format(bytes / 1e6)} MB` : "");
  if (releases && $$("[data-release-version], [data-release-asset], [data-release-file], [data-release-link], [data-descargar]").length) {
    releases
      .loadReleaseCatalog()
      .then(({ latest }) => {
        if (!latest) return;
        $$("[data-release-version]").forEach((node) => {
          node.textContent = latest.version;
          node.hidden = false;
        });
        $$("[data-release-date]").forEach((node) => {
          node.textContent = latest.publishedLabel;
          node.hidden = false;
        });
        $$("[data-release-file]").forEach((node) => {
          const asset = releases.findAsset(latest, node.dataset.releaseFile);
          if (asset) node.textContent = [asset.name, size(asset.bytes)].filter(Boolean).join(", ");
        });
        $$("[data-release-version-texto]").forEach((node) => {
          node.hidden = false;
        });
        $$("[data-release-link]").forEach((node) => {
          node.href = latest.url;
        });
        $$("[data-release-asset]").forEach((node) => {
          const asset = releases.findAsset(latest, node.dataset.releaseAsset);
          if (asset) node.href = asset.url;
        });
        // El botón del visitante baja directo el archivo de su equipo
        const own = platform && releases.findAsset(latest, PLATFORM_ASSET[platform]);
        if (own) $$("[data-descargar]").forEach((link) => (link.href = own.url));
      })
      .catch(() => {});
  }

  /* ——— Descargar en la esquina: aparece cuando el botón de la página sale de la vista ——— */
  const corner = document.querySelector(".esquina-descargar");
  const own = $$("main [data-descargar], main .boton-principal").find((node) => node !== corner);
  if (corner) {
    if (own && "IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        // Una página que maneja la esquina por su cuenta (el inicio) lo marca con data-control
        if (corner.dataset.control) return;
        corner.toggleAttribute("data-oculto", entry.isIntersecting || entry.boundingClientRect.top > 0);
      }).observe(own);
    } else corner.removeAttribute("data-oculto");
  }

  /* ——— Copiar: <button data-copy="texto"> o data-copy-target="#id" ——— */
  $$("[data-copy], [data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.dataset.copyTarget ? document.querySelector(button.dataset.copyTarget) : null;
      const text = button.dataset.copy ?? target?.textContent ?? "";
      const label = button.querySelector("[data-copy-label]") || button;
      const before = label.textContent;
      try {
        await navigator.clipboard.writeText(text.trim());
        label.textContent = "Copiado";
      } catch {
        if (target) window.getSelection()?.selectAllChildren(target);
        label.textContent = "Selecciónalo y copia";
      }
      setTimeout(() => (label.textContent = before), 1800);
    });
  });
})();
