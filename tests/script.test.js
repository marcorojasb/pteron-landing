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
function cargar({ descargar = true, colofon = true, observador = true } = {}) {
  Vigia.todos = [];
  const corner = new Nodo({ nombre: "esquina" });
  corner.toggleAttribute("data-oculto", true);
  const own = new Nodo({ nombre: "botón de la página" });
  const porId = {
    descargar: descargar ? new Nodo({ id: "descargar" }) : null,
    colofon: colofon ? new Nodo({ id: "colofon" }) : null,
  };
  const listas = { "main [data-descargar], main .boton-principal": [own] };
  const documento = new Nodo({
    readyState: "complete",
    documentElement: new Nodo(),
    querySelectorAll: (sel) => listas[sel] ?? [],
    querySelector: (sel) => (sel === ".esquina-descargar" ? corner : null),
    getElementById: (id) => porId[id] ?? null,
  });
  const ventana = new Nodo({
    document: documento,
    navigator: { userAgent: "", maxTouchPoints: 0 },
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
