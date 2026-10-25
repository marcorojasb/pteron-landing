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
// Cada trozo tiene que estar en el marcado; cada ausente, no
function contiene(html, trozos, donde) {
  for (const trozo of trozos) assert.ok(html.includes(trozo), `falta en ${donde}: ${trozo}`);
}
function noContiene(html, trozos, donde) {
  for (const trozo of trozos) assert.ok(!html.includes(trozo), `${donde} ya no trae ${trozo}`);
}
// El texto de una escena, sin etiquetas: lo que se lee en la ventana
const leer = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

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

test("el aviso de datos de estudiantes detecta el RUT y el nombre, y su vista previa los anonimiza como la app", () => {
  const { privacy } = load();
  // El texto de partida de «En tu computador»
  const text = "Estudiante: Juan Pérez\nRUT: 12.345.678-5\nReconoce fracciones equivalentes con barras, pero aún no las simplifica.";
  assert.equal(privacy.containsSensitive(text), true);
  const hints = plain(privacy.sensitiveHints(text));
  assert.deepEqual(hints, ["RUT", "nombres identificables"]);
  assert.equal(
    privacy.privacyMessage(hints),
    "Detecté RUT y nombres identificables en tu pedido. Antes de que salga a un proveedor en la nube, elige cómo protegerlo.",
  );
  assert.match(privacy.privacyMessage([]), /^Detecté datos identificables de estudiantes en tu pedido\./);
  // «Anonimizar y continuar» cambia cada dato por su seudónimo; «Excluir fragmentos» quita las líneas que los llevan
  assert.equal(privacy.anonymizedPreview(text), "Estudiante: [Estudiante 1]\nRUT: [RUT 1]\nReconoce fracciones equivalentes con barras, pero aún no las simplifica.");
  assert.equal(privacy.excludeSensitive(text), "Reconoce fracciones equivalentes con barras, pero aún no las simplifica.");
  // La vista previa es la de Main: a lo más 480 caracteres
  assert.equal(privacy.anonymizedPreview(`RUT 12.345.678-5 ${"a".repeat(600)}`).length, 480);
  assert.equal(privacy.containsSensitive("Guía de fracciones para 6° básico"), false);
});

test("la tarjeta del aviso usa el marcado de PrivacyConsentCard con sus tres acciones", () => {
  const { privacyCard } = load();
  const card = privacyCard({ message: "Detecté RUT en tu pedido.", hints: ["RUT"], preview: "RUT: [RUT 1]" });
  contiene(
    card,
    [
      '<section class="privacy-consent" role="alertdialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body">',
      "Datos identificables de estudiantes</h2>",
      '<p class="privacy-consent-hints">Detectado: RUT</p>',
      // La vista previa se abre con el ratón, pero no entra en el orden de foco: la tarjeta está oculta al lector
      '<details class="privacy-consent-preview" open><summary tabindex="-1">Vista previa anonimizada</summary><pre>RUT: [RUT 1]</pre></details>',
      '<button type="button" class="btn btn-primary" tabindex="-1">Excluir fragmentos</button>',
      '<button type="button" class="btn btn-secondary" tabindex="-1">Anonimizar y continuar</button>',
      '<button type="button" class="quiet-action" tabindex="-1">Cancelar</button>',
    ],
    "la tarjeta",
  );
  // Sin vista previa ni datos detectados, la tarjeta no inventa esas partes
  const bare = privacyCard({ message: "m", hints: [], preview: " " });
  assert.ok(!bare.includes("privacy-consent-hints") && !bare.includes("privacy-consent-preview"));
  // El texto llega escapado
  assert.ok(privacyCard({ message: "<b>x</b>", hints: [], preview: "" }).includes("&lt;b&gt;x&lt;/b&gt;"));
});

test("la ventana en reposo es la Home de la app: la marca, el recuadro con la fila del pedido y lo último de la carpeta", () => {
  const ui = load();
  ui.window.setIcons("/iconos.svg");
  const home = ui.window.html({ final: false });
  assert.equal(home, ui.window.html({ escena: "home" }));
  contiene(
    home,
    [
      '<nav class="shell-index" aria-label="Índice">',
      '<button type="button" class="shell-index-fila is-principal" tabindex="-1" aria-current="page">',
      '<span class="shell-index-titulo">Cambios de estado del agua</span>',
      '<header class="shell-topbar"></header>',
      '<section class="home-surface"><h1 class="sr-only">Nuevo encargo</h1><div class="home-marca" aria-hidden="true"><svg class="pteron-marca"',
      '<div class="composer-dock is-home tone-reposo" data-pt-dock>',
      '<div class="filter-bar fila-pedido" role="group" aria-label="Datos del pedido">',
      '<button type="button" class="composer-send" tabindex="-1" disabled>',
      '<div class="home-bajo-recuadro"></div><section class="home-recientes" aria-labelledby="home-recientes-titulo">',
      '<use href="/iconos.svg#pt-arrow-up"/>',
    ],
    "la Home",
  );
  // La Home de hoy no trae rumbos ni la reflexión por voz, ni lo de antes de 0.8.0 (pestañas, «Retomar», el wordmark)
  noContiene(home, ["home-hero", "Reflexión por voz", "rumbo", "Retomar", "session-tab", "pt-wordmark", "workspace-menu-trigger"], "la Home");
});

