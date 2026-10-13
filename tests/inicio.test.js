import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// La escena del inicio (public/inicio.js) corre sobre un documento de mentira: lo justo para medir, dibujar cuadros a
// mano y ver qué queda escrito en las láminas, la esquina y la escena
const source = readFileSync(new URL("../public/inicio.js", import.meta.url), "utf8");

class Nodo {
  constructor(props = {}) {
    this.attrs = new Map();
    this.estilo = new Map();
    this.hijos = new Map();
    this.listas = new Map();
    this.oyentes = new Map();
    this.dataset = {};
    this.clases = new Set();
    Object.assign(this, props);
    const estilo = this.estilo;
    this.style = new Proxy(
      {
        setProperty: (k, v) => (v === "" ? estilo.delete(k) : estilo.set(k, String(v))),
        removeProperty: (k) => estilo.delete(k),
        getPropertyValue: (k) => estilo.get(k) ?? "",
      },
      {
        get: (base, k) => (k in base ? base[k] : (estilo.get(k) ?? "")),
        set: (base, k, v) => {
          if (v === "" || v === null) estilo.delete(k);
          else estilo.set(k, String(v));
          return true;
        },
      },
    );
    const clases = this.clases;
    this.classList = {
      contains: (c) => clases.has(c),
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      toggle: (c, force = !clases.has(c)) => (force ? clases.add(c) : clases.delete(c), force),
    };
  }
  getAttribute(nombre) {
    if (nombre === "style") return this.estilo.size ? [...this.estilo].map(([k, v]) => `${k}: ${v}`).join("; ") : null;
    return this.attrs.has(nombre) ? this.attrs.get(nombre) : null;
  }
  setAttribute(nombre, valor) {
    if (nombre !== "style") return void this.attrs.set(nombre, String(valor));
    this.estilo.clear();
    for (const par of String(valor).split(";")) {
      const [k, ...v] = par.split(":");
      if (k.trim()) this.estilo.set(k.trim(), v.join(":").trim());
    }
  }
  removeAttribute(nombre) {
    if (nombre === "style") this.estilo.clear();
    else this.attrs.delete(nombre);
  }
  hasAttribute(nombre) {
    return this.attrs.has(nombre);
  }
  toggleAttribute(nombre, force = !this.attrs.has(nombre)) {
    if (force) this.attrs.set(nombre, "");
    else this.attrs.delete(nombre);
    return Boolean(force);
  }
  querySelector(sel) {
    return this.hijos.get(sel) ?? null;
  }
  querySelectorAll(sel) {
    return this.listas.get(sel) ?? [];
  }
  addEventListener(tipo, fn) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, []);
    this.oyentes.get(tipo).push(fn);
  }
  dispatchEvent(evento) {
    for (const fn of this.oyentes.get(evento.type) ?? []) fn(evento);
    return true;
  }
  getBoundingClientRect() {
    const r = this.caja?.() ?? { left: 0, top: 0, width: 0, height: 0 };
    return { x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, ...r };
  }
}

