/* pteron · sitio — comportamiento compartido (2026-10-12.12)
   El índice que sale de la esquina doblada, Descargar con la plataforma del visitante y la versión publicada, el año del pie
   y los botones de copiar. Cada página agrega lo suyo en su propio script. */
(() => {
  "use strict";
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* ——— Hojas de estilo: Safari corre los scripts «defer» sin esperarlas (Chromium y Firefox sí las esperan), y lo que se
     mide al cargar saldría de la página sin su CSS. window.pteronEstilos es una promesa que se cumple cuando todas las
     hojas de la página están puestas, o null si ya lo estaban. ——— */
  const hojasPendientes = $$('link[rel="stylesheet"]').filter((link) => !link.sheet && (!link.media || window.matchMedia(link.media).matches));
  const estilos =
    hojasPendientes.length && document.readyState !== "complete"
      ? new Promise((listo) => {
          const faltan = new Set(hojasPendientes);
          const una = (event) => {
            faltan.delete(event.currentTarget);
            if (!faltan.size) listo();
          };
          faltan.forEach((link) => {
            link.addEventListener("load", una, { once: true });
            link.addEventListener("error", una, { once: true });
          });
          // Una hoja que ya había fallado no vuelve a avisar: el «load» de la página llega de todos modos
          window.addEventListener("load", listo, { once: true });
        })
      : null;
  window.pteronEstilos = estilos;

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
    let abiertoEn = 0;

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
    const posicion = (el, momento = el.dataset.capituloAvance) => {
      const escena = el.closest("[data-escena][data-viva]");
      const avance = Number.parseFloat(momento);
      if (escena && Number.isFinite(avance)) {
        return escena.getBoundingClientRect().top + window.scrollY + (escena.offsetHeight - window.innerHeight) * avance;
      }
      const margen = Number.parseFloat(getComputedStyle(raiz).scrollPaddingTop) || 0;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - margen);
    };

    // El foco va al título del capítulo: el que lo nombra (aria-labelledby), el primero visible que tenga dentro (no los
    // de las hojas de muestra, que están ocultos al lector) o, si no hay, el capítulo mismo. Sin volver a desplazar.
    const enfocar = (el) => {
      const interno = $$("h1, h2, h3", el).find((h) => !h.closest('[aria-hidden="true"]'));
      const titulo = el.matches("h1, h2, h3") ? el : document.getElementById(el.getAttribute("aria-labelledby") || "") || interno || el;
      if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
      return document.activeElement === titulo;
    };

    const ir = (el) => {
      window.scrollTo({ top: posicion(el), behavior: suave() });
      history.replaceState(history.state, "", `#${el.id}`);
      if (enfocar(el)) return;
      // El título todavía no se ve (la portada aparece al volver arriba): el foco llega cuando termina el desplazamiento
      let hecho = false;
      const otraVez = () => {
        if (hecho) return;
        hecho = true;
        window.removeEventListener("scrollend", otraVez);
        enfocar(el);
      };
      window.addEventListener("scrollend", otraVez);
      setTimeout(otraVez, 1000);
    };

    /** Arma la lista de capítulos y marca dónde está el lector. */
    const llenar = () => {
      if (!bloque || !lista) return null;
      const items = capitulos();
      bloque.hidden = items.length < 2;
      if (bloque.hidden) return null;
      // El capítulo actual es el último que ya llegó adonde aterriza un salto: así, después de saltar a un capítulo corto,
      // el siguiente no se marca. En la escena del inicio un capítulo cuenta desde data-capitulo-desde, si lo tiene.
      const arriba = window.scrollY + 8;
      let actual = -1;
      items.forEach((item, i) => {
        if (posicion(item.el, item.el.dataset.capituloDesde ?? item.el.dataset.capituloAvance) <= arriba) actual = i;
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
      abiertoEn = performance.now();
      oreja.setAttribute("aria-expanded", "true");
      (primero || indice.querySelector('.indice-paginas [aria-current="page"]'))?.focus();
    };

    const cerrar = (despues = null) => {
      if (!indice.open) return;
      // Un segundo cierre mientras la hoja sale (Escape tras elegir un capítulo) cierra de inmediato, sin borrar el
      // salto que dejó pendiente el primero
      if (indice.classList.contains("is-cerrando")) {
        if (despues) alCerrar = despues;
        indice.close();
        return;
      }
      alCerrar = despues;
      if (quieto.matches) {
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
    // Cerrar queda donde estaba la esquina: el segundo clic de un doble clic (o un toque repetido mientras la hoja sale)
    // no la cierra
    const aDestiempo = (event) => event.detail > 1 || performance.now() - abiertoEn < 450;
    $$("[data-indice-cerrar]", indice).forEach((button) =>
      button.addEventListener("click", (event) => {
        if (!aDestiempo(event)) cerrar();
      }),
    );
    // Un clic fuera de la hoja (en el fondo del diálogo) la cierra
    indice.addEventListener("click", (event) => {
      if (event.target === indice && !aDestiempo(event)) cerrar();
    });
    // La página en que uno ya está: se cierra y se vuelve al comienzo, sin recargar. Otra página: el índice se cierra
    // antes de seguir (la documentación navega sin recargar y el diálogo quedaría abierto sobre la página nueva).
    $$(".indice-paginas a, .indice-pie a", indice).forEach((link) => {
      link.addEventListener("click", (event) => {
        if (link.protocol === "mailto:" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.pathname !== location.pathname || link.search !== location.search) {
          alCerrar = () => {};
          indice.close();
          return;
        }
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

  /* ——— Al imprimir, las preguntas cerradas se abren (y vuelven a cerrarse después) ——— */
  window.addEventListener("beforeprint", () => {
    $$("details:not([open])").forEach((details) => {
      details.dataset.impresion = "";
      details.open = true;
    });
  });
  window.addEventListener("afterprint", () => {
    $$("details[data-impresion]").forEach((details) => {
      details.open = false;
      delete details.dataset.impresion;
    });
  });

  /* ——— El pie del reverso de una lámina ocupa justo su celda: si el texto no cabe (una palabra más ancha que la celda o
     más líneas que su alto), sale primero el crédito y después el título, y queda sólo la figura ——— */
  const pies = $$(".reverso-pie");
  if (pies.length) {
    const desborda = (pie) => pie.scrollHeight > pie.clientHeight + 1 || pie.scrollWidth > pie.clientWidth + 1;
    const ajustar = () =>
      pies.forEach((pie) => {
        pie.classList.remove("sin-credito", "sin-titulo");
        if (desborda(pie)) pie.classList.add("sin-credito");
        if (desborda(pie)) pie.classList.add("sin-titulo");
      });
    let pendiente = false;
    const pedir = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        ajustar();
      });
    };
    ajustar();
    document.fonts?.ready.then(pedir);
    window.addEventListener("resize", pedir, { passive: true });
    // Si las hojas llegaron después (Safari), se ajusta otra vez con ellas y con sus letras
    estilos?.then(() => {
      pedir();
      document.fonts?.ready.then(pedir);
    });
  }

  /* ——— Piezas de las cabeceras: con el dedo se dan vuelta al tocarlas; con cursor, al pasar por encima (CSS) ——— */
  const conCursor = window.matchMedia("(hover: hover) and (pointer: fine)");
  $$("[data-pieza]").forEach((pieza) => {
    pieza.addEventListener("click", () => {
      if (!conCursor.matches) pieza.classList.toggle("is-volteada");
    });
  });

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
  // Un teléfono o una tableta no instala pteron: sus enlaces llevan a /descargar (arriba, donde se envía el enlace),
  // nunca a un instalador de escritorio
  const movil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") || (/Macintosh/i.test(navigator.userAgent || "") && navigator.maxTouchPoints > 1);
  if (movil) {
    document.documentElement.dataset.equipo = "movil";
    $$('a[href^="/descargar#"]').forEach((link) => (link.href = "/descargar"));
  }
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
        if (!movil) {
          $$("[data-release-asset]").forEach((node) => {
            const asset = releases.findAsset(latest, node.dataset.releaseAsset);
            if (asset) node.href = asset.url;
          });
        }
        // El botón del visitante baja directo el archivo de su equipo
        const own = platform && releases.findAsset(latest, PLATFORM_ASSET[platform]);
        if (own) $$("[data-descargar]").forEach((link) => (link.href = own.url));
      })
      .catch(() => {});
  }

  /* ——— Descargar en la esquina: aparece cuando el botón de la página sale de la vista, y se aparta donde la página ya
     ofrece la descarga (la sección «Descargar» y el pie) ——— */
  const corner = document.querySelector(".esquina-descargar");
  const own = $$("main [data-descargar], main .boton-principal").find((node) => node !== corner);
  if (corner) {
    const zonas = [document.getElementById("descargar"), document.getElementById("colofon")].filter(Boolean);
    if (own && "IntersectionObserver" in window) {
      let propio = false; // el botón de la página está a la vista o todavía más abajo
      const enZona = new Set();
      const decidir = () => {
        // Una página que maneja la esquina por su cuenta (el inicio con su escena viva) lo marca con data-control
        if (corner.dataset.control) return;
        corner.toggleAttribute("data-oculto", propio || enZona.size > 0);
      };
      const vigia = new IntersectionObserver(([entry]) => {
        propio = entry.isIntersecting || entry.boundingClientRect.top > 0;
        decidir();
      });
      // Una zona cuenta desde que entra al 70 % de arriba de la pantalla, como en la escena del inicio
      const zona = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? enZona.add(entry.target) : enZona.delete(entry.target)));
          decidir();
        },
        { rootMargin: "0px 0px -30% 0px" },
      );
      vigia.observe(own);
      zonas.forEach((node) => zona.observe(node));
      // Si el inicio suelta la esquina (su escena falló y la página quedó quieta), se vuelve a mirar todo desde cero
      document.addEventListener("pteron:esquina", () => {
        vigia.unobserve(own);
        vigia.observe(own);
        zonas.forEach((node) => {
          zona.unobserve(node);
          zona.observe(node);
        });
      });
    } else corner.removeAttribute("data-oculto");
  }

  /* ——— Planes a la venta (/api/plans): «Elegir» sólo con el plan a la venta; si no, o sin respuesta, «Disponible pronto» ——— */
  const ventas = $$("[data-plan-venta]");
  if (ventas.length && typeof fetch === "function") {
    fetch("/api/plans", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const aLaVenta = new Set((Array.isArray(data?.plans) ? data.plans : []).filter((plan) => plan?.forSale === true).map((plan) => plan.id));
        ventas.forEach((enlace) => {
          if (!aLaVenta.has(enlace.dataset.planVenta)) return;
          enlace.hidden = false;
          const pronto = document.querySelector(`[data-plan-pronto="${enlace.dataset.planVenta}"]`);
          if (pronto) pronto.hidden = true;
        });
      })
      .catch(() => {});
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
