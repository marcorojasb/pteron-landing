/* pteron · inicio (2026-10-12.12)
   1. Las láminas flotan y se dan vuelta: detrás de cada una está la figura con que pteron enseña lo mismo.
   2. La escena: al bajar, la mesa queda fija; las láminas de cada asignatura caen sobre su hoja y se funden en la
      figura, mientras las hojas se imprimen. Todo es función del avance del scroll: hacia atrás se deshace igual.
   3. La hoja: hoja del estudiante o versión docente, color o blanco y negro.
   4. El aviso de datos de estudiantes con la regla y la tarjeta de pteron (pteron-ventana.js).
   5. El recreo: dos clics (o dos toques) seguidos en una lámina y las letras de la portada se van, las láminas se
      ordenan y recreo.js (que se carga recién entonces) las recorta en las piezas de un juego de piezas que caen.
   Sin JavaScript o con movimiento reducido, la página ya está completa y quieta (inicio.css). */
(async () => {
  "use strict";
  // La revisión de caché con que llegó este archivo: el recreo se pide con la misma (se lee antes de esperar nada, mientras
  // document.currentScript todavía es este script)
  const revision = /[?&]v=([^&#]+)/.exec(document.currentScript?.src || "")?.[1] ?? "";
  // Safari corre este script sin esperar las hojas de estilo: medir antes daría la escena sin su CSS (una mesa de miles de
  // píxeles de alto y las láminas fuera de la pantalla). script.js avisa cuándo están todas puestas
  if (window.pteronEstilos) await window.pteronEstilos;
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
        const html = ui.privacyCard({ message, hints, preview: ui.privacy.anonymizedPreview(text) });
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

  /* ——— 5. El recreo ——— */
  // La escena viva deja aquí cómo mover las láminas para el recreo (ordenar, soltar, desordenar y volver). Quieta,
  // las láminas no se mueven y el recreo se abre de una vez
  let escenaRecreo = null;
  let recreo = "cerrado"; // cerrado, abriendo o abierto
  let pedido = null;
  const cargarRecreo = () => {
    if (window.pteronRecreo) return Promise.resolve(window.pteronRecreo);
    pedido ||= new Promise((listo, falla) => {
      const script = document.createElement("script");
      // Un juego que no llega no deja la portada a medias: a los diez segundos se da por perdido
      const espera = setTimeout(() => fallar(new Error("recreo.js no llegó a tiempo")), 10000);
      const fallar = (error) => {
        clearTimeout(espera);
        pedido = null;
        script.remove();
        falla(error);
      };
      script.src = `/recreo.js${revision ? `?v=${revision}` : ""}`;
      script.async = true;
      script.addEventListener("load", () => {
        clearTimeout(espera);
        if (window.pteronRecreo) listo(window.pteronRecreo);
        else fallar(new Error("recreo.js cargó sin el juego"));
      });
      script.addEventListener("error", () => fallar(new Error("recreo.js no cargó")));
      document.head.append(script);
    });
    return pedido;
  };

  // Las letras de la portada se van: las del titular caen una a una, como piezas, y lo demás se desvanece. Al volver,
  // suben en el orden inverso y el titular queda como estaba
  const titular = portada && $("h1", portada);
  const titularOriginal = titular?.innerHTML ?? "";
  const restoPortada = portada ? [".portada-marca", ".portada-texto", ".portada-acciones"].map((sel) => $(sel, portada)).filter(Boolean) : [];
  let letras = null;
  const irseLetras = () => {
    if (letras || !titular || typeof titular.animate !== "function") return;
    const texto = titular.textContent.replace(/\s+/g, " ").trim();
    const sueltas = [];
    const palabras = document.createDocumentFragment();
    texto.split(" ").forEach((palabra, i) => {
      if (i) palabras.append(" ");
      const grupo = document.createElement("span");
      grupo.className = "titular-palabra";
      for (const caracter of palabra) {
        const letra = document.createElement("span");
        letra.className = "titular-letra";
        letra.textContent = caracter;
        grupo.append(letra);
        sueltas.push(letra);
      }
      palabras.append(grupo);
    });
    titular.setAttribute("aria-label", texto);
    titular.replaceChildren(palabras);
    const alto = window.innerHeight;
    const caidas = sueltas.map((letra, i) => {
      const caja = letra.getBoundingClientRect();
      const destino = `translate(${(Math.random() - 0.5) * 50}px, ${alto - caja.top + caja.height * (1 + Math.random())}px) rotate(${(Math.random() - 0.5) * 70}deg)`;
      const anim = letra.animate([{ transform: "none" }, { transform: destino }], {
        duration: 640 + Math.random() * 220,
        delay: i * 15 + Math.random() * 70,
        easing: "cubic-bezier(.55,0,.85,.4)",
        fill: "both",
      });
      return { letra, destino, anim };
    });
    const desvanecidos = restoPortada.map((el, i) =>
      el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(18px)" }], { duration: 360, delay: 50 * i, easing: "ease-in", fill: "both" }),
    );
    letras = { caidas, desvanecidos };
  };
  const volverLetras = () => {
    if (!letras) return;
    const { caidas, desvanecidos } = letras;
    letras = null;
    const vueltas = caidas.map(({ letra, destino, anim }, i) => {
      anim.cancel();
      return letra.animate([{ transform: destino }, { transform: "none" }], {
        duration: 620,
        delay: (caidas.length - 1 - i) * 13,
        easing: "cubic-bezier(.2,.7,.2,1)",
        fill: "backwards",
      });
    });
    desvanecidos.forEach((anim) => anim.reverse());
    Promise.all([...vueltas, ...desvanecidos].map((anim) => anim.finished)).then(
      () => {
        if (letras) return;
        desvanecidos.forEach((anim) => anim.cancel());
        titular.innerHTML = titularOriginal;
        titular.removeAttribute("aria-label");
      },
      () => {},
    );
  };

  /** Lo que el recreo necesita de cada lámina: su imagen y, si se va a transformar, dónde está, su filtro y su sombra. */
  const laminasParaRecreo = (primera) => {
    const vistas = laminas.filter((lamina) => {
      const img = $(".lamina-cara img", lamina.node);
      return img?.complete && img.naturalWidth > 0 && getComputedStyle(lamina.node).display !== "none";
    });
    // La del doble clic primero y las demás según su distancia a ella: el recorte se propaga desde ahí
    const centro = (lamina) => {
      const caja = lamina.node.getBoundingClientRect();
      return [caja.left + caja.width / 2, caja.top + caja.height / 2];
    };
    const [px, py] = centro(primera);
    const distancia = new Map(vistas.map((lamina) => [lamina, Math.hypot(...centro(lamina).map((v, i) => v - [px, py][i]))]));
    vistas.sort((a, b) => (a === primera ? -1 : b === primera ? 1 : distancia.get(a) - distancia.get(b)));
    return vistas.map((lamina) => {
      const caja = lamina.node.getBoundingClientRect();
      const css = getComputedStyle(lamina.node);
      return {
        nombre: lamina.node.dataset.lamina,
        img: $(".lamina-cara img", lamina.node),
        recorte: lamina.reverso?.style.clipPath || "",
        x: caja.left,
        y: caja.top,
        lado: caja.width,
        filtro: getComputedStyle($(".lamina-cara", lamina.node)).filter,
        sombra: { x: lamina.sx ?? 10, y: lamina.sy ?? 16, desenfoque: parseFloat(css.getPropertyValue("--sb")) || 12, opacidad: parseFloat(css.getPropertyValue("--so")) || 0.3 },
      };
    });
  };

  const abrirRecreo = async (primera) => {
    if (recreo !== "cerrado") return;
    recreo = "abriendo";
    laminas.forEach((lamina) => voltear(lamina, 0));
    const viva = escenaRecreo && !caida;
    let demora = 0;
    if (viva) {
      demora = escenaRecreo.ordenar();
      irseLetras();
    }
    // Mientras se ordenan, las imágenes de las láminas se dejan listas para dibujarlas en el recreo sin esperar
    const imagenes = laminas.map((lamina) => $(".lamina-cara img", lamina.node)?.decode?.().catch(() => {}));
    try {
      const [juego] = await Promise.all([cargarRecreo(), new Promise((listo) => setTimeout(listo, demora)), ...imagenes]);
      const transforma = Boolean(escenaRecreo && !caida);
      const datos = laminasParaRecreo(primera);
      juego.abrir({
        laminas: datos,
        transformar: transforma,
        alCerrar: () => {
          recreo = "cerrado";
          if (escenaRecreo && !caida) escenaRecreo.volver();
          volverLetras();
        },
      });
      // En el mismo cuadro en que el recreo dibuja las láminas, las de la página se esconden
      if (transforma) escenaRecreo.soltar();
      recreo = "abierto";
    } catch (error) {
      recreo = "cerrado";
      if (escenaRecreo && !caida) escenaRecreo.desordenar();
      volverLetras();
      console.warn("pteron: el recreo no se pudo abrir", error);
    }
  };
  // Dos clics seguidos sobre la misma lámina. No se usa dblclick: Safari en iPhone no lo manda al tocar dos veces
  let anterior = { lamina: null, t: -Infinity };
  laminas.forEach((lamina) => {
    lamina.node.addEventListener("click", () => {
      const t = performance.now();
      if (anterior.lamina === lamina && t - anterior.t < 450) {
        anterior = { lamina: null, t: -Infinity };
        abrirRecreo(lamina);
      } else {
        anterior = { lamina, t };
      }
    });
  });

  // Sin movimiento, o si la portada no cabe en la pantalla (un teléfono en horizontal): la página queda como la dibuja el
  // CSS, sin fijar la escena, y el volteo es un cambio de clase sin transición.
  const quieta = () => motion.matches || (portada && portada.scrollHeight > window.innerHeight + 1);
  const staticFlip = () => {
    laminas.forEach((lamina) => lamina.node.classList.toggle("is-volteada", lamina.quiere > 0.5));
  };
  const flipQuieto = () =>
    laminas.forEach((lamina) => {
      lamina.node.addEventListener("pointerenter", staticFlip);
      lamina.node.addEventListener("pointerleave", () => setTimeout(staticFlip, 700));
      lamina.node.addEventListener("click", staticFlip);
    });
  // Quien ya bajó antes de que esto corra (una red lenta) vería saltar la página: fijar la escena la alarga y cambia lo
  // que tenía delante por las láminas a medio vuelo. Queda quieta, como la está leyendo. El salto mide casi lo que bajó:
  // unos pocos píxeles no se notan y no justifican apagar la escena. Llegar con #hojas, recargar o volver atrás también
  // llegan bajados, pero a propósito: esos sí abren la escena
  const navegacion = performance.getEntriesByType?.("navigation")[0]?.type;
  const yaBajo = window.scrollY > 8 && location.hash !== "#hojas" && navegacion !== "reload" && navegacion !== "back_forward";
  if (quieta() || yaBajo) {
    flipQuieto();
    return;
  }

  /* ——— Escena viva ——— */
  // Lo que la escena escribe en línea, tal como venía en el HTML: si algo falla, se devuelve tal cual y la página queda
  // como la dibuja el CSS
  const escritos = new Map();
  [portada, ...laminas.flatMap((lamina) => [lamina.node, lamina.cuerpo, lamina.sombra])]
    .concat(hojas.flatMap((hoja) => [hoja.node, hoja.doc, ...$$("svg[data-figura]", hoja.node)]))
    .forEach((node) => node && escritos.set(node, node.getAttribute("style")));
  const corner = $(".esquina-descargar");
  let watcher = null;
  let raf = 0;
  let running = false;
  let visible = true;
  let latido = 0; // cuándo corrió (o se pidió) el último cuadro
  let caida = false;

  /** Plan de reserva: ante cualquier error la escena se detiene y la página queda quieta, como con movimiento reducido:
      sin data-viva, sin estilos en línea, el volteo por clase y la esquina de vuelta en manos de script.js. */
  function aquietar(error) {
    if (caida) return;
    caida = true;
    running = false;
    cancelAnimationFrame(raf);
    try {
      watcher?.disconnect();
      escena.removeAttribute("data-viva");
      escritos.forEach((style, node) => (style === null ? node.removeAttribute("style") : node.setAttribute("style", style)));
      laminas.forEach((lamina) => lamina.node.removeAttribute("data-arriba"));
      flipQuieto();
      staticFlip();
    } finally {
      if (corner) {
        delete corner.dataset.control;
        // script.js vuelve a mirar el botón de la portada y decide si la esquina se ve
        document.dispatchEvent(new CustomEvent("pteron:esquina"));
      }
      if (error) console.warn("pteron: la escena del inicio queda quieta por un error", error);
    }
  }
  /** Envuelve un manejador de la escena: si falla, la página queda quieta; si ya quedó quieta, no hace nada. */
  const seguro =
    (fn) =>
    (...args) => {
      if (caida) return undefined;
      try {
        return fn(...args);
      } catch (error) {
        aquietar(error);
        return undefined;
      }
    };

  try {
    escena.setAttribute("data-viva", "");
    if (corner) corner.dataset.control = "inicio";
  } catch (error) {
    aquietar(error);
  }
  // Donde la página ya ofrece la descarga (la sección «Descargar» y el pie), la esquina se aparta
  let cornerQuiet = false;
  const quietZones = [$("#descargar"), $("#colofon")].filter(Boolean);
  if (!caida && corner && quietZones.length && "IntersectionObserver" in window) {
    const seen = new Set();
    watcher = new IntersectionObserver(
      seguro((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? seen.add(entry.target) : seen.delete(entry.target)));
        cornerQuiet = seen.size > 0;
        if (cornerQuiet) corner.setAttribute("data-oculto", "");
        else if (progress >= 0.1 || escena.getBoundingClientRect().bottom <= H) corner.removeAttribute("data-oculto");
      }),
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
      // La lámina sigue en el left y top del CSS (h.x, h.y): sólo cambia su transform, que el navegador no cuenta
      // como un salto del diseño (CLS)
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
  let medirOtraVez = true;
  const demoFlip = laminas.find((lamina) => lamina.node.dataset.lamina === "ciencias-luna");

  // El recreo: al doble clic las láminas dejan de flotar y se enderezan (ordenar); después el recreo las toma y las
  // recorta en piezas (soltar: aquí se esconden). Al cerrar el juego vuelven subiendo a saltos de una casilla, cada una a
  // su turno, como piezas al revés (volver). Avanza con el reloj, no con el desplazamiento
  const ORDEN = 420;
  const CAIDA = 1100;
  const enRecreo = { orden: 0, haciaOrden: 0, k: 0, haciaK: 0, oculta: false, antes: 0 };
  const acercar = (v, hacia, paso) => (v < hacia ? Math.min(hacia, v + paso) : Math.max(hacia, v - paso));
  escenaRecreo = {
    ordenar() {
      if (caida) return 0;
      enRecreo.haciaOrden = 1;
      enRecreo.antes = 0;
      start();
      return ORDEN * (1 - enRecreo.orden);
    },
    soltar() {
      if (caida) return;
      enRecreo.oculta = true;
      laminas.forEach((lamina) => (lamina.node.style.visibility = "hidden"));
    },
    desordenar() {
      enRecreo.haciaOrden = 0;
      enRecreo.antes = 0;
      start();
    },
    volver() {
      if (caida) return;
      // Vuelven desde abajo, ya derechas, y suben a su lugar en un orden que no se lee como fila
      laminas.forEach((lamina, i) => (lamina.turno = (((i * 7) % laminas.length) / laminas.length) * 0.4));
      Object.assign(enRecreo, { oculta: false, orden: 0, haciaOrden: 0, k: 1, haciaK: 0, antes: 0 });
      start();
    },
  };

  /** Un cuadro de la escena en el instante now. Devuelve si hace falta otro. */
  function pintar(now) {
    if (enIndice()) {
      pausadaDesde ||= now;
      return false;
    }
    if (pausadaDesde) {
      pausa += now - pausadaDesde;
      pausadaDesde = 0;
    }
    const t = (now - intro - pausa) / 1000;
    // Se mide otra vez si alguien lo pidió o si la mesa ya no mide lo medido: una pestaña de fondo, la caché de ida y
    // vuelta o una página congelada cambian el tamaño sin avisar con resize. Se mide aquí, con el índice cerrado, para
    // dibujar en el mismo cuadro: ninguna lámina queda en la pose de medir
    if (medirOtraVez || fija.clientWidth !== W || fija.clientHeight !== H || narrow.matches !== movil) {
      medirOtraVez = false;
      measure();
      flights();
      waiting();
    }
    // La geometría se lee al comienzo del cuadro, antes de escribir estilos: así no se fuerza un cálculo de diseño
    readProgress();
    const p = progress;
    const dt = enRecreo.antes ? Math.min(50, now - enRecreo.antes) : 16;
    enRecreo.antes = now;
    enRecreo.orden = acercar(enRecreo.orden, enRecreo.haciaOrden, dt / ORDEN);
    enRecreo.k = acercar(enRecreo.k, enRecreo.haciaK, dt / CAIDA);
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
    });

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

      // Ordenadas para el recreo: quietas en su lugar y derechas
      const o = smooth(enRecreo.orden);
      if (o > 0) {
        x = lerp(x, L.x, o);
        y = lerp(y, L.y, o);
        r = lerp(r, 0, o);
        flip *= 1 - o;
      }
      if (enRecreo.k > 0) {
        // De vuelta: abajo de la pantalla y derecha; sube de a un tercio de lámina, su cuadrícula, y al llegar se gira
        const turno = lamina.turno ?? 0;
        const e = span(enRecreo.k, turno, turno + 0.6);
        const g = smooth(span(e, 0, 0.3));
        r = lerp(r, 0, g);
        flip *= 1 - g;
        const casilla = L.L / 3;
        const saltos = Math.ceil((H - L.y + L.L) / casilla) + 1;
        y += Math.floor(span(e, 0.3, 1) ** 2 * saltos) * casilla;
      }

      lamina.node.toggleAttribute("data-arriba", flip > 0.04 || (lamina.vuelo && p > lamina.vuelo[0]));
      // El transform parte del left y top del CSS (L.x, L.y) y lleva la esquina de la lámina a su lugar del cuadro
      lamina.node.style.transform = `translate3d(${x - L.L / 2 - L.x}px, ${y - L.L / 2 - L.y}px, 0) rotate(${r}deg) scale(${s})`;
      lamina.node.style.opacity = alpha < 1 ? String(alpha) : "";
      lamina.node.style.setProperty("--papel", papel < 1 ? String(papel) : "1");
      lamina.node.style.setProperty("--pie", pie < 1 ? String(pie) : "1");
      lamina.node.style.visibility = alpha <= 0 || enRecreo.oculta ? "hidden" : "";
      lamina.cuerpo.style.transform = flip > 0.001 ? `rotateY(${flip * 180}deg)` : "";
      if (lamina.sombra) {
        const sx = 4 + 12 * lift * (0.6 + 0.4 * Math.sin((2 * Math.PI * t) / lamina.py + lamina.fase * 0.7));
        const sy = 6 + 20 * lift;
        lamina.sombra.style.transform = `translate3d(${sx}px, ${sy}px, 0)${flip > 0.001 ? ` rotateY(${flip * 180}deg)` : ""}`;
        // El recreo dibuja la sombra igual al tomar la lámina
        lamina.sx = sx;
        lamina.sy = sy;
      }
    });

    // La descarga de la esquina aparece cuando la portada ya se fue
    if (corner && !cornerQuiet) corner.toggleAttribute("data-oculto", p < 0.1 && escenaAbajo > H);
    // Pasadas las hojas no queda nada en movimiento: el ciclo se detiene hasta el próximo
    // desplazamiento o volteo
    const volteando = laminas.some((lamina) => Math.abs(lamina.volteo - Math.max(lamina.quiere, lamina.demo || 0)) > 0.002);
    // Con las láminas en manos del recreo no queda nada que mover
    if (enRecreo.oculta) return false;
    const recreando = enRecreo.orden !== enRecreo.haciaOrden || enRecreo.k !== enRecreo.haciaK;
    return (visible && p < 0.85) || volteando || recreando;
  }

  function frame(now) {
    if (caida) return;
    latido = performance.now();
    let sigue = false;
    try {
      sigue = pintar(now);
    } catch (error) {
      aquietar(error);
      return;
    }
    running = sigue;
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

  const start = () => {
    if (caida) return;
    // Un cuadro pedido hace más de un segundo que no llegó (la página cargó en una pestaña de fondo, quedó congelada o
    // volvió de la caché de ida y vuelta) ya no va a llegar: se cancela y se pide otro
    if (running && performance.now() - latido > 1000) {
      cancelAnimationFrame(raf);
      running = false;
    }
    if (!running) {
      running = true;
      latido = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  // Medir y dibujar el primer cuadro en el acto, sin esperar un requestAnimationFrame que podría no llegar. Con el índice
  // abierto el cuadro no se dibuja y la medida queda pedida para cuando se cierre
  const remedir = seguro(() => {
    medirOtraVez = true;
    pintar(performance.now());
    start();
  });
  remedir();

  // Las letras, las imágenes y la vuelta desde la caché cambian lo medido: se mide otra vez. Si con las letras
  // definitivas la portada ya no cabe y nadie ha bajado todavía, la página queda quieta, como si lo hubiera sabido al
  // cargar
  const alCargar = seguro(() => {
    if (quieta() && progress <= 0) aquietar();
    else remedir();
  });
  window.addEventListener("load", alCargar, { once: true });
  document.fonts?.ready?.then(alCargar, () => {});
  window.addEventListener(
    "pageshow",
    seguro((event) => {
      visible = document.visibilityState === "visible" && escena.getBoundingClientRect().bottom > 0;
      if (event.persisted) remedir();
      else start();
    }),
  );
  window.addEventListener("focus", seguro(start));

  // Al llegar con #hojas (desde el índice o un enlace), la escena se abre con las hojas ya impresas
  const capitulo = $("#hojas", escena);
  const avance = Number.parseFloat(capitulo?.dataset.capituloAvance);
  if (!caida && location.hash === "#hojas" && Number.isFinite(avance) && navegacion !== "reload" && navegacion !== "back_forward") {
    const alas = seguro(() => {
      window.scrollTo(0, escena.getBoundingClientRect().top + window.scrollY + (escena.offsetHeight - H) * avance);
      readProgress();
      start();
    });
    alas();
    // El navegador vuelve a buscar el ancla al terminar de cargar: se corrige después de él
    window.addEventListener("load", () => setTimeout(alas, 0), { once: true });
  }

  // El desplazamiento sólo despierta el ciclo: el cuadro mide al comenzar
  window.addEventListener("scroll", seguro(start), { passive: true });
  let resizing = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(remedir, 120);
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      seguro(([entry]) => {
        visible = entry.isIntersecting && document.visibilityState === "visible";
        if (visible) start();
      }),
    ).observe(escena);
  }
  document.getElementById("indice")?.addEventListener("close", seguro(start));
  document.addEventListener(
    "visibilitychange",
    seguro(() => {
      visible = document.visibilityState === "visible" && escena.getBoundingClientRect().bottom > 0;
      if (visible) start();
    }),
  );
  motion.addEventListener?.("change", () => window.location.reload());
})();
