import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// El comportamiento compartido del sitio (public/script.js) corre sobre un documento de mentira. Aquí se prueba la
// esquina «Descargar»: cuándo se ve, cuándo se aparta y qué pasa cuando el inicio la maneja por su cuenta.
const source = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

class Nodo {
  constructor(props = {}) {
    this.attrs = new Map();
    this.oyentes = new Map();
    this.dataset = {};
    Object.assign(this, props);
  }
  hasAttribute(nombre) {
    return this.attrs.has(nombre);
  }
  removeAttribute(nombre) {
    this.attrs.delete(nombre);
  }
  toggleAttribute(nombre, force = !this.attrs.has(nombre)) {
    if (force) this.attrs.set(nombre, "");
    else this.attrs.delete(nombre);
    return Boolean(force);
  }
  addEventListener(tipo, fn) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, []);
    this.oyentes.get(tipo).push(fn);
  }
  dispatchEvent(evento) {
    for (const fn of this.oyentes.get(evento.type) ?? []) fn(evento);
    return true;
  }
}

/** Un IntersectionObserver que avisa a mano: avisar([nodo, ¿se cruza?, top]…) es lo que el navegador entregaría. */
class Vigia {
  static todos = [];
  constructor(fn, opciones = {}) {
    this.fn = fn;
    this.opciones = opciones;
    this.mirados = new Set();
    this.vecesMirado = new Map();
    Vigia.todos.push(this);
  }
  observe(nodo) {
    this.mirados.add(nodo);
    this.vecesMirado.set(nodo, (this.vecesMirado.get(nodo) ?? 0) + 1);
  }
  unobserve(nodo) {
    this.mirados.delete(nodo);
  }
  disconnect() {
    this.mirados.clear();
  }
  avisar(...cambios) {
    for (const [target] of cambios) assert.ok(this.mirados.has(target), "sólo avisa de lo que mira");
    this.fn(
      cambios.map(([target, isIntersecting, top = 0]) => ({ target, isIntersecting, boundingClientRect: { top } })),
      this,
    );
  }
}