/** Una página de inicio con cuatro láminas, una mesa de ancho × alto y un reloj y unos cuadros que avanzan a mano. */
function cargar({ ancho = 1440, alto = 900, estilos = null } = {}) {
  const vista = { ancho, alto, escena: alto * 4, scrollY: 0, falla: false };
  let reloj = 0;
  let siguiente = 0;
  const cuadros = new Map();
  const cancelados = [];
  const avisos = [];

  const fija = new Nodo();
  Object.defineProperty(fija, "clientWidth", { get: () => vista.ancho });
  Object.defineProperty(fija, "clientHeight", { get: () => vista.alto });
  const portada = new Nodo({ scrollHeight: 500 });
  const escena = new Nodo({
    caja: () => {
      if (vista.falla) throw new TypeError("falla de prueba");
      return { left: 0, top: -vista.scrollY, width: vista.ancho, height: vista.escena };
    },
  });
  Object.defineProperty(escena, "offsetHeight", { get: () => vista.escena });
  const laminas = [20, 40, 60, 80].map((x, i) => {
    const node = new Nodo();
    node.setAttribute("style", `--x: ${x}; --y: ${30 + i * 10}; --w: 12; --r: ${i - 2}`);
    node.hijos.set(".lamina-cuerpo", new Nodo());
    node.hijos.set(".lamina-sombra", new Nodo());
    node.hijos.set(".lamina-reverso", new Nodo());
    return node;
  });
  const capa = new Nodo();
  capa.listas.set(".lamina", laminas);
  escena.hijos.set("[data-portada]", portada);
  escena.hijos.set(".escena-fija", fija);
  escena.hijos.set("[data-mesa]", new Nodo());
  escena.hijos.set(".mesa-pie", new Nodo());
  const corner = new Nodo();
  corner.toggleAttribute("data-oculto", true);
  const indice = new Nodo();
  const raiz = new Nodo();
  const documento = new Nodo({ documentElement: raiz, visibilityState: "visible" });
  const porSelector = { "[data-escena]": escena, "[data-laminas]": capa, ".esquina-descargar": corner };
  documento.querySelector = (sel) => porSelector[sel] ?? null;
  documento.getElementById = (id) => (id === "indice" ? indice : null);
  const despachados = [];
  const despachar = documento.dispatchEvent.bind(documento);
  documento.dispatchEvent = (evento) => (despachados.push(evento.type), despachar(evento));

  const ventana = new Nodo({
    document: documento,
    performance: { now: () => reloj, getEntriesByType: () => [] },
    location: { hash: "" },
    console: { warn: (...args) => avisos.push(args), log() {}, error() {} },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: (nodo) => ({ display: "block", getPropertyValue: (k) => nodo.estilo.get(k) ?? "" }),
    requestAnimationFrame: (fn) => {
      siguiente += 1;
      cuadros.set(siguiente, fn);
      return siguiente;
    },
    cancelAnimationFrame: (id) => {
      cancelados.push(id);
      cuadros.delete(id);
    },
    scrollTo() {},
    setTimeout,
    clearTimeout,
  });
  Object.defineProperty(ventana, "innerWidth", { get: () => vista.ancho });
  Object.defineProperty(ventana, "innerHeight", { get: () => vista.alto });
  Object.defineProperty(ventana, "scrollY", { get: () => vista.scrollY });
  ventana.window = ventana;
  // script.js deja aquí la promesa de las hojas de estilo cuando alguna no había llegado
  if (estilos) ventana.pteronEstilos = estilos;
  const originales = laminas.map((node) => node.getAttribute("style"));
  vm.runInNewContext(source, ventana);

  return {
    vista,
    escena,
    laminas,
    originales,
    corner,
    indice,
    raiz,
    documento,
    ventana,
    despachados,
    avisos,
    cuadros,
    cancelados,
    avanzar(ms) {
      reloj += ms;
    },
    /** Corre los cuadros pedidos hasta ahora, como lo haría el navegador. */
    cuadro(ms = 16) {
      reloj += ms;
      const pendientes = [...cuadros];
      cuadros.clear();
      pendientes.forEach(([, fn]) => fn(reloj));
    },
  };
}
const pose = (page) => page.laminas.filter((node) => node.style.transform === "none").length;

test("la escena se mide y se dibuja al cargar: la esquina queda oculta y ninguna lámina en la pose de medir", () => {
  const page = cargar();
  assert.ok(page.escena.hasAttribute("data-viva"));
  assert.equal(page.corner.dataset.control, "inicio");
  assert.equal(pose(page), 0);
  assert.ok(page.laminas.every((node) => node.style.transform.startsWith("translate3d(")));
  assert.ok(page.corner.hasAttribute("data-oculto"));
  page.cuadro();
  assert.equal(page.cuadros.size, 1, "arriba de la escena el ciclo sigue");
});

test("un error al dibujar deja la página quieta: sin data-viva, estilos de origen y la esquina para script.js", () => {
  const page = cargar();
  page.cuadro();
  page.vista.falla = true;
  page.cuadro();
  assert.ok(!page.escena.hasAttribute("data-viva"));
  assert.deepEqual(
    page.laminas.map((node) => node.getAttribute("style")),
    page.originales,
  );
  assert.ok(page.laminas.every((node) => !node.hasAttribute("data-arriba")));
  assert.equal(page.corner.dataset.control, undefined);
  assert.ok(page.despachados.includes("pteron:esquina"));
  assert.equal(page.avisos.length, 1);
  assert.equal(page.cuadros.size, 0, "no se piden más cuadros");
  // Después nada la despierta
  page.vista.falla = false;
  page.ventana.dispatchEvent({ type: "scroll" });
  page.ventana.dispatchEvent({ type: "resize" });
  assert.equal(page.cuadros.size, 0);
  assert.ok(!page.escena.hasAttribute("data-viva"));
});

