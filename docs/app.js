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

  let tocObserver = null;

  const renderToc = () => {
    const headings = [...article.querySelectorAll("h2[id]")];
    toc.innerHTML = headings.map((heading, index) =>
      `<a href="#${heading.id}"${index === 0 ? ' class="is-active"' : ""}>${heading.textContent}</a>`
    ).join("");
    tocObserver?.disconnect();
    if (!headings.length || !("IntersectionObserver" in window)) return;
    const links = [...toc.querySelectorAll("a")];
    const setActive = id => {
      links.forEach(link => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
      });
    };
    tocObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 1] });
    headings.forEach(heading => tocObserver.observe(heading));
  };

  // Sin catálogo esta página no anuncia ninguna versión: lo dice y ofrece la
  // fuente oficial en vez de dejar el mensaje de carga para siempre.
  const renderReleaseUnavailable = (table, notes) => {
    const releasesPageUrl =
      window.PTERON_RELEASES?.RELEASES_PAGE_URL || "https://github.com/marcorojasb/pteron-beta/releases";
    const withLink = text => {
      const link = document.createElement("a");
      link.href = releasesPageUrl;
      link.textContent = "las versiones publicadas en GitHub";
      return [document.createTextNode(text), link, document.createTextNode(".")];
    };
    if (table) {
      const message = document.createElement("p");
      message.append(...withLink("No pudimos comprobar la versión publicada. Consulta "));
      table.replaceChildren(message);
    }
    if (notes) {
      const message = document.createElement("p");
      message.textContent = "Las notas de versión aparecerán cuando el catálogo esté disponible.";
      notes.replaceChildren(message);
    }
  };

  const releaseNoteList = block => {
    const list = document.createElement("ul");
    list.className = "release-note-list";
    block.items.forEach(text => {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    return list;
  };

  // El primer párrafo presenta la versión; los que siguen a la lista son
  // notas fijas (plataformas disponibles, avisos), y las secciones conservan
  // el orden del cuerpo publicado.
  const releaseNoteBody = release => {
    const body = document.createElement("div");
    body.className = "release-note-body";
    let seenParagraph = false;
    let seenList = false;
    release.notes.forEach(block => {
      if (block.type === "list") {
        seenList = true;
        body.append(releaseNoteList(block));
        return;
      }
      if (block.type === "heading") {
        const heading = document.createElement("h3");
        heading.className = "release-note-section";
        heading.textContent = block.text;
        body.append(heading);
        return;
      }
      const paragraph = document.createElement("p");
      paragraph.className = !seenParagraph
        ? "release-note-summary"
        : seenList ? "release-note-footnote" : "release-note-text";
      paragraph.textContent = block.text;
      seenParagraph = true;
      body.append(paragraph);
    });
    return body;
  };

  const renderCurrentRelease = latest => {
    const current = document.createElement("div");
    current.className = "release-current";
    const version = document.createElement("p");
    version.className = "release-current-version";
    version.textContent = latest.version;
    const channel = document.createElement("span");
    channel.className = "release-channel";
    channel.textContent = latest.channel === "stable" ? "Estable" : "Beta";
    version.append(channel);
    const meta = document.createElement("p");
    meta.className = "release-current-meta";
    meta.append(
      document.createTextNode(latest.publishedLabel === "sin fecha"
        ? "Sin fecha de publicación"
        : `Publicada en ${latest.publishedLabel}`),
      document.createTextNode(" · ")
    );
    const link = document.createElement("a");
    link.href = latest.url;
    link.textContent = "Ver en GitHub";
    meta.append(link);
    current.append(version, meta);
    return current;
  };

  // La versión actual se lee completa; las anteriores quedan plegadas para que
  // la página no sea un muro de notas.
  const renderReleaseNotes = (releases, latestVersion) => {
    const fragment = document.createDocumentFragment();
    const featured = releases.find(release => release.version === latestVersion) || releases[0];

    if (featured) {
      const note = document.createElement("article");
      note.className = "release-note";
      const header = document.createElement("p");
      header.className = "release-note-heading";
      const version = document.createElement("strong");
      version.textContent = featured.version;
      const published = document.createElement("span");
      published.textContent = featured.publishedLabel;
      header.append(version, published);
      note.append(header, releaseNoteBody(featured));
      fragment.append(note);
    }

    const history = releases.filter(release => release !== featured);
    if (history.length) {
      const title = document.createElement("h3");
      title.className = "release-history-title";
      title.textContent = "Versiones anteriores";
      fragment.append(title);
      history.forEach(release => {
        const details = document.createElement("details");
        details.className = "release-history";
        const summary = document.createElement("summary");
        const version = document.createElement("strong");
        version.textContent = release.version;
        const published = document.createElement("span");
        published.textContent = release.publishedLabel;
        summary.append(version, published);
        details.append(summary, releaseNoteBody(release));
        fragment.append(details);
      });
    }
    return fragment;
  };

  const renderReleaseData = async () => {
    const table = article.querySelector("[data-release-table]");
    const notes = article.querySelector("[data-release-notes]");
    if (!table && !notes) return;
    try {
      if (!window.PTERON_RELEASES) throw new Error("release data unavailable");
      const data = await window.PTERON_RELEASES.loadReleaseCatalog();
      if (!data?.latest) {
        renderReleaseUnavailable(table, notes);
        return;
      }
      if (table) table.replaceChildren(renderCurrentRelease(data.latest));
      if (notes) notes.replaceChildren(renderReleaseNotes(data.releases, data.latest.version));
    } catch {
      renderReleaseUnavailable(table, notes);
    }
  };

  // Una dirección antigua sigue llevando a su página, ya renombrada.
  const resolveSlug = slug =>
    docs.pages[slug] ? slug : (docs.aliases && docs.aliases[slug]) || "inicio";

  const renderPage = (slug, push = false) => {
    const resolvedSlug = resolveSlug(slug);
    const page = docs.pages[resolvedSlug];
    if (push) history.pushState({ slug: resolvedSlug }, "", pageUrl(resolvedSlug));
    else if (resolvedSlug !== slug) history.replaceState({ slug: resolvedSlug }, "", pageUrl(resolvedSlug));
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

  let searchCursor = -1;

  const searchLinks = () => [...results.querySelectorAll("a")];

  const highlightSearchCursor = () => {
    const links = searchLinks();
    links.forEach((link, index) => {
      link.classList.toggle("is-cursor", index === searchCursor);
      if (index === searchCursor) link.scrollIntoView({ block: "nearest" });
    });
  };

  const showSearchResults = value => {
    const query = value.trim().toLocaleLowerCase("es");
    searchCursor = -1;
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
    const links = searchLinks();
    if (event.key === "Escape") {
      search.value = "";
      setSearchOpen(false, true);
      return;
    }
    if (!links.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      searchCursor = (searchCursor + 1) % links.length;
      highlightSearchCursor();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      searchCursor = (searchCursor - 1 + links.length) % links.length;
      highlightSearchCursor();
    } else if (event.key === "Enter" && searchCursor >= 0) {
      event.preventDefault();
      links[searchCursor].click();
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
