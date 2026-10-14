import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// pteron-ventana.js corre sin navegador: sin elementos en el documento, cada sección termina sin hacer nada
const source = readFileSync(new URL("../public/pteron-ventana.js", import.meta.url), "utf8");
function load() {
  const window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const document = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(source, { window, document, console });
  return window.pteronUI;
}
// Los valores vienen de otro contexto de vm (otro Array): se comparan como datos
const plain = (value) => JSON.parse(JSON.stringify(value));

// El primer pedido de partida del recorrido de bienvenida de la app (pteron/src/renderer/src/lib/recorrido.ts)
const REQUEST = "Una guía de fracciones equivalentes para 5° básico, de 45 minutos, con ejercicios graduados";

test("el pedido de «Cómo funciona» se reconoce como en la app: material, curso, tema y duración", () => {
  const { recognize } = load();
  assert.deepEqual(
    plain(recognize(REQUEST).map((item) => [item.field, item.label])),
    [
      ["artifactIntent", "Guía"],
      ["course", "5° básico"],
      ["topic", "Tema: fracciones equivalentes"],
      ["duration", "45 minutos"],
    ],
  );
  // Con la asignatura escrita, también la reconoce
  assert.deepEqual(
    plain(recognize("Necesito una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos").map((item) => item.field)),
    ["artifactIntent", "course", "subject", "topic", "duration"],
  );
  assert.deepEqual(plain(recognize("ok")), []);
});

test("el aviso de datos de estudiantes detecta y omite un RUT", () => {
  const { privacy } = load();
  const text = "La nota de Juan Pérez, RUT 12.345.678-5, es un 6,5.";
  assert.equal(privacy.containsSensitive(text), true);
  assert.equal(privacy.redactSensitive(text), "La nota de Juan Pérez, RUT [RUT omitido], es un 6,5.");
  assert.deepEqual(plain(privacy.sensitiveHints(text)), ["RUT"]);
  assert.equal(privacy.containsSensitive("Guía de fracciones para 6° básico"), false);
});

test("la tarjeta del aviso usa el marcado de PrivacyConsentCard con sus tres acciones", () => {
  const { privacyCard } = load();
  const card = privacyCard({ message: "Tu mensaje incluye datos que pueden identificar a un estudiante.", hints: ["RUT"], preview: "RUT [RUT omitido]" });
  for (const piece of [
    '<section class="privacy-consent" role="alertdialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body">',
    "Datos identificables de estudiantes</h2>",
    '<p class="privacy-consent-hints">Detectado: RUT</p>',
    // La vista previa se abre con el ratón, pero no entra en el orden de foco: la tarjeta está oculta al lector
    '<details class="privacy-consent-preview" open><summary tabindex="-1">Vista previa anonimizada</summary><pre>RUT [RUT omitido]</pre></details>',
    '<button type="button" class="btn btn-primary" tabindex="-1">Excluir fragmentos</button>',
    '<button type="button" class="btn btn-secondary" tabindex="-1">Anonimizar y continuar</button>',
    '<button type="button" class="quiet-action" tabindex="-1">Cancelar</button>',
  ]) {
    assert.ok(card.includes(piece), `falta en la tarjeta: ${piece}`);
  }
  // Sin vista previa ni datos detectados, la tarjeta no inventa esas partes
  const bare = privacyCard({ message: "m", hints: [], preview: " " });
  assert.ok(!bare.includes("privacy-consent-hints") && !bare.includes("privacy-consent-preview"));
  // El texto llega escapado
  assert.ok(privacyCard({ message: "<b>x</b>", hints: [], preview: "" }).includes("&lt;b&gt;x&lt;/b&gt;"));
});

test("la ventana usa el marcado de los componentes de la app en reposo y al terminar", () => {
  const ui = load();
  ui.window.setIcons("/iconos.svg");
  const home = ui.window.html({ final: false });
  for (const piece of [
    '<nav class="shell-index" aria-label="Índice">',
    '<button type="button" class="shell-index-fila is-principal" tabindex="-1" aria-current="page">',
    '<span class="shell-index-titulo">Cambios de estado del agua</span>',
    '<header class="shell-topbar"></header>',
    '<section class="home-surface"><header class="home-hero"><h1><svg class="pteron-marca"',
    '<div class="composer is-home is-at-rest has-chips" data-pt-composer>',
    '<div class="filter-bar" role="group" aria-label="Contexto docente">',
    '<button type="button" class="composer-send" tabindex="-1" disabled>',
    '<strong>Reflexión por voz</strong>',
    '<use href="/iconos.svg#pt-arrow-up"/>',
  ]) {
    assert.ok(home.includes(piece), `falta en la Home: ${piece}`);
  }
  // Sin «Retomar» ni pestañas de sesiones ni el wordmark antiguo: la Home de la app desde 0.8.0
  for (const gone of ["Retomar", "session-tab", "pt-wordmark", "workspace-menu-trigger"]) {
    assert.ok(!home.includes(gone), `la Home ya no trae ${gone}`);
  }
  const done = ui.window.html({ final: true });
  for (const piece of [
    '<h1 class="shell-titulo">Fracciones equivalentes</h1><span class="shell-contexto">5° básico · Matemática</span>',
    '<section class="shell-index-grupo" data-pt-grupo="5° básico · Matemática">',
    '<span class="shell-index-detalle">Guía · Pauta · hoy</span>',
    '<article class="message user" data-message-role="user"',
    '<article class="chat-file-card plan chat-plan-card is-focused" data-plan-review-state="ready">',
    '<p class="plan-decision-answer">De lo concreto a lo simbólico</p>',
    '<div class="md-body md-chat"><p>',
    '<article class="chat-file-card material-card">',
    '<h3 class="material-card-title">Pauta docente · Guía de trabajo: fracciones equivalentes</h3>',
    '<div class="composer-dock is-floating tone-reposo" data-pt-dock>',
  ]) {
    assert.ok(done.includes(piece), `falta en la conversación: ${piece}`);
  }
  assert.ok(!done.includes("pteron-marca"), "la conversación no lleva la marca de la Home");
  assert.ok(!done.includes('is-principal" tabindex="-1" aria-current'), "con el encargo abierto, «Nuevo encargo» no es la página actual");
});

