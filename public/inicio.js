/* pteron · inicio (2026-10-12.12)
   1. Las láminas flotan y se dan vuelta: detrás de cada una está la figura con que pteron enseña lo mismo.
   2. La escena: al bajar, la mesa queda fija; las láminas de cada asignatura caen sobre su hoja y se funden en la
      figura, mientras las hojas se imprimen. Todo es función del avance del scroll: hacia atrás se deshace igual.
   3. La hoja: hoja del estudiante o versión docente, color o blanco y negro.
   4. El aviso de datos de estudiantes con la regla y la tarjeta de pteron (pteron-ventana.js).
   Sin JavaScript o con movimiento reducido, la página ya está completa y quieta (inicio.css). */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const narrow = window.matchMedia("(max-width: 760px)");

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  /* ——— 3. La hoja ——— */
  const marco = $("[data-hoja-marco]");
  const angosta = window.matchMedia("(max-width: 760px)");
  if (marco) {
    const papel = $(".hoja-papel", marco);
    const fitSheet = () => {
      const column = marco.parentElement.clientWidth;
      const s = Math.min(0.86, column / 816, Math.max(0.38, (window.innerHeight * 0.92) / 1248));
      marco.style.setProperty("--s", String(Math.min(s, column / 816)));
    };
    fitSheet();
    window.addEventListener("resize", fitSheet, { passive: true });
    $$("[data-controles-hoja] input").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        marco.dataset[input.name === "audiencia" ? "audiencia" : "impresion"] = input.value;
        papel?.querySelectorAll(".pteron-document").forEach((sheet) => {
          sheet.toggleAttribute("inert", sheet.dataset.audiencia !== marco.dataset.audiencia);
        });
        // En el teléfono la hoja queda bajo el texto: si no está a la vista, se trae para ver el cambio
        const caja = marco.getBoundingClientRect();
        if (angosta.matches && (caja.top > window.innerHeight * 0.5 || caja.bottom < 120)) {
          marco.scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" });
        }
      });
    });
    papel?.querySelectorAll(".pteron-document").forEach((sheet) => sheet.toggleAttribute("inert", sheet.dataset.audiencia !== "estudiante"));
  }

  /* ——— 4. El aviso de datos de estudiantes ——— */
  const aviso = $("[data-aviso]");
  const ui = window.pteronUI;
  if (aviso && ui?.privacy && ui.privacyCard) {
    const field = $("[data-aviso-texto]", aviso);
    const card = $("[data-aviso-tarjeta]", aviso);
    const clean = $("[data-aviso-limpio]", aviso);
    const voice = $("[data-aviso-voz]", aviso);
    let last = "";
    const review = () => {
      const text = field.value;
      const sensitive = ui.privacy.containsSensitive(text);
      card.hidden = !sensitive;
      clean.hidden = sensitive;
      if (sensitive) {
        const hints = ui.privacy.sensitiveHints(text);
        const message = ui.privacy.privacyMessage(hints);
        const html = ui.privacyCard({ message, hints, preview: ui.privacy.redactSensitive(text) });
        if (html !== last) card.innerHTML = last = html;
        voice.textContent = message;
      } else {
        voice.textContent = clean.textContent;
      }
    };
    let pending = 0;
    field.addEventListener("input", () => {
      clearTimeout(pending);
      pending = setTimeout(review, 120);
    });
    review();
  }

  /* ——— 1 y 2. Láminas y escena ——— */
  const escena = $("[data-escena]");
  const capa = $("[data-laminas]");
  if (!escena || !capa) return;
  const portada = $("[data-portada]", escena);
  const fija = $(".escena-fija", escena);
  const mesa = $("[data-mesa]", escena);
  const pie = $(".mesa-pie", escena);
  const laminas = $$(".lamina", capa).map((node, index) => ({
    node,
    index,
    cuerpo: $(".lamina-cuerpo", node),
    sombra: $(".lamina-sombra", node),
    reverso: $(".lamina-reverso", node),
    figura: $(".reverso-figura svg", node),
    hoja: node.dataset.hoja || null,
    bloque: node.dataset.bloque || null,
    capa: Number(node.dataset.capa || 1),
    // Movimiento propio: amplitudes y períodos distintos para cada lámina
    ax: 7 + ((index * 37) % 11),
    ay: 10 + ((index * 53) % 15),
    px: 9.5 + ((index * 29) % 7),
    py: 11 + ((index * 41) % 8),
    fase: index * 1.618,
    giro: 0.8 + ((index * 17) % 9) / 6,
    volteo: 0, // 0 cara, 1 reverso (al pasar el cursor o tocar)
    quiere: 0,
    soltar: 0,
  }));
  const hojas = $$(".mesa-hoja", mesa).map((node, i) => ({
    node,
    i,
    id: node.dataset.hoja,
    doc: $(".pteron-document", node),
    rotulo: $(`[data-rotulo="${node.dataset.hoja}"]`, mesa),
  }));

  /* Volteo al pasar el cursor (escritorio) o al tocar (pantalla táctil). */
  const voltear = (lamina, value) => {
    lamina.quiere = value;
  };
  laminas.forEach((lamina) => {
    lamina.node.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(lamina.soltar);
      voltear(lamina, 1);
    });
    lamina.node.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      lamina.soltar = setTimeout(() => voltear(lamina, 0), 650);
    });
    lamina.node.addEventListener("click", () => {
      if (fine.matches) return;
      voltear(lamina, lamina.quiere ? 0 : 1);
    });
  });

  // Sin movimiento, o si la portada no cabe en la pantalla (un teléfono en horizontal): la página queda como la dibuja el
  // CSS, sin fijar la escena, y el volteo es un cambio de clase sin transición.
  const quieta = () => motion.matches || (portada && portada.scrollHeight > window.innerHeight + 1);
  const staticFlip = () => {
    laminas.forEach((lamina) => lamina.node.classList.toggle("is-volteada", lamina.quiere > 0.5));
  };
  if (quieta()) {
    laminas.forEach((lamina) => {
      lamina.node.addEventListener("pointerenter", staticFlip);
      lamina.node.addEventListener("pointerleave", () => setTimeout(staticFlip, 700));
      lamina.node.addEventListener("click", staticFlip);
    });
    return;
  }

  /* ——— Escena viva ——— */
  escena.setAttribute("data-viva", "");
  const corner = $(".esquina-descargar");
  if (corner) corner.dataset.control = "inicio";
  // Donde la página ya ofrece la descarga (la sección «Descargar» y el pie), la esquina se aparta
  let cornerQuiet = false;
  const quietZones = [$("#descargar"), $("#colofon")].filter(Boolean);
  if (corner && quietZones.length && "IntersectionObserver" in window) {
    const seen = new Set();
    const watcher = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? seen.add(entry.target) : seen.delete(entry.target)));
        cornerQuiet = seen.size > 0;
        if (cornerQuiet) corner.setAttribute("data-oculto", "");
        else if (progress >= 0.1 || escena.getBoundingClientRect().bottom <= H) corner.removeAttribute("data-oculto");
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    quietZones.forEach((zone) => watcher.observe(zone));
  }

  let W = 0;
  let H = 0;
  let movil = false;
  const layout = { hojas: [], laminas: [] };

  /** Posición, ancho y giro de reposo de cada lámina, leídos de sus variables (las mismas que usa el CSS). */
  function home(lamina) {
    const css = getComputedStyle(lamina.node);
    const read = (name, fallback) => {
      const value = parseFloat(css.getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const x = read(movil ? "--xm" : "--x", read("--x", 50));
    const y = read(movil ? "--ym" : "--y", read("--y", 50));
    const w = movil ? read("--wm", read("--w", 20)) * (window.innerWidth / 100) : read("--w", 20) * (Math.max(window.innerWidth, window.innerHeight) * 0.0082);
    const r = read(movil ? "--rm" : "--r", read("--r", 0));
    return { x: (x / 100) * W, y: (y / 100) * H, L: w, r };
  }

  /** Dónde queda cada hoja al final: en fila y algo superpuestas en escritorio; en dos filas en el teléfono. */
  function sheetLayout() {
    const n = hojas.length;
    const out = [];
    if (!movil) {
      const solape = 0.1;
      const ancho = n - (n - 1) * solape;
      const s = Math.min((H * 0.7) / 1248, (W * 0.9) / (816 * ancho));
      const sw = 816 * s;
      const sh = 1248 * s;
      const x0 = (W - ancho * sw) / 2;
      const giros = [-2.2, 1.3, -1, 1.9];
      const alturas = [8, -10, 12, -4];
      for (let i = 0; i < n; i += 1) {
        out.push({ x: x0 + i * sw * (1 - solape), y: (H - sh) / 2 - H * 0.035 + alturas[i % 4] * s * 2, s, r: giros[i % 4], sw, sh });
      }
    } else {
      const gap = 12;
      const cols = 2;
      const s = Math.min((W - 32 - gap) / cols / 816, (H * 0.78 - gap) / 2 / 1248);
      const sw = 816 * s;
      const sh = 1248 * s;
      const x0 = (W - (cols * sw + gap)) / 2;
      const y0 = (H - (2 * sh + gap)) / 2 - H * 0.03;
      const giros = [-1.4, 1, 1.2, -0.8];
      for (let i = 0; i < n; i += 1) {
        out.push({ x: x0 + (i % cols) * (sw + gap), y: y0 + Math.floor(i / cols) * (sh + gap), s, r: giros[i % 4], sw, sh });
      }
    }
    return out;
  }

  /** Rectángulo del contenido dibujado de un SVG (con preserveAspectRatio «meet») dentro de su caja. */
  function drawnRect(svg, box) {
    const vb = svg.viewBox?.baseVal;
    if (!vb || !vb.width || !vb.height) return box;
    const k = Math.min(box.width / vb.width, box.height / vb.height);
    const w = vb.width * k;
    const h = vb.height * k;
    return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h };
  }

  /** Mide, sin transformaciones, la figura de cada hoja y la del reverso de cada lámina. */
  function measure() {
    W = fija.clientWidth;
    H = fija.clientHeight;
    movil = narrow.matches;
    layout.hojas = sheetLayout();

    // Hojas: la figura en coordenadas de la hoja (816 × 1248)
    hojas.forEach((hoja) => {
      hoja.node.style.transform = "none";
      const base = hoja.node.getBoundingClientRect();
      hoja.figuras = new Map();
      $$("svg[data-figura]", hoja.doc).forEach((svg) => {
        const r = svg.getBoundingClientRect();
        hoja.figuras.set(svg.getAttribute("data-figura"), { svg, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
      });
      // Bloques que se imprimen de arriba abajo: todo lo que no es figura
      hoja.alto = 1248;
    });

    // Láminas: reposo y figura del reverso en coordenadas de la lámina (L × L, sin girar)
    layout.laminas = laminas.map((lamina) => {
      lamina.oculta = getComputedStyle(lamina.node).display === "none";
      if (lamina.oculta) return null;
      const h = home(lamina);
      lamina.node.style.left = "0px";
      lamina.node.style.top = "0px";
      lamina.node.style.width = `${h.L}px`;
      lamina.node.style.transform = "none";
      lamina.cuerpo.style.transform = "none";
      let back = null;
      if (lamina.figura) {
        const base = lamina.node.getBoundingClientRect();
        const box = lamina.figura.getBoundingClientRect();
        // El reverso está girado 180° en Y: su caja medida es el espejo de la que se verá al voltearlo
        const mirrored = { x: base.width - (box.left - base.left) - box.width, y: box.top - base.top, width: box.width, height: box.height };
        back = drawnRect(lamina.figura, mirrored);
      }
      let target = null;
      if (lamina.hoja) {
        const hi = hojas.findIndex((hoja) => hoja.id === lamina.hoja);
        const fig = hojas[hi]?.figuras.get(`${lamina.hoja}/${lamina.bloque}`);
        // En una pantalla muy angosta el reverso puede no dejarle lugar a la figura: esa lámina no vuela
        if (fig && back && back.width >= 4 && back.height >= 4 && fig.w > 0) target = { hoja: hi, fig };
      }
      return { ...h, back, target };
    });
    hojas.forEach((hoja) => (hoja.node.style.transform = ""));
  }

  /* Ventanas de tiempo sobre el avance p ∈ [0, 1] de la escena */
  const T = {
    portada: [0.015, 0.11],
    hoja: (i) => [0.05 + i * 0.03, 0.24 + i * 0.03],
    imprime: (i) => [0.14 + i * 0.03, 0.42 + i * 0.03],
    rotulos: [0.66, 0.76],
    pie: [0.72, 0.82],
  };
  // Orden de caída: por hoja y, dentro de cada hoja, de arriba abajo; sólo las láminas que esta pantalla muestra y que
  // tienen dónde calzar
  function flights() {
    const caen = laminas
      .filter((lamina, i) => lamina.hoja && !lamina.oculta && layout.laminas[i]?.target)
      .sort((a, b) => hojas.findIndex((h) => h.id === a.hoja) - hojas.findIndex((h) => h.id === b.hoja) || (a.bloque < b.bloque ? -1 : 1));
    const step = Math.min(0.05, 0.28 / Math.max(1, caen.length - 1));
    laminas.forEach((lamina) => (lamina.vuelo = null));
    caen.forEach((lamina, k) => {
      lamina.vuelo = [0.2 + k * step, 0.37 + k * step];
    });
  }

  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      pointer.tx = event.clientX / window.innerWidth - 0.5;
      pointer.ty = event.clientY / window.innerHeight - 0.5;
    },
    { passive: true },
  );

  let progress = 0;
  let escenaAbajo = 0;
  const readProgress = () => {
    const rect = escena.getBoundingClientRect();
    const total = escena.offsetHeight - H;
    progress = total > 0 ? clamp(-rect.top / total) : 0;
    escenaAbajo = rect.bottom;
  };

  /** Rotación de un vector. */
  const rot = (x, y, deg) => {
    const a = (deg * Math.PI) / 180;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  };

  const intro = performance.now();
  // Con el índice abierto la escena se detiene (está bajo el fondo del diálogo) y al volver sigue donde quedó
  const enIndice = () => document.documentElement.classList.contains("con-indice");
  let pausa = 0;
  let pausadaDesde = 0;
  const demoFlip = laminas.find((lamina) => lamina.node.dataset.lamina === "ciencias-luna");

  function frame(now) {
    if (enIndice()) {
      pausadaDesde ||= now;
      running = false;
      return;
    }
    if (pausadaDesde) {
      pausa += now - pausadaDesde;
      pausadaDesde = 0;
    }
    const t = (now - intro - pausa) / 1000;
    // La geometría se lee al comienzo del cuadro, antes de escribir estilos: así no se fuerza un cálculo de diseño
    readProgress();
    const p = progress;
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);

    // La portada se va hacia arriba
    if (portada) {
      const k = smooth(span(p, ...T.portada));
      portada.style.opacity = String(1 - k);
      portada.style.transform = k ? `translate3d(0, ${-48 * k}px, 0)` : "";
      portada.style.visibility = k >= 1 ? "hidden" : "";
    }

    // Hojas: suben desde abajo y se imprimen de arriba abajo
    hojas.forEach((hoja, i) => {
      const L = layout.hojas[i];
      if (!L) return;
      const e = easeOut(span(p, ...T.hoja(i)));
      const y = lerp(H + 40, L.y, e);
      const r = lerp(L.r * 4 + (i % 2 ? 6 : -6), L.r, e);
      hoja.node.style.opacity = e > 0 ? "1" : "0";
      hoja.node.style.transform = `translate3d(${L.x}px, ${y}px, 0) rotate(${r}deg) scale(${L.s})`;
      const k = span(p, ...T.imprime(i));
      hoja.doc.style.clipPath = k >= 1 ? "" : `inset(0 0 ${(1 - smooth(k)) * 100}% 0)`;
      if (hoja.rotulo) {
        const kr = smooth(span(p, ...T.rotulos));
        hoja.rotulo.style.opacity = String(kr);
        hoja.rotulo.style.transform = `translate3d(${L.x + 4}px, ${L.y + L.sh + 14 + (1 - kr) * 8}px, 0)`;
      }
    });
    if (pie) pie.style.opacity = String(smooth(span(p, ...T.pie)));

    // Volteo de demostración: una lámina se da vuelta sola una vez, al poco de cargar
    if (demoFlip) {
      const d = t - 2.4;
      demoFlip.demo = p < 0.01 && d > 0 && d < 2.6 ? 1 : 0;
    }

    laminas.forEach((lamina, i) => {
      const L = layout.laminas[i];
      if (!L) return;
      // Flotar
      const w = 1 - (lamina.vuelo ? easeInOut(span(p, ...lamina.vuelo)) : 0);
      const fx = lamina.ax * Math.sin((2 * Math.PI * t) / lamina.px + lamina.fase);
      const fy = lamina.ay * Math.sin((2 * Math.PI * t) / lamina.py + lamina.fase * 0.7);
      const fr = lamina.giro * Math.sin((2 * Math.PI * t) / (lamina.py * 1.3) + lamina.fase);
      const depth = [0.35, 0.7, 1.15][lamina.capa] ?? 0.7;
      const parX = -pointer.x * 34 * depth;
      const parY = -pointer.y * 22 * depth;
      let x = L.x + fx + parX;
      let y = L.y + fy + parY;
      let r = L.r + fr;
      let s = 1;
      let alpha = 1;
      let lift = 1; // altura sobre la mesa: mueve y desenfoca la sombra
      let papel = 1;
      let pie = 1;

      // Volteo pedido (cursor, toque o demostración), con resorte suave
      const want = Math.max(lamina.quiere, lamina.demo || 0);
      lamina.volteo = lerp(lamina.volteo, want, 0.085);
      let flip = lamina.volteo;

      if (lamina.vuelo && L.target) {
        // Vuelo hasta su figura en la hoja: se da vuelta en el aire y el reverso calza con la figura impresa
        const k = span(p, ...lamina.vuelo);
        const e = easeInOut(k);
        const hoja = layout.hojas[L.target.hoja];
        const fig = L.target.fig;
        const scale = (fig.w * hoja.s) / L.back.width;
        const [cx, cy] = rot(fig.x + fig.w / 2, fig.y + fig.h / 2, hoja.r);
        const figCenter = [hoja.x + cx * hoja.s, hoja.y + cy * hoja.s];
        const off = [L.back.x + L.back.width / 2 - L.L / 2, L.back.y + L.back.height / 2 - L.L / 2];
        const [ox, oy] = rot(off[0] * scale, off[1] * scale, hoja.r);
        const tx = figCenter[0] - ox;
        const ty = figCenter[1] - oy;
        const arc = Math.sin(Math.PI * e) * Math.min(120, H * 0.12);
        x = lerp(x, tx, e);
        y = lerp(y, ty, e) - arc;
        r = lerp(r, hoja.r, e);
        s = lerp(1, scale, e);
        flip = Math.max(flip * (1 - e), smooth(span(k, 0.08, 0.55)));
        lift = 1 - e;
        // Al acercarse, el papel del reverso se desvanece: sólo la figura llega a la hoja
        papel = 1 - smooth(span(k, 0.5, 0.94));
        pie = 1 - smooth(span(k, 0.22, 0.5));
        // Al calzar, el papel se funde y queda la figura de la hoja
        const funde = span(p, lamina.vuelo[1] - 0.005, lamina.vuelo[1] + 0.035);
        alpha = 1 - funde;
        fig.svg.style.opacity = String(smooth(span(p, lamina.vuelo[1] - 0.02, lamina.vuelo[1] + 0.005)));
      } else {
        // Las que no caen se retiran al borde, más chicas y tenues, y se van cuando las hojas ya están impresas
        const k = smooth(span(p, 0.1, 0.45));
        const dx = L.x - W / 2;
        const dy = L.y - H / 2;
        x += dx * 0.28 * k;
        y += dy * 0.22 * k - H * 0.04 * k;
        s = lerp(1, 0.78, k);
        alpha = lerp(1, 0.42, k) * (1 - smooth(span(p, 0.5, 0.7)));
        lift = lerp(1, 0.6, k);
      }

      lamina.node.toggleAttribute("data-arriba", flip > 0.04 || (lamina.vuelo && p > lamina.vuelo[0]));
      lamina.node.style.transform = `translate3d(${x - L.L / 2}px, ${y - L.L / 2}px, 0) rotate(${r}deg) scale(${s})`;
      lamina.node.style.opacity = alpha < 1 ? String(alpha) : "";
      lamina.node.style.setProperty("--papel", papel < 1 ? String(papel) : "1");
      lamina.node.style.setProperty("--pie", pie < 1 ? String(pie) : "1");
      lamina.node.style.visibility = alpha <= 0 ? "hidden" : "";
      lamina.cuerpo.style.transform = flip > 0.001 ? `rotateY(${flip * 180}deg)` : "";
      if (lamina.sombra) {
        const sx = 4 + 12 * lift * (0.6 + 0.4 * Math.sin((2 * Math.PI * t) / lamina.py + lamina.fase * 0.7));
        const sy = 6 + 20 * lift;
        lamina.sombra.style.transform = `translate3d(${sx}px, ${sy}px, 0)${flip > 0.001 ? ` rotateY(${flip * 180}deg)` : ""}`;
      }
    });

    // La descarga de la esquina aparece cuando la portada ya se fue
    if (corner && !cornerQuiet) corner.toggleAttribute("data-oculto", p < 0.1 && escenaAbajo > H);
    // Pasadas las hojas (rótulos y pie ya puestos) no queda nada en movimiento: el ciclo se detiene hasta el próximo
    // desplazamiento o volteo
    const volteando = laminas.some((lamina) => Math.abs(lamina.volteo - Math.max(lamina.quiere, lamina.demo || 0)) > 0.002);
    running = (visible && p < 0.85) || volteando;
    if (running) raf = requestAnimationFrame(frame);
  }

  // Las figuras de las hojas esperan su lámina (si se ve en esta pantalla); las demás se imprimen con la hoja
  const waiting = () =>
    hojas.forEach((hoja) =>
      $$("svg[data-figura]", hoja.doc).forEach((svg) => {
        const lands = laminas.some((lamina, i) => layout.laminas[i]?.target && `${lamina.hoja}/${lamina.bloque}` === svg.getAttribute("data-figura"));
        svg.style.opacity = lands ? "0" : "";
      }),
    );

  let raf = 0;
  let running = false;
  let visible = true;
  const start = () => {
    if (!running) {
      running = true;
      raf = requestAnimationFrame(frame);
    }
  };
  measure();
  flights();
  waiting();
  readProgress();
  start();

  // Al llegar con #hojas (desde el índice o un enlace), la escena se abre con las hojas ya impresas
  const capitulo = $("#hojas", escena);
  const avance = Number.parseFloat(capitulo?.dataset.capituloAvance);
  const navegacion = performance.getEntriesByType?.("navigation")[0]?.type;
  if (location.hash === "#hojas" && Number.isFinite(avance) && navegacion !== "reload" && navegacion !== "back_forward") {
    const alas = () => {
      window.scrollTo(0, escena.getBoundingClientRect().top + window.scrollY + (escena.offsetHeight - H) * avance);
      readProgress();
      start();
    };
    alas();
    // El navegador vuelve a buscar el ancla al terminar de cargar: se corrige después de él
    window.addEventListener("load", () => setTimeout(alas, 0), { once: true });
  }

  // El desplazamiento sólo despierta el ciclo: el cuadro mide al comenzar
  window.addEventListener("scroll", start, { passive: true });
  let resizing = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => {
      measure();
      flights();
      waiting();
      readProgress();
      start();
    }, 120);
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible) start();
    }).observe(escena);
  }
  document.getElementById("indice")?.addEventListener("close", start);
  document.addEventListener("visibilitychange", () => {
    visible = document.visibilityState === "visible" && escena.getBoundingClientRect().bottom > 0;
    if (visible) start();
  });
  motion.addEventListener?.("change", () => window.location.reload());
})();
