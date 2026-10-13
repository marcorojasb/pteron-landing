window.PTERON_DOCS = {
  aliases: {
    "crear-guia": "crear",
    "rubricas": "evaluar",
    "guia": "formatos-guia",
    "pauta": "pauta-docente",
    "atajos-teclado": "atajos"
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
        ["formatos-guia", "Formatos de guía"],
        ["pauta-docente", "Pauta docente"],
        ["copia-local", "Copia local"],
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
        ["atajos", "Atajos de teclado"],
        ["preguntas", "Preguntas frecuentes"],
        ["solucion-problemas", "Solución de problemas"],
        ["versiones", "Versiones y plataformas"]
      ]
    }
  ],
  pages: {
    "inicio": {
      eyebrow: "Documentación",
      title: "Qué es pteron",
      lead: "pteron es un espacio de trabajo que corre en tu computador. Prepara guías, pruebas, planificaciones y presentaciones a partir de tus propias fuentes, y te las entrega como un documento editable que decides si conservar.",
      html: `
        <section>
          <h2 id="por-donde-empezar">Por dónde empezar</h2>
          <div class="path-list">
            <a href="/descargar"><span>1</span><strong>Instala pteron</strong><small>Beta para Mac con chip M1 o posterior, Windows 11 y Linux x86_64.</small></a>
            <a href="/docs?pagina=primera-apertura"><span>2</span><strong>Elige carpeta y modelo</strong><small>Dos decisiones en el primer inicio; ambas se cambian después.</small></a>
            <a href="/docs?pagina=pantalla-inicio"><span>3</span><strong>Reconoce la pantalla</strong><small>Cuatro rumbos, selectores de contexto y un compositor.</small></a>
            <a href="/docs?pagina=crear"><span>4</span><strong>Crea tu primer material</strong><small>Del pedido a un documento editable, con un plan cuando hace falta.</small></a>
          </div>
        </section>
        <section>
          <h2 id="como-se-ve">Cómo se ve</h2>
          <p>Al abrir pteron encuentras la pantalla de inicio: la barra de sesiones arriba, los cuatro rumbos al centro y el compositor abajo. No hay que configurar nada más para escribir el primer pedido.</p>
          <figure class="product-shot"><img src="/assets/app/01-inicio-marco.webp?v=2026-10-12.8" srcset="/assets/app/01-inicio-marco.webp?v=2026-10-12.8 1440w, /assets/app/01-inicio-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Pantalla de inicio de pteron 0.7: las pestañas de sesiones arriba, los rumbos Planificar, Crear, Evaluar y Adaptar, el compositor «Por ejemplo: presentación sobre el ciclo del agua para 3° básico» y las tarjetas Retomar y Reflexión por voz"><figcaption>La pantalla de inicio. Cada rumbo es un verbo con una salida propia.</figcaption></figure>
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
        <section><h2 id="macos">macOS</h2><ul><li>Mac con chip Apple M1 o posterior. No funciona en Mac con procesador Intel.</li><li>Una versión reciente y compatible de macOS.</li><li>Espacio disponible para la aplicación, tus documentos y el modelo local que elijas.</li></ul></section>
        <section><h2 id="windows">Windows 11</h2><ul><li>Windows 11 en un equipo de 64 bits.</li><li>Permiso para instalar aplicaciones descargadas desde la web.</li><li>Espacio disponible para documentos y modelos locales.</li></ul><div class="notice"><strong>Beta sin firma digital</strong><p>El instalador de Windows todavía no está firmado. SmartScreen puede mostrar una advertencia y pedir confirmación antes de continuar.</p></div></section>
        <section><h2 id="linux">Linux</h2><ul><li>Sistema x86_64.</li><li>Permiso para instalar un paquete o ejecutar una AppImage.</li><li>Espacio disponible para la aplicación, tus documentos y el modelo local que elijas.</li></ul><div class="notice"><strong>Archivos firmados</strong><p>Los archivos para Linux incluyen una firma GPG separada que puedes verificar con la clave pública de pteron.</p></div></section>
        <section><h2 id="modelo">Modelo</h2><p>pteron viene preparado para usar un modelo local con Ollama. También puedes conectar un proveedor externo —⁠como OpenAI, Anthropic o Google Gemini⁠— o un perfil personalizado, pegando tu propia clave, o usar la IA incluida de un plan Basic o Pro, que no pide clave. Ninguna de esas opciones es obligatoria para instalar: la eliges en el primer inicio o después, en <strong>Configuración › Modelo de IA</strong>.</p></section>
        <section><h2 id="conexion">Conexión</h2><p>El trabajo con tus archivos es local. Descargar actualizaciones, usar la IA incluida y usar un proveedor en la nube necesitan conexión, y pteron lo indica antes de usarlos.</p></section>`
    },
    "instalar-macos": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en macOS",
      platform: ["mac", "apple", "arm64 · dmg"],
      lead: "La beta para macOS funciona en Mac con chip M1 o posterior.",
      html: `
        <section><h2 id="descargar">1. Descarga pteron</h2><p>Abre la <a href="/descargar">página de descargas</a> y elige la versión para macOS. El archivo es un <code>.dmg</code> firmado y notarizado.</p></section>
        <section><h2 id="instalar">2. Instala la aplicación</h2><ol class="install-steps"><li>Abre el archivo <code>.dmg</code>.</li><li>Arrastra pteron a la carpeta Aplicaciones.</li><li>Abre pteron desde Aplicaciones.</li></ol></section>
        <section><h2 id="primer-inicio">3. Completa el primer inicio</h2><p>macOS puede verificar la aplicación antes de abrirla por primera vez. Después, pteron te pedirá elegir o confirmar tu carpeta de trabajo. Continúa en <a href="/docs?pagina=primera-apertura">Primera apertura</a>.</p></section>`
    },
    "instalar-windows": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en Windows",
      platform: ["win", "windows", "x64 · exe"],
      lead: "pteron está disponible para Windows 11 mientras continúa en beta.",
      html: `
        <div class="notice notice-prominent"><strong>Windows puede mostrar una advertencia</strong><p>El instalador de la beta todavía no tiene firma digital. Microsoft Defender SmartScreen puede pedirte confirmar la instalación. Esta limitación se mantendrá visible mientras pteron siga en beta.</p></div>
        <section><h2 id="pasos">Pasos de instalación</h2><ol class="install-steps"><li>Descarga el instalador desde la <a href="/descargar">página de descargas</a>.</li><li>Abre el archivo <code>.exe</code>.</li><li>Si aparece SmartScreen, selecciona <strong>Más información</strong> y después <strong>Ejecutar de todas formas</strong>.</li><li>Completa los pasos del instalador.</li><li>Abre pteron desde el menú Inicio.</li></ol></section>
        <section><h2 id="verificar">Antes de continuar</h2><p>Comprueba que el archivo provenga del enlace oficial de pteron. Si tu organización administra el equipo, puede ser necesaria la autorización del área responsable.</p></section>
        <section><h2 id="actualizaciones">Si una actualización no se aplica</h2><p>En Windows, la firma no se valida antes de instalar y el instalador silencioso puede quedar bloqueado. Cuando eso ocurre, pteron abre el instalador a la vista y, al volver a abrirse, compara la versión real con la que intentó instalar y te avisa si no cambió.</p></section>`
    },
    "instalar-linux": {
      eyebrow: "Empezar / Instalar",
      title: "Instalar pteron en Linux",
      platform: ["linux", "linux", "x86_64 · appimage"],
      lead: "La beta para Linux está disponible en equipos x86_64. AppImage es la descarga principal y también hay paquetes .deb, .rpm y .tar.gz.",
      html: `
        <section><h2 id="elegir">1. Elige un formato</h2><p>Abre la <a href="/descargar">página de descargas</a>. Elige <strong>AppImage</strong> para usar el formato principal, <code>.deb</code> o <code>.rpm</code> para instalar un paquete, o <code>.tar.gz</code> para una instalación manual.</p></section>
        <section><h2 id="appimage">2. Abre la AppImage</h2><ol class="install-steps"><li>Marca el archivo como ejecutable desde las propiedades del archivo o con <code>chmod +x pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Abre <code>pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Completa el primer inicio y elige tu carpeta de trabajo.</li></ol></section>
        <section><h2 id="paquetes">Instalar otro formato</h2><p>Abre el archivo <code>.deb</code> o <code>.rpm</code> con el instalador de paquetes de tu sistema. El archivo <code>.tar.gz</code> se extrae manualmente y no registra un paquete en el sistema.</p></section>
        <section><h2 id="actualizaciones">Actualizaciones</h2><p>La AppImage puede descargar y aplicar actualizaciones desde pteron con tu confirmación. Las instalaciones <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso de una versión nueva y abren la descarga para que la reemplaces manualmente.</p></section>
        <section><h2 id="firma">Verificar la firma GPG</h2><p>Descarga la firma <code>.asc</code> que acompaña a tu archivo y la <a href="/descargar/pteron-releases-public.asc" download>clave pública de pteron</a>. Su huella es:</p><pre><code>5DDC 795B EFB7 EC2F EC93 0227 EAFB 54AE A175 0DCF</code></pre><p>Muestra la huella, importa la clave y verifica, por ejemplo, la AppImage:</p><pre><code>gpg --show-keys --fingerprint pteron-releases-public.asc
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
          <p>pteron propone una carpeta dentro de Documentos y puedes elegir otra. Todo lo que lea, indexe o cree ocurre dentro de ese límite, y no se sobrescribe ningún original. Puedes cambiarla después en <strong>Configuración › Perfil</strong>.</p>
        </section>
        <section>
          <h2 id="modelo">2. Elige quién prepara el material</h2>
          <p>Abre <strong>Configuración › Modelo de IA</strong>. Tienes tres caminos: quedarte con el modelo local de <strong>En este equipo</strong> (Ollama), que no envía tus documentos a ningún servidor; elegir un proveedor externo —⁠por ejemplo OpenAI, Anthropic o Google Gemini, u otro perfil que agregues⁠— y pegar tu propia clave; o, con un plan Basic o Pro, usar la <strong>IA incluida</strong>, que no pide clave y funciona con la licencia que activas en <strong>Configuración › Perfil</strong>. Para un proveedor externo, elígelo en la lista: a la derecha pegas su clave y eliges el modelo.</p>
          <p>Si no configuras nada, pteron queda con el modelo local. Los cambios no se aplican hasta pulsar <strong>Guardar cambios</strong>.</p>
        </section>
        <section>
          <h2 id="primera-sesion">3. Escribe tu primer pedido</h2>
          <p>Vuelve a la pantalla de inicio, elige un rumbo y describe lo que necesitas. Si el pedido lo amerita, pteron te propone antes un plan que puedes ajustar; si es directo, va directo al material. Continúa en <a href="/docs?pagina=pantalla-inicio">La pantalla de inicio</a>.</p>
        </section>`
    },
    "actualizar": {
      eyebrow: "Empezar",
      title: "Actualizar pteron",
      lead: "La aplicación avisa cuando hay una versión nueva.",
      html: `
        <section><h2 id="canal-beta">Canal beta</h2><p>La beta pública es gratuita. Por ahora todas las versiones salen en el canal beta, con correcciones y cambios frecuentes.</p></section>
        <section><h2 id="instalacion">Cómo se aplica</h2><p>En macOS, Windows y AppImage para Linux, pteron descarga la actualización y pide tu consentimiento antes de instalarla al reiniciar. Las instalaciones Linux <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso y abren la descarga para una actualización manual.</p><p>La búsqueda automática de versiones nuevas se puede apagar en Configuración.</p></section>
        <section><h2 id="windows">Windows sin firma</h2><div class="notice"><strong>Limitación conocida</strong><p>En macOS la firma se valida antes de instalar. En Windows todavía no, y la aplicación lo declara. El estado de firma se informa por plataforma.</p></div></section>`
    },
    "pantalla-inicio": {
      eyebrow: "Conocer la aplicación",
      title: "La pantalla de inicio",
      lead: "Una sola pantalla de partida: cuatro rumbos, los selectores de contexto y el compositor.",
      html: `
        <section>
          <h2 id="rumbos">Los cuatro rumbos</h2>
          <p>Cada rumbo es un verbo con una salida propia. Elegir uno no fija un modo ni te obliga a un curso, un plan o un tipo de material: sólo orienta el pedido y vale sólo para ese pedido.</p>
          <div class="table-wrap"><table>
            <thead><tr><th>Rumbo</th><th>Para qué</th></tr></thead>
            <tbody>
              <tr><td><strong>Planificar</strong></td><td>Organiza clases y unidades.</td></tr>
              <tr><td><strong>Crear</strong></td><td>Produce material listo para usar.</td></tr>
              <tr><td><strong>Evaluar</strong></td><td>Comprueba y analiza aprendizajes.</td></tr>
              <tr><td><strong>Adaptar</strong></td><td>Ajusta material existente.</td></tr>
            </tbody>
          </table></div>
        </section>
        <section>
          <h2 id="contexto">Los selectores de contexto</h2>
          <p>Al elegir un rumbo aparecen cuatro selectores sobre el compositor: <strong>curso</strong>, <strong>asignatura</strong>, <strong>OA</strong> y <strong>Materiales</strong>. Lo que eliges queda como etiquetas dentro del compositor, y <strong>Limpiar</strong> los retira todos. El compositor también cambia su texto para recordarte qué estás pidiendo.</p>
          <figure class="product-shot"><img src="/assets/app/02-inicio-pedido-marco.webp?v=2026-10-12.8" srcset="/assets/app/02-inicio-pedido-marco.webp?v=2026-10-12.8 1440w, /assets/app/02-inicio-pedido-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Pantalla de inicio de pteron 0.7 mientras se escribe un pedido: los selectores Curso y Asignatura sobre el texto «Quiero una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos» y la fila ¿Agregar? con Guía, 6° básico, Matemática, Tema: fracciones equivalentes, 45 minutos y Agregar todo"><figcaption>Mientras escribes el pedido, pteron reconoce material, curso, asignatura, tema y duración, y ofrece agregarlos.</figcaption></figure>
        </section>
        <section>
          <h2 id="compositor">El compositor</h2>
          <p>Escribe con tus palabras lo que necesitas. El botón <strong>+</strong> adjunta material y las menciones <code>@</code> traen un documento de tu carpeta. Bajo el compositor puede aparecer una sugerencia tomada de tu contexto reciente, marcada como <b>por tu memoria</b> o <b>por tu contexto</b>: es un atajo, no una orden.</p>
        </section>
        <section>
          <h2 id="barra">La barra superior</h2>
          <p>Arriba viven las sesiones abiertas, el botón <strong>+</strong> para abrir una nueva y el reloj que despliega el historial.</p>
        </section>
        <section>
          <h2 id="espacios">Los espacios</h2>
          <p>El selector de la esquina superior derecha cambia entre Chats, Biblioteca y Configuración sin cerrar lo que tienes abierto.</p>
          <div class="table-wrap"><table>
            <thead><tr><th>Espacio</th><th>Qué hay ahí</th></tr></thead>
            <tbody>
              <tr><td><strong>Chats</strong></td><td>Las conversaciones y sus pestañas: donde pides, revisas y decides.</td></tr>
              <tr><td><strong>Biblioteca</strong></td><td>Tus materiales y los archivos de tu carpeta, abiertos en su visor o editor.</td></tr>
              <tr><td><strong>Planificador</strong></td><td>Pausado y apagado de fábrica. Si lo activas en Configuración › Labs, aparece como un espacio más para ordenar clases, unidades y calendario.</td></tr>
              <tr><td><strong>Configuración</strong></td><td>Perfil, Modelo de IA, Memoria y contexto, Complementos, Labs y Sobre pteron.</td></tr>
            </tbody>
          </table></div>
        </section>
        <section>
          <h2 id="apariencia">Tema claro u oscuro</h2>
          <p>pteron abre en tema claro y puedes cambiarlo a oscuro o dejarlo a cargo del sistema desde <strong>Configuración › Perfil</strong>. La preferencia se conserva al volver a abrir la aplicación.</p>
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
          <figure class="product-shot"><img src="/assets/docs/app-sesiones-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Barra superior de pteron con varias pestañas de sesión, una activa, el botón + y el reloj del historial"><figcaption>Las sesiones abiertas, el botón + para una nueva y el reloj del historial.</figcaption></figure>
          <p>Abre una sesión nueva cuando cambie el objetivo. Cerrar una sesión la archiva y puedes recuperarla desde el historial; eliminarla es una acción distinta y explícita.</p>
          <div class="notice"><strong>Continuidad de 30 minutos</strong><p>Si vuelves a la aplicación dentro de los 30 minutos siguientes, pteron retoma donde estabas. Pasado ese plazo, empieza una sesión nueva.</p></div>
        </section>
        <section>
          <h2 id="memoria">Memoria y contexto</h2>
          <p>La memoria guarda preferencias que tú aceptas conservar —⁠cómo te gusta que se redacten las instrucciones, qué formato usas, qué cursos atiendes⁠— para no repetirlas en cada pedido. Cuando una sugerencia proviene de ahí, aparece rotulada <b>por tu memoria</b>.</p>
          <figure class="product-shot"><img src="/assets/docs/app-memoria-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Panel de memoria y contexto de pteron con las preferencias guardadas"><figcaption>Configuración › Memoria y contexto: lo que pteron recuerda, a la vista y retirable.</figcaption></figure>
          <p>Todo lo guardado se revisa y se retira desde <strong>Configuración › Memoria y contexto</strong>. La memoria no incluye tus materiales ni el contenido de tus sesiones.</p>
        </section>`
    },
    "carpeta-trabajo": {
      eyebrow: "Conocer la aplicación",
      title: "Carpeta de trabajo",
      lead: "Es el límite visible dentro del cual pteron puede leer y crear archivos.",
      html: `
        <section><h2 id="por-que">Por qué existe</h2><p>pteron no tiene acceso general a tu equipo. Al instalar propone una carpeta dentro de Documentos, tú puedes elegir otra, y todo lo que indexe, busque o lea ocurre dentro de ella. Se cambia desde <strong>Configuración › Perfil</strong>.</p></section>
        <section><h2 id="originales">Tus originales</h2><p>La aplicación no sobrescribe los archivos de origen. Cada resultado se guarda como una copia nueva mediante una acción visible que tú ejecutas: no hay guardado automático sobre tus documentos.</p></section>
        <section><h2 id="indice">Búsqueda dentro de la carpeta</h2><p>pteron mantiene un índice local del contenido para poder encontrar y citar tus materiales. Ese índice vive en tu equipo junto con las sesiones, y en cada pedido lee una cantidad limitada de texto.</p></section>
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
            <li>Un documento abierto junto al material puede adjuntarse con <strong>Adjuntar a la conversación</strong>.</li>
          </ul>
          <p>pteron distingue las fuentes locales de las externas y las deja inspeccionables junto al resultado, para que puedas comprobar de dónde salió cada cosa. El contenido recuperado desde la web se trata como dato no confiable.</p>
        </section>
        <section>
          <h2 id="acciones">Qué puedes hacer con una respuesta</h2>
          <p>Una respuesta en la conversación no es un callejón sin salida: puedes guardarla, convertirla en material o copiarla.</p>
          <figure class="product-shot"><img src="/assets/docs/app-conversacion-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Conversación en pteron con tres acciones al pie de la respuesta: guardar, convertir en material y copiar"><figcaption>Las acciones al pie de cada respuesta: guardar, convertir en material o copiar.</figcaption></figure>
        </section>
        <section>
          <h2 id="contexto">Qué conviene incluir</h2>
          <p>Curso, objetivo, duración, formato esperado y cualquier condición que cambie el resultado. Los selectores cubren curso, asignatura y OA; el resto va en tus palabras.</p>
          <blockquote>«Crea una guía de 45 minutos para 7° básico. Usa el documento adjunto como única fuente y deja una sección final de reflexión.»</blockquote>
        </section>`
    },
    "biblioteca": {
      eyebrow: "Conocer la aplicación",
      title: "Abrir un recurso",
      lead: "Todo lo que pteron ha creado y todo lo que hay en tu carpeta se abre desde un mismo lugar.",
      html: `
        <section>
          <h2 id="abrir">El selector de recursos</h2>
          <p>Busca por nombre o filtra por formato —⁠<strong>Documentos</strong>, <strong>Presentaciones</strong>, <strong>PDF</strong>, <strong>Planillas</strong>, <strong>Imágenes</strong> y <strong>Otros</strong>—. La barra lateral separa el origen: <b>Todos los materiales</b>, <b>Mi carpeta</b> y <b>Creados en pteron</b>; si activas el complemento, aparece también <b>Begonia Next</b> (en línea). Cada fila lleva su rótulo —⁠GUÍA, PLANIFICACIÓN, EVALUACIÓN, PAUTA…⁠— y el detalle declara el origen, por ejemplo <b>Material de tu carpeta</b> o <b>Evaluación de pteron</b>.</p>
          <figure class="product-shot"><img src="/assets/app/10-biblioteca-marco.webp?v=2026-10-12.8" srcset="/assets/app/10-biblioteca-marco.webp?v=2026-10-12.8 1440w, /assets/app/10-biblioteca-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Biblioteca de pteron 0.7 con 14 materiales (guías, evaluación, pauta, planificaciones, presentación, PDF y Word), los filtros por formato, el origen en la barra lateral y la vista previa de una evaluación"><figcaption>La biblioteca con 14 materiales y la vista previa de la evaluación: guías, pauta, planificaciones, presentación, PDF y Word en una sola lista.</figcaption></figure>
        </section>
        <section>
          <h2 id="recorrido">De la lista al recurso</h2>
          <p>Al elegir una fila, el detalle de la derecha muestra el título, el origen y la primera página, y el botón <b>Abrir en editor</b> deja el recurso listo para seguir trabajando.</p>
        </section>
        <section>
          <h2 id="volver">Volver a un material</h2>
          <p>Al abrir algo creado por pteron vuelves a su conversación, con su historial de revisiones intacto, para seguir revisándolo o guardarlo. Un material de tu carpeta se abre para leerlo y usarlo como referencia.</p>
        </section>
        <section>
          <h2 id="dispositivo">Traer un archivo de fuera</h2>
          <p>El botón <strong>+</strong> de la biblioteca › <strong>Traer archivo…</strong> incorpora un documento que no está en la carpeta de trabajo. Se copia a tu espacio; el original no se mueve ni se modifica.</p>
        </section>
        <section>
          <h2 id="complementos">Fuentes fuera de tu carpeta</h2>
          <p>En <strong>Configuración › Complementos</strong> ves las fuentes que pteron puede consultar. El Currículum Nacional y la búsqueda web vienen disponibles y envían a internet sólo el texto de la búsqueda. El correo lee archivos .eml de una carpeta que eliges, sin conexión. Begonia Next, un banco de recursos pedagógicos, se activa sólo si tú lo decides y por ahora requiere un acceso aparte. Lo que traen se distingue de tus fuentes locales y queda a la vista junto al resultado.</p>
        </section>`
    },
    "planificar": {
      eyebrow: "Trabajar con pteron",
      title: "Planificar",
      lead: "El rumbo para organizar clases y unidades, con momentos y duración que cuadren.",
      html: `
        <section>
          <h2 id="dos-cosas">Dos cosas distintas con el mismo nombre</h2>
          <p>El rumbo <strong>Planificar</strong> del compositor produce una planificación como material revisable, y es lo que describe esta página. El espacio <strong>Planificador</strong> del selector —⁠clases, unidades y calendario⁠— es otra superficie: está pausado y apagado de fábrica, y se activa en Configuración › Labs.</p>
        </section>
        <section>
          <h2 id="pedido">Qué entregar en el pedido</h2>
          <p>Elige el rumbo <strong>Planificar</strong> y fija curso, asignatura y OA en los selectores. En el compositor añade lo que ellos no cubren: duración total, recursos disponibles, número de clases y cómo quieres cerrar.</p>
          <blockquote>«Planifica una unidad de cuatro clases de 45 minutos sobre fracciones equivalentes. El curso tiene proyector pero no tablets. Cierra cada clase con una salida escrita breve.»</blockquote>
        </section>
        <section>
          <h2 id="verificacion">Lo que pteron no decide por ti</h2>
          <p>pteron no rechaza una planificación por su contenido: si los momentos no suman la duración que pediste, te la entrega igual para que la corrijas.</p>
        </section>
        <section>
          <h2 id="revisar">Qué revisar tú</h2>
          <p>Lo que ninguna comprobación automática puede juzgar: si la progresión tiene sentido para tu curso, si los tiempos son realistas y si las oportunidades de participación son reales y no decorativas.</p><figure class="product-shot"><img src="/assets/app/07-planificacion-apaisada-marco.webp?v=2026-10-12.8" srcset="/assets/app/07-planificacion-apaisada-marco.webp?v=2026-10-12.8 1440w, /assets/app/07-planificacion-apaisada-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Planificación de unidad en Write, en hoja apaisada: Álgebra y sistemas de ecuaciones lineales para 1° medio, con objetivos de aprendizaje y una tabla clase a clase con actividad, tiempo, recursos y evaluación"><figcaption>Una planificación de unidad apaisada (Álgebra, 1° medio) con su tabla clase a clase.</figcaption></figure>
        </section>`
    },
    "crear": {
      eyebrow: "Trabajar con pteron",
      title: "Crear",
      lead: "El rumbo para producir material listo para usar. Si el pedido lo amerita, antes llega un plan que puedes cambiar.",
      html: `
        <section>
          <h2 id="pedido">1. Haz el pedido</h2>
          <p>Elige el rumbo <strong>Crear</strong>, fija el contexto en los selectores y describe el material. Si tienes una guía anterior con el formato que usas, adjúntala: pteron toma de ahí el encabezado y la forma de los ítems en vez de inventar una tercera.</p>
        </section>
        <section>
          <h2 id="plan">2. Revisa el plan</h2>
          <p>Cuando el pedido lo amerita, pteron responde primero con un <strong>plan de trabajo</strong> en vez de un borrador. El plan declara qué va a producir, qué decidió por su cuenta y qué preguntas te hizo.</p>
          <figure class="product-shot"><img src="/assets/docs/app-plan-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Tarjeta de plan listo para crear en pteron, con decisiones confirmadas y la acción para generar el material"><figcaption>El plan listo para crear: lo confirmado queda a la vista antes de generar el material.</figcaption></figure>
          <p>Fíjate en <strong>Supuestos que puedes cambiar</strong>: ahí está lo que pteron decidió sin preguntarte. Corrígelo con <strong>Pedir un ajuste</strong> antes de seguir; sale más barato que rehacer el material. Cuando estés conforme, pulsa <strong>Crear la guía</strong>.</p>
          <div class="notice"><strong>El plan es opcional</strong><p>Aparece sólo cuando aporta al pedido. Si pides algo directo, pteron va directo al material.</p></div>
        </section>
        <section>
          <h2 id="material">3. Recibe el material</h2>
          <p>El resultado se abre como documento editable, no como texto dentro del chat. Sigue en <a href="/docs?pagina=artefactos">Documentos</a> y en <a href="/docs?pagina=revisar-exportar">Revisar y guardar</a>.</p><figure class="product-shot"><img src="/assets/app/03-conversacion-marco.webp?v=2026-10-12.8" srcset="/assets/app/03-conversacion-marco.webp?v=2026-10-12.8 1440w, /assets/app/03-conversacion-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Conversación en pteron 0.7: un pedido de planificación y guía de homotecia para 8° básico, el resumen de pteron y dos tarjetas, Introducción a la homotecia — 8° básico (90 min) y La homotecia: centro, razón e imagen, con Versiones y Abrir en editor"><figcaption>Un pedido con dos materiales: pteron resume lo que hizo y entrega la planificación y la guía como tarjetas.</figcaption></figure>
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
          <h2 id="rechaza">Lo que pteron arregla solo</h2>
          <p>pteron sólo detiene lo que no se puede imprimir: un material vacío, una selección múltiple sin alternativas o una figura que no se puede dibujar. El número, el puntaje de cada pregunta y el total se calculan solos al editar. Si hay una sola alternativa correcta y si la rúbrica tiene criterios útiles lo revisas tú.</p>
        </section>
        <section>
          <h2 id="sugerencias">Lo que te advierte sin bloquear</h2>
          <p>El resto llega como <strong>Sugerencias</strong> en el panel derecho, con el bloque afectado y el motivo. Cada una trae un botón <strong>Proponer</strong>: nada se aplica hasta que tú lo pides.</p>
          <figure class="product-shot"><img src="/assets/app/05-write-respuesta-marco.webp?v=2026-10-12.8" srcset="/assets/app/05-write-respuesta-marco.webp?v=2026-10-12.8 1440w, /assets/app/05-write-respuesta-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Evaluación formativa en Write con un gráfico de barras y una pregunta de verdadero o falso con justificación; abierto el panel Respuesta · sólo para ti con la respuesta y el criterio de corrección"><figcaption>Una evaluación con gráfico de barras y una V/F con justificación; el panel «Respuesta · sólo para ti» guarda la respuesta y el criterio de corrección.</figcaption></figure>
        </section>
        <section>
          <h2 id="datos">No uses datos reales</h2>
          <p>No incluyas nombres ni RUT de estudiantes para producir ejemplos. Ver <a href="/docs?pagina=datos-estudiantes">Datos de estudiantes</a>.</p>
        </section>`
    },
    "adaptar": {
      eyebrow: "Trabajar con pteron",
      title: "Adaptar",
      lead: "El rumbo para ajustar a tu curso un material que ya existe.",
      html: `
        <section>
          <h2 id="partir">Parte de un documento</h2>
          <p>Trae el material con una mención <code>@</code>, desde <a href="/docs?pagina=biblioteca">Abrir recurso</a> o adjuntándolo con el botón <strong>+</strong>. Después indica qué debe cambiar: el nivel, la extensión, el formato, el vocabulario o el tipo de actividad.</p>
          <blockquote>«Adapta esta guía de 8° para un 6° básico. Mantén los mismos contenidos, reduce a cuatro preguntas y agrega un ejemplo resuelto antes de la primera.»</blockquote>
        </section>
        <section>
          <h2 id="referencia">Trabajar con el original a la vista</h2>
          <p>Un documento de tu espacio se abre junto al material, con su propio paginador y zoom. Su texto es seleccionable, puedes citar una página o un fragmento, y <strong>Adjuntar a la conversación</strong> lo adjunta al contexto como una etiqueta visible que puedes retirar.</p>
          <figure class="product-shot"><img src="/assets/docs/app-referencia-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Vista doble con el material a la izquierda y un PDF de referencia abierto a la derecha"><figcaption>El material y su referencia, uno junto al otro. Adjuntar no envía nada: el pedido lo escribes tú.</figcaption></figure>
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
          <p>Cuando pides un cambio, pteron no reescribe el documento: prepara una propuesta y te la muestra. El estado pasa a <strong>Propuesta sin aplicar</strong>, la cabecera <strong>Documento propuesto · Cambios</strong> indica cuántos bloques toca y el panel deja comparar <strong>Vigente</strong> y <strong>Propuesta</strong> antes de decidir.</p>
          <figure class="product-shot"><img src="/assets/docs/app-revision-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Comparación de una propuesta en pteron con el documento vigente y el propuesto, y las acciones Conservar cambios y Descartar propuesta"><figcaption>Propuesta sin aplicar: ves las diferencias y decides con Conservar cambios o Descartar propuesta.</figcaption></figure>
          <p>El muelle inferior lo dice sin rodeos —⁠<b>Propongo estos cambios. Aún no se aplican.</b>— y ofrece <strong>Conservar cambios</strong> o <strong>Descartar propuesta</strong>. Si cancelas a medias, no se publica una revisión incompleta.</p>
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
          <p>La acción principal del muelle guarda un archivo nuevo. pteron no sobrescribe el original ni guarda solo. Ver <a href="/docs?pagina=exportar">Exportar y compartir</a>.</p>
        </section>`
    },
    "artefactos": {
      eyebrow: "Materiales y formatos",
      title: "Documentos",
      lead: "Una guía o evaluación de pteron no es un bloque de texto en el chat: es un documento con encabezado con campos, ítems puntuados, espacios de respuesta y pauta, listo para editar en Write y exportar.",
      html: `
        <section>
          <h2 id="nivel">Lo que sale de pteron</h2>
          <p>El material llega compuesto como hoja de clase: encabezado con campos, objetivo, instrucciones, ítems con su puntaje y —⁠cuando el encargo incluye soluciones⁠— la pauta docente aparte. Todo se abre en Write, se corrige con el criterio del profesor y recién entonces se imprime o se exporta.</p>
          <figure class="product-shot product-shot-hero"><img src="/assets/app/04-write-guia-con-figuras-marco.webp?v=2026-10-12.8" srcset="/assets/app/04-write-guia-con-figuras-marco.webp?v=2026-10-12.8 1440w, /assets/app/04-write-guia-con-figuras-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Guía de trabajo en Write con ejercicios de fracciones en barras, círculos y cuadrículas, la cinta de una fila y el panel Estructura con el puntaje de cada pregunta"><figcaption>Una guía en Write con figuras de fracciones en barras, círculos y cuadrículas; a la derecha, la estructura con el puntaje de cada pregunta.</figcaption></figure>
        </section>
        <section>
          <h2 id="formato-guia">Formato de guía y evaluación</h2>
          <p>El encabezado con campos reserva campos reales —⁠asignatura, eje, curso, docente, fecha, puntaje total y propósito⁠— y no se pierde al exportar. Cada ítem declara su tipo y su puntaje; el panel <strong>Estructura</strong> lista los bloques y suma el total.</p>
          <p>Los ítems cubren selección múltiple, selección de varias respuestas, desarrollo, verdadero o falso, términos pareados y ordenar pasos. Las alternativas van en su campo, con letra o casilla; el desarrollo trae líneas de respuesta; las tablas se completan en celda. Lo escrito en un renglón de respuesta queda como indicación sobre el espacio, no como respuesta del estudiante.</p>
          <p>La <strong>pauta docente</strong> es un material aparte, enlazado con la guía del estudiante: allí viven las respuestas y las explicaciones. Exportas el documento a <strong>DOCX</strong> o <strong>PDF</strong> conservando la composición; las presentaciones van a <strong>PPTX</strong>. Ver <a href="/docs?pagina=formatos-guia">Formatos de guía</a>, <a href="/docs?pagina=pauta-docente">Pauta docente</a> y <a href="/docs?pagina=exportar">Exportar y compartir</a>.</p>
        </section>
        <section>
          <h2 id="formatos">Tamaños y orientación</h2>
          <p>Los documentos admiten Oficio (el predeterminado), Carta, A4 y Legal (EE. UU.), con márgenes y saltos de página que se respetan al exportar. Puedes trabajar en vertical o apaisado, y la barra de edición permanece visible mientras recorres el material.</p>
          <figure class="product-shot"><img src="/assets/app/07-planificacion-apaisada-marco.webp?v=2026-10-12.8" srcset="/assets/app/07-planificacion-apaisada-marco.webp?v=2026-10-12.8 1440w, /assets/app/07-planificacion-apaisada-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Planificación de unidad en Write, en hoja apaisada: Álgebra y sistemas de ecuaciones lineales para 1° medio, con su tabla clase a clase"><figcaption>Una planificación en hoja apaisada, con su tabla clase a clase.</figcaption></figure>
        </section>
        <section>
          <h2 id="cinta">La cinta del editor</h2>
          <p>Los materiales nuevos se abren en los editores nativos <strong>Write</strong> (documento) y <strong>Present</strong> (presentación). Ambos usan una cinta de una sola fila, con <strong>Archivo</strong> y un botón «Más» para lo que no cabe. Write organiza Inicio, Insertar, Página, Revisar y Vista; Present usa Inicio, Insertar, Diseño, Presentación y Vista. La lupa de la cinta, «Buscar comandos», encuentra cualquier orden por su nombre.</p>
        </section>
        <section>
          <h2 id="paginas">Hojas y configuración de página</h2>
          <p>Write trabaja sobre hojas físicas: cuando el contenido desborda una página, refluye a la siguiente y avisa una sola vez por hoja afectada. En la pestaña <strong>Página</strong> eliges tamaño —⁠Oficio, Carta, A4 o Legal (EE. UU.)⁠—, orientación, márgenes, encabezado, pie y numeración. La configuración es por documento, y el PDF exportado la respeta.</p>
          <p>Deshacer y rehacer funcionan también cuando un cambio mueve texto a otra hoja.</p>
        </section>
        <section>
          <h2 id="matematicas">Matemáticas y tablas</h2>
          <p>Las expresiones matemáticas viajan como fórmula, no como texto con barras: se maquetan en pantalla —⁠también dentro de una celda de tabla, que muestra su fuente al enfocarla⁠— y salen al DOCX como ecuación real.</p>
          <p>Las ecuaciones se insertan desde la cinta y se editan en el propio documento: al abrir una, aparece su pestaña <strong>Ecuación</strong> con estructuras (fracción, raíz, integral, matriz…), símbolos y presentación en línea o centrada. Pasar de una ecuación a otra guarda la primera y abre la segunda en el mismo gesto.</p>
          <p>Un bloque puede mezclar prosa y una tabla, y ambas se exportan en el orden en que fueron escritas.</p>
          <p>Las listas se escriben con marcadores (<code>-</code>, <code>1.</code>, <code>A.</code>) y conservan su estilo al exportar. Las imágenes se ajustan desde la pestaña contextual —⁠tamaño, alineación y texto alternativo⁠— sin ventanas flotantes.</p><figure class="product-shot"><img src="/assets/app/11-taller-de-figuras-marco.webp?v=2026-10-12.8" srcset="/assets/app/11-taller-de-figuras-marco.webp?v=2026-10-12.8 1440w, /assets/app/11-taller-de-figuras-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Taller de figuras de pteron: un gráfico circular de deportes favoritos con sus partes, valores, colores y formato de 12 cm, y el botón Aplicar al material"><figcaption>El taller de figuras: el gráfico circular de la evaluación con sus partes, valores y formato, listo para aplicar al material.</figcaption></figure>
        </section>
        <section>
          <h2 id="historial">Revisiones</h2>
          <p>El panel <strong>Asistente pteron</strong> lista cada revisión con su hora y su recuento de bloques, y muestra cuántos se añadieron, cambiaron o quitaron. <strong>Formato base</strong> guarda el formato del que parte el documento.</p>
        </section>`
    },
    "formatos-guia": {
      eyebrow: "Materiales y formatos",
      title: "Formatos de guía",
      lead: "La forma de una guía o evaluación no se improvisa: sale de tu documento de referencia o de la hoja predeterminada de pteron.",
      html: `
        <section>
          <h2 id="dos-fuentes">Dos fuentes, nunca una tercera</h2>
          <p>Los encabezados e ítems de un material provienen de un documento que adjuntas como referencia o de la forma predeterminada definida en pteron. Si tu establecimiento ya tiene un formato, tráelo: pteron lo sigue en vez de inventar otro.</p>
          <div class="notice"><strong>Adjuntar manda</strong><p>Con un documento adjunto, la plantilla del comando no se inserta: la referencia gobierna el encabezado y la forma de los ítems.</p></div>
        </section>
        <section>
          <h2 id="hoja">La hoja predeterminada</h2>
          <p>Guía, evaluación, ticket de salida, planificación, rúbrica y pauta comparten una misma gramática. Sin un dato, el elemento simplemente no aparece.</p>
          <ul>
            <li>Antetítulo con la asignatura; tipo y tema como título y subtítulo.</li>
            <li>Ficha de identificación con líneas para completar (curso, docente, fecha, puntaje).</li>
            <li>Etiquetas de propósito y tiempo, e instrucciones.</li>
            <li>Tarjeta por pregunta con etiqueta de puntaje y habilidad.</li>
            <li>Alternativas con letra o casilla, recuadro de respuesta y pie «Pág. n de N».</li>
          </ul>
          <p>Write, el PDF y el DOCX comparten la composición: lo que ves en la hoja es lo que se imprime.</p>
        </section>
        <section>
          <h2 id="items">Tipos de ítem</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Ítem</th><th>Cómo se marca la respuesta</th></tr></thead>
            <tbody>
              <tr><td>Selección múltiple</td><td>Alternativas con letra (A, B, C…)</td></tr>
              <tr><td>Varias respuestas</td><td>Alternativas con casilla ☐</td></tr>
              <tr><td>Desarrollo</td><td>Líneas o párrafos en blanco para responder</td></tr>
              <tr><td>Verdadero o falso</td><td>Afirmaciones con marca V / F</td></tr>
              <tr><td>Términos pareados</td><td>Columnas para unir</td></tr>
              <tr><td>Ordenar pasos</td><td>Secuencia para reordenar</td></tr>
            </tbody>
          </table></div>
          <p>La barra <strong>Estructura</strong> de Write inserta estos tipos, apartados, instrucciones, tablas y espacios de respuesta después del bloque del cursor, y deja mover, duplicar o eliminar cada bloque.</p>
        </section>
        <section>
          <h2 id="editar">Editar sin perder la forma</h2>
          <p>La hoja se edita como en Word: Enter en una alternativa crea otra, el puntaje y el total se recalculan solos y lo escrito en un renglón de respuesta queda como indicación sobre el espacio. En el DOCX exportado, números, letras y casillas son numeración de Word.</p>
        </section>`
    },
    "pauta-docente": {
      eyebrow: "Materiales y formatos",
      title: "Pauta docente",
      lead: "Las respuestas no viajan en la hoja del estudiante: se guardan en el material, sólo para ti, y la pauta se arma aparte.",
      html: `
        <section>
          <h2 id="por-que">Por qué está separada</h2>
          <p>Una guía o evaluación para estudiantes no incluye la solución. En pteron, cada pregunta guarda su respuesta en el propio material, en el panel <b>Respuesta · sólo para ti</b>, con la justificación y el criterio de corrección. Ese panel no se imprime: la hoja que recibe el curso queda limpia.</p>
          <figure class="product-shot product-shot-crop"><div class="crop" style="--sw:2880;--cx:596;--cy:1056;--cw:1060;--ch:390"><img src="/assets/app/05-write-respuesta-marco-2x.webp?v=2026-10-12.8" width="2880" height="1760" loading="lazy" decoding="async" alt="Panel Respuesta · sólo para ti bajo una pregunta de verdadero o falso: la alternativa V marcada, la justificación «En 6°B, natación (3) + atletismo (2) = 5, y vóleibol tiene 4; 5 > 4» y el criterio de corrección con su puntaje parcial"></div><figcaption>Bajo cada pregunta, la respuesta, la justificación y el criterio de corrección. Sólo los ves tú.</figcaption></figure>
        </section>
        <section>
          <h2 id="vinculo">La pauta, en un documento aparte</h2>
          <p>Con las respuestas guardadas, <b>Archivo › Pauta docente</b> arma la pauta en un documento propio: <b>Generar pauta</b> la crea, <b>Abrir pauta</b> la muestra, y <b>Guardar pauta en Word…</b> y <b>Guardar pauta en PDF…</b> la guardan como archivo nuevo. Si el material cambia después, pteron la marca como desactualizada y te ofrece actualizarla.</p>
          <p>Al imprimir o guardar el material, <b>Qué hoja</b> elige entre la <b>Hoja del estudiante</b>, sin respuestas, y la <b>Versión docente (con respuestas)</b>.</p>
          <figure class="product-shot"><img src="/assets/app/06-imprimir-version-docente-marco.webp?v=2026-10-12.8" srcset="/assets/app/06-imprimir-version-docente-marco.webp?v=2026-10-12.8 1440w, /assets/app/06-imprimir-version-docente-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Archivo › Imprimir en Write con la opción Qué hoja: Hoja del estudiante, sin respuestas, o Versión docente con respuestas, y la evaluación formativa debajo"><figcaption>Archivo › Imprimir con «Qué hoja»: la hoja del estudiante o la versión docente con respuestas.</figcaption></figure>
        </section>
        <section>
          <h2 id="opcional">No siempre hace falta</h2>
          <div class="notice"><strong>La pauta es opcional</strong><p>Si el encargo no incluye soluciones —⁠una actividad de práctica, un ticket de salida⁠—, pteron no crea una pauta vacía por obligación.</p></div>
          <p>Revisa la pauta como revisas el material: el criterio de corrección es tuyo, y nada se aplica solo.</p>
        </section>`
    },
    "copia-local": {
      eyebrow: "Materiales y formatos",
      title: "Copia local",
      lead: "Guardar produce un archivo nuevo, en el lugar que tú eliges. Tus originales quedan intactos.",
      html: `
        <section>
          <h2 id="explicito">El guardado es explícito</h2>
          <p>pteron no guarda solo. El estado lo dice —⁠<b>Guardado</b> o sin guardar⁠— y la copia se materializa cuando ejecutas la acción: <strong>Guardar en pteron</strong> (Ctrl/⌘ S) conserva el material en pteron, y <strong>Guardar en Word…</strong> o <strong>Guardar en PDF…</strong>, en Archivo, crean un archivo nuevo.</p>
          <p>El diálogo del sistema te deja elegir carpeta y nombre. Ninguna exportación sobrescribe el archivo de partida.</p>
        </section>
        <section>
          <h2 id="biblioteca">Copia desde la Biblioteca</h2>
          <p>La Biblioteca trabaja sobre tu carpeta real: crear carpetas, renombrar, mover y enviar a la Papelera. «Copiar…» guarda una copia del material mediante un diálogo visible, sin tocar el original.</p>
        </section>
        <section>
          <h2 id="donde">Dónde vive tu trabajo</h2>
          <p>Las sesiones, el índice de búsqueda y los materiales creados en pteron se guardan en tu equipo, en la carpeta de datos de la aplicación. Tus archivos siguen en la carpeta de trabajo: mover uno fuera de ella lo saca del alcance de pteron, y vuelve a estar disponible si lo traes de vuelta.</p>
          <p>Para el detalle de formatos de exportación, ver <a href="/docs?pagina=exportar">Exportar y compartir</a>.</p>
        </section>`
    },
    "presentaciones": {
      eyebrow: "Materiales y formatos",
      title: "Presentaciones",
      lead: "Presentaciones nativas 16:9 que exportan un PPTX editable.",
      html: `
        <section>
          <h2 id="editor">El editor de diapositivas</h2>
          <p>La columna izquierda lista las diapositivas y permite añadir, duplicar, mover y eliminar. La barra de estado indica la diapositiva actual, el total, los elementos y el tamaño del lienzo —⁠por ejemplo <b>Diapositiva 1 de 7 · 4 elementos · 960 × 540</b>—. El panel derecho controla el diseño de la diapositiva: fondo y capas.</p>
          <figure class="product-shot"><img src="/assets/app/08-present-marco.webp?v=2026-10-12.8" srcset="/assets/app/08-present-marco.webp?v=2026-10-12.8 1440w, /assets/app/08-present-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Editor Present de pteron 0.7: una diapositiva con barras de fracciones equivalentes 2/3, 4/6 y 6/9, las miniaturas a la izquierda y el panel de diseño con fondo y capas"><figcaption>Present: una diapositiva con figura de fracciones equivalentes, las miniaturas y las capas.</figcaption></figure>
        </section>
        <section>
          <h2 id="notas">Notas del orador</h2>
          <p>Cada diapositiva tiene sus notas: el botón <b>Notas</b> de la barra de estado abre el panel, rotulado <b>Van al PPTX · no se ven al presentar</b>. Las notas viajan al PPTX exportado y no aparecen al proyectar.</p>
        </section>
        <section>
          <h2 id="inspector">Listas e imágenes desde el inspector</h2>
          <p>El formato de las listas y el ajuste de una imagen —⁠tamaño, proporción y reemplazo⁠— se resuelven en el inspector, con la diapositiva a la vista. Present comparte con Write la cinta por pestañas y su modo compacto.</p>
        </section>
        <section>
          <h2 id="limite">Lo que no hace</h2>
          <div class="notice"><strong>No importa PPTX externos</strong><p>pteron crea y exporta presentaciones, pero no abre ni convierte archivos PPTX que vengan de fuera. Tampoco usa plantillas de PowerPoint con varias zonas.</p></div>
        </section>`
    },
    "exportar": {
      eyebrow: "Materiales y formatos",
      title: "Exportar y compartir",
      lead: "Guardar produce siempre un archivo nuevo, mediante un diálogo que tú confirmas.",
      html: `
        <section>
          <h2 id="formatos">Qué formato entrega cada superficie</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Material</th><th>Acción</th><th>Resultado</th></tr></thead>
            <tbody>
              <tr><td>Documento</td><td>Archivo › Guardar en Word…</td><td>DOCX editable, con la configuración de página del material</td></tr>
              <tr><td>Documento</td><td>Archivo › Guardar en PDF…</td><td>PDF con las hojas tal como se imprimen</td></tr>
              <tr><td>Presentación</td><td>Archivo › Guardar en PowerPoint…</td><td>PPTX editable, con las notas del orador</td></tr>
              <tr><td>Presentación</td><td>Archivo › Guardar en PDF…</td><td>PDF con una diapositiva por página</td></tr>
              <tr><td>Documento o presentación</td><td>Archivo › Imprimir…</td><td>Se abre en el visor de PDF, con las mismas hojas de Guardar en PDF</td></tr>
            </tbody>
          </table></div>
          <p>El PDF se arma desde el documento y no desde la pantalla: contiene el material y nada más, sin la barra de la aplicación ni elementos de interfaz, y respeta el tamaño, la orientación y los márgenes que definiste.</p><figure class="product-shot"><img src="/assets/app/06-imprimir-version-docente-marco.webp?v=2026-10-12.8" srcset="/assets/app/06-imprimir-version-docente-marco.webp?v=2026-10-12.8 1440w, /assets/app/06-imprimir-version-docente-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Archivo › Imprimir en Write con la opción Qué hoja: Hoja del estudiante, sin respuestas, o Versión docente con respuestas, el botón Imprimir versión docente y la evaluación formativa debajo"><figcaption>Archivo › Imprimir con «Qué hoja»: la hoja del estudiante o la versión docente con respuestas.</figcaption></figure>
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
      lead: "Tus documentos quedan en tu equipo salvo que elijas un modelo en la nube: desde que lo guardas, lo que le pides y adjuntas viaja a ese proveedor.",
      html: `
        <section><h2 id="limite">Límite de acceso</h2><p>pteron trabaja dentro de la carpeta que tú eliges. No incluye terminal ni herramientas generales de programación, y la interfaz no tiene acceso directo al sistema y sólo puede hacer una lista cerrada de tareas docentes.</p></section>
        <section><h2 id="nube">Uso de nube</h2><p>Antes de usar un modelo en la nube —también la IA incluida—, pteron te pide consentimiento una vez, al guardar el proveedor, su clave o su dirección. Las búsquedas en el Currículum Nacional y en la web envían sólo el texto de la búsqueda. Las fuentes web se limitan a HTTPS, y lo que se recupera de ellas se trata como dato no confiable.</p></section>
        <section><h2 id="iphone">Acceso desde el iPhone</h2><p>Existe un acceso complementario desde el iPhone y viene <strong>apagado de fábrica</strong>. El escritorio conserva sesiones, carpeta y materiales, y el teléfono se empareja contra él. El acceso se enciende sólo desde <strong>Configuración › Labs</strong>, y ahí mismo cambias su clave o lo cortas.</p></section>
        <section><h2 id="licencia">Licencia</h2><p>El núcleo local funciona sin licencia y no requiere plan. Un plan Basic o Pro habilita la IA incluida con una licencia firmada, que se activa en <strong>Configuración › Perfil</strong> y se verifica en tu equipo.</p><p>La licencia se renueva sola mientras tu plan siga vigente: una vez al día y, cuando le quedan menos de 72 horas, cada hora, al volver de la suspensión y antes de usar la IA incluida. Si el plan termina, la licencia deja de renovarse y sigues con el núcleo local.</p></section>`
    },
    "datos-estudiantes": {
      eyebrow: "Privacidad y control",
      title: "Datos de estudiantes",
      lead: "Antes de enviar algo a un modelo en la nube, pteron avisa si encuentra un RUT o un nombre escrito en un campo como «Estudiante:», y te deja decidir cómo continuar.",
      html: `
        <section>
          <h2 id="detecta">Qué detecta exactamente</h2>
          <p>Antes de enviar algo a un proveedor que no sea local, pteron busca dos cosas concretas: un <strong>nombre declarado en un campo de persona</strong> y un <strong>RUT con formato chileno</strong>. Si encuentra alguno, detiene el envío y te muestra la elección.</p>
          <figure class="product-shot"><img src="/assets/docs/app-datos-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Aviso de datos identificables de estudiantes con las opciones Excluir fragmentos, Anonimizar y continuar, y Cancelar"><figcaption>El aviso llega antes del envío, dice qué detectó y ofrece una vista previa anonimizada.</figcaption></figure>
          <p>Tienes tres salidas: <strong>Excluir fragmentos</strong>, <strong>Anonimizar y continuar</strong> o <strong>Cancelar</strong>. La vista previa anonimizada te deja ver qué se enviaría antes de aceptar.</p>
        </section>
        <section>
          <h2 id="limite">Es una salvaguarda acotada</h2>
          <div class="notice notice-prominent"><strong>No es un clasificador de sensibilidad</strong><p>Salud, NEE/PIE, calificaciones o disciplina <b>no</b> disparan el aviso por sí solas. Son también temas del currículum, y bloquearlas interrumpía trabajo docente legítimo. El criterio sobre qué es prudente enviar sigue siendo tuyo.</p></div>
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
          <h2 id="configuracion">Dónde se configura</h2>
          <p>En <strong>Configuración › Modelo de IA</strong>. Elige entre la <strong>IA incluida</strong> de tu plan, el modelo local de <strong>En este equipo</strong> y los proveedores externos —⁠OpenAI, Anthropic, Google Gemini u otros, o un perfil personalizado⁠—. Para un proveedor externo, elígelo en la lista: a la derecha pegas su clave y pteron muestra los modelos que esa clave habilita. Nada se aplica hasta pulsar <strong>Guardar cambios</strong>.</p>
          <figure class="product-shot"><img src="/assets/app/09-modelo-de-ia-marco.webp?v=2026-10-12.8" srcset="/assets/app/09-modelo-de-ia-marco.webp?v=2026-10-12.8 1440w, /assets/app/09-modelo-de-ia-marco-2x.webp?v=2026-10-12.8 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Configuración › Modelo de IA de pteron 0.7: el selector de modelos de OpenAI con un buscador, el modelo Recomendado 0.7.0, dos Probado 0.3.0 y sus precios por millón de tokens"><figcaption>Configuración › Modelo de IA: el selector de modelos de OpenAI con «Recomendado 0.7.0» y «Probado 0.3.0».</figcaption></figure>
        </section>
        <section>
          <h2 id="local">Modelo local</h2>
          <p>La opción <strong>En este equipo</strong> usa Ollama y permite trabajar sin enviar tus documentos a ningún proveedor. Es la base disponible y no necesita clave ni licencia.</p>
        </section>
        <section>
          <h2 id="ia-incluida">IA incluida</h2>
          <p>Con un plan Basic o Pro, la IA incluida responde sin que pegues una clave: en <strong>Configuración › Modelo de IA › IA incluida</strong> eliges <strong>Usar la IA incluida</strong>, y funciona mientras tu licencia esté vigente. Responde con un modelo de Anthropic que elige y actualiza pteron.</p>
          <p>Lo que le pides —tu pedido, la conversación y lo que adjuntas— pasa por el servidor de pteron hacia Anthropic, en Estados Unidos, que genera la respuesta. pteron registra cuánto usas, no el contenido. Anthropic no entrena sus modelos con ese contenido y, por defecto, no lo guarda, salvo lo que sus sistemas de seguridad marquen. Como con cualquier modelo en la nube, pteron pide tu consentimiento al guardarla y avisa antes de enviar un dato identificable de un estudiante.</p>
          <p>Cada plan trae una cuota por período, que se renueva con tu cobro: la ves en tu <a href="/cuenta">cuenta</a>, y en <a href="/planes#ia-incluida">Planes</a> está cómo se cuenta.</p>
        </section>
        <section>
          <h2 id="claves">Tus claves</h2>
          <p>Las claves se guardan cifradas con el almacén seguro de tu sistema operativo, no en un archivo de configuración. Puedes retirarlas en cualquier momento.</p>
        </section>
        <section>
          <h2 id="autorizacion">Autorización por proveedor</h2>
          <div class="notice"><strong>Algunos niveles entrenan con lo que reciben</strong><p>Hay proveedores cuyo nivel más barato entrena con lo que se les envía. Activar el proveedor no elige ese nivel: lo eliges tú en Configuración › Modelo de IA. pteron no vuelve a preguntar en cada pedido.</p></div>
        </section>
        <section>
          <h2 id="privacidad">Dónde vive tu configuración</h2>
          <p>La pantalla de Configuración lo declara al pie: tu configuración se guarda en este dispositivo.</p>
        </section>`
    },
    "atajos": {
      eyebrow: "Ayuda",
      title: "Atajos de teclado",
      lead: "Los mismos gestos de siempre, con las etiquetas de tu sistema operativo.",
      html: `
        <section>
          <h2 id="tabla">Atajos principales</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Acción</th><th>macOS</th><th>Windows y Linux</th></tr></thead>
            <tbody>
              <tr><td>Nueva sesión</td><td><code>⌘ N</code></td><td><code>Ctrl+N</code></td></tr>
              <tr><td>Elegir carpeta de trabajo</td><td><code>⌘ O</code></td><td><code>Ctrl+O</code></td></tr>
              <tr><td>Guardar el material en pteron</td><td><code>⌘ S</code></td><td><code>Ctrl+S</code></td></tr>
              <tr><td>Imprimir el material</td><td><code>⌘ P</code></td><td><code>Ctrl+P</code></td></tr>
              <tr><td>Enviar mensaje</td><td><code>↵</code></td><td><code>Intro</code></td></tr>
              <tr><td>Salto de línea</td><td><code>⌘ ↵</code></td><td><code>Ctrl+Intro</code></td></tr>
              <tr><td>Mencionar un material</td><td><code>@</code></td><td><code>@</code></td></tr>
              <tr><td>Abrir acciones</td><td><code>/</code></td><td><code>/</code></td></tr>
            </tbody>
          </table></div>
        </section>
        <section>
          <h2 id="compositor">En el compositor</h2>
          <p>La mención <code>@</code> trae un documento de tu carpeta de trabajo por su nombre. La barra <code>/</code> abre los comandos con su pauta a la vista. Escape o un clic fuera cierran el desplegable abierto y devuelven el foco al texto.</p>
        </section>
        <section>
          <h2 id="editor">En el editor</h2>
          <p><strong>Ctrl/⌘ S</strong> guarda el material en pteron. Para tener un archivo, usa Archivo › Guardar en Word o Guardar en PDF: siempre crea uno nuevo. En Write y Present, los menús y diálogos cierran con Escape sin perder el estado del documento.</p>
        </section>`
    },
    "preguntas": {
      eyebrow: "Ayuda",
      title: "Preguntas frecuentes",
      lead: "Respuestas breves sobre instalación, archivos, planes y disponibilidad.",
      html: `
        <section><h2 id="internet">¿Necesito internet?</h2><p>No para trabajar con un modelo local. Sí para descargar actualizaciones, usar la IA incluida o usar un proveedor en la nube.</p></section>
        <section><h2 id="originales">¿pteron modifica mis originales?</h2><p>No. Cada resultado se guarda como un archivo nuevo mediante una acción que tú ejecutas. Tampoco hay guardado automático.</p></section>
        <section><h2 id="gratis">¿Seguirá siendo gratis?</h2><p>Sí. El núcleo local es gratis para siempre y no requiere plan ni licencia; los planes sólo agregan IA incluida. Ver <a href="/planes">Planes</a>.</p></section>
        <section><h2 id="ia-incluida">¿Qué es la IA incluida?</h2><p>La IA de los planes Basic y Pro: responde sin claves ni configuración técnica, con un modelo de Anthropic que elige pteron, y trae una cuota por período que se renueva con tu cobro. Lo que le pides pasa por el servidor de pteron hacia Anthropic. Ver <a href="/docs?pagina=modelos-permisos#ia-incluida">Modelos y permisos</a> y <a href="/planes#ia-incluida">Planes</a>.</p></section>
        <section><h2 id="pptx">¿Puedo abrir mis PPTX?</h2><p>No. pteron crea y exporta presentaciones en PPTX, pero no importa ni convierte archivos PPTX externos.</p></section>
        <section><h2 id="windows">¿pteron funciona en Windows?</h2><p>Sí, durante la beta en Windows 11. El instalador todavía no está firmado y SmartScreen puede pedir confirmación.</p></section>
        <section><h2 id="linux">¿Linux está disponible?</h2><p>Sí, como beta para equipos x86_64. AppImage es el formato principal y también se publican paquetes <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code>.</p></section>
        <section><h2 id="estable">¿Cuándo sale la versión estable?</h2><p>No hay fecha. Mientras tanto, todas las versiones salen en el canal beta.</p></section>`
    },
    "solucion-problemas": {
      eyebrow: "Ayuda",
      title: "Solución de problemas",
      lead: "Comprueba primero la versión, la carpeta y el estado del modelo.",
      html: `
        <section><h2 id="no-abre">pteron no abre</h2><p>Reinicia el equipo, verifica que uses una plataforma compatible y vuelve a descargar el instalador desde el sitio oficial.</p></section>
        <section><h2 id="modelo">El modelo no responde</h2><p>Abre <strong>Configuración › Modelo de IA</strong> y revisa el estado de la tarjeta. Si usas el modelo local, comprueba que Ollama esté iniciado; si usas un proveedor externo, que la clave siga siendo válida y haya conexión.</p></section>
        <section><h2 id="ia-incluida">La IA incluida no responde</h2><p>pteron te dice la causa y te ofrece seguir con el modelo local o con tu propia clave, sin cambiar de motor por su cuenta. Son tres:</p><ul><li><strong>Licencia no vigente.</strong> El plan terminó, tiene un pago pendiente o este equipo no está activado. Revisa tu plan en tu <a href="/cuenta">cuenta</a> y, si hace falta, elige «Activar este equipo» en <strong>Configuración › Perfil</strong>.</li><li><strong>Cuota del período agotada.</strong> Vuelve con tu próximo cobro; mientras tanto, sigue con el modelo local o con tu clave. En tu cuenta ves cuándo se renueva.</li><li><strong>Servicio no disponible.</strong> El servicio de la IA incluida no puede responder en este momento. Vuelve a intentarlo más tarde.</li></ul></section>
        <section><h2 id="exportar">La exportación falla</h2><p>pteron prefiere avisar antes que entregarte una copia incompleta. El mensaje indica qué parte del material no pudo convertirse; suele tratarse de una estructura no soportada.</p><figure class="product-shot"><img src="/assets/docs/app-error-exportar-0-6-0.webp" width="1760" height="1076" loading="lazy" alt="Aviso de error de exportación en pteron sobre el material abierto"><figcaption>Un fallo de exportación se declara y no deja un archivo a medias.</figcaption></figure></section>
        <section><h2 id="archivos">No aparece un archivo</h2><p>Confirma que esté dentro de la carpeta de trabajo actual y en un formato compatible. Puedes revisar o cambiar la carpeta en <strong>Configuración › Perfil</strong>.</p></section>
        <section><h2 id="actualizacion">La actualización no se aplicó</h2><p>En Windows, si el instalador silencioso queda bloqueado, pteron lo abre a la vista. Al volver a abrirse compara la versión real con la intentada y avisa si no cambió.</p></section>
        <section><h2 id="contacto">Aún necesito ayuda</h2><p>Escribe a <a href="mailto:pteron@patagua.dev">pteron@patagua.dev</a> e incluye tu sistema operativo, versión de pteron y una descripción breve. No adjuntes datos identificables de estudiantes.</p></section>`
    },
    "versiones": {
      eyebrow: "Ayuda",
      title: "Versiones y plataformas",
      lead: "pteron se distribuye sólo en beta. El canal estable llegará más adelante.",
      html: `
        <section><h2 id="actual">Versión actual</h2><div class="release-table" data-release-table><p>Cargando información de la versión…</p></div></section>
        <section><h2 id="plataformas">Estado por plataforma</h2><div class="table-wrap"><table><thead><tr><th>Plataforma</th><th>Estado</th><th>Firma</th></tr></thead><tbody><tr><td>macOS, chip M1 o posterior</td><td>Beta compatible</td><td>Firmada y notarizada</td></tr><tr><td>Windows 11</td><td>Beta compatible</td><td>Sin firma; puede mostrar avisos</td></tr><tr><td>Linux x86_64</td><td>Beta disponible</td><td>Firma GPG separada</td></tr></tbody></table></div></section>
        <section><h2 id="matriz">Por qué la web no siempre muestra la última</h2><p>Una versión pasa a ser la actual del sitio sólo cuando están todos sus archivos para las tres plataformas. Si una publicación sale sin todos sus archivos, la web conserva la anterior en vez de ofrecer descargas rotas.</p></section>
        <section><h2 id="notas">Notas de versión</h2><div data-release-notes><p>Las notas se publicarán con cada versión disponible.</p></div></section>`
    }
  }
};