test("el pedido se lee en una frase y, aceptado, cada dato queda en su ranura", () => {
  const ui = load();
  ui.window.setIcons("/i.svg");
  const leido = ui.window.html({ escena: "leido" });
  contiene(leido, ['<div class="composer-suggestions" role="group" aria-label="Lo que pteron leyó en tu pedido">', ">Agregar todo</button>", ">Tab</kbd>"], "la frase");
  assert.deepEqual(
    [...leido.matchAll(/data-suggestion="([a-zA-Z]+)"><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]),
    [
      ["artifactIntent", "Guía"],
      ["course", "5° básico"],
      ["topic", "fracciones equivalentes"],
      ["duration", "45 minutos"],
    ],
  );
  // Mientras la frase ofrece el curso, la invitación vacía del curso le cede su lugar; la de la asignatura queda
  const fila = leido.slice(leido.indexOf("fila-pedido"), leido.indexOf("composer-suggestions"));
  assert.ok(!fila.includes('<span class="sr-only">Curso</span>') && fila.includes('<span class="sr-only">Asignatura</span>'));
  const aceptado = ui.window.html({ escena: "aceptado" });
  assert.ok(!aceptado.includes("composer-suggestions"), "aceptada, la frase se va");
  const ranuras = aceptado.slice(aceptado.indexOf("fila-pedido"), aceptado.indexOf("composer-toolbar-end"));
  assert.deepEqual(
    [...ranuras.matchAll(/data-chip="([a-z]+)"><span class="composer-chip-label">([^<]+)|<span class="sr-only">(Curso|Asignatura)<\/span>/g)].map((m) => m[3] ?? `${m[1]}: ${m[2]}`),
    ["intent: Guía", "Curso", "Asignatura", "topic: fracciones equivalentes", "duration: 45 minutos"],
  );
  contiene(aceptado, ['<button type="button" class="composer-chips-clear" tabindex="-1">Limpiar</button>', '<button type="button" class="composer-send" tabindex="-1">'], "el pedido aceptado");
});

test("mientras pteron trabaja, la tarjeta de la corrida dice qué hace, con la ronda, el reloj y cada paso con su tiempo", () => {
  const ui = load();
  ui.window.setIcons("/i.svg");
  const plan = ui.window.html({ escena: "plan" });
  // La ronda: tres puntos que se mueven según el modo (consultar es trabajo)
  const ronda = /<svg aria-hidden="true" class="activity-mark " viewBox="-12 -10 24 20" width="24" height="20" data-modo="(\w+)">((?:<circle [^>]+><\/circle>){3})<\/svg>/.exec(plan);
  assert.ok(ronda, "la tarjeta lleva la ronda de ActivityMark");
  assert.equal(ronda[1], "trabaja");
  contiene(
    plan,
    [
      '<p class="run-card-phrase" role="status">Consultando el Currículum Nacional «fracciones equivalentes»</p><span class="run-card-brillo" aria-hidden="true">Consultando el Currículum Nacional «fracciones equivalentes»</span>',
      '<span class="run-card-clock" aria-hidden="true">0:02</span>',
      '<span class="run-card-step-label">Leyó tu petición</span></span><span class="run-card-step-time">1,9 s</span>',
      '<li class="run-card-step is-active">',
      '<use href="/i.svg#pt-landmark"/>',
      '<span class="run-card-step-object">fracciones equivalentes</span>',
      '<span>Detalles</span>',
    ],
    "el turno del plan",
  );
  // Al crear, la hoja ya escrita y el cierre en curso: piensa de nuevo
  const corriendo = ui.window.html({ escena: "corriendo" });
  assert.match(corriendo, /class="activity-mark " [^>]*data-modo="piensa"/);
  contiene(
    corriendo,
    [
      '<p class="run-card-phrase" role="status">Cerrando la respuesta</p>',
      '<span class="run-card-clock" aria-hidden="true">0:53</span>',
      '<span class="run-card-step-label">Pensó</span></span><span class="run-card-step-time">4,1 s</span>',
      '<span class="run-card-step-label">Escribió</span><span class="run-card-step-object">Guía de trabajo: fracciones equivalentes</span><span class="run-card-step-data">2 preguntas</span></span><span class="run-card-step-time">46 s</span>',
    ],
    "el turno de la guía",
  );
  // Mientras corre, el recuadro ofrece detener y no repite los datos que la burbuja ya declara
  const muelle = corriendo.slice(corriendo.indexOf("data-pt-dock"));
  contiene(muelle, ['class="composer-send is-stop"', '<use href="/i.svg#pt-square"/>'], "el recuadro en curso");
  assert.ok(!muelle.includes("composer-chip "), "durante la corrida los datos viven bajo la burbuja");
});

