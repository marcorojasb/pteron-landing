/* pteron · recreo (2026-10-13.6)
   El huevo de pascua del inicio. Dos clics (o dos toques) seguidos en una lámina: las letras de la portada se van, las
   láminas se quedan quietas e inicio.js carga este archivo, que las toma donde están y las recorta en piezas. Cada
   lámina deja caer el sobrante de su recorte, vuela a la cuadrícula y en el aire se da vuelta, como las láminas de la
   portada: detrás está su figura, la pieza del juego. La del doble clic es la primera pieza, las tres que siguen
   esperan al costado y las demás se apilan detrás.
   1. El motor: tablero de 10 × 20, bolsa de siete, giros con las patadas de SRS, espera en el suelo, guardar, líneas,
      puntaje y niveles. Es puro (no toca el documento) y se prueba sin navegador: window.pteronRecreo.motor. Cada pieza
      lleva un número de serie; la vista le da la lámina que le toca.
   2. La vista: un <dialog> sin hoja detrás (la cuadrícula va suelta sobre la mesa), un canvas para el tablero y otro,
      encima de todo, para el vuelo de las láminas.
      Teclado: ← → mover, ↑ o X girar, Z girar al revés, ↓ bajar, Espacio soltar, C guardar, P pausa y Esc salir; en
      pantallas táctiles, botones bajo el tablero. Con movimiento reducido no hay vuelo ni animaciones de adorno: el juego
      aparece de una vez, con las piezas ya recortadas, y el destacador no barre. */
