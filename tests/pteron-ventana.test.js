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

const REQUEST = "Necesito una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos, con figuras.";

test("el pedido de «Cómo se pide» se reconoce como en la app: material, curso, asignatura, tema y duración", () => {
  const { recognize } = load();
  assert.deepEqual(
    plain(recognize(REQUEST).map((item) => [item.field, item.label])),
    [
      ["artifactIntent", "Guía"],
      ["course", "6° básico"],
      ["subject", "Matemática"],
      ["topic", "Tema: fracciones equivalentes"],
      ["duration", "45 minutos"],
    ],
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
    '<details class="privacy-consent-preview" open><summary>Vista previa anonimizada</summary><pre>RUT [RUT omitido]</pre></details>',
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
    '<header class="shell-topbar">',
    '<div class="session-tab active"><button type="button" class="session-tab-open" tabindex="-1"><svg class="lucide pteron-icon session-tab-spark"',
    '<section class="home-surface">',
    '<svg class="pt-wordmark"',
    '<div class="composer is-home is-at-rest has-chips" data-pt-composer>',
    '<div class="filter-bar" role="group" aria-label="Contexto docente">',
    '<button type="button" class="composer-send" tabindex="-1" disabled>',
    '<button type="button" class="home-quiet-card" tabindex="-1">',
    '<use href="/iconos.svg#pt-arrow-up"/>',
  ]) {
    assert.ok(home.includes(piece), `falta en la Home: ${piece}`);
  }
  const done = ui.window.html({ final: true });
  for (const piece of [
    '<span class="session-tab-label">Fracciones equivalentes · 6° básico</span>',
    '<article class="message user is-hydrated" data-message-role="user"',
    '<div class="md-body md-chat"><p>',
    '<article class="chat-file-card material-card" data-capture-state="chat-files">',
    '<span class="material-card-format">DOCX</span>',
    '<div class="composer-dock is-floating tone-reposo" data-pt-dock>',
  ]) {
    assert.ok(done.includes(piece), `falta en la conversación: ${piece}`);
  }
  assert.ok(!done.includes("pt-wordmark"), "la conversación no lleva el wordmark de la Home");
});

test("index.html trae la ventana generada por las plantillas actuales (node scripts/pteron-ventana.mjs)", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const icons = /data-pt-icons="([^"]+)"/.exec(html)?.[1];
  assert.ok(icons, "la escena de «Cómo se pide» declara data-pt-icons");
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
  assert.ok(keyframes.length > 0 && keyframes.every((name) => name.startsWith("pa-")), "los keyframes de la app llevan el prefijo pa-");
});

test("pteron-hoja.css (las reglas de Write) sólo toca las hojas", () => {
  const { selectors } = selectorsOf(readFileSync(new URL("../public/pteron-hoja.css", import.meta.url), "utf8"));
  assert.ok(selectors.length > 50, "la hoja trae las reglas de Write");
  assert.deepEqual(selectors.filter((sel) => !/^(article)?\.pteron-document\b/.test(sel)), []);
});
