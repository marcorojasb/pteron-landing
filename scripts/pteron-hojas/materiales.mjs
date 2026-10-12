/**
 * Contenido de las hojas y láminas del inicio. Los bloques siguen el contrato DocumentBlock de pteron
 * (src/shared/contracts.ts) y las figuras son pedidos del kit pteron-design (formato 3): el generador
 * scripts/pteron-hojas.mjs los compone con el mismo código de la app, sin reinterpretarlos.
 */

const ejemplo = (id, extra = {}) => ({ ejemplo: id, ...extra });
const pedido = (type, titulo, data, extra = {}) => ({ pedido: { schemaVersion: 3, type, titulo, data, ...extra } });
const f = (n, d) => `\\(\\frac{${n}}{${d}}\\)`;

/** Cuatro materiales, uno por asignatura. `figura` enlaza un bloque con el pedido de su figura. */
export const MATERIALES = [
  {
    id: "ciencias",
    titulo: "Guía de trabajo: las fases de la Luna",
    bloques: [
      {
        id: "h",
        kind: "doc_header",
        text: "",
        header: {
          documentLabel: "Guía de trabajo",
          subject: "Ciencias Naturales",
          course: "3° básico",
          thematicAxis: "Ciencias de la Tierra y el Universo",
          studentNameField: true,
          durationMinutes: 45,
          purpose: "formativa",
          totalScore: 3,
        },
      },
      { id: "r", kind: "note", text: "Recuerda: la Luna no tiene luz propia. Vemos la parte que ilumina el Sol." },
      {
        id: "q1",
        kind: "question",
        text: "Observa las cuatro fases principales, tal como se ven desde Chile. ¿Qué dibujo muestra la Luna llena?",
        points: 1,
        skill: "comprender",
        choices: [
          { id: "A", text: "Dibujo A" },
          { id: "B", text: "Dibujo B" },
          { id: "C", text: "Dibujo C", correct: true },
          { id: "D", text: "Dibujo D" },
        ],
      },
      { id: "f1", kind: "figure", text: "Las cuatro fases principales", figura: ejemplo("fases_luna-cuatro", { width: 300 }) },
      {
        id: "q2",
        kind: "question",
        text: "La luz del Sol llega desde la izquierda. ¿En qué posición de su órbita se ve la Luna llena desde la Tierra?",
        points: 2,
        skill: "aplicar",
        expectedAnswer: "En la posición E, al lado opuesto del Sol.",
      },
      { id: "f2", kind: "figure", text: "La Luna en su órbita", figura: ejemplo("fases_luna-orbita", { width: 300 }) },
    ],
  },
  {
    id: "historia",
    titulo: "Guía de trabajo: períodos de la historia de Chile",
    bloques: [
      {
        id: "h",
        kind: "doc_header",
        text: "",
        header: {
          documentLabel: "Guía de trabajo",
          subject: "Historia, Geografía y Ciencias Sociales",
          course: "5° básico",
          studentNameField: true,
          durationMinutes: 45,
          purpose: "formativa",
          totalScore: 5,
        },
      },
      { id: "k", kind: "note", text: "Idea clave: una línea de tiempo ordena los hechos y muestra cuánto dura cada período." },
      {
        id: "q1",
        kind: "question",
        // La República sigue: sólo la Conquista y la Colonia tienen fin en la línea de tiempo
        text: "Observa la línea de tiempo. ¿Cuál duró más: la Conquista o la Colonia?",
        points: 1,
        skill: "comprender",
        choices: [
          { id: "A", text: "Conquista" },
          { id: "B", text: "Colonia", correct: true },
        ],
      },
      { id: "f1", kind: "figure", text: "Períodos de la historia de Chile", figura: ejemplo("linea_tiempo-periodos") },
      {
        id: "q2",
        kind: "question",
        text: "¿Cuántos años pasaron entre la fundación de Santiago y la Declaración de la Independencia? Escribe la operación.",
        points: 2,
        skill: "aplicar",
        expectedAnswer: "1818 − 1541 = 277 años.",
      },
      { id: "a2", kind: "answer", text: "", lines: 2 },
      {
        id: "q3",
        kind: "question",
        text: "Completa la tabla con el año en que comienza y termina cada período, según la línea de tiempo.",
        points: 2,
        skill: "analizar",
        expectedAnswer: "Conquista, 1536 a 1598; Colonia, 1598 a 1810; República, desde 1810.",
      },
      {
        id: "t3",
        kind: "table",
        text: "",
        table: { cornerHeader: "Período", rowHeaders: ["Conquista", "Colonia", "República"], columnHeaders: ["Comienza", "Termina"], cells: [["", ""], ["", ""], ["", ""]] },
      },
    ],
  },
  {
    id: "matematica",
    titulo: "Guía de trabajo: fracciones equivalentes",
    bloques: [
      {
        id: "h",
        kind: "doc_header",
        text: "",
        header: {
          documentLabel: "Guía de trabajo",
          subject: "Matemática",
          course: "6° básico",
          studentNameField: true,
          durationMinutes: 45,
          purpose: "formativa",
          totalScore: 4,
        },
      },
      { id: "k", kind: "note", text: "Idea clave: dos fracciones son equivalentes cuando representan la misma parte de un entero." },
      {
        id: "q1",
        kind: "question",
        text: `¿Cuántos doceavos equivalen a ${f(3, 4)}? Escribe la fracción de la última barra.`,
        points: 3,
        skill: "aplicar",
        expectedAnswer: f(9, 12),
      },
      { id: "f1", kind: "figure", text: "Fracciones equivalentes a tres cuartos", figura: ejemplo("fracciones-equivalentes", { width: 300 }) },
      {
        id: "q2",
        kind: "question",
        text: `¿Qué fracción es equivalente a ${f(2, 3)}?`,
        points: 1,
        skill: "comprender",
        choices: [
          { id: "A", text: f(3, 4) },
          { id: "B", text: f(4, 6), correct: true },
          { id: "C", text: f(2, 6) },
          { id: "D", text: f(6, 8) },
        ],
      },
    ],
  },
  {
    id: "lenguaje",
    titulo: "Guía de trabajo: escribo en letra escolar",
    bloques: [
      {
        id: "h",
        kind: "doc_header",
        text: "",
        header: {
          documentLabel: "Guía de trabajo",
          subject: "Lenguaje y Comunicación",
          course: "1° básico",
          studentNameField: true,
          durationMinutes: 30,
          purpose: "formativa",
          totalScore: 6,
        },
      },
      { id: "i", kind: "note", text: "Toma el lápiz con suavidad. Repasa primero y después escribe sin ayuda." },
      { id: "q1", kind: "question", text: "Repasa cada palabra y escríbela dos veces más en la pauta.", points: 3, skill: "aplicar" },
      { id: "f1", kind: "figure", text: "Pauta de caligrafía", figura: ejemplo("escritura-caligrafia") },
      { id: "q2", kind: "question", text: "Separa cada palabra en sílabas. Escribe una sílaba en cada casilla.", points: 3, skill: "analizar" },
      { id: "f2", kind: "figure", text: "Separar en sílabas", figura: ejemplo("escritura-silabas") },
    ],
  },
];