test("cada icono que dibuja la ventana está en el sprite de Lucide", () => {
  const ui = load();
  ui.window.setIcons("/sprite.svg");
  const source = readFileSync(new URL("../public/pteron-ventana.js", import.meta.url), "utf8");
  const sprite = readFileSync(new URL("../public/assets/pt-icons.svg", import.meta.url), "utf8");
  const usados = new Set([
    ...[ui.window.html({ final: false }), ui.window.html({ final: true })].flatMap((html) => [...html.matchAll(/#pt-([a-z0-9-]+)"/g)].map((m) => m[1])),
    ...[...source.matchAll(/appIcon\("([a-z0-9-]+)"/g)].map((m) => m[1]),
  ]);
  assert.ok(usados.size > 20);
  for (const nombre of usados) assert.ok(sprite.includes(`<symbol id="pt-${nombre}" viewBox="0 0 24 24">`), `falta pt-${nombre} en pt-icons.svg`);
});

test("index.html trae la ventana generada por las plantillas actuales (node scripts/pteron-ventana.mjs)", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const icons = /data-pt-icons="([^"]+)"/.exec(html)?.[1];
  assert.ok(icons, "la escena de «Cómo funciona» declara data-pt-icons");
  const ui = load();
  ui.window.setIcons(icons);
  const start = "<!-- ventana:inicio -->";
  const stored = html.slice(html.indexOf(start) + start.length, html.indexOf("<!-- ventana:fin -->"));
  assert.equal(stored, ui.window.html({ final: false }));
});

// Bloques de primer nivel [preludio, cuerpo] de una hoja de estilos, respetando llaves anidadas
function selectorsOf(css) {
  const blocks = (text) => {
    const out = [];
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      let depth = 1;
      let k = open + 1;
      while (k < text.length && depth) depth += text[k] === "{" ? 1 : text[k] === "}" ? -1 : 0, (k += 1);
      out.push([text.slice(i, open).trim(), text.slice(open + 1, k - 1)]);
      i = k;
    }
    return out;
  };
  const selectors = [];
  const keyframes = [];
  const walk = (text) => {
    for (const [prelude, body] of blocks(text)) {
      if (prelude.startsWith("@keyframes")) keyframes.push(prelude.split(/\s+/)[1]);
      else if (prelude.startsWith("@media") || prelude.startsWith("@supports")) walk(body);
      else if (!prelude.startsWith("@")) selectors.push(...prelude.split(/,(?![^()]*\))/).map((part) => part.trim()));
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  return { selectors, keyframes };
}

test("pteron-app.css no toca nada fuera de la ventana", () => {
  const { selectors, keyframes } = selectorsOf(readFileSync(new URL("../public/pteron-app.css", import.meta.url), "utf8"));
  assert.ok(selectors.length > 400, "la hoja trae las reglas de la app");
  assert.deepEqual(selectors.filter((sel) => !/^(\.pt-app|:where\(\.pt-app\)|\.pt-traffic)/.test(sel)), []);
  // Las reglas son las de la interfaz actual: el índice, la marca y la hojita; ya no las pestañas de sesiones
  const css = readFileSync(new URL("../public/pteron-app.css", import.meta.url), "utf8");
  for (const regla of [".pt-app .shell-index", ".pt-app .pteron-marca", ".pt-app .activity-mark-papel", ".pt-app .chat-live-sheet-page", ".pt-app .plan-choice"]) {
    assert.ok(css.includes(regla), `pteron-app.css trae ${regla}`);
  }
  assert.ok(!css.includes("session-tab"), "pteron-app.css ya no trae las pestañas de sesiones");
  assert.ok(keyframes.length > 0 && keyframes.every((name) => name.startsWith("pa-")), "los keyframes de la app llevan el prefijo pa-");
});

test("pteron-hoja.css (las reglas de Write) sólo toca las hojas", () => {
  const { selectors } = selectorsOf(readFileSync(new URL("../public/pteron-hoja.css", import.meta.url), "utf8"));
  assert.ok(selectors.length > 50, "la hoja trae las reglas de Write");
  assert.deepEqual(selectors.filter((sel) => !/^(article)?\.pteron-document\b/.test(sel)), []);
});
