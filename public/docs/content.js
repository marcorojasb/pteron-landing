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
        ["sesiones-memoria", "Encargos y memoria"],
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
            <a href="/docs?pagina=primera-apertura"><span>2</span><strong>Recorre la primera apertura</strong><small>Un recorrido breve que no configura nada; la IA se elige aparte.</small></a>
            <a href="/docs?pagina=pantalla-inicio"><span>3</span><strong>Reconoce la pantalla</strong><small>El índice de tus encargos, el recuadro y lo último de tu carpeta.</small></a>
            <a href="/docs?pagina=crear"><span>4</span><strong>Crea tu primer material</strong><small>Del pedido a un documento editable, con un plan cuando hace falta.</small></a>
          </div>
        </section>
        <section>
          <h2 id="como-se-ve">Cómo se ve</h2>
          <p>Al abrir pteron encuentras la pantalla de inicio: el índice de tus encargos a la izquierda y, al centro, el recuadro donde escribes tu pedido y, debajo, lo último de tu carpeta. Para escribir el primer pedido no hay que configurar nada; para que pteron responda hace falta una IA, y la guía de IA te muestra los caminos.</p>
          <figure class="product-shot"><img src="/assets/app/inicio-marco.webp?v=2026-10-25.5" srcset="/assets/app/inicio-marco.webp?v=2026-10-25.5 1440w, /assets/app/inicio-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Pantalla de inicio de pteron: a la izquierda el índice, con Nuevo encargo, Biblioteca, Buscar y los encargos agrupados por curso y asignatura; al centro la marca, el recuadro «¿En qué quieres trabajar?» con Curso y Asignatura y, debajo, Lo último en tu carpeta, con cinco archivos de la carpeta"><figcaption>La pantalla de inicio: el índice a la izquierda y, al centro, el recuadro y lo último de tu carpeta.</figcaption></figure>
        </section>
        <section>
          <h2 id="que-hace">Qué hace y qué no</h2>
          <p>pteron propone un borrador; la decisión de usarlo es tuya. El material queda en un lienzo editable con sus versiones, y no se guarda ningún archivo hasta que ejecutas una acción de guardado.</p>
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
        <section><h2 id="modelo">Modelo</h2><p>Escribir, presentar y guardar funcionan sin IA. Para que pteron converse y prepare materiales hay tres caminos: la IA incluida de un plan Basic o Pro, que no pide clave; tu propia clave de un proveedor externo —⁠como OpenAI, Anthropic o Google Gemini⁠— o de un servidor propio; o un modelo en este equipo con Ollama, que se descarga aparte. Ninguno es obligatorio para instalar: lo eliges cuando haga falta, en <strong>Configuración › Modelo de IA</strong>.</p></section>
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
        <section><h2 id="primer-inicio">3. Completa el primer inicio</h2><p>macOS puede verificar la aplicación antes de abrirla por primera vez. Después, pteron abre un recorrido breve que puedes saltar. Continúa en <a href="/docs?pagina=primera-apertura">Primera apertura</a>.</p></section>`
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
        <section><h2 id="appimage">2. Abre la AppImage</h2><ol class="install-steps"><li>Marca el archivo como ejecutable desde las propiedades del archivo o con <code>chmod +x pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Abre <code>pteron-&lt;versión&gt;-x86_64.AppImage</code>.</li><li>Recorre la <a href="/docs?pagina=primera-apertura">primera apertura</a> o sáltala.</li></ol></section>
        <section><h2 id="paquetes">Instalar otro formato</h2><p>Abre el archivo <code>.deb</code> o <code>.rpm</code> con el instalador de paquetes de tu sistema. El archivo <code>.tar.gz</code> se extrae manualmente y no registra un paquete en el sistema.</p></section>
        <section><h2 id="actualizaciones">Actualizaciones</h2><p>La AppImage puede descargar y aplicar actualizaciones desde pteron con tu confirmación. Las instalaciones <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso de una versión nueva y abren la descarga para que la reemplaces manualmente.</p></section>
        <section><h2 id="firma">Verificar la firma GPG</h2><p>Descarga la firma <code>.asc</code> que acompaña a tu archivo y la <a href="/descargar/pteron-releases-public.asc" download>clave pública de pteron</a>. Su huella es:</p><pre><code>5DDC 795B EFB7 EC2F EC93 0227 EAFB 54AE A175 0DCF</code></pre><p>Muestra la huella, importa la clave y verifica, por ejemplo, la AppImage:</p><pre><code>gpg --show-keys --fingerprint pteron-releases-public.asc
gpg --import pteron-releases-public.asc
gpg --verify pteron-&lt;versión&gt;-x86_64.AppImage.asc pteron-&lt;versión&gt;-x86_64.AppImage</code></pre><p>Comprueba que GPG muestre exactamente la huella publicada antes de confiar en el archivo.</p></section>`
    },
    "primera-apertura": {
      eyebrow: "Empezar",
      title: "Primera apertura",
      lead: "Un recorrido breve te muestra cómo se trabaja. No configura nada: la IA se elige aparte, cuando hace falta.",
      html: `
        <section>
          <h2 id="recorrido">1. El recorrido</h2>
          <p>La primera vez, la marca de pteron se dibuja y <strong>Ver cómo funciona</strong> abre cuatro escenas —⁠<strong>Pedir</strong>, <strong>Decidir</strong>, <strong>Crear</strong> y <strong>Guardar</strong>⁠— y un cierre, <strong>Empezar</strong>. Avanzas con <strong>Siguiente</strong> y <strong>Atrás</strong> o con las flechas del teclado; <strong>Saltar el recorrido</strong> lleva directo al cierre.</p><figure class="product-shot"><img src="/assets/app/recorrido-marco.webp?v=2026-10-25.5" srcset="/assets/app/recorrido-marco.webp?v=2026-10-25.5 1440w, /assets/app/recorrido-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La primera apertura de pteron: la marca dibujada en azul, la firma Construido por profes, para profes., el título Prepara tus clases con tus materiales y tu criterio., una frase sobre lo que hace pteron y el botón Ver cómo funciona; arriba a la derecha, Saltar el recorrido"><figcaption>La primera apertura: la marca se dibuja y el recorrido empieza con <b>Ver cómo funciona</b>.</figcaption></figure>
          <p>El cierre, «Empieza con algo real», ofrece tres pedidos de partida: una guía, una evaluación y una planificación. Elegir uno lo deja escrito en el recuadro de la pantalla de inicio, sin enviarlo; <strong>Entrar a pteron</strong> entra con el recuadro vacío. El recorrido no vuelve a abrirse.</p><figure class="product-shot"><img src="/assets/app/recorrido-crear-marco.webp?v=2026-10-25.5" srcset="/assets/app/recorrido-crear-marco.webp?v=2026-10-25.5 1440w, /assets/app/recorrido-crear-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La escena Crear del recorrido: el título La hoja se escribe frente a ti, tres gestos —la respuesta de cada pregunta, sólo para ti; Más apoyo, Más desafío o un ajuste marcados en la hoja; y Deshacer— y, a la derecha, una réplica del margen con Deshacer y Ajustar y de la hoja de fracciones equivalentes con un ejemplo nuevo marcado y el panel Respuesta · sólo para ti"><figcaption>Cada escena del recorrido tiene una réplica de la app que se anima una vez.</figcaption></figure>
        </section>
        <section>
          <h2 id="modelo">2. Elige quién prepara el material</h2>
          <p>pteron es gratis: escribir, presentar, ordenar tu biblioteca y guardar en Word o PDF funcionan con o sin IA. La IA es la que conversa contigo y prepara los materiales. Si al entrar ninguna IA responde, se abre la <strong>guía de IA</strong>:</p>
          <ul>
            <li><strong>IA incluida en pteron</strong>: sin claves ni instalaciones, con el plan Basic —⁠<strong>Probar 7 días gratis</strong>⁠— o Pro. Lo que pides va a Anthropic, en Estados Unidos, por el servidor de pteron.</li>
            <li><strong>Con tu clave</strong>: si ya pagas un proveedor como Anthropic, OpenAI o Google.</li>
            <li><strong>En este equipo</strong>: gratis y sin enviar nada, con un modelo que se descarga e instala aparte.</li>
          </ul>
          <p>Las dos últimas se configuran a mano: <strong>Configurar en Modelo de IA</strong> te lleva a <strong>Configuración › Modelo de IA</strong>. <strong>Ahora no</strong> cierra la guía; mientras la IA no responda, vuelves a ella desde el aviso <strong>La IA no responde</strong>, al pie del índice. Ver <a href="/docs?pagina=modelos-permisos">Modelos y permisos</a>.</p><figure class="product-shot"><img src="/assets/app/guia-ia-marco.webp?v=2026-10-25.5" srcset="/assets/app/guia-ia-marco.webp?v=2026-10-25.5 1440w, /assets/app/guia-ia-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La guía de IA sobre la pantalla de inicio: La IA que conversa y crea contigo; pteron es gratis y lo seguirá siendo; el bloque IA incluida en pteron, con Basic y Probar 7 días gratis y Pro con Elegir Pro; y Otras formas, para configurar a mano: Con tu clave y En este equipo; al pie, Configurar en Modelo de IA y Ahora no"><figcaption>La guía de IA se abre cuando ninguna IA responde.</figcaption></figure>
        </section>
        <section>
          <h2 id="carpeta">3. Tu carpeta de trabajo</h2>
          <p>pteron crea una carpeta «pteron» dentro de Documentos y trabaja ahí. Todo lo que lea, indexe o cree ocurre dentro de ese límite, y no se sobrescribe ningún original. Puedes elegir otra en <strong>Configuración › Perfil</strong>.</p>
        </section>
        <section>
          <h2 id="primera-sesion">4. Escribe tu primer pedido</h2>
          <p>En la pantalla de inicio, describe con tus palabras lo que necesitas, o envía el pedido de partida que elegiste. Si el pedido lo amerita, pteron te propone antes un plan que puedes ajustar; si es directo, va directo al material. Continúa en <a href="/docs?pagina=pantalla-inicio">La pantalla de inicio</a>.</p>
        </section>`
    },
    "actualizar": {
      eyebrow: "Empezar",
      title: "Actualizar pteron",
      lead: "La aplicación avisa cuando hay una versión nueva.",
      html: `
        <section><h2 id="canal-beta">Canal beta</h2><p>La beta pública es gratuita. Por ahora todas las versiones salen en el canal beta, con correcciones y cambios frecuentes.</p></section>
        <section><h2 id="instalacion">Cómo se aplica</h2><p>En macOS, Windows y AppImage para Linux, pteron descarga la actualización y pide tu consentimiento antes de instalarla al reiniciar. Las instalaciones Linux <code>.deb</code>, <code>.rpm</code> y <code>.tar.gz</code> muestran el aviso y abren la descarga para una actualización manual.</p><p>La búsqueda automática de versiones nuevas se apaga en <strong>Configuración › Sobre pteron</strong>, con <strong>Buscar versiones nuevas</strong>.</p></section>
        <section><h2 id="windows">Windows sin firma</h2><div class="notice"><strong>Limitación conocida</strong><p>En macOS la firma se valida antes de instalar. En Windows todavía no, y la aplicación lo declara. El estado de firma se informa por plataforma.</p></div></section>`
    },
    "pantalla-inicio": {
      eyebrow: "Conocer la aplicación",
      title: "La pantalla de inicio",
      lead: "Una sola pantalla de partida: el índice a la izquierda y, al centro, el recuadro para tu pedido y lo último de tu carpeta.",
      html: `
        <section>
          <h2 id="recuadro">El recuadro</h2>
          <p>Escribe con tus palabras lo que necesitas; vacío, el recuadro pregunta «¿En qué quieres trabajar?». Su barra es la fila del pedido: el clip para adjuntar, los materiales adjuntos, <strong>Curso</strong> y <strong>Asignatura</strong> y, cuando ambos están elegidos, el <strong>OA</strong>. La mención <code>@</code> trae un documento de tu carpeta por su nombre y la barra <code>/</code> abre los comandos docentes.</p>
        </section>
        <section>
          <h2 id="contexto">Lo que pteron lee en tu pedido</h2>
          <p>Tras una pausa al escribir, pteron lee tu pedido y lo ofrece como una frase subrayada al final de la fila: tipo de material, curso, asignatura, tema y duración. Cada pieza entra con un clic; todas, con <strong>Agregar todo</strong> o con Tab, y Escape la descarta. La lectura ocurre en tu equipo, sin IA, y no decide por ti: lo que confirmas queda en la fila como contexto del pedido. <strong>Limpiar</strong> quita lo que describe el pedido y conserva los materiales adjuntos.</p>
          <figure class="product-shot"><img src="/assets/app/inicio-pedido-marco.webp?v=2026-10-25.5" srcset="/assets/app/inicio-pedido-marco.webp?v=2026-10-25.5 1440w, /assets/app/inicio-pedido-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Pantalla de inicio con el pedido «Quiero una guía de fracciones equivalentes para 6° básico de matemática, unos 45 minutos» escrito en el recuadro; en su barra, la frase leída Guía · 6° básico · Matemática · fracciones equivalentes · 45 minutos, subrayada, y Agregar todo"><figcaption>pteron lee tu pedido en una frase: cada pieza entra con un clic, y todas con <b>Agregar todo</b> o con Tab.</figcaption></figure>
        </section>
        <section>
          <h2 id="carpeta">Lo último en tu carpeta</h2>
          <p>Bajo el recuadro, pteron muestra hasta cinco archivos de tu carpeta, del último modificado hacia atrás, con la subcarpeta donde viven y el día. Un clic suma el archivo al pedido; quitarlo del recuadro lo devuelve a la lista. Con un material en el pedido, el recuadro pregunta «¿Qué hacemos con este material?».</p>
          <figure class="product-shot"><img src="/assets/app/inicio-oa-marco.webp?v=2026-10-25.5" srcset="/assets/app/inicio-oa-marco.webp?v=2026-10-25.5 1440w, /assets/app/inicio-oa-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Pantalla de inicio con un pedido armado a mano: el recuadro pregunta «¿Qué hacemos con este material?» y en su barra están el apunte Fracciones equivalentes adjunto, 6° básico, Matemática, el OA con 44 para elegir y Limpiar; debajo, Lo último en tu carpeta"><figcaption>Con un archivo de tu carpeta en el pedido y el curso y la asignatura elegidos, el OA queda a mano.</figcaption></figure>
        </section>
        <section>
          <h2 id="compositor">Conversar por voz y las propuestas</h2>
          <p>Cuando la voz puede funcionar, bajo el recuadro aparece <strong>Conversar por voz</strong>, para pensar en voz alta una clase o un desafío; la voz se configura en <strong>Configuración › Labs</strong>. Si activas <strong>Sugerir próximos pasos</strong> en Labs, en ese mismo renglón puede aparecer una propuesta con su procedencia —⁠por ejemplo <b>por tu memoria</b> o <b>por tu contexto</b>⁠— y las acciones <strong>Empezar</strong> y <strong>Ahora no</strong>: es un atajo, no una orden.</p>
        </section>
        <section>
          <h2 id="barra">El índice</h2>
          <p>A la izquierda, el índice reúne tus encargos. Arriba están <strong>Nuevo encargo</strong> (Ctrl/⌘ N), <strong>Biblioteca</strong> y <strong>Buscar</strong> (Ctrl/⌘ K), que encuentra un encargo por título, curso o material. Debajo, los encargos se agrupan por curso y asignatura, en el orden del currículum; los que no tienen curso van en <strong>Sin curso</strong>, y los archivados, en <strong>Archivados</strong>. Cada encargo es un renglón con su título: al pasar el puntero aparece su día y, en su ayuda, lo que produjo —⁠por ejemplo «Guía · Pauta»⁠—. Si hay algo que decir, su estado va debajo, en palabras: «Trabajando…» o «Falta 1 decisión».</p>
          <p>Al pie, en un solo renglón, tu carpeta de trabajo y, como iconos, la IA que responde y <strong>Configuración</strong> (Ctrl/⌘ ,). Si la IA no responde, su icono pasa a ser un aviso, <strong>La IA no responde</strong>, y su ayuda dice la causa. Ctrl/⌘ \\ pliega el índice; en los editores y en ventanas de menos de 1200 px se pliega solo y queda una tira con iconos y las iniciales de cada encargo.</p>
        </section>
        <section>
          <h2 id="espacios">Lo que se abre desde el índice</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Lugar</th><th>Qué hay ahí</th></tr></thead>
            <tbody>
              <tr><td><strong>Un encargo</strong></td><td>Su conversación y sus materiales: donde pides, revisas y decides.</td></tr>
              <tr><td><strong>Biblioteca</strong></td><td>Tus materiales y los archivos de tu carpeta, abiertos en su visor o editor.</td></tr>
              <tr><td><strong>Planificador</strong></td><td>Apagado de fábrica. Si lo activas en Configuración › Labs, aparece en el índice: tu horario semanal, con las unidades de cada curso en el tiempo.</td></tr>
              <tr><td><strong>Configuración</strong></td><td>Perfil, Modelo de IA, Memoria y contexto, Complementos, Labs y Sobre pteron. Cada cambio se aplica al instante y se puede deshacer.</td></tr>
            </tbody>
          </table></div>
        </section>
        <section>
          <h2 id="apariencia">Tema claro u oscuro</h2>
          <p>De fábrica, pteron sigue el tema del sistema. En <strong>Configuración › Perfil</strong> eliges <strong>Claro</strong>, <strong>Oscuro</strong> o <strong>Automático</strong>, y la preferencia se conserva al volver a abrir la aplicación.</p>
        </section>`
    },
    "sesiones-memoria": {
      eyebrow: "Conocer la aplicación",
      title: "Encargos y memoria",
      lead: "Un encargo reúne una conversación, sus fuentes y el material que produjo. La memoria es lo que pteron conserva entre encargos.",
      html: `
        <section>
          <h2 id="sesiones">Encargos en el índice</h2>
          <p>Cada trabajo es un encargo, con un nombre tomado de lo que estás haciendo. El índice, a la izquierda, los agrupa por curso y asignatura, y puedes moverte entre ellos sin perder el estado de ninguno: cada uno conserva su conversación, su contexto y su material.</p>
          <figure class="product-shot"><img src="/assets/app/encargo-marco.webp?v=2026-10-25.5" srcset="/assets/app/encargo-marco.webp?v=2026-10-25.5 1440w, /assets/app/encargo-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Un encargo abierto: en el índice, Fracciones equivalentes en el grupo 6° básico · Matemática; al centro, el pedido de la profesora con su hora, la respuesta de pteron y las tarjetas de la guía, la pauta docente y la presentación, cada una con Versiones y Abrir en editor; al pie de la respuesta, Copiar y Nuevo chat desde aquí"><figcaption>Cada encargo vive en el índice bajo su curso y asignatura, con su conversación y lo que produjo.</figcaption></figure>
          <p>Empieza uno con <strong>Nuevo encargo</strong> cuando cambie el objetivo. <strong>Archivar</strong> lo lleva a <strong>Archivados</strong>, al final del índice, desde donde lo restauras; eliminarlo es una acción distinta, permanente y sólo desde ahí.</p>
          <div class="notice"><strong>Continuidad de 30 minutos</strong><p>Si vuelves a abrir pteron dentro de los 30 minutos siguientes, retoma el encargo donde estabas. Pasado ese plazo, abre la pantalla de inicio; tus encargos siguen en el índice.</p></div>
        </section>
        <section>
          <h2 id="nuevo-chat">Probar otro camino</h2>
          <p>Cada respuesta de pteron y cada pedido tuyo traen <strong>Copiar</strong> y <strong>Nuevo chat desde aquí</strong>. Nuevo chat desde aquí abre un encargo nuevo —⁠«Copia de …»⁠— en el mismo curso, con la conversación hasta ese punto; desde un pedido, deja su texto en el recuadro para que lo cambies y lo envíes. El original no cambia, nada se envía a la IA y los materiales siguen en el encargo original.</p>
        </section>
        <section>
          <h2 id="memoria">Memoria y contexto</h2>
          <p>La memoria guarda preferencias que tú aceptas conservar —⁠cómo te gusta que se redacten las instrucciones, qué formato usas, qué cursos atiendes⁠— para no repetirlas en cada pedido. Cuando una sugerencia proviene de ahí, aparece rotulada <b>por tu memoria</b>.</p>
          <figure class="product-shot"><img src="/assets/app/memoria-marco.webp?v=2026-10-25.5" srcset="/assets/app/memoria-marco.webp?v=2026-10-25.5 1440w, /assets/app/memoria-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Configuración › Memoria y contexto: Usar la memoria encendido y Agregar recuerdo; en General, un recuerdo propuesto por pteron con Confirmar y Descartar y dos añadidos por ti; en Este encargo, dos más, cada uno con su interruptor; abajo, Pautas de los comandos"><figcaption>Configuración › Memoria y contexto: lo que pteron recuerda, en general y en este encargo, a la vista y retirable.</figcaption></figure>
          <p>Todo lo guardado se revisa y se retira desde <strong>Configuración › Memoria y contexto</strong>: <strong>Usar la memoria</strong> la enciende o la pausa, cada recuerdo vale en <strong>General</strong> o en <strong>Este encargo</strong>, y borrar uno se puede deshacer. La memoria no incluye tus materiales ni el contenido de tus encargos.</p>
        </section>`
    },
    "carpeta-trabajo": {
      eyebrow: "Conocer la aplicación",
      title: "Carpeta de trabajo",
      lead: "Es el límite visible dentro del cual pteron puede leer y crear archivos.",
      html: `
        <section><h2 id="por-que">Por qué existe</h2><p>pteron no tiene acceso general a tu equipo. Al abrirse por primera vez crea una carpeta «pteron» dentro de Documentos, tú puedes elegir otra, y todo lo que indexe, busque o lea ocurre dentro de ella. Se cambia desde <strong>Configuración › Perfil</strong>, y su nombre queda a la vista al pie del índice.</p></section>
        <section><h2 id="originales">Tus originales</h2><p>La aplicación no sobrescribe los archivos de origen. Cada resultado se guarda como una copia nueva mediante una acción visible que tú ejecutas: no hay guardado automático sobre tus documentos.</p></section>
        <section><h2 id="indice">Búsqueda dentro de la carpeta</h2><p>pteron mantiene un índice de búsqueda local del contenido para poder encontrar y citar tus materiales. Ese índice vive en tu equipo junto con los encargos, y en cada pedido lee una cantidad limitada de texto.</p></section>
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
            <li>El clip del recuadro adjunta materiales de tu carpeta de trabajo.</li>
            <li>Una mención <code>@</code> trae un archivo de tu carpeta de trabajo por su nombre.</li>
            <li>En la Biblioteca, <strong>Adjuntar a la conversación</strong> suma el documento elegido como una etiqueta que puedes retirar.</li>
            <li>Un PDF abierto junto al material se adjunta con <strong>Adjuntar a la conversación</strong>, o cita lo que lees con <strong>Citar página</strong> o <strong>Citar selección</strong>.</li>
          </ul>
          <p>pteron distingue las fuentes locales de las externas y las deja inspeccionables junto al resultado: al pie de la respuesta, una fuente se nombra y varias se cuentan —⁠«10 fuentes»⁠— en una pieza que despliega la lista. El contenido recuperado desde la web se trata como dato no confiable, y si un documento trae texto dirigido al asistente, pteron te avisa y lo trata como contenido, no como una instrucción.</p>
        </section>
        <section>
          <h2 id="acciones">Qué puedes hacer con una respuesta</h2>
          <p>Al pie de cada respuesta, <strong>Copiar</strong> la lleva al portapapeles y <strong>Nuevo chat desde aquí</strong> abre un encargo nuevo con la conversación hasta ese punto, para probar otro camino sin perder el original. Si de una respuesta quieres un material, pídelo en el recuadro.</p>
          <figure class="product-shot"><img src="/assets/app/conversacion-marco.webp?v=2026-10-25.5" srcset="/assets/app/conversacion-marco.webp?v=2026-10-25.5 1440w, /assets/app/conversacion-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Una conversación en pteron: la respuesta en texto corrido sobre cómo distinguir una pregunta que mide comprensión de una que mide memoria; el siguiente pedido de la profesora, con Copiar, Nuevo chat desde aquí y su hora; y la respuesta de pteron con las mismas acciones al pie"><figcaption>Cada respuesta y cada pedido traen <b>Copiar</b> y <b>Nuevo chat desde aquí</b>.</figcaption></figure>
        </section>
        <section>
          <h2 id="contexto">Qué conviene incluir</h2>
          <p>Curso, objetivo, duración, formato esperado y cualquier condición que cambie el resultado. La fila del pedido cubre curso, asignatura y OA; el resto va en tus palabras.</p>
          <blockquote>«Crea una guía de 45 minutos para 7° básico. Usa el documento adjunto como única fuente y deja una sección final de reflexión.»</blockquote>
        </section>`
    },
    "biblioteca": {
      eyebrow: "Conocer la aplicación",
      title: "Abrir un recurso",
      lead: "Todo lo que pteron ha creado y todo lo que hay en tu carpeta se abre desde un mismo lugar.",
      html: `
        <section>
          <h2 id="abrir">La Biblioteca</h2>
          <p>Arriba están el buscador, por nombre, y <strong>Agregar</strong>. Debajo, el origen —⁠<b>Todos los materiales</b>, <b>Mi carpeta</b> y <b>Creados en pteron</b>, y <b>Begonia Next</b> si activas el complemento⁠— y <b>Tipo</b>, que dice cuántos hay de cada tipo. Cada renglón dice qué es, con el icono de su tipo, cómo se llama, de dónde viene —⁠«Mi carpeta · Evaluaciones», «pteron · 6° básico · Matemática»⁠— y el día. La lista parte por lo más reciente y también se ve en cuadrícula.</p>
          <figure class="product-shot"><img src="/assets/app/biblioteca-marco.webp?v=2026-10-25.5" srcset="/assets/app/biblioteca-marco.webp?v=2026-10-25.5 1440w, /assets/app/biblioteca-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La Biblioteca de pteron: arriba, Buscar por nombre y Agregar; Todos los materiales, Mi carpeta, Creados en pteron y Tipo; la lista con los materiales creados en pteron y los archivos de la carpeta, cada uno con su origen y su día; a la derecha, el detalle de una guía con su primera página, Abrir en editor, Hacer la pauta y Ajustar"><figcaption>La Biblioteca reúne lo que creaste en pteron y los archivos de tu carpeta; a la derecha, el detalle del elegido.</figcaption></figure>
        </section>
        <section>
          <h2 id="recorrido">El detalle</h2>
          <p>Al elegir un renglón, el detalle dice qué es, de dónde viene y cuándo cambió, muestra la primera página de un material de pteron y ofrece una acción principal: <b>Abrir en editor</b>, <b>Leer y citar</b> en un PDF o <b>Abrir con la aplicación del sistema</b>. Debajo va lo que sirve a ese tipo: una guía o prueba abre o hace su pauta, sin IA, y se ajusta con <b>Ajustar</b>, el mismo menú del margen; un archivo de tu carpeta se adjunta con <b>Adjuntar a la conversación</b> o empieza un material con <b>Crear un material a partir de este</b>. Nada se envía solo: el pedido lo envías tú.</p>
        </section>
        <section>
          <h2 id="volver">Volver a un material</h2>
          <p>Al abrir algo creado por pteron vuelves a su encargo: el material se abre en su editor, con su conversación en el margen y sus versiones intactas, para seguir revisándolo o guardarlo. Un DOCX de tu carpeta se abre en Write como material nuevo, sin tocar el original; un PDF se abre para leerlo y citarlo, y <strong>Anotar</strong> lo lleva a la revisión con marcas.</p>
        </section>
        <section>
          <h2 id="dispositivo">Traer un archivo de fuera</h2>
          <p><strong>Agregar › Traer archivo…</strong> incorpora un documento que no está en la carpeta de trabajo. Se copia a tu carpeta; el original no se mueve ni se modifica. En el mismo menú creas una carpeta nueva y traes el formato de tu colegio, en <strong>Plantillas institucionales</strong>: ver <a href="/docs?pagina=formatos-guia#colegio">Formatos de guía</a>.</p>
        </section>
        <section>
          <h2 id="complementos">Fuentes fuera de tu carpeta</h2>
          <p>En <strong>Configuración › Complementos</strong> ves las fuentes que pteron puede consultar. El Currículum Nacional es la base de OA que trae pteron y no usa internet. La búsqueda web viene apagada y, si la enciendes, envía sólo el texto de la búsqueda. El correo lee archivos .eml de una carpeta que eliges, sin conexión. Begonia Next, un banco de recursos pedagógicos, se activa sólo si tú lo decides y por ahora requiere un acceso aparte. Lo que traen se distingue de tus fuentes locales y queda a la vista junto al resultado.</p>
        </section>`
    },
    "planificar": {
      eyebrow: "Trabajar con pteron",
      title: "Planificar",
      lead: "Para organizar clases y unidades, con momentos y duración que cuadren.",
      html: `
        <section>
          <h2 id="dos-cosas">Dos cosas distintas con el mismo nombre</h2>
          <p>Pedir una planificación en el recuadro produce un material revisable, y es lo que describe esta página. El <strong>Planificador</strong> es otra superficie: tu horario semanal, con las unidades de cada curso en el tiempo. Viene apagado; se activa en <strong>Configuración › Labs</strong> y entonces aparece en el índice.</p>
        </section>
        <section>
          <h2 id="pedido">Qué entregar en el pedido</h2>
          <p>Escribe lo que importa: curso, asignatura, tema u OA, cuántas clases y de cuánto, los recursos disponibles y cómo quieres cerrar. pteron lee en una frase lo que reconoce —⁠el tipo de material, el curso, la asignatura, el tema y la duración⁠— y lo agregas con Tab.</p>
          <blockquote>«Planifica una unidad de cuatro clases de 45 minutos sobre fracciones equivalentes. El curso tiene proyector pero no tablets. Cierra cada clase con una salida escrita breve.»</blockquote><figure class="product-shot"><img src="/assets/app/inicio-planificar-marco.webp?v=2026-10-25.5" srcset="/assets/app/inicio-planificar-marco.webp?v=2026-10-25.5 1440w, /assets/app/inicio-planificar-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Un pedido de planificación en la pantalla de inicio: «Una planificación de cuatro clases de 45 minutos sobre el ciclo del agua para 4° básico, Ciencias Naturales»; en la barra, la frase leída Planificación · 4° básico · Ciencias Naturales · ciclo del agua · 4 clases de 45 minutos, con Agregar todo y la tecla Tab"><figcaption>pteron lee el material, el curso, la asignatura, el tema y la duración; Tab los agrega todos.</figcaption></figure>
        </section>
        <section>
          <h2 id="verificacion">Lo que pteron no decide por ti</h2>
          <p>pteron no rechaza una planificación por su contenido: si los momentos no suman la duración que pediste, te la entrega igual y te avisa, sin gastar IA, que los minutos no cuadran, para que la corrijas.</p>
        </section>
        <section>
          <h2 id="revisar">Qué revisar tú</h2>
          <p>Lo que ninguna comprobación automática puede juzgar: si la progresión tiene sentido para tu curso, si los tiempos son realistas y si las oportunidades de participación son reales y no decorativas.</p>
        </section>`
    },
    "crear": {
      eyebrow: "Trabajar con pteron",
      title: "Crear",
      lead: "Para producir material listo para usar. Si el pedido lo amerita, antes llega un plan que puedes cambiar.",
      html: `
        <section>
          <h2 id="pedido">1. Haz el pedido</h2>
          <p>Describe el material en el recuadro y confirma lo que pteron leyó de tu pedido. Si tienes una guía anterior con el formato que usas, adjúntala: pteron toma de ahí el encabezado y la forma de los ítems en vez de inventar una tercera.</p>
        </section>
        <section>
          <h2 id="plan">2. Revisa el plan</h2>
          <p>Cuando el pedido lo amerita, pteron responde primero con un <strong>plan de trabajo</strong> en vez de un borrador. El plan declara qué va a producir, qué decidió por su cuenta y qué preguntas te hizo.</p>
          <figure class="product-shot"><img src="/assets/app/plan-decision-marco.webp?v=2026-10-25.5" srcset="/assets/app/plan-decision-marco.webp?v=2026-10-25.5 1440w, /assets/app/plan-decision-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Un plan de trabajo por acordar: la tarjeta Guía de práctica de fracciones · 6° básico con su propósito, la decisión pendiente ¿Qué énfasis conviene para la práctica? con Respóndela en el recuadro de abajo, el contexto acordado y el resultado previsto; abajo, en el recuadro, las tres alternativas, la primera marcada como Sugerida; en el índice, el encargo dice Falta 1 decisión"><figcaption>El plan pregunta lo que falta en el recuadro, con la alternativa sugerida primero.</figcaption></figure>
          <p>Fíjate en <strong>Supuestos que puedes cambiar</strong>: ahí está lo que pteron decidió sin preguntarte. Corrígelo escribiendo en el recuadro antes de seguir; sale más barato que rehacer el material. Si falta una decisión, la respondes en la tarjeta o en el recuadro. Cuando estés conforme, pulsa <strong>Crear la guía</strong>.</p><figure class="product-shot"><img src="/assets/app/plan-listo-marco.webp?v=2026-10-25.5" srcset="/assets/app/plan-listo-marco.webp?v=2026-10-25.5 1440w, /assets/app/plan-listo-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="El mismo plan, Listo: la decisión respondida con Representación y aplicación, el contexto acordado, el resultado previsto, Supuestos que puedes cambiar abierto y el botón Crear la guía"><figcaption>Con todo decidido, el plan queda Listo: revisa los supuestos y pulsa Crear la guía.</figcaption></figure>
          <div class="notice"><strong>El plan es opcional</strong><p>Aparece sólo cuando aporta al pedido. Si pides algo directo, pteron va directo al material.</p></div>
        </section>
        <section>
          <h2 id="avance">3. Mira cómo avanza</h2>
          <p>Mientras pteron trabaja, la conversación lo muestra: una guía se ve armarse como hoja y, al pie, la <strong>tarjeta de la corrida</strong> dice lo que pasa ahora —⁠«Escribiendo «Guía de fracciones equivalentes»»⁠— con el reloj del turno y, debajo, cada paso en el orden en que ocurrió, con lo que tardó: leyó tu petición, pensó, buscó en tu carpeta, leyó un documento. Tres puntos azules acompañan la frase y se mueven distinto cuando pteron piensa, trabaja o espera; nunca son un porcentaje. <strong>Detalles</strong> despliega el registro técnico.</p>
          <figure class="product-shot"><img src="/assets/app/corrida-marco.webp?v=2026-10-25.5" srcset="/assets/app/corrida-marco.webp?v=2026-10-25.5 1440w, /assets/app/corrida-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Una respuesta en curso: la guía se arma como hoja, con sus dos primeras preguntas, y al pie la tarjeta de la corrida con tres puntos azules, Escribiendo «Guía de fracciones equivalentes» y el reloj del turno; debajo, Leyó tu petición, Pensó, Buscó en tu carpeta «fracciones equivalentes», Leyó «Material de referencia.pdf» y Escribiendo «Guía de fracciones equivalentes» · 2 preguntas, cada uno con lo que tardó, y Detalles; en el índice, el encargo dice Trabajando…"><figcaption>La tarjeta de la corrida: lo que pasa ahora, el reloj del turno y cada paso con lo que tardó.</figcaption></figure>
          <p>Al terminar, la hoja pasa a ser la tarjeta del material y el pie dice cuánto tardó —⁠«Listo en 22 s»⁠— y lo que dejó. Si la respuesta falla o la detienes, lo que alcanzó a escribirse queda a la vista: ver <a href="/docs?pagina=solucion-problemas#corte">Solución de problemas</a>.</p>
        </section>
        <section>
          <h2 id="material">4. Recibe el material</h2>
          <p>El resultado es un documento editable, no texto dentro del chat. Con <strong>Abrir en editor</strong>, la hoja ocupa la mesa y la conversación pasa a un margen a su izquierda, con las tarjetas de los materiales del encargo y, cuando las hay, las <strong>Versiones</strong> y las fuentes. Lo pedagógico del material —⁠curso, asignatura, objetivo, propósito, tiempo y puntaje⁠— está en la hoja y se edita ahí. Al pie del margen, <strong>Ajustar</strong> reúne lo que puedes pedir sobre la guía: <strong>Pedir un ajuste</strong>, <strong>Variante DUA</strong>, <strong>Más desafío</strong> y <strong>Más apoyo</strong>. Si pliegas el margen, <strong>Conversación</strong>, arriba, lo vuelve a abrir.</p>
          <p>Sigue en <a href="/docs?pagina=artefactos">Documentos</a> y en <a href="/docs?pagina=revisar-exportar">Revisar y guardar</a>.</p><figure class="product-shot"><img src="/assets/app/write-ajustar-marco.webp?v=2026-10-25.5" srcset="/assets/app/write-ajustar-marco.webp?v=2026-10-25.5 1440w, /assets/app/write-ajustar-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Una guía de práctica abierta en Write: a la izquierda el margen del encargo con la conversación, las tarjetas de sus materiales y el menú Ajustar abierto, con Pedir un ajuste, Variante DUA, Más desafío y Más apoyo, cada uno con lo que hace; al centro la hoja; a la derecha la Estructura con el puntaje de cada pregunta"><figcaption>Con la guía abierta, el margen guarda la conversación del encargo, y <b>Ajustar</b> reúne lo que puedes pedir sobre la guía.</figcaption></figure>
        </section>`
    },
    "evaluar": {
      eyebrow: "Trabajar con pteron",
      title: "Evaluar",
      lead: "Para comprobar y analizar aprendizajes: evaluaciones, pautas y rúbricas.",
      html: `
        <section>
          <h2 id="pedido">Delimita el alcance</h2>
          <p>Adjunta las fuentes que deben cubrirse e indica nivel, duración y puntaje total. Si el material es una rúbrica, describe la tarea y las evidencias observables antes de pedir niveles.</p>
        </section>
        <section>
          <h2 id="rechaza">Lo que pteron arregla solo</h2>
          <p>pteron sólo detiene lo que no se puede imprimir: un material vacío, una selección múltiple sin alternativas o una figura que no se puede dibujar. Cada pregunta es un ítem: se numera 1, 2, 3 en toda la hoja, y lo que se responde bajo su consigna —⁠una afirmación de verdadero o falso, una premisa de términos pareados, una parte⁠— es un inciso a), b), c). El número, la letra, el puntaje de cada inciso y el total se calculan solos al editar, y al cerrar el turno pteron avisa, sin gastar IA, si los puntos de un criterio no dan el puntaje. Si hay una sola alternativa correcta y si la rúbrica tiene criterios útiles lo revisas tú.</p>
        </section>
        <section>
          <h2 id="sugerencias">Lo que cambia, lo pides tú</h2>
          <p>pteron no cambia el contenido de la evaluación sin un pedido tuyo. En el margen, <strong>Ajustar</strong> pide un ajuste, más desafío o más apoyo sobre la hoja abierta, y <strong>Deshacer</strong> vuelve a la versión anterior. Cada pregunta guarda su respuesta y su criterio en el panel <b>Respuesta · sólo para ti</b>; si faltan, <b>Archivo › Pauta docente › Completar con pteron</b> las completa sin cambiar las preguntas.</p>
          <figure class="product-shot"><img src="/assets/app/write-respuesta-marco.webp?v=2026-10-25.5" srcset="/assets/app/write-respuesta-marco.webp?v=2026-10-25.5 1440w, /assets/app/write-respuesta-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Vista › Mostrar respuestas en Write: bajo una pregunta de selección múltiple, el panel Respuesta · sólo para ti con la alternativa correcta marcada y la retroalimentación de cada alternativa, con Agregar justificación y Agregar criterio; en el margen, la conversación del encargo y las tarjetas de sus materiales"><figcaption>Con <b>Mostrar respuestas</b>, bajo cada pregunta aparece «Respuesta · sólo para ti», con la alternativa correcta y su retroalimentación.</figcaption></figure>
        </section>
        <section>
          <h2 id="datos">No uses datos reales</h2>
          <p>No incluyas nombres ni RUT de estudiantes para producir ejemplos. Ver <a href="/docs?pagina=datos-estudiantes">Datos de estudiantes</a>.</p>
        </section>`
    },
    "adaptar": {
      eyebrow: "Trabajar con pteron",
      title: "Adaptar",
      lead: "Para ajustar a tu curso un material que ya existe.",
      html: `
        <section>
          <h2 id="partir">Parte de un documento</h2>
          <p>Trae el material con una mención <code>@</code>, desde la <a href="/docs?pagina=biblioteca">Biblioteca</a> o adjuntándolo con el clip del recuadro. Después indica qué debe cambiar: el nivel, la extensión, el formato, el vocabulario o el tipo de actividad. Con un material de pteron abierto, <strong>Ajustar</strong>, en el margen, ofrece una <strong>Variante DUA</strong>, <strong>Más desafío</strong>, <strong>Más apoyo</strong> o el cambio que escribas.</p>
          <blockquote>«Adapta esta guía de 8° para un 6° básico. Mantén los mismos contenidos, reduce a cuatro preguntas y agrega un ejemplo resuelto antes de la primera.»</blockquote>
        </section>
        <section>
          <h2 id="referencia">Trabajar con el original a la vista</h2>
          <p>Un PDF de tu carpeta se abre junto al material, con su propio paginador y zoom. Su texto es seleccionable: <strong>Citar página</strong> o <strong>Citar selección</strong> llevan lo que lees a la conversación, y <strong>Adjuntar a la conversación</strong> lo adjunta al contexto como una etiqueta visible que puedes retirar.</p>
          <figure class="product-shot"><img src="/assets/app/referencia-marco.webp?v=2026-10-25.5" srcset="/assets/app/referencia-marco.webp?v=2026-10-25.5 1440w, /assets/app/referencia-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Vista doble: a la izquierda la guía en Write con su estructura; a la derecha un apunte en PDF de la carpeta, Apunte - Fracciones equivalentes, abierto para leer y citar, con Anotar arriba y, abajo, Adjuntar a la conversación y Resumir"><figcaption>El material y un PDF de tu carpeta, uno junto al otro. Adjuntar no envía nada: el pedido lo escribes tú.</figcaption></figure>
          <div class="notice"><strong>Más espacio para la hoja</strong><p>Con un PDF junto al material, la conversación parte plegada. <strong>Conversación</strong>, arriba, la vuelve a abrir.</p></div>
        </section>`
    },
    "revisar-exportar": {
      eyebrow: "Trabajar con pteron",
      title: "Revisar y guardar",
      lead: "El material es un borrador hasta que tú decides usarlo. Cada cambio que pides se puede deshacer.",
      html: `
        <section>
          <h2 id="propuesta">Cómo se aplica un cambio</h2>
          <p>Pides un cambio en el margen, con <strong>Ajustar</strong> —⁠<strong>Pedir un ajuste</strong>, <strong>Variante DUA</strong>, <strong>Más desafío</strong> o <strong>Más apoyo</strong>⁠—, o escribiéndolo en el recuadro. Antes de enviarlo, pteron guarda lo que estabas editando, para partir de tu última versión. El cambio se aplica en la misma hoja, y lo que cambió queda marcado un momento.</p>
          <figure class="product-shot"><img src="/assets/app/cambio-aplicado-marco.webp?v=2026-10-25.5" srcset="/assets/app/cambio-aplicado-marco.webp?v=2026-10-25.5 1440w, /assets/app/cambio-aplicado-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Un ajuste aplicado: en el margen, Versiones (2) arriba, el pedido de la profesora y la respuesta «Apliqué los cambios en «Guía: Fracciones equivalentes». Si no te sirven, «Deshacer» vuelve a la versión anterior», con Deshacer; en la hoja, el ejercicio 2 reescrito y, en la Estructura, un ejercicio 3 nuevo"><figcaption>El cambio se aplica en la misma hoja; <b>Deshacer</b> vuelve a la versión anterior y <b>Versiones</b> guarda las dos.</figcaption></figure>
          <p>Si no te sirve, <strong>Deshacer</strong>, en ese turno de la conversación, vuelve a la versión anterior. La de pteron queda en <strong>Versiones</strong>, desde donde vuelves a cualquiera con <strong>Volver a esta versión</strong>.</p>
        </section>
        <section>
          <h2 id="lista">Qué revisar antes de guardar</h2>
          <ul>
            <li>Las fuentes respaldan el contenido y puedes abrirlas desde el pie de la respuesta o el margen.</li>
            <li>El lenguaje corresponde al curso.</li>
            <li>Las instrucciones pueden ejecutarse con el tiempo y los recursos disponibles.</li>
            <li>Los puntajes y criterios son coherentes con lo que declara el encabezado.</li>
          </ul>
        </section>
        <section>
          <h2 id="guardar">Guardar una copia</h2>
          <p>En el editor, <strong>Archivo › Guardar en Word…</strong> —⁠o <strong>Guardar en PowerPoint…</strong>, en una presentación⁠— y <strong>Guardar en PDF…</strong> crean un archivo nuevo. pteron no sobrescribe el original ni crea archivos por su cuenta. Ver <a href="/docs?pagina=exportar">Exportar y compartir</a>.</p>
        </section>`
    },
    "artefactos": {
      eyebrow: "Materiales y formatos",
      title: "Documentos",
      lead: "Una guía o evaluación de pteron no es un bloque de texto en el chat: es un documento con encabezado con campos, ítems puntuados, espacios de respuesta y pauta, listo para editar en Write y exportar.",
      html: `
        <section>
          <h2 id="nivel">Lo que sale de pteron</h2>
          <p>El material llega compuesto como hoja de clase: encabezado con campos, objetivo, instrucciones, ítems con su puntaje y —⁠cuando el encargo incluye soluciones⁠— la pauta docente aparte. Lo pedagógico —⁠curso, asignatura, objetivo, propósito, tiempo y puntaje⁠— está en la hoja y se edita ahí. Todo se abre en Write, se corrige con el criterio del profesor y recién entonces se imprime o se exporta.</p>
          <figure class="product-shot product-shot-hero"><img src="/assets/app/write-guia-marco.webp?v=2026-10-25.5" srcset="/assets/app/write-guia-marco.webp?v=2026-10-25.5 1440w, /assets/app/write-guia-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Una guía de práctica en Write: la cinta de una fila con Archivo, Inicio, Insertar, Página, Revisar y Vista; la hoja con su encabezado de campos, el propósito, el objetivo, las instrucciones y las preguntas con su puntaje; a la derecha la Estructura con el total de 6 puntos; a la izquierda el margen con la conversación del encargo, las tarjetas de sus materiales y Ajustar"><figcaption>Una guía en Write: la hoja al centro, su estructura con el puntaje de cada pregunta a la derecha y la conversación en el margen.</figcaption></figure>
        </section>
        <section>
          <h2 id="formato-guia">Formato de guía y evaluación</h2>
          <p>El encabezado con campos reserva campos reales —⁠asignatura, eje, curso, docente, fecha, puntaje total y propósito⁠— y no se pierde al exportar. Cada ítem declara su tipo y su puntaje; el panel <strong>Estructura</strong> lista los bloques y suma el total. Los ítems se numeran 1, 2, 3 en toda la hoja, y lo que se responde bajo una consigna es un inciso a), b), c), con su letra en su renglón en Write, el PDF y Word.</p>
          <p>Los ítems cubren selección múltiple, selección de varias respuestas, desarrollo, verdadero o falso, términos pareados y ordenar pasos. Las alternativas van en su campo, con letra o casilla; el desarrollo trae líneas de respuesta; las tablas se completan en celda. Lo escrito en un renglón de respuesta queda como indicación sobre el espacio, no como respuesta del estudiante.</p>
          <p>La <strong>pauta docente</strong> es un material aparte, enlazado con la guía del estudiante: allí viven las respuestas y las explicaciones. Exportas el documento a <strong>DOCX</strong> o <strong>PDF</strong> conservando la composición; las presentaciones van a <strong>PPTX</strong>. Ver <a href="/docs?pagina=formatos-guia">Formatos de guía</a>, <a href="/docs?pagina=pauta-docente">Pauta docente</a> y <a href="/docs?pagina=exportar">Exportar y compartir</a>.</p>
        </section>
        <section>
          <h2 id="formatos">Tamaños y orientación</h2>
          <p>Los documentos admiten Oficio (el predeterminado), Carta, A4 y Legal (EE. UU.), con márgenes y saltos de página que se respetan al exportar. Puedes trabajar en vertical o apaisado, y la barra de edición permanece visible mientras recorres el material.</p>
          <figure class="product-shot"><img src="/assets/app/write-apaisada-marco.webp?v=2026-10-25.5" srcset="/assets/app/write-apaisada-marco.webp?v=2026-10-25.5 1440w, /assets/app/write-apaisada-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La misma guía en hoja apaisada en Write, con dos hojas a la vista y la Estructura a la derecha"><figcaption>Una guía en hoja apaisada.</figcaption></figure>
        </section>
        <section>
          <h2 id="cinta">La cinta del editor</h2>
          <p>Los materiales nuevos se abren en los editores nativos <strong>Write</strong> (documento) y <strong>Present</strong> (presentación). Ambos usan una cinta de una sola fila, con <strong>Archivo</strong> y un botón «Más» para lo que no cabe. Write organiza Inicio, Insertar, Página, Revisar y Vista; Present usa Inicio, Insertar, Diseño, Presentación y Vista. La lupa de la cinta, «Buscar comandos», encuentra cualquier orden por su nombre.</p>
          <p>En una guía o evaluación con preguntas, <strong>Vista › Mostrar respuestas</strong> despliega la respuesta de cada pregunta y <strong>Archivo › Pauta docente</strong> reúne la pauta. Las fuentes, las versiones y lo que pides a pteron van en el margen, junto a la hoja.</p>
        </section>
        <section>
          <h2 id="paginas">Hojas y configuración de página</h2>
          <p>Write trabaja sobre hojas físicas: cuando el contenido desborda una página, refluye a la siguiente y avisa una sola vez por hoja afectada. En la pestaña <strong>Página</strong> eliges el formato de tu colegio, si lo trajiste, o el tamaño —⁠Oficio, Carta, A4 o Legal (EE. UU.)⁠—, la orientación, los márgenes, el encabezado, el pie y la numeración. La configuración es por documento, y el PDF exportado la respeta.</p>
          <p>Deshacer y rehacer funcionan también cuando un cambio mueve texto a otra hoja.</p>
        </section>
        <section>
          <h2 id="matematicas">Matemáticas y tablas</h2>
          <p>Las expresiones matemáticas viajan como fórmula, no como texto con barras: se maquetan en pantalla —⁠también dentro de una celda de tabla, que muestra su fuente al enfocarla⁠— y salen al DOCX como ecuación real.</p>
          <p>Las ecuaciones se insertan desde la cinta y se editan en el propio documento: al abrir una, aparece su pestaña <strong>Ecuación</strong> con estructuras (fracción, raíz, integral, matriz…), símbolos y presentación en línea o centrada. Pasar de una ecuación a otra guarda la primera y abre la segunda en el mismo gesto.</p>
          <p>Un bloque puede mezclar prosa y una tabla, y ambas se exportan en el orden en que fueron escritas.</p>
          <p>Las listas se escriben con marcadores (<code>-</code>, <code>1.</code>, <code>A.</code>) y conservan su estilo al exportar. Las imágenes se ajustan desde la pestaña contextual —⁠tamaño, alineación y texto alternativo⁠— sin ventanas flotantes.</p>
        </section>
        <section>
          <h2 id="historial">Versiones</h2>
          <p><strong>Versiones</strong>, en el margen o en la tarjeta del material, lista cada revisión con su número y su hora. La que está en uso dice <b>Vigente</b>; cualquier otra vuelve con <strong>Volver a esta versión</strong>.</p>
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
          <h2 id="colegio">El formato de tu colegio</h2>
          <p>Si tu colegio tiene un Word con su encabezado, su pie y su página, tráelo desde <strong>Biblioteca › Agregar › Plantillas institucionales</strong>. pteron lee el Word sin IA y enmarca su hoja con ese encabezado, ese pie, su papel y sus márgenes; el contenido sigue siendo la hoja de pteron. Con <strong>Usar en tus guías nuevas</strong> —⁠o tus evaluaciones, tus planificaciones…⁠— los materiales nuevos de ese tipo lo llevan; cada hoja guarda su formato y lo cambia o lo quita en <strong>Página › Formato del colegio</strong>.</p>
          <p>Al guardar en Word, el marco del colegio va tal como venía. Lo que pteron no puede dibujar, como una marca de agua, queda sólo en el Word, y la tarjeta del formato lo dice.</p>
        </section>
        <section>
          <h2 id="hoja">La hoja predeterminada</h2>
          <p>Guía, evaluación, ticket de salida, planificación, rúbrica y pauta comparten una misma gramática. Sin un dato, el elemento simplemente no aparece.</p>
          <ul>
            <li>Antetítulo con la asignatura; tipo y tema como título y subtítulo.</li>
            <li>Ficha de identificación con líneas para completar (curso, docente, fecha, puntaje).</li>
            <li>Etiquetas de propósito y tiempo, e instrucciones.</li>
            <li>Una tarjeta por ítem, con su consigna numerada, sus incisos a), b)… y la etiqueta de puntaje y habilidad.</li>
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
              <tr><td>Verdadero o falso</td><td>Afirmaciones a), b)… bajo su consigna, con marca V / F</td></tr>
              <tr><td>Términos pareados</td><td>Premisas a), b)… para unir con un banco A, B, C</td></tr>
              <tr><td>Ordenar pasos</td><td>Secuencia para reordenar</td></tr>
            </tbody>
          </table></div>
          <p>La barra <strong>Estructura</strong> de Write inserta estos tipos, apartados, instrucciones, tablas y espacios de respuesta después del bloque del cursor, y deja mover, duplicar o eliminar cada bloque.</p>
        </section>
        <section>
          <h2 id="editar">Editar sin perder la forma</h2>
          <p>La hoja se edita como en Word: Enter en una alternativa crea otra; el número de cada ítem, la letra de cada inciso, el puntaje y el total se recalculan solos —⁠borrar, agregar o mover un inciso rotula de nuevo los demás⁠— y lo escrito en un renglón de respuesta queda como indicación sobre el espacio. En el DOCX exportado, los números y las letras de las alternativas son numeración de Word, y la letra de cada inciso va en su renglón.</p>
        </section>`
    },
    "pauta-docente": {
      eyebrow: "Materiales y formatos",
      title: "Pauta docente",
      lead: "Las respuestas no viajan en la hoja del estudiante: se guardan en el material, sólo para ti, y la pauta se arma aparte.",
      html: `
        <section>
          <h2 id="por-que">Por qué está separada</h2>
          <p>Una guía o evaluación para estudiantes no incluye la solución. En pteron, cada pregunta guarda su respuesta en el propio material, en el panel <b>Respuesta · sólo para ti</b>, con la justificación y el criterio de corrección. <b>Vista › Mostrar respuestas</b> despliega todos esos paneles a la vez. Ese panel no se imprime: la hoja que recibe el curso queda limpia.</p>
          <figure class="product-shot product-shot-crop"><div class="crop" style="--sw:2880;--cx:1012;--cy:368;--cw:1066;--ch:905"><img src="/assets/app/write-respuesta-marco-2x.webp?v=2026-10-25.5" width="2880" height="1760" loading="lazy" decoding="async" alt="Panel Respuesta · sólo para ti bajo una pregunta de selección múltiple: la alternativa correcta marcada y la retroalimentación de cada alternativa, con Agregar justificación y Agregar criterio"></div><figcaption>Bajo cada pregunta, la respuesta y la retroalimentación. Sólo las ves tú.</figcaption></figure>
        </section>
        <section>
          <h2 id="vinculo">La pauta, en un documento aparte</h2>
          <p>Con las respuestas guardadas, <b>Archivo › Pauta docente</b> arma la pauta en un documento propio, sin IA: <b>Generar pauta</b> la crea, <b>Abrir pauta</b> la muestra, y <b>Guardar pauta en Word…</b> y <b>Guardar pauta en PDF…</b> la guardan como archivo nuevo. En la Biblioteca, <b>Hacer la pauta</b> hace lo mismo. La pauta nombra cada inciso —⁠«5b»⁠—, y si el material cambia después, pteron la marca como desactualizada y te ofrece <b>Actualizar pauta</b>. Si tu pedido nombra la pauta, pteron la arma al cerrar el turno aunque la IA no la haya hecho.</p><figure class="product-shot"><img src="/assets/app/pauta-marco.webp?v=2026-10-25.5" srcset="/assets/app/pauta-marco.webp?v=2026-10-25.5 1440w, /assets/app/pauta-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="La pauta de corrección abierta en Write junto a la guía: la respuesta esperada de cada pregunta con su criterio, la retroalimentación por alternativa y la tabla de especificaciones con ítem, tipo, habilidad y puntaje; en el margen, Material del estudiante"><figcaption>La pauta docente, un documento aparte enlazado con la guía del estudiante.</figcaption></figure>
          <p>Al imprimir o guardar el material, <b>Qué hoja</b> elige entre la <b>Hoja del estudiante</b>, sin respuestas, y la <b>Versión docente (con respuestas)</b>.</p>
          <figure class="product-shot"><img src="/assets/app/imprimir-marco.webp?v=2026-10-25.5" srcset="/assets/app/imprimir-marco.webp?v=2026-10-25.5 1440w, /assets/app/imprimir-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Archivo › Imprimir en Write: «Se abre en Vista Previa para imprimir, con las mismas hojas de Guardar en PDF», el papel Oficio vertical y Qué hoja, con Hoja del estudiante, sin respuestas, o Versión docente con respuestas, y el botón Imprimir…"><figcaption>Archivo › Imprimir con «Qué hoja»: la hoja del estudiante o la versión docente con respuestas.</figcaption></figure>
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
          <p>pteron no crea archivos por su cuenta. El estado lo dice —⁠<b>Guardado</b> o sin guardar⁠— y la copia se materializa cuando ejecutas la acción: <strong>Guardar en pteron</strong> (Ctrl/⌘ S) conserva el material en pteron, y <strong>Guardar en Word…</strong> o <strong>Guardar en PDF…</strong>, en Archivo, crean un archivo nuevo. Antes de aplicar un cambio que le pides, pteron guarda en pteron lo que estabas editando, para partir de tu última versión.</p>
          <p>El diálogo del sistema te deja elegir carpeta y nombre. Ninguna exportación sobrescribe el archivo de partida.</p>
        </section>
        <section>
          <h2 id="biblioteca">Copia desde la Biblioteca</h2>
          <p>La Biblioteca trabaja sobre tu carpeta real: <strong>Agregar › Nueva carpeta</strong> crea una, y el detalle de un archivo ofrece <strong>Guardar copia…</strong>, <strong>Renombrar…</strong>, <strong>Mover a…</strong> y <strong>Enviar a la papelera</strong>. Guardar copia… guarda una copia mediante un diálogo visible, sin tocar el original.</p>
        </section>
        <section>
          <h2 id="donde">Dónde vive tu trabajo</h2>
          <p>Los encargos, el índice de búsqueda y los materiales creados en pteron se guardan en tu equipo, en la carpeta de datos de la aplicación. Tus archivos siguen en la carpeta de trabajo: mover uno fuera de ella lo saca del alcance de pteron, y vuelve a estar disponible si lo traes de vuelta.</p>
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
          <p>Todas las diapositivas siguen un mismo maestro: título claro, contenido centrado y un número de página discreto, sin el nombre del encargo repetido arriba y abajo. La letra parte de su tamaño y sólo achica si no cabe, y las fórmulas se ven como fórmulas, también en el PPTX.</p>
          <figure class="product-shot"><img src="/assets/app/present-marco.webp?v=2026-10-25.5" srcset="/assets/app/present-marco.webp?v=2026-10-25.5 1440w, /assets/app/present-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Present: la portada de una presentación de fracciones equivalentes en el maestro de pteron, con el título grande sobre el azul; a la izquierda las siete miniaturas y a la derecha Diseño de diapositiva con el fondo y las capas"><figcaption>Present: la diapositiva, las miniaturas y, a la derecha, el diseño con su fondo y sus capas.</figcaption></figure>
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
          <p>El PDF se arma desde el documento y no desde la pantalla: contiene el material y nada más, sin la barra de la aplicación ni elementos de interfaz, y respeta el tamaño, la orientación y los márgenes que definiste.</p><figure class="product-shot"><img src="/assets/app/imprimir-marco.webp?v=2026-10-25.5" srcset="/assets/app/imprimir-marco.webp?v=2026-10-25.5 1440w, /assets/app/imprimir-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Archivo › Imprimir en Write con Qué hoja: Hoja del estudiante o Versión docente con respuestas, y la guía debajo"><figcaption>Archivo › Imprimir con «Qué hoja»: la hoja del estudiante o la versión docente con respuestas.</figcaption></figure>
        </section>
        <section>
          <h2 id="integridad">Si algo no se puede exportar</h2>
          <p>pteron prefiere rechazar una estructura que no soporta antes que entregar una copia incompleta. Si la exportación falla, lo dice y no deja un archivo a medias. Las fórmulas van a Word como ecuaciones; si alguna no se puede convertir, sale como su texto y el aviso de guardado dice cuál.</p>
        </section>
        <section>
          <h2 id="originales">Tus originales</h2>
          <p>Ninguna exportación sobrescribe el archivo de partida. El diálogo del sistema te deja elegir dónde guardar la copia nueva.</p>
        </section>`
    },
    "trabajo-local": {
      eyebrow: "Privacidad y control",
      title: "Trabajo local",
      lead: "Tus documentos quedan en tu equipo salvo que elijas un modelo en la nube: desde que lo eliges, lo que le pides y adjuntas viaja a ese proveedor.",
      html: `
        <section><h2 id="limite">Límite de acceso</h2><p>pteron trabaja dentro de la carpeta que tú eliges. No incluye terminal ni herramientas generales de programación, y la interfaz no tiene acceso directo al sistema y sólo puede hacer una lista cerrada de tareas docentes.</p></section>
        <section><h2 id="nube">Uso de nube</h2><p>Antes de usar un modelo en la nube —también la IA incluida—, pteron te pide consentimiento una vez, al elegir el proveedor, su clave o su dirección. El Currículum Nacional viene en pteron y no usa internet; la búsqueda web viene apagada y, si la enciendes, envía sólo el texto de la búsqueda, sin nombres ni RUT. Las fuentes web se limitan a HTTPS, y lo que se recupera de ellas se trata como dato no confiable.</p></section>
        <section><h2 id="iphone">Acceso desde el iPhone</h2><p>Existe un acceso complementario desde el iPhone y viene <strong>apagado de fábrica</strong>. El escritorio conserva encargos, carpeta y materiales, y el teléfono se empareja contra él. El acceso se enciende sólo desde <strong>Configuración › Labs › Seguir en el iPhone</strong>, y ahí mismo creas un <strong>Nuevo código</strong> o lo cortas con <strong>Desvincular</strong>.</p></section>
        <section><h2 id="licencia">Licencia</h2><p>El núcleo local funciona sin licencia y no requiere plan. Un plan Basic o Pro habilita la IA incluida con una licencia firmada, que se activa en <strong>Configuración › Perfil</strong> y se verifica en tu equipo.</p><p>La licencia se renueva sola mientras tu plan siga vigente: una vez al día y, cuando le quedan menos de 72 horas, cada hora, al volver de la suspensión y antes de usar la IA incluida. Si el plan termina, la licencia deja de renovarse y sigues con el núcleo local.</p></section>`
    },
    "datos-estudiantes": {
      eyebrow: "Privacidad y control",
      title: "Datos de estudiantes",
      lead: "Antes de enviar algo a un modelo en la nube, pteron avisa si encuentra un RUT o un nombre escrito en un campo como «Estudiante:», y te deja decidir cómo continuar.",
      html: `
        <section>
          <h2 id="detecta">Qué detecta exactamente</h2>
          <p>Antes de enviar algo a un proveedor que no sea local, pteron busca dos cosas concretas: un <strong>nombre declarado en un campo de persona</strong> y un <strong>RUT con formato chileno</strong>. Las busca en tu pedido y en lo que viajaría con él: el material que se ajusta, la memoria del encargo y la conversación anterior. Si encuentra alguna, detiene el envío, dice qué encontró y de dónde viene, y te muestra la elección.</p>
          <figure class="product-shot"><img src="/assets/app/datos-marco.webp?v=2026-10-25.5" srcset="/assets/app/datos-marco.webp?v=2026-10-25.5 1440w, /assets/app/datos-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Aviso de datos identificables de estudiantes en el recuadro del encargo Observaciones del curso: Detecté RUT y nombres identificables en tu pedido, Detectado: RUT · nombres identificables, Vista previa anonimizada y las acciones Excluir fragmentos, Anonimizar y continuar y Cancelar"><figcaption>El aviso llega antes del envío, dice qué detectó y ofrece una vista previa anonimizada.</figcaption></figure>
          <p>Tienes tres salidas: <strong>Excluir fragmentos</strong>, <strong>Anonimizar y continuar</strong> o <strong>Cancelar</strong>. Al anonimizar, los nombres viajan como «[Estudiante 1]» y vuelven a tu material al guardar. La vista previa anonimizada te deja ver qué se enviaría antes de aceptar, y lo que eliges vale para toda la conversación. Las búsquedas en la web no envían nombres ni RUT.</p>
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
          <p>En <strong>Configuración › Modelo de IA</strong>, que parte por <strong>¿Dónde trabaja la IA?</strong>: <strong>En este equipo</strong>, <strong>IA incluida en pteron</strong> o <strong>Con tu clave</strong>. En Con tu clave eliges el <strong>Proveedor</strong> —⁠Anthropic, OpenAI, Google Gemini u otros, o un <strong>Servidor compatible con OpenAI…</strong>⁠—, pegas su clave y, con <strong>Cambiar…</strong>, eliges entre los modelos que esa clave habilita; <strong>Razonamiento</strong> fija cuánto piensa: más alto es más cuidadoso y más lento.</p>
          <p>Elegir es usar: el cambio se aplica al instante y, junto al título de Configuración, un aviso como <b>La IA trabaja en: IA incluida en pteron · Deshacer</b> te deja volver atrás. Si el cambio lleva tus pedidos a un destino nuevo en la nube, pteron te pide antes tu consentimiento; si no lo das, nada cambia.</p>
          <figure class="product-shot product-shot-crop"><div class="crop" style="--sw:2880;--cx:880;--cy:160;--cw:1640;--ch:1190"><img src="/assets/app/modelo-de-ia-marco-2x.webp?v=2026-10-25.5" width="2880" height="1760" loading="lazy" decoding="async" alt="Configuración › Modelo de IA: ¿Dónde trabaja la IA? con tres lugares —En este equipo, IA incluida en pteron y Con tu clave—; abierto Con tu clave, con el proveedor Anthropic, la clave, el modelo recomendado con Cambiar… y el razonamiento"></div><figcaption>Configuración › Modelo de IA parte por «¿Dónde trabaja la IA?»: en este equipo, la IA incluida o tu clave.</figcaption></figure>
        </section>
        <section>
          <h2 id="local">Modelo local</h2>
          <p>La opción <strong>En este equipo</strong> usa Ollama y permite trabajar sin enviar tus documentos a ningún proveedor. No necesita clave ni licencia. Para usarla, <strong>Preparar…</strong> descarga el modelo con su avance a la vista; si falta el motor, pteron lo dice y ofrece <strong>Descargar el motor</strong> y, una vez instalado, <strong>Ya lo instalé, continuar</strong>.</p>
        </section>
        <section>
          <h2 id="ia-incluida">IA incluida</h2>
          <p>Con un plan Basic o Pro, la IA incluida responde sin que pegues una clave: en <strong>Configuración › Modelo de IA</strong> eliges <strong>IA incluida en pteron</strong>, y funciona mientras tu licencia esté vigente. Sin plan, ahí mismo están Basic, con <strong>Probar 7 días gratis</strong>, y Pro. Responde con un modelo de Anthropic que elige y actualiza pteron.</p>
          <p>Lo que le pides —tu pedido, la conversación y lo que adjuntas— pasa por el servidor de pteron hacia Anthropic, en Estados Unidos, que genera la respuesta. pteron registra cuánto usas, no el contenido. Anthropic no entrena sus modelos con ese contenido y lo borra dentro de 30 días, salvo lo que la ley le exija guardar o lo que sus sistemas de seguridad marquen. Como con cualquier modelo en la nube, pteron pide tu consentimiento al elegirla y avisa antes de enviar un dato identificable de un estudiante.</p>
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
          <p>Tu configuración se guarda en este equipo, y cada clave lo dice junto a su campo: <b>Se guarda cifrada en este equipo.</b></p>
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
              <tr><td>Nuevo encargo</td><td><code>⌘ N</code></td><td><code>Ctrl+N</code></td></tr>
              <tr><td>Buscar encargos</td><td><code>⌘ K</code></td><td><code>Ctrl+K</code></td></tr>
              <tr><td>Plegar el índice</td><td><code>⌘ \\</code></td><td><code>Ctrl+\\</code></td></tr>
              <tr><td>Abrir Configuración</td><td><code>⌘ ,</code></td><td><code>Ctrl+,</code></td></tr>
              <tr><td>Abrir tu carpeta en la Biblioteca</td><td><code>⌘ O</code></td><td><code>Ctrl+O</code></td></tr>
              <tr><td>Guardar el material en pteron</td><td><code>⌘ S</code></td><td><code>Ctrl+S</code></td></tr>
              <tr><td>Imprimir el material</td><td><code>⌘ P</code></td><td><code>Ctrl+P</code></td></tr>
              <tr><td>Enviar mensaje</td><td><code>↵</code></td><td><code>Intro</code></td></tr>
              <tr><td>Salto de línea</td><td><code>⌘ ↵</code></td><td><code>Ctrl+Intro</code></td></tr>
              <tr><td>Mencionar un material</td><td><code>@</code></td><td><code>@</code></td></tr>
              <tr><td>Comandos docentes</td><td><code>/</code></td><td><code>/</code></td></tr>
            </tbody>
          </table></div>
        </section>
        <section>
          <h2 id="compositor">En el compositor</h2>
          <p>La mención <code>@</code> trae un documento de tu carpeta de trabajo por su nombre. La barra <code>/</code> abre los comandos con su pauta a la vista. Escape o un clic fuera cierran el desplegable abierto y devuelven el foco al texto.</p>
        </section>
        <section>
          <h2 id="editor">En el editor</h2>
          <p><strong>Ctrl/⌘ S</strong> guarda el material en pteron. Para tener un archivo, usa Archivo › Guardar en Word o Guardar en PDF: siempre crea uno nuevo. Con el foco en Write o Present, <strong>Ctrl/⌘ K</strong> busca comandos en vez de encargos. Los menús y diálogos cierran con Escape sin perder el estado del documento.</p>
        </section>`
    },
    "preguntas": {
      eyebrow: "Ayuda",
      title: "Preguntas frecuentes",
      lead: "Respuestas breves sobre instalación, archivos, planes y disponibilidad.",
      html: `
        <section><h2 id="internet">¿Necesito internet?</h2><p>No para trabajar con un modelo local. Sí para descargar actualizaciones, usar la IA incluida o usar un proveedor en la nube.</p></section>
        <section><h2 id="originales">¿pteron modifica mis originales?</h2><p>No. Cada resultado se guarda como un archivo nuevo mediante una acción que tú ejecutas. pteron no crea archivos por su cuenta.</p></section>
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
        <section><h2 id="modelo">El modelo no responde</h2><p>Al pie del índice, el icono de la IA pasa a ser un aviso, <strong>La IA no responde</strong>, y su ayuda dice la causa. Pulsarlo abre la guía de IA. En <strong>Configuración › Modelo de IA</strong>, cada opción muestra su estado. Si usas la IA en este equipo, comprueba que Ollama esté iniciado o vuelve a prepararla; si usas tu clave, que siga siendo válida —⁠<strong>Probar de nuevo</strong> la comprueba⁠— y que haya conexión.</p></section>
        <section><h2 id="ia-incluida">La IA incluida no responde</h2><p>pteron dice la causa en la conversación, con <strong>Reintentar</strong> y <strong>Cambiar de modelo</strong>, y nunca cambia de motor por su cuenta. Son tres:</p><ul><li><strong>Licencia no vigente.</strong> El plan terminó, tiene un pago pendiente o este equipo no está activado. Revisa tu plan en tu <a href="/cuenta">cuenta</a> y, si hace falta, elige «Activar este equipo» en <strong>Configuración › Perfil</strong>.</li><li><strong>Cuota del período agotada.</strong> Vuelve con tu próximo cobro; mientras tanto, sigue con el modelo local o con tu clave. En tu cuenta ves cuándo se renueva.</li><li><strong>Servicio no disponible.</strong> El servicio de la IA incluida no puede responder en este momento. Vuelve a intentarlo más tarde.</li></ul></section>
        <section><h2 id="corte">Una respuesta se corta</h2><p>Si la respuesta falla o la detienes, lo que alcanzó a escribirse —⁠el texto y la hoja⁠— queda a la vista, y al pie el hilo dice qué pasó: «Lo que alcancé a escribir queda a la vista; no se guardó.». <strong>Reintentar</strong> vuelve a enviar el pedido, con lo escrito a la vista como versión anterior, y <strong>Cambiar de modelo</strong> te deja seguir con otro. pteron nunca cambia de motor por su cuenta.</p><figure class="product-shot"><img src="/assets/app/error-proveedor-marco.webp?v=2026-10-25.5" srcset="/assets/app/error-proveedor-marco.webp?v=2026-10-25.5 1440w, /assets/app/error-proveedor-marco-2x.webp?v=2026-10-25.5 2880w" sizes="(max-width: 760px) 100vw, 720px" width="1440" height="880" loading="lazy" decoding="async" alt="Una respuesta cortada por el proveedor: la guía de fracciones que alcanzó a escribirse, con sus instrucciones y dos preguntas, y debajo «No pude completar la tarea: se alcanzó el límite de consultas de Anthropic. Espera un momento o cambia de modelo.», «Lo que alcancé a escribir queda a la vista; no se guardó.» y los botones Reintentar y Cambiar de modelo"><figcaption>Si la respuesta se corta, lo escrito queda a la vista, con <b>Reintentar</b> y <b>Cambiar de modelo</b>.</figcaption></figure></section>
        <section><h2 id="exportar">La exportación falla</h2><p>pteron prefiere avisar antes que entregarte una copia incompleta: si algo no se puede guardar, lo dice y no deja un archivo a medias. Una fórmula que no se puede convertir a ecuación de Word sale como su texto, y el aviso de guardado dice cuál.</p></section>
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