/**
 * Láminas del inicio. Cada una tiene detrás una figura de pteron: la de su hoja (`hoja` y `bloque`) o la propia
 * (`figura`). `forma` es la silueta del recorte vista de frente, por filas («#» lleno, «.» vacío); el generador la
 * refleja para el reverso. `fuente` y `obra` deben coincidir con /privacidad#creditos. `escritorio` y `movil`
 * son la posición al flotar: [x %, y %, ancho en vmin, capa 0 (lejos) a 2 (cerca), giro en grados].
 */
export const LAMINAS = [
  { archivo: "ciencias-luna", forma: ["#.", "##"], asignatura: "Ciencias Naturales", obra: "Mare Humorum", fuente: "Trouvelot, 1875", hoja: "ciencias", bloque: "f1", escritorio: [50, 27, 18, 2, -5], movil: [66, 11, 24, 2, -6] },
  { archivo: "ciencias-eclipse", forma: [".#", "##"], asignatura: "Ciencias Naturales", obra: "Eclipse total de 1878", fuente: "Trouvelot, 1878", hoja: "ciencias", bloque: "f2", escritorio: [91, 50, 13, 1, 6] },
  { archivo: "historia-ovalle", forma: ["..#", ".##", "###"], asignatura: "Historia", obra: "Tabula geographica regni Chile", fuente: "Ovalle, 1646", hoja: "historia", bloque: "f1", escritorio: [27, 35, 15, 1, 4], movil: [20, 34, 26, 1, 5] },
  { archivo: "matematica-pizarra", forma: ["#..", "##.", "###"], asignatura: "Matemática", obra: "Pizarra con fracciones", fuente: "Pieza propia", hoja: "matematica", bloque: "f1", escritorio: [77, 29, 20, 2, 4], movil: [64, 27, 28, 2, 4] },
  { archivo: "matematica-semicirculos", forma: ["#"], asignatura: "Matemática", obra: "Elementos de Euclides", fuente: "Byrne, 1847", figura: pedido("fracciones", "Figuras para pintar dos tercios", { modelos: [{ forma: "circulo", partes: 6 }, { forma: "hexagono", partes: 6 }, { forma: "rectangulo", partes: 3 }] }, { width: 400, letra: "mediana" }), escritorio: [39, 10, 10, 0, -4] },
  { archivo: "lenguaje-yciar", forma: [".#", "##"], asignatura: "Lenguaje", obra: "Libro subtilissimo", fuente: "Yciar, 1564", hoja: "lenguaje", bloque: "f1", escritorio: [66, 47, 13, 1, -3], movil: [38, 21, 21, 1, -4] },
  { archivo: "lenguaje-muestrario", forma: ["..#", ".##", "###"], asignatura: "Lenguaje", obra: "Muestrario de Westtown", fuente: "Westtown, 1801", hoja: "lenguaje", bloque: "f2", escritorio: [8, 46, 11, 0, -5] },
  { archivo: "lenguaje-enie", forma: ["#"], asignatura: "Lenguaje", obra: "Ñ en tipo móvil", fuente: "Pieza propia", figura: ejemplo("escritura-completar"), escritorio: [93, 77, 11, 1, 5], movil: [93, 29, 17, 1, 6] },
  { archivo: "matematica-byrne-cuadrados", forma: ["#..", "##.", "###"], asignatura: "Matemática", obra: "Elementos de Euclides", fuente: "Byrne, 1847", figura: ejemplo("geometria-pitagoras"), escritorio: [19, 25, 10, 0, 7], movil: [8, 18, 16, 0, 7] },
  { archivo: "ciencias-diatomeas", forma: ["#"], asignatura: "Ciencias Naturales", obra: "Kunstformen der Natur", fuente: "Haeckel, 1904", figura: ejemplo("cadena_trofica-marina"), escritorio: [97, 22, 12, 1, -7] },
  { archivo: "ciencias-espectro", forma: ["#.", "##"], asignatura: "Ciencias Naturales", obra: "Espectro con líneas de Fraunhofer", fuente: "Pieza propia", figura: ejemplo("optica-prisma"), escritorio: [63, 7, 9, 0, 4] },
  { archivo: "ciencias-andes", forma: ["#"], asignatura: "Ciencias Naturales", obra: "Argentina, Chile y la cordillera de los Andes", fuente: "NASA, 2019", figura: ejemplo("climograma-desierto"), escritorio: [41, 47, 9, 0, -6] },
  { archivo: "ciencias-loica", forma: ["#..", "##.", "###"], asignatura: "Ciencias Naturales", obra: "Atlas de la historia física y política de Chile", fuente: "Gay, 1854", figura: pedido("cadena_trofica", "Cadena de una pradera de Chile central", { organismos: [{ nombre: "Pasto", ilustracion: "pasto" }, { nombre: "Saltamontes", ilustracion: "saltamontes" }, { nombre: "Loica", ilustracion: "pajaro" }, { nombre: "Aguilucho", ilustracion: "aguila" }] }, { width: 510, letra: "mediana" }), escritorio: [55, 93, 9, 0, 3] },
  { archivo: "historia-portulano", forma: ["#"], asignatura: "Historia", obra: "Carta portulana de la costa del Pacífico", fuente: "Portulano, hacia 1500", figura: ejemplo("mapa-barrio"), escritorio: [86, 7, 10, 0, -3] },
  { archivo: "matematica-hirschvogel", forma: ["#.", "##"], asignatura: "Matemática", obra: "Anweysung in die Geometria", fuente: "Hirschvogel, 1543", figura: ejemplo("geometria-hexagono"), escritorio: [29, 6, 8, 0, 5] },
  { archivo: "lenguaje-araucana", forma: ["#.", "##"], asignatura: "Lenguaje", obra: "La Araucana", fuente: "Ercilla, 1574", figura: ejemplo("secuencia-relato"), escritorio: [99, 92, 11, 0, -4], movil: [6, 44, 15, 0, -4] },
];
