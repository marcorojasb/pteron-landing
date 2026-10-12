/* pteron · la ventana de la app en la web (2026-10-12.12)
   1. Reconocimiento del pedido: copia fiel de pteron/src/shared/context-recognition.ts (ADR-161).
      Es local, sin modelo: el mismo diccionario del currículum chileno y las mismas reglas que la app.
   2. Aviso antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049). El inicio lo usa en
      «En tu computador» (inicio.js).
   3. La ventana de pteron de «Cómo se pide»: el marcado de los componentes de la app, que pteron-app.css dibuja con
      las reglas de la app, y la secuencia de un pedido. scripts/pteron-ventana.mjs usa las mismas plantillas para
      escribir en index.html la ventana en reposo. */
(() => {
  "use strict";

  /* ---------- 1. Reconocimiento (context-recognition.ts) ---------- */
  const RECOGNIZED_ORDER = ["artifactIntent", "course", "subject", "topic", "oa", "duration", "quantity"];
  const fold = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");

  function firstHit(folded, patterns) {
    let best = null;
    for (const [pattern, valueOf] of patterns) {
      const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      for (const match of folded.matchAll(global)) {
        const value = valueOf(match);
        if (!value) continue;
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (!best || start < best.start || (start === best.start && end > best.end)) best = { start, end, value };
      }
    }
    return best;
  }

  const ORDINAL = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, septimo: 7, setimo: 7, octavo: 8 };
  const ROMAN = ["I", "II", "III", "IV"];
  const SUFFIX = String.raw`(?:\s*(?:°|º|ero|ro|do|to|vo|no|mo|er|avo|o)\.?)?`;
  const YEAR = String.raw`(?:\s+ano)?(?:\s+de)?`;
  const courseOf = (level, grade) =>
    level === "basico" ? (grade >= 1 && grade <= 8 ? `${grade}° básico` : null) : grade >= 1 && grade <= 4 ? `${ROMAN[grade - 1]} medio` : null;

  const COURSE_PATTERNS = [
    [new RegExp(String.raw`\b([1-8])${SUFFIX}${YEAR}\s*(basico|medio)\b`, "u"), (m) => courseOf(m[2], Number(m[1]))],
    [new RegExp(String.raw`\b(iv|i{1,3})\s*°?${YEAR}\s+medio\b`, "u"), (m) => `${m[1].toUpperCase()} medio`],
    [new RegExp(String.raw`\b(${Object.keys(ORDINAL).join("|")})${YEAR}\s+(basico|medio)\b`, "u"), (m) => courseOf(m[2], ORDINAL[m[1]])],
  ];

  const SUBJECT_ALIASES = [
    ["Historia, Geografía y Cs. Sociales", ["historia", "geografia", "ciencias sociales", "formacion ciudadana"]],
    ["Ciencias Naturales", ["ciencias naturales", "ciencias para la ciudadania", "ciencias", "biologia", "quimica", "fisica"]],
    ["Lenguaje y Comunicación", ["lenguaje", "lengua y literatura", "comprension lectora"]],
    ["Matemática", ["matematicas", "matematica", "mate"]],
    ["Educación Física y Salud", ["educacion fisica", "ed\\.? fisica"]],
    ["Inglés", ["ingles", "english"]],
    ["Artes Visuales", ["artes visuales", "artes", "arte"]],
    ["Música", ["musica"]],
    ["Tecnología", ["tecnologia"]],
    ["Orientación", ["orientacion"]],
  ];
  const SUBJECT_PATTERNS = SUBJECT_ALIASES.map(([subject, aliases]) => [new RegExp(String.raw`\b(?:${aliases.join("|")})\b`, "u"), () => subject]);

  const INTENT_ALIASES = [
    ["rubric", ["rubricas?", "escala de apreciacion", "lista de cotejo"]],
    ["answer_key", ["pautas? de (?:correccion|respuestas)", "solucionario", "pauta"]],
    ["assessment", ["pruebas?", "evaluacion(?:es)?", "control(?:es)?", "examen(?:es)?", "quiz", "test"]],
    ["guide", ["guias?"]],
    ["planning", ["planificacion(?:es)?", "planes? de clases?", "unidad didactica", "planificar"]],
    ["activity", ["actividad(?:es)?", "tickets? de salida", "taller(?:es)?"]],
    ["presentation", ["presentacion(?:es)?", "ppt", "power ?point", "diapositivas", "laminas"]],
  ];
  const INTENT_NAME = { guide: "Guía", planning: "Planificación", assessment: "Evaluación", rubric: "Rúbrica", activity: "Actividad", answer_key: "Pauta", presentation: "Presentación", other: "Material" };
  const INTENT_PATTERNS = INTENT_ALIASES.map(([kind, aliases]) => [new RegExp(String.raw`\b(?:${aliases.join("|")})\b`, "u"), () => kind]);

  const NUMBER_WORDS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20, treinta: 30 };
  const AMOUNT = String.raw`(\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;
  const amountOf = (raw) => (/^\d+$/u.test(raw) ? Number(raw) : NUMBER_WORDS[raw] ?? 0);
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

  const DURATION_UNITS = [
    ["min(?:utos?)?|mins", "minuto", "minutos"],
    ["horas?|hrs?", "hora", "horas"],
    ["clases?", "clase", "clases"],
    ["sesiones|sesion", "sesión", "sesiones"],
    ["semanas?", "semana", "semanas"],
  ];
  const DURATION_PATTERN = new RegExp(String.raw`\b${AMOUNT}\s*(${DURATION_UNITS.map(([p]) => p).join("|")})\b`, "u");
  const QUANTITY_UNITS = [
    ["preguntas?", "pregunta", "preguntas"],
    ["items?", "ítem", "ítems"],
    ["ejercicios?", "ejercicio", "ejercicios"],
    ["problemas?", "problema", "problemas"],
    ["actividades", "actividad", "actividades"],
    ["diapositivas|laminas", "diapositiva", "diapositivas"],
  ];
  const QUANTITY_PATTERN = new RegExp(String.raw`\b${AMOUNT}\s+(${QUANTITY_UNITS.map(([p]) => p).join("|")})\b`, "u");

  function unitHit(folded, pattern, units, accept = () => true) {
    for (const match of folded.matchAll(new RegExp(pattern.source, "gu"))) {
      const count = amountOf(match[1]);
      const unit = units.find(([source]) => new RegExp(`^(?:${source})$`, "u").test(match[2]));
      if (!count || !unit || !accept(match[1], unit[1])) continue;
      const start = match.index ?? 0;
      return { start, end: start + match[0].length, value: plural(count, unit[1], unit[2]) };
    }
    return null;
  }

  const SESSION_THEN_TIME = new RegExp(String.raw`\b${AMOUNT}\s*(clases?|sesiones|sesion)\s+de\s+(\d{1,3})\s*(min(?:utos?)?|mins|horas?|hrs?)\b`, "u");

  function durationHit(folded) {
    const both = SESSION_THEN_TIME.exec(folded);
    if (both) {
      const sessions = amountOf(both[1]);
      const time = Number(both[3]);
      const unit = /^h/u.test(both[4]) ? ["hora", "horas"] : ["minuto", "minutos"];
      const session = /^s/u.test(both[2]) ? ["sesión", "sesiones"] : ["clase", "clases"];
      if (sessions && time) return { start: both.index, end: both.index + both[0].length, value: `${plural(sessions, session[0], session[1])} de ${plural(time, unit[0], unit[1])}` };
    }
    return unitHit(folded, DURATION_PATTERN, DURATION_UNITS, (raw, unit) => !((raw === "un" || raw === "una") && (unit === "clase" || unit === "sesión")));
  }

  const OA_PATTERN = /\boa\s*(?:n(?:°|º|ro|o)?\.?\s*)?(\d{1,2})\b/u;
  const TOPIC_STOP = /\s+(?:para|que|donde|segun|usando|incluyendo|considerando|enfocad[oa])\s+|[,.;:!?\n()]/u;
  const TOPIC_TAIL = /\s+(?:en|de|del|con|y|o|a|al|el|la|los|las|para|por)$/u;
  const TOPIC_LEAD = /^\s*(?:(?:(?:para|de|en)\s+)?(?:la\s+)?unidad(?:\s+de|\s+sobre)?|de|del|sobre|acerca de|acerca del|con el tema|tema|del tema|que trabaje|para trabajar)\s+/u;
  const ARTICLE = /^(?:el|la|los|las|un|una|unos|unas|lo)\s+/u;

  function topicHit(original, folded, intent) {
    const starts = [];
    if (intent) starts.push({ at: intent.end, needsLead: true });
    for (const match of folded.matchAll(/\b(?:sobre|acerca del?|el tema|tema|(?:ensenar|introducir|trabajar|reforzar|repasar|practicar)(?:\s+el concepto de)?)\s+/gu))
      starts.push({ at: (match.index ?? 0) + match[0].length, needsLead: false });
    for (const { at, needsLead } of starts.sort((a, b) => a.at - b.at)) {
      let cursor = at;
      let led = false;
      for (let guard = 0; guard < 8; guard += 1) {
        const rest = folded.slice(cursor);
        const kindTail = /^\s*de\s+(?:trabajo|ejercicios|aprendizaje|estudio|repaso|practica|actividades|seleccion multiple|desarrollo|lectura)\b\s*/u.exec(rest);
        const lead = TOPIC_LEAD.exec(rest);
        const filler =
          new RegExp(String.raw`^\s*${SESSION_THEN_TIME.source}\s*`, "u").exec(rest) ??
          new RegExp(String.raw`^\s*${QUANTITY_PATTERN.source}\s*`, "u").exec(rest) ??
          new RegExp(String.raw`^\s*${DURATION_PATTERN.source}\s*`, "u").exec(rest) ??
          /^\s*(?:breve|corta|corto|simple|sencilla|completa|formativa|sumativa|diagnostica)\b\s*/u.exec(rest);
        const connector = /^\s*(?:para|de|del|en)?\s*/u.exec(rest)[0].length;
        const subject = firstHit(rest, SUBJECT_PATTERNS);
        const course = firstHit(rest, COURSE_PATTERNS);
        const leading = [subject, course].find((hit) => hit && hit.start <= connector);
        if (kindTail) cursor += kindTail[0].length;
        else if (leading) cursor += leading.end;
        else if (lead && lead[0].length > 0) {
          cursor += lead[0].length;
          led = true;
        } else if (filler && filler[0].length > 0) cursor += filler[0].length;
        else break;
      }
      if (needsLead && !led) continue;
      const rest = folded.slice(cursor);
      const stop = TOPIC_STOP.exec(rest);
      let end = cursor + (stop ? stop.index : rest.length);
      const inner = folded.slice(cursor, end);
      const oaInner = OA_PATTERN.exec(inner);
      const next = [
        firstHit(inner, COURSE_PATTERNS),
        firstHit(inner, SUBJECT_PATTERNS),
        durationHit(inner),
        unitHit(inner, QUANTITY_PATTERN, QUANTITY_UNITS),
        oaInner ? { start: oaInner.index } : null,
      ]
        .filter((hit) => hit !== null && hit.start > 0)
        .reduce((min, hit) => Math.min(min, hit.start), inner.length);
      end = cursor + next;
      for (;;) {
        while (end > cursor && /\s/u.test(folded[end - 1])) end -= 1;
        const tail = TOPIC_TAIL.exec(folded.slice(cursor, end));
        if (!tail) break;
        end = cursor + tail.index;
      }
      let start = cursor;
      while (start < end && /\s/u.test(original[start])) start += 1;
      const article = ARTICLE.exec(folded.slice(start, end));
      if (article) start += article[0].length;
      while (end > start && /\s/u.test(original[end - 1])) end -= 1;
      const topic = original.slice(start, end);
      const words = topic.split(/\s+/u).filter(Boolean);
      if (words.length === 0 || words.length > 10 || topic.length < 3) continue;
      const foldedTopic = fold(topic);
      if (firstHit(foldedTopic, SUBJECT_PATTERNS)?.end === foldedTopic.length) continue;
      if (firstHit(foldedTopic, COURSE_PATTERNS) || firstHit(foldedTopic, INTENT_PATTERNS)) continue;
      if (/^(?:mi|mis|tu|tus|este|esta|estos|estas|clase|curso|alumnos?|estudiantes?)\b/u.test(foldedTopic)) continue;
      return topic;
    }
    return null;
  }

  function recognize(text) {
    const original = String(text || "").normalize("NFC");
    const folded = fold(original);
    if (folded.trim().length < 3) return [];
    const found = [];
    const intent = firstHit(folded, INTENT_PATTERNS);
    if (intent) found.push({ field: "artifactIntent", value: intent.value, label: INTENT_NAME[intent.value] });
    const course = firstHit(folded, COURSE_PATTERNS);
    if (course) found.push({ field: "course", value: course.value, label: course.value });
    const subject = firstHit(folded, SUBJECT_PATTERNS);
    if (subject) found.push({ field: "subject", value: subject.value, label: subject.value });
    const topic = topicHit(original, folded, intent);
    if (topic) found.push({ field: "topic", value: topic, label: `Tema: ${topic}` });
    const oa = OA_PATTERN.exec(folded);
    if (oa) found.push({ field: "oa", value: String(Number(oa[1])), label: `OA ${Number(oa[1])}` });
    const duration = durationHit(folded);
    if (duration) found.push({ field: "duration", value: duration.value, label: duration.value });
    const quantity = unitHit(folded, QUANTITY_PATTERN, QUANTITY_UNITS);
    if (quantity) found.push({ field: "quantity", value: quantity.value, label: quantity.value });
    return found.sort((a, b) => RECOGNIZED_ORDER.indexOf(a.field) - RECOGNIZED_ORDER.indexOf(b.field));
  }

  /* ---------- 2. Salvaguarda antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049) ----------
     Sólo dos hechos identificables: un RUT con formato chileno o un nombre con valor en un campo de persona. */
  const RUT_FORMAT = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/u;
  const RUT_FORMAT_GLOBAL = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/giu;
  const NAMED_PERSON = /^.{0,15}\b(?:nombre|estudiante|alumn[oa]|apoderad[oa])\s*:\s*[^\n,;]{0,20}\p{L}{2}/imu;
  const containsSensitive = (value) => RUT_FORMAT.test(value) || NAMED_PERSON.test(value);
  const redactSensitive = (value) =>
    !containsSensitive(value)
      ? value
      : value
          .replace(RUT_FORMAT_GLOBAL, "[RUT omitido]")
          .split("\n")
          .map((line) => (NAMED_PERSON.test(line) ? "[Línea con datos identificables omitida]" : line))
          .join("\n");
  function excludeSensitive(value) {
    if (!containsSensitive(value)) return value;
    const kept = value
      .split("\n")
      .filter((line) => !NAMED_PERSON.test(line) && !RUT_FORMAT.test(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return kept || "[Se excluyeron los fragmentos con datos identificables.]";
  }
  function sensitiveHints(value) {
    const hints = [];
    if (RUT_FORMAT.test(value)) hints.push("RUT");
    if (NAMED_PERSON.test(value)) hints.push("nombres identificables");
    return hints;
  }
  const privacyMessage = (hints) =>
    `Detecté ${hints.length ? hints.join(" y ") : "datos identificables de estudiantes"} en lo que vas a enviar. Antes de que salga a un proveedor en la nube, elige cómo protegerlo.`;

  window.pteronUI = { recognize, privacy: { containsSensitive, redactSensitive, excludeSensitive, sensitiveHints, privacyMessage } };
  if (typeof document === "undefined") return;

  /* ---------- Piezas comunes ---------- */
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- 3. La ventana de pteron ----------
     El marcado de los componentes de la app, con sus mismas clases: App.tsx, SessionTabs, WorkspaceMenu, HomePage,
     TypeTileRow, ComposerDock, Composer, FilterBar, ContextSelect, ChatView, LiveResponse, RunTimeline, ActivityMark,
     ArtifactCards y AppFooter. pteron-app.css los dibuja con las reglas de la app, así que lo que se ve es pteron.
     La secuencia sigue lo que la app hace con un pedido: el recuadro se amplía al escribir, lo reconocido se ofrece
     tras la pausa de 450 ms, lo aceptado llena la fila de contexto y la corrida se cuenta con la marca de actividad,
     los pasos terminados y las partes del material. El DOM se actualiza por partes, como Solid: nada se vuelve a
     montar, así cada animación de la app ocurre una vez. */
  let ICONS = "/assets/pt-icons.svg";
  const ICON_PX = { inline: 14, control: 16, prominent: 20 };
  const appIcon = (name, size = "control", cls = "", filled = false) => {
    const px = ICON_PX[size];
    return `<svg class="lucide pteron-icon${cls ? ` ${cls}` : ""}" width="${px}" height="${px}" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="${ICONS}#pt-${name}"/></svg>`;
  };

  // ActivityMark.tsx con la geometría de lib/activity-mark.ts (ADR-160)
  const AM = { C: 12, W: 24, H: 16, RX: 9.1, RY: 4.8, N: 8, BACK: 1, FRONT: 2.1, WAITING: 9, WORKING: 2.6, ORDER: [0, 4, 2, 6, 1, 5, 3, 7] };
  const RESTING = Array.from({ length: AM.N }, (_, i) => {
    const angle = 2 * Math.PI * (0.03 + i / AM.N) + Math.PI / 2;
    const depth = (1 + Math.sin(angle)) / 2;
    return { x: AM.C + AM.RX * Math.cos(angle), y: AM.C + AM.RY * Math.sin(angle), r: AM.BACK + (AM.FRONT - AM.BACK) * depth, depth };
  });
  const amArc = (sweep) => `M ${AM.C - AM.RX} ${AM.C} A ${AM.RX} ${AM.RY} 0 0 ${sweep} ${AM.C + AM.RX} ${AM.C}`;
  const litNodes = (signals) => new Set(AM.ORDER.slice(0, Math.max(1, Math.min(Math.floor(signals), AM.N))));
  function activityMark(signals, active = true) {
    const lit = litNodes(signals);
    const working = active && lit.size > 1;
    const nodes = RESTING.map((rest, index) => {
      const turn = index / AM.N;
      return (
        `<g class="activity-mark-x" style="transform: translateX(${(rest.x - AM.C).toFixed(2)}px); --activity-phase-x: ${turn + 0.25};">` +
        `<g class="activity-mark-y" style="transform: translateY(${(rest.y - AM.C).toFixed(2)}px); --activity-phase: ${turn};"><g class="activity-mark-wave">` +
        `<g class="activity-mark-node${lit.has(index) ? " is-lit" : ""}" style="transform: scale(${(rest.r / AM.FRONT).toFixed(3)}); opacity: ${(0.34 + 0.66 * rest.depth).toFixed(2)};">` +
        `<circle class="activity-mark-halo" cx="${AM.C}" cy="${AM.C}" r="${AM.FRONT * 1.85}"/><circle class="activity-mark-dot" cx="${AM.C}" cy="${AM.C}" r="${AM.FRONT}"/>` +
        `<circle class="activity-mark-glint" cx="${AM.C}" cy="${AM.C}" r="${AM.FRONT * 0.34}"/></g></g></g></g>`
      );
    }).join("");
    return (
      `<svg class="activity-mark${active ? " is-active" : ""}${working ? " is-working" : ""}" viewBox="0 ${AM.C - AM.H / 2 + 1} ${AM.W} ${AM.H}" width="${AM.W}" height="${AM.H}" aria-hidden="true" data-signals="${lit.size}" data-state="${working ? "working" : "waiting"}" style="--activity-period: ${AM.WAITING}s; --activity-back: ${AM.BACK / AM.FRONT};">` +
      `<path class="activity-mark-ring is-back" d="${amArc(1)}"/><path class="activity-mark-ring is-front" d="${amArc(0)}"/>${nodes}</svg>`
    );
  }
  /** Como la app: enciende nodos en su orden y, al pasar a trabajar, acelera el giro en 600 ms. */
  function setSignals(svg, signals) {
    if (!svg) return;
    const lit = litNodes(signals);
    const working = lit.size > 1;
    svg.querySelectorAll(".activity-mark-node").forEach((node, index) => node.classList.toggle("is-lit", lit.has(index)));
    svg.setAttribute("data-signals", String(lit.size));
    svg.setAttribute("data-state", working ? "working" : "waiting");
    if (working === svg.classList.contains("is-working")) return;
    svg.classList.toggle("is-working", working);
    if (typeof svg.getAnimations !== "function") return;
    const orbits = svg.getAnimations({ subtree: true }).filter((a) => a.animationName?.startsWith("pa-activity-orbit"));
    if (!orbits.length) return;
    const from = orbits[0].playbackRate;
    const to = working ? AM.WAITING / AM.WORKING : 1;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - t) ** 3;
      for (const a of orbits) a.updatePlaybackRate(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* Contenido: el pedido de la guía de Matemática que el inicio muestra en «La hoja»; sus partes son los bloques
     de esa guía (scripts/pteron-hojas/materiales.mjs) */
  const SESSIONS = ["Fracciones · 7° básico", "Homotecia · 1° medio", "Gráficos · 6° básico"];
  const TILES = [
    ["calendar-days", "Planificar", "organiza clases y unidades"],
    ["file-plus-2", "Crear", "produce material listo para usar"],
    ["clipboard-check", "Evaluar", "comprueba y analiza aprendizajes"],
    ["sliders-horizontal", "Adaptar", "ajusta material existente"],
  ];
  const DEMO = {
    request: "Necesito una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos, con figuras.",
    example: "Por ejemplo: presentación sobre el ciclo del agua para 3° básico",
    chatPlaceholder: "Pregunta, explora o crea con pteron…",
    session: "Fracciones equivalentes · 6° básico",
    clock: "09:42 p.\u00a0m.",
    title: "Guía de trabajo: fracciones equivalentes",
    answer: "Guía de trabajo de 45 minutos para 6° básico: una idea clave, barras para encontrar la fracción equivalente a 3/4 y una pregunta de selección múltiple. Suma 4 puntos; cada pregunta guarda su respuesta para la versión docente.",
    date: "12 oct 2026",
    tags: ["6° básico", "Matemática", "fracciones equivalentes"],
    // lib/run-timeline.ts y lib/live-response.ts: la frase viva y el paso terminado de cada herramienta
    run: [
      { phrase: "Leyendo tu petición" },
      { phrase: "Buscando en tu carpeta", done: "Buscó en tu carpeta" },
      { phrase: "Consultando el Currículum Nacional", done: "Consultó el Currículum Nacional" },
      { phrase: "Escribiendo el material" },
    ],
    pieces: [
      "Encabezado del material",
      "Idea clave: dos fracciones son equivalentes cuando representan la misma parte de un entero",
      "¿Cuántos doceavos equivalen a 3/4? Escribe la fracción de la última barra.",
      "Figura: fracciones equivalentes a tres cuartos",
      "¿Qué fracción es equivalente a 2/3?",
    ],
  };
  const INTENT_LABEL = { guide: "Guía", planning: "Planificación", assessment: "Evaluación", rubric: "Rúbrica", activity: "Actividad", answer_key: "Pauta", presentation: "Presentación" };
  const VISIBLE_PIECES = 8;

  /* El wordmark en «Iowan Old Style»: su contorno en unidades de em × 1000, con el origen en el centro de la tinta y
     la línea base (tomado de una captura de pteron en Mac). El degradado es el del h1 de la app, sobre la caja del h1:
     de y = −857,5 (borde superior, 0,8575 em sobre la línea base) a y = 262,5 (1,12 em más abajo). */
  const WORDMARK = "M-705.3-648.5-702.6-649.8-661.8-649.8-659.7-648.5-659.7-517.7-657.7-516.3-529-516.3-527.1-513.7-527.1-468.7-529-467.4-657.7-467.4-659.8-466.7-659.9-50-657.7-49-529-49-527.2-48-527.2-17.3-528.1-15.3-549.4-6.5-555.6-5.9-557.6-4.5-563.7-3.8-565.8-2.4-602.5 3.7-635.2 5.8-663.8 5.8-688.3 2.1-702.6-3.2-704.7-3.2-706.7-5.2-708.7-5.2-721.6-15.3-730.2-27.6-735.9-39.8-736.6-45.9-737.9-48-739.9-58.2-742.1-82.7-742.4-466.7-743.5-467.4-806.8-467.4-807.8-468.7-807.8-513.7-806.8-516.3-778.2-516.7-763.9-519.1-753.7-522.9-745.5-527.2-738.7-534.1-732.2-546.3-727-562.7ZM-1202.9-525.9-1194.9-527.2-1192.9-525.9-1192.9-440.1-1190.8-438-1187.7-440.1-1184.6-446.1-1182.5-448.3-1182.5-450.3-1168.3-470.7-1152-487.8-1137.6-499.4-1117.2-512.3-1113.2-514.3-1109.1-515-1102.9-518.4-1090.7-521.1-1088.6-522.5-1082.5-523.1-1080.5-524.5-1070.3-525.2-1066.2-526.6-1043.7-527.9-1013.1-526.9-990.6-523.8-968.1-517.7-953.8-511.5-951.8-511.5-945.7-507.4-943.6-507.4-941.6-505.4-929.4-499.4-917.2-491.2-900.8-476.9-881.7-456.5-861.3-425.8-846.9-395.2-846.3-391.1-840.9-376.8-836.1-354.4-834.7-352.3-828.6-313.5-827.9-297.2-826.6-291-825.9-260.4-826.6-225.7-828-217.5-828.6-203.2-833.4-170.5-839.6-144-845.8-127.6-845.6-125.6-847.7-121.5-847.8-119.5-853.9-107.2-853.9-105.2-868.1-78.8-880.4-62.3-882.4-58.4-902.8-37.2-923.2-20.8-931.6-15.3-951.8-4.5-955.9-3.8-962-0.4-964.1-0.4-974.3 3.7-1002.9 9.8-1025.3 11.8-1051.9 11.8-1080.5 8.2-1102.9 2.1-1127.3-9.2-1151.8-27.6-1166.3-42-1171-48-1179.9-60.2-1188.7-76.6-1190.8-77.3-1192.9-76.6-1192.7 152.2-1190.8 154.3-1100.9 154.4-1099 156.3-1099.2 199.2-1100.9 200.1-1348 200.1-1349 199.2-1349.1 189-1349 156.3-1348 154.3-1276.6 154.3-1275.3 152.2-1275.1-446.3-1275.2-450.3-1276.6-451.4-1348-463.6-1349.1-464.6-1348.7-497.3-1339.9-500-1331.7-500.7-1329.7-502.1-1321.5-502.7-1319.4-504.1-1311.3-504.8-1286.8-510.2-1278.6-510.9-1276.6-512.3-1268.4-512.9-1266.3-514.3-1258.2-515-1233.7-520.5-1225.5-521.1-1223.4-522.5-1215.3-523.2-1213.2-524.5ZM-327.8-525.9-302.3-527.9-271.7-526.9-251.2-523.8-236.9-520.5-220.6-515.6-212.4-511.5-208.3-510.6-185.9-499.4-165.5-485.1-153.9-474.9-140.3-460.6-126-442.2-119.2-429.9-115.8-425.8-105.6-405.4-104.9-401.3-101.5-395.2-100.8-391.1-93.3-370.7-85.2-333.9-84.5-321.7-83.1-315.5-81.8-284.9-81.9-262.4-83.7-261.1-433-261.2-437.3-260.4-437.3-235.9-436.5-233.8-435.8-205.2-434.4-201.2-433.7-188.9-432.4-186.9-431.7-178.7-428.3-168.5-427.6-162.4-424.2-154.2-423.5-150.1-420.2-144-419.5-139.9-413.3-127.6-402.5-111.3-396.5-103.1-386.8-92.9-367.6-76.5-343.1-63.2-328.8-58.1-310.5-53.9-288-52-269.6-51.9-267.6-52.7-249.2-53.3-245.1-54.7-236.9-55.4-234.9-56.8-226.7-57.5-218.5-60.9-208.3-63.6-194-70.3-179.7-79.2-165.4-90.7-149-107.2-136.7-123.5-126.5-141.9-124.6-143.2-114.5-137.8-100.1-127.4-92.6-123.5-94.1-117.4-106.2-93.1-108.4-90.9-112.5-82.7-118.6-74.5-120.5-70.6-138.3-50-151.4-37.8-161.5-29.6-177.7-18.8-206.3-4.5-210.4-3.8-216.5-0.5-228.8 3.6-257.4 9.8-279.8 11.8-302.3 11.8-328.8 9.8-347.2 7-367.6 1.7-379.9-3.2-381.9-3.2-390.1-7.3-392.2-7.3-404.4-13.4-406.5-15.5-408.5-15.5-410.5-17.5-412.6-17.5-420.8-23.7-430.8-29.6-450.6-45.9-464.3-60.2-477.2-76.6-492.9-101.1-505.1-127.6-507.8-137.8-511.2-144-514-156.2-515.4-158.3-516-164.4-517.4-166.4-519.4-174.6-522.1-193-523.5-195-526.8-227.7-528-256.3-526.8-286.9-523.9-313.5-518.6-340.1-511.2-364.6-504.4-380.9-504.4-382.9-500.3-391.1-500.3-393.2-498.3-395.2-496.2-401.3-494.2-403.4-494.2-405.4-492.1-407.5-492.1-409.5-490.1-411.5-490.1-413.6-484-421.8-479.9-429.9-459.6-456.4-443.1-472.8-428.8-485.1-406.5-500-386-510.2-369.7-516.4-359.5-519.1-357.4-520.5-351.3-521.1-349.3-522.5-339.1-524.5ZM81.8-525.9 89.9-527.2 91.8-525.9 91.8-440.1 94-438 96-438 98.1-440.1 112.3-466.6 124.6-483 141-499.4 157.3-510.6 177.7-520.5 181.8-521.1 190-524.5 200.2-526.6 218.5-527.9 243.1-526.9 263.5-522.9 281.9-515.6 294-507.5 306.4-495.2 314.5-480.9 319.6-464.6 321.3-444.2 317.6-419.7 312.5-407.6 306.4-399.4 296.2-390.5 283.9-384.4 267.6-381.9 253.3-383.1 239-387.2 230.9-391.1 223.4-397.2 217.9-403.4 211.8-413.6 209.1-423.8 208.4-442.2 209.7-450.3 216.5-466.6 224.7-475.5 230.8-479.6 234.9-480.3 235.6-481 235-483 220.6-485.2 198.1-484 179.7-479.7 163.4-471.5 147.1-460.7 134.8-450.5 116.3-429.9 112.2-421.8 104.1-409.5 99-397.2 95-380.9 93.8-368.6 93.8-48 96-45.8 185.9-45.8 187.7-43.9 187.7-1 185.9 0-61.3-0.5-61.9-11.2-61.3-44.7-59.2-45.8 10.2-45.8 12.4-48 12.4-434 12.3-448.3 10.2-451.4-61.3-464-61.9-464.6-61.9-495.3-61.2-497.3-53.1-500-44.9-500.7-42.9-502.1-34.7-502.7-32.7-504.1-24.5-504.8-22.5-506.2-14.3-506.8 20.4-514.3 28.6-515 30.6-516.4 38.8-517 40.8-518.4 49-519.1 51.1-520.5 59.2-521.1 61.3-522.5 69.4-523.1ZM506.7-525.9 512.7-526.9 543.3-527.9 563.7-526.9 592.3-522.5 614.8-516.7 627-511.5 629.1-511.5 637.3-507.5 639.3-507.5 645.4-503.4 647.5-503.4 653.6-499.3 655.6-499.3 669.9-489.1 676.1-485.7 686.3-476.8 692.3-472.8 710.8-453.7 721.7-440.1 740-411.5 748.2-395.2 748.9-391.1 752.3-385 752.9-380.9 756.4-374.8 757-370.7 760.4-362.5 761.1-356.4 764.5-348.2 765.2-342.1 766.6-340.1 767.2-331.9 768.6-329.8 769.3-321.7 770.7-319.6 771.3-307.4 772.7-303.3 774-289 775.1-264.5 774-225.7 771-199.1 765.8-172.6 758.8-148.1 748.6-121.5 743.5-111.4 741.3-109.3 741.3-107.2 737.3-101.1 737.3-99 712.8-64.4 694.4-45.4 677.9-31.6 663.8-22.2 655.6-16.7 639.3-8.6 629.1-4.5 625-3.8 612.7 1.7 606.6 2.4 604.6 3.6 598.4 4.4 596.4 5.8 590.3 6.5 588.2 7.7 578 8.5 573.9 9.8 551.5 11 549.4 11.8 516.7 11.1 492.2 8.2 465.7 2.1 447.3-5.2 445.3-5.2 418.7-18.4 402.4-28.6 388.2-39.8 365.6-62.4 354.1-76.6 340.4-97 326.1-125.6 322.1-135.8 321.4-139.9 318-146 317.3-150.1 316-152.1 315.3-158.3 311.8-166.4 311.2-172.6 309.8-174.6 309.1-182.8 307.8-184.8 307.1-193 305.7-195 305.1-205.2 303.6-211.4 301.7-233.8 301.6-280.8 302.5-282.9 304.5-309.4 309.4-338 316.7-364.6 320.8-374.8 320.8-376.8 324.9-385 324.8-387 341.1-419.6 343.3-421.8 347.3-429.9 365.6-454.3 384.1-472.8 398.3-484.4 418.7-498 443.2-510.2 453.4-512.9 459.6-516.3 484.1-522.5ZM938.6-525.9 945.7-527.3 947.7-527.2 949-525.9 949-440.1 949.8-438 951.8-438 953.9-440.1 960-452.3 974.3-472.1 986.6-485.1 1000.8-496.6 1019.2-508.2 1027.4-512.3 1031.5-512.9 1037.6-516.3 1041.7-517 1047.8-520.5 1053.9-521.1 1056-522.5 1064.1-524.5 1076.4-526.6 1096.8-527.9 1127.5-526.9 1145.8-524.9 1172.4-518.8 1180.6-515.6 1182.6-515.7 1194.9-509.5 1196.9-509.5 1198.9-507.5 1207-503.5 1223.4-491.2 1233.7-480.9 1252.7-452.4 1255.4-444.2 1258.8-438.1 1259.5-434 1265-419.7 1267.6-405.4 1269.1-403.4 1269.7-395.2 1273.1-378.9 1275.2-346.2 1275.1-48 1276.6-45.8 1348-45.8 1349-43.9 1349.1-11.2 1349-1 1348-0 1121.3 0 1119.5-1 1119.4-43.9 1121.3-45.8 1190.8-45.8 1193.5-48 1193-344.1 1192.2-346.2 1191.5-362.5 1190.1-366.6 1189.4-374.8 1181.3-403.4 1177.2-413.6 1162.2-436 1152-446.4 1133.6-458.6 1131.5-458.6 1123.4-462.7 1111.1-466.8 1084.6-470.9 1066.2-470.9 1047.8-469.4 1045.8-468.1 1037.6-467.4 1035.5-466 1029.4-465.4 1009-457.5 990.6-447 972.1-429.9 966-421.8 961.9-413.6 959.9-411.5 959.9-409.5 955.7-401.3 951.7-382.9 951.1-372.7 951.1-48 951.8-45.8 1023.3-45.8 1025.2-43.9 1025.1-1 1023.3 0 843.5 0 798.6 0 795.3-1 795.3-43.9 796.6-45.8 868.1-45.8 869.1-48 869.1-291 869.1-450.3 868.1-451.4 796.6-463.6 795.3-464.6 795.2-497.3 796.6-498.3 835.4-506.2 843.5-506.8 845.6-508.2 853.8-508.9 855.8-510.2 864-510.9 866-512.3 874.2-512.9 876.2-514.3 884.4-515ZM-302.4-481-292.1-481.1-265.5-477.9-251.2-473.8-241-468.8-239-468.8-236.8-466.7-228.8-462.7-216.5-453.1-206.9-444.2-198.8-434-191-421.8-181-401.3-178.3-391.1-176.9-389.1-174.3-374.8-172.9-372.7-168.8-344.1-168.4-307.4-171.6-306.6-433-306.6-436.2-307.4-437.2-309.4-437.3-315.5-435.8-344.1-433.1-362.5-429.1-380.9-427-385-425-393.2-416.8-411.5-402.5-434-391.2-446.3-381.9-454.5-365.6-465.4-357.4-469.5-341.1-475.6-335-476.2-332.9-477.6-324.8-478.3-320.7-479.7ZM532.9-478.9 545.3-479 567.8-477 592.3-470.9 610.7-462.7 612.7-460.7 614.8-460.7 627-452.5 642.1-438.1 647.5-432 658.4-415.6 668.6-395.2 669.3-391.1 672.7-382.9 678.9-356.4 680.9-342.1 682.4-315.5 682.3-197.1 681.5-195 681.2-178.7 680.3-168.5 676.2-146 674.1-137.8 667.9-121.5 668-119.5 657.9-99 655.7-97 649.7-86.8 639.3-74.4 620.9-59.5 614.8-55.4 598.4-47.2 586.2-43.2 580.1-42.5 578-41.1 567.8-39.1 549.4-37 527-37 502.5-39.7 482-45.8 463.6-53.9 455.4-60.2 451.4-62.2 436.9-74.5 428.2-84.7 420-97 411.8-111.3 411.2-115.4 407.1-123.5 407.1-125.6 401.6-139.9 401-146 399.6-148.1 397.6-158.3 396.8-168.5 395.5-172.6 394.1-195 394.1-321.7 395.5-342.1 398.2-360.5 402.3-378.9 404.3-382.9 406.4-391.1 410.5-399.3 410.4-401.3 416.5-413.6 418.6-415.6 418.6-417.7 428.8-432 443.2-447 459.6-459.2 473.9-467.4 477.9-468.1 492.2-473.5 512.7-477.6ZM-1066.4-470.8-1049.8-470.9-1031.5-468.8-1006.9-462.7-998.8-458.6-996.7-458.6-990.6-454.5-988.6-454.5-980.3-448.3-976.3-446.4-959.8-432-944.9-413.6-936.5-399.3-928.6-382.9-927.9-378.9-922.5-364.6-921.8-358.4-920.4-356.4-919.7-348.2-918.4-346.2-916.3-331.9-915.7-313.5-914.9-311.5-914.9-203.2-916.3-184.8-919-170.5-919-166.4-923-150.1-931.2-127.6-941.5-107.2-945.6-101.1-949.8-96.9-951.7-92.9-964.1-79.9-974.3-71-988.6-61.6-1000.8-55.4-1011-52.7-1013.1-51.3-1027.4-48.6-1029.4-47.2-1045.8-45.2-1062.1-44.9-1076.4-45.8-1086.6-46.9-1107-51.3-1121.3-56.1-1129.5-60.2-1131.5-60.2-1133.6-62.2-1135.6-62.1-1137.7-64.3-1152-72.4-1160.1-78.4-1168.5-86.8-1180.8-103.1-1185.4-111.3-1189.4-121.5-1192.9-144-1193-372.7-1191.8-382.9-1186.8-401.3-1180.7-413.6-1168.3-429.3-1154-442.3-1139.7-451.1-1127.5-457.2-1105-465.4-1088.6-468.1-1086.6-469.5Z";
  const wordmarkSVG = () =>
    `<svg class="pt-wordmark" viewBox="-1353 -654 2706 858" aria-hidden="true" focusable="false"><defs><linearGradient id="pt-wordmark-fill" gradientUnits="userSpaceOnUse" x1="0" y1="-857.5" x2="0" y2="262.5">` +
    `<stop offset="0" style="stop-color: color-mix(in srgb, var(--pteron-sky) 64%, white)"/><stop offset=".44" style="stop-color: color-mix(in srgb, var(--pteron-sky) 30%, white)"/>` +
    `<stop offset="1" style="stop-color: color-mix(in srgb, var(--pteron-sand) 44%, white)"/></linearGradient></defs><path fill="url(#pt-wordmark-fill)" fill-rule="evenodd" d="${WORDMARK}"/></svg>`;

  // SessionTabs.tsx: las sesiones, el borrador «Nueva sesión» y los botones de agregar e historial
  function tabsHTML(active) {
    const tab = (label, isActive, fresh) =>
      `<div class="session-tab${isActive ? " active" : ""}"><button type="button" class="session-tab-open" tabindex="-1">` +
      `${fresh ? appIcon("message-square-dashed", "inline", "session-tab-spark") : ""}<span class="session-tab-label">${esc(label)}</span></button>` +
      `<button type="button" class="session-tab-close" tabindex="-1">${appIcon("x", "inline")}</button></div>`;
    const strip = SESSIONS.map((s) => tab(s, false, false)).join("") + (active ? tab(active, true, false) : tab("Nueva sesión", true, true));
    return (
      `<nav class="session-tabs" aria-label="Sesiones de trabajo"><div class="session-tab-strip">${strip}</div>` +
      `<button type="button" class="session-tab-add" tabindex="-1">${appIcon("plus")}</button>` +
      `<div class="session-history"><button type="button" class="session-history-toggle" tabindex="-1">${appIcon("history")}</button></div></nav>`
    );
  }

  // FilterBar + ContextSelect: Curso y Asignatura, punteados hasta tener valor
  function filterBarHTML(course, subject) {
    const select = (iconName, label, value, index) =>
      `<div class="filter-field" style="--filter-entry-index: ${index};"><div class="context-select${value ? " has-value" : ""}">` +
      `<button type="button" class="context-select-trigger" tabindex="-1">${appIcon(iconName)}<span class="context-select-value">${value ? esc(value) : `<span aria-hidden="true">${label}</span>`}</span>` +
      `${appIcon("chevron-down", "inline", "context-select-chevron")}</button>` +
      `${value ? `<button type="button" class="context-select-clear" tabindex="-1">${appIcon("x", "inline")}</button>` : ""}</div></div>`;
    return `<div class="filter-bar" role="group" aria-label="Contexto docente">${select("graduation-cap", "Curso", course, 0)}${select("book-open", "Asignatura", subject, 1)}</div>`;
  }
  // Composer.tsx: fichas del contexto aceptado y «Limpiar» cuando hay más de una
  const chipsHTML = (chips) =>
    chips
      .map((c) => `<span class="composer-chip teaching-context-chip" data-chip="${c.id}"><span class="composer-chip-label">${esc(c.label)}</span><button type="button" class="composer-chip-remove" tabindex="-1">${appIcon("x", "inline")}</button></span>`)
      .join("") + (chips.length > 1 ? `<button type="button" class="composer-chips-clear" tabindex="-1">Limpiar</button>` : "");
  // Composer.tsx: lo reconocido en el pedido, con «¿Agregar?» y «Agregar todo»
  const suggestionsHTML = (items) =>
    `<div class="composer-suggestions" role="group" aria-label="Reconocido en tu pedido"><span class="composer-suggestions-label" aria-hidden="true">${appIcon("lightbulb", "inline")}¿Agregar?</span>` +
    items.map((i) => `<button type="button" class="composer-suggestion" tabindex="-1" data-suggestion="${i.field}">${appIcon("plus", "inline")}<span>${esc(i.label)}</span></button>`).join("") +
    (items.length > 1 ? `<button type="button" class="composer-suggestions-all" tabindex="-1">Agregar todo</button>` : "") +
    `</div>`;

  function composerHTML({ home, atRest = false, chipsRow = "", placeholder, text = "", busy = false }) {
    const send = busy
      ? `<button type="button" class="composer-send is-stop" tabindex="-1">${appIcon("square", "inline", "", true)}</button>`
      : `<button type="button" class="composer-send" tabindex="-1"${text ? "" : " disabled"}>${appIcon("arrow-up")}</button>`;
    return (
      `<div class="composer${home ? " is-home" : ""}${atRest ? " is-at-rest" : ""}${chipsRow ? " has-chips" : ""}" data-pt-composer>` +
      (chipsRow ? `<div class="composer-chips-reveal"><div class="composer-chips" role="group" aria-label="Contexto de este mensaje">${chipsRow}</div></div>` : "") +
      `<div class="composer-field"><textarea rows="1" tabindex="-1" placeholder="${esc(placeholder)}" aria-label="Petición o consulta para pteron" readonly${busy ? " disabled" : ""}>${esc(text)}</textarea></div>` +
      `<div class="composer-toolbar"><div class="composer-toolbar-start"><button type="button" class="composer-tool composer-attach" tabindex="-1"${busy ? " disabled" : ""}>${appIcon("paperclip")}</button></div>` +
      `<div class="composer-toolbar-end"><button type="button" class="composer-tool composer-voice" tabindex="-1"${busy ? " disabled" : ""}>${appIcon("mic")}</button>${send}</div></div></div>`
    );
  }
  // ComposerDock.tsx: el contexto vacío se oculta con :empty
  const dockHTML = (floating, inner, tone = "reposo") => `<div class="composer-dock ${floating ? "is-floating" : "is-home"} tone-${tone}" data-pt-dock><div class="composer-dock-context"></div>${inner}</div>`;

  // HomePage.tsx en reposo: el wordmark, los cuatro rumbos, el recuadro de un renglón y «Retomar»
  function homeHTML() {
    const tiles = TILES.map(([i, l, h]) => `<button type="button" class="type-tile" tabindex="-1" aria-pressed="false"><span class="icon">${appIcon(i, "prominent")}</span><span class="type-tile-label">${l}</span><span class="type-tile-hint">${h}</span></button>`).join("");
    const card = (i, title, detail) => `<button type="button" class="home-quiet-card" tabindex="-1"><span class="home-quiet-icon">${appIcon(i, "inline")}</span><span class="home-quiet-copy"><strong>${title}</strong><span>${detail}</span></span></button>`;
    return (
      `<section class="home-surface"><header class="home-hero"><h1 aria-label="pteron">pteron${wordmarkSVG()}</h1></header>` +
      `<div class="home-rumbos"><div class="type-tiles" role="group" aria-label="Formas de empezar">${tiles}</div></div>` +
      `<div class="home-composer">${dockHTML(false, composerHTML({ home: true, atRest: true, chipsRow: filterBarHTML(), placeholder: DEMO.example }))}</div>` +
      `<div class="home-quiet-row">${card("history", "Retomar", "Fracciones · 7° básico · hace 27 min")}${card("mic", "Reflexión por voz", "Piensa en voz alta una clase o un desafío")}</div>` +
      `<div class="home-reserve" aria-hidden="true"><div></div></div></section>`
    );
  }

  // ArtifactCards.tsx: el material creado, con su formato, estado, fichas y acciones
  const materialCardHTML = () =>
    `<article class="chat-file-card material-card" data-capture-state="chat-files"><span class="material-card-tile" aria-hidden="true">${appIcon("file-pen", "prominent")}<span class="material-card-format">DOCX</span></span>` +
    `<div class="material-card-body"><h3 class="material-card-title">${esc(DEMO.title)}</h3><p class="material-card-meta"><span>Guía</span><span class="material-card-status" data-status="ready">Listo</span><span>${DEMO.date}</span></p>` +
    `<div class="material-card-tags">${DEMO.tags.map((t) => `<span class="material-card-tag">${esc(t)}</span>`).join("")}</div></div>` +
    `<div class="chat-file-actions material-card-actions"><button type="button" class="quiet-action" tabindex="-1">${appIcon("layers", "inline")}Versiones</button><button type="button" class="btn btn-primary btn-compact" tabindex="-1">Abrir en editor</button></div></article>`;
  // RunTimeline.tsx: un paso terminado, con su visto
  const doneStepHTML = (label) => `<li class="run-step"><span class="run-step-marker" aria-hidden="true">${appIcon("check", "inline")}</span><span class="run-step-text"><span class="run-step-label">${esc(label)}</span></span></li>`;
  // LiveResponse.tsx: frase viva, marca de actividad, tiempo y «Detalles» desde el inicio
  const liveHTML = (phrase, signals) =>
    `<div class="chat-live" data-live-writing="true"><div class="chat-live-status">${activityMark(signals)}<p class="chat-live-phrase" role="status">${esc(phrase)}</p>` +
    `<span class="chat-live-elapsed" aria-hidden="true"></span><button type="button" class="run-details-toggle is-pending" tabindex="-1" disabled>Detalles</button></div></div>`;
  const finalBodyHTML = () => `<div class="md-body md-chat"><p>${esc(DEMO.answer)}</p></div>`;

  // ChatView.tsx dentro de WorkspacePage: el hilo y el recuadro flotante
  function workspaceHTML({ final = false } = {}) {
    const assistant = final
      ? `<article class="message assistant is-hydrated is-latest" data-message-role="assistant" style="--chat-entry-index: 1;"><p class="message-kicker" aria-hidden="true">pteron</p><div class="message-body">${finalBodyHTML()}</div><div class="chat-message-files">${materialCardHTML()}</div></article>`
      : `<article class="message assistant is-latest" data-message-role="assistant" style="--chat-entry-index: 1;"><p class="message-kicker" aria-hidden="true">pteron</p><div class="message-body">${liveHTML(DEMO.run[0].phrase, 1)}</div></article>`;
    return (
      `<div class="workspace-surface" data-capture-state="${final ? "chat-files" : "running"}"><div class="workspace-main"><div class="chat-pane"><div class="chat-history" data-pt-history><div class="chat-column">` +
      `<article class="message user${final ? " is-hydrated" : ""}" data-message-role="user" style="--chat-entry-index: 0;"><div class="message-bubble">${esc(DEMO.request)}</div><time class="message-time" aria-hidden="true">${DEMO.clock}</time></article>` +
      `${assistant}</div></div></div>` +
      dockHTML(true, composerHTML({ home: false, placeholder: DEMO.chatPlaceholder, busy: !final }), final ? "reposo" : "trabajando") +
      `</div></div>`
    );
  }

  // App.tsx: barra superior (con el espacio de los semáforos de macOS), contenido y ayuda en la esquina
  function windowHTML({ final = true } = {}) {
    return (
      `<div class="app-shell"><header class="shell-topbar"><span class="topbar-balance" aria-hidden="true"></span>${tabsHTML(final ? DEMO.session : null)}` +
      `<div class="topbar-end"><button type="button" class="workspace-menu-trigger" tabindex="-1">Chats${appIcon("chevron-down")}</button></div></header>` +
      `<div class="shell-main" data-pt-main>${final ? workspaceHTML({ final: true }) : homeHTML()}</div></div>` +
      `<footer class="shell-corner-controls"><span class="footer-right"><button type="button" class="footer-circle-btn" tabindex="-1">${appIcon("circle-help", "inline")}</button></span></footer>` +
      `<span class="pt-traffic" aria-hidden="true"><i></i><i></i><i></i></span>`
    );
  }
  /* PrivacyConsentCard.tsx: el aviso que pteron muestra antes de que un texto con datos de estudiantes salga a la nube */
  const privacyCardHTML = ({ message, hints, preview, open = true }) =>
    `<section class="privacy-consent" role="alertdialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body">` +
    `<h2 id="privacy-consent-title">${appIcon("lock-keyhole")}Datos identificables de estudiantes</h2>` +
    `<p id="privacy-consent-body">${esc(message)}</p>` +
    (hints.length ? `<p class="privacy-consent-hints">Detectado: ${esc(hints.join(" · "))}</p>` : "") +
    (preview.trim()
      ? `<details class="privacy-consent-preview"${open ? " open" : ""}><summary tabindex="-1">Vista previa anonimizada</summary><pre>${esc(preview)}</pre></details>`
      : "") +
    `<div class="privacy-consent-actions"><button type="button" class="btn btn-primary" tabindex="-1">Excluir fragmentos</button>` +
    `<button type="button" class="btn btn-secondary" tabindex="-1">Anonimizar y continuar</button>` +
    `<button type="button" class="quiet-action" tabindex="-1">Cancelar</button></div></section>`;

  window.pteronUI.window = { html: windowHTML, setIcons: (href) => (ICONS = href) };
  window.pteronUI.privacyCard = privacyCardHTML;

  /* La escena: la ventana de 1440 × 880 se escala al ancho de su marco (en móvil, el marco recorta el centro) */
  const stage = document.querySelector("[data-pt-demo]");
  if (!stage) return;
  ICONS = stage.getAttribute("data-pt-icons") || ICONS;
  const frame = stage.querySelector("[data-pt-frame]");
  const app = frame?.querySelector(".pt-app");
  if (!app) return;
  const fit = () => {
    const crop = parseFloat(getComputedStyle(frame).getPropertyValue("--pt-crop")) || 1440;
    frame.style.setProperty("--pt-s", String(frame.clientWidth / crop));
  };
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(frame);

  const $ = (sel) => app.querySelector(sel);
  const controls = (sel) => [...document.querySelectorAll(sel)].filter((el) => el.getAttribute("aria-controls") === stage.id);
  const steps = controls("[data-pt-step]");
  const replay = controls("[data-pt-replay]")[0];

  let run = 0;
  let status = "idle"; // idle · playing · done
  let pristine = true; // la Home que trae la página aún no se ha tocado: su entrada ya ocurrió al cargar
  const timers = new Set();
  const STOP = Symbol("stop");
  const sleep = (ms, id) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        timers.delete(t);
        id === run ? resolve() : reject(STOP);
      }, ms);
      timers.add(t);
    });
  const cancel = () => {
    run += 1;
    timers.forEach(clearTimeout);
    timers.clear();
  };
  const setStep = (n) => {
    stage.dataset.step = String(n);
    steps.forEach((s, i) => {
      s.classList.toggle("is-current", i === n);
      s.classList.toggle("is-done", i < n);
      if (i === n) s.setAttribute("aria-current", "step");
      else s.removeAttribute("aria-current");
    });
  };
  // Un clic visible: la app usa :active (brillo 0,85 y escala 0,94), que un script no puede activar
  const press = async (el, id) => {
    if (!el) return;
    el.style.transition = "transform 90ms, filter 90ms";
    el.style.transform = "scale(0.94)";
    el.style.filter = "brightness(0.85)";
    await sleep(150, id);
    el.style.transform = "";
    el.style.filter = "";
  };
  const show = (final) => {
    app.innerHTML = windowHTML({ final });
  };
  const history = () => $("[data-pt-history]");
  const stick = () => {
    const h = history();
    if (h) h.scrollTop = h.scrollHeight;
  };

  async function typeRequest(id) {
    const field = $("textarea");
    const chars = [...DEMO.request];
    for (let i = 0; i < chars.length; i += 1) {
      field.value = chars.slice(0, i + 1).join("");
      if (i === 0) $(".composer-send")?.removeAttribute("disabled");
      const c = chars[i];
      const wobble = ((i * 37) % 11) * 3; // ritmo de quien escribe
      await sleep(c === "," ? 210 : c === " " ? 46 + wobble : 26 + wobble, id);
    }
  }

  function expandHome() {
    const composer = $("[data-pt-composer]");
    composer.classList.remove("is-at-rest");
    composer.classList.add("is-focused");
  }

  function acceptAll(found) {
    const value = (f) => found.find((x) => x.field === f)?.value;
    const chips = [];
    const intent = value("artifactIntent");
    if (intent) chips.push({ id: "intent", label: INTENT_LABEL[intent] ?? intent });
    if (value("topic")) chips.push({ id: "topic", label: value("topic") });
    if (value("duration")) chips.push({ id: "duration", label: value("duration") });
    if (value("quantity")) chips.push({ id: "quantity", label: value("quantity") });
    // Como ContextSelect: el selector no se vuelve a montar, cambia su valor y aparece «Quitar»
    const selects = app.querySelectorAll(".context-select");
    [value("course"), value("subject")].forEach((v, i) => {
      const sel = selects[i];
      if (!v || !sel) return;
      sel.classList.add("has-value");
      sel.querySelector(".context-select-value").textContent = v;
      sel.insertAdjacentHTML("beforeend", `<button type="button" class="context-select-clear" tabindex="-1">${appIcon("x", "inline")}</button>`);
    });
    $(".composer-chips").insertAdjacentHTML("beforeend", chipsHTML(chips));
    $(".composer-suggestions")?.remove();
  }

  async function runLive(id) {
    const live = $(".chat-live");
    const mark = live.querySelector(".activity-mark");
    const phrase = live.querySelector(".chat-live-phrase");
    const elapsed = live.querySelector(".chat-live-elapsed");
    const started = performance.now();
    const clock = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      elapsed.textContent = s >= 5 ? `${s} s` : "";
    }, 250);
    try {
      let signals = 1;
      const say = (text) => {
        phrase.textContent = text;
      };
      await sleep(1200, id);
      for (const step of DEMO.run.slice(1)) {
        signals += 1;
        setSignals(mark, signals);
        say(step.phrase);
        await sleep(1200, id);
        if (step.done) {
          let list = live.querySelector(".run-steps");
          if (!list) {
            live.insertAdjacentHTML("afterbegin", `<ol class="run-steps" aria-label="Pasos terminados"></ol>`);
            list = live.querySelector(".run-steps");
          }
          list.insertAdjacentHTML("beforeend", doneStepHTML(step.done));
          stick();
        }
      }
      // LiveMaterial: el título y las partes que se escriben; sólo las últimas ocho a la vista
      live.insertAdjacentHTML(
        "beforeend",
        `<div class="chat-live-material"><div class="chat-live-material-head"><p class="chat-live-material-title">${esc(DEMO.title)}</p><span class="chat-live-material-count"></span></div><ol class="chat-live-material-pieces"></ol></div>`,
      );
      const count = live.querySelector(".chat-live-material-count");
      const list = live.querySelector(".chat-live-material-pieces");
      // Como <Index> en LiveMaterial: cada fila conserva su nodo y sólo cambia su texto; recrearlas repetía su entrada
      const rows = [];
      let earlier = null;
      for (let i = 0; i < DEMO.pieces.length; i += 1) {
        const hidden = Math.max(0, i + 1 - VISIBLE_PIECES);
        const visible = DEMO.pieces.slice(hidden, i + 1);
        if (hidden > 0) {
          if (!earlier) {
            list.insertAdjacentHTML("afterbegin", `<li class="chat-live-material-earlier"></li>`);
            earlier = list.firstElementChild;
          }
          earlier.textContent = `y ${hidden} antes`;
        }
        while (rows.length < visible.length) {
          const row = document.createElement("li");
          list.appendChild(row);
          rows.push(row);
        }
        visible.forEach((piece, k) => {
          const last = k === visible.length - 1;
          rows[k].classList.toggle("is-writing", last);
          rows[k].classList.toggle("is-caret-active", last);
          if (!last) rows[k].textContent = piece;
        });
        count.textContent = `${i + 1} ${i ? "partes" : "parte"}`;
        if (signals < AM.N) setSignals(mark, (signals += 1));
        const li = rows[visible.length - 1];
        const words = DEMO.pieces[i].split(" ");
        for (let w = 1; w <= words.length; w += 3) {
          li.textContent = words.slice(0, w).join(" ");
          stick();
          await sleep(70, id);
        }
        li.textContent = DEMO.pieces[i];
        li.classList.remove("is-caret-active");
        stick();
        await sleep(i < 3 ? 260 : 180, id);
      }
      await sleep(700, id);
    } finally {
      clearInterval(clock);
    }
  }

  function finish() {
    // La respuesta terminada reemplaza a la vista en vivo: el resumen y la tarjeta del material
    const article = $(".message.assistant");
    if (article) {
      article.querySelector(".message-body").innerHTML = finalBodyHTML();
      article.insertAdjacentHTML("beforeend", `<div class="chat-message-files">${materialCardHTML()}</div>`);
    }
    const dock = $("[data-pt-dock]");
    if (dock) {
      dock.classList.replace("tone-trabajando", "tone-reposo");
      dock.querySelectorAll("textarea, .composer-tool").forEach((el) => el.removeAttribute("disabled"));
      const stop = dock.querySelector(".composer-send.is-stop");
      if (stop) stop.outerHTML = `<button type="button" class="composer-send" tabindex="-1" disabled>${appIcon("arrow-up")}</button>`;
      const ws = $(".workspace-surface");
      if (ws) ws.dataset.captureState = "chat-files";
    }
    stick();
  }

  function showFinal() {
    cancel();
    status = "done";
    pristine = false;
    show(true);
    setStep(steps.length);
    stage.classList.add("is-done");
  }

  async function play(from = 0) {
    cancel();
    const id = run;
    status = "playing";
    stage.classList.remove("is-done");
    try {
      if (from <= 1) {
        setStep(0);
        if (!pristine) show(false);
        pristine = false;
        if (from === 0) {
          await sleep(1100, id);
          expandHome();
          await sleep(700, id);
          await typeRequest(id);
        } else {
          expandHome();
          $("textarea").value = DEMO.request;
          $(".composer-send")?.removeAttribute("disabled");
        }
        setStep(1);
        await sleep(450, id); // la pausa de la app antes de ofrecer lo reconocido
        const found = recognize(DEMO.request);
        $(".composer-toolbar-start").insertAdjacentHTML("beforeend", suggestionsHTML(found));
        await sleep(1700, id);
        const all = $(".composer-suggestions-all");
        if (all) all.style.textDecoration = "underline";
        await sleep(240, id);
        acceptAll(found);
        await sleep(1200, id);
        await press($(".composer-send"), id);
        from = 2;
      }
      if (from <= 2) {
        setStep(2);
        $(".session-tabs").outerHTML = tabsHTML(DEMO.session);
        $("[data-pt-main]").innerHTML = workspaceHTML({ final: false });
        await runLive(id);
        from = 3;
      }
      if (from <= 3) {
        setStep(3);
        if (!$(".chat-live")) show(true);
        else finish();
        await sleep(500, id);
        setStep(steps.length);
        stage.classList.add("is-done");
        status = "done";
      }
    } catch (e) {
      if (e !== STOP) throw e;
    }
  }

  steps.forEach((s, i) => s.addEventListener("click", () => (reduce() ? showFinal() : play(i))));
  replay?.addEventListener("click", () => {
    if (reduce()) return showFinal();
    // «Ver de nuevo» se oculta mientras corre la secuencia: el foco pasa al primer paso, que queda marcado
    if (document.activeElement === replay) steps[0]?.focus({ preventScroll: true });
    play(0);
  });

  if (reduce()) {
    showFinal();
    return;
  }
  stage.classList.add("is-live");
  setStep(0);
  /* Empieza cuando la ventana se ve casi entera (el recuadro queda a la vista). Si sale de la pantalla a medio
     camino, vuelve a la Home en reposo y empieza de nuevo al volver: nadie ve la secuencia desde la mitad. */
  let ratio = 0;
  const tryStart = () => {
    if (status === "idle" && ratio >= 0.7 && document.visibilityState === "visible") play(0);
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        ratio = entries[entries.length - 1].intersectionRatio;
        if (ratio < 0.15 && status === "playing") {
          cancel();
          show(false);
          pristine = true;
          setStep(0);
          status = "idle";
        }
        tryStart();
      },
      { threshold: [0, 0.15, 0.4, 0.7, 0.85, 1] },
    ).observe(frame);
    document.addEventListener("visibilitychange", tryStart);
  } else play(0);
})();
