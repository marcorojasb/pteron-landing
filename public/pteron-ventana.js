/* pteron · la ventana de la app en la web (2026-10-25.8)
   1. Reconocimiento del pedido: copia fiel de pteron/src/shared/context-recognition.ts (ADR-161), con las listas de
      asignaturas-de-3-y-4.ts. Es local, sin modelo: el mismo diccionario del currículum chileno y las mismas reglas que la app.
   2. Aviso antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049). El inicio lo usa en
      «En tu computador» (inicio.js).
   3. La ronda: copia fiel de pteron/src/renderer/src/lib/ronda.ts (ADR-193), la marca de actividad que piensa, trabaja o espera.
   4. La ventana de pteron de «Cómo funciona»: el marcado de los componentes de la app, que pteron-app.css dibuja con
      las reglas de la app, y la secuencia de un pedido. scripts/pteron-ventana.mjs usa las mismas plantillas para
      escribir en index.html la ventana en reposo. */
(() => {
  "use strict";

  /* ---------- 1. Reconocimiento (context-recognition.ts, con las listas de asignaturas-de-3-y-4.ts) ---------- */
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
  // Un nivel de Adultos (EPJA) del catálogo: 1° a 3° nivel básico, 1° y 2° nivel medio
  const adultLevelOf = (level, grade) =>
    grade >= 1 && grade <= (level === "basico" ? 3 : 2) ? `${grade}° nivel ${level === "basico" ? "básico" : "medio"}` : null;
  // «1° medio EPJA», «8° básico vespertino»: el nivel de Adultos que contiene ese curso, si la señal va junto a él
  function enAdultos(folded, course, end) {
    if (!/^\s*(?:de\s+(?:la\s+|los\s+)?)?(?:epja|adultos|vespertin[oa]|nocturn[oa]|cead)\b/u.test(folded.slice(end))) return course;
    const medio = /^(IV|I{1,3}) medio$/u.exec(course);
    if (medio) return adultLevelOf("medio", ROMAN.indexOf(medio[1]) < 2 ? 1 : 2) ?? course;
    const basico = /^([1-8])° básico$/u.exec(course);
    if (!basico) return course;
    const n = Number(basico[1]);
    return adultLevelOf("basico", n <= 4 ? 1 : n <= 6 ? 2 : 3) ?? course;
  }

  const COURSE_PATTERNS = [
    [new RegExp(String.raw`\b([1-8])${SUFFIX}${YEAR}\s*(basico|medio)\b`, "u"), (m) => courseOf(m[2], Number(m[1]))],
    [new RegExp(String.raw`\b(iv|i{1,3})\s*°?${YEAR}\s+medio\b`, "u"), (m) => `${m[1].toUpperCase()} medio`],
    [new RegExp(String.raw`\b(${Object.keys(ORDINAL).join("|")})${YEAR}\s+(basico|medio)\b`, "u"), (m) => courseOf(m[2], ORDINAL[m[1]])],
    // Adultos: «1° nivel medio», «I° nivel medio», «primer nivel básico»
    [
      new RegExp(String.raw`\b(?:([1-3])${SUFFIX}|(i{1,3})\s*°?|(${Object.keys(ORDINAL).join("|")}))\s*nivel\s+(basico|medio)\b`, "u"),
      (m) => adultLevelOf(m[4], m[1] ? Number(m[1]) : m[2] ? ROMAN.indexOf(m[2].toUpperCase()) + 1 : ORDINAL[m[3]]),
    ],
    // Parvularia, con los nombres de las Bases y de los colegios
    [/\b(?:pre\s*-?\s*kinder|nt\s*1|(?:1|primer)\s*°?\s*nivel\s+de\s+transicion)\b/u, () => "Pre-kínder"],
    [/\b(?:kinder|nt\s*2|(?:2|segundo)\s*°?\s*nivel\s+de\s+transicion)\b/u, () => "Kínder"],
    [/\bsala\s+cuna\b/u, () => "Sala Cuna"],
    [/\b(?:nivel\s+)?medio\s+menor\b/u, () => "Medio Menor"],
    [/\b(?:nivel\s+)?medio\s+mayor\b/u, () => "Medio Mayor"],
  ];

  // Un nombre como patrón (sin tildes, con espacios flexibles y su coma opcional) y como se compara lo leído con él
  const asPattern = (name) =>
    fold(name)
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      .replace(/,\s*/gu, ",?\\s*")
      .replace(/\s+/gu, "\\s+");
  const nameKey = (text) =>
    fold(text)
      .replace(/[\s,]+/gu, " ")
      .trim();
  // Lo que sólo se reconoce tras su rótulo («especialidad Contabilidad», «módulo de Atención de clientes»), el más largo primero
  function afterLabel(label, names) {
    const byKey = new Map(names.map((name) => [nameKey(name), name]));
    const alternatives = [...names].sort((a, b) => b.length - a.length).map(asPattern);
    return [new RegExp(String.raw`\b${label}(?:\s+(?:de|del))?\s+(${alternatives.join("|")})\b`, "u"), (m) => byKey.get(nameKey(m[1])) ?? null];
  }

  // asignaturas-de-3-y-4.ts: los electivos HC que se reconocen por su nombre y, tras su rótulo, la TP
  const ELECTIVOS_HC = [
    "Límites, derivadas e integrales", "Geometría 3D", "Probabilidades y estadística descriptiva e inferencial",
    "Pensamiento computacional y programación", "Biología celular y molecular", "Biología de los ecosistemas",
    "Ciencias de la salud", "Lectura y escritura especializadas", "Participación y argumentación en democracia",
    "Comprensión histórica del presente", "Economía y sociedad", "Geografía, territorio y desafíos socioambientales",
    "Filosofía política", "Seminario de filosofía", "Artes visuales, audiovisuales y multimediales",
    "Creación y composición musical", "Diseño y arquitectura", "Interpretación y creación en danza",
    "Interpretación y creación en teatro", "Ciencias del ejercicio físico y deportivo",
    "Promoción de estilos de vida activos y saludables"
  ];
  const ESPECIALIDADES_TP = [
    "Administración", "Contabilidad", "Agropecuaria", "Elaboración Industrial de Alimentos", "Gastronomía",
    "Vestuario y Confección Textil", "Construcción", "Instalaciones Sanitarias", "Montaje Industrial",
    "Refrigeración y Climatización", "Electricidad", "Electrónica", "Dibujo Técnico", "Gráfica",
    "Servicios de Hotelería", "Servicios de Turismo", "Forestal", "Muebles y Terminaciones en Madera", "Acuicultura",
    "Operaciones Portuarias", "Pesquería", "Tripulación de Naves Mercantes y Especiales", "Construcciones Metálicas",
    "Mecánica Automotriz", "Mecánica de Mantenimiento de Aeronaves", "Mecánica Industrial", "Asistencia en Geología",
    "Explotación Minera", "Metalúrgica Extractiva", "Química Industrial", "Atención de Enfermería",
    "Atención de Párvulos", "Conectividad y Redes", "Programación", "Telecomunicaciones"
  ];
  const MODULOS_TP = [
    "Utilización de información contable", "Gestión comercial y tributaria", "Procesos administrativos",
    "Atención de clientes", "Organización de oficinas", "Aplicaciones informáticas para la gestión administrativa",
    "Legislación laboral", "Cálculo de remuneración, finiquitos y obligaciones laborales",
    "Desarrollo y bienestar de personal", "Dotación de personal", "Operaciones de almacenamiento",
    "Operaciones de bodega", "Logística y distribución", "Seguridad en bodegas", "Emprendimiento y empleabilidad",
    "Contabilización de operaciones comerciales", "Cálculo y registro de remuneraciones",
    "Control y procesamiento de información contable", "Organización y métodos de trabajo en la oficina",
    "Elaboración de informes contables", "Cálculo y registro de impuestos",
    "Registro de operaciones de comercio nacional e internacional",
    "Procesamiento de información contable-financiera", "Manejo de suelo y residuos", "Manejo de técnicas de riego",
    "Técnicas de reproducción vegetal", "Alimentación y pesaje pecuario", "Control de plagas y enfermedades",
    "Técnicas de cultivo de especies vegetales", "Manejos para optimización productiva de frutales",
    "Postcosecha y guarda de productos agrícolas", "Mantenimiento de maquinarias y equipos agrícolas",
    "Manejos pecuarios", "Reproducción animal", "Producción lechera", "Sanidad y bienestar animal",
    "Cultivo de praderas y forrajes", "Viticultura", "Cosecha y transporte de vides", "Elaboración de vinos",
    "Envasado y maquinaria vitivinícola", "Manejo de bodegas vitivinícolas", "Recepción de materias primas",
    "Almacenaje y bodega de alimentos e insumos alimentarios", "Elaboración de alimentos e higiene",
    "Aseguramiento de la calidad de procesos y alimentos", "Tratamientos de conservación de alimentos",
    "Control y registro de procesos de la industria de alimentos", "Manejo de desechos de la industria de alimentos",
    "Envasado y rotulación de alimentos", "Higiene para la elaboración de alimentos",
    "Elaboración de alimentos de baja complejidad", "Recepción y almacenamiento de insumos",
    "Planificación de la producción gastronómica", "Preparación, diseño y montaje de buffet",
    "Servicio de comedores, bares y salones", "Cocina chilena", "Innovación y cocina internacional",
    "Elaboración de bebidas alcohólicas y analcohólicas", "Elaboración de menús y cartas",
    "Elaboración de masas y pastas", "Elaboración de productos de repostería",
    "Elaboración de productos de pastelería", "Innovación en la pastelería y repostería", "Patronaje computacional",
    "Elaboración de fichas técnicas", "Mantenimiento de máquinas", "Tendido, trazado y corte de telas",
    "Confección y terminaciones", "Diseño computacional de artículos y vestuario", "Patronaje y escalado industrial",
    "Procesos de confección industrial", "Control de calidad",
    "Análisis de muestras de hormigón, suelos y materiales", "Carpintería de instalación de faenas",
    "Control y mantenimiento de bodegas y pañoles", "Cubicación de materiales e insumos",
    "Interpretación de planos de construcción", "Prevención de riesgos en la construcción",
    "Trazado de obras de construcción", "Albañilerías estructurales y no estructurales", "Carpintería estructural",
    "Enfierradura para elementos estructurales", "Estructuras de hormigón",
    "Impermeabilización y aislación de elementos",
    "Instalación de cubiertas y elementos de evacuación de aguas lluvias",
    "Instalación de muebles, puertas y ventanas", "Revestimientos para pisos, muros y cielos",
    "Calidad en obras viales e infraestructura", "Seguridad vial", "Mantenimiento de obras viales",
    "Conformación de la calzada", "Infraestructura para la protección de la calzada",
    "Lectura de planos de instalaciones sanitarias", "Trazado de redes", "Instalación de redes de agua potable",
    "Instalación de redes de alcantarillado", "Instalación de redes para riego agrícola",
    "Cubicación en instalaciones sanitarias", "Instalación de artefactos sanitarios", "Instalación de gas",
    "Mantenimiento de redes y artefactos", "Unión y reparación de elementos metálicos",
    "Dibujo e interpretación de planos de montaje", "Mediciones, trazados y cálculos de montaje industrial",
    "Maniobras de levante de cargas", "Tratamientos superficiales y manejo de residuos",
    "Fijación y montaje de elementos", "Mantenimiento industrial", "Cubicación de proyectos",
    "Lectura de planos y cubicación de materiales de proyectos", "Instrumentos de medición y verificación",
    "Instalación y montaje de redes de refrigeración y climatización", "Instalación y montaje de equipos",
    "Puesta en marcha de equipos de refrigeración y climatización",
    "Diagnóstico de sistemas de refrigeración y climatización",
    "Mantención de sistemas de refrigeración y climatización", "Reciclaje y almacenamiento de refrigerantes",
    "Instalación de motores eléctricos y equipos de calefacción", "Instalaciones eléctricas domiciliarias",
    "Elaboración de proyectos eléctricos", "Mantenimiento de máquinas, equipos y sistemas eléctricos",
    "Instalación de sistemas de control eléctrico industrial", "Instalaciones eléctricas industriales",
    "Instalación de equipos electrónicos de potencia", "Automatización de sistemas eléctricos industriales",
    "Proyectos electrónicos", "Armado y reparación de circuitos electrónicos",
    "Ensamblaje y mantención de sistemas y equipos digitales", "Sistemas de control domótico",
    "Mantención y operación de equipos de control electrónico de potencia", "Detección de fallas industriales",
    "Operación y programación de equipos de control eléctrico industrial", "Montaje de equipos industriales",
    "Automatización industrial", "Lectura de planos y documentos técnicos", "Dibujo manual de levantamientos",
    "Dibujo digital de proyectos de arquitectura", "Dibujo digital de piezas y conjuntos mecánicos",
    "Maquetas virtuales", "Dibujo digital de instalaciones domiciliarias",
    "Dibujo digital de sistemas constructivos", "Dibujo digital de montaje industrial",
    "Impresión y reproducción de planos", "Verificación y preparación de archivos digitales",
    "Preparación de la máquina impresora", "Impresión del producto gráfico",
    "Materiale e insumos de la industria gráfica", "Encuadernación del producto impreso",
    "Imposición de archivos y obtención de prueba de color",
    "Salida del archivo a matriz impresora e impresión digital",
    "Postimpresión en embalajes y recubrimientos a impresos", "Atención al cliente en servicios de hotelería",
    "Servicio de habitaciones", "Actividades recreativas y de animación", "Servicio de eventos",
    "Inglés técnico para la industria de la hospitalidad", "Información turística",
    "Servicio de recepción y reservas", "Servicio de coctelería y vinos", "Servicio de información bilingüe",
    "Sistemas de reservas", "Atención turística al cliente", "Patrimonio, Cultura y atractivos turísticos de Chile",
    "Prevención y seguridad en programas turísticos", "Inglés para la comunicación oral en turismo",
    "Patrimonio, cultura y atractivos turísticos del mundo", "Conducción de grupos turísticos",
    "Elaboración de programas turísticos", "Inglés para la comunicación escrita en turismo",
    "Producción de plantas y repoblación", "Mediciones forestales", "Control de plagas y enfermedades forestales",
    "Uso y mantenimiento de herramientas y máquinas", "Operaciones silvícolas", "Operaciones de cosecha forestal",
    "Control de la producción forestal", "Técnicas de prevención y combate de incendios forestales",
    "Abastecimiento y despacho", "Fabricación de componentes de carpintería y muebles", "Cubicaciones",
    "Aseguramiento de la calidad, seguridad y cuidado del medio ambiente",
    "Representación gráfica de muebles y elementos de carpintería", "Armado de estructuras",
    "Terminaciones de muebles y elementos de carpintería", "Instalación de muebles y elementos de carpintería",
    "Mantenimiento de máquinas, equipos y herramientas",
    "Manejo de reproductores, desove y crías de larvas de especies hidrobiológicas", "Engorde de especies acuícolas",
    "Operación de sistemas, equipos y maquinarias", "Seguridad, prevencion de riesgos y cuidado del medio ambiente",
    "Cosecha de especies acuícolas", "Captación de semillas", "Trabajos subacuáticos en acuicultura",
    "Manejo de información acuícola", "Documentación en la operación portuaria",
    "Consolidación y desconsolidación de contenedores", "Seguridad y prevención de riesgos en faenas portuarias",
    "Operación de movilización y distribución de cargas",
    "Tramitación y documentación de recepción y despacho de carga", "Estiba y desestiba de naves mercantes",
    "Tramitación de movilización y distribución de cargas",
    "Organización y almacenamiento de cargas en zonas de depósito", "Navegación y meteorología",
    "Armado, mantenimiento y reparación de implementos de pesca",
    "Tratamientos de conservación y manipulación de recursos hidrobiológicos", "Prevención de riesgos en el mar",
    "Primeros auxilios", "Maniobras y operación de artes de pesca",
    "Gestión de planes y proyectos de manejo y emprendimiento pesquero", "Comunicaciones marítimas",
    "Operación de equipos de maniobras de cubierta", "Mantenimiento de máquinas de cubierta",
    "Operación puente de gobierno", "Operación de máquinas propulsoras y auxiliares",
    "Mantenimiento de máquinas marinas", "Comunicaciones", "Lectura y dibujo de planos en construcciones metálicas",
    "Trazado de partes y piezas en construcciones metálicas",
    "Mantenimiento de equipos y herramientas en construcciones metálicas", "Mecanizado de partes y piezas metálicas",
    "Corte y soldadura en construcciones metálicas", "Armado y montaje en construcciones metálicas",
    "Protección de estructuras y tratamientos de residuos",
    "Cubicación de materiales e insumos en construcciones metálicas", "Ajuste de motores",
    "Lectura de planos y manuales técnicos", "Manejo de residuos y desechos automotrices",
    "Mantenimiento de sistemas de seguridad y confortabilidad",
    "Mantenimiento de sistemas eléctricos y electrónicos", "Mantenimiento de motores",
    "Mantenimiento de sistemas hidráulicos y neumáticos", "Mantenimiento de los sistemas de transmisión y frenos",
    "Mantenimiento de sistemas de dirección y suspensión",
    "Reparación y remplazo de elementos estructurales de la aeronave",
    "Detección de fallas en instrumentos y sistemas de navegación y comunicación",
    "Mantenimiento de los controles de vuelo de la aeronave",
    "Inglés técnico de estructura, controles de vuelo y sistemas de navegación y comunicación",
    "Lectura e interpretación de manuales de mantenimiento de aeronaves", "Normativa de mantenimiento aeronáutico",
    "Mantenimiento de las unidades y sistemas asociados al motor recíproco",
    "Mantenimiento de las unidades y sistemas asociados al motor a reacción",
    "Mantenimiento de los sistemas de la aeronave", "Inglés técnico de motores y sistemas de la aeronave",
    "Soldadura industrial", "Mantenimiento de herramientas", "Medición y verificación", "Mecánica de banco",
    "Lectura de manuales y planos", "Mantenimiento y reparación industrial",
    "Detección de fallas en sistemas industriales", "Control de procesos industriales",
    "Montaje de equipos y sistemas industriales", "Torneado de piezas y conjuntos mecánicos",
    "Fresado de piezas y conjuntos mecánicos", "Taladrado y rectificado de piezas mecánicas",
    "Mecanizado con máquinas de control numérico computacional", "Fabricación de matrices", "Fabricación de moldes",
    "Mantenimiento de matrices y moldes", "Diseño y dibujo de moldes y matrices",
    "Preparación e instalación de campamentos", "Marco legal y seguridad en geología",
    "Clasificación de rocas y minerales", "Lectura y elaboración de mapas topográficos y geológicos",
    "Prospección geológica con sondajes", "Técnicas de muestreo geológico",
    "Registro y transferencia de información geológica", "Transporte y mantenimiento de equipos e instrumentos",
    "Lectura de planos de ubicación y de tronadura", "Fortificación de minas subterráneas y a cielo abierto",
    "Perforación y tronadura en faenas mineras", "Marco legal y seguridad en plantas de explotación minera",
    "Ventilación secundaria y drenaje de minas", "Muestreo en explotaciones mineras",
    "Cubicación, carguío y transporte", "Chancado primario de minerales", "Laboratorio y análisis químico",
    "Muestreo y control de procesos", "Control de inventario", "Legislación y prevención de riesgos en la minería",
    "Transformación mecánica de los minerales", "Acondicionamiento químico de los minerales",
    "Técnicas de hidrometalurgia", "Fundición y refinería", "Manejo y almacenamiento seguro de materiales",
    "Técnicas, procesos y equipos de laboratorio", "Fabricación de productos industriales",
    "Cuidado del medioambiente y tratamiento de residuos", "Transferencia de calor y operaciones unitarias",
    "Acondicionamiento de sólidos y control automático", "Muestreo de productos industriales",
    "Mantenimiento de sistemas auxiliares", "Toma de muestra", "Preparación de muestras para análisis orgánico",
    "Técnicas de análisis físico-químico", "Técnicas de análisis instrumental",
    "Mantenimiento de equipos e instrumentos de laboratorio", "Aplicación de cuidados básicos",
    "Medición y control de parámetros básicos en salud", "Promoción de la salud y prevención de la enfermedad",
    "Higiene y bioseguridad del ambiente", "Sistemas de registro e información en salud",
    "Prevención y control de infecciones intrahospitalarias", "Necesidades psicosociales del adulto mayor",
    "Orientación familiar para el cuidado del adulto mayor", "Alimentación y nutrición del adulto mayor",
    "Atención de primeros auxilios del adulto mayor", "Administración de medicamentos",
    "Higiene y confort del adulto mayor", "Técnicas básicas de enfermería y del Programa Nacional de inmunizaciones",
    "Atención en servicios de urgencia y primeros auxilios", "Preparación del entorno clínico",
    "Material didáctico y de ambientación", "Expresión musical para párvulos", "Relación con la familia",
    "Salud en párvulos", "Recreación y bienestar de los párvulos", "Actividades educativas para párvulos",
    "Expresión literaria y teatral con párvulos", "Alimentación de los párvulos",
    "Higiene y seguridad de los párvulos", "Instalación de redes de área local cableadas e inalámbricas",
    "Ensamblado y configuración de computadores y equipos terminales portátiles",
    "Instalación y explotación de software de aplicaciones productivas",
    "Configuración y puesta en servicio de aplicaciones en redes de área local",
    "Configuración de la seguridad en redes de área local",
    "Mantenimiento y actualización de hardware en redes de área local",
    "Mantenimiento y actualización de software en redes de área local",
    "Recuperación y respaldo de información en redes de área local", "Programación y bases de datos",
    "Instalación y configuración de equipos informáticos", "Soportes a usuarios y productividad",
    "Sistemas operativos", "Diseño de bases de datos relacionales", "Programación orientada a objetos",
    "Administración de bases de datos", "Desarrollo de aplicaciones web",
    "Operaciones y fundamentos de las Telecomunicaciones",
    "Instalación y mantenimiento básico de un terminal informático", "Instalación y configuración de redes",
    "Mantenimiento de circuitos electrónicos básicos", "Instalación de servicios básicos de telecomunicaciones",
    "Comunicaciones inalámbricas", "Instalación de redes telefónicas convergentes", "Sistemas operativos de redes",
    "Mantenimiento de redes de acceso y banda ancha"
  ];

  const SUBJECT_ALIASES = [
    ["Historia, Geografía y Cs. Sociales", ["historia", "geografia", "ciencias sociales", "formacion ciudadana"]],
    ["Ciencias Naturales", ["ciencias naturales", "ciencias"]],
    ["Biología", ["biologia"]],
    ["Química", ["quimica"]],
    ["Física", ["fisica"]],
    ["Ciencias para la Ciudadanía", ["ciencias para la ciudadania"]],
    ["Educación Ciudadana", ["educacion ciudadana"]],
    ["Filosofía", ["filosofia"]],
    ["Lenguaje y Comunicación", ["lenguaje", "lengua y literatura", "comprension lectora"]],
    ["Matemática", ["matematicas", "matematica", "mate"]],
    ["Educación Física y Salud", ["educacion fisica", "ed\\.? fisica"]],
    ["Inglés", ["ingles", "english"]],
    ["Artes Visuales", ["artes visuales", "artes", "arte"]],
    ["Música", ["musica"]],
    ["Tecnología", ["tecnologia"]],
    ["Orientación", ["orientacion"]],
    ["Religión", ["religion"]],
    ["Consejo de curso", ["consejo de curso"]],
    ["Contabilidad", ["contabilidad"]],
    ...[
      "Lenguaje verbal",
      "Lenguajes artísticos",
      "Pensamiento matemático",
      "Exploración del entorno natural",
      "Comprensión del entorno sociocultural",
      "Identidad y autonomía",
      "Convivencia y ciudadanía",
      "Corporalidad y movimiento",
      "Emprendimiento y empleabilidad",
      ...ELECTIVOS_HC,
    ].map((name) => [name, [asPattern(name)]]),
  ];
  const SUBJECT_PATTERNS = SUBJECT_ALIASES.map(([subject, aliases]) => [new RegExp(String.raw`\b(?:${aliases.join("|")})\b`, "u"), () => subject]);
  // Las especialidades y los módulos de la TP: sus patrones se arman la primera vez que un pedido trae el rótulo
  let tpPatterns = null;
  function subjectHit(folded) {
    if (!/especialidad|modulo/u.test(folded)) return firstHit(folded, SUBJECT_PATTERNS);
    tpPatterns ??= [
      ["especialidad", afterLabel("especialidad", ESPECIALIDADES_TP)],
      ["modulo", afterLabel("modulos?", MODULOS_TP)],
    ];
    const deLaTp = tpPatterns.filter(([label]) => folded.includes(label)).map(([, pattern]) => pattern);
    return firstHit(folded, [...SUBJECT_PATTERNS, ...deLaTp]);
  }

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
        const subject = subjectHit(rest);
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
        subjectHit(inner),
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
      if (subjectHit(foldedTopic)?.end === foldedTopic.length) continue;
      if (firstHit(foldedTopic, COURSE_PATTERNS) || firstHit(foldedTopic, INTENT_PATTERNS)) continue;
      if (/^(?:mi|mis|tu|tus|este|esta|estos|estas|clase|curso|alumnos?|estudiantes?)\b/u.test(foldedTopic)) continue;
      return topic;
    }
    return null;
  }

  // Física, Química y Biología son asignaturas en III y IV medio; en un curso anterior, ejes de Ciencias Naturales
  const ejeDeCiencias = (subject, course) =>
    course && ["Física", "Química", "Biología"].includes(subject) && !/^(?:III|IV) medio$/u.test(course) ? "Ciencias Naturales" : subject;

  function recognize(text) {
    const original = String(text || "").normalize("NFC");
    const folded = fold(original);
    if (folded.trim().length < 3) return [];
    const found = [];
    const intent = firstHit(folded, INTENT_PATTERNS);
    if (intent) found.push({ field: "artifactIntent", value: intent.value, label: INTENT_NAME[intent.value] });
    const course = firstHit(folded, COURSE_PATTERNS);
    const courseValue = course ? enAdultos(folded, course.value, course.end) : undefined;
    if (courseValue) found.push({ field: "course", value: courseValue, label: courseValue });
    const subject = subjectHit(folded);
    if (subject) {
      const value = ejeDeCiencias(subject.value, courseValue);
      found.push({ field: "subject", value, label: value });
    }
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

  // Lo reconocido que todavía no está en el contexto; aplicar lo confirmado (cambiar curso o asignatura suelta el OA)
  const same = (a, b) => fold(a ?? "").trim() === fold(b).trim();
  const pendingSuggestions = (text, context) => recognize(text).filter((item) => !same(context[item.field], item.value));
  function applySuggestion(context, item) {
    if (item.field === "artifactIntent") return { ...context, artifactIntent: item.value };
    if (item.field === "course" || item.field === "subject") {
      const keepsOa = item.field === "course" ? same(context.course, item.value) : same(context.subject, item.value);
      return { ...context, [item.field]: item.value, oa: keepsOa ? context.oa : undefined };
    }
    return { ...context, [item.field]: item.value };
  }

  /* ---------- 2. Salvaguarda antes de la nube: copia fiel de pteron/src/shared/student-privacy.ts (ADR-049) ----------
     Sólo dos hechos identificables: un RUT con formato chileno o un nombre con valor en un campo de persona (o en la
     ficha de una persona). De aquí, lo que el aviso usa: detectar, las pistas, excluir, el mensaje y la vista previa
     con los seudónimos de «Anonimizar». */
  const RUT_FORMAT = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/u;
  const RUT_FORMAT_GLOBAL = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/giu;
  // Lo que «Anonimizar» deja en lugar de un dato: «[Estudiante 1]», «[Apoderado 1]» o «[RUT 1]»
  const PSEUDONYM = String.raw`\[(?:Estudiante|Apoderado|RUT) \d+\]`;
  const MARK = String.raw`(?:\s?\((?:[ao]s?|s)\)|\/[ao]s?)?`;
  const ROLE = String.raw`(?:estudiante|alumn[oa]|apoderad[oa])${MARK}`;
  const NAME = String.raw`(?:apellidos?${MARK}\s+y\s+|(?:primer|segundo)\s+)?nombres?${MARK}(?:\s+completo|\s+y\s+apellidos?${MARK})?`;
  const GAP = String.raw`[^\S\n]*(?:\n[^\S\n]*){0,2}(?:[*"«“]+[^\S\n]*)?`;
  const LETTERED = String.raw`(?:(?:[a-z]|[ivx]{1,4})[.)][^\p{L}\n]{0,5})?`;
  // Un campo de persona con un valor real: el rótulo abre su línea y nombra a una persona; el valor no es otro rótulo
  const PERSON_FIELD = String.raw`^[^\p{L}\n]{0,15}${LETTERED}((?:${NAME}|${ROLE})(?:(?:\s+del?(?:\s+la)?(?:\/la)?)?\s+${ROLE})?)\s*:${GAP}(?=\p{L})(?!\p{L}+\s*:)`;
  const NAMED_PERSON = new RegExp(String.raw`${PERSON_FIELD}[^\n,;]{0,20}\p{L}{2}`, "imu");
  const PERSON_VALUE = new RegExp(String.raw`${PERSON_FIELD}(?=[^\n,;]{0,20}\p{L}{2})([^\n]*)\n?`, "gimu");
  // La ficha de una persona: «Datos del estudiante: Juan Pérez», con su valor en la misma línea
  const RECORD_FIELD = String.raw`^[^\p{L}\n]{0,15}${LETTERED}((?:datos|ficha|identificaci[oó]n)\s+(?:del?|de\s+la)\s+${ROLE})\s*:[^\S\n]*(?:[*"«“]+[^\S\n]*)?(?=\p{L})(?!\p{L}+\s*:)`;
  const NAMED_RECORD = new RegExp(String.raw`${RECORD_FIELD}[^\n,;]{0,20}\p{L}{2}`, "imu");
  const RECORD_VALUE = new RegExp(String.raw`${RECORD_FIELD}(?=[^\n,;]{0,20}\p{L}{2})([^\n]*)\n?`, "gimu");
  const ALL_EXCLUDED = "[Se excluyeron los fragmentos con datos identificables.]";

  const containsSensitive = (value) => RUT_FORMAT.test(value) || NAMED_PERSON.test(value) || NAMED_RECORD.test(value);
  // Quita cada campo con un nombre declarado —de su rótulo a su valor— y las líneas con un RUT; conserva el resto
  function excludeSensitive(value) {
    if (!containsSensitive(value)) return value;
    const kept = value
      .replace(PERSON_VALUE, "")
      .replace(RECORD_VALUE, "")
      .split("\n")
      .filter((line) => !RUT_FORMAT.test(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return kept || ALL_EXCLUDED;
  }

  // Pseudonyms: cada dato distinto recibe un marcador numerado por tipo, estable en la conversación
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const wordEdge = (char, edge) => (char && /[\p{L}\p{N}]/u.test(char) ? edge : "");
  function inMemory(initial = new Map()) {
    let entries = initial;
    return { read: () => entries, write: (next) => (entries = new Map(next)) };
  }
  class Pseudonyms {
    constructor(store = inMemory()) {
      this.store = store;
      this.compiled = undefined;
    }
    // Una copia que no guarda nada: la vista previa del aviso numera como «Anonimizar» sin decidir por el docente
    draft() {
      return new Pseudonyms(inMemory(this.store.read()));
    }
    protect(text) {
      const found = [
        ...[...text.matchAll(PERSON_VALUE), ...text.matchAll(RECORD_VALUE)].map((match) => ({
          value: match[2].replace(/[\s.*"»”]+$/u, ""),
          kind: /apoderad/iu.test(match[1]) ? "Apoderado" : "Estudiante",
        })),
        ...[...text.matchAll(RUT_FORMAT_GLOBAL)].map((match) => ({ value: match[0], kind: "RUT" })),
      ];
      const known = this.store.read();
      if (found.some(({ value }) => value && !known.has(value))) {
        const next = new Map(known);
        for (const { value, kind } of found) {
          if (!value || next.has(value)) continue;
          const used = [...next.values()].filter((marker) => marker.startsWith(`[${kind} `)).length;
          next.set(value, `[${kind} ${used + 1}]`);
        }
        this.store.write(next);
      }
      return this.apply(text);
    }
    apply(text) {
      const entries = this.store.read();
      if (!entries.size || !text) return text;
      return text.replace(this.pattern(entries), (match, marker) => marker ?? entries.get(match) ?? match);
    }
    pattern(entries) {
      const values = [...entries.keys()].sort((a, b) => b.length - a.length);
      const key = values.join("\u0000");
      if (this.compiled?.key !== key) {
        const data = values.map((value) => `${wordEdge(value[0], String.raw`(?<![\p{L}\p{N}])`)}${escapeRegExp(value)}${wordEdge(value.at(-1), String.raw`(?![\p{L}\p{N}])`)}`);
        this.compiled = { key, pattern: new RegExp(`(${PSEUDONYM})|${data.join("|")}`, "gu") };
      }
      return this.compiled.pattern;
    }
  }

  function sensitiveHints(value) {
    const hints = [];
    if (RUT_FORMAT.test(value)) hints.push("RUT");
    if (NAMED_PERSON.test(value) || NAMED_RECORD.test(value)) hints.push("nombres identificables");
    return hints;
  }
  // De dónde viene lo detectado, en el orden en que el aviso lo nombra
  function sourcesText(sources) {
    const { general, session } = sources.memory;
    const scope = general && session ? "la memoria" : session ? "la memoria de este encargo" : "la memoria general";
    const named = [
      sources.request ? "tu pedido" : "",
      sources.target ? `el ${sources.target.kind} «${sources.target.title}»` : "",
      sources.planificador?.nombre ?? "",
      general + session ? `${general + session === 1 ? "un recuerdo" : "recuerdos"} de ${scope}` : "",
      sources.conversation ? "la conversación anterior, hecha con el modelo de este equipo" : "",
    ].filter(Boolean);
    return named.length > 1 ? `${named.slice(0, -1).join(", ")} y ${named.at(-1)}` : named.join("");
  }
  const privacyConsentMessage = (hints, sources) =>
    `Detecté ${hints.length ? hints.join(" y ") : "datos identificables de estudiantes"} en ${sourcesText(sources)}. Antes de que salga a un proveedor en la nube, elige cómo protegerlo.`;
  // En la web sólo hay un pedido: lo que se escribe en el recuadro del aviso
  const EN_EL_PEDIDO = { request: true, memory: { general: 0, session: 0 }, conversation: false };
  // La vista previa que Main da al aviso: «Anonimizar» sobre un borrador, a lo más 480 caracteres
  const anonymizedPreview = (text) => new Pseudonyms().draft().protect(text).slice(0, 480);

  window.pteronUI = {
    recognize,
    pendingSuggestions,
    applySuggestion,
    privacy: { containsSensitive, excludeSensitive, sensitiveHints, privacyMessage: (hints) => privacyConsentMessage(hints, EN_EL_PEDIDO), anonymizedPreview },
  };
  if (typeof document === "undefined") return;

  /* ---------- 3. La ronda: copia fiel de pteron/src/renderer/src/lib/ronda.ts (ADR-193) ----------
     Tres puntos en un anillo visto en perspectiva que se mueve según lo que pasa: piensa (el anillo inclinado gira
     parejo), trabaja (casi de canto, los puntos se pasan de a uno, con un paso y una pausa) o espera (la fila casi
     quieta). Los modos se mezclan con un resorte crítico; nunca cambia de color. Es puro: la ventana lo avanza con
     requestAnimationFrame, como ActivityMark.tsx. */
  const MODOS = ["piensa", "trabaja", "espera"];
  const RADIO = 8;
  const DISTANCIA = 3.6 * RADIO;
  const RADIO_DEL_PUNTO = 1.9;
  const LIENZO = { x: -12, y: -10, ancho: 24, alto: 20 };
  const CUADRO_MAXIMO_MS = 50;
  const TERCIO = (2 * Math.PI) / 3;
  const grados = (valor) => (valor * Math.PI) / 180;
  const REPOSO = Math.PI / 2;
  const PIENSA = { inclinacion: grados(60), vaiven: grados(6), periodoDelVaiven: 4_000, vuelta: 2_600 };
  const TRABAJA = { inclinacion: grados(10), paso: 480, pausa: 160 };
  const ESPERA = { inclinacion: grados(6), vuelta: 24_000 };
  const CORRECCION_MAXIMA = grados(30);
  const RIGIDEZ = 9.5;
  const RIGIDEZ_DE_LA_INCLINACION = 6;
  const PESO_INVISIBLE = 0.001;

  const unico = (modo, valor = 1) => ({ piensa: modo === "piensa" ? valor : 0, trabaja: modo === "trabaja" ? valor : 0, espera: modo === "espera" ? valor : 0 });
  const suave = (u) => {
    const t = Math.min(1, Math.max(0, u));
    return t * t * (3 - 2 * t);
  };
  function inclinacionDelModo(modo, tiempo) {
    if (modo === "piensa") return PIENSA.inclinacion + PIENSA.vaiven * Math.sin((2 * Math.PI * tiempo) / PIENSA.periodoDelVaiven);
    return modo === "trabaja" ? TRABAJA.inclinacion : ESPERA.inclinacion;
  }
  const rondaEnReposo = (modo) => ({ fase: REPOSO, tiempo: 0, pesos: unico(modo), ritmos: unico(modo, 0), inclinacion: inclinacionDelModo(modo, 0), giro: 0, reloj: TRABAJA.paso, paso: TERCIO });
  function pasoHastaElReposo(fase) {
    const destino = REPOSO + Math.round((fase + TERCIO - REPOSO) / TERCIO) * TERCIO;
    return Math.min(TERCIO + CORRECCION_MAXIMA, Math.max(TERCIO - CORRECCION_MAXIMA, destino - fase));
  }
  const duracionDelPasoDeLaRonda = (paso) => TRABAJA.paso * Math.max(1, paso / TERCIO);

  function avanzarLaRonda(estado, dt, modo) {
    const ms = Math.min(CUADRO_MAXIMO_MS, Math.max(0, dt));
    const segundos = ms / 1000;
    const amortiguacion = Math.exp(-RIGIDEZ * segundos);
    const pesos = { ...estado.pesos };
    const ritmos = { ...estado.ritmos };
    for (const cual of MODOS) {
      const error = estado.pesos[cual] - (cual === modo ? 1 : 0);
      const impulso = estado.ritmos[cual] + RIGIDEZ * error;
      pesos[cual] = (cual === modo ? 1 : 0) + (error + impulso * segundos) * amortiguacion;
      ritmos[cual] = (estado.ritmos[cual] - RIGIDEZ * impulso * segundos) * amortiguacion;
    }
    const medio = (cual) => (estado.pesos[cual] + pesos[cual]) / 2;
    const objetivo = inclinacionDelModo(modo, estado.tiempo + ms);
    const amortiguacionDeLaInclinacion = Math.exp(-RIGIDEZ_DE_LA_INCLINACION * segundos);
    const desvio = estado.inclinacion - objetivo;
    const empuje = estado.giro + RIGIDEZ_DE_LA_INCLINACION * desvio;
    const inclinacion = objetivo + (desvio + empuje * segundos) * amortiguacionDeLaInclinacion;
    const giro = (estado.giro - RIGIDEZ_DE_LA_INCLINACION * empuje * segundos) * amortiguacionDeLaInclinacion;
    let fase = estado.fase + ms * ((medio("piensa") * 2 * Math.PI) / PIENSA.vuelta + (medio("espera") * 2 * Math.PI) / ESPERA.vuelta);
    let { reloj, paso } = estado;
    const trabaja = medio("trabaja");
    if (modo === "trabaja" && estado.pesos.trabaja < PESO_INVISIBLE) reloj = duracionDelPasoDeLaRonda(paso);
    if (modo === "trabaja" || estado.pesos.trabaja >= PESO_INVISIBLE) {
      const duracion = duracionDelPasoDeLaRonda(paso);
      const ciclo = duracion + TRABAJA.pausa;
      const hasta = reloj + ms;
      fase += trabaja * paso * (suave(Math.min(hasta, ciclo) / duracion) - suave(reloj / duracion));
      reloj = hasta;
      if (hasta >= ciclo) {
        if (modo === "trabaja") {
          reloj = hasta - ciclo;
          paso = pasoHastaElReposo(fase);
          fase += trabaja * paso * suave(reloj / duracionDelPasoDeLaRonda(paso));
        } else reloj = ciclo;
      }
    }
    return { fase, tiempo: estado.tiempo + ms, pesos, ritmos, inclinacion, giro, reloj, paso };
  }

  function proyectar(fase, inclinacionDelAnillo) {
    const puntos = [];
    for (let indice = 0; indice < 3; indice += 1) {
      const angulo = fase + indice * TERCIO;
      const z = -RADIO * Math.sin(angulo) * Math.cos(inclinacionDelAnillo);
      const escala = DISTANCIA / (DISTANCIA - z);
      puntos.push({ x: RADIO * Math.cos(angulo) * escala, y: -RADIO * Math.sin(angulo) * Math.sin(inclinacionDelAnillo) * escala, r: RADIO_DEL_PUNTO * escala, z });
    }
    return puntos.sort((a, b) => a.z - b.z);
  }
  const puntosDeLaRonda = (estado) => proyectar(estado.fase, estado.inclinacion);
  const poseQuieta = (modo) => puntosDeLaRonda(rondaEnReposo(modo));

  /* ---------- Piezas comunes ---------- */
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- 4. La ventana de pteron ----------
     El marcado de los componentes de la app, con sus mismas clases: App.tsx con AppFooter, ShellIndex, HomePage con la
     Marca y MaterialesRecientes, ComposerDock, Composer con FilaDelPedido, ContextSelect y lo leído en el pedido,
     ChatView con MessageActions, PlanCard y PlanChoiceList, LiveResponse con la tarjeta de la corrida (ActivityMark con
     la ronda), LiveSheet, RunSummary y MaterialCard. pteron-app.css los dibuja con las reglas de la app. La secuencia es
     un pedido de verdad: se escribe en la Home y pteron lo lee en una frase que se agrega con un clic; el envío baja el
     recuadro a la conversación (el vuelo «envio»); pteron propone un plan con una decisión; la hoja se escribe con la
     tarjeta de la corrida al pie, y el turno termina en su resultado (el vuelo «resultado»: «Listo en …» y la tarjeta
     del material). El DOM se actualiza por partes, como Solid: lo que sigue en pantalla no se vuelve a montar, así cada
     animación de la app ocurre una vez. */
  let ICONS = "/assets/pt-icons.svg";
  // Con el trazo de la app (1,8) y su escala (lib/icon-scale.ts): 14 en línea, 16 en controles, 20 destacado
  const ICON_PX = { inline: 14, control: 16, prominent: 20 };
  // La familia propia (ui/familia.ts): los tipos de material y los formatos de archivo, dibujados como en la app
  const FAMILIA = new Set(["documento", "texto", "pdf", "planilla", "imagen", "presentacion", "archivo", "plan", "guia", "actividad", "evaluacion", "pauta", "planificacion", "unidad", "rubrica"]);
  function appIcon(name, size = "control", cls = "", relleno = false) {
    const px = ICON_PX[size];
    const propio = FAMILIA.has(name);
    const clase = `${propio ? "" : `lucide lucide-${name} lucide-icon `}pteron-icon${cls ? ` ${cls}` : ""}`;
    return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="${relleno ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${propio ? ` data-icono="${name}"` : ""} class="${clase}" aria-hidden="true"><use href="${ICONS}#pt-${name}"/></svg>`;
  }

  // La marca (components/Marca.tsx, ADR-175): el dibujo del kit 1.0.0; en la Home es la firma, chica y tenue
  const MARCA_VIEWBOX = "-1436 -684 2872 886";
  const MARCA_TRAZO =
    "M-1168 10Q-1101 10 -1048 -23Q-995 -56 -964.5 -113Q-934 -170 -934 -241Q-934 -313 -964.5 -370Q-995 -427 -1048 -460Q-1101 -493 -1168 -493Q-1220 -493 -1261.5 -471Q-1286 -458 -1305 -439.5L-1305 -483L-1436 -483L-1436 123.4L-1357.4 202L-1306 202L-1306 -42.6Q-1287 -24.3 -1262 -11.5Q-1220 10 -1168 10ZM648 10Q721 10 779.5 -23.5Q838 -57 872 -114.5Q906 -172 906 -243Q906 -314 872 -370.5Q838 -427 779.5 -460.5Q721 -494 647 -494Q575 -494 516 -460.5Q457 -427 423 -370.5Q389 -314 389 -243Q389 -172 423.5 -114.5Q458 -57 516.5 -23.5Q575 10 648 10ZM-272 10Q-213 10 -162.5 -11Q-112 -32 -77 -73L-154 -150Q-176 -125 -206 -112.5Q-236 -100 -273 -100Q-314 -100 -345 -117.5Q-376 -135 -392.5 -167.5Q-399.1 -180.4 -403 -195.1L-50 -196Q-46 -213 -44.5 -226.5Q-43 -240 -43 -253Q-43 -322 -73.5 -376.5Q-104 -431 -157.5 -462.5Q-211 -494 -281 -494Q-352 -494 -410 -460.5Q-468 -427 -501.5 -370.5Q-535 -314 -535 -242Q-535 -169 -500.5 -112Q-466 -55 -407 -22.5Q-348 10 -272 10ZM1305 0L1436 0L1436 -306Q1436 -355 1412 -397.5Q1388 -440 1346 -466.5Q1304 -493 1251 -493Q1196 -493 1152.5 -469Q1129 -456 1111 -437.6L1111 -483L980 -483L980 0L1111 0L1111 -277Q1111 -306 1123.5 -328Q1136 -350 1158 -362Q1180 -374 1208 -374Q1251 -374 1278 -347Q1305 -320 1305 -277ZM-799 0L-668 0L-668 -368L-555 -368L-555 -483L-668 -483L-668 -605.4L-746.6 -684L-799 -684L-799 -483L-912 -483L-912 -368L-799 -368ZM28 0L159 0L159 -267Q159 -321 185.5 -347.5Q212 -374 254 -374Q274 -374 289.5 -368Q305 -362 316 -350L398 -444Q375 -470 347 -481.5Q319 -493 284 -493Q203 -493 160 -441.5Q159.5 -440.9 159 -440.3L159 -483L28 -483ZM647 -112Q611 -112 583 -128.5Q555 -145 539 -174.5Q523 -204 523 -242Q523 -280 539 -309Q555 -338 583 -354.5Q611 -371 647 -371Q684 -371 712 -354.5Q740 -338 756 -309Q772 -280 772 -242Q772 -204 756.5 -174.5Q741 -145 712.5 -128.5Q684 -112 647 -112ZM-1191 -111Q-1227 -111 -1254.5 -127.5Q-1282 -144 -1297.5 -173.5Q-1313 -203 -1313 -242Q-1313 -280 -1297.5 -309.5Q-1282 -339 -1254 -355.5Q-1226 -372 -1191 -372Q-1155 -372 -1127 -355.5Q-1099 -339 -1083.5 -309.5Q-1068 -280 -1068 -242Q-1068 -203 -1083.5 -173.5Q-1099 -144 -1127 -127.5Q-1155 -111 -1191 -111ZM-403 -293.2Q-399.3 -306.6 -393.5 -318.5Q-378 -350 -349 -367.5Q-320 -385 -281 -385Q-244 -385 -218.5 -369.5Q-193 -354 -179.5 -325Q-173 -311 -169.2 -293.8Z";
  const marcaSVG = () => `<svg class="pteron-marca" viewBox="${MARCA_VIEWBOX}" role="img" aria-label="pteron"><path fill="currentColor" fill-rule="evenodd" d="${MARCA_TRAZO}"/></svg>`;

  /* Contenido: el primer pedido de partida del recorrido de bienvenida de la app (lib/recorrido.ts) y la guía de
     Matemática que el inicio muestra en «La hoja» (scripts/pteron-hojas/materiales.mjs): la hoja que se escribe es esa */
  const DEMO = {
    request: "Una guía de fracciones equivalentes para 5° básico, de 45 minutos, con ejercicios graduados",
    homePlaceholder: "¿En qué quieres trabajar?",
    chatPlaceholder: "Pregunta, explora o crea con pteron…",
    answerPlaceholder: "Responde con tus palabras…",
    planPlaceholder: "Ajusta el plan o pide un cambio…",
    hint: "↵ envía · @ material · / comandos",
    curso: "5° básico",
    horas: ["09:42 p. m.", "09:43 p. m."],
    date: "25 oct 2026",
    plan: {
      title: "Guía · Fracciones equivalentes",
      intro: "Antes de crear la guía, una decisión: cómo gradúo los ejercicios.",
      purpose: "Guía de trabajo de 45 minutos para 5° básico, con ejercicios que van de lo más simple a lo más exigente.",
      question: "¿Cómo gradúo los ejercicios?",
      choices: ["De lo concreto a lo simbólico", "Sólo ejercicios simbólicos", "Con problemas de la vida diaria"],
      facts: [["Curso", "5° básico"], ["Asignatura", "Matemática"], ["Tema", "Fracciones equivalentes"]],
      stages: [["Representar", "Pintar en una barra lo mismo que 3/4."], ["Ubicar", "Encontrar en la recta los sextos que valen 2/3."]],
      assumption: "Una sola sesión de 45 minutos, salvo que prefieras otra extensión.",
    },
    material: "Guía de trabajo: fracciones equivalentes",
    answer: "Guía de trabajo de 45 minutos: una idea clave, una barra para pintar la fracción equivalente a 3/4 y una recta con tercios y sextos. Suma 4 puntos y cada pregunta guarda su respuesta.",
  };

  /* shared/session-label.ts: un encargo se llama como su primer pedido, sin saludo ni «quiero», cortado en una palabra */
  function tituloDelPedido(prompt, maxLength = 52) {
    const meaningful = prompt
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/^(?:hola|hol[ai]|buen(?:os|as)?\s+(?:d[ií]as|tardes|noches))[!.,:\s-]+/iu, "")
      .replace(/^(?:por favor[,:\s-]+)?(?:ay[uú]dame\s+a|puedes|podr[ií]as|quiero|necesito|crea(?:r)?|haz|genera(?:r)?|diseña(?:r)?|prepara(?:r)?|arma(?:r)?)\s+/iu, "")
      .replace(/[.!?]+$/gu, "")
      .trim();
    const title = meaningful.charAt(0).toLocaleUpperCase("es") + meaningful.slice(1);
    if (title.length <= maxLength) return title;
    const boundary = title.slice(0, maxLength + 1).lastIndexOf(" ");
    return `${title.slice(0, boundary >= Math.floor(maxLength * 0.62) ? boundary : maxLength).trimEnd()}…`;
  }
  const ENCARGO = tituloDelPedido(DEMO.request);
  // lib/shell-index.ts: las iniciales del índice plegado, sin las palabras menores
  const MENORES = new Set(["a", "al", "con", "de", "del", "el", "en", "la", "las", "los", "o", "para", "por", "un", "una", "y"]);
  function iniciales(titulo) {
    const palabras = titulo.match(/[\p{L}\p{N}]+/gu) ?? [];
    const firmes = palabras.filter((palabra) => !MENORES.has(palabra.toLocaleLowerCase("es")));
    return (firmes.length ? firmes : palabras)
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join("")
      .toLocaleUpperCase("es");
  }

  // El índice de una profesora que trabaja: un renglón por encargo bajo su curso, en el orden del currículum
  const INDICE = [
    ["6° básico · Lenguaje y Comunicación", "Evaluación de comprensión lectora", "ayer"],
    ["7° básico · Ciencias Naturales", "Cambios de estado del agua", "lunes"],
    ["8° básico · Matemática", "Homotecia", "jueves"],
    ["Sin curso", "¿Mide comprensión o memoria?", "12 oct"],
  ];
  const CARPETA = "pteron";
  // Lo último de su carpeta, como el recorrido de bienvenida de la app: el icono de su formato, su nombre y dónde vive
  const RECIENTES = [
    ["pdf", "Apunte - Fracciones equivalentes", "Apuntes · hoy"],
    ["documento", "Guía 1.1f enteros", "Guías de clase · ayer"],
    ["pdf", "Prueba unidad 2", "Evaluaciones · lunes"],
    ["planilla", "Planificación semana 28", "Planificaciones · 3 oct"],
  ];

  /* ShellIndex.tsx (ADR-185): arriba Nuevo encargo, Biblioteca y Buscar; al medio, un renglón por encargo —el día
     aparece al pasar y su estado, en palabras, sólo cuando lo hay—; al pie, la carpeta y, como iconos, la IA y
     Configuración */
  const detalleHTML = (tono) =>
    tono === "trabajo"
      ? `<span class="shell-index-detalle" data-tono="trabajo">${appIcon("clock-3", "inline")}Trabajando…</span>`
      : tono === "aviso"
        ? `<span class="shell-index-detalle" data-tono="aviso">${appIcon("circle-question-mark", "inline")}Falta 1 decisión</span>`
        : "";
  const encargoHTML = (titulo, dia, { tono = null, actual = false, nuevo = false } = {}) =>
    `<li class="shell-index-encargo"${nuevo ? " data-pt-encargo" : ""}><button type="button" class="shell-index-abrir" tabindex="-1"${actual ? ' aria-current="page"' : ""}>` +
    `<span class="shell-index-inicial" aria-hidden="true"${tono ? ` data-tono="${tono}"` : ""}>${iniciales(titulo)}</span>` +
    `<span class="shell-index-renglon"><span class="shell-index-titulo">${esc(titulo)}</span><span class="shell-index-dia">${esc(dia)}</span></span>${detalleHTML(tono)}</button>` +
    `<button type="button" class="shell-index-archivar" tabindex="-1">${appIcon("archive", "inline")}</button></li>`;
  const grupoHTML = (titulo, filas, clase = "") =>
    `<section class="shell-index-grupo${clase}" aria-label="${esc(titulo)}"><button type="button" class="shell-index-curso" tabindex="-1" aria-expanded="${filas ? "true" : "false"}">` +
    `<span>${esc(titulo)}</span>${appIcon("chevron-down", "inline")}</button>${filas ? `<ul class="shell-index-lista">${filas}</ul>` : ""}</section>`;
  const filaDelIndice = (icono, texto, kbd = "", clase = "", actual = false) =>
    `<button type="button" class="shell-index-fila${clase}" tabindex="-1"${actual ? ' aria-current="page"' : ""}>${appIcon(icono)}<span class="shell-index-texto">${texto}</span>${kbd ? `<kbd aria-hidden="true">${kbd}</kbd>` : ""}</button>`;
  // encargo: null en la Home; si no, el tono del estado del encargo de la demostración (o null, quieto)
  function indiceHTML(encargo) {
    const nuevo = encargo === undefined ? "" : grupoHTML(DEMO.curso, encargoHTML(ENCARGO, "hoy", { tono: encargo, actual: true, nuevo: true }));
    return (
      `<nav class="shell-index" aria-label="Índice"><div class="shell-index-cabeza"><button type="button" class="shell-index-plegar" tabindex="-1" aria-expanded="true">${appIcon("panel-left")}</button></div>` +
      `<div class="shell-index-acciones">${filaDelIndice("square-pen", "Nuevo encargo", "⌘N", " is-principal", encargo === undefined)}${filaDelIndice("library-big", "Biblioteca")}${filaDelIndice("search", "Buscar", "⌘K")}</div>` +
      `<div class="shell-index-encargos">${nuevo}${INDICE.map(([curso, titulo, dia]) => grupoHTML(curso, encargoHTML(titulo, dia))).join("")}${grupoHTML("Archivados", "", " is-archivados")}</div>` +
      `<div class="shell-index-pie"><button type="button" class="shell-index-fila is-estado" tabindex="-1">${appIcon("folder-open")}<span class="shell-index-texto">${CARPETA}</span></button>` +
      `<button type="button" class="shell-index-icono shell-index-ia" tabindex="-1">${appIcon("bot")}</button><button type="button" class="shell-index-icono" tabindex="-1">${appIcon("settings")}</button></div></nav>`
    );
  }
  // La franja de arriba: vacía en la Home; en un encargo, su nombre y su curso
  const franjaHTML = (encargo) =>
    `<header class="shell-topbar">${encargo ? `<h1 class="shell-titulo">${esc(ENCARGO)}</h1><span class="shell-contexto">${esc(DEMO.curso)}</span>` : ""}</header>`;
  // AppFooter.tsx: la ayuda en la esquina
  const esquinaHTML = () =>
    `<footer class="shell-corner-controls"><span class="footer-right"><button type="button" class="footer-circle-btn" tabindex="-1" aria-expanded="false">${appIcon("circle-question-mark", "inline")}</button></span></footer>`;

  /* El recuadro. FilaDelPedido.tsx con lib/ranuras-del-pedido.ts: cada dato en su ranura, en el orden de un pedido;
     curso y asignatura se eligen de su lista (ContextSelect.tsx) y su invitación vacía cede el lugar a la frase que ya
     los ofrece; tipo, tema y duración son datos con cruz. El OA aparece recién con curso y asignatura: este pedido no
     nombra la asignatura. */
  const INTENT_LABEL = { guide: "Guía", planning: "Planificación", assessment: "Evaluación", rubric: "Rúbrica", activity: "Actividad", answer_key: "Pauta", presentation: "Presentación" };
  const selectHTML = (label, icono, value) =>
    `<div class="filter-field"><div class="context-select${value ? " has-value" : ""}"><div role="group"><span class="sr-only">${label}</span>` +
    `<button type="button" class="context-select-trigger" tabindex="-1">${appIcon(icono)}<span class="context-select-value"${value ? "" : ' data-placeholder-shown=""'}>${value ? esc(value) : `<span aria-hidden="true">${label}</span>`}</span>` +
    `${appIcon("chevron-down", "inline", "context-select-chevron")}</button></div>${value ? `<button type="button" class="context-select-clear" tabindex="-1">${appIcon("x", "inline")}</button>` : ""}</div></div>`;
  const datoHTML = (id, label) =>
    `<span class="composer-chip teaching-context-chip" data-chip="${id}"><span class="composer-chip-label">${esc(label)}</span><button type="button" class="composer-chip-remove" tabindex="-1">${appIcon("x", "inline")}</button></span>`;
  const limpiarHTML = () => `<button type="button" class="composer-chips-clear" tabindex="-1">Limpiar</button>`;
  const DATOS = ["artifactIntent", "course", "subject", "oa", "topic", "duration", "quantity"];
  function filaHTML(contexto, ofrecidos = []) {
    const piezas = [];
    if (contexto.artifactIntent) piezas.push(datoHTML("intent", INTENT_LABEL[contexto.artifactIntent]));
    if (contexto.course || !ofrecidos.includes("course")) piezas.push(selectHTML("Curso", "graduation-cap", contexto.course));
    if (contexto.subject || !ofrecidos.includes("subject")) piezas.push(selectHTML("Asignatura", "book-open", contexto.subject));
    for (const [campo, chip] of [["topic", "topic"], ["duration", "duration"], ["quantity", "quantity"]]) if (contexto[campo]) piezas.push(datoHTML(chip, contexto[campo]));
    // «Limpiar» con dos datos o más y sin una frase abierta
    const conLimpiar = DATOS.filter((campo) => contexto[campo]).length > 1 && !ofrecidos.length;
    return `<div class="filter-bar fila-pedido" role="group" aria-label="Datos del pedido">${piezas.join("")}${conLimpiar ? limpiarHTML() : ""}</div>`;
  }
  /* lib/lectura-encargo.ts con Composer.tsx: lo que pteron lee en el pedido y todavía no está en el contexto, como una
     frase subrayada al final de la fila; una pieza entra con un clic y todas con Tab o «Agregar todo» */
  const leer = (texto, contexto) =>
    pendingSuggestions(texto, contexto).map((valor) => ({ slot: valor.field, label: valor.field === "topic" ? valor.value : valor.label, valor }));
  const confirmar = (contexto, piezas) => piezas.reduce((siguiente, pieza) => applySuggestion(siguiente, pieza.valor), contexto);
  const lecturaHTML = (piezas, foco) =>
    `<div class="composer-suggestions" role="group" aria-label="Lo que pteron leyó en tu pedido"><span class="composer-suggestions-mark" aria-hidden="true">${appIcon("lightbulb", "inline")}</span><span class="composer-suggestions-pieces">` +
    piezas
      .map((p, i) => `${i ? `<span class="composer-suggestions-sep" aria-hidden="true"> · </span>` : ""}<button type="button" class="composer-suggestion" tabindex="-1" data-suggestion="${p.slot}"><span>${esc(p.label)}</span></button>`)
      .join("") +
    `</span>${piezas.length > 1 ? `<button type="button" class="composer-suggestions-all" tabindex="-1">Agregar todo</button>` : ""}${foco ? `<kbd class="composer-suggestions-key" aria-hidden="true">Tab</kbd>` : ""}` +
    `<span class="sr-only">Tab agrega lo leído al contexto; Escape lo descarta.</span></div>`;
  const enviarHTML = (listo) => `<button type="button" class="composer-send" tabindex="-1"${listo ? "" : " disabled"}>${appIcon("arrow-up")}</button>`;
  const detenerHTML = () => `<button type="button" class="composer-send is-stop" tabindex="-1">${appIcon("square", "inline", "", true)}</button>`;
  const adjuntarHTML = (apagado = false) => `<button type="button" class="composer-tool composer-attach" tabindex="-1"${apagado ? " disabled" : ""}>${appIcon("paperclip")}</button>`;
  const campoHTML = (placeholder, alto, texto = "") =>
    `<div class="composer-field"><textarea rows="1" tabindex="-1" placeholder="${esc(placeholder)}" aria-label="Petición o consulta para pteron" readonly style="height: ${alto}px;">${esc(texto)}</textarea></div>`;
  // ComposerDock.tsx: el muelle, con lo que hay que decidir ahora encima del recuadro
  const muelleHTML = (variante, tono, contexto, composer) =>
    `<div class="composer-dock ${variante === "home" ? "is-home" : "is-floating"} tone-${tono}" data-pt-dock><div class="composer-dock-context">${contexto}</div>${composer}</div>`;

  // Composer.tsx en la Home: un campo alto y, en la barra, adjuntar, la fila del pedido y la frase de lo leído
  function composerHomeHTML({ texto = "", foco = false, contexto = {}, lectura = [] } = {}) {
    return (
      `<div class="composer is-home has-chips${foco ? " is-focused" : ""}" data-pt-composer>${campoHTML(DEMO.homePlaceholder, 70, texto)}` +
      `<div class="composer-toolbar"><div class="composer-toolbar-start"><div class="composer-chips" role="group" aria-label="Contexto de este mensaje">${adjuntarHTML()}` +
      `${filaHTML(contexto, lectura.map((pieza) => pieza.slot))}${lectura.length ? lecturaHTML(lectura, foco) : ""}</div></div>` +
      `<div class="composer-toolbar-end">${enviarHTML(Boolean(texto.trim()))}</div></div></div>`
    );
  }
  // MaterialesRecientes.tsx: lo último de la carpeta, en renglones sobre la mesa
  const recientesHTML = () =>
    `<section class="home-recientes" aria-labelledby="home-recientes-titulo"><h2 id="home-recientes-titulo" class="home-recientes-titulo">Lo último en tu carpeta</h2><ul class="home-recientes-lista">` +
    RECIENTES.map(
      ([icono, nombre, donde]) =>
        `<li><button type="button" class="home-material" tabindex="-1" data-forma="${icono === "planilla" ? "planilla" : "hoja"}">${appIcon(icono)}<span class="home-material-nombre" aria-hidden="true">${esc(nombre)}</span><span class="home-material-donde" aria-hidden="true">${esc(donde)}</span></button></li>`,
    ).join("") +
    `</ul></section>`;
  // HomePage.tsx (ADR-184): la firma, el recuadro y, debajo, lo último de la carpeta; sin rumbos ni tarjetas
  const homeHTML = (estado) =>
    `<section class="home-surface"><h1 class="sr-only">Nuevo encargo</h1><div class="home-marca" aria-hidden="true">${marcaSVG()}</div>` +
    `<div class="home-composer">${muelleHTML("home", "reposo", "", composerHomeHTML(estado))}</div><div class="home-bajo-recuadro"></div>${recientesHTML()}</section>`;

  /* La conversación. ChatView.tsx: la burbuja del docente con lo enviado y la hora; la prosa de pteron sobre el lienzo,
     sus tarjetas y el pie del turno; MessageActions.tsx: copiar y «Nuevo chat desde aquí» */
  const accionesHTML = (autor) =>
    `<div class="message-actions" role="group" aria-label="${autor === "pteron" ? "Acciones de la respuesta" : "Acciones de tu mensaje"}"><button type="button" class="message-action" tabindex="-1">${appIcon("copy")}</button>` +
    `<button type="button" class="message-action" tabindex="-1">${appIcon("split")}</button><span class="sr-only" role="status" aria-live="polite"></span></div>`;
  const userHTML = (texto, envio, hora, hidratado) =>
    `<article class="message user${hidratado ? " is-hydrated" : ""}" data-message-role="user"><div class="message-bubble">${esc(texto)}</div><div class="message-meta">${accionesHTML("docente")}` +
    `<p class="message-envio"><span class="sr-only">Enviado con </span>${esc(envio)}</p><time class="message-time" aria-hidden="true">${hora}</time></div></article>`;
  // La respuesta de pteron: «is-latest» la última (sus acciones quedan a la vista); «is-hydrated» lo que ya estaba al montar
  const articuloHTML = (interior, { ultimo = true, hidratado = true } = {}) =>
    `<article class="message assistant${hidratado ? " is-hydrated" : ""}${ultimo ? " is-latest" : ""}" data-message-role="assistant">${interior}</article>`;
  const prosaHTML = (texto) => `<div class="md-body md-chat "><p>${esc(texto)}</p></div>`;
  // RunTimeline.tsx (RunSummary): el pie del turno terminado, plegado, y las dos acciones del mensaje
  const pieHTML = (etiqueta) =>
    `<footer class="message-footer"><div class="run-summary"><button type="button" class="run-summary-toggle" tabindex="-1" aria-expanded="false">${appIcon("list-checks", "inline")}<span>${esc(etiqueta)}</span>` +
    `${appIcon("chevron-down", "inline", "run-summary-chevron")}</button></div>${accionesHTML("pteron")}</footer>`;
  // Lo que se envió con cada pedido (lib/lectura-encargo.ts, fraseDelEnvio), dicho bajo la burbuja
  const ENVIO = ["Guía · 5° básico · fracciones equivalentes · 45 minutos", `5° básico · fracciones equivalentes · sobre «${DEMO.plan.title}»`];
  // App.tsx (pedidoDelPlan): al crear desde el plan, la burbuja nombra el material, como el botón de su tarjeta
  const PEDIDO_DEL_PLAN = `Crear la guía: «${DEMO.material}»`;

  /* ArtifactCards.tsx (PlanCard) con PlanQuestions.tsx: la tarjeta del plan y su decisión. «pendiente»: por acordar,
     la pregunta se responde en el recuadro; «listo»: ofrece crear la guía; «creando»: mientras pteron la escribe, el
     botón se apaga; «creado»: con la guía en el encargo no queda nada por crear y el pie queda vacío */
  function planCardHTML(estado, hidratado = true) {
    const listo = estado !== "pendiente";
    const creado = estado === "creado";
    const enfocado = !creado;
    const p = DEMO.plan;
    const decision = listo
      ? `<li class="plan-decision is-answered"><span class="plan-decision-marker" aria-hidden="true">${appIcon("check", "inline")}</span><div class="plan-decision-body"><p class="plan-decision-prompt">${esc(p.question)}</p><p class="plan-decision-answer">${esc(p.choices[0])}</p></div></li>`
      : `<li class="plan-decision is-pending is-current"><span class="plan-decision-marker" aria-hidden="true"><span>1</span></span><div class="plan-decision-body"><p class="plan-decision-prompt">${esc(p.question)}</p><p class="plan-decision-where">${appIcon("arrow-down", "inline")}Respóndela en el recuadro de abajo</p></div></li>`;
    // Las etapas y los supuestos quedan plegados mientras falta decidir algo
    const desplegable = (titulo, cuerpo, n) =>
      `<details class="chat-plan-card-disclosure"${listo ? " open" : ""}><summary tabindex="-1">${appIcon("chevron-right", "inline", "chat-plan-card-disclosure-chevron")}${titulo}<span class="chat-plan-card-count">${n}</span></summary>${cuerpo}</details>`;
    // Al pie, la única acción dominante; con el material ya creado no queda nada por crear
    const acciones = !listo
      ? `<p class="chat-plan-card-hint">Falta una decisión para crear el material.</p>`
      : creado
        ? ""
        : `<button type="button" class="btn btn-primary btn-compact" tabindex="-1"${estado === "creando" ? " disabled" : ""} data-pt-crear>${appIcon("file-plus-corner")}Crear la guía</button>`;
    return (
      `<article class="chat-file-card plan chat-plan-card${hidratado ? " is-hydrated" : ""}${enfocado ? " is-focused" : ""}" data-plan-review-state="${listo ? "ready" : "questions"}">` +
      `<header class="chat-plan-card-head"><span class="chat-plan-card-icon" aria-hidden="true">${appIcon("plan")}</span><div class="chat-plan-card-heading"><p class="chat-plan-card-kicker">Plan de trabajo · 1 entregable</p><h3 class="chat-plan-card-title">${esc(p.title)}</h3></div>` +
      `<span class="status-pill" data-tone="${listo ? "ready" : "pending"}">${listo ? "Listo" : "Por acordar"}</span></header>` +
      `<div class="chat-plan-outline chat-plan-card-body" aria-label="Contenido del plan"><p class="chat-plan-card-purpose">${esc(p.purpose)}</p>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Decisiones${listo ? `<span class="chat-plan-card-count">1 de 1</span>` : ""}</h4><ol class="plan-decisions chat-plan-questions">${decision}</ol></section>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Contexto acordado</h4><dl class="chat-plan-card-facts">${p.facts.map(([dt, dd]) => `<div class="chat-plan-card-fact"><dt>${dt}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl></section>` +
      `<section class="chat-plan-card-section"><h4 class="chat-plan-card-label">Resultado previsto</h4><ul class="chat-plan-card-deliverables"><li>${appIcon("guia", "inline")}<span>${esc(DEMO.material)}</span></li></ul></section>` +
      `<div class="chat-plan-card-more">${desplegable("Cómo lo abordaré", `<ol class="chat-plan-card-stages">${p.stages.map(([s, d]) => `<li><div><strong>${s}</strong><span>${esc(d)}</span></div></li>`).join("")}</ol>`, p.stages.length)}` +
      `${desplegable("Supuestos que puedes cambiar", `<ul class="chat-plan-card-assumptions"><li>${esc(p.assumption)}</li></ul>`, 1)}</div></div>` +
      `<footer class="chat-file-actions chat-plan-card-actions">${acciones}</footer></article>`
    );
  }
  // ArtifactCards.tsx (MaterialCard): el material creado, con su tipo, su estado y cómo abrirlo
  const materialCardHTML = (hidratado = true) =>
    `<article class="chat-file-card material-card${hidratado ? " is-hydrated" : ""}"><span class="material-card-tile" aria-hidden="true">${appIcon("guia", "prominent")}<span class="material-card-format">DOCX</span></span>` +
    `<div class="material-card-body"><h3 class="material-card-title">${esc(DEMO.material)}</h3><p class="material-card-meta"><span>Guía</span><span class="material-card-status" data-status="ready">Listo</span><span>${DEMO.date}</span></p>` +
    `<div class="material-card-tags"><span class="material-card-tag">5° básico</span><span class="material-card-tag">fracciones equivalentes</span></div></div>` +
    `<div class="chat-file-actions material-card-actions"><button type="button" class="quiet-action" tabindex="-1">${appIcon("layers", "inline")}Versiones</button>` +
    `<button type="button" class="quiet-action material-card-abrir" tabindex="-1"><span>Abrir<span class="material-card-abrir-donde"> en editor</span></span></button></div></article>`;
  // PlanChoiceList: la pregunta del plan en el recuadro, con sus alternativas apiladas y la sugerida primero
  const decisionHTML = () =>
    `<div class="composer-dock-decision"><div class="composer-dock-intake" role="group"><p class="composer-dock-question">${esc(DEMO.plan.question)}</p><div class="plan-choices" role="group">` +
    DEMO.plan.choices
      .map((c, i) => `<button type="button" class="plan-choice" tabindex="-1"><span class="plan-choice-mark" aria-hidden="true"></span><span class="plan-choice-text">${esc(c)}</span>${i === 0 ? `<span class="plan-choice-recommended">Sugerida</span>` : ""}</button>`)
      .join("") +
    `</div></div></div>`;

  /* Composer.tsx en la conversación (ComposerDock flotante): los chips del turno sobre el campo, adjuntar y la ayuda
     de teclado en la barra. Mientras pteron trabaja, el campo se lee pero no se escribe, no invita a nada y Detener
     ocupa el lugar de enviar; los datos que la burbuja ya declara no se repiten como chips (chipsDelMuelle). */
  const CHIPS = [["course", "5° básico"], ["topic", "fracciones equivalentes"]];
  const chipsHTML = () =>
    `<div class="composer-chips" role="group" aria-label="Contexto de este mensaje">${CHIPS.map(([id, label]) => datoHTML(id, label)).join("")}${limpiarHTML()}</div>`;
  const PLACEHOLDER = { trabajando: "", decision: DEMO.answerPlaceholder, plan: DEMO.planPlaceholder, conversacion: DEMO.chatPlaceholder };
  function muelleChatHTML(momento) {
    const trabajando = momento === "trabajando";
    const composer =
      `<div class="composer${trabajando ? "" : " has-chips"} is-focused" data-pt-composer>${trabajando ? "" : chipsHTML()}${campoHTML(PLACEHOLDER[momento], 40)}` +
      `<div class="composer-toolbar"><div class="composer-toolbar-start">${adjuntarHTML(trabajando)}<span class="composer-hint" aria-hidden="true">${DEMO.hint}</span></div>` +
      `<div class="composer-toolbar-end">${trabajando ? detenerHTML() : enviarHTML(false)}</div></div></div>`;
    return muelleHTML("floating", trabajando ? "trabajando" : "decision", momento === "decision" ? decisionHTML() : "", composer);
  }

  /* LiveResponse.tsx: la respuesta en curso. Arriba lo que de verdad llega (el plan o la hoja); al pie, la tarjeta de la
     corrida: la ronda, lo que pasa ahora con su objeto y el reloj del turno; debajo, cada paso en el orden en que
     ocurrió, en pasado con lo que tardó, y el que sigue en curso con su tiempo vivo. */
  const rondaHTML = (modo) =>
    `<svg aria-hidden="true" class="activity-mark " viewBox="${LIENZO.x} ${LIENZO.y} ${LIENZO.ancho} ${LIENZO.alto}" width="${LIENZO.ancho}" height="${LIENZO.alto}" data-modo="${modo}">` +
    poseQuieta(modo)
      .map((punto) => `<circle cx="${punto.x.toFixed(2)}" cy="${punto.y.toFixed(2)}" r="${punto.r.toFixed(2)}"></circle>`)
      .join("") +
    `</svg>`;
  // lib/corrida.ts: la duración de un paso para leerla de un vistazo, el reloj del turno y el pie al terminar
  const duracionDelPaso = (ms) => {
    const segundos = Math.max(0, ms) / 1000;
    if (segundos < 10) return `${segundos.toFixed(1).replace(".", ",")} s`;
    if (segundos < 60) return `${Math.round(segundos)} s`;
    const total = Math.round(segundos);
    return `${Math.floor(total / 60)} min ${total % 60} s`;
  };
  const relojDeLaCorrida = (ms) => {
    const total = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const etiquetaDelPie = (ms, pasos) => {
    const busquedas = pasos.filter((paso) => paso.clase === "consulta").length;
    return [`Listo en ${duracionDelPaso(ms)}`, busquedas ? (busquedas === 1 ? "1 búsqueda" : `${busquedas} búsquedas`) : ""].filter(Boolean).join(" · ");
  };
  const ENTRE_PASOS = "Preparando la respuesta";
  const ENTRE_PASOS_TRAS_MS = 400;
  const PHRASE_HOLD_MS = 1_200;

  /* lib/corrida.ts para los hitos de esta ventana: leer el pedido, pensar, consultar el currículum, escribir el plan o
     la hoja (su guardado lo termina) y cerrar. Cada paso nace de su hito: nada se cuenta por adelantado. */
  const ICONO_DEL_PASO = { pedido: "message-square", pensar: "brain", consulta: "landmark", material: "documento", cierre: "texto" };
  function pasosDe(hitos) {
    const pasos = [];
    const nuevo = (clase, activo, hecho, at, extra = {}) => {
      const paso = { clase, activo, hecho, desde: at, hasta: null, ...extra };
      pasos.push(paso);
      return paso;
    };
    const cerrar = (at, clases) => pasos.forEach((paso) => paso.hasta === null && clases.includes(paso.clase) && (paso.hasta = Math.max(paso.desde, at)));
    let escribiendo = null;
    for (const hito of hitos) {
      if (hito.tipo === "inicio") {
        nuevo("pedido", "Leyendo tu petición", "Leyó tu petición", hito.at);
        continue;
      }
      cerrar(hito.at, ["pedido"]);
      if (hito.tipo === "pensamiento") {
        if (hito.fase === "end") cerrar(hito.at, ["pensar"]);
        else nuevo("pensar", "Pensando", "Pensó", hito.at);
        continue;
      }
      cerrar(hito.at, ["pensar"]);
      if (hito.tipo === "consulta") {
        if (hito.fase === "start") nuevo("consulta", "Consultando el Currículum Nacional", "Consultó el Currículum Nacional", hito.at, { objeto: hito.objeto });
        else cerrar(hito.at, ["consulta"]);
      } else if (hito.tipo === "material") {
        const plan = hito.forma === "plan";
        const titulo = plan ? null : hito.titulo;
        const frase = plan ? ["Estructurando la propuesta", "Estructuró la propuesta"] : titulo ? ["Escribiendo", "Escribió"] : ["Escribiendo el resultado", "Escribió el resultado"];
        escribiendo ??= nuevo("material", frase[0], frase[1], hito.at);
        Object.assign(escribiendo, { activo: frase[0], hecho: frase[1] }, titulo ? { objeto: titulo } : {});
        const dato = plan ? `${hito.piezas} ${hito.piezas === 1 ? "material" : "materiales"}` : hito.preguntas ? `${hito.preguntas} ${hito.preguntas === 1 ? "pregunta" : "preguntas"}` : "";
        if (dato) escribiendo.dato = dato;
      } else if (hito.tipo === "guardado") {
        if (escribiendo) escribiendo.hasta = hito.at;
        escribiendo = null;
      } else if (hito.tipo === "cierre") {
        nuevo("cierre", "Cerrando la respuesta", "Cerró la respuesta", hito.at);
      }
    }
    return pasos;
  }
  // La frase y la ronda (modoDeLaRonda): piensa al leer, al pensar, al cerrar y entre un paso y otro; si no, trabaja
  function fraseYModo(pasos) {
    const paso = [...pasos].reverse().find((p) => p.hasta === null);
    if (!paso) return { frase: pasos.length ? ENTRE_PASOS : "Leyendo tu petición", modo: "piensa" };
    return { frase: paso.objeto ? `${paso.activo} «${paso.objeto}»` : paso.activo, modo: ["pedido", "pensar", "cierre"].includes(paso.clase) ? "piensa" : "trabaja" };
  }
  const pasoHTML = (paso, ahora) =>
    `<li class="run-card-step${paso.hasta === null ? " is-active" : ""}">${appIcon(ICONO_DEL_PASO[paso.clase], "inline", "run-card-step-icon")}<span class="run-card-step-text">` +
    `<span class="run-card-step-label">${esc(paso.hasta === null ? paso.activo : paso.hecho)}</span>${paso.objeto ? `<span class="run-card-step-object">${esc(paso.objeto)}</span>` : ""}` +
    `${paso.dato ? `<span class="run-card-step-data">${esc(paso.dato)}</span>` : ""}</span><span class="run-card-step-time">${duracionDelPaso((paso.hasta ?? ahora) - paso.desde)}</span></li>`;
  const detallesHTML = () =>
    `<div class="run-card-foot"><button type="button" class="run-details-toggle" tabindex="-1" aria-expanded="false"><span>Detalles</span>${appIcon("chevron-down", "inline", "run-details-chevron")}</button></div>`;
  function tarjetaHTML(hitos, ahora) {
    const pasos = pasosDe(hitos);
    const { frase, modo } = fraseYModo(pasos);
    // Con sólo leer el pedido, la lista no agrega nada: la tarjeta es su frase y su reloj
    const lista = pasos.some((paso) => paso.clase !== "pedido") ? `<ol class="run-card-steps">${pasos.map((paso) => pasoHTML(paso, ahora)).join("")}</ol>${detallesHTML()}` : "";
    return (
      `<section class="run-card" aria-label="Lo que pteron está haciendo"><header class="run-card-head">${rondaHTML(modo)}<div class="run-card-frase"><p class="run-card-phrase" role="status">${esc(frase)}</p>` +
      `<span class="run-card-brillo" aria-hidden="true">${esc(frase)}</span></div><span class="run-card-clock" aria-hidden="true">${relojDeLaCorrida(ahora)}</span></header>${lista}</section>`
    );
  }
  // El turno en un instante: los hitos que ya llegaron y el reloj; lo que llega se monta encima de la tarjeta
  const vivoHTML = (hitos = [{ at: 0, tipo: "inicio" }], ahora = 0, contenido = "") =>
    `<div class="chat-live" data-live-writing="true" data-live-content-length="0" data-live-revealed="0">${contenido}${tarjetaHTML(hitos.filter((hito) => hito.at <= ahora), ahora)}</div>`;
  // El plan mientras se escribe (LivePieces): su título y sus piezas, que son los materiales que promete
  const planVivoHTML = () =>
    `<div class="chat-live-material"><div class="chat-live-material-head"><p class="chat-live-material-title">${esc(DEMO.plan.title)}</p><span class="chat-live-material-count">1 material</span></div>` +
    `<ol class="chat-live-material-pieces"><li class="is-writing is-caret-active">${esc(DEMO.material)}</li></ol></div>`;

  /* Los dos turnos, con la hora en que el hilo supo cada hito (ms desde el envío) y cuánto duran: el plan consulta el
     currículum y se estructura; la guía piensa, se escribe bloque a bloque entre ESCRITURA[0] y ESCRITURA[1] y cierra */
  const TURNO_PLAN = [
    [1200, { tipo: "consulta", fase: "start", objeto: "fracciones equivalentes" }],
    [2600, { tipo: "consulta", fase: "end" }],
    [2900, { tipo: "material", forma: "plan", piezas: 1 }],
    [4300, { tipo: "guardado" }],
  ];
  const FIN_DEL_PLAN = 4500;
  const TURNO_GUIA = [
    [1300, { tipo: "pensamiento", fase: "start" }],
    [2700, { tipo: "pensamiento", fase: "end" }],
  ];
  const ESCRITURA = [3000, 7200];
  const FIN_DE_LA_GUIA = 8300;
  /* La ventana va más rápido que pteron, pero sus relojes no prometen una rapidez que la app no tiene: cada turno se
     cuenta con la hora que tendría allá. Cada par es [ms de la ventana, ms de la app] y entre dos pares el reloj corre
     parejo: leer, pensar y consultar toman lo suyo; escribir el material es lo largo (INTERFAZ.md de pteron da como
     ejemplos «Listo en 22 s» y «Listo en 1 min 2 s · 1 búsqueda»). */
  const RELOJ_DEL_PLAN = [[0, 0], [1200, 1900], [2600, 3400], [2900, 3700], [4300, 20_600], [FIN_DEL_PLAN, 21_800]];
  const RELOJ_DE_LA_GUIA = [[0, 0], [1300, 2100], [2700, 6200], [3000, 6600], [ESCRITURA[1], 52_400], [FIN_DE_LA_GUIA, 55_100]];
  function enLaApp(reloj, ms) {
    const i = reloj.findIndex(([t]) => t >= ms);
    if (i === 0) return reloj[0][1];
    // Pasado el último par, el reloj sigue al paso de la ventana
    if (i < 0) return reloj[reloj.length - 1][1] + ms - reloj[reloj.length - 1][0];
    const [[t0, a0], [t1, a1]] = [reloj[i - 1], reloj[i]];
    return a0 + ((ms - t0) * (a1 - a0)) / (t1 - t0);
  }
  // Lo que cuenta cada pie al terminar (corridaTerminada): los pasos de su turno, cerrados en su final
  const hitosDe = (turno, reloj) => [{ at: 0, tipo: "inicio" }, ...turno.map(([at, hito]) => ({ at: enLaApp(reloj, at), ...hito }))];
  const terminado = (hitos, fin) => pasosDe(hitos).map((paso) => (paso.hasta === null ? { ...paso, hasta: fin } : paso));
  // La guía escribe sus dos preguntas en la escritura (en vivo, la cuenta la da la hoja que se escribe)
  const HITOS_GUIA = hitosDe(
    [
      ...TURNO_GUIA,
      [ESCRITURA[0], { tipo: "material", forma: "document", titulo: DEMO.material, preguntas: 0 }],
      [5100, { tipo: "material", forma: "document", titulo: DEMO.material, preguntas: 1 }],
      [6600, { tipo: "material", forma: "document", titulo: DEMO.material, preguntas: 2 }],
      [ESCRITURA[1], { tipo: "guardado" }],
      [ESCRITURA[1], { tipo: "cierre" }],
    ],
    RELOJ_DE_LA_GUIA,
  );
  const PIE = [
    etiquetaDelPie(enLaApp(RELOJ_DEL_PLAN, FIN_DEL_PLAN), terminado(hitosDe(TURNO_PLAN, RELOJ_DEL_PLAN), enLaApp(RELOJ_DEL_PLAN, FIN_DEL_PLAN))),
    etiquetaDelPie(enLaApp(RELOJ_DE_LA_GUIA, FIN_DE_LA_GUIA), terminado(HITOS_GUIA, enLaApp(RELOJ_DE_LA_GUIA, FIN_DE_LA_GUIA))),
  ];

  /* Cada respuesta de pteron por dentro, terminada: su prosa, sus tarjetas y su pie. La secuencia la cambia dentro del
     mismo artículo, que no vuelve a entrar (Index, en ChatView) */
  const enVivo = (hitos, ahora, contenido) => `<div class="message-body">${vivoHTML(hitos, ahora, contenido)}</div>`;
  const planTerminado = (estado, hidratado = true) =>
    `<div class="message-body">${prosaHTML(DEMO.plan.intro)}</div><div class="chat-message-files">${planCardHTML(estado, hidratado)}</div>${pieHTML(PIE[0])}`;
  const guiaTerminada = (hidratado = true) =>
    `<div class="message-body">${prosaHTML(DEMO.answer)}</div><div class="chat-message-files">${materialCardHTML(hidratado)}</div>${pieHTML(PIE[1])}`;
  const pedido1 = (hidratado = true) => userHTML(DEMO.request, ENVIO[0], DEMO.horas[0], hidratado);
  const pedido2 = (hidratado = true) => userHTML(PEDIDO_DEL_PLAN, ENVIO[1], DEMO.horas[1], hidratado);

  // WorkspacePage.tsx: el hilo al centro y el muelle flotante al pie
  const workspaceHTML = (mensajes, momento, revision = "") =>
    `<div class="workspace-surface"${revision ? ` data-plan-review="${revision}"` : ""} data-pt-workspace><div class="workspace-main"><div class="chat-pane"><p class="sr-only" role="status"></p>` +
    `<div class="chat-history" data-pt-history><div class="chat-column">${mensajes}</div></div></div>${muelleChatHTML(momento)}</div></div>`;

  /* Los momentos de la ventana, como los arma la secuencia (y las pruebas): la Home en reposo, el pedido leído y
     aceptado, cada turno en curso, el plan por acordar o listo y el encargo terminado */
  const HOME = { texto: "", foco: false, contexto: {}, lectura: [] };
  const CONTEXTO_ACEPTADO = () => confirmar({}, leer(DEMO.request, {}));
  const ESCENAS = {
    home: () => ({ indice: undefined, encargo: false, main: homeHTML(HOME) }),
    leido: () => ({ indice: undefined, encargo: false, main: homeHTML({ texto: DEMO.request, foco: true, contexto: {}, lectura: leer(DEMO.request, {}) }) }),
    aceptado: () => ({ indice: undefined, encargo: false, main: homeHTML({ texto: DEMO.request, foco: true, contexto: CONTEXTO_ACEPTADO() }) }),
    plan: () => ({ indice: "trabajo", encargo: true, main: workspaceHTML(pedido1() + articuloHTML(enVivo(hitosDe(TURNO_PLAN, RELOJ_DEL_PLAN), enLaApp(RELOJ_DEL_PLAN, 2000))), "trabajando") }),
    decision: () => ({ indice: "aviso", encargo: true, main: workspaceHTML(pedido1() + articuloHTML(planTerminado("pendiente")), "decision", "questions") }),
    listo: () => ({ indice: null, encargo: true, main: workspaceHTML(pedido1() + articuloHTML(planTerminado("listo")), "plan", "ready") }),
    corriendo: () => ({
      indice: "trabajo",
      encargo: true,
      main: workspaceHTML(pedido1() + articuloHTML(planTerminado("creando"), { ultimo: false }) + pedido2() + articuloHTML(enVivo(HITOS_GUIA, enLaApp(RELOJ_DE_LA_GUIA, 7600))), "trabajando", "ready"),
    }),
    final: () => ({
      indice: null,
      encargo: true,
      main: workspaceHTML(pedido1() + articuloHTML(planTerminado("creado"), { ultimo: false }) + pedido2() + articuloHTML(guiaTerminada()), "conversacion", "ready"),
    }),
  };

  // App.tsx: el índice y la columna con su franja y el contenido; la ayuda en la esquina; los semáforos de macOS
  function windowHTML({ final = true, escena = final ? "final" : "home" } = {}) {
    const e = ESCENAS[escena]();
    return (
      `<div class="app-shell">${indiceHTML(e.indice)}<div class="shell-columna">${franjaHTML(e.encargo)}<div class="shell-main" data-pt-main>${e.main}</div></div>${esquinaHTML()}</div>` +
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

  window.pteronUI.window = { html: windowHTML, escenas: Object.keys(ESCENAS), setIcons: (href) => (ICONS = href) };
  window.pteronUI.privacyCard = privacyCardHTML;

  /* La escena: la ventana de 1440 × 880 se escala al ancho de su marco (en el teléfono, el marco recorta y se acerca) */
  const stage = document.querySelector("[data-pt-demo]");
  if (!stage) return;
  ICONS = stage.getAttribute("data-pt-icons") || ICONS;
  const frame = stage.querySelector("[data-pt-frame]");
  const app = frame?.querySelector(".pt-app");
  if (!app) return;
  // En el teléfono el marco no achica la ventana entera hasta lo ilegible: la vista se acerca a lo que pasa en cada paso
  // y lo sigue. Mientras se escribe, el recuadro; mientras pteron arma el plan, el pedido y la respuesta en curso; con el
  // plan propuesto, el plan y el recuadro, que pregunta; al crear, el pedido, la hoja con la tarjeta de la corrida y el
  // recuadro, que puede detenerla; al terminar, la respuesta. De cada lista vale lo que esté a la vista.
  const APP_W = 1440;
  const APP_H = 880;
  const ultimo = (sel) => [...app.querySelectorAll(sel)].pop();
  const FOCO = [
    { ancho: 1000, ver: () => [app.querySelector(".composer")] },
    {
      ancho: 860,
      ver: () =>
        app.querySelector(".chat-plan-card")
          ? [app.querySelector(".chat-plan-card"), app.querySelector(".composer-dock")]
          : [ultimo(".message.user"), app.querySelector(".message.assistant.is-latest .chat-live")],
    },
    { ancho: 860, ver: () => [ultimo(".message.user"), app.querySelector(".message.assistant.is-latest .chat-live"), app.querySelector(".composer-dock")] },
    { ancho: 860, ver: () => [app.querySelector(".message.assistant.is-latest")] },
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
    const cajas = foco
      .ver()
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
    // Lo que se mira queda al centro; si es más alto que el marco, se ve desde abajo, donde ocurre. Nunca se sale de la
    // ventana y, en la conversación, la franja de arriba queda fuera: su título empieza antes del borde y se vería cortado.
    const maxX = Math.max(0, (APP_W * s - W) / 2);
    const x = Math.max(-maxX, Math.min(maxX, ((APP_W - izquierda - derecha) / 2) * s));
    const centro = H / 2 - ((arriba + abajo) / 2) * s;
    const desdeAbajo = H - 14 - abajo * s;
    const franja = app.querySelector(".chat-pane") && app.querySelector(".shell-topbar");
    const techo = franja ? -((franja.getBoundingClientRect().bottom - a.top) / ahora) * s : 0;
    const y = Math.max(Math.min(0, H - APP_H * s), Math.min(techo, (abajo - arriba) * s > H - 28 ? desdeAbajo : centro));
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
  // Lo que vive mientras corre la secuencia (el reloj de un turno, la ronda): se detiene con ella
  const limpiezas = new Set();
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
    limpiezas.forEach((limpiar) => limpiar());
    limpiezas.clear();
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
  // Un clic visible: el cursor tiñe y la pieza se aprieta como con :active en la app, que un script no puede activar
  const APRIETE = {
    enviar: { filter: "brightness(0.85)", transform: "scale(0.94)" },
    dominante: { filter: "brightness(0.85)", boxShadow: "inset 0 1px 3px rgb(0 0 0 / 0.25)" },
    suave: { filter: "brightness(0.92)" },
  };
  async function pulsar(el, como, id, tenir = false) {
    if (!el) return;
    el.style.transition = "transform 90ms, filter 90ms, box-shadow 90ms, background-color 120ms";
    if (tenir) {
      el.style.backgroundColor = "var(--ctl-hover-wash)";
      await sleep(260, id);
    }
    Object.assign(el.style, APRIETE[como]);
    await sleep(150, id);
    el.style.filter = "";
    el.style.transform = "";
    el.style.boxShadow = "";
  }

  // Un texto que se escribe sólo si cambia: el reloj se mira seguido y casi siempre dice lo mismo
  const poner = (el, texto) => {
    if (el && el.textContent !== texto) el.textContent = texto;
  };
  const history = () => $("[data-pt-history]");
  const stick = () => {
    const h = history();
    if (h) h.scrollTop = h.scrollHeight;
  };
  // Monta un momento entero, sin animar lo que ya estaba (como al abrir la conversación)
  function mostrar(escena) {
    app.innerHTML = windowHTML({ escena });
    stick();
  }
  // Las piezas que cambian por su cuenta: el índice (el estado del encargo), la franja y el muelle
  const ponerIndice = (tono) => {
    const fila = $("[data-pt-encargo]");
    if (fila) fila.outerHTML = encargoHTML(ENCARGO, "hoy", { tono, actual: true, nuevo: true });
  };
  function ponerMuelle(momento) {
    const dock = $("[data-pt-dock]");
    const composer = dock?.querySelector("[data-pt-composer]");
    if (!composer) return;
    const trabajando = momento === "trabajando";
    dock.className = `composer-dock is-floating tone-${trabajando ? "trabajando" : "decision"}`;
    const contexto = dock.querySelector(".composer-dock-context");
    if (momento === "decision") contexto.innerHTML = decisionHTML();
    else contexto.querySelector(".composer-dock-decision")?.remove();
    // Los chips del turno vuelven al terminar; durante la corrida los declara la burbuja
    const chips = composer.querySelector(":scope > .composer-chips");
    if (trabajando) chips?.remove();
    else if (!chips) composer.insertAdjacentHTML("afterbegin", chipsHTML());
    composer.classList.toggle("has-chips", !trabajando);
    composer.querySelector("textarea").placeholder = PLACEHOLDER[momento];
    composer.querySelector(".composer-attach").toggleAttribute("disabled", trabajando);
    const enviar = composer.querySelector(".composer-send");
    if (enviar.classList.contains("is-stop") !== trabajando) enviar.outerHTML = trabajando ? detenerHTML() : enviarHTML(false);
  }
  const medirRecuadro = () => {
    const dock = $("[data-pt-dock]");
    const ws = $("[data-pt-workspace]");
    if (dock && ws) ws.style.setProperty("--pteron-dock-h", `${Math.ceil(dock.offsetHeight)}px`);
  };

  /* La ronda en vivo (ActivityMark.tsx): un solo bucle de cuadros para las marcas a la vista, que se detiene con la
     última. Con movimiento reducido la secuencia no corre: la ventana muestra el encargo terminado. */
  const rondas = new Set();
  let cuadroDeLaRonda = 0;
  let anteriorDeLaRonda = null;
  function girar(ahora) {
    const dt = anteriorDeLaRonda === null ? 1000 / 60 : ahora - anteriorDeLaRonda;
    anteriorDeLaRonda = ahora;
    for (const marca of rondas) {
      if (!marca.svg.isConnected) {
        rondas.delete(marca);
        continue;
      }
      marca.estado = avanzarLaRonda(marca.estado, dt, marca.modo);
      puntosDeLaRonda(marca.estado).forEach((punto, i) => {
        marca.circulos[i]?.setAttribute("cx", punto.x.toFixed(2));
        marca.circulos[i]?.setAttribute("cy", punto.y.toFixed(2));
        marca.circulos[i]?.setAttribute("r", punto.r.toFixed(2));
      });
    }
    cuadroDeLaRonda = rondas.size ? requestAnimationFrame(girar) : 0;
    if (!cuadroDeLaRonda) anteriorDeLaRonda = null;
  }
  function animarRonda(svg) {
    const marca = { svg, modo: svg.getAttribute("data-modo"), estado: rondaEnReposo(svg.getAttribute("data-modo")), circulos: [...svg.querySelectorAll("circle")] };
    rondas.add(marca);
    if (!cuadroDeLaRonda) cuadroDeLaRonda = requestAnimationFrame(girar);
    return marca;
  }
  const detenerRondas = () => {
    if (cuadroDeLaRonda) cancelAnimationFrame(cuadroDeLaRonda);
    cuadroDeLaRonda = 0;
    anteriorDeLaRonda = null;
    rondas.clear();
  };

  /* Un turno en vivo: los hitos llegan a su hora y la tarjeta de la corrida los cuenta. El reloj del turno y el tiempo
     vivo del paso en curso dicen la hora de la app (`reloj`), que mientras se escribe corre más rápido que la ventana;
     cada frase queda al menos 1,2 s a la vista y «Preparando la respuesta» se dice sólo si la espera entre pasos se
     nota. Un paso ya mostrado se actualiza en su lugar. */
  function corrida(article, reloj) {
    const card = article.querySelector(".run-card");
    const marca = animarRonda(card.querySelector(".activity-mark"));
    const inicio = performance.now();
    const hitos = [{ at: 0, tipo: "inicio" }];
    let ahora = 0;
    let mostrada = { frase: "Leyendo tu petición", modo: "piensa" };
    let desde = performance.now();
    let pendiente = 0;
    const pintarFrase = (siguiente) => {
      mostrada = siguiente;
      desde = performance.now();
      card.querySelector(".run-card-phrase").textContent = siguiente.frase;
      card.querySelector(".run-card-brillo").textContent = siguiente.frase;
      marca.svg.setAttribute("data-modo", siguiente.modo);
      marca.modo = siguiente.modo;
    };
    const fijarFrase = (siguiente) => {
      clearTimeout(pendiente);
      if (siguiente.frase === mostrada.frase && siguiente.modo === mostrada.modo) return;
      const espera = Math.max(PHRASE_HOLD_MS - (performance.now() - desde), siguiente.frase === ENTRE_PASOS ? ENTRE_PASOS_TRAS_MS : 0);
      if (espera <= 0) pintarFrase(siguiente);
      else pendiente = setTimeout(() => pintarFrase(siguiente), espera);
    };
    // Con agregar en falso sólo se actualizan las filas ya escritas
    const pintarPasos = (agregar = true) => {
      const pasos = pasosDe(hitos);
      if (!pasos.some((paso) => paso.clase !== "pedido")) return;
      let lista = card.querySelector(".run-card-steps");
      if (!lista) {
        if (!agregar) return;
        card.querySelector(".run-card-head").insertAdjacentHTML("afterend", `<ol class="run-card-steps"></ol>${detallesHTML()}`);
        lista = card.querySelector(".run-card-steps");
      }
      pasos.forEach((paso, i) => {
        const fila = lista.children[i];
        if (!fila) {
          if (agregar) lista.insertAdjacentHTML("beforeend", pasoHTML(paso, ahora));
          return;
        }
        // Por posición, como Index: la fila ya escrita cambia su texto y su tiempo, sin repetir su entrada
        fila.classList.toggle("is-active", paso.hasta === null);
        const texto = fila.querySelector(".run-card-step-text");
        const nuevo = `<span class="run-card-step-label">${esc(paso.hasta === null ? paso.activo : paso.hecho)}</span>${paso.objeto ? `<span class="run-card-step-object">${esc(paso.objeto)}</span>` : ""}${paso.dato ? `<span class="run-card-step-data">${esc(paso.dato)}</span>` : ""}`;
        if (texto.innerHTML !== nuevo) texto.innerHTML = nuevo;
        poner(fila.querySelector(".run-card-step-time"), duracionDelPaso((paso.hasta ?? ahora) - paso.desde));
      });
    };
    // Lo que trae un hito (el plan, la hoja) entra primero y el hilo baja con ello; la tarjeta escribe sus pasos dos
    // cuadros después. En un mismo cuadro, el hilo correría la tarjeta mientras crece: un salto del diseño (CLS)
    let cuadro = 0;
    const pintarLuego = () => {
      if (cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = requestAnimationFrame(() => {
          cuadro = 0;
          pintarPasos();
          stick();
        });
      });
    };
    // El reloj se mira diez veces por segundo: así cuenta de a un segundo aunque la hora de la app corra más rápido
    const tic = () => {
      ahora = enLaApp(reloj, Math.max(0, performance.now() - inicio));
      poner(card.querySelector(".run-card-clock"), relojDeLaCorrida(ahora));
      pintarPasos(!cuadro);
    };
    const marcador = setInterval(tic, 100);
    const detener = () => {
      clearInterval(marcador);
      clearTimeout(pendiente);
      cancelAnimationFrame(cuadro);
      cuadro = 0;
    };
    limpiezas.add(detener);
    return {
      // `at`: ms de la ventana desde el envío, que la tarjeta cuenta en la hora de la app
      hito(at, hito) {
        hitos.push({ at: enLaApp(reloj, at), ...hito });
        pintarLuego();
        fijarFrase(fraseYModo(pasosDe(hitos)));
      },
      detener,
    };
  }

  /* El vuelo «resultado»: el turno que termina en un material se funde en su respuesta, con la tarjeta ya cargada. La
     imagen de antes se va enseguida (pteron-se-va, --mo-xs) y la de después llega en el camino (pteron-funde, --mo-sm). */
  const CURVA = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  async function fundir(cambio) {
    const hist = history();
    const antes = hist?.cloneNode(true);
    if (antes) {
      antes.removeAttribute("data-pt-history");
      antes.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      Object.assign(antes.style, { position: "absolute", left: `${hist.offsetLeft}px`, top: `${hist.offsetTop}px`, width: `${hist.offsetWidth}px`, height: `${hist.offsetHeight}px`, pointerEvents: "none", zIndex: "1" });
      hist.parentElement.appendChild(antes);
      antes.scrollTop = hist.scrollTop;
    }
    cambio();
    medirRecuadro();
    stick();
    hist?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: CURVA });
    if (antes) antes.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: CURVA, fill: "forwards" }).finished.then(() => antes.remove(), () => antes.remove());
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

  /* 1. Pedir: el recuadro recibe el foco, el pedido se escribe, tras la pausa de 450 ms pteron lo lee en una frase y
     «Agregar todo» deja cada dato en su ranura; la invitación del curso le cede su lugar y la de la asignatura queda */
  async function pedir(id) {
    await sleep(900, id);
    $("[data-pt-composer]").classList.add("is-focused");
    await sleep(400, id);
    const field = $("textarea");
    const chars = [...DEMO.request];
    for (let i = 0; i < chars.length; i += 1) {
      field.value = chars.slice(0, i + 1).join("");
      if (i === 0) $(".composer-send")?.removeAttribute("disabled");
      const c = chars[i];
      const wobble = ((i * 37) % 11) * 3; // ritmo de quien escribe
      await sleep(c === "," ? 190 : c === " " ? 40 + wobble : 22 + wobble, id);
    }
    await sleep(450, id); // la pausa de la app antes de leer el pedido (PAUSA_DE_LECTURA_MS)
    const lectura = leer(DEMO.request, {});
    const fila = $(".fila-pedido");
    if (lectura.some((pieza) => pieza.slot === "course")) fila.firstElementChild?.remove();
    fila.insertAdjacentHTML("afterend", lecturaHTML(lectura, true));
    await sleep(1500, id);
    await pulsar($(".composer-suggestions-all"), "suave", id, true);
    // Confirmado, cada dato queda en su ranura: el tipo y el curso antes de la asignatura; el tema y la duración después
    const contexto = confirmar({}, lectura);
    $(".composer-suggestions")?.remove();
    const asignatura = $(".fila-pedido .filter-field");
    asignatura.insertAdjacentHTML("beforebegin", datoHTML("intent", INTENT_LABEL[contexto.artifactIntent]) + selectHTML("Curso", "graduation-cap", contexto.course));
    asignatura.insertAdjacentHTML("afterend", datoHTML("topic", contexto.topic) + datoHTML("duration", contexto.duration) + limpiarHTML());
    await sleep(1000, id);
    await pulsar($(".composer-send"), "enviar", id);
  }

  /* El vuelo «envio»: el recuadro baja al pie de la conversación y el pedido viaja a su burbuja, mientras lo demás de la
     Home cede su lugar al hilo. La conversación nace entera, con el pedido y la respuesta en curso. */
  function enviar() {
    const escala = app.getBoundingClientRect().width / APP_W || 1;
    const caja = (el) => el?.getBoundingClientRect();
    const recuadro = caja($("[data-pt-dock]"));
    const campo = caja($("[data-pt-composer] textarea"));
    $(".shell-index").outerHTML = indiceHTML("trabajo");
    $(".shell-topbar").outerHTML = franjaHTML(true);
    $("[data-pt-main]").innerHTML = workspaceHTML(pedido1() + articuloHTML(enVivo()), "trabajando");
    // Durante el vuelo la superficie no hace su llegada propia: el vuelo ya la trae
    const ws = $("[data-pt-workspace]");
    ws.style.transition = "none";
    requestAnimationFrame(() => ws.style.removeProperty("transition"));
    medirRecuadro();
    stick();
    const desde = (el, caja0) => {
      const c = caja(el);
      return `translate(${((caja0.left - c.left) / escala).toFixed(1)}px, ${((caja0.top - c.top) / escala).toFixed(1)}px)`;
    };
    const dock = $("[data-pt-dock]");
    if (recuadro) dock.animate([{ transform: desde(dock, recuadro) }, { transform: "none" }], { duration: 340, easing: CURVA });
    const burbuja = $(".message.user .message-bubble");
    if (campo) burbuja.animate([{ transform: desde(burbuja, campo), opacity: 0 }, { opacity: 0, offset: 0.35 }, { transform: "none", opacity: 1 }], { duration: 340, easing: CURVA });
    for (const el of [$(".message.user .message-meta"), $(".message.assistant"), $(".shell-topbar"), $("[data-pt-encargo]")]) el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: CURVA });
  }

  // Un turno de pteron: sus hitos llegan a su hora (ms de la ventana desde el envío), con lo que escribe, y termina en
  // `fin`; la tarjeta los cuenta con la hora de la app (`reloj`)
  async function turno(id, article, { hitos, fin, reloj }, escribir = async () => {}) {
    const vivo = corrida(article, reloj);
    let t = 0;
    const hasta = async (at) => {
      if (at > t) await sleep(at - t, id);
      t = Math.max(t, at);
    };
    for (const [at, hito] of hitos) {
      await hasta(at);
      vivo.hito(at, hito);
      stick();
    }
    await escribir(vivo, hasta);
    await hasta(fin);
    vivo.detener();
  }

  /* 2. Decidir: pteron consulta el currículum y estructura un plan, que llega a medio escribir; el encargo dice en el
     índice que falta una decisión y el recuadro la pregunta, con la sugerida primero. Elegida, el plan queda listo y
     su tarjeta ofrece crear la guía. */
  async function correrElPlan(id) {
    const article = $(".message.assistant.is-latest");
    const live = article.querySelector(".chat-live");
    const [antes, despues] = [TURNO_PLAN.filter(([at]) => at < 2900), TURNO_PLAN.filter(([at]) => at >= 2900)];
    await turno(id, article, { hitos: antes, fin: 2900, reloj: RELOJ_DEL_PLAN }, async (vivo, hasta) => {
      for (const [at, hito] of despues) {
        await hasta(at);
        vivo.hito(at, hito);
        if (hito.tipo === "material") {
          live.setAttribute("data-live-material", "plan");
          live.insertAdjacentHTML("afterbegin", planVivoHTML());
        }
        stick();
      }
      await hasta(FIN_DEL_PLAN);
    });
    detenerRondas();
    // El vuelo «resultado»: el mismo mensaje pasa a su respuesta, con la tarjeta del plan recién creada
    await fundir(() => {
      article.innerHTML = planTerminado("pendiente", false);
      ponerIndice("aviso");
      ponerMuelle("decision");
      $("[data-pt-workspace]").setAttribute("data-plan-review", "questions");
    });
  }
  async function decidir(id) {
    await sleep(1900, id);
    await pulsar($(".plan-choice"), "suave", id, true);
    await sleep(300, id);
    // Responder guarda el plan: su tarjeta cambia en su lugar (la decisión, el estado y lo que se despliega)
    $(".chat-plan-card").outerHTML = planCardHTML("listo");
    ponerIndice(null);
    ponerMuelle("plan");
    $("[data-pt-workspace]").setAttribute("data-plan-review", "ready");
    medirRecuadro();
    stick();
    await sleep(1300, id);
    await pulsar($("[data-pt-crear]"), "dominante", id);
  }

  /* 3. Crear: la burbuja nombra la guía que se crea; pteron lee, piensa y la escribe bloque a bloque sobre el papel, con
     la tarjeta de la corrida al pie; guardada, cierra la respuesta. Mientras tanto el plan no ofrece crearla otra vez. */
  async function crear(id) {
    $(".message.assistant.is-latest")?.classList.remove("is-latest");
    $(".chat-plan-card").outerHTML = planCardHTML("creando");
    $(".chat-column").insertAdjacentHTML("beforeend", pedido2(false) + articuloHTML(enVivo(), { hidratado: false }));
    ponerIndice("trabajo");
    ponerMuelle("trabajando");
    medirRecuadro();
    stick();
    const article = $(".message.assistant.is-latest");
    const viva = liveSheet();
    await turno(id, article, { hitos: TURNO_GUIA, fin: FIN_DE_LA_GUIA, reloj: RELOJ_DE_LA_GUIA }, async (vivo, hasta) => {
      await hasta(ESCRITURA[0]);
      const live = article.querySelector(".chat-live");
      live.setAttribute("data-live-material", "document");
      live.insertAdjacentHTML(
        "afterbegin",
        `<div class="chat-live-material"><div class="chat-live-material-head"><p class="chat-live-material-title">${esc(DEMO.material)}</p><span class="chat-live-material-count"></span></div><div class="chat-live-sheet"></div></div>`,
      );
      const count = live.querySelector(".chat-live-material-count");
      const bloques = viva?.bloques ?? [];
      if (viva) {
        const marco = live.querySelector(".chat-live-sheet");
        marco.appendChild(viva.hoja);
        viva.hoja.style.zoom = String(Math.min(1, marco.clientWidth / 794));
      }
      // Los bloques de la hoja llegan repartidos en la escritura; el paso cuenta las preguntas desde la primera
      const n = Math.max(1, bloques.length);
      for (let i = 0; i < n; i += 1) {
        const at = ESCRITURA[0] + Math.round((i * (ESCRITURA[1] - 600 - ESCRITURA[0])) / Math.max(1, n - 1));
        await hasta(at);
        if (bloques[i]) bloques[i].hidden = false;
        count.textContent = `${i + 1} ${i ? "partes" : "parte"}`;
        const preguntas = bloques.slice(0, i + 1).reduce((suma, b) => suma + (b.matches('[data-pteron-kind="question"]') ? 1 : 0) + b.querySelectorAll('[data-pteron-kind="question"]').length, 0);
        vivo.hito(at, { tipo: "material", forma: "document", titulo: DEMO.material, preguntas });
        stick();
      }
      await hasta(ESCRITURA[1]);
      vivo.hito(ESCRITURA[1], { tipo: "guardado" });
      vivo.hito(ESCRITURA[1], { tipo: "cierre" });
      stick();
    });
    detenerRondas();
  }

  // 4. El resultado (vuelo «resultado»): la hoja se funde en la respuesta, con la tarjeta del material y «Listo en …»
  async function resultado() {
    await fundir(() => {
      $(".message.assistant.is-latest").innerHTML = guiaTerminada(false);
      $(".chat-plan-card").outerHTML = planCardHTML("creado");
      ponerIndice(null);
      ponerMuelle("conversacion");
      const anuncio = $(".chat-pane > [role=status]");
      if (anuncio) anuncio.textContent = `${PIE[1]} · «${DEMO.material}»`;
    });
  }

  function showFinal() {
    cancel();
    detenerRondas();
    status = "done";
    pristine = false;
    mostrar("final");
    medirRecuadro();
    stick();
    setStep(steps.length);
    stage.classList.add("is-done");
  }

  async function play(from = 0) {
    cancel();
    detenerRondas();
    const id = run;
    status = "playing";
    stage.classList.remove("is-done");
    try {
      // 1. Pedir
      if (from <= 0) {
        setStep(0);
        if (!pristine) mostrar("home");
        pristine = false;
        await pedir(id);
      }
      // 2. Decidir: desde el paso 1, el envío y el turno del plan; desde aquí, el plan ya propuesto
      if (from <= 1) {
        setStep(1);
        if (from === 1) {
          mostrar("decision");
          medirRecuadro();
        } else {
          enviar();
          await correrElPlan(id);
        }
        await decidir(id);
      }
      // 3. Crear
      if (from <= 2) {
        setStep(2);
        if (from === 2) {
          mostrar("listo");
          medirRecuadro();
          await sleep(700, id);
          await pulsar($("[data-pt-crear]"), "dominante", id);
        }
        await crear(id);
      }
      // 4. Listo: la guía queda en el encargo
      setStep(3);
      if (from === 3) return showFinal();
      await resultado();
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
  // Si el sistema pide movimiento reducido a mitad de camino, la ventana muestra el encargo terminado, quieta
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (event) => {
    if (event.matches) showFinal();
  });
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
          detenerRondas();
          mostrar("home");
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
