window.PTERON_DOCS = {
  groups: [
    {
      label: "Empezar",
      pages: [
        ["inicio", "Qué es pteron"],
        ["requisitos", "Requisitos"],
        ["instalar-macos", "Instalar en macOS"],
        ["instalar-windows", "Instalar en Windows"],
        ["primera-apertura", "Primera apertura"],
        ["actualizar", "Actualizar pteron"]
      ]
    },
    {
      label: "Conceptos",
      pages: [
        ["carpeta-trabajo", "Carpeta de trabajo"],
        ["fuentes-contexto", "Fuentes y contexto"],
        ["sesiones-memoria", "Sesiones y memoria"],
        ["artefactos", "Artefactos y revisiones"]
      ]
    },
    {
      label: "Trabajar con pteron",
      pages: [
        ["crear-guia", "Crear una guía"],
        ["planificar", "Crear una planificación"],
        ["evaluar", "Crear una evaluación"],
        ["rubricas", "Crear una rúbrica"],
        ["revisar-exportar", "Revisar y guardar"]
      ]
    },
    {
      label: "Privacidad y control",
      pages: [
        ["trabajo-local", "Trabajo local"],
        ["datos-estudiantes", "Datos de estudiantes"],
        ["modelos-permisos", "Modelos y permisos"]
      ]
    },
    {
      label: "Ayuda",
      pages: [
        ["preguntas", "Preguntas frecuentes"],
        ["solucion-problemas", "Solución de problemas"],
        ["versiones", "Versiones y plataformas"]
      ]
    }
  ],
  pages: {
    "inicio": {
      eyebrow: "Documentación",
      title: "Trabaja con pteron",
      lead: "Instala la aplicación, agrega tus fuentes y crea materiales que puedes revisar antes de guardar.",
      html: `
        <section>
          <h2 id="por-donde-empezar">Por dónde empezar</h2>
          <div class="path-list">
            <a href="/docs/instalar-macos"><span>01</span><strong>Instala pteron</strong><small>Disponible en beta para macOS M series y Windows 11.</small></a>
            <a href="/docs/carpeta-trabajo"><span>02</span><strong>Elige una carpeta</strong><small>pteron trabaja dentro de una ubicación que tú controlas.</small></a>
            <a href="/docs/fuentes-contexto"><span>03</span><strong>Agrega tus fuentes</strong><small>Usa documentos y referencias para orientar el trabajo.</small></a>
            <a href="/docs/crear-guia"><span>04</span><strong>Crea y revisa</strong><small>Genera un borrador editable y decide qué conservar.</small></a>
          </div>
        </section>
        <section>
          <h2 id="que-puedes-crear">Qué puedes crear</h2>
          <p>pteron ayuda a preparar guías, planificaciones, evaluaciones y rúbricas. No reemplaza tu criterio ni entrega materiales cerrados: propone un punto de partida para revisar.</p>
          <figure class="product-shot"><img src="/assets/product-home-current.png" width="2242" height="1540" alt="Pantalla inicial completa de pteron"><figcaption>El espacio de trabajo inicial de pteron.</figcaption></figure>
        </section>`
    },
    "requisitos": {
      eyebrow: "Empezar",
      title: "Requisitos",
      lead: "Una carpeta de trabajo y un equipo compatible son suficientes para comenzar.",
      html: `
        <section><h2 id="macos">macOS</h2><ul><li>Procesador Apple serie M.</li><li>Una versión reciente y compatible de macOS.</li><li>Espacio disponible para la aplicación, tus documentos y el modelo local que elijas.</li></ul></section>
        <section><h2 id="windows">Windows 11</h2><ul><li>Windows 11 en un equipo de 64 bits.</li><li>Permiso para instalar aplicaciones descargadas desde la web.</li><li>Espacio disponible para documentos y modelos locales.</li></ul><div class="notice"><strong>Beta sin firma digital</strong><p>El instalador de Windows todavía no está firmado. SmartScreen puede mostrar una advertencia y pedir confirmación antes de continuar.</p></div></section>
        <section><h2 id="conexion">Conexión</h2><p>El trabajo con tus archivos es local. Algunas capacidades externas y la descarga de actualizaciones necesitan conexión y se presentan de forma visible.</p></section>`
    },
    "instalar-macos": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en macOS",
      lead: "La beta para macOS está disponible en equipos con procesadores M series.",
      html: `
        <section><h2 id="descargar">1. Descarga pteron</h2><p>Abre la <a href="/descargar/">página de descargas</a> y elige la versión para macOS M series.</p></section>
        <section><h2 id="instalar">2. Instala la aplicación</h2><ol><li>Abre el archivo <code>.dmg</code>.</li><li>Arrastra pteron a la carpeta Aplicaciones.</li><li>Abre pteron desde Aplicaciones.</li></ol></section>
        <section><h2 id="primer-inicio">3. Completa el primer inicio</h2><p>macOS puede verificar la aplicación antes de abrirla por primera vez. Después, pteron te pedirá elegir o confirmar tu carpeta de trabajo.</p></section>`
    },
    "instalar-windows": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en Windows",
      lead: "pteron está disponible para Windows 11 mientras continúa en beta.",
      html: `
        <div class="notice notice-prominent"><strong>Windows puede mostrar una advertencia</strong><p>El instalador de la beta todavía no tiene firma digital. Microsoft Defender SmartScreen puede pedirte confirmar la instalación. Esta limitación se mantendrá visible mientras pteron siga en beta.</p></div>
        <section><h2 id="pasos">Pasos de instalación</h2><ol class="install-steps"><li>Descarga el instalador desde la <a href="/descargar/">página de descargas</a>.</li><li>Abre el archivo <code>.exe</code>.</li><li>Si aparece SmartScreen, selecciona <strong>Más información</strong> y después <strong>Ejecutar de todas formas</strong>.</li><li>Completa los pasos del instalador.</li><li>Abre pteron desde el menú Inicio.</li></ol>
        <figure class="product-shot"><img src="/assets/product-home-current.png" width="2242" height="1540" alt="Pantalla inicial completa de pteron"><figcaption>Al abrir, verás el espacio de trabajo de pteron.</figcaption></figure></section>
        <section><h2 id="verificar">Antes de continuar</h2><p>Comprueba que el archivo provenga del enlace oficial de pteron. Si tu organización administra el equipo, puede ser necesaria la autorización del área responsable.</p></section>`
    },
    "primera-apertura": {
      eyebrow: "Empezar",
      title: "Primera apertura",
      lead: "Configura sólo lo necesario para empezar y conserva el control de tu carpeta.",
      html: `<section><h2 id="carpeta">Elige una carpeta</h2><p>Selecciona una carpeta dedicada para pteron. La aplicación limita su trabajo a esa ubicación visible.</p></section><section><h2 id="modelo">Configura un modelo</h2><p>Elige una opción local o habilita una capacidad externa. pteron indica cuándo una acción necesita conexión.</p></section><section><h2 id="primera-sesion">Inicia una sesión</h2><p>Agrega una fuente o describe el material que necesitas. Puedes revisar el contexto antes de enviar.</p></section>`
    },
    "actualizar": {
      eyebrow: "Empezar",
      title: "Actualizar pteron",
      lead: "La aplicación avisa cuando hay una nueva versión de tu canal.",
      html: `<section><h2 id="canal-beta">Canal beta</h2><p>La beta pública es gratuita. Durante esta etapa recibirás versiones de prueba con correcciones y cambios frecuentes. El canal estable figura como próximamente.</p></section><section><h2 id="instalacion">Cómo se aplica</h2><p>pteron descarga la actualización y pide tu consentimiento antes de instalarla al reiniciar.</p></section><section><h2 id="windows">Windows sin firma</h2><div class="notice"><strong>Limitación conocida</strong><p>Las actualizaciones de Windows aún se distribuyen sin firma digital. El estado de firma se informa por plataforma.</p></div></section>`
    },
    "carpeta-trabajo": {
      eyebrow: "Conceptos",
      title: "Carpeta de trabajo",
      lead: "Es el límite visible dentro del cual pteron puede leer y crear archivos.",
      html: `<section><h2 id="por-que">Por qué existe</h2><p>pteron no tiene acceso general a tu equipo. Tú eliges la carpeta y puedes cambiarla desde la configuración.</p></section><section><h2 id="originales">Tus originales</h2><p>La aplicación no sobrescribe los archivos de origen. Los resultados se guardan como copias nuevas mediante una acción visible.</p></section><section><h2 id="organizar">Cómo organizarla</h2><p>Una estructura simple por curso, unidad o proyecto facilita encontrar fuentes y resultados. No necesitas adoptar una plantilla rígida.</p></section>`
    },
    "fuentes-contexto": {
      eyebrow: "Conceptos",
      title: "Fuentes y contexto",
      lead: "Las fuentes sostienen el material; el contexto explica qué necesitas hacer con ellas.",
      html: `<section><h2 id="fuentes">Fuentes</h2><p>Puedes incorporar documentos y referencias de tu trabajo. pteron muestra qué material está usando para que puedas inspeccionarlo.</p></section><section><h2 id="contexto">Contexto</h2><p>Incluye curso, objetivo, duración, formato esperado y cualquier condición que cambie el resultado.</p></section><section><h2 id="ejemplo">Ejemplo</h2><blockquote>“Crea una guía de 45 minutos para 7° básico. Usa el documento adjunto como única fuente y deja una sección final de reflexión.”</blockquote></section>`
    },
    "sesiones-memoria": {
      eyebrow: "Conceptos",
      title: "Sesiones y memoria",
      lead: "Una sesión reúne una conversación, sus fuentes y las decisiones de ese trabajo.",
      html: `<section><h2 id="sesiones">Sesiones</h2><p>Crea una sesión nueva cuando cambie el objetivo principal. El historial permite volver a trabajos anteriores.</p></section><section><h2 id="memoria">Memoria</h2><p>La memoria conserva preferencias que eliges guardar. Puedes revisar y retirar esos datos.</p></section>`
    },
    "artefactos": {
      eyebrow: "Conceptos",
      title: "Artefactos y revisiones",
      lead: "El resultado no queda encerrado en el chat: aparece como un documento editable.",
      html: `<section><h2 id="artefacto">Artefacto</h2><p>Es la guía, planificación, evaluación o rúbrica que puedes abrir, leer y editar.</p></section><section><h2 id="revision">Revisión</h2><p>Comprueba fuentes, instrucciones, nivel, puntajes y formato antes de guardar una copia.</p></section>`
    },
    "crear-guia": {
      eyebrow: "Trabajar con pteron",
      title: "Crear una guía",
      lead: "Parte desde tus fuentes y define el propósito antes de pedir el borrador.",
      html: `<section><h2 id="preparar">1. Prepara</h2><p>Agrega la fuente principal y, si existe, una guía anterior que muestre el formato esperado.</p></section><section><h2 id="pedir">2. Pide</h2><blockquote>“Prepara una guía para 8° básico con inicio, desarrollo y cierre. Incluye seis preguntas y una pauta breve.”</blockquote></section><section><h2 id="revisar">3. Revisa</h2><p>Comprueba que cada actividad se sostenga en las fuentes y ajusta lenguaje, tiempos e instrucciones.</p></section>`
    },
    "planificar": {
      eyebrow: "Trabajar con pteron",
      title: "Crear una planificación",
      lead: "Entrega el marco de la clase y deja que pteron proponga una estructura editable.",
      html: `<section><h2 id="contexto">Contexto mínimo</h2><p>Indica curso, objetivo, duración, recursos disponibles y forma de cierre.</p></section><section><h2 id="revisar">Qué revisar</h2><p>Verifica la progresión, los tiempos, la coherencia con el objetivo y las oportunidades reales de participación.</p></section>`
    },
    "evaluar": {
      eyebrow: "Trabajar con pteron",
      title: "Crear una evaluación",
      lead: "Define aprendizajes, forma de evidencia y criterios antes de generar ítems.",
      html: `<section><h2 id="alcance">Delimita el alcance</h2><p>Adjunta las fuentes que deben cubrirse e indica nivel, duración y puntaje total.</p></section><section><h2 id="calidad">Revisa los ítems</h2><p>Comprueba claridad, respuesta esperada, dificultad, cobertura y correspondencia entre puntaje y demanda.</p></section><section><h2 id="datos">Evita datos reales</h2><p>No incluyas nombres ni antecedentes identificables de estudiantes para producir ejemplos.</p></section>`
    },
    "rubricas": {
      eyebrow: "Trabajar con pteron",
      title: "Crear una rúbrica",
      lead: "Describe la tarea y las evidencias observables antes de definir niveles.",
      html: `<section><h2 id="criterios">Criterios</h2><p>Usa criterios que describan aspectos distintos del desempeño y puedan observarse en el trabajo.</p></section><section><h2 id="niveles">Niveles</h2><p>Evita cambiar sólo adjetivos. Describe diferencias concretas entre un nivel y otro.</p></section>`
    },
    "revisar-exportar": {
      eyebrow: "Trabajar con pteron",
      title: "Revisar y guardar",
      lead: "El material es un borrador hasta que tú decides utilizarlo.",
      html: `<section><h2 id="lista">Lista de revisión</h2><ul><li>Las fuentes respaldan el contenido.</li><li>El lenguaje corresponde al curso.</li><li>Las instrucciones pueden ejecutarse con el tiempo y recursos disponibles.</li><li>Los puntajes y criterios son coherentes.</li></ul></section><section><h2 id="guardar">Guardar una copia</h2><p>Usa la acción de guardado para crear un archivo nuevo. pteron no sobrescribe el documento original.</p></section>`
    },
    "trabajo-local": {
      eyebrow: "Privacidad y control",
      title: "Trabajo local",
      lead: "Tus documentos permanecen en el equipo salvo que habilites una capacidad externa para una acción concreta.",
      html: `<section><h2 id="limite">Límite de acceso</h2><p>pteron trabaja dentro de la carpeta que tú eliges. El renderer no tiene acceso directo al sistema.</p></section><section><h2 id="nube">Uso de nube</h2><p>Antes de enviar contenido a un servicio externo, pteron debe indicar qué capacidad se usará y pedir una configuración o autorización clara.</p></section>`
    },
    "datos-estudiantes": {
      eyebrow: "Privacidad y control",
      title: "Datos de estudiantes",
      lead: "Evita usar datos identificables cuando no sean indispensables.",
      html: `<section><h2 id="detecta">Qué detecta pteron</h2><p>Nombres, RUT, salud, NEE/PIE, calificaciones, disciplina y otros antecedentes identificables.</p></section><section><h2 id="advertencia">Antes de transmitir</h2><p>Si una acción externa incluye datos sensibles, pteron advierte y permite anonimizar, excluir o cancelar.</p></section>`
    },
    "modelos-permisos": {
      eyebrow: "Privacidad y control",
      title: "Modelos y permisos",
      lead: "Las capacidades externas son opcionales, acotadas y revocables.",
      html: `<section><h2 id="modelo-local">Modelo local</h2><p>Permite trabajar sin enviar documentos a un proveedor externo, según el modelo y la configuración disponibles.</p></section><section><h2 id="externos">Servicios externos</h2><p>Cada proveedor debe declarar los datos que usa, el permiso necesario y qué ocurre si no está disponible.</p></section>`
    },
    "preguntas": {
      eyebrow: "Ayuda",
      title: "Preguntas frecuentes",
      lead: "Respuestas breves sobre instalación, archivos y disponibilidad.",
      html: `<section><h2 id="internet">¿Necesito internet?</h2><p>No para trabajar con un modelo local. Sí para descargar actualizaciones o usar una capacidad externa.</p></section><section><h2 id="originales">¿pteron modifica mis originales?</h2><p>No. Los resultados se guardan como archivos nuevos mediante una acción visible.</p></section><section><h2 id="windows">¿Windows está soportado?</h2><p>Sí, durante la beta en Windows 11. El instalador todavía no está firmado y SmartScreen puede pedir confirmación.</p></section><section><h2 id="estable">¿Cuándo sale la versión estable?</h2><p>No hay una fecha comprometida. El canal estable se mantiene como próximamente.</p></section>`
    },
    "solucion-problemas": {
      eyebrow: "Ayuda",
      title: "Solución de problemas",
      lead: "Comprueba primero la versión, la carpeta y el estado del modelo.",
      html: `<section><h2 id="no-abre">pteron no abre</h2><p>Reinicia el equipo, verifica que uses una plataforma compatible y vuelve a descargar el instalador desde el sitio oficial.</p></section><section><h2 id="modelo">El modelo no responde</h2><p>Comprueba que el servicio local esté iniciado o que la capacidad externa tenga conexión y autorización.</p></section><section><h2 id="archivos">No aparece un archivo</h2><p>Confirma que esté dentro de la carpeta de trabajo actual y en un formato compatible.</p></section><section><h2 id="contacto">Aún necesito ayuda</h2><p>Escribe a <a href="mailto:pteron@patagua.dev">pteron@patagua.dev</a> e incluye tu sistema operativo, versión de pteron y una descripción breve. No adjuntes datos sensibles de estudiantes.</p></section>`
    },
    "versiones": {
      eyebrow: "Ayuda",
      title: "Versiones y plataformas",
      lead: "pteron se distribuye sólo en beta. El canal estable llegará más adelante.",
      html: `
        <section><h2 id="actual">Versión actual</h2><div class="release-table" data-release-table><p>Cargando información de la versión…</p></div></section>
        <section><h2 id="plataformas">Estado por plataforma</h2><table><thead><tr><th>Plataforma</th><th>Estado</th><th>Firma</th></tr></thead><tbody><tr><td>macOS M series</td><td>Beta soportada</td><td>Firmada y notarizada</td></tr><tr><td>Windows 11</td><td>Beta soportada</td><td>Sin firma; puede mostrar avisos</td></tr></tbody></table></section>
        <section><h2 id="notas">Notas de versión</h2><div data-release-notes><p>Las notas se publicarán con cada versión disponible.</p></div></section>`
    }
  }
};
