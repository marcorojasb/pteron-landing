import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// El motor del recreo (public/recreo.js) es puro: se carga sin documento y se juega a mano
const source = readFileSync(new URL("../public/recreo.js", import.meta.url), "utf8");
const ventana = {};
ventana.window = ventana;
vm.runInNewContext(source, ventana);
const { motor } = ventana.pteronRecreo;
const { COLUMNAS, FILAS, OCULTAS, TIPOS } = motor;
const ALTO = FILAS + OCULTAS;

/** Un azar que repite siempre la misma serie: la bolsa sale igual en cada prueba. */
const azarFijo = () => {
  let semilla = 7;
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
};
/** Un juego empezado con la pieza tipo en juego. */
function conPieza(tipo, opciones = {}) {
  const juego = motor.crear({ azar: azarFijo(), pausaLineas: 0, ...opciones });
  juego.cola[0] = { ...juego.cola[0], tipo };
  motor.empezar(juego);
  return juego;
}
/** Llena una fila visible (0 = la de más abajo) dejando libres las columnas dadas. */
function llenarFila(juego, desdeAbajo, libres = []) {
  const y = ALTO - 1 - desdeAbajo;
  for (let x = 0; x < COLUMNAS; x += 1) juego.tablero[y][x] = libres.includes(x) ? null : { tipo: "O", n: 99, k: 0, giro: 0 };
}
// Lo que sale del motor viene de otro contexto (otros Array y Object): se compara en limpio
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const ocupadas = (juego) => juego.tablero.flat().filter(Boolean).length;
const celdas = (juego) => motor.celdas(juego.pieza).map(([x, y]) => `${x},${y}`).sort();

test("la bolsa de siete: cada siete piezas salen las siete, numeradas en orden, y la cola nunca baja de cinco", () => {
  const juego = motor.crear({ azar: azarFijo() });
  assert.ok(juego.cola.length >= 5);
  motor.empezar(juego);
  const salidas = [juego.pieza];
  for (let i = 0; i < 13; i += 1) {
    motor.soltar(juego);
    // Se limpia la hoja para que las piezas no se apilen hasta el techo
    juego.tablero.forEach((fila) => fila.fill(null));
    salidas.push(juego.pieza);
  }
  assert.deepEqual(new Set(salidas.slice(0, 7).map((p) => p.tipo)), new Set(TIPOS));
  assert.deepEqual(new Set(salidas.slice(7, 14).map((p) => p.tipo)), new Set(TIPOS));
  assert.deepEqual(salidas.map((p) => p.n), salidas.map((_, i) => i), "el número de serie sigue el orden de salida");
  assert.ok(juego.cola.length >= 5);
  // La vista pide una pieza por lámina: la cola trae al menos esas
  const largo = motor.crear({ azar: azarFijo(), largoCola: 16 });
  assert.equal(largo.cola.length, 16);
  assert.deepEqual(plano(largo.cola.map((e) => e.n)), [...Array(16).keys()]);
});

test("cada pieza nace arriba al centro, con su primera fila en la primera de la hoja", () => {
  for (const tipo of TIPOS) {
    const juego = conPieza(tipo);
    const ys = motor.celdas(juego.pieza).map(([, y]) => y);
    const xs = motor.celdas(juego.pieza).map(([x]) => x);
    assert.equal(Math.min(...ys), OCULTAS, `${tipo}: arriba de todo`);
    assert.ok(Math.min(...xs) >= 3 && Math.max(...xs) <= 6, `${tipo}: al centro`);
    assert.deepEqual(plano(motor.nacimiento(tipo)), { x: juego.pieza.x, y: juego.pieza.y });
  }
});

