/* pteron · la ventana de la app en la web (2026-10-25.1)
   1. Reconocimiento del pedido: copia fiel de pteron/src/shared/context-recognition.ts (ADR-161).
      Es local, sin modelo: el mismo diccionario del currículum chileno y las mismas reglas que la app.
   2. Aviso antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049). El inicio lo usa en
      «En tu computador» (inicio.js).
   3. La ventana de pteron de «Cómo funciona»: el marcado de los componentes de la app, que pteron-app.css dibuja con
      las reglas de la app, y la secuencia de un pedido, con las escenas del recorrido de bienvenida de la app. scripts/pteron-ventana.mjs usa las mismas plantillas para
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
     El marcado de los componentes de la app, con sus mismas clases: App.tsx, ShellIndex, HomePage con la Marca,
     TypeTileRow, ComposerDock, Composer, FilterBar, ContextSelect, ChatView, PlanCard y las decisiones del recuadro,
     LiveResponse con la hojita (ActivityMark), RunTimeline, LiveSheet y ArtifactCards. pteron-app.css los dibuja con
     las reglas de la app, así que lo que se ve es pteron. La secuencia es la del recorrido de bienvenida de la app
     (ADR-183): Pedir, Decidir, Crear y Guardar. El recuadro se amplía al escribir, lo reconocido se ofrece tras la
     pausa de 450 ms, el encargo entra al índice con su curso, el plan pregunta lo que falta, la hoja se escribe con
     el motor de Write y el material queda en el encargo. El DOM se actualiza por partes, como Solid: nada se vuelve a
     montar, así cada animación de la app ocurre una vez. */
  let ICONS = "/assets/pt-icons.svg";
  // Lucide con el trazo de la app (stroke 1.8) y sus tamaños: 14 en línea, 16 en controles, 20 en los rumbos
  const ICON_PX = { inline: 14, control: 16, prominent: 20 };
  const appIcon = (name, size = "control", cls = "") => {
    const px = ICON_PX[size];
    return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name} lucide-icon pteron-icon${cls ? ` ${cls}` : ""}" aria-hidden="true"><use href="${ICONS}#pt-${name}"/></svg>`;
  };

  // La marca (components/Marca.tsx, ADR-175): el dibujo del kit 1.0.0, «pteron» en Outfit 600 con las esquinas dobladas
  const MARCA_VIEWBOX = "-1436 -684 2872 886";
  const MARCA_TRAZO =
    "M-1168 10Q-1101 10 -1048 -23Q-995 -56 -964.5 -113Q-934 -170 -934 -241Q-934 -313 -964.5 -370Q-995 -427 -1048 -460Q-1101 -493 -1168 -493Q-1220 -493 -1261.5 -471Q-1286 -458 -1305 -439.5L-1305 -483L-1436 -483L-1436 123.4L-1357.4 202L-1306 202L-1306 -42.6Q-1287 -24.3 -1262 -11.5Q-1220 10 -1168 10ZM648 10Q721 10 779.5 -23.5Q838 -57 872 -114.5Q906 -172 906 -243Q906 -314 872 -370.5Q838 -427 779.5 -460.5Q721 -494 647 -494Q575 -494 516 -460.5Q457 -427 423 -370.5Q389 -314 389 -243Q389 -172 423.5 -114.5Q458 -57 516.5 -23.5Q575 10 648 10ZM-272 10Q-213 10 -162.5 -11Q-112 -32 -77 -73L-154 -150Q-176 -125 -206 -112.5Q-236 -100 -273 -100Q-314 -100 -345 -117.5Q-376 -135 -392.5 -167.5Q-399.1 -180.4 -403 -195.1L-50 -196Q-46 -213 -44.5 -226.5Q-43 -240 -43 -253Q-43 -322 -73.5 -376.5Q-104 -431 -157.5 -462.5Q-211 -494 -281 -494Q-352 -494 -410 -460.5Q-468 -427 -501.5 -370.5Q-535 -314 -535 -242Q-535 -169 -500.5 -112Q-466 -55 -407 -22.5Q-348 10 -272 10ZM1305 0L1436 0L1436 -306Q1436 -355 1412 -397.5Q1388 -440 1346 -466.5Q1304 -493 1251 -493Q1196 -493 1152.5 -469Q1129 -456 1111 -437.6L1111 -483L980 -483L980 0L1111 0L1111 -277Q1111 -306 1123.5 -328Q1136 -350 1158 -362Q1180 -374 1208 -374Q1251 -374 1278 -347Q1305 -320 1305 -277ZM-799 0L-668 0L-668 -368L-555 -368L-555 -483L-668 -483L-668 -605.4L-746.6 -684L-799 -684L-799 -483L-912 -483L-912 -368L-799 -368ZM28 0L159 0L159 -267Q159 -321 185.5 -347.5Q212 -374 254 -374Q274 -374 289.5 -368Q305 -362 316 -350L398 -444Q375 -470 347 -481.5Q319 -493 284 -493Q203 -493 160 -441.5Q159.5 -440.9 159 -440.3L159 -483L28 -483ZM647 -112Q611 -112 583 -128.5Q555 -145 539 -174.5Q523 -204 523 -242Q523 -280 539 -309Q555 -338 583 -354.5Q611 -371 647 -371Q684 -371 712 -354.5Q740 -338 756 -309Q772 -280 772 -242Q772 -204 756.5 -174.5Q741 -145 712.5 -128.5Q684 -112 647 -112ZM-1191 -111Q-1227 -111 -1254.5 -127.5Q-1282 -144 -1297.5 -173.5Q-1313 -203 -1313 -242Q-1313 -280 -1297.5 -309.5Q-1282 -339 -1254 -355.5Q-1226 -372 -1191 -372Q-1155 -372 -1127 -355.5Q-1099 -339 -1083.5 -309.5Q-1068 -280 -1068 -242Q-1068 -203 -1083.5 -173.5Q-1099 -144 -1127 -127.5Q-1155 -111 -1191 -111ZM-403 -293.2Q-399.3 -306.6 -393.5 -318.5Q-378 -350 -349 -367.5Q-320 -385 -281 -385Q-244 -385 -218.5 -369.5Q-193 -354 -179.5 -325Q-173 -311 -169.2 -293.8Z";
  const marcaSVG = () => `<svg class="pteron-marca" viewBox="${MARCA_VIEWBOX}" role="img" aria-label="pteron"><path fill="currentColor" fill-rule="evenodd" d="${MARCA_TRAZO}"/></svg>`;

  // La hojita (ActivityMark.tsx con lib/activity-mark.ts, ADR-178): cada señal real escribe un renglón; la esquina
  // se dobla mientras espera y más rápido mientras trabaja
  const HOJITA = [[5.5, 14, 11], [5.5, 14, 14], [5.5, 14, 17], [5.5, 11, 20]];
  const renglones = (signals) => {
    const escritas = Math.max(0, Math.floor(signals) - 1);
    return escritas === 0 ? 0 : ((escritas - 1) % HOJITA.length) + 1;
  };
  const estadoHojita = (signals, active) => (active === false ? "quieta" : signals > 1 ? "trabaja" : "espera");
  function hojita(signals, active = true) {
    const estado = estadoHojita(signals, active);
    const escritos = renglones(signals);
    return (
      `<svg viewBox="0 0 20 24" width="18" height="22" aria-hidden="true" class="activity-mark is-${estado}" data-signals="${escritos}" data-state="${estado}">` +
      `<path class="activity-mark-papel" d="M2.5 1.5h10l5 5v16h-15z"/><path class="activity-mark-doblez" d="M12.5 1.5v5h5z"/>` +
      HOJITA.map(([a, b, y], i) => `<path class="activity-mark-linea${i < escritos ? " is-escrita" : ""}" d="M${a} ${y}H${b}"/>`).join("") +
      `</svg>`
    );
  }
  function setHojita(svg, signals, active = true) {
    if (!svg) return;
    const estado = estadoHojita(signals, active);
    const escritos = renglones(signals);
    svg.setAttribute("class", `activity-mark is-${estado}`);
    svg.setAttribute("data-state", estado);
    svg.setAttribute("data-signals", String(escritos));
    svg.querySelectorAll(".activity-mark-linea").forEach((linea, i) => linea.classList.toggle("is-escrita", i < escritos));
  }

  /* Contenido: el primer pedido de partida del recorrido de la app (lib/recorrido.ts) y la guía de Matemática que el
     inicio muestra en «La hoja» (scripts/pteron-hojas/materiales.mjs); la hoja que se escribe es esa misma hoja */
  const TILES = [
    ["calendar-days", "Planificar", "organiza clases y unidades"],
    ["file-plus-corner", "Crear", "produce material listo para usar"],
    ["clipboard-check", "Evaluar", "comprueba y analiza aprendizajes"],
    ["sliders-horizontal", "Adaptar", "ajusta material existente"],
  ];
  const DEMO = {
    request: "Una guía de fracciones equivalentes para 5° básico, de 45 minutos, con ejercicios graduados",
    example: "Por ejemplo: presentación sobre el ciclo del agua para 3° básico",
    chatPlaceholder: "Pregunta, explora o crea con pteron…",
    answerPlaceholder: "Responde con tus palabras…",
    planPlaceholder: "Ajusta el plan o pide un cambio…",
    encargo: "Fracciones equivalentes",
    curso: "5° básico",
    asignatura: "Matemática",
    clock: "09:42 p. m.",
    date: "14 oct 2026",
    intro: "Antes de crear la guía, una decisión: cómo gradúo los ejercicios.",
    plan: {
      title: "Guía · Fracciones equivalentes",
      purpose: "Guía de trabajo de 45 minutos para 5° básico, con ejercicios que van de lo más simple a lo más exigente.",
      question: "¿Cómo gradúo los ejercicios?",
      choices: ["De lo concreto a lo simbólico", "Sólo ejercicios simbólicos", "Con problemas de la vida diaria"],
      facts: [["Curso", "5° básico"], ["Asignatura", "Matemática"], ["Tema", "Fracciones equivalentes"]],
      deliverables: [["file-pen", "Guía del estudiante"], ["clipboard-check", "Pauta docente"]],
      stages: [["Representar", "Pintar en una barra lo mismo que 3/4."], ["Ubicar", "Encontrar en la recta los sextos que valen 2/3."]],
      assumption: "Una sola sesión de 45 minutos, salvo que prefieras otra extensión.",
    },
    // lib/run-timeline.ts y lib/live-response.ts: la frase viva y el paso terminado de cada herramienta
    run: [
      { phrase: "Consultando el Currículum Nacional", done: "Consultó el Currículum Nacional", detail: "5° básico · Matemática" },
      { phrase: "Escribiendo la guía" },
    ],
    material: "Guía de trabajo: fracciones equivalentes",
    answer:
      "Guía de trabajo de 45 minutos: una idea clave, una barra para pintar la fracción equivalente a 3/4 y una recta con tercios y sextos. Suma 4 puntos; cada pregunta guarda su respuesta y la pauta docente va aparte.",
    cards: [
      { icon: "file-pen", kind: "Guía", title: "Guía de trabajo: fracciones equivalentes", tags: ["Matemática"] },
      { icon: "clipboard-check", kind: "Pauta", title: "Pauta docente · Guía de trabajo: fracciones equivalentes", tags: [] },
    ],
  };
  // El índice de una profesora que trabaja: encargos agrupados por curso y asignatura, en el orden del currículum
  const INDICE = [
    { curso: "6° básico · Lenguaje y Comunicación", encargos: [["Evaluación de comprensión lectora", "Evaluación · Pauta · ayer"]] },
    { curso: "7° básico · Ciencias Naturales", encargos: [["Cambios de estado del agua", "Planificación · lunes"]] },
    { curso: "Sin curso", encargos: [["¿Mide comprensión o memoria?", "Conversación · jueves"]] },
  ];
  const CARPETA = ["pteron", "14 documentos"];
  const INTENT_LABEL = { guide: "Guía", planning: "Planificación", assessment: "Evaluación", rubric: "Rúbrica", activity: "Actividad", answer_key: "Pauta", presentation: "Presentación" };
  const iniciales = (titulo) =>
    titulo
      .replace(/[¿?¡!]/g, "")
      .split(/\s+/)
      .filter((p) => p && !/^(de|del|la|las|el|los|o|y|en|a)$/i.test(p))
      .slice(0, 2)
      .map((p) => p[0].toLocaleUpperCase("es"))
      .join("");

  /* ShellIndex.tsx: arriba Nuevo encargo, Biblioteca y Buscar; al medio los encargos por curso; al pie Configuración,
     el modelo que responde y la carpeta */
  const encargoHTML = ([titulo, detalle, tono], actual = false) =>
    `<li class="shell-index-encargo"><button type="button" class="shell-index-abrir" tabindex="-1"${actual ? ' aria-current="page"' : ""}>` +
    `<span class="shell-index-inicial" aria-hidden="true"${tono ? ` data-tono="${tono}"` : ""}>${iniciales(titulo)}</span><span class="shell-index-titulo">${esc(titulo)}</span>` +
    `<span class="shell-index-detalle"${tono ? ` data-tono="${tono}"` : ""}>${tono === "trabajo" ? appIcon("clock-3", "inline") : tono === "aviso" ? appIcon("circle-question-mark", "inline") : ""}${esc(detalle)}</span></button>` +
    `<button type="button" class="shell-index-archivar" tabindex="-1">${appIcon("archive", "inline")}</button></li>`;
  const grupoHTML = (curso, filas) =>
    `<section class="shell-index-grupo" data-pt-grupo="${esc(curso)}"><button type="button" class="shell-index-curso" tabindex="-1">${appIcon("chevron-down", "inline")}<span>${esc(curso)}</span>` +
    `<span class="shell-index-cuenta">${filas.length}</span></button><ul class="shell-index-lista">${filas.join("")}</ul></section>`;
  const fila = (icono, texto, kbd = "", clase = "", actual = false) =>
    `<button type="button" class="shell-index-fila${clase}" tabindex="-1"${actual ? ' aria-current="page"' : ""}>${appIcon(icono)}<span class="shell-index-texto">${texto}</span>${kbd ? `<kbd aria-hidden="true">${kbd}</kbd>` : ""}</button>`;
  // nuevo: el encargo de la demostración, [detalle, tono], o nada mientras se está en la Home
  function indiceHTML(nuevo) {
    const grupos = (nuevo ? [{ curso: `${DEMO.curso} · ${DEMO.asignatura}`, nuevo: true, encargos: [[DEMO.encargo, ...nuevo]] }] : []).concat(INDICE);
    return (
      `<nav class="shell-index" aria-label="Índice"><div class="shell-index-cabeza"><button type="button" class="shell-index-plegar" tabindex="-1">${appIcon("panel-left")}</button></div>` +
      `<div class="shell-index-acciones">${fila("square-pen", "Nuevo encargo", "⌘N", " is-principal", !nuevo)}${fila("library-big", "Biblioteca")}${fila("search", "Buscar", "⌘K")}</div>` +
      `<div class="shell-index-encargos">${grupos.map((g) => grupoHTML(g.curso, g.encargos.map((e) => encargoHTML(e, Boolean(g.nuevo))))).join("")}</div>` +
      `<div class="shell-index-pie">${fila("settings", "Configuración", "⌘,")}${fila("bot", "<span>IA incluida en pteron</span>")}` +
      `${fila("folder-open", `<span>${CARPETA[0]}</span><small>${CARPETA[1]}</small>`, "", " is-doble")}</div></nav>`
    );
  }
  // La franja de arriba: vacía en la Home; en un encargo, su título y su curso
  const franjaHTML = (encargo) =>
    `<header class="shell-topbar">${encargo ? `<h1 class="shell-titulo">${esc(DEMO.encargo)}</h1><span class="shell-contexto">${esc(DEMO.curso)} · ${esc(DEMO.asignatura)}</span>` : ""}</header>`;

  // FilterBar + ContextSelect: Curso y Asignatura, punteados hasta tener valor
  function filterBarHTML(course, subject) {
    const select = (iconName, label, value, index) =>
      `<div class="filter-field" style="--filter-entry-index: ${index};"><div class="context-select${value ? " has-value" : ""}"><div role="group">` +
      `<button type="button" class="context-select-trigger" tabindex="-1">${appIcon(iconName)}<span class="context-select-value">${value ? esc(value) : `<span aria-hidden="true">${label}</span>`}</span>` +
      `${appIcon("chevron-down", "inline", "context-select-chevron")}</button>` +
      `${value ? `<button type="button" class="context-select-clear" tabindex="-1">${appIcon("x", "inline")}</button>` : ""}</div></div></div>`;
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
      ? `<button type="button" class="composer-send is-stop" tabindex="-1">${appIcon("square", "inline")}</button>`
      : `<button type="button" class="composer-send" tabindex="-1"${text ? "" : " disabled"}>${appIcon("arrow-up")}</button>`;
    return (
      `<div class="composer${home ? " is-home" : ""}${atRest ? " is-at-rest" : ""}${chipsRow ? " has-chips" : ""}" data-pt-composer>` +
      (chipsRow ? `<div class="composer-chips-reveal"><div class="composer-chips" role="group" aria-label="Contexto de este mensaje">${chipsRow}</div></div>` : "") +
      `<div class="composer-field"><textarea rows="1" tabindex="-1" placeholder="${esc(placeholder)}" aria-label="Petición o consulta para pteron" readonly${busy ? " disabled" : ""}>${esc(text)}</textarea></div>` +
      `<div class="composer-toolbar"><div class="composer-toolbar-start"><button type="button" class="composer-tool composer-attach" tabindex="-1"${busy ? " disabled" : ""}>${appIcon("paperclip")}</button></div>` +
      `<div class="composer-toolbar-end"><button type="button" class="composer-tool composer-voice" tabindex="-1"${busy ? " disabled" : ""}>${appIcon("mic")}</button>${send}</div></div></div>`
    );
  }
  // ComposerDock.tsx: el contexto vacío se oculta con :empty; con una pregunta del plan, la decisión va arriba del recuadro
  const dockHTML = (floating, inner, tone = "reposo", context = "") =>
    `<div class="composer-dock ${floating ? "is-floating" : "is-home"} tone-${tone}" data-pt-dock><div class="composer-dock-context">${context}</div>${inner}</div>`;
  const decisionHTML = () =>
    `<div class="composer-dock-decision"><div class="composer-dock-intake" role="group"><p class="composer-dock-question">${esc(DEMO.plan.question)}</p>` +
    `<div class="plan-choices" role="group">${DEMO.plan.choices
      .map((c, i) => `<button type="button" class="plan-choice" tabindex="-1"><span class="plan-choice-mark" aria-hidden="true"></span><span class="plan-choice-text">${esc(c)}</span>${i === 0 ? `<span class="plan-choice-recommended">Sugerida</span>` : ""}</button>`)
      .join("")}</div></div></div>`;

  // HomePage.tsx: la marca de agua, los cuatro rumbos, el recuadro de un renglón y «Reflexión por voz»
  function homeHTML() {
    const tiles = TILES.map(([i, l, h]) => `<button type="button" class="type-tile" tabindex="-1" aria-pressed="false"><span class="icon">${appIcon(i, "prominent")}</span><span class="type-tile-label">${l}</span><span class="type-tile-hint">${h}</span></button>`).join("");
    return (
      `<section class="home-surface"><header class="home-hero"><h1>${marcaSVG()}</h1></header>` +
      `<div class="home-rumbos"><div class="type-tiles" role="group" aria-label="Formas de empezar">${tiles}</div></div>` +
      `<div class="home-composer">${dockHTML(false, composerHTML({ home: true, atRest: true, chipsRow: filterBarHTML(), placeholder: DEMO.example }))}</div>` +
      `<div class="home-quiet-row"><button type="button" class="home-quiet-card" tabindex="-1"><span class="home-quiet-icon">${appIcon("mic", "inline")}</span><span class="home-quiet-copy"><strong>Reflexión por voz</strong><span>Piensa en voz alta una clase o un desafío</span></span></button></div>` +
      `<div class="home-reserve" aria-hidden="true"><div></div></div></section>`
    );
  }

  // ArtifactCards.tsx: la tarjeta del plan, por acordar o lista para crear
  function planCardHTML(listo) {
    const p = DEMO.plan;
    const decision = listo
      ? `<li class="plan-decision is-answered"><span class="plan-decision-marker" aria-hidden="true">${appIcon("check", "inline")}</span><div class="plan-decision-body"><p class="plan-decision-prompt">${esc(p.question)}</p><p class="plan-decision-answer">${esc(p.choices[0])}</p></div></li>`
      : `<li class="plan-decision is-pending is-current"><span class="plan-decision-marker" aria-hidden="true"><span>1</span></span><div class="plan-decision-body"><p class="plan-decision-prompt">${esc(p.question)}</p><p class="plan-decision-where">${appIcon("arrow-down", "inline")}Respóndela en el recuadro de abajo</p></div></li>`;
    const disclosure = (titulo, cuerpo, n) =>
      `<details class="chat-plan-card-disclosure"><summary tabindex="-1">${appIcon("chevron-right", "inline", "chat-plan-card-disclosure-chevron")}${titulo}<span class="chat-plan-card-count">${n}</span></summary>${cuerpo}</details>`;
    return (
      `<article class="chat-file-card plan chat-plan-card is-focused" data-plan-review-state="${listo ? "ready" : "questions"}"><header class="chat-plan-card-head"><span class="chat-plan-card-icon" aria-hidden="true">${appIcon("list-checks")}</span>` +
      `<div class="chat-plan-card-heading"><p class="chat-plan-card-kicker">Plan de trabajo · ${p.deliverables.length} entregables</p><h3 class="chat-plan-card-title">${esc(p.title)}</h3></div>` +
      `<span class="status-pill" data-tone="${listo ? "ready" : "pending"}">${listo ? "Listo" : "Por acordar"}</span></header>` +
      `<div class="chat-plan-outline chat-plan-card-body" aria-label="Contenido del plan"><p class="chat-plan-card-purpose">${esc(p.purpose)}</p>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Decisiones<span class="chat-plan-card-count">${listo ? 1 : 0} de 1</span></h4><ol class="plan-decisions chat-plan-questions">${decision}</ol></section>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Contexto acordado</h4><dl class="chat-plan-card-facts">${p.facts.map(([dt, dd]) => `<div class="chat-plan-card-fact"><dt>${dt}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl></section>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Resultado previsto</h4><ul class="chat-plan-card-deliverables">${p.deliverables.map(([i, d]) => `<li>${appIcon(i, "inline")}<span>${esc(d)}</span></li>`).join("")}</ul></section>` +
      `<div class="chat-plan-card-more">${disclosure("Cómo lo abordaré", `<ol class="chat-plan-card-stages">${p.stages.map(([s, d]) => `<li><div><strong>${s}</strong><span>${esc(d)}</span></div></li>`).join("")}</ol>`, p.stages.length)}` +
      `${disclosure("Supuestos que puedes cambiar", `<ul class="chat-plan-card-assumptions"><li>${esc(p.assumption)}</li></ul>`, 1)}</div></div>` +
      `<footer class="chat-file-actions chat-plan-card-actions">${listo ? `<button type="button" class="btn btn-primary btn-compact" tabindex="-1" data-pt-crear>${appIcon("file-plus-corner")}Crear la guía</button>` : `<p class="chat-plan-card-hint">Falta una decisión para crear el material.</p>`}</footer></article>`
    );
  }
  // ArtifactCards.tsx: el material creado, con su formato, estado y acciones
  const materialCardHTML = (c) =>
    `<article class="chat-file-card material-card"><span class="material-card-tile" aria-hidden="true">${appIcon(c.icon, "prominent")}<span class="material-card-format">DOCX</span></span>` +
    `<div class="material-card-body"><h3 class="material-card-title">${esc(c.title)}</h3><p class="material-card-meta"><span>${c.kind}</span><span class="material-card-status" data-status="ready">Listo</span><span>${DEMO.date}</span></p>` +
    (c.tags.length ? `<div class="material-card-tags">${c.tags.map((t) => `<span class="material-card-tag">${esc(t)}</span>`).join("")}</div>` : "") +
    `</div><div class="chat-file-actions material-card-actions"><button type="button" class="quiet-action" tabindex="-1">${appIcon("layers", "inline")}Versiones</button>` +
    `<button type="button" class="quiet-action material-card-abrir" tabindex="-1">Abrir<span class="material-card-abrir-donde"> en editor</span></button></div></article>`;
  // RunTimeline.tsx: un paso terminado, con su visto y su detalle
  const doneStepHTML = (label, detail) =>
    `<li class="run-step"><span class="run-step-marker" aria-hidden="true">${appIcon("check", "inline")}</span><span class="run-step-text"><span class="run-step-label">${esc(label)}</span>${detail ? `<span class="run-step-detail">${esc(detail)}</span>` : ""}</span></li>`;
  // LiveResponse.tsx: la hojita, la frase viva, el tiempo y «Detalles»
  const liveHTML = (phrase, signals) =>
    `<div class="chat-live" data-live-writing="true" data-live-material="document"><div class="chat-live-status">${hojita(signals)}<p class="chat-live-phrase" role="status">${esc(phrase)}</p>` +
    `<span class="chat-live-elapsed" aria-hidden="true"></span><button type="button" class="run-details-toggle" tabindex="-1">Detalles</button></div></div>`;
  const prosaHTML = (texto) => `<div class="md-body md-chat"><p>${esc(texto)}</p></div>`;
  const userHTML = () =>
    `<article class="message user" data-message-role="user" style="--chat-entry-index: 0;"><div class="message-bubble">${esc(DEMO.request)}</div><time class="message-time" aria-hidden="true">${DEMO.clock}</time></article>`;
  const assistantHTML = (index, body, files = "", latest = true) =>
    `<article class="message assistant${latest ? " is-latest" : ""}" data-message-role="assistant" style="--chat-entry-index: ${index};"><div class="message-body">${body}</div>${files ? `<div class="chat-message-files">${files}</div>` : ""}</article>`;

  // ChatView.tsx dentro de WorkspacePage: el hilo del encargo y el recuadro flotante
  function workspaceHTML(final) {
    const hilo = final
      ? userHTML() + assistantHTML(1, prosaHTML(DEMO.intro), planCardHTML(true), false) + assistantHTML(2, prosaHTML(DEMO.answer), DEMO.cards.map(materialCardHTML).join(""))
      : userHTML() + assistantHTML(1, liveHTML("Leyendo tu petición", 1));
    return (
      `<div class="workspace-surface" data-pt-workspace><div class="workspace-main"><div class="chat-pane"><div class="chat-history" data-pt-history><div class="chat-column">${hilo}</div></div></div>` +
      dockHTML(true, composerHTML({ home: false, placeholder: DEMO.chatPlaceholder, busy: !final }), final ? "reposo" : "trabajando") +
      `</div></div>`
    );
  }

  // App.tsx: el índice y la columna con su franja, el contenido y la ayuda en la esquina; los semáforos de macOS
  function windowHTML({ final = true } = {}) {
    return (
      `<div class="app-shell">${indiceHTML(final ? ["Guía · Pauta · hoy"] : null)}<div class="shell-columna">${franjaHTML(final)}` +
      `<div class="shell-main" data-pt-main>${final ? workspaceHTML(true) : homeHTML()}</div>` +
      `<footer class="shell-corner-controls"><span class="footer-right"><button type="button" class="footer-circle-btn" tabindex="-1">${appIcon("circle-question-mark", "inline")}</button></span></footer></div></div>` +
      `<span class="pt-traffic" aria-hidden="true"><i></i><i></i><i></i></span>`
    );
  }
  /* PrivacyConsentCard.tsx: el aviso que pteron muestra antes de que un texto con datos de estudiantes salga a la nube.
     En la app aparece en el recuadro, arriba de lo que se escribe (ComposerDock): aquí, el mismo recuadro con el aviso. */
  const privacyCardHTML = ({ message, hints, preview, open = true }) =>
    `<div class="composer-dock is-floating tone-reposo"><div class="composer-dock-context"><section class="privacy-consent" role="alertdialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body">` +
    `<h2 id="privacy-consent-title">${appIcon("lock-keyhole")}Datos identificables de estudiantes</h2>` +
    `<p id="privacy-consent-body">${esc(message)}</p>` +
    (hints.length ? `<p class="privacy-consent-hints">Detectado: ${esc(hints.join(" · "))}</p>` : "") +
    (preview.trim()
      ? `<details class="privacy-consent-preview"${open ? " open" : ""}><summary tabindex="-1">Vista previa anonimizada</summary><pre>${esc(preview)}</pre></details>`
      : "") +
    `<div class="privacy-consent-actions"><button type="button" class="btn btn-primary" tabindex="-1">Excluir fragmentos</button>` +
    `<button type="button" class="btn btn-secondary" tabindex="-1">Anonimizar y continuar</button>` +
    `<button type="button" class="quiet-action" tabindex="-1">Cancelar</button></div></section></div></div>`;

  window.pteronUI.window = { html: windowHTML, setIcons: (href) => (ICONS = href) };
  window.pteronUI.privacyCard = privacyCardHTML;

  /* La escena: la ventana de 1440 × 880 se escala al ancho de su marco (en móvil, el marco recorta y se acerca) */
  const stage = document.querySelector("[data-pt-demo]");
  if (!stage) return;
  ICONS = stage.getAttribute("data-pt-icons") || ICONS;
  const frame = stage.querySelector("[data-pt-frame]");
  const app = frame?.querySelector(".pt-app");
  if (!app) return;
  // En el teléfono el marco no achica la ventana entera hasta lo ilegible: la vista se acerca a lo que pasa en cada paso
  // y lo sigue. Mientras se escribe abarca el recuadro completo; en el plan, la tarjeta y la decisión; en la hoja, la hoja.
  const APP_W = 1440;
  const APP_H = 880;
  const FOCO = [
    { ancho: 1000, ver: [".composer"] },
    { ancho: 860, ver: [".chat-plan-card", ".composer-dock"] },
    { ancho: 860, ver: [".chat-live-material"] },
    { ancho: 860, ver: [".message.assistant.is-latest"] },
  ];
  let encuadrePendiente = false;
  const encuadrar = () => {
    encuadrePendiente = false;
    const crop = parseFloat(getComputedStyle(frame).getPropertyValue("--pt-crop")) || APP_W;
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    if (crop >= APP_W) {
      frame.style.setProperty("--pt-s", String(W / APP_W));
      frame.style.removeProperty("--pt-x");
      frame.style.removeProperty("--pt-y");
      return;
    }
    const foco = FOCO[Math.min(Number(stage.dataset.step) || 0, FOCO.length - 1)];
    const s = W / foco.ancho;
    frame.style.setProperty("--pt-s", String(s));
    const cajas = foco.ver
      .map((sel) => app.querySelector(sel))
      .filter((el) => el && el.getClientRects().length)
      .map((el) => el.getBoundingClientRect());
    if (!cajas.length) return;
    // Las cajas, en unidades de la app: la escala de este instante es el ancho visible de la app sobre 1440
    const a = app.getBoundingClientRect();
    const ahora = a.width / APP_W || s;
    const izquierda = (Math.min(...cajas.map((r) => r.left)) - a.left) / ahora;
    const derecha = (Math.max(...cajas.map((r) => r.right)) - a.left) / ahora;
    const arriba = (Math.min(...cajas.map((r) => r.top)) - a.top) / ahora;
    const abajo = (Math.max(...cajas.map((r) => r.bottom)) - a.top) / ahora;
    // Lo que se mira queda al centro; si es más alto que el marco, se ve desde abajo, donde ocurre. Nunca se sale de la ventana.
    const maxX = Math.max(0, (APP_W * s - W) / 2);
    const x = Math.max(-maxX, Math.min(maxX, ((APP_W - izquierda - derecha) / 2) * s));
    const centro = H / 2 - ((arriba + abajo) / 2) * s;
    const desdeAbajo = H - 14 - abajo * s;
    const y = Math.max(Math.min(0, H - APP_H * s), Math.min(0, (abajo - arriba) * s > H - 28 ? desdeAbajo : centro));
    frame.style.setProperty("--pt-x", `${Math.round(x)}px`);
    frame.style.setProperty("--pt-y", `${Math.round(y)}px`);
  };
  const pedirEncuadre = () => {
    if (encuadrePendiente) return;
    encuadrePendiente = true;
    requestAnimationFrame(encuadrar);
  };
  const fit = () => {
    const crop = parseFloat(getComputedStyle(frame).getPropertyValue("--pt-crop")) || APP_W;
    frame.style.setProperty("--pt-s", String(frame.clientWidth / crop));
    pedirEncuadre();
  };
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(frame);
  if ("MutationObserver" in window) new MutationObserver(pedirEncuadre).observe(app, { childList: true, subtree: true });

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
    pedirEncuadre();
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
  // El encargo en el índice: su detalle dice en qué está («Trabajando…», «Falta 1 decisión») o lo que produjo
  const marcarEncargo = (detalle, tono) => {
    const grupo = $(`[data-pt-grupo="${DEMO.curso} · ${DEMO.asignatura}"]`);
    if (grupo) grupo.querySelector(".shell-index-lista").innerHTML = encargoHTML([DEMO.encargo, detalle, tono], true);
  };
  // Como ComposerDock: el hilo deja libre la altura del recuadro flotante (--pteron-dock-h)
  const medirRecuadro = () => {
    const dock = $("[data-pt-dock]");
    const ws = $("[data-pt-workspace]");
    if (dock && ws) ws.style.setProperty("--pteron-dock-h", `${Math.ceil(dock.offsetHeight)}px`);
  };
  const recuadro = (opciones, tone, context = "") => {
    const dock = $("[data-pt-dock]");
    if (dock) dock.outerHTML = dockHTML(true, composerHTML({ home: false, ...opciones }), tone, context);
    medirRecuadro();
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
      sel.firstElementChild.insertAdjacentHTML("beforeend", `<button type="button" class="context-select-clear" tabindex="-1">${appIcon("x", "inline")}</button>`);
    });
    $(".composer-chips").insertAdjacentHTML("beforeend", chipsHTML(chips));
    $(".composer-suggestions")?.remove();
  }

  /* LiveSheet.tsx: la hoja que se escribe, con el mismo motor de Write, a la escala de la columna. Es la guía de
     Matemática de «La hoja» (la versión del estudiante), sin su pie: los bloques llegan uno a uno. */
  function liveSheet() {
    const fuente = document.querySelector('.hoja-papel article.pteron-document[data-audiencia="estudiante"]');
    if (!fuente) return null;
    const hoja = fuente.cloneNode(true);
    hoja.removeAttribute("data-material");
    hoja.removeAttribute("data-audiencia");
    hoja.classList.add("chat-live-sheet-page");
    hoja.querySelector(".pteron-sheet-footer")?.remove();
    // Los ids de las figuras no se repiten en la página
    hoja.querySelectorAll("[id]").forEach((el) => el.setAttribute("id", `${el.id}--vivo`));
    hoja.querySelectorAll("[aria-labelledby]").forEach((el) =>
      el.setAttribute("aria-labelledby", el.getAttribute("aria-labelledby").split(/\s+/).map((ref) => `${ref}--vivo`).join(" ")),
    );
    const bloques = [...hoja.children];
    bloques.forEach((b) => (b.hidden = true));
    return { hoja, bloques };
  }

  async function runLive(id) {
    const live = $(".message.assistant.is-latest .chat-live");
    const mark = live.querySelector(".activity-mark");
    const phrase = live.querySelector(".chat-live-phrase");
    const elapsed = live.querySelector(".chat-live-elapsed");
    const started = performance.now();
    const clock = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      elapsed.textContent = s >= 5 ? `${s} s` : "";
    }, 250);
    try {
      let signals = 2;
      setHojita(mark, signals);
      await sleep(1100, id);
      live.insertAdjacentHTML("afterbegin", `<ol class="run-steps" aria-label="Pasos terminados">${doneStepHTML(DEMO.run[0].done, DEMO.run[0].detail)}</ol>`);
      setHojita(mark, (signals += 1));
      phrase.textContent = DEMO.run[1].phrase;
      stick();
      await sleep(500, id);
      const viva = liveSheet();
      live.insertAdjacentHTML(
        "beforeend",
        `<div class="chat-live-material"><div class="chat-live-material-head"><p class="chat-live-material-title">${esc(DEMO.material)}</p><span class="chat-live-material-count"></span></div><div class="chat-live-sheet"></div></div>`,
      );
      if (!viva) return;
      const marco = live.querySelector(".chat-live-sheet");
      marco.appendChild(viva.hoja);
      viva.hoja.style.zoom = String(Math.min(1, marco.clientWidth / 794));
      const count = live.querySelector(".chat-live-material-count");
      for (let i = 0; i < viva.bloques.length; i += 1) {
        viva.bloques[i].hidden = false;
        count.textContent = `${i + 1} ${i ? "partes" : "parte"}`;
        setHojita(mark, (signals += 1));
        stick();
        await sleep(i === 0 ? 900 : 620, id);
      }
      await sleep(700, id);
    } finally {
      clearInterval(clock);
    }
  }

  function finish() {
    // La respuesta terminada reemplaza a la vista en vivo: el resumen y las tarjetas del material
    const article = $(".message.assistant.is-latest");
    if (article) {
      article.querySelector(".message-body").innerHTML = prosaHTML(DEMO.answer);
      article.insertAdjacentHTML("beforeend", `<div class="chat-message-files">${DEMO.cards.map(materialCardHTML).join("")}</div>`);
    }
    marcarEncargo("Guía · Pauta · hoy");
    recuadro({ placeholder: DEMO.chatPlaceholder }, "reposo");
    stick();
  }

  function showFinal() {
    cancel();
    status = "done";
    pristine = false;
    show(true);
    medirRecuadro();
    stick();
    setStep(steps.length);
    stage.classList.add("is-done");
  }

  async function play(from = 0) {
    cancel();
    const id = run;
    status = "playing";
    stage.classList.remove("is-done");
    try {
      // 1. Pedir: el recuadro se amplía, el pedido se escribe y lo reconocido se agrega
      if (from <= 0) {
        setStep(0);
        if (!pristine) show(false);
        pristine = false;
        await sleep(1100, id);
        expandHome();
        await sleep(700, id);
        await typeRequest(id);
        await sleep(450, id); // la pausa de la app antes de ofrecer lo reconocido
        const found = recognize(DEMO.request);
        $(".composer-toolbar-start").insertAdjacentHTML("beforeend", suggestionsHTML(found));
        await sleep(1700, id);
        const all = $(".composer-suggestions-all");
        if (all) all.style.textDecoration = "underline";
        await sleep(240, id);
        acceptAll(found);
        await sleep(1100, id);
        await press($(".composer-send"), id);
      }
      // 2. Decidir: el encargo entra al índice con su curso; el plan pregunta lo que falta y la recomendada va primero
      if (from <= 1) {
        setStep(1);
        if (from === 1) show(false);
        $(".shell-index").outerHTML = indiceHTML(["Trabajando…", "trabajo"]);
        $(".shell-topbar").outerHTML = franjaHTML(true);
        $("[data-pt-main]").innerHTML = workspaceHTML(false);
        medirRecuadro();
        await sleep(1300, id);
        $(".message.assistant.is-latest .message-body").innerHTML = prosaHTML(DEMO.intro);
        $(".message.assistant.is-latest").insertAdjacentHTML("beforeend", `<div class="chat-message-files">${planCardHTML(false)}</div>`);
        marcarEncargo("Falta 1 decisión", "aviso");
        recuadro({ placeholder: DEMO.answerPlaceholder }, "decision", decisionHTML());
        stick();
        await sleep(2200, id);
        const elegida = $(".plan-choice");
        elegida?.classList.add("active");
        await press(elegida, id);
        await sleep(450, id);
        $(".chat-plan-card").outerHTML = planCardHTML(true);
        marcarEncargo("Plan · hoy");
        recuadro({ placeholder: DEMO.planPlaceholder }, "decision");
        stick();
        await sleep(1200, id);
        await press($("[data-pt-crear]"), id);
      }
      // 3. Crear: la hoja se escribe en la conversación, bloque a bloque
      if (from <= 2) {
        setStep(2);
        if (from === 2) {
          show(true);
          $(".message.assistant.is-latest").remove();
        }
        $(".message.assistant.is-latest")?.classList.remove("is-latest");
        $(".chat-column").insertAdjacentHTML("beforeend", assistantHTML(2, liveHTML("Leyendo el plan", 1)));
        marcarEncargo("Trabajando…", "trabajo");
        recuadro({ placeholder: DEMO.chatPlaceholder, busy: true }, "trabajando");
        stick();
        await runLive(id);
      }
      // 4. Guardar: el material queda en el encargo, listo para abrir en Write y guardar en Word o PDF
      setStep(3);
      if (from === 3) showFinal();
      else finish();
      await sleep(500, id);
      setStep(steps.length);
      stage.classList.add("is-done");
      status = "done";
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
