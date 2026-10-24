import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// La documentación vive en public/docs/content.js (window.PTERON_DOCS) y la pinta public/docs/app.js. Aquí el
// contenido se revisa como datos, contra el sitemap y llms.txt, y app.js corre sobre un documento de mentira
const leer = (ruta) => readFileSync(new URL(`../public/${ruta}`, import.meta.url), "utf8");
const contenido = leer("docs/content.js");
const app = leer("docs/app.js");
const html = leer("docs/index.html");

const SITIO = "https://pteron.patagua.dev";
const docs = (() => {
  const window = {};
  vm.runInNewContext(contenido, { window });
  return window.PTERON_DOCS;
})();
const slugs = docs.groups.flatMap((group) => group.pages.map(([slug]) => slug));
// La misma forma que pageUrl en app.js: la portada es /docs y el resto, /docs?pagina=<slug>
const urlCanonica = (slug) => (slug === "inicio" ? `${SITIO}/docs` : `${SITIO}/docs?pagina=${slug}`);
const textoPlano = (texto) => String(texto || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const descripcionPortada = /<meta name="description" content="([^"]+)">/.exec(html)?.[1];
const ordenadas = (lista) => [...lista].sort();

test("cada página del índice existe, con título y una entrada que sirve de descripción", () => {
  assert.equal(new Set(slugs).size, slugs.length, "ningún slug se repite en el índice");
  for (const slug of slugs) {
    const page = docs.pages[slug];
    assert.ok(page, `${slug}: falta la página`);
    assert.ok(textoPlano(page.title), `${slug}: sin título`);
    assert.ok(textoPlano(page.lead), `${slug}: sin entrada`);
    assert.ok(textoPlano(page.html), `${slug}: sin cuerpo`);
  }
  assert.deepEqual(ordenadas(Object.keys(docs.pages)), ordenadas(slugs), "ninguna página queda fuera del índice");
});

test("los alias llevan a una página que existe y no tapan a ninguna", () => {
  for (const [alias, destino] of Object.entries(docs.aliases)) {
    assert.ok(docs.pages[destino], `${alias} → ${destino}: no existe`);
    assert.equal(docs.pages[alias], undefined, `${alias}: ya es una página, el alias nunca se usaría`);
  }
});