test("un cuadro pedido que no llega en un segundo se cancela y se pide otro", () => {
  const page = cargar();
  const [primero] = page.cuadros.keys();
  page.avanzar(500);
  page.ventana.dispatchEvent({ type: "scroll" });
  assert.deepEqual([...page.cuadros.keys()], [primero], "medio segundo: se sigue esperando");
  page.avanzar(700);
  page.ventana.dispatchEvent({ type: "focus" });
  assert.deepEqual([...page.cancelados], [primero]);
  assert.equal(page.cuadros.size, 1);
  assert.notEqual([...page.cuadros.keys()][0], primero);
  page.cuadro();
  assert.equal(page.cuadros.size, 1, "el ciclo vuelve a correr");
});

test("con el índice abierto, medir otra vez espera al cierre: ninguna lámina queda en la pose de medir", () => {
  const page = cargar();
  page.cuadro();
  page.raiz.classList.add("con-indice");
  page.cuadro();
  assert.equal(page.cuadros.size, 0, "con el índice abierto la escena se detiene");
  const antes = page.laminas.map((node) => node.style.transform);
  page.ventana.dispatchEvent({ type: "load" });
  assert.equal(pose(page), 0);
  assert.deepEqual(
    page.laminas.map((node) => node.style.transform),
    antes,
  );
  page.raiz.classList.remove("con-indice");
  page.indice.dispatchEvent({ type: "close" });
  page.cuadro();
  assert.equal(pose(page), 0);
  assert.ok(page.laminas.every((node) => node.style.transform.startsWith("translate3d(")));
});

test("si la mesa cambia de tamaño sin resize (pestaña de fondo, caché), el cuadro siguiente la mide otra vez", () => {
  const page = cargar({ ancho: 1440, alto: 3600 });
  page.cuadro();
  // La ventana vuelve a su tamaño real y nadie avisa con resize: la escena sigue siendo cuatro pantallas de alto
  page.vista.alto = 900;
  page.vista.escena = 3600;
  page.cuadro();
  // Arriba de todo la esquina sigue oculta y las láminas reposan dentro de la pantalla nueva
  assert.ok(page.corner.hasAttribute("data-oculto"));
  for (const node of page.laminas) {
    const [, x, y] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(node.style.transform).map(Number);
    assert.ok(x > -200 && x < 1440 && y > -200 && y < 900, `lámina fuera de la pantalla: ${node.style.transform}`);
  }
});

test("con hojas de estilo pendientes (Safari corre los defer sin esperarlas), la escena espera y mide con ellas", async () => {
  let listo;
  const estilos = new Promise((resolve) => (listo = resolve));
  // Sin su CSS la mesa no es una pantalla: mide lo que mide toda la escena
  const page = cargar({ ancho: 1440, alto: 27000, estilos });
  assert.ok(!page.escena.hasAttribute("data-viva"), "sin las hojas no se decide nada");
  assert.equal(page.corner.dataset.control, undefined);
  assert.equal(page.cuadros.size, 0);
  assert.ok(page.laminas.every((node) => !node.style.transform));
  // Llegan las hojas: la mesa es la pantalla y la escena, cuatro pantallas
  page.vista.alto = 900;
  page.vista.escena = 3600;
  listo();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(page.escena.hasAttribute("data-viva"));
  assert.equal(page.corner.dataset.control, "inicio");
  assert.ok(page.corner.hasAttribute("data-oculto"), "arriba de todo la esquina sigue oculta");
  for (const node of page.laminas) {
    const [, x, y] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(node.style.transform).map(Number);
    assert.ok(x > -200 && x < 1440 && y > -200 && y < 900, `lámina fuera de la pantalla: ${node.style.transform}`);
  }
  page.cuadro();
  assert.equal(page.cuadros.size, 1, "y el ciclo corre");
});
