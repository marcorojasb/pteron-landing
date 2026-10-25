/* pteron · /descargar/<sistema> (2026-10-25)
   Al llegar, la página baja el instalador de la última versión completa (release-data.js) y deja a la vista los pasos
   para instalarlo. Recargar o volver con «Atrás» no repite la descarga. La analítica de visitas cuenta cada una de
   estas páginas aparte: cada visita es una descarga de ese sistema. Sin catálogo, el botón queda en la página de
   versiones de GitHub; en un teléfono, que no instala pteron, se vuelve a /descargar, donde se envía el enlace. */
(() => {
  "use strict";
  const main = document.querySelector("[data-descarga]");
  const boton = document.querySelector("[data-descarga-boton]");
  if (!main || !boton) return;
  // script.js, que corre antes, marca el teléfono o la tableta
  if (document.documentElement.dataset.equipo === "movil") {
    location.replace("/descargar");
    return;
  }
  const releaseData = window.PTERON_RELEASES;
  if (!releaseData) return;
  const tipo = performance.getEntriesByType?.("navigation")?.[0]?.type;
  const llegada = !tipo || tipo === "navigate";
  // La descarga sale después de load: la analítica alcanza a anotar la visita antes de que el navegador baje el archivo
  const cargada = document.readyState === "complete" ? Promise.resolve() : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  releaseData
    .loadReleaseCatalog()
    .then(async ({ latest }) => {
      const archivo = latest && releaseData.findAsset(latest, main.dataset.descarga);
      if (!archivo) return;
      // El dibujo de la instalación nombra el archivo que baja
      document.querySelectorAll("[data-descarga-nombre]").forEach((nodo) => (nodo.textContent = archivo.name));
      boton.href = archivo.url;
      boton.textContent = "Descargar otra vez";
      if (!llegada) return;
      await cargada;
      location.assign(archivo.url);
    })
    .catch(() => {});
})();
