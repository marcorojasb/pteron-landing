(() => {
  const docs = window.PTERON_DOCS;
  if (!docs) return;

  const article = document.querySelector("[data-article]");
  const nav = document.querySelector("[data-docs-nav]");
  const toc = document.querySelector("[data-toc]");
  const search = document.querySelector("[data-search]");
  const results = document.querySelector("[data-search-results]");
  const searchToggle = document.querySelector("[data-search-toggle]");
  const searchPanel = document.querySelector("[data-search-panel]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const sidebar = document.querySelector("[data-sidebar]");
  const year = document.querySelector("[data-year]");
  const allPages = docs.groups.flatMap(group =>
    group.pages.map(([slug, title]) => ({ slug, title, group: group.label }))
  );

  const slugFromLocation = () => {
    const requestedPage = new URLSearchParams(location.search).get("pagina");
    if (requestedPage) return requestedPage;
    const path = location.pathname.replace(/\/+$/, "");
    if (path === "/docs" || path === "") return "inicio";
    return path.split("/").pop() || "inicio";
  };

  const pageUrl = slug => slug === "inicio" ? "/docs/" : `/docs/?pagina=${encodeURIComponent(slug)}`;

  const renderNav = active => {
    nav.innerHTML = docs.groups.map(group => `
      <section>
        <h2>${group.label}</h2>
        ${group.pages.map(([slug, title]) =>
          `<a href="${pageUrl(slug)}"${slug === active ? ' class="is-active" aria-current="page"' : ""}>${title}</a>`
        ).join("")}
      </section>
    `).join("");
  };

  const renderToc = () => {
    const headings = [...article.querySelectorAll("h2[id]")];
    toc.innerHTML = headings.map((heading, index) =>
      `<a href="#${heading.id}"${index === 0 ? ' class="is-active"' : ""}>${heading.textContent}</a>`
    ).join("");
  };

  const renderReleaseData = async () => {
    const table = article.querySelector("[data-release-table]");
    const notes = article.querySelector("[data-release-notes]");
    if (!table && !notes) return;
    try {
      if (!window.PTERON_RELEASES) throw new Error("release data unavailable");
      const data = await window.PTERON_RELEASES.loadReleaseCatalog();
      if (table) {
        const metadata = document.createElement("dl");
        metadata.className = "release-meta";
        [
          ["Versión", data.latest.version],
          ["Canal", data.latest.channel],
          ["Publicada", data.latest.publishedLabel],
        ].forEach(([label, value]) => {
          const row = document.createElement("div");
          const term = document.createElement("dt");
          const description = document.createElement("dd");
          term.textContent = label;
          description.textContent = value;
          row.append(term, description);
          metadata.append(row);
        });
        table.replaceChildren(metadata);
      }
      if (notes) {
        const fragment = document.createDocumentFragment();
        data.releases.forEach(release => {
          const releaseArticle = document.createElement("article");
          const heading = document.createElement("p");
          const version = document.createElement("strong");
          const published = document.createElement("span");
          const list = document.createElement("ul");
          releaseArticle.className = "release-note";
          version.textContent = release.version;
          published.textContent = release.publishedLabel;
          heading.append(version, published);
          release.notes.forEach(note => {
            const item = document.createElement("li");
            item.textContent = note;
            list.append(item);
          });
          releaseArticle.append(heading, list);
          fragment.append(releaseArticle);
        });
        notes.replaceChildren(fragment);
      }
    } catch {
      if (table) {
        const fallback = document.createElement("p");
        fallback.textContent = "La versión publicada aparecerá aquí cuando el canal beta esté disponible.";
        table.replaceChildren(fallback);
      }
    }
  };

  const renderPage = (slug, push = false) => {
    const page = docs.pages[slug] || docs.pages.inicio;
    const resolvedSlug = docs.pages[slug] ? slug : "inicio";
    if (push) history.pushState({ slug: resolvedSlug }, "", pageUrl(resolvedSlug));
    document.title = `${page.title} — pteron`;
    article.innerHTML = `
      <header class="article-header">
        <p>${page.eyebrow}</p>
        <h1>${page.title}</h1>
        <div>${page.lead}</div>
      </header>
      ${page.html}
      <nav class="article-pagination" aria-label="Siguiente página">${nextPageLink(resolvedSlug)}</nav>`;
    renderNav(resolvedSlug);
    renderToc();
    renderReleaseData();
    window.scrollTo({ top: 0, behavior: "auto" });
    sidebar.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Abrir navegación");
    navToggle.textContent = "Menú";
  };

  const nextPageLink = slug => {
    const index = allPages.findIndex(page => page.slug === slug);
    const next = allPages[index + 1];
    return next ? `<span>Siguiente</span><a href="${pageUrl(next.slug)}">${next.title}</a>` : `<span>Ayuda</span><a href="mailto:pteron@patagua.dev">Escribir a pteron</a>`;
  };

  const showSearchResults = value => {
    const query = value.trim().toLocaleLowerCase("es");
    if (!query) {
      results.hidden = true;
      return;
    }
    const matches = allPages.filter(page =>
      `${page.title} ${page.group} ${docs.pages[page.slug]?.lead || ""}`.toLocaleLowerCase("es").includes(query)
    ).slice(0, 7);
    results.innerHTML = matches.length
      ? matches.map(page => `<a href="${pageUrl(page.slug)}"><span>${page.title}</span><small>${page.group}</small></a>`).join("")
      : "<p>No encontramos una página con esas palabras.</p>";
    results.hidden = false;
  };

  const setSearchOpen = (open, returnFocus = false) => {
    searchPanel.hidden = !open;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      requestAnimationFrame(() => search.focus());
    } else {
      results.hidden = true;
      if (returnFocus) searchToggle.focus();
    }
  };

  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="/docs/"]');
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    setSearchOpen(false);
    renderPage(url.searchParams.get("pagina") || url.pathname.split("/").filter(Boolean).pop() || "inicio", true);
  });

  window.addEventListener("popstate", () => renderPage(slugFromLocation()));
  search.addEventListener("input", () => showSearchResults(search.value));
  search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      search.value = "";
      setSearchOpen(false, true);
    }
  });
  searchToggle.addEventListener("click", () => {
    setSearchOpen(searchPanel.hidden);
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setSearchOpen(true);
    } else if (event.key === "Escape" && !searchPanel.hidden) {
      search.value = "";
      setSearchOpen(false, true);
    }
  });
  document.addEventListener("click", event => {
    if (!searchPanel.hidden && !event.target.closest("[data-search-panel]") && !event.target.closest("[data-search-toggle]")) {
      setSearchOpen(false);
    }
  });
  navToggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Cerrar navegación" : "Abrir navegación");
    navToggle.textContent = open ? "Cerrar" : "Menú";
  });

  if (year) year.textContent = new Date().getFullYear();
  renderPage(slugFromLocation());
})();