test("mover: las paredes y las piezas fijas detienen la pieza", () => {
  const juego = conPieza("O");
  let pasos = 0;
  while (motor.mover(juego, -1)) pasos += 1;
  assert.equal(pasos, 4);
  assert.equal(Math.min(...motor.celdas(juego.pieza).map(([x]) => x)), 0);
  while (motor.mover(juego, 1));
  assert.equal(Math.max(...motor.celdas(juego.pieza).map(([x]) => x)), COLUMNAS - 1);
  // Una pieza fija al lado también detiene
  const otro = conPieza("O");
  otro.tablero[OCULTAS][3] = { tipo: "I", n: 9, k: 0, giro: 0 };
  assert.equal(motor.mover(otro, -1), false);
});

test("girar: cuatro giros vuelven al inicio, el antihorario deshace el horario y la O no cambia de casillas", () => {
  for (const tipo of TIPOS) {
    const juego = conPieza(tipo);
    motor.bajar(juego);
    motor.bajar(juego);
    const antes = celdas(juego);
    for (let i = 0; i < 4; i += 1) assert.ok(motor.girar(juego, 1), `${tipo}: gira`);
    assert.deepEqual(celdas(juego), antes, `${tipo}: cuatro giros`);
    motor.girar(juego, 1);
    motor.girar(juego, -1);
    assert.deepEqual(celdas(juego), antes, `${tipo}: ida y vuelta`);
  }
  const o = conPieza("O");
  const antes = celdas(o);
  motor.girar(o, 1);
  assert.deepEqual(celdas(o), antes);
});

test("girar junto a la pared usa las patadas de SRS: la I vertical pegada a la izquierda vuelve a quedar horizontal", () => {
  const juego = conPieza("I");
  for (let i = 0; i < 4; i += 1) motor.bajar(juego);
  assert.ok(motor.girar(juego, 1));
  while (motor.mover(juego, -1));
  assert.deepEqual(new Set(motor.celdas(juego.pieza).map(([x]) => x)), new Set([0]), "vertical en la primera columna");
  // Sin patada no cabría (quedaría con columnas negativas): gira igual y queda dentro
  assert.ok(motor.girar(juego, -1));
  const xs = motor.celdas(juego.pieza).map(([x]) => x);
  assert.ok(Math.min(...xs) >= 0, `dentro de la hoja: ${xs}`);
  assert.equal(new Set(motor.celdas(juego.pieza).map(([, y]) => y)).size, 1, "horizontal");
});

test("soltar: dos puntos por fila, la pieza queda fija con su número y su giro, y nace la siguiente", () => {
  const juego = conPieza("T");
  const siguiente = juego.cola[0];
  const n = juego.pieza.n;
  const filas = motor.soltar(juego);
  assert.equal(filas, FILAS - 2);
  assert.equal(juego.puntaje, filas * 2);
  assert.equal(ocupadas(juego), 4);
  const fijas = juego.tablero.flat().filter(Boolean);
  assert.ok(fijas.every((c) => c.tipo === "T" && c.n === n && c.giro === 0));
  assert.deepEqual(plano(fijas.map((c) => c.k).sort()), [0, 1, 2, 3], "cada casilla sabe cuál de las cuatro es");
  assert.equal(juego.pieza.n, siguiente.n);
  assert.equal(juego.cambios, 1);
});

test("bajar a mano suma un punto por fila; la gravedad baja sola, más rápido con ↓ sostenida", () => {
  const juego = conPieza("T");
  const y = juego.pieza.y;
  assert.ok(motor.bajar(juego));
  assert.equal(juego.puntaje, 1);
  motor.avanzar(juego, 999);
  assert.equal(juego.pieza.y, y + 1, "en el nivel 1 una fila tarda un segundo");
  motor.avanzar(juego, 1);
  assert.equal(juego.pieza.y, y + 2);
  motor.avanzar(juego, 100, true);
  assert.equal(juego.pieza.y, y + 4, "con ↓, veinte veces más rápido");
  assert.equal(juego.puntaje, 3);
  // La curva acelera y nunca llega a cero
  const g = [1, 2, 5, 10, 15, 20, 40].map(motor.gravedad);
  assert.ok(g.every((v, i) => i === 0 || v <= g[i - 1]));
  assert.equal(g[0], 1000);
  assert.ok(g.at(-1) >= 1);
});

