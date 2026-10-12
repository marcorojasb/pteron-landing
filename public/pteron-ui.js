/* pteron · interfaz reconstruida (2026-10-12.7)
   1. Reconocimiento del pedido: copia fiel de pteron/src/shared/context-recognition.ts (ADR-161).
      Es local, sin modelo: el mismo diccionario del currículum chileno y las mismas reglas que la app.
   2. Marca de actividad (ADR-160) y la demostración del héroe: el pedido, lo reconocido, la guía
      escribiéndose parte por parte y la tarjeta del material, con los textos de un material real de 0.7. */
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

  /* ---------- 1b. Salvaguarda antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049) ----------
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

  /* ---------- 2. Piezas comunes ---------- */
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const iconsHref = () => document.querySelector("[data-pt-icons]")?.getAttribute("data-pt-icons") || "/assets/pt-icons.svg";
  const icon = (name, extra = "") => `<svg class="pt-i${extra ? ` ${extra}` : ""}" aria-hidden="true"><use href="${iconsHref()}#pt-${name}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* Marca de actividad: ocho nodos sobre una elipse inclinada; se encienden en el orden de la app */
  const LIGHT_ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
  function markSVG() {
    const C = 12, RX = 9.1, RY = 4.8, BACK = 1, FRONT = 2.1;
    let nodes = "";
    for (let i = 0; i < 8; i += 1) {
      const angle = 2 * Math.PI * (0.03 + i / 8) + Math.PI / 2;
      const depth = (1 + Math.sin(angle)) / 2;
      const x = C + RX * Math.cos(angle), y = C + RY * Math.sin(angle);
      const r = BACK + (FRONT - BACK) * depth;
      nodes += `<g class="pt-mx" style="transform:translateX(${(x - C).toFixed(2)}px);--px:${i / 8 + 0.25}"><g class="pt-my" style="transform:translateY(${(y - C).toFixed(2)}px);--p:${i / 8}"><g class="pt-mw"><g class="pt-mn" data-n="${i}" style="transform:scale(${(r / FRONT).toFixed(3)});opacity:${(0.34 + 0.66 * depth).toFixed(2)}"><circle class="pt-halo" cx="12" cy="12" r="${(FRONT * 1.85).toFixed(3)}"/><circle class="pt-dot" cx="12" cy="12" r="${FRONT}"/><circle class="pt-glint" cx="12" cy="12" r="${(FRONT * 0.34).toFixed(3)}"/></g></g></g></g>`;
    }
    const arc = (s) => `M ${C - RX} ${C} A ${RX} ${RY} 0 0 ${s} ${C + RX} ${C}`;
    return `<svg class="pt-mark" viewBox="0 5 24 16" width="24" height="16" aria-hidden="true"><path class="pt-mark-ring is-back" d="${arc(1)}"/><path class="pt-mark-ring is-front" d="${arc(0)}"/>${nodes}</svg>`;
  }
  function lightMark(svg, signals) {
    const lit = new Set(LIGHT_ORDER.slice(0, Math.max(1, Math.min(8, signals))));
    svg.querySelectorAll(".pt-mn").forEach((n) => n.classList.toggle("is-lit", lit.has(Number(n.dataset.n))));
    const working = lit.size > 1;
    if (working === svg.classList.contains("is-working")) return;
    svg.classList.toggle("is-working", working);
  }

  /* ---------- La hoja: «Qué hoja» da vuelta la guía (hoja del estudiante ↔ versión docente) ---------- */
  const hoja = document.querySelector("[data-hoja-section]");
  if (hoja) {
    const sheet = hoja.querySelector("[data-hoja]");
    const radios = [...hoja.querySelectorAll('input[name="que-hoja"]')];
    hoja.classList.add("js-hoja");
    hoja.dataset.face = radios.find((r) => r.checked)?.value || "estudiante";
    let turning = false;
    let pending = null;
    const settle = (face) => {
      hoja.dataset.face = face;
    };
    const turn = (face) => {
      if (reduce() || !sheet || !sheet.animate) return settle(face);
      if (turning) {
        pending = face;
        return;
      }
      turning = true;
      sheet.classList.add("is-out");
      sheet.addEventListener(
        "animationend",
        () => {
          sheet.classList.remove("is-out");
          settle(face);
          sheet.classList.add("is-in");
          sheet.addEventListener(
            "animationend",
            () => {
              sheet.classList.remove("is-in");
              turning = false;
              if (pending && pending !== hoja.dataset.face) {
                const next = pending;
                pending = null;
                turn(next);
              } else pending = null;
            },
            { once: true }
          );
        },
        { once: true }
      );
    };
    radios.forEach((r) => r.addEventListener("change", () => r.checked && turn(r.value)));
  }

  /* ---------- Aviso antes de la nube: el texto se revisa con la misma regla de la app, en vivo ---------- */
  const gate = document.querySelector("[data-pt-gate]");
  if (gate) {
    const area = gate.querySelector("[data-pt-gate-text]");
    const card = gate.querySelector("[data-pt-gate-card]");
    const ok = gate.querySelector("[data-pt-gate-ok]");
    const msg = gate.querySelector("[data-pt-gate-msg]");
    const hintsEl = gate.querySelector("[data-pt-gate-hints]");
    const dockBox = gate.querySelector(".pt-dock");
    const original = area.value;
    const { containsSensitive, redactSensitive, excludeSensitive, sensitiveHints, privacyMessage } = window.pteronUI.privacy;
    const update = () => {
      const value = area.value;
      const flagged = containsSensitive(value);
      card.hidden = !flagged;
      ok.hidden = flagged || !value.trim();
      dockBox.classList.toggle("is-alert", flagged);
      if (flagged) {
        const hints = sensitiveHints(value);
        msg.textContent = privacyMessage(hints);
        hintsEl.textContent = `Detectado: ${hints.join(" · ")}`;
      }
    };
    gate.querySelectorAll("[data-pt-gate-act]").forEach((button) =>
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-pt-gate-act");
        area.value = action === "exclude" ? excludeSensitive(area.value) : action === "anonymize" ? redactSensitive(area.value) : original;
        update();
        area.focus({ preventScroll: true });
      })
    );
    area.addEventListener("input", update);
    update();
  }

  /* ---------- Write: «Pedir un ajuste» sobre la planificación abierta ----------
     El pedido, «Editando el material abierto», el cambio propuesto en dorado y la decisión de la app
     («Propongo estos cambios. Aún no se aplican.» · Conservar cambios · Descartar propuesta). Una vez, al entrar a la vista. */
  const adjust = document.querySelector("[data-pt-adjust]");
  if (adjust) {
    const box = adjust.closest(".pt-write") || adjust;
    const dockEl = adjust.querySelector("[data-pt-adjust-dock]");
    const ctx = adjust.querySelector("[data-pt-adjust-context]");
    const ctxInner = ctx.firstElementChild;
    const field = adjust.querySelector("[data-pt-adjust-text]");
    const sendBtn = adjust.querySelector("[data-pt-adjust-send]");
    const cell = box.querySelector("[data-pt-adjust-cell]");
    const saved = box.querySelector("[data-pt-adjust-saved]");
    const resting = field.textContent;
    const REQUEST = "Agrega a la clase 2 una tarea para quienes terminen antes.";
    const ADDED = " Quienes terminen antes: desarrollar (x + 5)² en la cuadrícula y comparar con un compañero.";
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let ran = false;
    const runAdjust = async () => {
      if (ran || !cell) return;
      ran = true;
      dockEl.classList.add("is-focus");
      field.classList.remove("is-placeholder");
      let shown = "";
      for (const c of REQUEST) {
        shown += c;
        field.innerHTML = `${esc(shown)}<span class="pt-caret"></span>`;
        await wait(c === " " ? 52 : c === "," ? 160 : 30);
      }
      sendBtn.setAttribute("aria-disabled", "false");
      await wait(520);
      sendBtn.classList.add("is-press");
      await wait(160);
      sendBtn.classList.remove("is-press");
      sendBtn.setAttribute("aria-disabled", "true");
      field.textContent = resting;
      field.classList.add("is-placeholder");
      dockEl.classList.remove("is-focus");
      ctxInner.innerHTML = `<div class="pt-dock-row">${markSVG()}<p class="pt-dock-title">Editando el material abierto</p></div>`;
      ctx.classList.add("is-open");
      lightMark(ctxInner.querySelector(".pt-mark"), 3);
      await wait(1800);
      cell.innerHTML = `${cell.innerHTML}<ins>${esc(ADDED)}</ins>`;
      cell.classList.add("is-proposed");
      ctxInner.innerHTML = `<div class="pt-dock-row is-decision"><p class="pt-dock-title">Propongo estos cambios. Aún no se aplican.</p><span class="pt-decide">${icon("check")}Conservar cambios</span><span class="pt-quiet-act">${icon("x")}Descartar propuesta</span></div>`;
      // Como la app, la hoja se desplaza lo justo para que lo propuesto quede a la vista sobre el recuadro
      const pageEl = box.querySelector(".pt-page");
      if (pageEl) {
        const dy = Math.max(0, cell.getBoundingClientRect().bottom - dockEl.getBoundingClientRect().top + 28);
        pageEl.style.transform = `translate(-50%, ${-Math.round(dy)}px)`;
      }
      await wait(2400);
      const keep = ctxInner.querySelector(".pt-decide");
      keep.classList.add("is-press");
      await wait(200);
      ctx.classList.remove("is-open");
      cell.classList.remove("is-proposed");
      cell.classList.add("is-kept");
      saved?.classList.add("is-flash");
    };
    if (!reduce() && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)) {
            io.disconnect();
            setTimeout(runAdjust, 600);
          }
        },
        { threshold: [0, 0.6, 0.85] }
      );
      io.observe(box);
    }
  }

  /* ---------- 3. Demostración del héroe ---------- */
  const DEMO = {
    request: "Necesito una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos, con figuras para pintar.",
    title: "Guía de trabajo: fracciones equivalentes",
    tab: "Fracciones equivalentes · 6° básico",
    phrases: ["Leyendo tu petición", "Buscando en tu carpeta", "Consultando el Currículum Nacional", "Escribiendo el resultado"],
    pieces: [
      "Encabezado del material",
      "Objetivo: representar fracciones en modelos gráficos y reconocer fracciones equivalentes",
      "Sección 1. Representación gráfica de fracciones (15 minutos)",
      "Recuerda: en la fracción a/b, el denominador indica en cuántas partes iguales se divide el entero",
      "Observa las figuras y escribe la fracción que representa la parte pintada",
      "Pinta en cada figura la fracción que se indica. Después explica en una línea cómo supiste cuántas partes pintar.",
      "¿Cuál de las figuras muestra pintada la fracción 2/3?",
      "Sección 2. Fracciones equivalentes: amplificar y simplificar (30 minutos)",
      "Idea clave: dos fracciones son equivalentes cuando representan la misma parte de un entero",
      "Observa las tres barras y escribe la fracción que representa cada una",
      "Completa la tabla amplificando y simplificando",
      "En cada igualdad, escribe el número que falta",
    ],
  };

  const root = document.querySelector("[data-pt-demo]");
  if (!root) return;
  const win = root.querySelector("[data-pt-window]");
  const $ = (sel) => win.querySelector(sel);
  const composer = $("[data-pt-composer]");
  const dock = $("[data-pt-dock]");
  const chips = $("[data-pt-chips]");
  const text = $("[data-pt-text]");
  const start = $("[data-pt-start]");
  const send = $("[data-pt-send]");
  const column = $("[data-pt-column]");
  const history = $("[data-pt-history]");
  // Como en la app, el hilo se mantiene pegado a lo último que llegó
  const stick = () => { history.scrollTop = history.scrollHeight; };
  const tabLabel = $("[data-pt-tab-label]");
  const finalHTML = column.innerHTML;
  const finalTab = tabLabel.textContent;
  const placeholder = text.textContent;
  // Los pasos y «Ver de nuevo» viven fuera de la figura (en la columna del titular) y la controlan por aria-controls
  const controls = (sel) => [...document.querySelectorAll(sel)].filter((el) => !root.id || el.getAttribute("aria-controls") === root.id || root.contains(el));
  const steps = controls("[data-pt-step]");
  const replay = controls("[data-pt-replay]")[0];

  let run = 0;
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
    root.dataset.step = String(n);
    steps.forEach((s, i) => {
      s.classList.toggle("is-current", i === n);
      s.classList.toggle("is-done", i < n);
      if (i === n) s.setAttribute("aria-current", "step");
      else s.removeAttribute("aria-current");
    });
  };

  const picks = (course, subject) =>
    `<span class="pt-pick${course ? "" : " is-empty"}${course ? " is-new" : ""}">${icon("graduation-cap")}${course ? esc(course) + icon("x") : "Curso" + icon("chevron-down")}</span>` +
    `<span class="pt-pick${subject ? "" : " is-empty"}${subject ? " is-new" : ""}" style="--d:1">${icon("book-open")}${subject ? esc(subject) + icon("x") : "Asignatura" + icon("chevron-down")}</span>`;

  function resetHome() {
    win.dataset.view = "home";
    composer.classList.add("is-rest");
    dock.classList.remove("is-focus");
    chips.innerHTML = picks();
    text.textContent = placeholder;
    text.classList.add("is-placeholder");
    start.innerHTML = `<span class="pt-tool">${icon("paperclip")}</span>`;
    send.setAttribute("aria-disabled", "true");
    tabLabel.textContent = "Nueva sesión";
    column.innerHTML = "";
  }

  function showFinal() {
    cancel();
    win.dataset.view = "chat";
    tabLabel.textContent = finalTab;
    column.innerHTML = finalHTML;
    setStep(steps.length);
    root.classList.add("is-done");
  }

  async function typeText(id) {
    text.classList.remove("is-placeholder");
    let shown = "";
    const chars = [...DEMO.request];
    for (let i = 0; i < chars.length; i += 1) {
      shown += chars[i];
      text.innerHTML = `${esc(shown)}<span class="pt-caret"></span>`;
      const c = chars[i];
      // Ritmo de quien escribe: más lento tras una coma o un punto, y una leve variación por letra
      const wobble = ((i * 37) % 11) * 3;
      await sleep(c === "," ? 210 : c === " " ? 46 + wobble : 26 + wobble, id);
    }
    text.innerHTML = `${esc(shown)}<span class="pt-caret"></span>`;
  }

  async function play(from = 0) {
    cancel();
    const id = run;
    root.classList.remove("is-done");
    try {
      if (from <= 0) {
        setStep(0);
        resetHome();
        await sleep(900, id);
        composer.classList.remove("is-rest");
        dock.classList.add("is-focus");
        text.innerHTML = `<span class="pt-caret"></span>`;
        text.classList.remove("is-placeholder");
        await sleep(650, id);
        await typeText(id);
        from = 1;
      }
      if (from <= 1) {
        setStep(1);
        if (win.dataset.view !== "home" || !text.textContent) {
          resetHome();
          composer.classList.remove("is-rest");
          dock.classList.add("is-focus");
          text.classList.remove("is-placeholder");
          text.innerHTML = `${esc(DEMO.request)}<span class="pt-caret"></span>`;
        }
        send.setAttribute("aria-disabled", "false");
        await sleep(450, id); // la pausa de la app antes de ofrecer lo reconocido
        const found = recognize(DEMO.request);
        start.innerHTML =
          `<span class="pt-tool">${icon("paperclip")}</span><div class="pt-suggest"><span class="pt-suggest-label">${icon("lightbulb")}¿Agregar?</span>` +
          found.map((f, i) => `<span class="pt-sug" data-k="${f.field === "topic" ? "topic" : f.field}" style="animation-delay:${i * 60}ms">${icon("plus")}<span>${esc(f.label)}</span></span>`).join("") +
          `<span class="pt-sug-all">Agregar todo</span></div>`;
        await sleep(1500, id);
        const all = start.querySelector(".pt-sug-all");
        start.querySelectorAll(".pt-sug").forEach((s) => s.classList.add("is-on"));
        all?.classList.add("is-press");
        await sleep(260, id);
        const value = (f) => found.find((x) => x.field === f)?.value;
        const extra = found.filter((f) => !["course", "subject"].includes(f.field));
        chips.innerHTML =
          picks(value("course"), value("subject")) +
          extra.map((f, i) => `<span class="pt-chip" style="animation-delay:${90 + i * 45}ms"><span>${esc(f.field === "topic" ? f.value : f.label)}</span><span class="pt-x">${icon("x")}</span></span>`).join("");
        start.innerHTML = `<span class="pt-tool">${icon("paperclip")}</span>`;
        await sleep(1100, id);
        send.classList.add("is-press");
        await sleep(160, id);
        send.classList.remove("is-press");
        from = 2;
      }
      if (from <= 2) {
        setStep(2);
        win.dataset.view = "chat";
        tabLabel.textContent = DEMO.tab;
        const time = `<span class="pt-time">09:42 p. m.</span>`;
        column.innerHTML =
          `<div class="pt-msg is-user"><p class="pt-bubble">${esc(DEMO.request)}</p>${time}</div>` +
          `<div class="pt-msg is-ai"><span class="pt-kicker">pteron</span><div class="pt-live"><div class="pt-live-status">${markSVG()}<p class="pt-live-phrase" data-pt-phrase>${DEMO.phrases[0]}</p></div></div></div>`;
        stick();
        const mark = column.querySelector(".pt-mark");
        const phrase = column.querySelector("[data-pt-phrase]");
        const live = column.querySelector(".pt-live");
        lightMark(mark, 1);
        let signals = 1;
        for (const p of DEMO.phrases.slice(1)) {
          await sleep(1150, id);
          signals += 1;
          lightMark(mark, signals);
          phrase.textContent = p;
          phrase.classList.remove("is-swap");
          void phrase.offsetWidth;
          phrase.classList.add("is-swap");
        }
        live.insertAdjacentHTML("beforeend", `<div class="pt-sheet-live"><div class="pt-sheet-head"><p class="pt-sheet-title">${esc(DEMO.title)}</p><span class="pt-sheet-count" data-pt-count></span></div><ol class="pt-pieces" data-pt-pieces></ol></div>`);
        const list = live.querySelector("[data-pt-pieces]");
        const count = live.querySelector("[data-pt-count]");
        for (let i = 0; i < DEMO.pieces.length; i += 1) {
          const piece = DEMO.pieces[i];
          const visible = DEMO.pieces.slice(Math.max(0, i - 5), i + 1);
          const hidden = i + 1 - visible.length;
          list.innerHTML =
            (hidden > 0 ? `<li class="is-earlier">y ${hidden} antes</li>` : "") +
            visible.map((v, k) => `<li${k === visible.length - 1 ? ' class="is-writing is-caret"' : ""} style="animation:none">${esc(k === visible.length - 1 ? "" : v)}</li>`).join("");
          const li = list.lastElementChild;
          li.style.animation = "";
          count.textContent = `${i + 1} ${i ? "partes" : "parte"}`;
          if (signals < 8) lightMark(mark, (signals += 1));
          // La pieza llega escrita a medias y crece en su lugar
          const words = piece.split(" ");
          for (let w = 1; w <= words.length; w += 3) {
            li.textContent = words.slice(0, w).join(" ");
            stick();
            await sleep(70, id);
          }
          li.textContent = piece;
          stick();
          await sleep(i < 3 ? 260 : 180, id);
        }
        await sleep(700, id);
        from = 3;
      }
      if (from <= 3) {
        setStep(3);
        win.dataset.view = "chat";
        tabLabel.textContent = finalTab;
        column.innerHTML = finalHTML;
        stick();
        await sleep(400, id);
        setStep(steps.length);
        root.classList.add("is-done");
      }
    } catch (e) {
      if (e !== STOP) throw e;
    }
  }

  steps.forEach((s, i) =>
    s.addEventListener("click", () => {
      if (reduce()) return;
      play(i);
    })
  );
  replay?.addEventListener("click", () => (reduce() ? showFinal() : play(0)));

  if (reduce()) {
    showFinal();
    return;
  }
  root.classList.add("is-live");
  resetHome();
  setStep(0);
  let started = false;
  const begin = () => {
    if (started || document.visibilityState !== "visible") return;
    started = true;
    play(0);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          if (document.visibilityState === "visible") begin();
          else document.addEventListener("visibilitychange", begin);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(win);
  } else begin();
})();