test("el plan pregunta la decisión en el recuadro, con la sugerida primero, y el índice dice que falta", () => {
  const ui = load();
  ui.window.setIcons("/i.svg");
  const decision = ui.window.html({ escena: "decision" });
  contiene(
    decision,
    [
      '<span class="status-pill" data-tone="pending">Por acordar</span>',
      '<p class="composer-dock-question">¿Cómo gradúo los ejercicios?</p>',
      '<span class="plan-choice-text">De lo concreto a lo simbólico</span><span class="plan-choice-recommended">Sugerida</span>',
      'placeholder="Responde con tus palabras…"',
      "Falta 1 decisión</span>",
    ],
    "la decisión",
  );
  assert.equal((decision.match(/class="plan-choice"/g) || []).length, 3);
  const listo = ui.window.html({ escena: "listo" });
  contiene(listo, ['<span class="status-pill" data-tone="ready">Listo</span>', "data-pt-crear>", "Crear la guía", 'placeholder="Ajusta el plan o pide un cambio…"'], "el plan listo");
  noContiene(listo, ["composer-dock-decision", "Falta 1 decisión"], "el plan listo");
});

test("al terminar, la guía queda en el encargo con su tarjeta y cada pie dice cuánto tardó", () => {
  const ui = load();
  ui.window.setIcons("/i.svg");
  const done = ui.window.html({ final: true });
  assert.equal(done, ui.window.html({ escena: "final" }));
  contiene(
    done,
    [
      '<h1 class="shell-titulo">Una guía de fracciones equivalentes para 5° básico,…</h1><span class="shell-contexto">5° básico</span>',
      '<section class="shell-index-grupo" aria-label="5° básico">',
      '<li class="shell-index-encargo" data-pt-encargo><button type="button" class="shell-index-abrir" tabindex="-1" aria-current="page">',
      '<article class="message user',
      '<article class="chat-file-card plan chat-plan-card is-hydrated" data-plan-review-state="ready">',
      '<p class="plan-decision-answer">De lo concreto a lo simbólico</p>',
      '<div class="md-body md-chat "><p>',
      '<article class="chat-file-card material-card is-hydrated">',
      "<span>Listo en 22 s · 1 búsqueda</span>",
      "<span>Listo en 55 s</span>",
      '<div class="composer-dock is-floating tone-decision" data-pt-dock>',
    ],
    "el encargo terminado",
  );
  assert.match(leer(done), /Guía de trabajo: fracciones equivalentes Guía · Listo · 25 oct 2026|Guía de trabajo: fracciones equivalentes Guía Listo 25 oct 2026/);
  // Creada la guía, el plan ya no ofrece crearla
  noContiene(done, ["pteron-marca", "run-card", 'is-principal" tabindex="-1" aria-current', "data-pt-crear"], "el encargo terminado");
});

test("los relojes de la ventana cuentan con la hora de la app, no con la de la secuencia", () => {
  // La secuencia dura segundos; un turno de pteron que escribe una guía, cerca de un minuto (INTERFAZ.md de pteron)
  const fuente = source;
  for (const reloj of ["RELOJ_DEL_PLAN", "RELOJ_DE_LA_GUIA"]) {
    const pares = Function(`"use strict"; const FIN_DEL_PLAN = 4500, ESCRITURA = [3000, 7200], FIN_DE_LA_GUIA = 8300; return ${new RegExp(`const ${reloj} = (\\[\\[[^;]+\\]\\]);`).exec(fuente)[1]};`)();
    // Cada par avanza en las dos horas y la de la app nunca va más lenta que la de la ventana
    for (let i = 1; i < pares.length; i += 1) {
      assert.ok(pares[i][0] > pares[i - 1][0] && pares[i][1] > pares[i - 1][1], `${reloj} avanza en el par ${i}`);
      assert.ok(pares[i][1] - pares[i - 1][1] >= pares[i][0] - pares[i - 1][0], `${reloj} no va más lento que la ventana en el par ${i}`);
    }
  }
});