test("en el suelo la pieza espera medio segundo; cada movimiento reinicia la espera, hasta quince", () => {
  const juego = conPieza("O");
  while (motor.bajar(juego));
  const n = juego.pieza.n;
  motor.avanzar(juego, 450);
  assert.equal(juego.pieza.n, n, "todavía no se fija");
  assert.ok(motor.mover(juego, 1));
  motor.avanzar(juego, 450);
  assert.equal(juego.pieza.n, n, "el movimiento reinició la espera");
  for (let i = 0; i < 20; i += 1) motor.mover(juego, i % 2 ? 1 : -1);
  motor.avanzar(juego, 500);
  assert.notEqual(juego.pieza.n, n, "pasados los quince reinicios, se fija");
  assert.equal(ocupadas(juego), 4);
});

test("filas completas: se destacan, se van y lo de arriba baja; puntaje por cantidad y por nivel", () => {
  // Una fila
  const una = conPieza("I");
  llenarFila(una, 0, [3, 4, 5, 6]);
  una.tablero[ALTO - 2][0] = { tipo: "S", n: 50, k: 1, giro: 2 };
  motor.soltar(una);
  assert.equal(una.lineas, 1);
  assert.equal(una.puntaje, (FILAS - 1) * 2 + 100);
  assert.equal(ocupadas(una), 1, "la fila completa se fue entera");
  assert.deepEqual(plano(una.tablero[ALTO - 1][0]), { tipo: "S", n: 50, k: 1, giro: 2 }, "lo de arriba bajó una fila");

  // Cuatro de una vez, con la I vertical
  const cuatro = conPieza("I");
  for (let f = 0; f < 4; f += 1) llenarFila(cuatro, f, [0]);
  motor.girar(cuatro, 1);
  while (motor.mover(cuatro, -1));
  motor.soltar(cuatro);
  assert.equal(cuatro.lineas, 4);
  assert.ok(cuatro.puntaje >= 800 && cuatro.puntaje < 900);
  assert.equal(ocupadas(cuatro), 0);

  // Con pausa, las filas quedan destacadas hasta que pasa el tiempo
  const pausa = conPieza("I", { pausaLineas: 280 });
  llenarFila(pausa, 0, [3, 4, 5, 6]);
  motor.soltar(pausa);
  assert.deepEqual(plano(pausa.limpiando.filas), [ALTO - 1]);
  assert.equal(pausa.pieza, null, "mientras se destacan no hay pieza");
  assert.equal(motor.mover(pausa, 1), false);
  motor.avanzar(pausa, 200);
  assert.ok(pausa.limpiando);
  motor.avanzar(pausa, 100);
  assert.equal(pausa.limpiando, null);
  assert.ok(pausa.pieza);
  assert.deepEqual(plano(pausa.eventos.find((e) => e.tipo === "lineas")), { tipo: "lineas", filas: [ALTO - 1], n: 1 });
});

test("cada diez líneas sube el nivel y lo cuenta", () => {
  const juego = conPieza("I");
  juego.lineas = 9;
  llenarFila(juego, 0, [3, 4, 5, 6]);
  motor.soltar(juego);
  assert.equal(juego.nivel, 2);
  assert.ok(juego.eventos.some((e) => e.tipo === "nivel" && e.nivel === 2));
  assert.equal(juego.puntaje, (FILAS - 1) * 2 + 100, "la fila se cobra al nivel en que se hizo");
});

