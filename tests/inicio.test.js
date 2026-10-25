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
function cargar({ ancho = 1440, alto = 900, estilos = null, quieto = false, scrollY = 0, hash = "", navegacion } = {}) {
  const vista = { ancho, alto, escena: alto * 4, scrollY, falla: false };
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
    node.hijos.set(".lamina-cara", new Nodo());
    node.hijos.set(".lamina-cara img", { complete: true, naturalWidth: 600, decode: () => Promise.resolve(), cual: i });
    return node;
  });
  const capa = new Nodo();
  capa.listas.set(".lamina", laminas);
  escena.hijos.set("[data-portada]", portada);
  escena.hijos.set(".escena-fija", fija);
  // Las cuatro hojas de la mesa, cada una con su rótulo
  const mesa = new Nodo();
  const hojas = ["ciencias", "historia", "matematica", "lenguaje"].map((id) => {
    const node = new Nodo();
    node.dataset.hoja = id;
    node.hijos.set(".pteron-document", new Nodo());
    mesa.hijos.set(`[data-rotulo="${id}"]`, new Nodo());
    return node;
  });
  mesa.listas.set(".mesa-hoja", hojas);
  const rotulos = hojas.map((node) => mesa.hijos.get(`[data-rotulo="${node.dataset.hoja}"]`));
  escena.hijos.set("[data-mesa]", mesa);
  escena.hijos.set(".mesa-pie", new Nodo());
  const corner = new Nodo();
  corner.toggleAttribute("data-oculto", true);
  const indice = new Nodo();
  const raiz = new Nodo();
  const scripts = [];
  const documento = new Nodo({
    documentElement: raiz,
    visibilityState: "visible",
    currentScript: { src: "https://pteron.patagua.dev/inicio.js?v=prueba.1" },
    head: { append: (nodo) => scripts.push(nodo) },
    createElement: (etiqueta) => {
      const nodo = new Nodo({ etiqueta });
      nodo.remove = () => (nodo.quitado = true);
      return nodo;
    },
  });
  const porSelector = { "[data-escena]": escena, "[data-laminas]": capa, ".esquina-descargar": corner };
  documento.querySelector = (sel) => porSelector[sel] ?? null;
  documento.getElementById = (id) => (id === "indice" ? indice : null);
  const despachados = [];
  const despachar = documento.dispatchEvent.bind(documento);
  documento.dispatchEvent = (evento) => (despachados.push(evento.type), despachar(evento));

  const ventana = new Nodo({
    document: documento,
    performance: { now: () => reloj, getEntriesByType: (tipo) => (tipo === "navigation" && navegacion ? [{ type: navegacion }] : []) },
    location: { hash },
    console: { warn: (...args) => avisos.push(args), log() {}, error() {} },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    matchMedia: (consulta) => ({ matches: quieto && consulta.includes("reduced-motion"), addEventListener() {} }),
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
    rotulos,
    corner,
    indice,
    raiz,
    documento,
    ventana,
    despachados,
    avisos,
    scripts,
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
/** Dónde queda la esquina de una lámina en la mesa: su left y top del CSS (--x % y --y % de la mesa) más el transform
    que escribe la escena. */
function esquina(page, node) {
  const [, x, y] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(node.style.transform).map(Number);
  const v = (nombre) => parseFloat(node.style.getPropertyValue(nombre));
  return { x: (v("--x") / 100) * page.vista.ancho + x, y: (v("--y") / 100) * page.vista.alto + y };
}

test("la escena mueve las láminas sólo con transform: left y top quedan los del CSS y no hay salto de diseño", () => {
  const page = cargar();
  page.cuadro();
  for (const node of page.laminas) {
    assert.equal(node.style.left, "", "sin left en línea");
    assert.equal(node.style.top, "", "sin top en línea");
    // Arriba de la escena la lámina flota alrededor de su lugar del CSS: su centro, a unos pocos píxeles
    const { x, y } = esquina(page, node);
    const lado = parseFloat(node.style.width);
    const v = (nombre) => parseFloat(node.style.getPropertyValue(nombre));
    assert.ok(Math.abs(x + lado / 2 - (v("--x") / 100) * 1440) < 30, `x: ${node.style.transform}`);
    assert.ok(Math.abs(y + lado / 2 - (v("--y") / 100) * 900) < 30, `y: ${node.style.transform}`);
  }
});

test("cada rótulo cabe en lo que se ve de su hoja: en una tableta vertical no se monta sobre el siguiente", () => {
  for (const [ancho, alto] of [[768, 1024], [820, 1180], [1440, 900]]) {
    const page = cargar({ ancho, alto });
    const izquierda = page.rotulos.map((node) => Number(/translate3d\((-?[\d.]+)px/.exec(node.style.transform)[1]));
    const anchos = page.rotulos.map((node) => parseFloat(node.style.maxWidth));
    for (let i = 0; i < 3; i += 1) {
      assert.ok(anchos[i] > 100, `${ancho}×${alto}: el rótulo ${i} mide ${anchos[i]} px`);
      assert.ok(izquierda[i] + anchos[i] <= izquierda[i + 1] - 4, `${ancho}×${alto}: el rótulo ${i} llega al siguiente`);
    }
    // Si la escena queda quieta, el rótulo vuelve a su estilo de origen
    page.vista.falla = true;
    page.cuadro();
    assert.ok(page.rotulos.every((node) => node.getAttribute("style") === null));
  }
  // El ancho sólo sirve si el texto puede partirse: con nowrap el rótulo se sale de su caja y vuelve a montarse
  const css = readFileSync(new URL("../public/inicio.css", import.meta.url), "utf8");
  const regla = /\.escena\[data-viva\] \.mesa-rotulos li\{([^}]*)\}/.exec(css)?.[1];
  assert.ok(regla, "inicio.css tiene la regla de los rótulos en la escena viva");
  assert.match(regla, /white-space:normal/);
  assert.doesNotMatch(regla, /nowrap/);
});

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

test("quien ya bajó antes de que la escena arranque la ve quieta, sin saltos; #hojas, recargar y volver atrás sí la abren", () => {
  // Una red lenta: el visitante ya va por «Cómo funciona» cuando corre inicio.js
  const bajado = cargar({ scrollY: 1100 });
  assert.equal(bajado.escena.hasAttribute("data-viva"), false);
  assert.equal(bajado.corner.dataset.control, undefined, "la esquina queda en manos de script.js");
  assert.ok(bajado.laminas.every((node, i) => node.getAttribute("style") === bajado.originales[i]), "las láminas quedan como las dibuja el CSS");
  assert.equal(bajado.cuadros.size, 0, "no corre el ciclo de la escena");
  for (const opciones of [{ scrollY: 1100, hash: "#hojas" }, { scrollY: 1100, navegacion: "reload" }, { scrollY: 1100, navegacion: "back_forward" }, { navegacion: "navigate" }]) {
    assert.ok(cargar(opciones).escena.hasAttribute("data-viva"), JSON.stringify(opciones));
  }
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
    const { x, y } = esquina(page, node);
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
    const { x, y } = esquina(page, node);
    assert.ok(x > -200 && x < 1440 && y > -200 && y < 900, `lámina fuera de la pantalla: ${node.style.transform}`);
  }
  page.cuadro();
  assert.equal(page.cuadros.size, 1, "y el ciclo corre");
});

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
/** Espera a que se cumpla la condición (la escena espera con temporizadores reales): con la máquina ocupada, una espera
    fija puede quedar corta. */
async function hasta(condicion, ms = 3000) {
  const fin = Date.now() + ms;
  while (!condicion()) {
    if (Date.now() > fin) throw new Error("la condición no se cumplió a tiempo");
    await esperar(10);
  }
}
const ocultas = (page) => page.laminas.filter((node) => node.style.visibility === "hidden").length;

test("el recreo: dos clics seguidos sobre la misma lámina, no dos lentos ni sobre láminas distintas", () => {
  const page = cargar();
  page.cuadro();
  const [a, b] = page.laminas;
  a.dispatchEvent({ type: "click" });
  page.avanzar(100);
  b.dispatchEvent({ type: "click" });
  page.avanzar(500);
  b.dispatchEvent({ type: "click" });
  assert.equal(page.scripts.length, 0, "distintas o lentas: nada");
  page.avanzar(120);
  b.dispatchEvent({ type: "click" });
  assert.equal(page.scripts.length, 1);
  assert.equal(page.scripts[0].src, "/recreo.js?v=prueba.1", "con la revisión de caché de inicio.js");
  // Mientras carga, otro doble clic no pide el archivo de nuevo
  page.avanzar(50);
  a.dispatchEvent({ type: "click" });
  page.avanzar(50);
  a.dispatchEvent({ type: "click" });
  assert.equal(page.scripts.length, 1);
});

test("el recreo toma las láminas quietas y derechas, la del doble clic primero; al cerrar vuelven a su lugar", async () => {
  const page = cargar();
  page.cuadro();
  const antes = page.laminas.map((node) => node.style.transform);
  const tercera = page.laminas[2];
  tercera.dispatchEvent({ type: "click" });
  page.avanzar(80);
  tercera.dispatchEvent({ type: "click" });
  const abiertos = [];
  page.ventana.pteronRecreo = { abrir: (opciones) => abiertos.push(opciones) };
  page.scripts[0].dispatchEvent({ type: "load" });
  // Se ordenan: en medio segundo quedan derechas (sin giro) y quietas
  for (let i = 0; i < 30; i += 1) page.cuadro(20);
  for (const node of page.laminas) assert.match(node.style.transform, /rotate\(0deg\)/, `derecha: ${node.style.transform}`);
  await hasta(() => abiertos.length === 1);
  const [{ laminas, transformar, alCerrar }] = abiertos;
  assert.equal(transformar, true);
  assert.equal(laminas.length, 4);
  assert.equal(laminas[0].img.cual, 2, "la del doble clic, primera");
  assert.ok(laminas.every((l) => typeof l.lado === "number" && l.sombra && "recorte" in l));
  assert.equal(ocultas(page), 4, "las de la página se esconden: el recreo las dibuja");
  page.cuadro();
  assert.equal(page.cuadros.size, 0, "con las láminas en el recreo la escena no pide cuadros");

  alCerrar();
  assert.equal(page.cuadros.size, 1, "vuelven");
  // Se muestran en el cuadro siguiente, ya bajo la pantalla (no en el lugar donde el recreo las tomó) y suben
  assert.equal(ocultas(page), 4);
  page.cuadro(16);
  assert.equal(ocultas(page), 0);
  assert.ok(page.laminas.some((node) => esquina(page, node).y > 900), "parten bajo la pantalla");
  for (let i = 0; i < 120; i += 1) page.cuadro(16);
  page.laminas.forEach((node, i) => {
    const y = (t) => Number(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(t)[2]);
    assert.ok(Math.abs(y(node.style.transform) - y(antes[i])) < 30, `lámina ${i} de vuelta: ${node.style.transform}`);
  });
  // Y se puede volver a abrir
  page.avanzar(1000);
  tercera.dispatchEvent({ type: "click" });
  page.avanzar(80);
  tercera.dispatchEvent({ type: "click" });
  await hasta(() => abiertos.length === 2);
});

test("si recreo.js no carga, las láminas vuelven a flotar, se avisa en la consola y otro doble clic lo intenta de nuevo", async () => {
  const page = cargar();
  page.cuadro();
  const [a] = page.laminas;
  a.dispatchEvent({ type: "click" });
  page.avanzar(80);
  a.dispatchEvent({ type: "click" });
  page.scripts[0].dispatchEvent({ type: "error" });
  await hasta(() => page.avisos.length > 0);
  assert.ok(page.scripts[0].quitado);
  assert.equal(ocultas(page), 0);
  assert.ok(page.avisos.some(([texto]) => String(texto).includes("recreo")));
  for (let i = 0; i < 40; i += 1) page.cuadro(20);
  assert.ok(page.laminas.some((node) => !/rotate\(0deg\)/.test(node.style.transform)), "flotan otra vez, con su giro");
  page.avanzar(1000);
  a.dispatchEvent({ type: "click" });
  page.avanzar(80);
  a.dispatchEvent({ type: "click" });
  assert.equal(page.scripts.length, 2);
});

test("con movimiento reducido el recreo se abre de una vez: sin ordenar ni esconder las láminas", async () => {
  const page = cargar({ quieto: true });
  const [a] = page.laminas;
  a.dispatchEvent({ type: "click" });
  page.avanzar(80);
  a.dispatchEvent({ type: "click" });
  const abiertos = [];
  page.ventana.pteronRecreo = { abrir: (opciones) => abiertos.push(opciones) };
  page.scripts[0].dispatchEvent({ type: "load" });
  await hasta(() => abiertos.length === 1);
  assert.equal(abiertos[0].transformar, false);
  assert.equal(abiertos[0].laminas.length, 4, "las piezas llevan igual las láminas");
  assert.equal(ocultas(page), 0);
  assert.equal(page.cuadros.size, 0, "la escena sigue quieta");
});
