# pteron 0.8 · capturas para la web

2880 × 1760 (ventana de 1440 × 880 a escala 2) y 1440 × 880, tema claro, con el marco de la ventana de macOS
(`NOMBRE-marco-2x.webp` y `NOMBRE-marco.webp`). Las toma `scripts/capturas-pteron.mjs` con el arnés de capturas de
pteron, desde la rama `nuevo-onboarding` (c61e8f05, 2026-10-14: 0.8.1 y el recorrido de bienvenida de ADR-183).

Cómo se toman, para que nadie confunda una captura con otra cosa:

- Cada una parte de un perfil temporal. Una primera apertura siembra los materiales de prueba del arnés
  (`PTERON_CAPTURE_SEED`): la guía de fracciones equivalentes, su pauta, la presentación, los planes y la conversación.
  La carpeta de trabajo es una carpeta de profesor escrita por el script, con unos Word, PDF y PowerPoint de
  Matemática.
- Antes de la segunda apertura se prepara la mesa en la base del perfil: los encargos del arnés toman nombres, cursos
  y asignaturas de un profesor («Fracciones equivalentes», 6° básico · Matemática), se suman dos encargos de otros
  cursos con su conversación y se archivan los que la escena no usa. Los materiales y lo que hace cada escena son los
  de pteron.
- La segunda apertura monta la escena (`PTERON_CAPTURE_SCENE`) a 1440 × 880 y escala 2. Se toma en Linux, bajo Xvfb,
  con la plataforma de macOS (la app la pregunta a Main y dibuja su franja para los semáforos y los atajos con ⌘) y con
  la IA incluida respondiendo: el arnés no simula la salud del proveedor y, sin esto, el índice diría «La IA no
  responde» en todas. La guía de IA se toma justamente sin una IA que responda.
- Las letras son las que trae la app (Archivo, Outfit e IBM Plex Mono), así que no cambian entre sistemas. El marco
  (esquinas de 10 pt y semáforos donde los pone `trafficLightPosition`) se compone al final.

| Captura | Qué muestra | Dónde va en la web |
| --- | --- | --- |
| `inicio` | La Home en reposo: el índice con los encargos por curso, la marca de agua, los cuatro rumbos, el recuadro y «Reflexión por voz». | Docs › Qué es pteron |
| `inicio-pedido` | Mientras se escribe el pedido, pteron reconoce material, curso, asignatura, tema y duración, y ofrece agregarlos. | Docs › La pantalla de inicio |
| `inicio-planificar` | El rumbo Planificar elegido: el recuadro empieza el pedido y pteron reconoce material, curso y cantidad de clases. | Docs › Planificar |
| `encargo` | Un encargo abierto: en el índice, bajo 6° básico · Matemática; al centro, el pedido, la respuesta y las tarjetas de la guía, la pauta y la presentación. | Docs › Encargos y memoria |
| `memoria` | Configuración › Memoria y contexto, con recuerdos generales y de este encargo. | Docs › Encargos y memoria |
| `conversacion` | Una respuesta en texto corrido con sus acciones al pie: copiar, guardar y crear un material. | Docs › Fuentes y contexto |
| `biblioteca` | La Biblioteca con lo creado en pteron y los archivos de la carpeta, y el detalle del elegido. | Docs › Abrir un recurso |
| `plan-decision` | Un plan por acordar: la decisión pendiente en el recuadro, con la alternativa sugerida. | Docs › Crear |
| `plan-listo` | El plan listo, con «Supuestos que puedes cambiar» abierto y «Crear la guía». | Docs › Crear |
| `write-ficha` | La guía en Write con el margen del encargo y la ficha pedagógica abierta. | Docs › Crear |
| `write-guia` | La guía en Write: la hoja, la estructura con los puntajes y la conversación en el margen. | Docs › Documentos |
| `write-apaisada` | La misma guía en hoja apaisada. | Docs › Documentos |
| `write-respuesta` | Vista › Mostrar respuestas: el panel «Respuesta · sólo para ti» bajo una pregunta. | Docs › Evaluar · Pauta docente (recorte) |
| `pauta` | La pauta de corrección, un documento aparte enlazado con la guía. | Docs › Pauta docente |
| `imprimir` | Archivo › Imprimir con «Qué hoja». | Docs › Pauta docente · Exportar y compartir |
| `cambio-aplicado` | Un ajuste aplicado en la misma hoja, con «Deshacer» en el margen y Versiones (2). | Docs › Revisar y guardar |
| `referencia` | La guía y un apunte en PDF de la carpeta, uno junto al otro. | Docs › Adaptar |
| `present` | Present con el maestro nuevo: la portada, las miniaturas y el diseño de la diapositiva. | Docs › Presentaciones |
| `datos` | El aviso de datos identificables de estudiantes en el recuadro. | Docs › Datos de estudiantes |
| `modelo-de-ia` | Configuración › Modelo de IA: «¿Dónde trabaja la IA?» con «Con tu clave» abierto. Sólo a 2×: docs la muestra recortada. | Docs › Modelos y permisos |
| `error-exportar` | Un fallo al guardar una copia, con «Reintentar exportación». | Docs › Solución de problemas |
| `recorrido` | La primera apertura: la marca dibujada y «Ver cómo funciona». | Docs › Primera apertura |
| `recorrido-crear` | La escena Crear del recorrido, al final de su réplica. | Docs › Primera apertura |
| `guia-ia` | La guía de IA sobre la Home, cuando ninguna IA responde. | Docs › Primera apertura |

Para tomarlas de nuevo (con pteron construido y sus paquetes):

```sh
xvfb-run -a -s "-screen 0 3600x2400x24" node scripts/capturas-pteron.mjs ../pteron   # en Linux
node scripts/capturas-pteron.mjs ../pteron --solo inicio,biblioteca                   # en macOS, algunas
```

Después se sube `?v=` en `public/docs/content.js`: `/assets` se sirve como inmutable.
