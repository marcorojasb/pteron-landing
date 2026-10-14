/**
 * Contenido de las hojas y láminas del inicio. Los bloques siguen el contrato DocumentBlock de pteron
 * (src/shared/contracts.ts) y las figuras son pedidos del kit pteron-design (formato 3): el generador
 * scripts/pteron-hojas.mjs los compone con el mismo código de la app, sin reinterpretarlos.
 */

const ejemplo = (id, extra = {}) => ({ ejemplo: id, ...extra });
const pedido = (type, titulo, data, extra = {}) => ({ pedido: { schemaVersion: 3, type, titulo, data, ...extra } });
const f = (n, d) => `\\(\\frac{${n}}{${d}}\\)`;

/**
 * Cuatro materiales, uno por asignatura. `figura` enlaza un bloque con el pedido de su figura; su `text` es el pie, que
 * sólo se escribe cuando dice algo que el enunciado no dice. Cada hoja, en sus dos versiones, cabe en una página
 * oficio: el inicio la muestra en un marco de ese alto.
 */
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
      { id: "r", kind: "note", text: "Recuerda: la Luna no tiene luz propia. En los dibujos, la parte blanca es la que ilumina el Sol." },
      {
        id: "q1",
        kind: "question",
        // Los dibujos van con números para que no se confundan con las letras de las alternativas
        text: "¿Cómo se llama la fase del dibujo 3?",
        points: 1,
        skill: "comprender",
        choices: [
          { id: "A", text: "Luna nueva" },
          { id: "B", text: "Cuarto creciente" },
          { id: "C", text: "Cuarto menguante" },
          { id: "D", text: "Luna llena", correct: true },
        ],
      },
      {
        id: "f1",
        kind: "figure",
        text: "Las cuatro fases, vistas desde Chile",
        figura: pedido("fases_luna", "Las cuatro fases principales", { rotulos: "propios", textos: ["1", "2", "3", "4"] }, { width: 200, letra: "grande" }),
      },
      {
        id: "q2",
        kind: "question",
        text: "La luz del Sol llega desde la izquierda. ¿En qué posición de su órbita está la Luna cuando desde la Tierra se ve llena? Escribe la letra y explica por qué.",
        points: 2,
        skill: "aplicar",
        expectedAnswer: "En la posición E: la Luna está al lado opuesto del Sol y la Tierra ve toda su cara iluminada.",
        gradingCriterion: "1 punto por la letra E y 1 punto por explicar que la Luna está al lado opuesto del Sol.",
      },
      { id: "f2", kind: "figure", text: "La Luna en su órbita, vista desde arriba", figura: pedido("fases_luna", "La Luna en su órbita", { vista: "orbita" }, { width: 270, letra: "mediana" }) },
      { id: "a2", kind: "answer", text: "", lines: 2 },
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
          totalScore: 6,
        },
      },
      { id: "k", kind: "note", text: "Idea clave: una línea de tiempo ordena los hechos y muestra cuánto dura cada período." },
      {
        id: "q1",
        kind: "question",
        text: "Observa la línea de tiempo. ¿Qué período duró más?",
        points: 1,
        skill: "comprender",
        choiceLayout: "fila",
        choices: [
          { id: "A", text: "La Conquista" },
          { id: "B", text: "La Colonia", correct: true },
          { id: "C", text: "La Independencia" },
        ],
      },
      {
        id: "f1",
        kind: "figure",
        text: "",
        figura: pedido("linea_tiempo", "Períodos de la historia de Chile", {
          desde: 1500,
          hasta: 1850,
          paso: 50,
          periodos: [
            { desde: 1536, hasta: 1598, rotulo: "Conquista", tono: "ambar" },
            { desde: 1598, hasta: 1810, rotulo: "Colonia", tono: "azul" },
            { desde: 1810, hasta: 1823, rotulo: "Independencia", tono: "verde" },
          ],
          hitos: [
            { fecha: 1541, rotulo: "Fundación de Santiago" },
            { fecha: 1818, rotulo: "Declaración de la Independencia" },
          ],
        }, { width: 510, letra: "mediana", descripcion: "Línea de tiempo de 1500 a 1850 con la Conquista (1536 a 1598), la Colonia (1598 a 1810) y la Independencia (1810 a 1823), y dos hechos: 1541, fundación de Santiago, y 1818, Declaración de la Independencia." }),
      },
      {
        id: "q2",
        kind: "question",
        text: "¿Cuántos años pasaron entre la fundación de Santiago y la Declaración de la Independencia? Escribe la operación.",
        points: 2,
        skill: "aplicar",
        expectedAnswer: "1818 − 1541 = 277 años.",
        gradingCriterion: "1 punto por la operación y 1 punto por el resultado.",
      },
      { id: "a2", kind: "answer", text: "", lines: 1 },
      {
        id: "q3",
        kind: "question",
        // 1647 no está marcado: se ubica con la escala de la línea
        text: "¿En qué período ocurrió cada hecho? Ubica su año en la línea de tiempo y completa la tabla.",
        points: 3,
        skill: "analizar",
        expectedAnswer: "Fundación de Santiago: Conquista. Gran terremoto de Santiago: Colonia. Declaración de la Independencia: Independencia.",
        gradingCriterion: "1 punto por cada período correcto.",
      },
      {
        id: "t3",
        kind: "table",
        text: "",
        table: {
          cornerHeader: "Hecho",
          rowHeaders: ["Fundación de Santiago (1541)", "Gran terremoto de Santiago (1647)", "Declaración de la Independencia (1818)"],
          columnHeaders: ["Período"],
          cells: [[""], [""], [""]],
        },
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
          course: "5° básico",
          studentNameField: true,
          durationMinutes: 45,
          purpose: "formativa",
          totalScore: 4,
        },
      },
      { id: "k", kind: "note", text: "Idea clave: dos fracciones son equivalentes cuando representan la misma parte de un entero." },
      // De lo concreto a lo simbólico: pintar en la barra y escribir en la recta (la ventana del inicio cuenta este plan)
      {
        id: "q1",
        kind: "question",
        text: `Pinta ${f(3, 4)} de la segunda barra y escribe qué fracción pintaste.`,
        points: 2,
        skill: "aplicar",
        expectedAnswer: `9 de las 12 partes pintadas: ${f(9, 12)}.`,
      },
      {
        id: "f1",
        kind: "figure",
        text: "",
        // Cada barra lleva su fracción debajo, escrita o por escribir: todas del mismo lado
        figura: pedido("fracciones", "Fracciones equivalentes a tres cuartos", {
          modelos: [
            { partes: 4, sombreadas: 3, fraccion: "mostrar" },
            { partes: 12, fraccion: "casillas" },
          ],
        }, { width: 260, letra: "mediana" }),
      },
      {
        id: "q2",
        kind: "question",
        text: `¿Qué fracción en sextos está en el mismo lugar que ${f(2, 3)}? Escríbela en la casilla.`,
        points: 2,
        skill: "comprender",
        expectedAnswer: f(4, 6),
      },
      {
        id: "f2",
        kind: "figure",
        text: "",
        // Los sextos se escriben sin simplificar: 2/6 y 3/6, no 1/3 y 1/2
        figura: pedido("recta", "Tercios y sextos en la recta", {
          min: 0,
          max: 1,
          paso: "1/3",
          formato: "fraccion",
          rotulo: "Tercios",
          flechas: "ninguna",
          comparar: [{
            rotulo: "Sextos",
            paso: "1/6",
            formato: "fraccion",
            rotulos: [{ valor: "2/6", texto: "2/6" }, { valor: "3/6", texto: "3/6" }, { valor: "4/6", texto: "?" }],
          }],
        }, { width: 340, letra: "mediana", descripcion: "Dos rectas numéricas de 0 a 1, una en tercios y otra en sextos, con una casilla vacía en la marca de los sextos que está bajo 2/3." }),
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
      { id: "i", kind: "note", text: "Toma el lápiz con suavidad y apoya cada letra en la línea más oscura." },
      {
        id: "q1",
        kind: "question",
        text: "Repasa las palabras punteadas y después escribe cada una sin ayuda.",
        points: 3,
        skill: "aplicar",
        gradingCriterion: "1 punto por cada palabra repasada y escrita sobre la línea de base.",
      },
      { id: "f1", kind: "figure", text: "", figura: ejemplo("escritura-caligrafia") },
      {
        id: "q2",
        kind: "question",
        text: "Separa cada palabra en sílabas. Escribe una sílaba en cada casilla.",
        points: 3,
        skill: "analizar",
        expectedAnswer: "ma-ri-po-sa, co-ne-jo, ra-na.",
        gradingCriterion: "1 punto por cada palabra bien separada.",
      },
      {
        id: "f2",
        kind: "figure",
        text: "",
        // Tres animales dibujados en el mismo trazo, de cuatro, tres y dos sílabas directas
        figura: pedido("escritura", "Separar en sílabas", {
          modo: "silabas",
          palabras: [
            { palabra: "mariposa", silabas: ["ma", "ri", "po", "sa"], ilustracion: "mariposa" },
            { palabra: "conejo", silabas: ["co", "ne", "jo"], ilustracion: "conejo" },
            { palabra: "rana", silabas: ["ra", "na"], ilustracion: "rana" },
          ],
        }, { width: 510, letra: "grande" }),
      },
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