test("guardar: una vez por pieza; la guardada vuelve con su número", () => {
  const juego = conPieza("T");
  const t = juego.pieza.n;
  assert.ok(motor.guardar(juego));
  assert.deepEqual(plano(juego.guardada), { tipo: "T", n: t });
  assert.equal(motor.guardar(juego), false, "no dos veces seguidas");
  motor.soltar(juego);
  const actual = juego.pieza.n;
  assert.ok(motor.guardar(juego));
  assert.equal(juego.pieza.tipo, "T");
  assert.equal(juego.pieza.n, t);
  assert.equal(juego.guardada.n, actual);
});

test("pausa: el reloj no corre y nada se mueve hasta seguir", () => {
  const juego = conPieza("T");
  const y = juego.pieza.y;
  assert.equal(motor.pausar(juego, true), true);
  motor.avanzar(juego, 5000);
  assert.equal(juego.pieza.y, y);
  assert.equal(motor.mover(juego, 1), false);
  assert.equal(motor.soltar(juego), 0);
  assert.equal(motor.pausar(juego, false), false);
  motor.avanzar(juego, 1000);
  assert.equal(juego.pieza.y, y + 1);
});

test("fin: cuando la pieza siguiente no cabe, el juego termina y dice si hubo récord", () => {
  // Columnas llenas hasta arriba en el centro: nada nace
  const fin = motor.crear({ azar: azarFijo(), record: 10 });
  for (let y = 0; y < ALTO; y += 1) for (const x of [3, 4, 5, 6]) fin.tablero[y][x] = { tipo: "I", n: 9, k: 0, giro: 0 };
  fin.puntaje = 25;
  assert.equal(motor.empezar(fin), false);
  assert.equal(fin.estado, "fin");
  assert.equal(fin.record, 25);
  assert.deepEqual(plano(fin.eventos.at(-1)), { tipo: "fin", puntaje: 25, record: true });
  // Sin superar el récord
  const sin = motor.crear({ azar: azarFijo(), record: 100 });
  for (let y = 0; y < ALTO; y += 1) for (const x of [3, 4, 5, 6]) sin.tablero[y][x] = { tipo: "I", n: 9, k: 0, giro: 0 };
  motor.empezar(sin);
  assert.equal(sin.record, 100);
  assert.equal(sin.eventos.at(-1).record, false);
  // Después del fin nada responde
  assert.equal(motor.mover(sin, 1), false);
  assert.equal(motor.guardar(sin), false);
});

test("jugando a ciegas hasta perder, el motor nunca deja una pieza fuera de la hoja ni sobre otra", () => {
  const juego = motor.crear({ azar: azarFijo(), pausaLineas: 0 });
  motor.empezar(juego);
  const azar = azarFijo();
  for (let paso = 0; paso < 4000 && juego.estado === "jugando"; paso += 1) {
    const r = azar();
    if (r < 0.25) motor.mover(juego, -1);
    else if (r < 0.5) motor.mover(juego, 1);
    else if (r < 0.65) motor.girar(juego, 1);
    else if (r < 0.75) motor.girar(juego, -1);
    else if (r < 0.78) motor.guardar(juego);
    else if (r < 0.85) motor.soltar(juego);
    else motor.avanzar(juego, 120, r > 0.95);
    if (juego.pieza) {
      for (const [x, y] of motor.celdas(juego.pieza)) {
        assert.ok(x >= 0 && x < COLUMNAS && y >= 0 && y < ALTO, `fuera de la hoja: ${x},${y}`);
        assert.equal(juego.tablero[y][x], null, `sobre una fija: ${x},${y}`);
      }
    }
    assert.ok(juego.tablero.every((fila) => fila.length === COLUMNAS && !fila.every(Boolean)), "ninguna fila completa queda en la hoja");
  }
  assert.equal(juego.tablero.length, ALTO);
});