test("cada icono que dibuja la ventana está en el sprite, con los de Lucide y los de la familia de pteron", () => {
  const ui = load();
  ui.window.setIcons("/sprite.svg");
  const sprite = readFileSync(new URL("../public/assets/pt-icons.svg", import.meta.url), "utf8");
  const escenas = ui.window.escenas.map((escena) => ui.window.html({ escena }));
  assert.ok(escenas.length >= 8, "la ventana arma cada momento de la secuencia");
  const usados = new Set([
    ...escenas.flatMap((html) => [...html.matchAll(/#pt-([a-z0-9-]+)"/g)].map((m) => m[1])),
    ...[...source.matchAll(/appIcon\("([a-z0-9-]+)"/g)].map((m) => m[1]),
  ]);
  assert.ok(usados.size > 20);
  for (const nombre of usados) assert.ok(sprite.includes(`<symbol id="pt-${nombre}" viewBox="0 0 24 24">`), `falta pt-${nombre} en pt-icons.svg`);
  // Los tipos de material y los formatos son de la familia propia (ui/familia.ts), con su data-icono
  for (const familia of ["documento", "plan", "texto"]) assert.ok(usados.has(familia), `la ventana usa el glifo ${familia} de la familia`);
  assert.match(escenas.join(""), /data-icono="documento" class="pteron-icon/);
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

// Los selectores de una lista, separados por las comas de primer nivel (no las de :is() ni :has(), aun anidados)
function partir(prelude) {
  const partes = [];
  let profundidad = 0;
  let desde = 0;
  for (let i = 0; i < prelude.length; i += 1) {
    if (prelude[i] === "(") profundidad += 1;
    else if (prelude[i] === ")") profundidad -= 1;
    else if (prelude[i] === "," && profundidad === 0) {
      partes.push(prelude.slice(desde, i).trim());
      desde = i + 1;
    }
  }
  partes.push(prelude.slice(desde).trim());
  return partes;
}

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
      else if (/^@(media|supports|starting-style|container)\b/.test(prelude)) walk(body);
      else if (!prelude.startsWith("@")) selectors.push(...partir(prelude));
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  return { selectors, keyframes };
}

test("los selectores se separan por las comas de primer nivel", () => {
  assert.deepEqual(partir(".a :is(.b, .c:has(.d, .e)), .f"), [".a :is(.b, .c:has(.d, .e))", ".f"]);
});

test("pteron-app.css no toca nada fuera de la ventana", () => {
  const css = readFileSync(new URL("../public/pteron-app.css", import.meta.url), "utf8");
  const { selectors, keyframes } = selectorsOf(css);
  assert.ok(selectors.length > 400, "la hoja trae las reglas de la app");
  assert.deepEqual(selectors.filter((sel) => !/^(\.pt-app|:where\(\.pt-app\)|\.pt-traffic)/.test(sel)), []);
  // Las reglas son las de la interfaz actual: la Home con su marca, la tarjeta de la corrida con la ronda y su brillo,
  // el plan y su decisión; ya no las pestañas de sesiones ni la hojita
  for (const regla of [
    ".pt-app .shell-index",
    ".pt-app .pteron-marca",
    ".pt-app .activity-mark",
    ".pt-app .run-card",
    ".pt-app .run-card-brillo",
    ".pt-app .run-summary",
    ".pt-app .chat-live-sheet-page",
    ".pt-app .plan-choice",
    ".pt-app .material-card",
  ]) {
    assert.ok(css.includes(regla), `pteron-app.css trae ${regla}`);
  }
  noContiene(css, ["session-tab", "activity-mark-papel"], "pteron-app.css");
  assert.ok(keyframes.length > 0 && keyframes.every((name) => name.startsWith("pa-")), "los keyframes de la app llevan el prefijo pa-");
  // El vocabulario de movimiento de la app (movimiento.css), con el brillo de la frase
  for (const nombre of ["pa-pteron-funde", "pa-pteron-aparece", "pa-pteron-brillo"]) assert.ok(keyframes.includes(nombre), `pteron-app.css trae ${nombre}`);
});

test("pteron-hoja.css (las reglas de Write) sólo toca las hojas", () => {
  const { selectors } = selectorsOf(readFileSync(new URL("../public/pteron-hoja.css", import.meta.url), "utf8"));
  assert.ok(selectors.length > 50, "la hoja trae las reglas de Write");
  assert.deepEqual(selectors.filter((sel) => !/^(article)?\.pteron-document\b/.test(sel)), []);
});