(() => {
  "use strict";

  /* ——— 1. Motor ——— */
  const COLUMNAS = 10;
  const FILAS = 20;
  const OCULTAS = 2; // filas sobre la hoja: ahí giran las piezas recién nacidas
  const ALTO = FILAS + OCULTAS;
  const BLOQUEO = 500; // ms que una pieza espera en el suelo antes de quedar fija
  const RESETEOS = 15; // movimientos en el suelo que reinician esa espera, por cada fila nueva que alcanza
  const PAUSA_LINEAS = 280; // ms que una fila completa queda destacada antes de irse
  const PUNTOS = [0, 100, 300, 500, 800]; // por una, dos, tres o cuatro filas a la vez, por el nivel

  // Las siete piezas en su giro 0 (x a la derecha, y hacia abajo) dentro de la caja en que giran
  const PIEZAS = {
    I: { caja: 4, celdas: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { caja: 2, celdas: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { caja: 3, celdas: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { caja: 3, celdas: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { caja: 3, celdas: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { caja: 3, celdas: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { caja: 3, celdas: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  };
  const TIPOS = Object.keys(PIEZAS);
  // Los cuatro giros de cada pieza: el horario lleva (x, y) a (caja − 1 − y, x)
  const FORMAS = Object.fromEntries(
    TIPOS.map((tipo) => {
      const { caja, celdas } = PIEZAS[tipo];
      const giros = [celdas];
      for (let i = 1; i < 4; i += 1) giros.push(giros[i - 1].map(([x, y]) => [caja - 1 - y, x]));
      return [tipo, giros];
    }),
  );
  // Patadas del giro horario desde cada giro (0, R, 2, L), con y hacia arriba como en las tablas de SRS. El giro
  // antihorario desde g usa las del horario desde g − 1 con el signo cambiado.
  const PATADAS = {
    comun: [
      [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    ],
    I: [
      [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
      [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    ],
  };
  const patadas = (tipo, desde, dir) => {
    if (tipo === "O") return [[0, 0]];
    const tabla = tipo === "I" ? PATADAS.I : PATADAS.comun;
    return dir > 0 ? tabla[desde] : tabla[(desde + 3) % 4].map(([x, y]) => [-x, -y]);
  };

  /** Milisegundos por fila en cada nivel: la curva habitual del juego, que a partir del nivel 20 ya no acelera. */
  const gravedad = (nivel) => {
    const n = Math.min(Math.max(1, nivel), 20) - 1;
    return Math.max(1, 1000 * (0.8 - n * 0.007) ** n);
  };

  const celdas = (pieza) => FORMAS[pieza.tipo][pieza.giro].map(([x, y]) => [pieza.x + x, pieza.y + y]);
  const choca = (juego, pieza) =>
    celdas(pieza).some(([x, y]) => x < 0 || x >= COLUMNAS || y < 0 || y >= ALTO || juego.tablero[y][x] !== null);
  const enSuelo = (juego) => choca(juego, { ...juego.pieza, y: juego.pieza.y + 1 });
  const activo = (juego) => juego.estado === "jugando" && juego.pieza !== null && !juego.limpiando;

  /** Un juego nuevo, listo para empezar. azar se puede fijar para probar; record es el mejor puntaje guardado; la cola
      trae al menos largoCola piezas por delante (la vista pide una por lámina). */
  function crear({ azar = Math.random, record = 0, pausaLineas = PAUSA_LINEAS, largoCola = 5 } = {}) {
    const juego = {
      // Cada casilla ocupada guarda de qué pieza es: { tipo, n (su número de serie), k (cuál de sus cuatro), giro }
      tablero: Array.from({ length: ALTO }, () => Array(COLUMNAS).fill(null)),
      azar,
      pausaLineas,
      largoCola: Math.max(5, largoCola),
      serie: 0,
      cambios: 0, // sube cada vez que el tablero cambia
      bolsa: [],
      cola: [], // { tipo, n }
      pieza: null,
      guardada: null,
      puedeGuardar: true,
      puntaje: 0,
      lineas: 0,
      nivel: 1,
      record,
      estado: "listo", // listo, jugando, pausa o fin
      caida: 0, // ms acumulados hacia la próxima fila
      bloqueo: 0, // ms en el suelo
      reseteos: 0,
      masBaja: 0,
      limpiando: null, // { filas, resta }: filas completas, todavía destacadas
      eventos: [], // lo que la vista tiene que contar: líneas, nivel y fin
    };
    llenarCola(juego);
    return juego;
  }

  /** La cola nunca baja de largoCola piezas: salen de bolsas con las siete, revueltas, numeradas en orden. */
  function llenarCola(juego) {
    while (juego.cola.length < juego.largoCola) {
      if (!juego.bolsa.length) {
        const bolsa = [...TIPOS];
        for (let i = bolsa.length - 1; i > 0; i -= 1) {
          const k = Math.floor(juego.azar() * (i + 1));
          [bolsa[i], bolsa[k]] = [bolsa[k], bolsa[i]];
        }
        juego.bolsa = bolsa;
      }
      juego.cola.push({ tipo: juego.bolsa.shift(), n: juego.serie });
      juego.serie += 1;
    }
  }

  /** Dónde nace una pieza: arriba al centro, con su primera fila en la primera de la hoja. */
  const nacimiento = (tipo) => ({ x: Math.floor((COLUMNAS - PIEZAS[tipo].caja) / 2), y: OCULTAS - Math.min(...FORMAS[tipo][0].map(([, y]) => y)) });

  /** Pone en juego la pieza entrada (o la siguiente de la cola). Si no cabe, el juego termina. */
  function nacer(juego, entrada = null) {
    if (!entrada) {
      entrada = juego.cola.shift();
      llenarCola(juego);
    }
    const pieza = { tipo: entrada.tipo, n: entrada.n, giro: 0, ...nacimiento(entrada.tipo) };
    if (choca(juego, pieza)) pieza.y -= 1;
    if (choca(juego, pieza)) return terminar(juego);
    juego.pieza = pieza;
    juego.caida = 0;
    juego.bloqueo = 0;
    juego.reseteos = 0;
    juego.masBaja = pieza.y;
    return true;
  }

  function terminar(juego) {
    juego.estado = "fin";
    juego.pieza = null;
    const nuevo = juego.puntaje > juego.record;
    if (nuevo) juego.record = juego.puntaje;
    juego.eventos.push({ tipo: "fin", puntaje: juego.puntaje, record: nuevo });
    return false;
  }

  /** En el suelo, cada movimiento reinicia la espera, hasta RESETEOS veces. */
  function tocar(juego) {
    if (juego.reseteos >= RESETEOS) return;
    juego.bloqueo = 0;
    juego.reseteos += 1;
  }

  /** Una fila más abajo, si se puede. Al alcanzar una fila nueva los reinicios vuelven a contar. */
  function caer(juego) {
    const pieza = { ...juego.pieza, y: juego.pieza.y + 1 };
    if (choca(juego, pieza)) return false;
    juego.pieza = pieza;
    if (pieza.y > juego.masBaja) {
      juego.masBaja = pieza.y;
      juego.reseteos = 0;
    }
    return true;
  }

  function empezar(juego) {
    if (juego.estado !== "listo") return false;
    juego.estado = "jugando";
    return nacer(juego);
  }

  /** Pausa (o sigue, con pausa = false). Devuelve si quedó en pausa. */
  function pausar(juego, pausa = true) {
    if (pausa && juego.estado === "jugando") juego.estado = "pausa";
    else if (!pausa && juego.estado === "pausa") juego.estado = "jugando";
    return juego.estado === "pausa";
  }

  function mover(juego, dx) {
    if (!activo(juego)) return false;
    const pieza = { ...juego.pieza, x: juego.pieza.x + dx };
    if (choca(juego, pieza)) return false;
    const suelo = enSuelo(juego);
    juego.pieza = pieza;
    if (suelo || enSuelo(juego)) tocar(juego);
    return true;
  }

  /** Gira en sentido horario (dir = 1) o antihorario (dir = −1), probando las patadas en orden. */
  function girar(juego, dir = 1) {
    if (!activo(juego)) return false;
    const actual = juego.pieza;
    const giro = (actual.giro + (dir > 0 ? 1 : 3)) % 4;
    const suelo = enSuelo(juego);
    for (const [px, py] of patadas(actual.tipo, actual.giro, dir)) {
      const pieza = { ...actual, giro, x: actual.x + px, y: actual.y - py };
      if (choca(juego, pieza)) continue;
      juego.pieza = pieza;
      if (pieza.y > juego.masBaja) {
        juego.masBaja = pieza.y;
        juego.reseteos = 0;
      }
      if (suelo || enSuelo(juego)) tocar(juego);
      return true;
    }
    return false;
  }

  /** Baja una fila a mano: un punto. */
  function bajar(juego) {
    if (!activo(juego) || !caer(juego)) return false;
    juego.puntaje += 1;
    juego.caida = 0;
    return true;
  }

  /** Suelta la pieza hasta el fondo: dos puntos por fila, y queda fija. Devuelve cuántas filas cayó. */
  function soltar(juego) {
    if (!activo(juego)) return 0;
    let filas = 0;
    while (caer(juego)) filas += 1;
    juego.puntaje += filas * 2;
    fijar(juego);
    return filas;
  }

  /** Guarda la pieza en juego y saca la guardada (o la siguiente). Una vez por pieza. */
  function guardar(juego) {
    if (!activo(juego) || !juego.puedeGuardar) return false;
    const guardada = juego.guardada;
    juego.guardada = { tipo: juego.pieza.tipo, n: juego.pieza.n };
    juego.puedeGuardar = false;
    nacer(juego, guardada);
    return true;
  }

  /** Dónde caería la pieza si se suelta ahora. */
  function fantasma(juego) {
    if (!juego.pieza) return null;
    let pieza = juego.pieza;
    while (!choca(juego, { ...pieza, y: pieza.y + 1 })) pieza = { ...pieza, y: pieza.y + 1 };
    return pieza;
  }

  function fijar(juego) {
    const { pieza, tablero } = juego;
    const puestas = celdas(pieza);
    puestas.forEach(([x, y], k) => (tablero[y][x] = { tipo: pieza.tipo, n: pieza.n, k, giro: pieza.giro }));
    juego.pieza = null;
    juego.cambios += 1;
    juego.puedeGuardar = true;
    // Quedó entera sobre la hoja: ya no cabe nada más
    if (puestas.every(([, y]) => y < OCULTAS)) {
      terminar(juego);
      return;
    }
    const filas = [];
    tablero.forEach((fila, y) => fila.every((celda) => celda !== null) && filas.push(y));
    if (!filas.length) {
      nacer(juego);
      return;
    }
    const nivel = juego.nivel;
    juego.lineas += filas.length;
    juego.puntaje += PUNTOS[filas.length] * nivel;
    juego.nivel = 1 + Math.floor(juego.lineas / 10);
    juego.eventos.push({ tipo: "lineas", filas, n: filas.length });
    if (juego.nivel > nivel) juego.eventos.push({ tipo: "nivel", nivel: juego.nivel });
    juego.limpiando = { filas, resta: juego.pausaLineas };
    if (juego.pausaLineas <= 0) limpiar(juego);
  }

  /** Se van las filas completas, lo de arriba baja y nace la pieza siguiente. */
  function limpiar(juego) {
    const { filas } = juego.limpiando;
    juego.limpiando = null;
    const quedan = juego.tablero.filter((_, y) => !filas.includes(y));
    while (quedan.length < ALTO) quedan.unshift(Array(COLUMNAS).fill(null));
    juego.tablero = quedan;
    juego.cambios += 1;
    nacer(juego);
  }

  /** Avanza el reloj ms: gravedad (veinte veces más rápida si se mantiene ↓), espera en el suelo y filas destacadas. */
  function avanzar(juego, ms, bajando = false) {
    if (juego.estado !== "jugando") return;
    if (juego.limpiando) {
      juego.limpiando.resta -= ms;
      if (juego.limpiando.resta <= 0) limpiar(juego);
      return;
    }
    if (!juego.pieza) return;
    const g = gravedad(juego.nivel);
    const paso = bajando ? Math.max(1, g / 20) : g;
    juego.caida += ms;
    while (juego.caida >= paso) {
      juego.caida -= paso;
      if (!caer(juego)) {
        juego.caida = 0;
        break;
      }
      if (bajando) juego.puntaje += 1;
    }
    if (enSuelo(juego)) {
      juego.bloqueo += ms;
      if (juego.bloqueo >= BLOQUEO) fijar(juego);
    } else {
      juego.bloqueo = 0;
    }
  }

  const motor = {
    COLUMNAS,
    FILAS,
    OCULTAS,
    TIPOS,
    FORMAS,
    crear,
    empezar,
    pausar,
    mover,
    girar,
    bajar,
    soltar,
    guardar,
    avanzar,
    fantasma,
    celdas,
    nacimiento,
    gravedad,
  };


  /* ——— 2. Vista ——— */
  // Cada pieza es una figura de pteron: el color con que rellena sus figuras y el trazo de tinta, como en ellas
  const COLORES = { I: "#1E3F94", O: "#F0C060", T: "#6B4C9A", S: "#2F8A5B", Z: "#C0492F", J: "#7F9BD6", L: "#B7791F" };
  const TINTA = "#1F2A3D";
  const LINEA = "#C9D3E1";
  const GRAFITO = "#5B6B82";
  const LAPIZ = "#F0C060";
  const CLAVE = "pteron:recreo:record";
  const DAS = 160; // ms antes de que una flecha sostenida repita
  const ARR = 40; // ms entre repeticiones
  // El vuelo, en ms: la línea del recorte, el sobrante que cae, cuándo parten y cuánto tardan en llegar
  const VUELO = { escalonCorte: 24, corte: 320, sobrante: [220, 900], parte: 640, escalon: 38, viaje: 720 };
  const DENSIDAD_SOMBRA = 0.4;

  const ICONOS = {
    izquierda: '<path d="M15 5l-7 7 7 7"/>',
    bajar: '<path d="M12 5v13M6 12l6 6 6-6"/>',
    derecha: '<path d="M9 5l7 7-7 7"/>',
    guardar: '<path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/><path d="M6.5 5h11L20 13v6H4v-6z"/>',
    girar: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>',
    soltar: '<path d="M12 4v10M7 9.5l5 5 5-5M5 19.5h14"/>',
  };
  const CONTROLES = [
    ["izquierda", "Mover a la izquierda"],
    ["bajar", "Bajar"],
    ["derecha", "Mover a la derecha"],
    ["guardar", "Guardar"],
    ["girar", "Girar"],
    ["soltar", "Soltar"],
  ];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const span = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const numero = (n) => n.toLocaleString("es-CL");
  const leerRecord = () => {
    try {
      return Math.max(0, Number.parseInt(window.localStorage.getItem(CLAVE), 10) || 0);
    } catch {
      return 0;
    }
  };
  const escribirRecord = (n) => {
    try {
      window.localStorage.setItem(CLAVE, String(n));
    } catch {
      // Sin almacenamiento el récord dura lo que dura la página
    }
  };

  /** La caja de una pieza en su giro 0: desde qué casilla empieza y cuántas mide. */
  function caja(tipo) {
    const forma = FORMAS[tipo][0];
    const xs = forma.map(([x]) => x);
    const ys = forma.map(([, y]) => y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return { x0, y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1 };
  }

  /** El contorno de una pieza como una sola línea cerrada, en casillas (las piezas no tienen agujeros ni esquinas que
      se toquen en diagonal). */
  function contorno(tipo) {
    const { x0, y0 } = caja(tipo);
    const cs = FORMAS[tipo][0].map(([x, y]) => [x - x0, y - y0]);
    const hay = new Set(cs.map(([x, y]) => `${x},${y}`));
    const lados = new Map();
    for (const [x, y] of cs) {
      if (!hay.has(`${x},${y - 1}`)) lados.set(`${x},${y}`, [x + 1, y]);
      if (!hay.has(`${x + 1},${y}`)) lados.set(`${x + 1},${y}`, [x + 1, y + 1]);
      if (!hay.has(`${x},${y + 1}`)) lados.set(`${x + 1},${y + 1}`, [x, y + 1]);
      if (!hay.has(`${x - 1},${y}`)) lados.set(`${x},${y + 1}`, [x, y]);
    }
    const [inicio] = lados.keys();
    const puntos = [inicio.split(",").map(Number)];
    for (let punto = lados.get(inicio); `${punto}` !== inicio; punto = lados.get(`${punto}`)) puntos.push(punto);
    // Sin los puntos que están en medio de un lado recto
    return puntos.filter((p, i) => {
      const a = puntos[(i + puntos.length - 1) % puntos.length];
      const b = puntos[(i + 1) % puntos.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
  }

  /* ——— Las láminas como piezas ———
     Una lámina está recortada en escalera: tiene esquinas vacías. De cada una se sabe qué sextos tienen imagen y se busca
     el rectángulo lleno donde la pieza cabe más grande; ahí se recorta y cada casilla se queda con su trozo de la obra,
     que gira con ella. */
  const SEXTOS = Array.from({ length: 6 }, (_, i) => (i + 0.5) / 6);

  /** Qué sextos de la lámina tienen imagen. La escalera viene como el polígono del reverso (en %), que es el espejo de la
      cara; sin él, se miran los píxeles de la imagen. */
  function mapaOpaco({ img, recorte: poligono = "" }) {
    const puntos = [...String(poligono).matchAll(/(-?[\d.]+)%\s+(-?[\d.]+)%/g)].map(([, x, y]) => [1 - x / 100, y / 100]);
    if (puntos.length >= 3) {
      const dentro = (px, py) => {
        let si = false;
        for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i, i += 1) {
          const [xi, yi] = puntos[i];
          const [xj, yj] = puntos[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) si = !si;
        }
        return si;
      };
      return SEXTOS.map((y) => SEXTOS.map((x) => dentro(x, y)));
    }
    try {
      const lienzo = document.createElement("canvas");
      lienzo.width = lienzo.height = 60;
      const ctx = lienzo.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 60, 60);
      const datos = ctx.getImageData(0, 0, 60, 60).data;
      return SEXTOS.map((y) => SEXTOS.map((x) => datos[(Math.floor(y * 60) * 60 + Math.floor(x * 60)) * 4 + 3] > 200));
    } catch {
      return SEXTOS.map(() => SEXTOS.map(() => true));
    }
  }

  function recorte(arte, tipo) {
    if (arte.recortes[tipo]) return arte.recortes[tipo];
    const { x0, y0, w, h } = caja(tipo);
    const opaco = (a, b, c, d) => {
      for (let y = c; y < d; y += 1) for (let x = a; x < b; x += 1) if (!arte.mapa[y][x]) return false;
      return true;
    };
    let mejor = { lado: 0, area: 0, a: 0, b: 6, c: 0, d: 6 };
    for (let a = 0; a < 6; a += 1)
      for (let b = a + 1; b <= 6; b += 1)
        for (let c = 0; c < 6; c += 1)
          for (let d = c + 1; d <= 6; d += 1) {
            if (!opaco(a, b, c, d)) continue;
            const lado = Math.min((b - a) / w, (d - c) / h);
            const area = (b - a) * (d - c);
            if (lado > mejor.lado + 1e-9 || (lado > mejor.lado - 1e-9 && area > mejor.area)) mejor = { lado, area, a, b, c, d };
          }
    // En fracciones de la imagen y un poco adentro, para no tomar el borde del recorte. La pieza nunca ocupa la lámina
    // entera: siempre queda un sobrante que cae
    const lado = Math.min((mejor.lado / 6) * 0.97, 0.78 / Math.max(w, h));
    const r = { x0, y0, w, h, lado, ox: (mejor.a + mejor.b) / 12 - (w * lado) / 2, oy: (mejor.c + mejor.d) / 12 - (h * lado) / 2 };
    arte.recortes[tipo] = r;
    return r;
  }

  const arteDe = (n) => (vista.artes.length ? vista.artes[n % vista.artes.length] : null);

  /** La obra de una lámina en un canvas de tamaño conocido. Con srcset, la imagen dice medir lo que ocupa en la página y
      no lo que mide de verdad, y un recorte por coordenadas saldría de otro lugar; dibujada entera no hay dudas. */
  const LADO_ARTE = 512;
  function arte(l) {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = LADO_ARTE;
    lienzo.getContext("2d").drawImage(l.img, 0, 0, LADO_ARTE, LADO_ARTE);
    return { lienzo, mapa: mapaOpaco(l), recortes: {} };
  }

  /** Casillas de piezas, dadas en casillas como [x, y, tipo, n, k, giro]. En el juego son figuras de pteron: el color
      plano de su pieza, las divisiones apenas marcadas y el contorno a tinta sólo donde termina la pieza (dos piezas
      vecinas quedan separadas por sus dos bordes). Con conArte, la lámina recién recortada que todavía no se da vuelta,
      cada casilla lleva su trozo de la obra, que gira con ella. */
  function dibujarCasillas(ctx, lista, t, ox = 0, oy = 0, trazo = 1, conArte = false) {
    const de = new Map(lista.map(([x, y, , n]) => [`${x},${y}`, n]));
    // Las casillas se montan un poco sobre sus vecinas: entre las de una misma pieza no queda costura
    const monta = 0.4;
    for (const [x, y, tipo, n, k, giro] of lista) {
      const px = ox + x * t;
      const py = oy + y * t;
      const arte = conArte && arteDe(n);
      if (arte) {
        const r = recorte(arte, tipo);
        const [cx, cy] = PIEZAS[tipo].celdas[k];
        ctx.save();
        ctx.translate(px + t / 2, py + t / 2);
        if (giro) ctx.rotate((giro * Math.PI) / 2);
        ctx.drawImage(arte.lienzo, (r.ox + (cx - r.x0) * r.lado) * LADO_ARTE, (r.oy + (cy - r.y0) * r.lado) * LADO_ARTE, r.lado * LADO_ARTE, r.lado * LADO_ARTE, -t / 2 - monta, -t / 2 - monta, t + 2 * monta, t + 2 * monta);
        ctx.restore();
      } else {
        ctx.fillStyle = COLORES[tipo];
        ctx.fillRect(px - monta, py - monta, t + 2 * monta, t + 2 * monta);
      }
    }
    if (trazo <= 0) return;
    const ancho = Math.max(1.25, t / 24);
    const a = ancho / 2;
    const misma = (x, y, n) => de.get(`${x},${y}`) === n;
    ctx.save();
    ctx.globalAlpha *= trazo;
    ctx.lineCap = "square";
    // Las divisiones entre casillas de una misma pieza, apenas marcadas
    if (!conArte) {
      ctx.strokeStyle = "rgba(31,42,61,.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x, y, , n] of lista) {
        const px = ox + x * t;
        const py = oy + y * t;
        if (misma(x + 1, y, n)) {
          ctx.moveTo(px + t, py + ancho);
          ctx.lineTo(px + t, py + t - ancho);
        }
        if (misma(x, y + 1, n)) {
          ctx.moveTo(px + ancho, py + t);
          ctx.lineTo(px + t - ancho, py + t);
        }
      }
      ctx.stroke();
    }
    // El contorno, a tinta
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = ancho;
    ctx.beginPath();
    for (const [x, y, , n] of lista) {
      const px = ox + x * t;
      const py = oy + y * t;
      if (!misma(x, y - 1, n)) {
        ctx.moveTo(px + a, py + a);
        ctx.lineTo(px + t - a, py + a);
      }
      if (!misma(x + 1, y, n)) {
        ctx.moveTo(px + t - a, py + a);
        ctx.lineTo(px + t - a, py + t - a);
      }
      if (!misma(x, y + 1, n)) {
        ctx.moveTo(px + a, py + t - a);
        ctx.lineTo(px + t - a, py + t - a);
      }
      if (!misma(x - 1, y, n)) {
        ctx.moveTo(px + a, py + a);
        ctx.lineTo(px + a, py + t - a);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Las casillas de una pieza en su giro 0, con la esquina de su caja en (0, 0). */
  const casillasDe = (entrada) => {
    const { x0, y0 } = caja(entrada.tipo);
    return FORMAS[entrada.tipo][0].map(([x, y], k) => [x - x0, y - y0, entrada.tipo, entrada.n, k, 0]);
  };

  /** Una pieza del tablero (sin las casillas que quedan sobre la hoja). */
  function dibujarPieza(ctx, pieza, c) {
    const lista = celdas(pieza)
      .map(([x, y], k) => [x, y - OCULTAS, pieza.tipo, pieza.n, k, pieza.giro])
      .filter(([, y]) => y >= 0);
    dibujarCasillas(ctx, lista, c);
  }

  /** Dónde va, en su canvas, la caja de la pieza j de las de al costado: centrada en su lugar. */
  function posMini(tipo, j, m) {
    const { w, h } = caja(tipo);
    return [Math.round(m * 2.25 - (w * m) / 2), Math.round(m * (1.5 + j * 3) - (h * m) / 2)];
  }

  function mini(ctx, entrada, j, m) {
    const [px, py] = posMini(entrada.tipo, j, m);
    dibujarCasillas(ctx, casillasDe(entrada), m, px, py);
  }

  let vista = null;

  function armar() {
    const dialogo = document.createElement("dialog");
    dialogo.className = "recreo";
    dialogo.setAttribute("aria-labelledby", "recreo-titulo");
    dialogo.setAttribute("aria-describedby", "recreo-ayuda");
    const botones = CONTROLES.map(
      ([accion, nombre]) =>
        `<button type="button" class="recreo-control" data-accion="${accion}" aria-label="${nombre}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[accion]}</svg></button>`,
    ).join("");
    dialogo.innerHTML = `<div class="recreo-hoja" data-recreo-hoja>
  <header class="recreo-cabeza">
    <h2 class="recreo-titulo" id="recreo-titulo">Recreo</h2>
    <div class="recreo-acciones">
      <button type="button" class="recreo-boton" data-recreo-pausa disabled>Pausa</button>
      <button type="button" class="recreo-boton" data-recreo-cerrar>Cerrar</button>
    </div>
  </header>
  <div class="recreo-cuerpo">
    <div class="recreo-tablero" data-recreo-tablero tabindex="-1">
      <canvas class="recreo-lienzo" data-recreo-lienzo role="img" aria-label="La hoja cuadriculada donde caen las piezas"></canvas>
      <div class="recreo-aviso" data-recreo-aviso>
        <p class="recreo-aviso-titulo" data-recreo-aviso-titulo></p>
        <p class="recreo-aviso-texto" data-recreo-aviso-texto></p>
        <button type="button" class="boton boton-principal" data-recreo-seguir></button>
      </div>
    </div>
    <div class="recreo-lado">
      <div class="recreo-caja"><p class="recreo-rotulo">Siguiente</p><canvas data-recreo-siguiente aria-hidden="true"></canvas></div>
      <div class="recreo-caja"><p class="recreo-rotulo">Guardada</p><canvas data-recreo-guardada aria-hidden="true"></canvas></div>
      <dl class="recreo-datos">
        <div><dt>Puntaje</dt><dd data-recreo-puntaje>0</dd></div>
        <div><dt>Líneas</dt><dd data-recreo-lineas>0</dd></div>
        <div><dt>Nivel</dt><dd data-recreo-nivel>1</dd></div>
        <div><dt>Récord</dt><dd data-recreo-record>0</dd></div>
      </dl>
    </div>
  </div>
  <div class="recreo-controles" data-recreo-controles>${botones}</div>
  <p class="recreo-ayuda" id="recreo-ayuda"><span><kbd>←</kbd> <kbd>→</kbd> mover</span> · <span><kbd>↑</kbd> girar</span> · <span><kbd>↓</kbd> bajar</span> · <span><kbd>Espacio</kbd> soltar</span> · <span><kbd>C</kbd> guardar</span> · <span><kbd>P</kbd> pausa</span> · <span><kbd>Esc</kbd> salir</span></p>
  <p class="sr-only" aria-live="polite" data-recreo-voz></p>
</div>
<canvas class="recreo-vuelo" data-recreo-vuelo aria-hidden="true"></canvas>`;
    document.body.append(dialogo);
    const $ = (selector) => dialogo.querySelector(selector);
    const lienzo = $("[data-recreo-lienzo]");
    const siguiente = $("[data-recreo-siguiente]");
    const guardada = $("[data-recreo-guardada]");
    const vuelo = $("[data-recreo-vuelo]");
    const fondo = document.createElement("canvas");
    const v = {
      dialogo,
      hoja: $("[data-recreo-hoja]"),
      tablero: $("[data-recreo-tablero]"),
      lienzo,
      ctx: lienzo.getContext("2d"),
      fondo, // la cuadrícula y las casillas fijas, que cambian sólo al fijar una pieza o borrar filas
      ctxFondo: fondo.getContext("2d"),
      fondoDe: "",
      siguiente,
      ctxSiguiente: siguiente.getContext("2d"),
      guardada,
      ctxGuardada: guardada.getContext("2d"),
      lienzoVuelo: vuelo,
      ctxVuelo: vuelo.getContext("2d"),
      aviso: $("[data-recreo-aviso]"),
      avisoTitulo: $("[data-recreo-aviso-titulo]"),
      avisoTexto: $("[data-recreo-aviso-texto]"),
      seguir: $("[data-recreo-seguir]"),
      pausa: $("[data-recreo-pausa]"),
      cerrar: $("[data-recreo-cerrar]"),
      controles: $("[data-recreo-controles]"),
      voz: $("[data-recreo-voz]"),
      datos: { puntaje: $("[data-recreo-puntaje]"), lineas: $("[data-recreo-lineas]"), nivel: $("[data-recreo-nivel]"), record: $("[data-recreo-record]") },
      quieto: window.matchMedia("(prefers-reduced-motion: reduce)"),
      juego: null,
      partida: 0,
      artes: [], // una por lámina: { lienzo, mapa, recortes }
      vuelo: null,
      c: 24, // lado de una casilla, en px CSS
      m: 14, // lado de una casilla de las piezas de al costado
      dpr: 1,
      raf: 0,
      antes: 0,
      sucio: true,
      abajo: false, // ↓ sostenida
      lado: { dir: 0, espera: 0, sostenidas: [] }, // ← y → sostenidas
      alCerrar: null,
      mostrado: "",
      finEn: 0,
      recordNuevo: false,
    };

    v.seguir.addEventListener("click", () => {
      const { juego } = v;
      if (juego.estado === "listo") {
        terminarVuelo();
        motor.empezar(juego);
      } else if (juego.estado === "pausa") motor.pausar(juego, false);
      // Un Espacio de más justo al perder no empieza otro juego antes de ver el puntaje
      else if (juego.estado === "fin" && performance.now() - v.finEn > 700) nuevoJuego(true);
      else return;
      enfocarTablero();
      actualizar();
    });
    v.pausa.addEventListener("click", () => {
      alternarPausa();
      if (v.juego.estado === "jugando") enfocarTablero();
    });
    v.cerrar.addEventListener("click", cerrar);
    dialogo.addEventListener("cancel", (event) => {
      event.preventDefault();
      cerrar();
    });
    dialogo.addEventListener("close", alCerrarse);
    dialogo.addEventListener("keydown", teclaAbajo);
    dialogo.addEventListener("keyup", teclaArriba);

    // Los botones táctiles actúan al apoyar el dedo (sin esperar el clic) y las flechas repiten mientras se sostienen
    const soltarControl = (event) => {
      const boton = event.target.closest?.("[data-accion]");
      if (boton) control(boton.dataset.accion, false);
    };
    v.controles.addEventListener("pointerdown", (event) => {
      const boton = event.target.closest("[data-accion]");
      if (!boton) return;
      event.preventDefault();
      boton.setPointerCapture?.(event.pointerId);
      control(boton.dataset.accion, true);
    });
    v.controles.addEventListener("pointerup", soltarControl);
    v.controles.addEventListener("pointercancel", soltarControl);
    v.controles.addEventListener("lostpointercapture", soltarControl);
    // Con el teclado (Enter o Espacio sobre el botón) el clic llega sin puntero: un paso
    v.controles.addEventListener("click", (event) => {
      const boton = event.target.closest("[data-accion]");
      if (!boton || event.detail !== 0) return;
      control(boton.dataset.accion, true);
      control(boton.dataset.accion, false);
    });
    v.controles.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("resize", () => dialogo.open && medir());
    window.addEventListener("blur", () => dialogo.open && pausarSolo());
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && dialogo.open && pausarSolo());
    return v;
  }

  const enfocarTablero = () => vista.tablero.focus({ preventScroll: true });

  function nuevoJuego(empezar = false) {
    const record = Math.max(leerRecord(), vista.juego?.record ?? 0);
    vista.juego = motor.crear({ record, largoCola: vista.artes.length });
    vista.partida += 1;
    vista.lado = { dir: 0, espera: 0, sostenidas: [] };
    vista.abajo = false;
    vista.recordNuevo = false;
    if (empezar) motor.empezar(vista.juego);
    vista.sucio = true;
  }

  /** Abre el recreo con las láminas de la página: { img, recorte, x, y, lado, filtro, sombra } de cada una; la primera
      es la del doble clic. Con transformar, las toma donde están, las recorta en piezas y en el aire se dan vuelta a su
      figura; si no, el juego aparece de una vez. alCerrar se llama al cerrarse, por el botón, Escape o el navegador. */
  function abrir({ laminas = [], transformar = false, alCerrar = null } = {}) {
    if (!vista) vista = armar();
    if (vista.dialogo.open) return;
    vista.alCerrar = alCerrar;
    const tomadas = laminas.filter((l) => l.img?.naturalWidth > 0);
    const conVuelo = transformar && tomadas.length > 0 && !vista.quieto.matches;
    // La obra de cada lámina sólo hace falta para el vuelo: en el juego las piezas son figuras
    vista.artes = conVuelo ? tomadas.map(arte) : [];
    nuevoJuego();
    const raiz = document.documentElement;
    // Sin la barra de desplazamiento la página no se corre: el ancho que deja libre se devuelve como relleno
    const barra = window.innerWidth - raiz.clientWidth;
    if (barra > 0) raiz.style.setProperty("--barra", `${barra}px`);
    raiz.classList.add("con-recreo");
    vista.dialogo.classList.remove("is-cerrando");
    vista.dialogo.toggleAttribute("data-transforma", conVuelo);
    vista.dialogo.showModal();
    medir();
    vista.vuelo = null;
    if (conVuelo) prepararVuelo(tomadas);
    vista.hoja.toggleAttribute("data-vuelo", Boolean(vista.vuelo));
    actualizar();
    vista.seguir.focus();
    vista.antes = 0;
    // El primer cuadro va ahora: en este mismo cuadro la página esconde sus láminas
    cuadro(performance.now(), false);
    vista.raf = requestAnimationFrame(cuadro);
  }

  function cerrar() {
    const { dialogo } = vista;
    if (!dialogo.open) return;
    if (dialogo.classList.contains("is-cerrando") || vista.quieto.matches) {
      dialogo.close();
      return;
    }
    terminarVuelo();
    dialogo.classList.add("is-cerrando");
    let listo = false;
    const fin = () => {
      if (listo) return;
      listo = true;
      if (dialogo.open) dialogo.close();
    };
    vista.hoja.addEventListener("animationend", fin, { once: true });
    setTimeout(fin, 320);
  }

  function alCerrarse() {
    cancelAnimationFrame(vista.raf);
    vista.vuelo = null;
    vista.dialogo.classList.remove("is-cerrando");
    const raiz = document.documentElement;
    raiz.classList.remove("con-recreo");
    raiz.style.removeProperty("--barra");
    const { juego } = vista;
    if (juego && juego.record > leerRecord()) escribirRecord(juego.record);
    const alCerrar = vista.alCerrar;
    vista.alCerrar = null;
    alCerrar?.();
  }

  function alternarPausa() {
    const { juego } = vista;
    if (juego.estado === "jugando") pausarSolo();
    else if (juego.estado === "pausa") motor.pausar(juego, false);
    actualizar();
  }

  /** Pausa por la página (otra pestaña, otra ventana) o a pedido: se sueltan las teclas sostenidas. */
  function pausarSolo() {
    vista.abajo = false;
    vista.lado = { dir: 0, espera: 0, sostenidas: [] };
    if (motor.pausar(vista.juego, true)) {
      vista.voz.textContent = "En pausa.";
      actualizar();
    }
  }

  /* Flechas sostenidas: un paso al apoyar, y después de DAS ms, uno cada ARR ms. Manda la última que se apoyó. */
  function apoyar(dir) {
    const { lado } = vista;
    lado.sostenidas = lado.sostenidas.filter((d) => d !== dir).concat(dir);
    lado.dir = dir;
    lado.espera = -DAS;
    motor.mover(vista.juego, dir);
  }
  function levantar(dir) {
    const { lado } = vista;
    lado.sostenidas = lado.sostenidas.filter((d) => d !== dir);
    if (lado.dir !== dir) return;
    lado.dir = lado.sostenidas.at(-1) ?? 0;
    lado.espera = -DAS;
  }
  function repetir(ms) {
    const { lado, juego } = vista;
    if (!lado.dir || juego.estado !== "jugando") return;
    lado.espera += ms;
    while (lado.espera >= ARR) {
      lado.espera -= ARR;
      if (!motor.mover(juego, lado.dir)) {
        lado.espera = 0;
        break;
      }
    }
  }

  function control(accion, apoyado) {
    const { juego } = vista;
    if (accion === "izquierda" || accion === "derecha") {
      const dir = accion === "izquierda" ? -1 : 1;
      if (apoyado) apoyar(dir);
      else levantar(dir);
    } else if (accion === "bajar") {
      vista.abajo = apoyado && juego.estado === "jugando";
      if (apoyado) motor.bajar(juego);
    } else if (apoyado) {
      if (accion === "girar") motor.girar(juego, 1);
      else if (accion === "soltar") motor.soltar(juego);
      else if (accion === "guardar") motor.guardar(juego);
    }
    vista.sucio = true;
  }

  // Las teclas por su lugar en el teclado (event.code), así Z y X quedan juntas en cualquier distribución
  const TECLAS = {
    ArrowLeft: "izquierda",
    ArrowRight: "derecha",
    ArrowDown: "bajar",
    ArrowUp: "girar",
    KeyX: "girar",
    KeyZ: "antihorario",
    ControlLeft: "antihorario",
    ControlRight: "antihorario",
    Space: "soltar",
    KeyC: "guardar",
    ShiftLeft: "guardar",
    ShiftRight: "guardar",
    KeyP: "pausa",
  };
  const tecla = (event) => TECLAS[event.code] ?? TECLAS[event.key] ?? null;

  function teclaAbajo(event) {
    if (event.metaKey || event.altKey || (event.ctrlKey && !event.code?.startsWith("Control"))) return;
    const accion = tecla(event);
    if (!accion) return;
    const { juego } = vista;
    if (accion === "pausa") {
      event.preventDefault();
      if (!event.repeat) alternarPausa();
      if (juego.estado === "jugando") enfocarTablero();
      else vista.seguir.focus();
      return;
    }
    // Fuera del juego, Enter y Espacio son de los botones
    if (juego.estado !== "jugando") return;
    event.preventDefault();
    if (accion === "bajar") {
      if (!vista.abajo) motor.bajar(juego);
      vista.abajo = true;
    } else if (!event.repeat) {
      if (accion === "antihorario") motor.girar(juego, -1);
      else control(accion, true);
    }
    vista.sucio = true;
  }

  function teclaArriba(event) {
    const accion = tecla(event);
    if (accion === "izquierda" || accion === "derecha" || accion === "bajar") control(accion, false);
  }

  /** El lado de la casilla sale del espacio que la hoja le deja al tablero (inicio.css lo calcula con la pantalla). Se
      mide sin transformaciones: la hoja puede venir entrando. */
  function medir() {
    const { clientWidth: ancho, clientHeight: alto } = vista.tablero;
    const c = Math.max(8, Math.floor(Math.min(ancho / COLUMNAS, alto / FILAS)));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const m = Math.max(8, Math.round(c * 0.46));
    const lienzo = (canvas, w, h) => {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    lienzo(vista.lienzo, c * COLUMNAS, c * FILAS);
    vista.fondo.width = vista.lienzo.width;
    vista.fondo.height = vista.lienzo.height;
    lienzo(vista.siguiente, m * 4.5, m * 9);
    lienzo(vista.guardada, m * 4.5, m * 3);
    lienzo(vista.lienzoVuelo, window.innerWidth, window.innerHeight);
    vista.hoja.style.setProperty("--recreo-mini", `${m * 4.5}px`);
    Object.assign(vista, { c, m, dpr, mostrado: "", fondoDe: "" });
    vista.sucio = true;
    dibujar();
  }

  function cuadro(ahora, seguir = true) {
    if (!vista.dialogo.open) return;
    const ms = vista.antes ? Math.min(100, ahora - vista.antes) : 16;
    vista.antes = ahora;
    const { juego } = vista;
    const antes = `${juego.estado}|${juego.pieza?.x},${juego.pieza?.y},${juego.pieza?.giro}|${juego.puntaje}`;
    repetir(ms);
    motor.avanzar(juego, ms, vista.abajo);
    contar();
    if (antes !== `${juego.estado}|${juego.pieza?.x},${juego.pieza?.y},${juego.pieza?.giro}|${juego.puntaje}`) vista.sucio = true;
    if (vista.vuelo) dibujarVuelo(ahora);
    if (vista.sucio || juego.limpiando) dibujar();
    if (seguir) vista.raf = requestAnimationFrame(cuadro);
  }

  /** Lo que pasó en el motor se cuenta al lector de pantalla y al récord. */
  function contar() {
    const { juego } = vista;
    if (!juego.eventos.length) return;
    for (const evento of juego.eventos.splice(0)) {
      if (evento.tipo === "nivel") vista.voz.textContent = `Nivel ${evento.nivel}.`;
      if (evento.tipo === "fin") {
        vista.finEn = performance.now();
        vista.recordNuevo = evento.record;
        if (evento.record) escribirRecord(juego.record);
        vista.voz.textContent = `Fin del recreo. Puntaje ${numero(evento.puntaje)}.`;
      }
    }
    actualizar();
  }

  /** Aviso sobre la hoja, botón de pausa y marcador, según el estado. */
  function actualizar() {
    const { juego } = vista;
    const textos = {
      listo: ["Completa filas", "Cada diez líneas, las piezas caen más rápido.", "Empezar"],
      pausa: ["En pausa", "", "Seguir"],
      fin: ["Fin del recreo", `Puntaje ${numero(juego.puntaje)}${vista.recordNuevo ? " · récord nuevo" : ""}`, "Otra vez"],
    }[juego.estado];
    const estaba = !vista.aviso.hidden;
    vista.aviso.hidden = !textos;
    vista.aviso.dataset.estado = juego.estado;
    if (textos) {
      [vista.avisoTitulo.textContent, vista.avisoTexto.textContent, vista.seguir.textContent] = textos;
      vista.avisoTexto.hidden = !textos[1];
      if (!estaba && document.activeElement === vista.tablero) vista.seguir.focus();
    }
    vista.pausa.disabled = juego.estado !== "jugando" && juego.estado !== "pausa";
    vista.pausa.textContent = juego.estado === "pausa" ? "Seguir" : "Pausa";
    vista.sucio = true;
  }

  /* ——— Vuelo: de lámina a pieza ——— */
  /** Un canvas de w × h px CSS a la densidad dada (la de la pantalla, o menos para una sombra), con su contexto ya
      escalado. */
  function hoja(w, h, dpr = vista.dpr) {
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.ceil(w * dpr));
    lienzo.height = Math.max(1, Math.ceil(h * dpr));
    const ctx = lienzo.getContext("2d");
    ctx.scale(dpr, dpr);
    return [lienzo, ctx];
  }

  /** Cada lámina recibe la pieza que le toca en la cola (la del doble clic, la primera). Lo que cuesta dibujar se dibuja
      una sola vez: el sobrante (la lámina sin la pieza) con su sombra, la sombra de la pieza y, si la lámina venía con
      filtro, la pieza filtrada. En cada cuadro sólo se mueven esas imágenes. */
  function prepararVuelo(laminas) {
    const { juego, dpr } = vista;
    vista.vuelo = {
      inicio: performance.now(),
      llegaron: new Set(),
      piezas: laminas.map((l, i) => {
        const entrada = juego.cola[i];
        const r = recorte(vista.artes[i], entrada.tipo);
        const t0 = r.lado * l.lado;
        const forma = FORMAS[entrada.tipo][0];
        const borde = Math.ceil(l.sombra.desenfoque * 2 + Math.max(Math.abs(l.sombra.x), Math.abs(l.sombra.y)) * 2);
        const filtro = l.filtro && l.filtro !== "none" ? l.filtro : "";
        const silueta = (ctx, ox, oy) => forma.forEach(([cx, cy]) => ctx.rect(ox + (cx - r.x0) * t0, oy + (cy - r.y0) * t0, t0, t0));

        // El sobrante
        const [sobrante, cs] = hoja(l.lado, l.lado);
        if (filtro) cs.filter = filtro;
        cs.drawImage(l.img, 0, 0, l.lado, l.lado);
        cs.filter = "none";
        cs.globalCompositeOperation = "destination-out";
        cs.beginPath();
        silueta(cs, r.ox * l.lado, r.oy * l.lado);
        cs.fill();
        // Las sombras, del sobrante y de la pieza: una silueta desenfocada no necesita la densidad de la pantalla. La
        // silueta se dibuja fuera del canvas y sólo su sombra cae adentro
        const sombraDe = (w, h, dibujar) => {
          const [lienzo, cp] = hoja(w + 2 * borde, h + 2 * borde, DENSIDAD_SOMBRA);
          const lejos = 10000;
          cp.shadowColor = `rgba(31,42,61,${l.sombra.opacidad})`;
          cp.shadowBlur = l.sombra.desenfoque * 2 * DENSIDAD_SOMBRA;
          cp.shadowOffsetX = lejos * DENSIDAD_SOMBRA;
          cp.translate(borde - lejos, borde);
          dibujar(cp);
          return lienzo;
        };
        const sombraSobrante = sombraDe(l.lado, l.lado, (cp) => cp.drawImage(sobrante, 0, 0, l.lado, l.lado));
        const sombraPieza = sombraDe(r.w * t0, r.h * t0, (cp) => {
          cp.fillStyle = "#000";
          cp.beginPath();
          silueta(cp, 0, 0);
          cp.fill();
        });

        // La pieza con el filtro de su lámina, para soltarlo en el aire
        let filtrada = null;
        if (filtro) {
          const [lienzo, cf] = hoja(r.w * t0, r.h * t0);
          cf.filter = filtro;
          cf.drawImage(l.img, -r.ox * l.lado, -r.oy * l.lado, l.lado, l.lado);
          cf.filter = "none";
          cf.globalCompositeOperation = "destination-in";
          cf.beginPath();
          silueta(cf, 0, 0);
          cf.fill();
          filtrada = lienzo;
        }
        return {
          i,
          l,
          entrada,
          r,
          t0,
          borde,
          x0: l.x + r.ox * l.lado,
          y0: l.y + r.oy * l.lado,
          sobrante,
          sombraSobrante,
          sombraPieza,
          filtrada,
          contorno: contorno(entrada.tipo),
          destino: i === 0 ? "tablero" : i <= 3 ? i - 1 : "pila",
          giro: (i % 2 ? 1 : -1) * (5 + (i % 3) * 4),
          lado: l.x + l.lado / 2 < window.innerWidth / 2 ? -1 : 1,
          fin: false,
        };
      }),
    };
  }

  function terminarVuelo() {
    if (!vista?.vuelo) return;
    vista.vuelo = null;
    vista.ctxVuelo.setTransform(1, 0, 0, 1, 0, 0);
    vista.ctxVuelo.clearRect(0, 0, vista.lienzoVuelo.width, vista.lienzoVuelo.height);
    vista.hoja.removeAttribute("data-vuelo");
    vista.mostrado = "";
    vista.sucio = true;
  }

  const llego = (n) => !vista.vuelo || vista.vuelo.llegaron.has(n);

  function dibujarVuelo(ahora) {
    const v = vista.vuelo;
    const { ctxVuelo: ctx, dpr, c, m } = vista;
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";
    const t = ahora - v.inicio;
    const tablero = vista.lienzo.getBoundingClientRect();
    const costado = vista.siguiente.getBoundingClientRect();
    let quedan = 0;
    // La del doble clic, encima de todas
    for (let idx = v.piezas.length - 1; idx >= 0; idx -= 1) {
      const p = v.piezas[idx];
      if (p.fin) continue;
      quedan += 1;
      const { l, r, entrada, borde } = p;
      const tc = t - p.i * VUELO.escalonCorte;
      const corte = smooth(span(tc, 0, VUELO.corte));
      const ks = span(tc, ...VUELO.sobrante);
      const e = easeInOut(span(t - VUELO.parte - p.i * VUELO.escalon, 0, VUELO.viaje));

      // El sobrante cae, gira un poco hacia afuera y se desvanece
      if (ks < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - smooth(span(ks, 0.15, 0.8));
        ctx.translate(l.x + l.lado / 2, l.y + l.lado / 2 + ks * ks * H * 0.55);
        ctx.rotate((p.lado * ks * 16 * Math.PI) / 180);
        // La sombra se aleja a medida que cae
        ctx.drawImage(p.sombraSobrante, -l.lado / 2 - borde + l.sombra.x * (1 + ks), -l.lado / 2 - borde + l.sombra.y * (1 + ks), l.lado + 2 * borde, l.lado + 2 * borde);
        ctx.drawImage(p.sobrante, -l.lado / 2, -l.lado / 2, l.lado, l.lado);
        ctx.restore();
      }

      // Adónde va: al tablero, donde nace; al costado, a su lugar en «Siguiente»; las demás, detrás de la última
      let dx;
      let dy;
      let dt;
      let alfa = 1;
      if (p.destino === "tablero") {
        const pos = nacimiento(entrada.tipo);
        dt = c;
        dx = tablero.left + (pos.x + r.x0) * c;
        dy = tablero.top + (pos.y + r.y0 - OCULTAS) * c;
      } else {
        const [mx, my] = posMini(entrada.tipo, p.destino === "pila" ? 2 : p.destino, m);
        dt = m;
        dx = costado.left + mx;
        dy = costado.top + my;
        if (p.destino === "pila") {
          dt = m * 0.7;
          dy += m * 1.4;
          dx += (r.w * m * 0.3) / 2;
          alfa = 1 - smooth(span(e, 0.45, 1));
        }
      }
      const ts = lerp(p.t0, dt, e);
      const k = ts / p.t0;
      const x = lerp(p.x0, dx, e);
      const y = lerp(p.y0, dy, e) - Math.sin(Math.PI * e) * Math.min(140, H * 0.14);
      const alto = 1 - e + Math.sin(Math.PI * e) * 0.7; // altura sobre la mesa: aleja la sombra
      // En el aire la lámina se da vuelta, como las de la portada: detrás está su figura, la pieza del juego
      const vuelta = span(e, 0.12, 0.52);
      const cara = vuelta < 0.5;
      ctx.save();
      ctx.globalAlpha = alfa;
      const mx = x + (r.w * ts) / 2;
      const my = y + (r.h * ts) / 2;
      ctx.translate(mx, my);
      ctx.rotate((Math.sin(Math.PI * e) * p.giro * Math.PI) / 180);
      ctx.scale(Math.max(0.02, Math.abs(Math.cos(Math.PI * vuelta))), 1);
      ctx.translate(-mx, -my);
      if (alto > 0.02) {
        ctx.save();
        ctx.globalAlpha = alfa * Math.min(1, alto);
        const sx = l.sombra.x * alto;
        const sy = l.sombra.y * alto;
        ctx.drawImage(p.sombraPieza, x + sx - borde * k, y + sy - borde * k, (r.w * p.t0 + 2 * borde) * k, (r.h * p.t0 + 2 * borde) * k);
        ctx.restore();
      }
      dibujarCasillas(ctx, casillasDe(entrada), ts, x, y, cara ? 0 : 1, cara);
      // Las láminas del fondo llevan su filtro hasta darse vuelta
      if (p.filtrada && cara) ctx.drawImage(p.filtrada, x, y, r.w * ts, r.h * ts);
      // La línea del recorte, a tinta, que se dibuja de una vez alrededor de la pieza y se borra al partir
      const tinta = 1 - smooth(span(e, 0, 0.35));
      if (corte > 0 && tinta > 0) {
        ctx.save();
        ctx.globalAlpha = alfa * tinta;
        ctx.strokeStyle = TINTA;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        let largo = 0;
        ctx.beginPath();
        p.contorno.forEach(([px, py], n) => {
          const [qx, qy] = p.contorno[(n + 1) % p.contorno.length];
          largo += Math.hypot(qx - px, qy - py) * ts;
          if (n) ctx.lineTo(x + px * ts, y + py * ts);
          else ctx.moveTo(x + px * ts, y + py * ts);
        });
        ctx.closePath();
        ctx.setLineDash([largo * corte, largo]);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      if (e >= 1) {
        p.fin = true;
        if (p.destino !== "pila") v.llegaron.add(entrada.n);
        vista.mostrado = "";
        vista.sucio = true;
      }
    }
    if (!quedan) terminarVuelo();
  }

  /* ——— Dibujo del tablero ——— */
  function pintarFondo() {
    const { juego, ctxFondo: ctx, c, dpr } = vista;
    const ancho = c * COLUMNAS;
    const alto = c * FILAS;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    // La cuadrícula, sola sobre la mesa: sus bordes son las paredes
    ctx.strokeStyle = LINEA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLUMNAS; x += 1) {
      const px = Math.min(ancho - 0.5, x * c + 0.5);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, alto);
    }
    for (let y = 0; y <= FILAS; y += 1) {
      const py = Math.min(alto - 0.5, y * c + 0.5);
      ctx.moveTo(0, py);
      ctx.lineTo(ancho, py);
    }
    ctx.stroke();
    ctx.imageSmoothingQuality = "high";
    const fijas = [];
    for (let y = OCULTAS; y < OCULTAS + FILAS; y += 1) {
      juego.tablero[y].forEach((celda, x) => celda && fijas.push([x, y - OCULTAS, celda.tipo, celda.n, celda.k, celda.giro]));
    }
    dibujarCasillas(ctx, fijas, c);
  }

  function dibujar() {
    const { juego, ctx, c, dpr } = vista;
    if (!juego) return;
    vista.sucio = false;
    const ancho = c * COLUMNAS;
    const clave = `${vista.partida}|${juego.cambios}|${c}|${dpr}`;
    if (clave !== vista.fondoDe) {
      pintarFondo();
      vista.fondoDe = clave;
    }
    // Sin hoja detrás el canvas es transparente: se borra el cuadro anterior antes de poner la cuadrícula
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, vista.lienzo.width, vista.lienzo.height);
    ctx.drawImage(vista.fondo, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Las filas completas se marcan con el destacador antes de irse: un trazo que barre de izquierda a derecha
    if (juego.limpiando) {
      const avance = vista.quieto.matches ? 1 : Math.min(1, (1 - juego.limpiando.resta / juego.pausaLineas) * 1.8);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = LAPIZ;
      juego.limpiando.filas.forEach((y) => {
        if (y >= OCULTAS) ctx.fillRect(0, (y - OCULTAS) * c + c * 0.08, ancho * avance, c * 0.84);
      });
      ctx.restore();
      vista.sucio = true;
    }

    if (juego.pieza) {
      // Dónde caería: el contorno a lápiz
      const sombra = fantasma(juego);
      if (sombra && sombra.y !== juego.pieza.y) {
        ctx.save();
        ctx.strokeStyle = GRAFITO;
        ctx.lineWidth = Math.max(1, c / 22);
        ctx.setLineDash([Math.max(2, c / 6), Math.max(2, c / 8)]);
        const g = Math.max(2, Math.round(c / 8));
        celdas(sombra).forEach(([x, y]) => y >= OCULTAS && ctx.strokeRect(x * c + g, (y - OCULTAS) * c + g, c - 2 * g, c - 2 * g));
        ctx.restore();
      }
      dibujarPieza(ctx, juego.pieza, c);
    } else if (juego.estado === "listo" && llego(juego.cola[0].n)) {
      // Antes de empezar, la primera pieza espera donde va a nacer
      dibujarPieza(ctx, { ...juego.cola[0], giro: 0, ...nacimiento(juego.cola[0].tipo) }, c);
    }

    // Al costado: las tres que siguen y la guardada (apagada mientras no se puede cambiar)
    const { m, ctxSiguiente, ctxGuardada } = vista;
    const siguen = juego.cola.slice(juego.estado === "listo" ? 1 : 0).slice(0, 3);
    const mostrado = `${vista.partida}|${siguen.map((e) => (llego(e.n) ? e.n : "·")).join(",")}|${juego.guardada?.n}|${juego.puedeGuardar}|${m}|${dpr}`;
    if (mostrado !== vista.mostrado) {
      vista.mostrado = mostrado;
      ctxSiguiente.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxSiguiente.clearRect(0, 0, m * 4.5, m * 9);
      ctxSiguiente.imageSmoothingQuality = "high";
      siguen.forEach((entrada, j) => llego(entrada.n) && mini(ctxSiguiente, entrada, j, m));
      ctxGuardada.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxGuardada.clearRect(0, 0, m * 4.5, m * 3);
      if (juego.guardada) {
        ctxGuardada.globalAlpha = juego.puedeGuardar ? 1 : 0.35;
        mini(ctxGuardada, juego.guardada, 0, m);
        ctxGuardada.globalAlpha = 1;
      }
    }
    const { datos } = vista;
    datos.puntaje.textContent = numero(juego.puntaje);
    datos.lineas.textContent = numero(juego.lineas);
    datos.nivel.textContent = numero(juego.nivel);
    datos.record.textContent = numero(Math.max(juego.record, juego.puntaje));
  }

  window.pteronRecreo = { motor, abrir, cerrar: () => vista && cerrar() };
})();
