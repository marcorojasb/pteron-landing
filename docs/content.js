window.PTERON_DOCS = {
  aliases: {
    "crear-guia": "crear",
    "rubricas": "evaluar"
  },
  groups: [
    {
      label: "Empezar",
      pages: [
        ["inicio", "Qué es pteron"],
        ["requisitos", "Requisitos"],
        ["instalar-macos", "Instalar en macOS"],
        ["instalar-windows", "Instalar en Windows"],
        ["instalar-linux", "Instalar en Linux"],
        ["primera-apertura", "Primera apertura"],
        ["actualizar", "Actualizar pteron"]
      ]
    },
    {
      label: "Conocer la aplicación",
      pages: [
        ["pantalla-inicio", "La pantalla de inicio"],
        ["sesiones-memoria", "Sesiones y memoria"],
        ["carpeta-trabajo", "Carpeta de trabajo"],
        ["fuentes-contexto", "Fuentes y contexto"],
        ["biblioteca", "Abrir un recurso"]
      ]
    },
    {
      label: "Trabajar con pteron",
      pages: [
        ["planificar", "Planificar"],
        ["crear", "Crear"],
        ["evaluar", "Evaluar"],
        ["adaptar", "Adaptar"],
        ["revisar-exportar", "Revisar y guardar"]
      ]
    },
    {
      label: "Materiales y formatos",
      pages: [
        ["artefactos", "Documentos"],
        ["presentaciones", "Presentaciones"],
        ["exportar", "Exportar y compartir"]
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
      lead: "pteron es un espacio de trabajo que corre en tu computador. Prepara guías, planificaciones, evaluaciones y presentaciones a partir de tus propias fuentes, y te las entrega como un documento editable que decides si conservar.",
      html: `
        <section>
          <h2 id="por-donde-empezar">Por dónde empezar</h2>
          <div class="path-list">
            <a href="/descargar/"><span>01</span><strong>Instala pteron</strong><small>Beta para macOS con Apple Silicon, Windows 11 y Linux x86_64.</small></a>
            <a href="/docs/?pagina=primera-apertura"><span>02</span><strong>Elige carpeta y modelo</strong><small>Dos decisiones en el primer inicio; ambas se cambian después.</small></a>
            <a href="/docs/?pagina=pantalla-inicio"><span>03</span><strong>Reconoce la pantalla</strong><small>Cuatro rumbos, selectores de contexto y un compositor.</small></a>
            <a href="/docs/?pagina=crear"><span>04</span><strong>Crea tu primer material</strong><small>Del pedido al plan, y del plan a un documento editable.</small></a>
          </div>
        </section>
        <section>
          <h2 id="como-se-ve">Cómo se ve</h2>
          <p>Al abrir pteron encuentras la pantalla de inicio: la barra de sesiones arriba, los cuatro rumbos al centro y el compositor abajo. No hay que configurar nada más para escribir el primer pedido.</p>
          <figure class="product-shot"><img src="/assets/docs/app-inicio.webp" width="1760" height="1076" loading="lazy" alt="Pantalla de inicio de pteron con los rumbos Planificar, Crear, Evaluar y Adaptar sobre el compositor"><figcaption>La pantalla de inicio. Cada rumbo es un verbo con una salida propia.</figcaption></figure>
        </section>
        <section>
          <h2 id="que-hace">Qué hace y qué no</h2>
          <p>pteron propone un borrador; la decisión de usarlo es tuya. El material queda en un lienzo editable con su historial de revisiones, y no se guarda ningún archivo hasta que ejecutas una acción de guardado.</p>
          <ul>
            <li>Trabaja dentro de una carpeta que tú eliges y no sobrescribe tus originales.</li>
            <li>Puede correr con un modelo local, sin enviar tus documentos a un proveedor externo.</li>
            <li>No tiene terminal ni herramientas generales de programación.</li>
            <li>No abre ni convierte archivos PPTX externos.</li>
          </ul>
        </section>`
    },
    "requisitos": {
      eyebrow: "Empezar",
      title: "Requisitos",
      lead: "Una carpeta de trabajo y un equipo compatible son suficientes para comenzar.",
      html: `
        <section><h2 id="macos">macOS</h2><ul><li>Procesador Apple serie M.</li><li>Una versión reciente y compatible de macOS.</li><li>Espacio disponible para la aplicación, tus documentos y el modelo local que elijas.</li></ul></section>
        <section><h2 id="windows">Windows 11</h2><ul><li>Windows 11 en un equipo de 64 bits.</li><li>Permiso para instalar aplicaciones descargadas desde la web.</li><li>Espacio disponible para documentos y modelos locales.</li></ul><div class="notice"><strong>Beta sin firma digital</strong><p>El instalador de Windows todavía no está firmado. SmartScreen puede mostrar una advertencia y pedir confirmación antes de continuar.</p></div></section>
        <section><h2 id="linux">Linux</h2><ul><li>Sistema x86_64.</li><li>Permiso para instalar un paquete o ejecutar una AppImage.</li><li>Espacio disponible para la aplicación, tus documentos y el modelo local que elijas.</li></ul><div class="notice"><strong>Artefactos firmados</strong><p>Los archivos para Linux incluyen una firma GPG separada que puedes verificar con la clave pública de pteron.</p></div></section>
        <section><h2 id="modelo">Modelo</h2><p>pteron viene preparado para usar un modelo local con Ollama. También puedes conectar un proveedor externo pegando tu propia clave. Ninguna de las dos opciones es obligatoria para instalar: la eliges en el primer inicio y puedes cambiarla después en <strong>Ajustes → Modelo</strong>.</p></section>
        <section><h2 id="conexion">Conexión</h2><p>El trabajo con tus archivos es local. Descargar actualizaciones y usar un proveedor en la nube necesitan conexión, y pteron lo indica antes de usarlos.</p></section>`
    },
    "instalar-macos": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en macOS",
      lead: "La beta para macOS está disponible en equipos con procesadores Apple serie M.",
      html: `
        <section><h2 id="descargar">1. Descarga pteron</h2><p>Abre la <a href="/descargar/">página de descargas</a> y elige la versión para macOS. El archivo es un <code>.dmg</code> firmado y notarizado.</p></section>
        <section><h2 id="instalar">2. Instala la aplicación</h2><ol class="install-steps"><li>Abre el archivo <code>.dmg</code>.</li><li>Arrastra pteron a la carpeta Aplicaciones.</li><li>Abre pteron desde Aplicaciones.</li></ol></section>
        <section><h2 id="primer-inicio">3. Completa el primer inicio</h2><p>macOS puede verificar la aplicación antes de abrirla por primera vez. Después, pteron te pedirá elegir o confirmar tu carpeta de trabajo. Continúa en <a href="/docs/?pagina=primera-apertura">Primera apertura</a>.</p></section>`
    },
    "instalar-windows": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en Windows",
      lead: "pteron está disponible para Windows 11 mientras continúa en beta.",
      html: `
        <div class="notice notice-prominent"><strong>Windows puede mostrar una advertencia</strong><p>El instalador de la beta todavía no tiene firma digital. Microsoft Defender SmartScreen puede pedirte confirmar la instalación. Esta limitación se mantendrá visible mientras pteron siga en beta.</p></div>
        <section><h2 id="pasos">Pasos de instalación</h2><ol class="install-steps"><li>Descarga el instalador desde la <a href="/descargar/">página de descargas</a>.</li><li>Abre el archivo <code>.exe</code>.</li><li>Si aparece SmartScreen, selecciona <strong>Más información</strong> y después <strong>Ejecutar de todas formas</strong>.</li><li>Completa los pasos del instalador.</li><li>Abre pteron desde el menú Inicio.</li></ol></section>
        <section><h2 id="verificar">Antes de continuar</h2><p>Comprueba que el archivo provenga del enlace oficial de pteron. Si tu organización administra el equipo, puede ser necesaria la autorización del área responsable.</p></section>
        <section><h2 id="actualizaciones">Si una actualización no se aplica</h2><p>En Windows, la firma no se valida antes de instalar y el instalador silencioso puede quedar bloqueado. Cuando eso ocurre, pteron abre el instalador a la vista y, al volver a abrirse, compara la versión real con la que intentó instalar y te avisa si no cambió.</p></section>`
    },
    "instalar-linux": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en Linux",
      lead: "La beta para Linux está disponible en equipos x86_64. AppImage es la descarga principal y también hay paquetes .deb, .rpm y .tar.gz.",
      html: `
        <section><h2 id="elegir">1. Elige un formato</h2><p>Abre la <a href="/descargar/">página de descargas</a>. Elige <strong>AppImage</strong> para usar el formato principal, <code>.deb</code> o <code>.rpm</code> para instalar un paquete, o <code>.tar.gz</code> para una instalación manual.</p></section>
        <section><h2 id="appimage">2. Abre la AppImage</h2><ol class="install-steps"><li>Marca el archivo como ejecutable desde las propiedades del archivo o con <code>chmod +x pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Abre <code>pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Completa el primer inicio y elige tu carpeta de trabajo.</li></ol></section>
        <section><h2 id="paquetes">Instalar otro formato</h2><p>Abre el archivo <code>.deb</code> o <code>.rpm</code> con el instalador de paquetes de tu sistema. El archivo <code>.tar.gz</code> se extrae manualmente y no registra un paquete en el sistema.</p></section>
        <section><h2 id="actualizaciones">Actualizaciones</h2><p>La AppImage puede descargar y aplicar actualizaciones desde pteron con tu confirmación. Las instalaciones <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso de una versión nueva y abren la descarga para que la reemplaces manualmente.</p></section>
        <section><h2 id="firma">Verificar la firma GPG</h2><p>Descarga la firma <code>.asc</code> que acompaña a tu archivo y la <a href="/descargar/pteron-releases-public.asc" download>clave pública de releases</a>. Su huella es:</p><pre><code>5DDC 795B EFB7 EC2F EC93 0227 EAFB 54AE A175 0DCF</code></pre><p>Muestra la huella, importa la clave y verifica, por ejemplo, la AppImage:</p><pre><code>gpg --show-keys --fingerprint pteron-releases-public.asc
gpg --import pteron-releases-public.asc
gpg --verify pteron-&lt;versión&gt;-x86_64.AppImage.asc pteron-&lt;versión&gt;-x86_64.AppImage</code></pre><p>Comprueba que GPG muestre exactamente la huella publicada antes de confiar en el archivo.</p></section>`
    },
    "primera-apertura": {
      eyebrow: "Empezar",
      title: "Primera apertura",
      lead: "Dos decisiones y estás trabajando: dónde vive tu material y quién lo prepara.",
      html: `
        <section>
          <h2 id="carpeta">1. Confirma la carpeta de trabajo</h2>
          <p>pteron propone una carpeta dentro de Documentos y puedes elegir otra. Todo lo que lea, indexe o cree ocurre dentro de ese límite, y no se sobrescribe ningún original. Puedes cambiarla después en <strong>Ajustes → Fuentes y materiales</strong>.</p>
        </section>
        <section>
          <h2 id="modelo">2. Elige quién prepara el material</h2>
          <p>Abre <strong>Ajustes → Modelo</strong>. La primera tarjeta es <strong>En este equipo</strong>, que usa Ollama y no envía tus documentos a ningún servidor. El resto de proveedores aparece con la etiqueta <strong>Requiere clave</strong>: al abrir uno, pegas tu clave y pteron muestra los modelos que esa clave habilita, con su contexto, salida y tarifa.</p>
          <p>Si no configuras nada, pteron queda en el plan libre con el modelo local. Los cambios no se aplican hasta pulsar <strong>Guardar cambios</strong>.</p>
        </section>
        <section>
          <h2 id="primera-sesion">3. Escribe tu primer pedido</h2>
          <p>Vuelve a la pantalla de inicio, elige un rumbo y describe lo que necesitas. Antes de crear nada, pteron te devolverá un plan que puedes ajustar. Continúa en <a href="/docs/?pagina=pantalla-inicio">La pantalla de inicio</a>.</p>
        </section>`
    },
    "actualizar": {
      eyebrow: "Empezar",
      title: "Actualizar pteron",
      lead: "La aplicación avisa cuando hay una nueva versión de tu canal.",
      html: `
        <section><h2 id="canal-beta">Canal beta</h2><p>La beta pública es gratuita. Durante esta etapa recibirás versiones de prueba con correcciones y cambios frecuentes. El canal estable figura como próximamente.</p></section>
        <section><h2 id="instalacion">Cómo se aplica</h2><p>En macOS, Windows y AppImage para Linux, pteron descarga la actualización y pide tu consentimiento antes de instalarla al reiniciar. Las instalaciones Linux <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso y abren la descarga para una actualización manual.</p><p>La actualización automática se puede desactivar, y el canal se elige entre beta y estable.</p></section>
        <section><h2 id="windows">Windows sin firma</h2><div class="notice"><strong>Limitación conocida</strong><p>En macOS la firma se valida antes de instalar. En Windows todavía no, y la aplicación lo declara. El estado de firma se informa por plataforma.</p></div></section>`
    },
    "pantalla-inicio": {
      eyebrow: "Conocer la aplicación",
      title: "La pantalla de inicio",
      lead: "Una sola pantalla de partida: cuatro rumbos, los selectores de contexto y el compositor.",
      html: `
        <section>
          <h2 id="rumbos">Los cuatro rumbos</h2>
          <p>Cada rumbo es un verbo con una salida propia. Elegir uno no fija un modo ni te obliga a un curso, un plan o un tipo de material: sólo orienta el pedido y es efímero, válido para ese turno.</p>
          <table>
            <thead><tr><th>Rumbo</th><th>Para qué</th></tr></thead>
            <tbody>
              <tr><td><strong>Planificar</strong></td><td>Organiza clases y unidades.</td></tr>
              <tr><td><strong>Crear</strong></td><td>Produce material listo para usar.</td></tr>
              <tr><td><strong>Evaluar</strong></td><td>Comprueba y analiza aprendizajes.</td></tr>
              <tr><td><strong>Adaptar</strong></td><td>Ajusta material a tu curso.</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h2 id="contexto">Los selectores de contexto</h2>
          <p>Al elegir un rumbo aparecen cuatro selectores sobre el compositor: <strong>curso</strong>, <strong>asignatura</strong>, <strong>OA</strong> y <strong>Materiales</strong>. Lo que eliges se convierte en chips dentro del compositor, y <strong>Limpiar</strong> los retira todos. El compositor también cambia su texto para recordarte qué estás pidiendo.</p>
          <figure class="product-shot"><img src="/assets/docs/app-rumbo.webp" width="1760" height="1076" loading="lazy" alt="Rumbo Crear seleccionado, con los selectores de curso, asignatura, OA y Materiales y los chips 6° básico y Matemática en el compositor"><figcaption>Con el rumbo Crear elegido, los chips muestran exactamente qué contexto viaja con el pedido.</figcaption></figure>
        </section>
        <section>
          <h2 id="compositor">El compositor</h2>
          <p>Escribe con tus palabras lo que necesitas. El botón <strong>+</strong> adjunta material y las menciones <code>@</code> traen un documento de tu carpeta. Bajo el compositor puede aparecer una sugerencia tomada de tu contexto reciente, marcada como <em>por tu memoria</em> o <em>por tu contexto</em>: es un atajo, no una orden.</p>
        </section>
        <section>
          <h2 id="barra">La barra superior</h2>
          <p>Arriba viven las sesiones abiertas, el botón <strong>+</strong> para abrir una nueva y el reloj que despliega el historial. A la derecha está tu perfil.</p>
        </section>`
    },
    "sesiones-memoria": {
      eyebrow: "Conocer la aplicación",
      title: "Sesiones y memoria",
      lead: "Una sesión reúne una conversación, sus fuentes y el material que produjo. La memoria es lo que pteron conserva entre sesiones.",
      html: `
        <section>
          <h2 id="sesiones">Sesiones y pestañas</h2>
          <p>Cada trabajo abre su propia pestaña en la barra superior, con un nombre tomado de lo que estás haciendo. Puedes tener varias abiertas y moverte entre ellas sin perder el estado de ninguna: cada una conserva su conversación, su contexto y su material.</p>
          <figure class="product-shot"><img src="/assets/docs/app-sesiones.webp" width="1760" height="1076" loading="lazy" alt="Barra superior de pteron con varias pestañas de sesión abiertas y el botón de historial"><figcaption>Las sesiones abiertas, el botón + para una nueva y el reloj del historial.</figcaption></figure>
          <p>Abre una sesión nueva cuando cambie el objetivo. Cerrar una sesión la archiva y puedes recuperarla desde el historial; eliminarla es una acción distinta y explícita.</p>
          <div class="notice"><strong>Continuidad de 30 minutos</strong><p>Si vuelves a la aplicación dentro de los 30 minutos siguientes, pteron retoma donde estabas. Pasado ese plazo, empieza una sesión nueva.</p></div>
        </section>
        <section>
          <h2 id="memoria">Memoria y contexto</h2>
          <p>La memoria guarda preferencias que tú aceptas conservar —cómo te gusta que se redacten las instrucciones, qué formato usas, qué cursos atiendes— para no repetirlas en cada pedido. Cuando una sugerencia proviene de ahí, aparece rotulada <em>por tu memoria</em>.</p>
          <figure class="product-shot"><img src="/assets/docs/app-memoria.webp" width="1760" height="1076" loading="lazy" alt="Panel de memoria y contexto de pteron con las preferencias guardadas"><figcaption>Ajustes → Memoria y contexto: lo que pteron recuerda, a la vista y retirable.</figcaption></figure>
          <p>Todo lo guardado se revisa y se retira desde <strong>Ajustes → Memoria y contexto</strong>. La memoria no incluye tus materiales ni el contenido de tus sesiones.</p>
        </section>`
    },
    "carpeta-trabajo": {
      eyebrow: "Conocer la aplicación",
      title: "Carpeta de trabajo",
      lead: "Es el límite visible dentro del cual pteron puede leer y crear archivos.",
      html: `
        <section><h2 id="por-que">Por qué existe</h2><p>pteron no tiene acceso general a tu equipo. Al instalar propone una carpeta dentro de Documentos, tú puedes elegir otra, y todo lo que indexe, busque o lea ocurre dentro de ella. Se cambia desde <strong>Ajustes → Fuentes y materiales</strong>.</p></section>
        <section><h2 id="originales">Tus originales</h2><p>La aplicación no sobrescribe los archivos de origen. Cada resultado se guarda como una copia nueva mediante una acción visible que tú ejecutas: no hay guardado automático sobre tus documentos.</p></section>
        <section><h2 id="indice">Búsqueda dentro de la carpeta</h2><p>pteron mantiene un índice local del contenido para poder encontrar y citar tus materiales. Ese índice vive en tu equipo junto con las sesiones, y cada ejecución tiene un presupuesto de lectura acotado.</p></section>
        <section><h2 id="organizar">Cómo organizarla</h2><p>Una estructura simple por curso, unidad o proyecto facilita encontrar fuentes y resultados. No necesitas adoptar una plantilla rígida.</p></section>`
    },
    "fuentes-contexto": {
      eyebrow: "Conocer la aplicación",
      title: "Fuentes y contexto",
      lead: "Las fuentes sostienen el material; el contexto explica qué necesitas hacer con ellas.",
      html: `
        <section>
          <h2 id="fuentes">Cómo se agregan fuentes</h2>
          <ul>
            <li>El botón <strong>+</strong> del compositor adjunta un documento.</li>
            <li>Una mención <code>@</code> trae un archivo de tu carpeta de trabajo por su nombre.</li>
            <li>El selector <strong>Materiales</strong> incorpora material del espacio docente.</li>
            <li>Un documento abierto junto al material puede adjuntarse con <strong>Usar como referencia</strong>.</li>
          </ul>
          <p>pteron distingue las fuentes locales de las externas y las deja inspeccionables junto al resultado, para que puedas comprobar de dónde salió cada cosa. El contenido recuperado desde la web se trata como dato no confiable.</p>
        </section>
        <section>
          <h2 id="acciones">Qué puedes hacer con una respuesta</h2>
          <p>Una respuesta en la conversación no es un callejón sin salida: puedes guardarla, convertirla en material o copiarla.</p>
          <figure class="product-shot"><img src="/assets/docs/app-conversacion.webp" width="1760" height="1076" loading="lazy" alt="Conversación en pteron con las acciones Guardar esta respuesta, Crear un material con esto y Copiar"><figcaption>Las acciones al pie de cada respuesta: guardar, convertir en material o copiar.</figcaption></figure>
        </section>
        <section>
          <h2 id="contexto">Qué conviene incluir</h2>
          <p>Curso, objetivo, duración, formato esperado y cualquier condición que cambie el resultado. Los selectores cubren curso, asignatura y OA; el resto va en tus palabras.</p>
          <blockquote>“Crea una guía de 45 minutos para 7° básico. Usa el documento adjunto como única fuente y deja una sección final de reflexión.”</blockquote>
        </section>`
    },
    "biblioteca": {
      eyebrow: "Conocer la aplicación",
      title: "Abrir un recurso",
      lead: "Todo lo que pteron ha creado y todo lo que hay en tu carpeta se abre desde un mismo lugar.",
      html: `
        <section>
          <h2 id="abrir">El selector de recursos</h2>
          <p>Busca por nombre o filtra por tipo: <strong>Guías</strong>, <strong>Evaluaciones</strong>, <strong>Planificaciones</strong>, <strong>Rúbricas</strong> y <strong>Materiales</strong>. Cada elemento indica su origen —<em>Guía de pteron</em> o <em>Material de tu carpeta</em>— y su fecha.</p>
          <figure class="product-shot"><img src="/assets/docs/app-biblioteca.webp" width="1760" height="1076" loading="lazy" alt="Diálogo Abrir recurso con búsqueda, filtros por tipo y la vista previa del recurso seleccionado"><figcaption>Abrir recurso: tu material creado y los documentos de tu carpeta, en una sola lista.</figcaption></figure>
        </section>
        <section>
          <h2 id="volver">Volver a un material</h2>
          <p>Al abrir algo creado por pteron vuelves a su conversación, con su historial de revisiones intacto, para seguir revisándolo o guardarlo. Un material de tu carpeta se abre para leerlo y usarlo como referencia.</p>
        </section>
        <section>
          <h2 id="dispositivo">Traer un archivo de fuera</h2>
          <p><strong>Abrir desde mi dispositivo…</strong> incorpora un documento que no está en la carpeta de trabajo. Se copia a tu espacio; el original no se mueve ni se modifica.</p>
        </section>`
    },
    "planificar": {
      eyebrow: "Trabajar con pteron",
      title: "Planificar",
      lead: "El rumbo para organizar clases y unidades, con momentos y duración que cuadren.",
      html: `
        <section>
          <h2 id="pedido">Qué entregar en el pedido</h2>
          <p>Elige el rumbo <strong>Planificar</strong> y fija curso, asignatura y OA en los selectores. En el compositor añade lo que ellos no cubren: duración total, recursos disponibles, número de clases y cómo quieres cerrar.</p>
          <blockquote>“Planifica una unidad de cuatro clases de 45 minutos sobre fracciones equivalentes. El curso tiene proyector pero no tablets. Cierra cada clase con una salida escrita breve.”</blockquote>
        </section>
        <section>
          <h2 id="verificacion">Lo que pteron comprueba solo</h2>
          <p>Antes de entregarte una planificación, pteron rechaza aquello que puede verificar sin interpretar tu criterio: una planificación cuyos momentos no suman la duración declarada no se entrega. Y advierte, sin bloquear, cuando faltan momentos o duración.</p>
        </section>
        <section>
          <h2 id="revisar">Qué revisar tú</h2>
          <p>Lo que ninguna comprobación automática puede juzgar: si la progresión tiene sentido para tu curso, si los tiempos son realistas y si las oportunidades de participación son reales y no decorativas.</p>
        </section>`
    },
    "crear": {
      eyebrow: "Trabajar con pteron",
      title: "Crear",
      lead: "El rumbo para producir material listo para usar. Entre el pedido y el material hay un plan que puedes cambiar.",
      html: `
        <section>
          <h2 id="pedido">1. Haz el pedido</h2>
          <p>Elige el rumbo <strong>Crear</strong>, fija el contexto en los selectores y describe el material. Si tienes una guía anterior con el formato que usas, adjúntala: pteron toma de ahí el encabezado y la forma de los ítems en vez de inventar una tercera.</p>
        </section>
        <section>
          <h2 id="plan">2. Revisa el plan</h2>
          <p>Cuando el pedido lo amerita, pteron responde primero con un <strong>plan de trabajo</strong> en vez de un borrador. El plan declara qué va a producir, qué decidió por su cuenta y qué preguntas te hizo.</p>
          <figure class="product-shot"><img src="/assets/docs/app-plan.webp" width="1760" height="1076" loading="lazy" alt="Tarjeta de plan de trabajo con resultado previsto, decisiones confirmadas, cómo lo abordaré y supuestos que puedes cambiar"><figcaption>El plan separa lo confirmado de los supuestos, y nombra los que puedes cambiar.</figcaption></figure>
          <p>Fíjate en <strong>Supuestos que puedes cambiar</strong>: ahí está lo que pteron decidió sin preguntarte. Corrígelo con <strong>Pedir un ajuste</strong> antes de seguir; sale más barato que rehacer el material. Cuando estés conforme, pulsa <strong>Crear la guía</strong>.</p>
          <div class="notice"><strong>El plan no es un peaje</strong><p>Aparece sólo cuando aporta al pedido. Si pides algo directo, pteron va directo al material.</p></div>
        </section>
        <section>
          <h2 id="material">3. Recibe el material</h2>
          <p>El resultado se abre como documento editable, no como texto dentro del chat. Sigue en <a href="/docs/?pagina=artefactos">Documentos</a> y en <a href="/docs/?pagina=revisar-exportar">Revisar y guardar</a>.</p>
        </section>`
    },
    "evaluar": {
      eyebrow: "Trabajar con pteron",
      title: "Evaluar",
      lead: "El rumbo para comprobar y analizar aprendizajes: evaluaciones, pautas y rúbricas.",
      html: `
        <section>
          <h2 id="pedido">Delimita el alcance</h2>
          <p>Adjunta las fuentes que deben cubrirse e indica nivel, duración y puntaje total. Si el material es una rúbrica, describe la tarea y las evidencias observables antes de pedir niveles.</p>
        </section>
        <section>
          <h2 id="rechaza">Lo que pteron no te entrega</h2>
          <p>Hay defectos de forma que pteron rechaza y corrige antes de mostrarte nada, porque se comprueban sin interpretar tu criterio:</p>
          <ul>
            <li>Alternativas escritas como texto corrido en vez del campo estructurado, incluida la batería A) B) C) D) sin viñeta.</li>
            <li>Más de una alternativa correcta.</li>
            <li>Un puntaje total que no cuadra con la suma de las preguntas.</li>
            <li>Una tabla o una rúbrica sin criterios utilizables.</li>
            <li>Dos preguntas empaquetadas en un mismo bloque.</li>
          </ul>
        </section>
        <section>
          <h2 id="sugerencias">Lo que te advierte sin bloquear</h2>
          <p>El resto llega como <strong>Sugerencias</strong> en el panel derecho, con el bloque afectado y el motivo. Cada una trae un botón <strong>Proponer</strong>: nada se aplica hasta que tú lo pides.</p>
          <figure class="product-shot"><img src="/assets/docs/app-revision.webp" width="1760" height="1076" loading="lazy" alt="Panel de sugerencias señalando que una pregunta no tiene puntaje y que no deja espacio para responder"><figcaption>Las sugerencias explican por qué importan: sin espacio para responder, la hoja no se puede usar.</figcaption></figure>
        </section>
        <section>
          <h2 id="datos">No uses datos reales</h2>
          <p>No incluyas nombres ni RUT de estudiantes para producir ejemplos. Ver <a href="/docs/?pagina=datos-estudiantes">Datos de estudiantes</a>.</p>
        </section>`
    },
    "adaptar": {
      eyebrow: "Trabajar con pteron",
      title: "Adaptar",
      lead: "El rumbo para ajustar a tu curso un material que ya existe.",
      html: `
        <section>
          <h2 id="partir">Parte de un documento</h2>
          <p>Trae el material con una mención <code>@</code>, desde <a href="/docs/?pagina=biblioteca">Abrir recurso</a> o adjuntándolo con el botón <strong>+</strong>. Después indica qué debe cambiar: el nivel, la extensión, el formato, el vocabulario o el tipo de actividad.</p>
          <blockquote>“Adapta esta guía de 8° para un 6° básico. Mantén los mismos contenidos, reduce a cuatro preguntas y agrega un ejemplo resuelto antes de la primera.”</blockquote>
        </section>
        <section>
          <h2 id="referencia">Trabajar con el original a la vista</h2>
          <p>Un documento de tu espacio se abre junto al material, con su propio paginador y zoom. Su texto es seleccionable, puedes citar una página o un fragmento, y <strong>Usar como referencia</strong> lo adjunta al contexto como un chip visible que puedes retirar.</p>
          <figure class="product-shot"><img src="/assets/docs/app-referencia.webp" width="1760" height="1076" loading="lazy" alt="Vista doble con el material a la izquierda y un PDF de referencia abierto a la derecha"><figcaption>El material y su referencia, uno junto al otro. Adjuntar no envía nada: el pedido lo escribes tú.</figcaption></figure>
          <div class="notice"><strong>Una referencia a la vez</strong><p>Bajo 1100 px de ancho, el material y la referencia se alternan en vez de mostrarse juntos.</p></div>
        </section>`
    },
    "revisar-exportar": {
      eyebrow: "Trabajar con pteron",
      title: "Revisar y guardar",
      lead: "El material es un borrador hasta que tú decides usarlo. Ninguna propuesta se aplica sola.",
      html: `
        <section>
          <h2 id="propuesta">Cómo llega una propuesta</h2>
          <p>Cuando pides un cambio, pteron no reescribe el documento: prepara una propuesta y te la muestra. El estado pasa a <strong>Sólo lectura</strong>, la cabecera indica cuántos cambios propone y el conmutador <strong>Documento / Comparar</strong> te deja ver el resultado o las diferencias por bloque.</p>
          <figure class="product-shot"><img src="/assets/docs/app-artefacto.webp" width="1760" height="1076" loading="lazy" alt="Guía abierta en el lienzo editable de pteron con el panel de revisiones a la derecha"><figcaption>El material abierto, editable, con su historial de revisiones a la derecha.</figcaption></figure>
          <p>El muelle inferior lo dice sin rodeos —<em>Propongo estos cambios. Aún no se aplican.</em>— y ofrece <strong>Conservar cambios</strong> o <strong>Descartar propuesta</strong>. Si cancelas a medias, no se publica una revisión incompleta.</p>
        </section>
        <section>
          <h2 id="lista">Qué revisar antes de guardar</h2>
          <ul>
            <li>Las fuentes respaldan el contenido y puedes abrirlas desde el panel.</li>
            <li>El lenguaje corresponde al curso.</li>
            <li>Las instrucciones pueden ejecutarse con el tiempo y los recursos disponibles.</li>
            <li>Los puntajes y criterios son coherentes con lo que declara el encabezado.</li>
          </ul>
        </section>
        <section>
          <h2 id="guardar">Guardar una copia</h2>
          <p>La acción principal del muelle guarda un archivo nuevo. pteron no sobrescribe el original ni guarda solo. Ver <a href="/docs/?pagina=exportar">Exportar y compartir</a>.</p>
        </section>`
    },
    "artefactos": {
      eyebrow: "Materiales y formatos",
      title: "Documentos",
      lead: "El resultado no queda encerrado en la conversación: es un documento con formato, historial y controles propios.",
      html: `
        <section>
          <h2 id="cabecera">La cabecera del documento</h2>
          <p>Indica el tipo, el estado y la revisión —por ejemplo <em>Guía de aprendizaje · Listo · rev. 1</em>—, y ofrece <strong>Vista previa</strong> y <strong>Opciones</strong>. Debajo, una franja declara si el documento está <strong>Editable</strong> o en <strong>Sólo lectura</strong>.</p>
        </section>
        <section>
          <h2 id="formatos">Tamaños y orientación</h2>
          <p>Los documentos admiten A4, Carta y Oficio, con márgenes y saltos de página que se respetan al exportar. Puedes trabajar en vertical o apaisado, y la barra de edición permanece visible mientras recorres el material.</p>
          <figure class="product-shot"><img src="/assets/docs/app-apaisado.webp" width="1760" height="1076" loading="lazy" alt="Guía en orientación apaisada dentro del lienzo de pteron"><figcaption>Una guía apaisada. La orientación es parte del documento, no un ajuste de impresión.</figcaption></figure>
        </section>
        <section>
          <h2 id="matematicas">Matemáticas y tablas</h2>
          <p>Las expresiones matemáticas viajan como fórmula, no como texto con barras: se maquetan en pantalla —también dentro de una celda de tabla, que muestra su fuente al enfocarla— y salen al DOCX como ecuación real.</p>
          <p>Un bloque puede mezclar prosa y una tabla escrita en markdown, y ambas se exportan en el orden en que fueron escritas.</p>
        </section>
        <section>
          <h2 id="historial">Revisiones</h2>
          <p>El panel <strong>Asistente pteron</strong> lista cada revisión con su hora y su recuento de bloques, y muestra cuántos se añadieron, cambiaron o quitaron. <strong>Formato base</strong> guarda el formato del que parte el documento.</p>
        </section>`
    },
    "presentaciones": {
      eyebrow: "Materiales y formatos",
      title: "Presentaciones",
      lead: "Presentaciones nativas 16:9 que exportan un PPTX editable.",
      html: `
        <section>
          <h2 id="editor">El editor de diapositivas</h2>
          <p>La columna izquierda lista las diapositivas y permite añadir, duplicar, mover y eliminar. La cabecera indica el master y el total —<em>Master 16:9 · 3 diapositivas</em>— y ofrece un selector de <strong>Tema</strong>.</p>
          <figure class="product-shot"><img src="/assets/docs/app-presentacion.webp" width="1760" height="1076" loading="lazy" alt="Editor de presentaciones de pteron con la lista de diapositivas, el lienzo y las notas del orador"><figcaption>El editor de presentaciones, con las notas del orador bajo el lienzo.</figcaption></figure>
        </section>
        <section>
          <h2 id="notas">Notas del orador</h2>
          <p>Cada diapositiva tiene su campo de notas, rotulado <em>Sólo para ti · no se proyecta</em>. Las notas viajan al PPTX exportado.</p>
        </section>
        <section>
          <h2 id="limite">Lo que no hace</h2>
          <div class="notice"><strong>No importa PPTX externos</strong><p>pteron crea y exporta presentaciones, pero no abre ni convierte archivos PPTX que vengan de fuera. Las plantillas complejas multi-zona también quedan fuera por ahora.</p></div>
        </section>`
    },
    "exportar": {
      eyebrow: "Materiales y formatos",
      title: "Exportar y compartir",
      lead: "Guardar produce siempre un archivo nuevo, mediante un diálogo que tú confirmas.",
      html: `
        <section>
          <h2 id="formatos">Qué formato entrega cada superficie</h2>
          <table>
            <thead><tr><th>Material</th><th>Acción</th><th>Resultado</th></tr></thead>
            <tbody>
              <tr><td>Documento</td><td>Guardar copia…</td><td>DOCX con márgenes y saltos de página</td></tr>
              <tr><td>Presentación</td><td>Guardar copia…</td><td>PPTX editable, con notas</td></tr>
              <tr><td>Documento</td><td>Compartir</td><td>PDF del material</td></tr>
            </tbody>
          </table>
          <p>El PDF contiene el material y nada más: sin la barra de la aplicación ni elementos de interfaz.</p>
        </section>
        <section>
          <h2 id="integridad">Si algo no se puede exportar</h2>
          <p>pteron prefiere rechazar una estructura que no soporta antes que entregar una copia incompleta. Si la exportación falla, lo dice y no deja un archivo a medias.</p>
        </section>
        <section>
          <h2 id="originales">Tus originales</h2>
          <p>Ninguna exportación sobrescribe el archivo de partida. El diálogo del sistema te deja elegir dónde guardar la copia nueva.</p>
        </section>`
    },
    "trabajo-local": {
      eyebrow: "Privacidad y control",
      title: "Trabajo local",
      lead: "Tus documentos permanecen en el equipo salvo que habilites una capacidad externa para una acción concreta.",
      html: `
        <section><h2 id="limite">Límite de acceso</h2><p>pteron trabaja dentro de la carpeta que tú eliges. No incluye terminal ni herramientas generales de programación, y la interfaz no tiene acceso directo al sistema: los privilegios pasan por un canal tipado con una lista acotada de capacidades docentes.</p></section>
        <section><h2 id="nube">Uso de nube</h2><p>Antes de enviar contenido a un servicio externo, pteron indica qué capacidad se usará y pide una configuración o autorización clara. Las fuentes web se limitan a HTTPS, y lo que se recupera de ellas se trata como dato no confiable.</p></section>
        <section><h2 id="iphone">Acceso desde el iPhone</h2><p>Existe un acceso complementario desde el iPhone y viene <strong>apagado de fábrica</strong>. El escritorio conserva sesiones, carpeta y materiales, y el teléfono se empareja contra él. El host escucha sólo dentro del propio computador, su clave se guarda como hash y puede rotarse o revocarse desde <strong>Ajustes → iPhone</strong>.</p></section>
        <section><h2 id="licencia">Licencia</h2><p>El núcleo local funciona sin licencia y seguirá siendo gratis. La licencia sólo habilita capacidad de IA incluida; se activa desde <strong>Ajustes → Licencia</strong> y se verifica en tu equipo, sin consultar a un servidor.</p></section>`
    },
    "datos-estudiantes": {
      eyebrow: "Privacidad y control",
      title: "Datos de estudiantes",
      lead: "pteron avisa antes de que un dato identificable salga de tu equipo, y te deja decidir cómo continuar.",
      html: `
        <section>
          <h2 id="detecta">Qué detecta exactamente</h2>
          <p>Antes de enviar algo a un proveedor que no sea local, pteron busca dos cosas concretas: un <strong>nombre declarado en un campo de persona</strong> y un <strong>RUT con formato chileno</strong>. Si encuentra alguno, detiene el envío y te muestra la elección.</p>
          <figure class="product-shot"><img src="/assets/docs/app-datos.webp" width="1760" height="1076" loading="lazy" alt="Aviso de datos identificables de estudiantes con las opciones Excluir fragmentos, Anonimizar y continuar, y Cancelar"><figcaption>El aviso llega antes del envío, dice qué detectó y ofrece una vista previa anonimizada.</figcaption></figure>
          <p>Tienes tres salidas: <strong>Excluir fragmentos</strong>, <strong>Anonimizar y continuar</strong> o <strong>Cancelar</strong>. La vista previa anonimizada te deja ver qué se enviaría antes de aceptar.</p>
        </section>
        <section>
          <h2 id="limite">Es una salvaguarda acotada</h2>
          <div class="notice notice-prominent"><strong>No es un clasificador de sensibilidad</strong><p>Salud, NEE/PIE, calificaciones o disciplina <em>no</em> disparan el aviso por sí solas. Son también temas del currículum, y bloquearlas interrumpía trabajo docente legítimo. El criterio sobre qué es prudente enviar sigue siendo tuyo.</p></div>
        </section>
        <section>
          <h2 id="practica">La regla práctica</h2>
          <p>Trabaja con datos identificables sólo cuando sean indispensables, y prefiere el modelo local para esos casos: si nada sale de tu equipo, no hay envío que revisar.</p>
        </section>`
    },
    "modelos-permisos": {
      eyebrow: "Privacidad y control",
      title: "Modelos y permisos",
      lead: "Eliges quién prepara tus materiales. Las capacidades externas son opcionales, acotadas y revocables.",
      html: `
        <section>
          <h2 id="ajustes">Dónde se configura</h2>
          <p>En <strong>Ajustes → Modelo</strong>. Cada proveedor es un panel plegable: al abrirlo pegas su clave y pteron muestra los modelos que esa clave habilita, con su ficha técnica —contexto, salida, tarifa y si razona—. Los modelos probados llevan su marca. Nada se aplica hasta pulsar <strong>Guardar cambios</strong>.</p>
          <figure class="product-shot"><img src="/assets/docs/app-modelo.webp" width="1760" height="1076" loading="lazy" alt="Ajustes de modelo en pteron con el proveedor En este equipo y varios proveedores externos que requieren clave"><figcaption>«En este equipo» usa un modelo local. El resto pide tu propia clave.</figcaption></figure>
        </section>
        <section>
          <h2 id="local">Modelo local</h2>
          <p>La opción <strong>En este equipo</strong> usa Ollama y permite trabajar sin enviar tus documentos a ningún proveedor. Es la base disponible y no necesita clave ni licencia.</p>
        </section>
        <section>
          <h2 id="claves">Tus claves</h2>
          <p>Las claves se guardan cifradas con el almacén seguro de tu sistema operativo, no en un archivo de configuración. Puedes retirarlas en cualquier momento.</p>
        </section>
        <section>
          <h2 id="autorizacion">Autorización por proveedor</h2>
          <div class="notice"><strong>Algunos proveedores piden permiso aparte</strong><p>Hay proveedores cuyo nivel más barato entrena con lo que se les envía. Activar el proveedor no los elige solo: pteron avisa en su propio nombre y pide autorización por ejecución.</p></div>
        </section>
        <section>
          <h2 id="privacidad">Dónde vive tu configuración</h2>
          <p>La pantalla de Ajustes lo declara al pie: tu configuración se guarda en este dispositivo.</p>
        </section>`
    },
    "preguntas": {
      eyebrow: "Ayuda",
      title: "Preguntas frecuentes",
      lead: "Respuestas breves sobre instalación, archivos y disponibilidad.",
      html: `
        <section><h2 id="internet">¿Necesito internet?</h2><p>No para trabajar con un modelo local. Sí para descargar actualizaciones o usar un proveedor en la nube.</p></section>
        <section><h2 id="originales">¿pteron modifica mis originales?</h2><p>No. Cada resultado se guarda como un archivo nuevo mediante una acción que tú ejecutas. Tampoco hay guardado automático.</p></section>
        <section><h2 id="gratis">¿Seguirá siendo gratis?</h2><p>El núcleo local es gratis para siempre y no depende de un plan. Los planes de pago añaden capacidad de IA incluida, no tu trabajo local. Ver <a href="/planes/">Planes y licencias</a>.</p></section>
        <section><h2 id="pptx">¿Puedo abrir mis PPTX?</h2><p>No. pteron crea y exporta presentaciones en PPTX, pero no importa ni convierte archivos PPTX externos.</p></section>
        <section><h2 id="windows">¿Windows está soportado?</h2><p>Sí, durante la beta en Windows 11. El instalador todavía no está firmado y SmartScreen puede pedir confirmación.</p></section>
        <section><h2 id="linux">¿Linux está disponible?</h2><p>Sí, como beta para equipos x86_64. AppImage es el formato principal y también se publican paquetes <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code>.</p></section>
        <section><h2 id="estable">¿Cuándo sale la versión estable?</h2><p>No hay una fecha comprometida. El canal estable se mantiene como próximamente.</p></section>`
    },
    "solucion-problemas": {
      eyebrow: "Ayuda",
      title: "Solución de problemas",
      lead: "Comprueba primero la versión, la carpeta y el estado del modelo.",
      html: `
        <section><h2 id="no-abre">pteron no abre</h2><p>Reinicia el equipo, verifica que uses una plataforma compatible y vuelve a descargar el instalador desde el sitio oficial.</p></section>
        <section><h2 id="modelo">El modelo no responde</h2><p>Abre <strong>Ajustes → Modelo</strong> y revisa el estado de la tarjeta. Si usas el modelo local, comprueba que Ollama esté iniciado; si usas un proveedor externo, que la clave siga siendo válida y haya conexión.</p></section>
        <section><h2 id="exportar">La exportación falla</h2><p>pteron prefiere avisar antes que entregarte una copia incompleta. El mensaje indica qué parte del material no pudo convertirse; suele tratarse de una estructura no soportada.</p><figure class="product-shot"><img src="/assets/docs/app-error-exportar.webp" width="1760" height="1076" loading="lazy" alt="Aviso de error de exportación en pteron sobre el material abierto"><figcaption>Un fallo de exportación se declara y no deja un archivo a medias.</figcaption></figure></section>
        <section><h2 id="archivos">No aparece un archivo</h2><p>Confirma que esté dentro de la carpeta de trabajo actual y en un formato compatible. Puedes revisar o cambiar la carpeta en <strong>Ajustes → Fuentes y materiales</strong>.</p></section>
        <section><h2 id="actualizacion">La actualización no se aplicó</h2><p>En Windows, si el instalador silencioso queda bloqueado, pteron lo abre a la vista. Al volver a abrirse compara la versión real con la intentada y avisa si no cambió.</p></section>
        <section><h2 id="contacto">Aún necesito ayuda</h2><p>Escribe a <a href="mailto:pteron@patagua.dev">pteron@patagua.dev</a> e incluye tu sistema operativo, versión de pteron y una descripción breve. No adjuntes datos identificables de estudiantes.</p></section>`
    },
    "versiones": {
      eyebrow: "Ayuda",
      title: "Versiones y plataformas",
      lead: "pteron se distribuye sólo en beta. El canal estable llegará más adelante.",
      html: `
        <section><h2 id="actual">Versión actual</h2><div class="release-table" data-release-table><p>Cargando información de la versión…</p></div></section>
        <section><h2 id="plataformas">Estado por plataforma</h2><table><thead><tr><th>Plataforma</th><th>Estado</th><th>Firma</th></tr></thead><tbody><tr><td>macOS Apple Silicon</td><td>Beta soportada</td><td>Firmada y notarizada</td></tr><tr><td>Windows 11</td><td>Beta soportada</td><td>Sin firma; puede mostrar avisos</td></tr><tr><td>Linux x86_64</td><td>Beta disponible</td><td>Firma GPG separada</td></tr></tbody></table></section>
        <section><h2 id="matriz">Por qué la web no siempre muestra la última</h2><p>Una versión pasa a ser la actual del sitio sólo cuando su matriz de artefactos está completa para las tres plataformas. Si una publicación sale sin todos sus archivos, la web conserva la anterior en vez de ofrecer descargas rotas.</p></section>
        <section><h2 id="notas">Notas de versión</h2><div data-release-notes><p>Las notas se publicarán con cada versión disponible.</p></div></section>`
    }
  }
};
