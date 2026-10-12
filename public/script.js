/* pteron · sitio — comportamiento compartido (2026-10-12.9)
   El índice que sale de la esquina, Descargar con la plataforma del visitante y la versión publicada, el año del pie
   y los botones de copiar. Cada página agrega lo suyo en su propio script. */
(() => {
  "use strict";
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  $$("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  /* ——— Índice: la esquina doblada abre una hoja con las páginas. Sin <dialog>, el enlace lleva al pie. ——— */
  const indice = document.getElementById("indice");
  const oreja = document.querySelector("[data-indice]");
  if (indice && oreja && typeof indice.showModal === "function") {
    oreja.setAttribute("role", "button");
    oreja.setAttribute("aria-haspopup", "dialog");
    oreja.setAttribute("aria-expanded", "false");
    oreja.setAttribute("aria-controls", "indice");
    const abrir = (event) => {
      event.preventDefault();
      indice.showModal();
      oreja.setAttribute("aria-expanded", "true");
    };
    oreja.addEventListener("click", abrir);
    oreja.addEventListener("keydown", (event) => {
      if (event.key === " ") abrir(event);
    });
    indice.addEventListener("close", () => {
      oreja.setAttribute("aria-expanded", "false");
      oreja.focus({ preventScroll: true });
    });
    $$("[data-indice-cerrar]", indice).forEach((button) => button.addEventListener("click", () => indice.close()));
    // Un clic fuera de la hoja (en el fondo del diálogo) la cierra
    indice.addEventListener("click", (event) => {
      if (event.target === indice) indice.close();
    });
    // Un enlace a la misma página (un ancla) cierra el índice antes de saltar
    $$("a", indice).forEach((link) => link.addEventListener("click", () => indice.close()));
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
