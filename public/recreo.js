/* pteron · recreo (2026-10-25.8)
   El huevo de pascua del inicio. Dos clics (o dos toques) seguidos en una lámina: las letras de la portada se van, las
   láminas se quedan quietas e inicio.js carga este archivo, que las toma donde están y las recorta en piezas. Cada
   lámina deja caer el sobrante de su recorte y la pieza vuela a su lugar con su trozo de la obra: la del doble clic a la
   cuadrícula, las que siguen al costado y las demás se apilan detrás. Cada pieza nueva lleva la obra de una lámina.
   1. El motor: tablero de 10 × 20, bolsa de siete, giros con las patadas de SRS, espera en el suelo, guardar, líneas,
      giros de la T, combos, jugadas seguidas, puntaje y niveles. Es puro (no toca el documento) y se prueba sin
      navegador: window.pteronRecreo.motor. Cada pieza lleva un número de serie; la vista le da la lámina que le toca.
   2. La vista: un <dialog> con tres tarjetas sobre la mesa (la cuadrícula al centro; la guardada y el marcador a un
      lado; las que siguen y los controles al otro), un canvas para el tablero y otro, encima de todo, para el vuelo.
      Teclado: ← → mover, ↑ o X rotar, Z rotar al revés, ↓ bajar, Espacio caída rápida, C guardar, P pausa y Esc salir;
      en pantallas táctiles, botones bajo el tablero. Con movimiento reducido no hay vuelo ni animaciones de adorno: el
      juego aparece de una vez, con las piezas ya recortadas. */
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
  // Puntos por una, dos, tres o cuatro filas a la vez, por el nivel; los giros de la T valen más (con cero filas también)
  const PUNTOS = [0, 100, 300, 500, 800];
  const PUNTOS_T = [400, 800, 1200, 1600];
  const PUNTOS_MINI = [100, 200, 400];
  const COMBO = 50; // por cada pieza seguida que borra filas, por el nivel

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
      giro: null, // { patada } si lo último que hizo la pieza fue girar: así se reconocen los giros de la T
      combo: -1, // piezas seguidas que borran filas, menos una
      dificil: false, // la última jugada con filas fue de cuatro o un giro de la T: la siguiente igual vale más
      limpiando: null, // { filas, resta }: filas completas, todavía destacadas
      eventos: [], // lo que la vista tiene que contar: líneas, jugadas, nivel y fin
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
    juego.giro = null;
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
    juego.giro = null;
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
    juego.giro = null;
    if (suelo || enSuelo(juego)) tocar(juego);
    return true;
  }

  /** Gira en sentido horario (dir = 1) o antihorario (dir = −1), probando las patadas en orden. */
  function girar(juego, dir = 1) {
    if (!activo(juego)) return false;
    const actual = juego.pieza;
    const giro = (actual.giro + (dir > 0 ? 1 : 3)) % 4;
    const suelo = enSuelo(juego);
    for (const [i, [px, py]] of patadas(actual.tipo, actual.giro, dir).entries()) {
      const pieza = { ...actual, giro, x: actual.x + px, y: actual.y - py };
      if (choca(juego, pieza)) continue;
      juego.pieza = pieza;
      juego.giro = { patada: i };
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

  /** Si la T quedó fija girando a un hueco: tres de las cuatro esquinas de su caja ocupadas (las paredes y el suelo
      cuentan). Es completo si están las dos del lado al que apunta, o si entró con la última patada; si no, mini. */
  function giroDeT(juego, pieza) {
    if (pieza.tipo !== "T" || !juego.giro) return null;
    const ocupada = ([x, y]) => x < 0 || x >= COLUMNAS || y >= ALTO || (y >= 0 && juego.tablero[y][x] !== null);
    const esquinas = [[0, 0], [2, 0], [2, 2], [0, 2]].map(([x, y]) => ocupada([pieza.x + x, pieza.y + y]));
    if (esquinas.filter(Boolean).length < 3) return null;
    // Las dos esquinas del frente: arriba (giro 0), a la derecha, abajo y a la izquierda
    const frente = [[0, 1], [1, 2], [2, 3], [3, 0]][pieza.giro];
    return frente.every((i) => esquinas[i]) || juego.giro.patada === 4 ? "t" : "mini";
  }

  function fijar(juego) {
    const { pieza, tablero } = juego;
    let giroT = giroDeT(juego, pieza);
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
    const nivel = juego.nivel;
    const n = filas.length;
    if (giroT === "mini" && n > 2) giroT = "t"; // tres filas con la T sólo se hacen con un giro completo
    let puntos = (giroT === "t" ? PUNTOS_T : giroT === "mini" ? PUNTOS_MINI : PUNTOS)[n] * nivel;
    // Cuatro filas o un giro de la T con filas, justo después de otra jugada así: vale una vez y media. Una jugada
    // con filas que no es de esas corta la cadena; un giro sin filas no la corta
    const dificil = n === 4 || (n > 0 && giroT !== null);
    const seguidas = dificil && juego.dificil;
    if (seguidas) puntos = Math.floor(puntos * 1.5);
    if (n > 0) juego.dificil = dificil;
    juego.combo = n > 0 ? juego.combo + 1 : -1;
    if (juego.combo > 0) puntos += COMBO * juego.combo * nivel;
    juego.puntaje += puntos;
    if (n === 4 || giroT || juego.combo > 0) {
      juego.eventos.push({ tipo: "jugada", filas: n, giro: giroT, seguidas, combo: Math.max(0, juego.combo), puntos });
    }
    if (!n) {
      nacer(juego);
      return;
    }
    juego.lineas += n;
    juego.nivel = 1 + Math.floor(juego.lineas / 10);
    juego.eventos.push({ tipo: "lineas", filas, n });
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
  // Cada pieza lleva la obra de la lámina que le toca, recortada a su forma. Si ninguna lámina llegó a cargar, cada una
  // es una figura de pteron de un solo color
  const COLORES = { I: "#1E3F94", O: "#F0C060", T: "#6B4C9A", S: "#2F8A5B", Z: "#C0492F", J: "#7F9BD6", L: "#B7791F" };
  const TINTA = "#1F2A3D";
  const CUADRICULA = "#D3DAE3";
  const CLAVE = "pteron:recreo:record";
  const DAS = 160; // ms antes de que una flecha sostenida repita
  const ARR = 40; // ms entre repeticiones
  // El vuelo, en ms: la línea del recorte, el sobrante que cae, cuándo parten y cuánto tardan en llegar
  const VUELO = { escalonCorte: 24, corte: 320, sobrante: [220, 900], parte: 640, escalon: 38, viaje: 760 };
  const DENSIDAD_SOMBRA = 0.4;
  // Las sombras, en casillas: la pieza que cae flota sobre la cuadrícula, las fijas están apoyadas y apenas se despegan,
  // y las de al costado esperan como láminas sobre la mesa
  const SOMBRA = {
    cae: { y: 0.2, blur: 0.6, alfa: 0.34 },
    fija: { y: 0.05, blur: 0.2, alfa: 0.28 },
    costado: { y: 0.18, blur: 0.55, alfa: 0.3 },
  };
  const LEJOS = 10000; // la silueta de una sombra se dibuja fuera del canvas y sólo su sombra cae adentro

  // Los botones táctiles, bajo el tablero
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
    ["girar", "Rotar"],
    ["soltar", "Caída rápida"],
  ];
  // Los controles del teclado, como teclas
  const FLECHAS = {
    izquierda: ['<path d="M19 12H5M11 6l-6 6 6 6"/>', "Flecha izquierda"],
    derecha: ['<path d="M5 12h14M13 6l6 6-6 6"/>', "Flecha derecha"],
    abajo: ['<path d="M12 5v14M6 13l6 6 6-6"/>', "Flecha abajo"],
    arriba: ['<path d="M12 19V5M6 11l6-6 6 6"/>', "Flecha arriba"],
  };
  const AYUDA = [
    [["izquierda", "derecha"], "Mover"],
    [["abajo"], "Bajar"],
    [["arriba"], "Rotar"],
    [["Espacio"], "Caída rápida"],
    [["C"], "Guardar"],
  ];
  const kbd = (tecla) =>
    FLECHAS[tecla]
      ? `<kbd class="recreo-tecla"><svg viewBox="0 0 24 24" aria-hidden="true">${FLECHAS[tecla][0]}</svg><span class="sr-only">${FLECHAS[tecla][1]}</span></kbd>`
      : `<kbd class="recreo-tecla${tecla.length > 3 ? " recreo-tecla-ancha" : ""}">${tecla}</kbd>`;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const span = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const numero = (n) => n.toLocaleString("es-CL");
  /** Una sombra de SOMBRA en px, para casillas de lado t; alfa la puede apagar. */
  const sombraDe = ({ y, blur, alfa }, t, k = 1) => ({ y: y * t, blur: blur * t, alfa: alfa * k });
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

  /** La caja de una pieza en un giro: desde qué casilla empieza y cuántas mide. */
  function caja(tipo, giro = 0) {
    const forma = FORMAS[tipo][giro];
    const xs = forma.map(([x]) => x);
    const ys = forma.map(([, y]) => y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return { x0, y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1 };
  }

  /** El contorno de unas casillas como líneas cerradas, en casillas: una por cada parte suelta (las piezas no tienen
      agujeros). Sin los puntos que quedan en medio de un lado recto. */
  function contornos(casillas) {
    const hay = new Set(casillas.map(([x, y]) => `${x},${y}`));
    const lados = new Map();
    const lado = (a, b) => lados.set(`${a}`, [...(lados.get(`${a}`) ?? []), b]);
    for (const [x, y] of casillas) {
      if (!hay.has(`${x},${y - 1}`)) lado([x, y], [x + 1, y]);
      if (!hay.has(`${x + 1},${y}`)) lado([x + 1, y], [x + 1, y + 1]);
      if (!hay.has(`${x},${y + 1}`)) lado([x + 1, y + 1], [x, y + 1]);
      if (!hay.has(`${x - 1},${y}`)) lado([x, y + 1], [x, y]);
    }
    const lineas = [];
    while (lados.size) {
      const [inicio] = lados.keys();
      const puntos = [];
      for (let punto = inicio.split(",").map(Number); lados.has(`${punto}`); ) {
        const salidas = lados.get(`${punto}`);
        puntos.push(punto);
        const siguiente = salidas.shift();
        if (!salidas.length) lados.delete(`${punto}`);
        punto = siguiente;
      }
      lineas.push(
        puntos.filter((p, i) => {
          const a = puntos[(i + puntos.length - 1) % puntos.length];
          const b = puntos[(i + 1) % puntos.length];
          return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
        }),
      );
    }
    return lineas;
  }

  /** El contorno de una pieza en su giro 0, con la esquina de su caja en (0, 0). */
  function contorno(tipo) {
    const { x0, y0 } = caja(tipo);
    return contornos(FORMAS[tipo][0].map(([x, y]) => [x - x0, y - y0]))[0];
  }

  /** Las líneas cerradas de contornos() como un camino, en px: casillas de lado t desde (ox, oy). */
  function camino(lineas, ox, oy, t) {
    const c = new Path2D();
    for (const linea of lineas) {
      linea.forEach(([x, y], i) => (i ? c.lineTo(ox + x * t, oy + y * t) : c.moveTo(ox + x * t, oy + y * t)));
      c.closePath();
    }
    return c;
  }

  /* ——— Las láminas como piezas ———
     Una lámina está recortada en escalera: tiene esquinas vacías. De cada una se sabe qué sextos tienen imagen y se busca
     el rectángulo lleno donde la pieza cabe más grande; ahí se recorta, y la pieza se queda con ese trozo de la obra, que
     sigue en sus casillas cuando quedan fijas. La obra siempre va al derecho: al girar, la pieza se recorta de nuevo, del
     mismo lugar de la lámina y al mismo tamaño, con su forma nueva. */
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

  function recorte(arte, tipo, giro = 0) {
    const de = `${tipo}${giro}`;
    if (arte.recortes[de]) return arte.recortes[de];
    const { x0, y0, w, h } = caja(tipo, giro);
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
    arte.recortes[de] = r;
    return r;
  }

  const arteDe = (n) => (vista.artes.length ? vista.artes[n % vista.artes.length] : null);

  /** La obra de una lámina en un canvas de tamaño conocido. Con srcset, la imagen dice medir lo que ocupa en la página y
      no lo que mide de verdad, y un recorte por coordenadas saldría de otro lugar; dibujada entera no hay dudas. Va
      sobre papel: algunas láminas son recortes con calados, y una pieza no deja ver la cuadrícula a través. */
  const LADO_ARTE = 512;
  const PAPEL = "#F7F4EE";
  function arte(l) {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = LADO_ARTE;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = PAPEL;
    ctx.fillRect(0, 0, LADO_ARTE, LADO_ARTE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(l.img, 0, 0, LADO_ARTE, LADO_ARTE);
    return { lienzo, mapa: mapaOpaco(l), recortes: {} };
  }

  /** Una pieza, o lo que queda de ella: (ox, oy) es la esquina de la caja en que gira, t el lado de una casilla y
      casillas, las que se ven, dentro de esa caja. La obra de su lámina se dibuja de una vez bajo la silueta, sin
      costuras entre casillas, y la termina un filo apenas oscuro, como el corte de un papel. La sombra, si se pide, va
      debajo (en px, como t). */
  function figura(ctx, { tipo, n, giro = 0 }, ox, oy, t, { casillas = FORMAS[tipo][giro], sombra = null } = {}) {
    if (!casillas.length) return;
    const silueta = new Path2D();
    for (const [x, y] of casillas) silueta.rect(ox + x * t, oy + y * t, t, t);
    if (sombra && sombra.alfa > 0) {
      // Las sombras del canvas no siguen la transformación: se dan en px de la pantalla
      const m = ctx.getTransform();
      const escala = Math.hypot(m.a, m.b);
      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e - LEJOS, m.f);
      ctx.shadowColor = `rgba(31,42,61,${sombra.alfa})`;
      ctx.shadowBlur = sombra.blur * escala;
      ctx.shadowOffsetX = LEJOS;
      ctx.shadowOffsetY = sombra.y * escala;
      ctx.fillStyle = "#000";
      ctx.fill(silueta);
      ctx.restore();
    }
    const arte = arteDe(n);
    ctx.save();
    ctx.clip(silueta);
    if (arte) {
      const r = recorte(arte, tipo, giro);
      // Un poco más grande que la caja: el borde lo da la silueta, no el de la imagen
      const extra = 1 / t;
      const fuente = r.lado * LADO_ARTE;
      ctx.drawImage(
        arte.lienzo,
        r.ox * LADO_ARTE - extra * fuente,
        r.oy * LADO_ARTE - extra * fuente,
        (r.w + 2 * extra) * fuente,
        (r.h + 2 * extra) * fuente,
        ox + r.x0 * t - 1,
        oy + r.y0 * t - 1,
        r.w * t + 2,
        r.h * t + 2,
      );
    } else {
      ctx.fillStyle = COLORES[tipo];
      ctx.fill(silueta);
    }
    // El filo, de un píxel de la pantalla, por dentro de la silueta
    const matriz = ctx.getTransform();
    ctx.strokeStyle = "rgba(31,42,61,.2)";
    ctx.lineWidth = 2 / Math.hypot(matriz.a, matriz.b);
    ctx.stroke(camino(contornos(casillas), ox, oy, t));
    ctx.restore();
  }

  /** Las casillas fijas, en grupos que se dibujan juntos: las de una misma pieza que siguen en su lugar. Cuando se va
      una fila del medio de una pieza, su parte de arriba baja y es otro grupo, con su trozo de la obra. Las más nuevas
      van encima. */
  function grupos(tablero) {
    const de = new Map();
    for (let y = OCULTAS; y < ALTO; y += 1) {
      tablero[y].forEach((celda, x) => {
        if (!celda) return;
        const [fx, fy] = FORMAS[celda.tipo][celda.giro][celda.k];
        const ox = x - fx;
        const oy = y - OCULTAS - fy;
        const clave = `${celda.n}|${ox}|${oy}`;
        if (!de.has(clave)) de.set(clave, { tipo: celda.tipo, n: celda.n, giro: celda.giro, ox, oy, casillas: [] });
        de.get(clave).casillas.push([fx, fy]);
      });
    }
    return [...de.values()].sort((a, b) => a.n - b.n);
  }

  /** Una pieza del tablero, sin las casillas que quedan sobre la cuadrícula. */
  function dibujarPieza(ctx, pieza, c, sombra = null) {
    const casillas = FORMAS[pieza.tipo][pieza.giro].filter(([, y]) => pieza.y + y >= OCULTAS);
    figura(ctx, pieza, pieza.x * c, (pieza.y - OCULTAS) * c, c, { casillas, sombra });
  }

  /** Dónde caería la pieza: su contorno, punteado. */
  function dibujarFantasma(ctx, pieza, c) {
    const casillas = FORMAS[pieza.tipo][pieza.giro].filter(([, y]) => pieza.y + y >= OCULTAS);
    if (!casillas.length) return;
    const linea = camino(contornos(casillas), pieza.x * c, (pieza.y - OCULTAS) * c, c);
    ctx.save();
    ctx.fillStyle = "rgba(31,42,61,.05)";
    ctx.fill(linea);
    ctx.strokeStyle = "rgba(31,42,61,.34)";
    ctx.lineWidth = Math.max(1, c / 26);
    ctx.lineJoin = "round";
    ctx.setLineDash([Math.max(2, c / 7), Math.max(2, c / 9)]);
    ctx.stroke(linea);
    ctx.restore();
  }

  /** Cuántas de las que siguen caben al costado y de qué tamaño: hasta cuatro, una bajo la otra. Si no caben cuatro del
      tamaño que permite el ancho, van menos. */
  function disponer(W, H, c) {
    const porAncho = Math.min(c * 0.8, (W - 12) / 4.2);
    let disp = null;
    for (const cuantas of [4, 3, 2]) {
      const s = H / cuantas;
      const m = Math.max(4, Math.floor(Math.min(porAncho, s / 2.7)));
      disp = { cuantas, s, m, W, H };
      if (m >= porAncho * 0.72) break;
    }
    return disp;
  }

  /** La esquina de la caja que gira de la pieza j de las que siguen, en su canvas, y el lado de sus casillas: la pieza
      queda al centro de su lugar. */
  function posSiguiente(tipo, j, disp = vista.disp) {
    const { x0, y0, w, h } = caja(tipo);
    const { m, s, W } = disp;
    return [Math.round(W / 2 - (w * m) / 2) - x0 * m, Math.round(s * (j + 0.5) - (h * m) / 2) - y0 * m, m];
  }

  /** Lo mismo para la guardada, al centro de su canvas. */
  function posGuardada(tipo) {
    const { x0, y0, w, h } = caja(tipo);
    const { W, H } = vista.dispGuardada;
    const m = Math.max(4, Math.floor(Math.min(vista.disp.m, (W - 12) / 4.2, H / 2.4)));
    return [Math.round(W / 2 - (w * m) / 2) - x0 * m, Math.round(H / 2 - (h * m) / 2) - y0 * m, m];
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
    const ayuda = AYUDA.map(([teclas, que]) => `<li><span class="recreo-teclas-de">${teclas.map(kbd).join("")}</span><span>${que}</span></li>`).join("");
    dialogo.innerHTML = `<div class="recreo-hoja" data-recreo-hoja>
  <h2 class="sr-only" id="recreo-titulo">Recreo</h2>
  <div class="recreo-tablero" data-recreo-tablero tabindex="-1">
    <canvas class="recreo-lienzo" data-recreo-lienzo role="img" aria-label="La cuadrícula donde caen las piezas"></canvas>
    <div class="recreo-aviso" data-recreo-aviso>
      <div class="recreo-aviso-caja">
        <p class="recreo-aviso-titulo" data-recreo-aviso-titulo></p>
        <p class="recreo-aviso-texto" data-recreo-aviso-texto></p>
        <button type="button" class="boton boton-principal" data-recreo-seguir></button>
      </div>
    </div>
  </div>
  <div class="recreo-izq">
    <div class="recreo-caja recreo-guardada">
      <p class="recreo-rotulo">Guardada</p>
      <div class="recreo-marco" data-recreo-marco-guardada><canvas data-recreo-guardada role="img"></canvas></div>
    </div>
    <dl class="recreo-caja recreo-marcador">
      <div class="recreo-dato recreo-dato-puntaje"><dt>Puntaje</dt><dd data-recreo-puntaje>0</dd></div>
      <div class="recreo-dato"><dt>Nivel</dt><dd data-recreo-nivel>1</dd></div>
      <div class="recreo-dato"><dt>Líneas</dt><dd data-recreo-lineas>0</dd></div>
      <div class="recreo-dato recreo-dato-record"><dt>Récord</dt><dd data-recreo-record>0</dd></div>
    </dl>
    <p class="recreo-jugada" data-recreo-jugada aria-hidden="true"><span class="recreo-jugada-nombre"></span><span class="recreo-jugada-extra"></span></p>
  </div>
  <div class="recreo-der">
    <div class="recreo-caja recreo-siguiente">
      <p class="recreo-rotulo">Siguiente</p>
      <div class="recreo-marco" data-recreo-marco-siguiente><canvas data-recreo-siguiente role="img"></canvas></div>
    </div>
    <div class="recreo-teclas" id="recreo-ayuda">
      <p class="recreo-rotulo">Controles</p>
      <ul class="recreo-lista">${ayuda}</ul>
    </div>
    <div class="recreo-acciones">
      <button type="button" class="recreo-accion" data-recreo-pausa disabled><kbd class="recreo-tecla" aria-hidden="true">P</kbd><span data-recreo-pausa-texto>Pausa</span></button>
      <button type="button" class="recreo-accion" data-recreo-cerrar><kbd class="recreo-tecla" aria-hidden="true">Esc</kbd><span>Salir</span></button>
    </div>
  </div>
  <div class="recreo-controles" data-recreo-controles>${botones}</div>
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
    const jugada = $("[data-recreo-jugada]");
    const v = {
      dialogo,
      hoja: $("[data-recreo-hoja]"),
      tablero: $("[data-recreo-tablero]"),
      lienzo,
      ctx: lienzo.getContext("2d"),
      fondo, // la cuadrícula y las piezas fijas, que cambian sólo al fijar una pieza o borrar filas
      ctxFondo: fondo.getContext("2d"),
      fondoDe: "",
      siguiente,
      ctxSiguiente: siguiente.getContext("2d"),
      marcoSiguiente: $("[data-recreo-marco-siguiente]"),
      guardada,
      ctxGuardada: guardada.getContext("2d"),
      marcoGuardada: $("[data-recreo-marco-guardada]"),
      lienzoVuelo: vuelo,
      ctxVuelo: vuelo.getContext("2d"),
      aviso: $("[data-recreo-aviso]"),
      avisoTitulo: $("[data-recreo-aviso-titulo]"),
      avisoTexto: $("[data-recreo-aviso-texto]"),
      seguir: $("[data-recreo-seguir]"),
      pausa: $("[data-recreo-pausa]"),
      pausaTexto: $("[data-recreo-pausa-texto]"),
      cerrar: $("[data-recreo-cerrar]"),
      controles: $("[data-recreo-controles]"),
      voz: $("[data-recreo-voz]"),
      jugada,
      jugadaNombre: jugada.firstElementChild,
      jugadaExtra: jugada.lastElementChild,
      jugadaFin: 0,
      datos: { puntaje: $("[data-recreo-puntaje]"), lineas: $("[data-recreo-lineas]"), nivel: $("[data-recreo-nivel]"), record: $("[data-recreo-record]") },
      quieto: window.matchMedia("(prefers-reduced-motion: reduce)"),
      juego: null,
      partida: 0,
      artes: [], // una por lámina: { lienzo, mapa, recortes }
      vuelo: null,
      c: 24, // lado de una casilla, en px CSS
      disp: { cuantas: 4, s: 40, m: 14, W: 100, H: 160 }, // las que siguen: cuántas, cada cuánto y de qué lado
      dispGuardada: { W: 100, H: 40 },
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
      es la del doble clic. Cada pieza lleva la obra de una lámina. Con transformar, las toma donde están, las recorta y
      vuelan a su lugar; si no, el juego aparece de una vez. alCerrar se llama al cerrarse, por el botón, Escape o el
      navegador. */
  function abrir({ laminas = [], transformar = false, alCerrar = null } = {}) {
    if (!vista) vista = armar();
    if (vista.dialogo.open) return;
    vista.alCerrar = alCerrar;
    const tomadas = laminas.filter((l) => l.img?.naturalWidth > 0);
    const conVuelo = transformar && tomadas.length > 0 && !vista.quieto.matches;
    vista.artes = [];
    for (const l of tomadas) {
      try {
        vista.artes.push(arte(l));
      } catch {
        // Una imagen que no se deja dibujar no da piezas
      }
    }
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
    if (conVuelo && vista.artes.length === tomadas.length) prepararVuelo(tomadas);
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

  /** El lado de la casilla sale del lugar que inicio.css le da al tablero según la pantalla, redondeado a píxeles
      enteros: el tablero se ajusta a la cuadrícula justa y los costados toman lo que queda. Se mide sin
      transformaciones: la hoja puede venir entrando. */
  function medir() {
    const { tablero } = vista;
    tablero.style.removeProperty("width");
    tablero.style.removeProperty("height");
    const c = Math.max(8, Math.floor(Math.min(tablero.clientWidth / COLUMNAS, tablero.clientHeight / FILAS)));
    tablero.style.width = `${c * COLUMNAS}px`;
    tablero.style.height = `${c * FILAS}px`;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const lienzo = (canvas, w, h) => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    lienzo(vista.lienzo, c * COLUMNAS, c * FILAS);
    vista.fondo.width = vista.lienzo.width;
    vista.fondo.height = vista.lienzo.height;
    const marco = (el) => ({ W: el.clientWidth, H: el.clientHeight });
    const sig = marco(vista.marcoSiguiente);
    const gua = marco(vista.marcoGuardada);
    lienzo(vista.siguiente, sig.W, sig.H);
    lienzo(vista.guardada, gua.W, gua.H);
    lienzo(vista.lienzoVuelo, window.innerWidth, window.innerHeight);
    Object.assign(vista, { c, dpr, disp: disponer(sig.W, sig.H, c), dispGuardada: gua, mostrado: "", fondoDe: "" });
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

  const FILAS_DE = ["", " simple", " doble", " triple"];
  /** El nombre de una jugada, como lo dicen los que juegan. */
  function nombreJugada({ filas, giro, combo }) {
    if (giro === "t") return `T-spin${FILAS_DE[filas]}`;
    if (giro === "mini") return `Mini T-spin${FILAS_DE[filas]}`;
    if (filas === 4) return "Cuatro líneas";
    return `Combo ×${combo + 1}`;
  }

  /** La jugada aparece bajo el marcador y se va sola. */
  function mostrarJugada(nombre, extra) {
    const { jugada } = vista;
    vista.jugadaNombre.textContent = nombre;
    vista.jugadaExtra.textContent = extra;
    vista.voz.textContent = `${nombre}${extra ? `. ${extra}` : ""}.`;
    clearTimeout(vista.jugadaFin);
    jugada.getAnimations?.().forEach((anim) => anim.cancel());
    if (vista.quieto.matches || !jugada.animate) {
      jugada.style.opacity = "1";
      vista.jugadaFin = setTimeout(() => (jugada.style.opacity = ""), 1800);
      return;
    }
    jugada.animate(
      [
        { opacity: 0, transform: "translateY(8px) scale(.96)" },
        { opacity: 1, transform: "none", offset: 0.1 },
        { opacity: 1, transform: "none", offset: 0.78 },
        { opacity: 0, transform: "translateY(-4px)" },
      ],
      { duration: 1900, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }

  /** Lo que pasó en el motor se cuenta: las jugadas y el nivel bajo el marcador, el fin y todo al lector de pantalla. */
  function contar() {
    const { juego } = vista;
    if (!juego.eventos.length) return;
    let jugada = null;
    let nivel = 0;
    for (const evento of juego.eventos.splice(0)) {
      if (evento.tipo === "jugada") jugada = evento;
      if (evento.tipo === "nivel") nivel = evento.nivel;
      if (evento.tipo === "fin") {
        vista.finEn = performance.now();
        vista.recordNuevo = evento.record;
        if (evento.record) escribirRecord(juego.record);
        vista.voz.textContent = `Fin del recreo. Puntaje ${numero(evento.puntaje)}.`;
      }
    }
    if (jugada) {
      const extra = [
        jugada.seguidas ? "seguidas, ×1,5" : "",
        (jugada.giro || jugada.filas === 4) && jugada.combo > 0 ? `combo ×${jugada.combo + 1}` : "",
        `+${numero(jugada.puntos)}`,
        nivel ? `nivel ${nivel}` : "",
      ];
      mostrarJugada(nombreJugada(jugada), extra.filter(Boolean).join(" · "));
    } else if (nivel) mostrarJugada(`Nivel ${nivel}`, "Las piezas caen más rápido");
    actualizar();
  }

  /** Aviso sobre la cuadrícula, botón de pausa y marcador, según el estado. */
  function actualizar() {
    const { juego } = vista;
    const textos = {
      listo: ["Recreo", "Completa filas. Cada diez líneas, las piezas caen más rápido.", "Empezar"],
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
    vista.pausaTexto.textContent = juego.estado === "pausa" ? "Seguir" : "Pausa";
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
    const { juego } = vista;
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
        // Las sombras, del sobrante y de la pieza: una silueta desenfocada no necesita la densidad de la pantalla
        const sombraHecha = (w, h, dibujar) => {
          const [lienzo, cp] = hoja(w + 2 * borde, h + 2 * borde, DENSIDAD_SOMBRA);
          cp.shadowColor = `rgba(31,42,61,${l.sombra.opacidad})`;
          cp.shadowBlur = l.sombra.desenfoque * 2 * DENSIDAD_SOMBRA;
          cp.shadowOffsetX = LEJOS * DENSIDAD_SOMBRA;
          cp.translate(borde - LEJOS, borde);
          dibujar(cp);
          return lienzo;
        };
        const sombraSobrante = sombraHecha(l.lado, l.lado, (cp) => cp.drawImage(sobrante, 0, 0, l.lado, l.lado));
        const sombraPieza = sombraHecha(r.w * t0, r.h * t0, (cp) => {
          cp.fillStyle = "#000";
          cp.beginPath();
          silueta(cp, 0, 0);
          cp.fill();
        });

        // La pieza con el filtro de su lámina, que se suelta en el aire
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
          // La esquina de la caja en que gira la pieza, sobre la lámina
          ox0: l.x + r.ox * l.lado - r.x0 * t0,
          oy0: l.y + r.oy * l.lado - r.y0 * t0,
          sobrante,
          sombraSobrante,
          sombraPieza,
          filtrada,
          contorno: contorno(entrada.tipo),
          destino: i === 0 ? "tablero" : i <= vista.disp.cuantas ? i - 1 : "pila",
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
    const { ctxVuelo: ctx, dpr, c } = vista;
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
      let sombraFin = SOMBRA.costado;
      if (p.destino === "tablero") {
        const pos = nacimiento(entrada.tipo);
        dt = c;
        dx = tablero.left + pos.x * c;
        dy = tablero.top + (pos.y - OCULTAS) * c;
        sombraFin = SOMBRA.cae;
      } else {
        const [mx, my, m] = posSiguiente(entrada.tipo, p.destino === "pila" ? vista.disp.cuantas - 1 : p.destino);
        dt = m;
        dx = costado.left + mx;
        dy = costado.top + my;
        if (p.destino === "pila") {
          // Más chica, detrás de la última, y se desvanece al llegar
          dt = m * 0.7;
          dx += (r.x0 + r.w / 2) * (m - dt);
          dy += (r.y0 + r.h / 2) * (m - dt) + m * 0.6;
          alfa = 1 - smooth(span(e, 0.45, 1));
        }
      }
      const ts = lerp(p.t0, dt, e);
      const k = ts / p.t0;
      const ox = lerp(p.ox0, dx, e);
      const oy = lerp(p.oy0, dy, e) - Math.sin(Math.PI * e) * Math.min(140, H * 0.14);
      // La esquina de la obra (la caja de la pieza sin sus filas y columnas vacías)
      const ax = ox + r.x0 * ts;
      const ay = oy + r.y0 * ts;
      const alto = 1 - e + Math.sin(Math.PI * e) * 0.7; // altura sobre la mesa: aleja la sombra
      // Al llegar, la sombra de la lámina se vuelve la de su lugar
      const llega = smooth(span(e, 0.72, 1));
      ctx.save();
      ctx.globalAlpha = alfa;
      const cx = ax + (r.w * ts) / 2;
      const cy = ay + (r.h * ts) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((Math.sin(Math.PI * e) * p.giro * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      if (llega < 1) {
        ctx.save();
        ctx.globalAlpha = alfa * (1 - llega);
        const sx = l.sombra.x * alto;
        const sy = l.sombra.y * alto;
        ctx.drawImage(p.sombraPieza, ax + sx - borde * k, ay + sy - borde * k, (r.w * p.t0 + 2 * borde) * k, (r.h * p.t0 + 2 * borde) * k);
        ctx.restore();
      }
      figura(ctx, entrada, ox, oy, ts, { sombra: llega > 0 ? sombraDe(sombraFin, ts, llega) : null });
      // Las láminas del fondo llevan su filtro: en el aire se lo sacan
      const filtro = 1 - smooth(span(e, 0.1, 0.6));
      if (p.filtrada && filtro > 0) {
        ctx.globalAlpha = alfa * filtro;
        ctx.drawImage(p.filtrada, ax, ay, r.w * ts, r.h * ts);
        ctx.globalAlpha = alfa;
      }
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
          if (n) ctx.lineTo(ax + px * ts, ay + py * ts);
          else ctx.moveTo(ax + px * ts, ay + py * ts);
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

  /* ——— Dibujo ——— */
  /** La cuadrícula y las piezas fijas, en el canvas de fondo: sólo cambian al fijar una pieza o borrar filas. */
  function pintarFondo() {
    const { juego, ctxFondo: ctx, c, dpr } = vista;
    const { width, height } = vista.fondo;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // Las rayas, de un píxel CSS justo en píxeles de la pantalla; los bordes los pone la tarjeta
    ctx.fillStyle = CUADRICULA;
    const grosor = Math.max(1, Math.round(dpr));
    for (let x = 1; x < COLUMNAS; x += 1) ctx.fillRect(Math.round(x * c * dpr) - Math.floor(grosor / 2), 0, grosor, height);
    for (let y = 1; y < FILAS; y += 1) ctx.fillRect(0, Math.round(y * c * dpr) - Math.floor(grosor / 2), width, grosor);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    const sombra = sombraDe(SOMBRA.fija, c);
    for (const g of grupos(juego.tablero)) figura(ctx, g, g.ox * c, g.oy * c, c, { casillas: g.casillas, sombra });
  }

  /** Las que siguen y la guardada (apagada mientras no se puede cambiar). */
  function dibujarCostado() {
    const { juego, disp, dispGuardada, dpr, ctxSiguiente, ctxGuardada } = vista;
    const siguen = juego.cola.slice(juego.estado === "listo" ? 1 : 0).slice(0, disp.cuantas);
    const mostrado = `${vista.partida}|${siguen.map((e) => (llego(e.n) ? e.n : "·")).join(",")}|${juego.guardada?.n}|${juego.puedeGuardar}|${disp.m},${disp.cuantas},${disp.W},${disp.H}|${dispGuardada.W},${dispGuardada.H}|${dpr}`;
    if (mostrado === vista.mostrado) return;
    vista.mostrado = mostrado;
    ctxSiguiente.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxSiguiente.clearRect(0, 0, disp.W, disp.H);
    ctxSiguiente.imageSmoothingQuality = "high";
    siguen.forEach((entrada, j) => {
      if (!llego(entrada.n)) return;
      const [x, y, m] = posSiguiente(entrada.tipo, j);
      figura(ctxSiguiente, entrada, x, y, m, { sombra: sombraDe(SOMBRA.costado, m) });
    });
    vista.siguiente.setAttribute("aria-label", `Siguen: ${siguen.map((e) => e.tipo).join(", ")}`);
    ctxGuardada.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxGuardada.clearRect(0, 0, dispGuardada.W, dispGuardada.H);
    ctxGuardada.imageSmoothingQuality = "high";
    if (juego.guardada) {
      const [x, y, m] = posGuardada(juego.guardada.tipo);
      ctxGuardada.globalAlpha = juego.puedeGuardar ? 1 : 0.4;
      figura(ctxGuardada, juego.guardada, x, y, m, { sombra: sombraDe(SOMBRA.costado, m) });
      ctxGuardada.globalAlpha = 1;
    }
    vista.guardada.setAttribute("aria-label", juego.guardada ? `Guardada: ${juego.guardada.tipo}` : "Ninguna guardada");
  }

  function dibujar() {
    const { juego, ctx, c, dpr } = vista;
    if (!juego) return;
    vista.sucio = false;
    const ancho = c * COLUMNAS;
    const clave = `${vista.partida}|${juego.cambios}|${c}|${dpr}|${vista.artes.length}`;
    if (clave !== vista.fondoDe) {
      pintarFondo();
      vista.fondoDe = clave;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, vista.lienzo.width, vista.lienzo.height);
    ctx.drawImage(vista.fondo, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Las filas completas se van como papel que se levanta: un velo blanco las barre de izquierda a derecha
    if (juego.limpiando) {
      const avance = vista.quieto.matches ? 1 : Math.min(1, (1 - juego.limpiando.resta / juego.pausaLineas) * 1.5);
      const frente = ancho * avance;
      ctx.save();
      juego.limpiando.filas.forEach((y) => {
        if (y < OCULTAS) return;
        const py = (y - OCULTAS) * c;
        const velo = ctx.createLinearGradient(frente - c * 2, 0, frente, 0);
        velo.addColorStop(0, "rgba(255,255,255,.92)");
        velo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.fillRect(0, py, Math.max(0, frente - c * 2), c);
        ctx.fillStyle = velo;
        ctx.fillRect(Math.max(0, frente - c * 2), py, Math.min(frente, c * 2), c);
      });
      ctx.restore();
      vista.sucio = true;
    }

    const sombra = sombraDe(SOMBRA.cae, c);
    if (juego.pieza) {
      const abajo = fantasma(juego);
      if (abajo && abajo.y !== juego.pieza.y) dibujarFantasma(ctx, abajo, c);
      dibujarPieza(ctx, juego.pieza, c, sombra);
    } else if (juego.estado === "listo" && llego(juego.cola[0].n)) {
      // Antes de empezar, la primera pieza espera donde va a nacer
      dibujarPieza(ctx, { ...juego.cola[0], giro: 0, ...nacimiento(juego.cola[0].tipo) }, c, sombra);
    }

    dibujarCostado();
    const { datos } = vista;
    const poner = (el, valor) => el.textContent !== valor && (el.textContent = valor);
    poner(datos.puntaje, numero(juego.puntaje));
    poner(datos.lineas, numero(juego.lineas));
    poner(datos.nivel, numero(juego.nivel));
    poner(datos.record, numero(Math.max(juego.record, juego.puntaje)));
  }

  // Lo que se dibuja sin documento también se prueba sin navegador
  const dibujo = { grupos, contornos, disponer };

  window.pteronRecreo = { motor, dibujo, abrir, cerrar: () => vista && cerrar() };
})();