test("el sitemap y llms.txt listan las páginas de content.js, cada una en la forma de su URL canónica", () => {
  const esperadas = ordenadas(slugs.map(urlCanonica));
  const locs = [...leer("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, "ninguna <loc> se repite");
  assert.deepEqual(ordenadas(locs.filter((loc) => loc.startsWith(`${SITIO}/docs`))), esperadas, "sitemap.xml");
  const enlaces = [...leer("docs/llms.txt").matchAll(/\]\((https:\/\/pteron\.patagua\.dev\/docs[^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(ordenadas(enlaces), esperadas, "docs/llms.txt");
});

test("docs/index.html no fija la URL canónica: la pone app.js según la página que se lee", () => {
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.ok(descripcionPortada, "la portada trae su descripción");
});

/** app.js con una dirección de llegada: lo justo para pintar una página, seguir un enlace y volver atrás. */
function abrir(direccion) {
  // Se sirve desde otro origen (wrangler dev, por ejemplo): la canónica sigue siendo la del sitio publicado
  const location = new URL(direccion, "http://localhost:8787");
  const oyentes = { document: new Map(), window: new Map() };
  const escuchar = (donde) => (tipo, fn) => oyentes[donde].set(tipo, [...(oyentes[donde].get(tipo) ?? []), fn]);
  const disparar = (donde, tipo, evento) => (oyentes[donde].get(tipo) ?? []).forEach((fn) => fn(evento));
  const elemento = (props = {}) =>
    Object.assign(
      {
        attrs: new Map(),
        hidden: false,
        classList: { toggle() {}, contains: () => false },
        setAttribute(nombre, valor) {
          this.attrs.set(nombre, String(valor));
        },
        getAttribute(nombre) {
          return this.attrs.get(nombre) ?? null;
        },
        removeAttribute(nombre) {
          this.attrs.delete(nombre);
        },
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        contains: () => false,
      },
      props,
    );

  const cuerpo = elemento({ children: [] });
  const cabeza = [];
  const descripcion = { content: descripcionPortada };
  const documento = {
    title: "",
    body: cuerpo,
    activeElement: cuerpo,
    head: { appendChild: (nodo) => (cabeza.push(nodo), nodo) },
    createElement: (etiqueta) => ({ etiqueta }),
    getElementById: (id) => secciones.get(id) ?? null,
    addEventListener: escuchar("document"),
  };
  // El artículo guarda su título y sus secciones con id: lo último que se pintó, que puede recibir el foco
  let titulo = null;
  let secciones = new Map();
  let desplazado = null;
  const enfocable = (props) =>
    elemento({
      ...props,
      focus() {
        documento.activeElement = this;
      },
      scrollIntoView() {
        desplazado = this;
      },
    });
  const articulo = elemento({
    querySelector: (sel) => (sel === "h1" ? titulo : null),
    contains: (nodo) => [...secciones.values()].includes(nodo),
  });
  Object.defineProperty(articulo, "innerHTML", {
    set(contenidoHtml) {
      titulo = enfocable({ textContent: /<h1>(.*?)<\/h1>/.exec(contenidoHtml)?.[1] });
      secciones = new Map([...contenidoHtml.matchAll(/<h[23] id="([^"]+)">/g)].map(([, id]) => [id, enfocable({ id })]));
      desplazado = null;
    },
  });
  const porSelector = {
    "[data-article]": articulo,
    "[data-search-panel]": elemento({ hidden: true }),
    'meta[name="description"]': descripcion,
  };
  for (const sel of ["[data-docs-nav]", "[data-toc]", "[data-search]", "[data-search-results]", "[data-search-toggle]", "[data-search-close]", "[data-nav-toggle]", "[data-sidebar]", "[data-search-status]"]) {
    porSelector[sel] = elemento();
  }
  documento.querySelector = (sel) => porSelector[sel] ?? null;

  const navegar = (url) => {
    location.href = new URL(url, location.href).href;
  };
  const ventana = vm.createContext({
    document: documento,
    location,
    history: { state: null, pushState: (_, __, url) => navegar(url), replaceState: (_, __, url) => navegar(url) },
    URL,
    URLSearchParams,
    scrollTo() {},
    requestAnimationFrame: () => 0,
    addEventListener: escuchar("window"),
  });
  ventana.window = ventana;
  vm.runInContext(contenido, ventana);
  vm.runInContext(app, ventana);

  return {
    documento,
    location,
    cabeza,
    canonica: () => cabeza[0]?.href,
    descripcion: () => descripcion.content,
    /** La sección a la que se desplazó la última página pintada, si fue a un ancla. */
    desplazado: () => desplazado,
    /** Un clic simple en un enlace de la documentación. */
    clic(href) {
      const enlace = { href: new URL(href, location.href).href, target: "" };
      disparar("document", "click", {
        button: 0,
        defaultPrevented: false,
        target: { closest: (sel) => (sel.startsWith("a[href") ? enlace : null) },
        preventDefault() {
          this.defaultPrevented = true;
        },
      });
    },
    /** «Atrás» en el navegador: la dirección cambia y llega popstate. */
    atras(direccionAnterior) {
      navegar(direccionAnterior);
      disparar("window", "popstate", {});
    },
  };
}

test("al llegar, la URL canónica y la descripción son las de la página que se lee, y el foco no se mueve", () => {
  for (const [direccion, slug] of [
    ["/docs?pagina=instalar-windows", "instalar-windows"],
    ["/docs/instalar-linux", "instalar-linux"],
    ["/docs?pagina=rubricas", "evaluar"],
    ["/docs/no-existe", "inicio"],
    ["/docs", "inicio"],
  ]) {
    const pagina = abrir(direccion);
    assert.equal(pagina.cabeza.length, 1, `${direccion}: una sola canónica`);
    assert.equal(pagina.cabeza[0].rel, "canonical");
    assert.equal(pagina.canonica(), urlCanonica(slug), direccion);
    assert.equal(pagina.descripcion(), slug === "inicio" ? descripcionPortada : textoPlano(docs.pages[slug].lead), direccion);
    assert.equal(pagina.documento.activeElement, pagina.documento.body, `${direccion}: el foco no se mueve al llegar`);
  }
});

test("al seguir un enlace y al volver atrás cambian la canónica y la descripción, y el foco pasa al título nuevo", () => {
  const pagina = abrir("/docs?pagina=requisitos");
  const enfocado = () => pagina.documento.activeElement;

  pagina.clic("/docs?pagina=crear");
  assert.equal(pagina.location.search, "?pagina=crear");
  assert.equal(pagina.canonica(), urlCanonica("crear"));
  assert.equal(pagina.descripcion(), textoPlano(docs.pages.crear.lead));
  assert.equal(enfocado().textContent, docs.pages.crear.title);
  assert.equal(enfocado().getAttribute("tabindex"), "-1");

  pagina.atras("/docs?pagina=requisitos");
  assert.equal(pagina.canonica(), urlCanonica("requisitos"));
  assert.equal(pagina.descripcion(), textoPlano(docs.pages.requisitos.lead));
  assert.equal(enfocado().textContent, docs.pages.requisitos.title);

  // De vuelta en la portada, la descripción vuelve a ser la del HTML
  pagina.clic("/docs");
  assert.equal(pagina.canonica(), urlCanonica("inicio"));
  assert.equal(pagina.descripcion(), descripcionPortada);
  assert.equal(enfocado().textContent, docs.pages.inicio.title);
  assert.equal(pagina.cabeza.length, 1, "la canónica se reutiliza, no se suma otra");
});

test("un enlace con ancla lleva a esa sección y deja ahí el foco; la dirección conserva el ancla", () => {
  const pagina = abrir("/docs?pagina=preguntas");
  pagina.clic("/docs?pagina=modelos-permisos#ia-incluida");
  assert.equal(pagina.location.search, "?pagina=modelos-permisos");
  assert.equal(pagina.location.hash, "#ia-incluida");
  assert.equal(pagina.desplazado()?.id, "ia-incluida");
  assert.equal(pagina.documento.activeElement.id, "ia-incluida", "el foco va a la sección pedida, no al título");
  assert.equal(pagina.documento.activeElement.getAttribute("tabindex"), "-1");
  assert.equal(pagina.canonica(), urlCanonica("modelos-permisos"), "la canónica no lleva el ancla");

  // Un ancla que no existe en la página nueva deja el foco en el título
  pagina.clic("/docs?pagina=requisitos#no-existe");
  assert.equal(pagina.desplazado(), null);
  assert.equal(pagina.documento.activeElement.textContent, docs.pages.requisitos.title);

  // Al llegar por un alias, la dirección pasa a la página nueva sin perder el ancla
  const alias = abrir("/docs?pagina=rubricas#criterios");
  assert.equal(alias.location.search, "?pagina=evaluar");
  assert.equal(alias.location.hash, "#criterios");
});