test("girar es lo último que hizo la pieza hasta que se mueve o cae", () => {
  const juego = conPieza("T");
  motor.bajar(juego);
  assert.ok(motor.girar(juego, 1));
  assert.ok(juego.giro, "girar lo anota");
  assert.ok(motor.mover(juego, 1));
  assert.equal(juego.giro, null, "moverse lo borra");
  assert.ok(motor.girar(juego, -1));
  assert.ok(motor.bajar(juego));
  assert.equal(juego.giro, null, "bajar también");
});

test("T-spin doble: la T entra girando a su hueco, borra dos filas y vale 1.200 por nivel", () => {
  const juego = conPieza("T");
  const fondo = ALTO - 1;
  llenarFila(juego, 0, [4]);
  llenarFila(juego, 1, [3, 4, 5]);
  juego.tablero[fondo - 2][5] = { tipo: "O", n: 99, k: 0, giro: 0 }; // el alero sobre el hueco
  // La T de pie, apuntando a la derecha, justo sobre el hueco: gira sin patada y queda apuntando abajo
  juego.pieza = { ...juego.pieza, giro: 1, x: 3, y: fondo - 2 };
  assert.ok(motor.girar(juego, 1));
  assert.deepEqual(plano(motor.celdas(juego.pieza).sort()), plano([[3, fondo - 1], [4, fondo - 1], [5, fondo - 1], [4, fondo]].sort()));
  assert.equal(motor.soltar(juego), 0, "ya está en el fondo");
  assert.equal(juego.lineas, 2);
  assert.equal(juego.puntaje, 1200);
  assert.deepEqual(plano(juego.eventos.find((e) => e.tipo === "jugada")), { tipo: "jugada", filas: 2, giro: "t", seguidas: false, combo: 0, puntos: 1200 });
  assert.ok(juego.eventos.some((e) => e.tipo === "lineas" && e.n === 2));

  // Después, cuatro filas de una vez: jugadas difíciles seguidas valen una vez y media, y es la segunda del combo
  juego.tablero.forEach((fila) => fila.fill(null));
  for (let f = 0; f < 4; f += 1) llenarFila(juego, f, [0]);
  juego.pieza = { ...juego.pieza, tipo: "I", giro: 1, x: -2, y: OCULTAS };
  juego.eventos.length = 0;
  const antes = juego.puntaje;
  const filas = motor.soltar(juego);
  assert.equal(juego.lineas, 6);
  assert.equal(juego.puntaje - antes - filas * 2, 800 * 1.5 + 50);
  assert.deepEqual(plano(juego.eventos.find((e) => e.tipo === "jugada")), { tipo: "jugada", filas: 4, giro: null, seguidas: true, combo: 1, puntos: 1250 });
});

test("mini T-spin: tres esquinas, pero sólo una de las del frente; con una fila vale 200", () => {
  const juego = conPieza("T");
  const fondo = ALTO - 1;
  llenarFila(juego, 0, [3, 4, 5]);
  juego.tablero[fondo - 1][5] = { tipo: "O", n: 99, k: 0, giro: 0 };
  // La T apuntando arriba, en el suelo; su última jugada fue girar
  juego.pieza = { ...juego.pieza, giro: 0, x: 3, y: fondo - 1 };
  juego.giro = { patada: 0 };
  motor.soltar(juego);
  assert.equal(juego.lineas, 1);
  assert.equal(juego.puntaje, 200);
  assert.equal(juego.eventos.find((e) => e.tipo === "jugada").giro, "mini");
  // Si entró con la última patada, cuenta como completo
  const otro = conPieza("T");
  llenarFila(otro, 0, [3, 4, 5]);
  otro.tablero[fondo - 1][5] = { tipo: "O", n: 99, k: 0, giro: 0 };
  otro.pieza = { ...otro.pieza, giro: 0, x: 3, y: fondo - 1 };
  otro.giro = { patada: 4 };
  motor.soltar(otro);
  assert.equal(otro.puntaje, 800);
  // Sin girar no es T-spin: una fila común
  const comun = conPieza("T");
  llenarFila(comun, 0, [3, 4, 5]);
  comun.tablero[fondo - 1][5] = { tipo: "O", n: 99, k: 0, giro: 0 };
  comun.pieza = { ...comun.pieza, giro: 0, x: 3, y: fondo - 1 };
  motor.soltar(comun);
  assert.equal(comun.puntaje, 100);
  assert.equal(comun.eventos.some((e) => e.tipo === "jugada"), false);
});