/** Una página con la esquina, el botón de la página y, si se piden, la sección «Descargar» y el pie. */
function cargar({ descargar = true, colofon = true, observador = true, ua = "", listas: otras = {} } = {}) {
  Vigia.todos = [];
  const corner = new Nodo({ nombre: "esquina" });
  corner.toggleAttribute("data-oculto", true);
  const own = new Nodo({ nombre: "botón de la página" });
  const porId = {
    descargar: descargar ? new Nodo({ id: "descargar" }) : null,
    colofon: colofon ? new Nodo({ id: "colofon" }) : null,
  };
  const listas = { "main [data-descargar], main .boton-principal": [own], ...otras };
  const documento = new Nodo({
    readyState: "complete",
    documentElement: new Nodo(),
    querySelectorAll: (sel) => listas[sel] ?? [],
    querySelector: (sel) => (sel === ".esquina-descargar" ? corner : null),
    getElementById: (id) => porId[id] ?? null,
  });
  const ventana = new Nodo({
    document: documento,
    navigator: { userAgent: ua, maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout,
    clearTimeout,
  });
  if (observador) ventana.IntersectionObserver = Vigia;
  ventana.window = ventana;
  vm.runInNewContext(source, ventana);

  const [vigia, zona] = Vigia.todos;
  return { corner, own, documento, vigia, zona, ...porId, oculta: () => corner.hasAttribute("data-oculto") };
}

test("esquina: oculta mientras el botón de la página se ve o está más abajo; aparece cuando sale por arriba", () => {
  const page = cargar();
  assert.deepEqual([...page.vigia.mirados], [page.own]);
  page.vigia.avisar([page.own, true, 300]);
  assert.ok(page.oculta(), "el botón se ve");
  page.vigia.avisar([page.own, false, -120]);
  assert.ok(!page.oculta(), "el botón salió por arriba");
  page.vigia.avisar([page.own, false, 900]);
  assert.ok(page.oculta(), "el botón todavía está más abajo");
});

test("esquina: se aparta en la sección «Descargar» y en el pie, y vuelve entre ellas", () => {
  const page = cargar();
  assert.deepEqual([...page.zona.mirados], [page.descargar, page.colofon]);
  assert.equal(page.zona.opciones.rootMargin, "0px 0px -30% 0px", "cuenta desde el 70 % de arriba, como la escena del inicio");
  page.vigia.avisar([page.own, false, -500]);
  page.zona.avisar([page.descargar, false], [page.colofon, false]);
  assert.ok(!page.oculta(), "entre el botón y la sección");
  page.zona.avisar([page.descargar, true]);
  assert.ok(page.oculta(), "sobre la sección «Descargar»");
  page.zona.avisar([page.descargar, false]);
  assert.ok(!page.oculta(), "entre la sección y el pie");
  page.zona.avisar([page.colofon, true]);
  assert.ok(page.oculta(), "sobre el pie");
  // Las dos a la vez: sale una y la esquina sigue apartada
  page.zona.avisar([page.descargar, true]);
  page.zona.avisar([page.colofon, false]);
  assert.ok(page.oculta(), "todavía sobre la sección");
  page.zona.avisar([page.descargar, false]);
  assert.ok(!page.oculta());
  // El botón de la página manda aunque no haya zona a la vista
  page.vigia.avisar([page.own, true, 200]);
  assert.ok(page.oculta());
});

test("esquina: una página sin sección «Descargar» (planes) se aparta sólo en el pie", () => {
  const page = cargar({ descargar: false });
  assert.deepEqual([...page.zona.mirados], [page.colofon]);
  page.vigia.avisar([page.own, false, -500]);
  page.zona.avisar([page.colofon, false]);
  assert.ok(!page.oculta());
  page.zona.avisar([page.colofon, true]);
  assert.ok(page.oculta());
});

test("esquina: con data-control (la escena viva del inicio) no se toca; al soltarla se vuelve a mirar todo", () => {
  const page = cargar();
  page.corner.dataset.control = "inicio";
  page.vigia.avisar([page.own, false, -500]);
  page.zona.avisar([page.descargar, false], [page.colofon, false]);
  assert.ok(page.oculta(), "la escena la tiene oculta y script.js no la muestra");
  page.zona.avisar([page.colofon, true]);
  page.corner.removeAttribute("data-oculto");
  page.zona.avisar([page.colofon, false]);
  assert.ok(!page.oculta(), "ni la oculta");
  // El inicio la suelta (su escena falló): script.js vuelve a observar el botón y las zonas, y el navegador avisa de nuevo
  delete page.corner.dataset.control;
  page.documento.dispatchEvent({ type: "pteron:esquina" });
  assert.equal(page.vigia.vecesMirado.get(page.own), 2);
  assert.equal(page.zona.vecesMirado.get(page.descargar), 2);
  assert.equal(page.zona.vecesMirado.get(page.colofon), 2);
  page.zona.avisar([page.descargar, true], [page.colofon, false]);
  assert.ok(page.oculta(), "sobre la sección «Descargar»");
  page.zona.avisar([page.descargar, false], [page.colofon, false]);
  assert.ok(!page.oculta(), "el botón ya había salido por arriba");
});

test("esquina: sin IntersectionObserver queda siempre a la vista", () => {
  const page = cargar({ observador: false });
  assert.equal(Vigia.todos.length, 0);
  assert.ok(!page.oculta());
});

/** /planes con sus dos planes de pago: el enlace «Elegir» oculto y «Disponible pronto» hasta saber qué se vende. */
async function planes(respuesta) {
  const nodos = {};
  for (const id of ["basic", "pro"]) {
    nodos[id] = { enlace: new Nodo({ hidden: true, dataset: { planVenta: id } }), pronto: new Nodo({ hidden: false, disabled: true }) };
  }
  const pedidos = [];
  const documento = new Nodo({
    readyState: "complete",
    documentElement: new Nodo(),
    querySelectorAll: (sel) => (sel === "[data-plan-venta]" ? [nodos.basic.enlace, nodos.pro.enlace] : []),
    querySelector: (sel) => nodos[/^\[data-plan-pronto="(\w+)"\]$/.exec(sel)?.[1]]?.pronto ?? null,
    getElementById: () => null,
  });
  const ventana = new Nodo({
    document: documento,
    navigator: { userAgent: "", maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => {
      pedidos.push([url, init?.headers?.Accept]);
      if (respuesta instanceof Error) throw respuesta;
      return { ok: respuesta.status === undefined, json: async () => respuesta };
    },
  });
  ventana.window = ventana;
  vm.runInNewContext(source, ventana);
  await new Promise((resolve) => setImmediate(resolve));
  return { nodos, pedidos };
}

test("planes: «Elegir» aparece sólo para el plan que /api/plans dice a la venta; el otro sigue «Disponible pronto»", async () => {
  const { nodos, pedidos } = await planes({ plans: [{ id: "free", forSale: false }, { id: "basic", forSale: true }, { id: "pro", forSale: false }] });
  assert.deepEqual(pedidos, [["/api/plans", "application/json"]]);
  assert.equal(nodos.basic.enlace.hidden, false);
  assert.equal(nodos.basic.pronto.hidden, true);
  assert.equal(nodos.pro.enlace.hidden, true);
  assert.equal(nodos.pro.pronto.hidden, false);
});

test("planes: con la venta cerrada, una respuesta rara o sin red, nada se ofrece", async () => {
  for (const respuesta of [{ plans: [{ id: "basic", forSale: false }, { id: "pro", forSale: false }] }, { plans: "basic" }, { status: 503 }, new Error("sin red")]) {
    const { nodos } = await planes(respuesta);
    for (const id of ["basic", "pro"]) {
      assert.equal(nodos[id].enlace.hidden, true, `${id}: ${JSON.stringify(respuesta)}`);
      assert.equal(nodos[id].pronto.hidden, false);
    }
  }
});

// Cada descarga pasa por /descargar/<sistema>: baja el archivo y la analítica de visitas la cuenta por sistema
test("el botón del visitante lleva a la página de descarga de su sistema; en un teléfono, todo vuelve a /descargar", () => {
  const enlace = (href) => ({ atributos: { href }, href, textContent: "Descargar", getAttribute(nombre) { return this.atributos[nombre] ?? null; } });
  for (const [ua, sistema, nombre] of [
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", "linux", "Linux"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "windows", "Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "macos", "macOS"],
  ]) {
    const boton = enlace("/descargar");
    cargar({ ua, listas: { "[data-descargar]": [boton] } });
    assert.equal(boton.href, `/descargar/${sistema}`, ua);
    assert.equal(boton.textContent, `Descargar para ${nombre}`, ua);
  }
  const enlaces = ["/descargar/macos", "/descargar#windows", "/descargar/linux", "/descargar/pteron-releases-public.asc", "/descargar"].map(enlace);
  const boton = enlace("/descargar");
  cargar({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", listas: { 'a[href^="/descargar"]': enlaces, "[data-descargar]": [boton] } });
  assert.deepEqual(enlaces.map((e) => e.href), ["/descargar", "/descargar", "/descargar", "/descargar/pteron-releases-public.asc", "/descargar"], "la clave pública sigue bajando");
  assert.equal(boton.href, "/descargar", "en un teléfono no se elige sistema");
  assert.equal(boton.textContent, "Descargar");
});

// El texto cambia después de pintar: si «Cómo funciona» pudiera seguir al botón en la misma línea, el botón más ancho
// lo bajaría a otra (a 390 px o en la columna de 1000 px) y la portada, alineada abajo, subiría el titular de golpe
test("con cursor, «Cómo funciona» va bajo el botón de la portada: el sistema en el texto no corre el titular", () => {
  const css = readFileSync(new URL("../public/inicio.css", import.meta.url), "utf8");
  assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)\{\s*\.portada-acciones\{flex-direction:column;align-items:flex-start\}\s*\}/);
});