test("combo: cada pieza seguida que borra filas suma 50 por el número del combo; una que no borra lo corta", () => {
  const juego = conPieza("O");
  const soltarO = (libres) => {
    juego.tablero.forEach((fila) => fila.fill(null));
    llenarFila(juego, 0, libres);
    llenarFila(juego, 1, libres);
    juego.pieza = { ...juego.pieza, tipo: "O", giro: 0, x: libres[0], y: OCULTAS };
    const antes = juego.puntaje;
    const filas = motor.soltar(juego);
    return juego.puntaje - antes - filas * 2;
  };
  assert.equal(soltarO([0, 1]), 300, "dos filas");
  assert.equal(soltarO([4, 5]), 300 + 50, "combo ×2");
  assert.equal(soltarO([8, 9]), 300 + 100, "combo ×3");
  assert.equal(juego.combo, 2);
  // Una que no borra nada
  juego.tablero.forEach((fila) => fila.fill(null));
  juego.pieza = { ...juego.pieza, tipo: "O", giro: 0, x: 0, y: OCULTAS };
  motor.soltar(juego);
  assert.equal(juego.combo, -1);
  assert.equal(soltarO([0, 1]), 300, "otra vez sin combo");
});

test("las piezas fijas se dibujan en grupos: si se va una fila del medio, la parte de arriba es otro trozo", () => {
  const { grupos } = ventana.pteronRecreo.dibujo;
  // Una I de pie en la primera columna, sobre cuatro filas; la segunda desde abajo se completa
  const juego = conPieza("I");
  llenarFila(juego, 1, [0]);
  juego.pieza = { ...juego.pieza, giro: 1, x: -2, y: OCULTAS };
  const n = juego.pieza.n;
  motor.soltar(juego);
  const deLaI = grupos(juego.tablero).filter((g) => g.n === n);
  assert.equal(deLaI.length, 2);
  assert.deepEqual(plano(deLaI.map((g) => g.casillas.length).sort()), [1, 2]);
  // Cada grupo sabe dónde está la caja de su pieza: sus casillas, puestas desde ahí, son las del tablero
  for (const g of deLaI) {
    for (const [x, y] of g.casillas) assert.equal(juego.tablero[OCULTAS + g.oy + y][g.ox + x].n, n);
  }
  assert.ok(grupos(juego.tablero).every((g, i, todos) => i === 0 || todos[i - 1].n <= g.n), "las más nuevas, encima");
});

test("contornos: una línea por cada parte suelta, sólo con las esquinas", () => {
  const { contornos } = ventana.pteronRecreo.dibujo;
  const s = contornos([[1, 0], [2, 0], [0, 1], [1, 1]]);
  assert.equal(s.length, 1);
  assert.equal(s[0].length, 8);
  const sueltas = contornos([[0, 0], [3, 0]]);
  assert.equal(sueltas.length, 2);
  assert.ok(sueltas.every((linea) => linea.length === 4));
});

test("al costado van hasta cuatro de las que siguen; si no caben bien, menos", () => {
  const { disponer } = ventana.pteronRecreo.dibujo;
  const alto = disponer(184, 380, 40);
  assert.equal(alto.cuantas, 4);
  assert.ok(alto.m >= 28 && alto.m <= 32, `del tamaño de la cuadrícula: ${alto.m}`);
  const bajo = disponer(184, 140, 30);
  assert.ok(bajo.cuantas < 4);
  assert.ok(bajo.m * 2 <= bajo.s, "cada una cabe en su lugar");
});
