/**
 * Toma las capturas de la app para la documentación con el arnés de pteron, sin escribir nada en su repositorio.
 *
 *   node scripts/capturas-pteron.mjs [ruta de pteron] [--solo inicio,biblioteca] [--crudo carpeta]
 *
 * Usa la ruta indicada, $PTERON_DIR o ../pteron, ya construida (`npm run build`, deja out/main/index.js) y con sus
 * paquetes: Electron y Playwright salen de su node_modules. En Linux corre bajo un servidor X con pantalla grande,
 * porque la ventana se abre a escala 2:  xvfb-run -a -s "-screen 0 3600x2400x24" node scripts/capturas-pteron.mjs
 * (como root, Chromium pide --no-sandbox: el script lo agrega sólo entonces, y sólo a esta corrida).
 *
 * Cada captura parte de un perfil temporal: una apertura siembra los materiales de prueba del arnés
 * (PTERON_CAPTURE_SEED) y la carpeta de un profesor (unos Word, PDF y PowerPoint de Matemática) en Documentos/pteron;
 * después se prepara la mesa —los encargos con nombre, curso y asignatura de un profesor y los que sobran,
 * archivados— y una segunda apertura monta la escena (PTERON_CAPTURE_SCENE) a 1440 × 880 y escala 2. La ventana se
 * dibuja como en macOS (la app pregunta su plataforma a Main) y el modelo responde (la IA incluida): el arnés no
 * simula la salud del proveedor y, sin esto, el índice diría «La IA no responde» en todas. Al final se compone el
 * marco de la ventana de macOS (esquinas de 10 pt y semáforos) y se guarda en public/assets/app como WebP a 1440 y
 * 2880 de ancho.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const landing = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const solo = opcion("--solo")?.split(",").map((s) => s.trim()).filter(Boolean);
const crudo = opcion("--crudo");
const pteron = path.resolve(args[0] || process.env.PTERON_DIR || path.join(landing, "..", "pteron"));
const salida = path.join(landing, "public/assets/app");
const W = 1440;
const H = 880;

const electron = {
  darwin: "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  win32: "node_modules/electron/dist/electron.exe",
}[process.platform] ?? "node_modules/electron/dist/electron";
for (const requisito of ["out/main/index.js", electron, "node_modules/playwright/index.mjs"]) {
  if (!existsSync(path.join(pteron, requisito))) {
    console.error(`Falta ${requisito} en ${pteron}: instala sus paquetes y corre npm run build.`);
    process.exit(1);
  }
}
const { _electron } = await import(path.join(pteron, "node_modules/playwright/index.mjs"));
const desdePteron = createRequire(path.join(pteron, "package.json"));

/* ---------- La mesa: lo que un profesor tendría abierto ---------- */

// Encargos del arnés (por su título de siembra) → cómo se llaman en la mesa. `null` en el curso: «Sin curso».
const ENCARGOS = {
  "Primera conversación": ["Fracciones equivalentes", "6° básico", "Matemática"],
  "Plan integrado · revisión pendiente": ["Guía de práctica de fracciones", "6° básico", "Matemática"],
  "Plan integrado · listo": ["Guía de práctica de fracciones", "6° básico", "Matemática"],
  "Plan integrado · guía creada": ["Práctica de fracciones con figuras", "6° básico", "Matemática"],
  "Conversación · consulta pedagógica": ["¿Mide comprensión o memoria?", null, null],
  "Plan integrado · varios materiales": ["Homotecia", "8° básico", "Matemática"],
};
// Encargos de otros cursos, con su conversación, para que el índice se vea como el de alguien que trabaja.
const OTROS = [
  ["Evaluación de comprensión lectora", "7° básico", "Lenguaje y Comunicación", 2,
    "Una evaluación de comprensión lectora para 7° básico, con selección múltiple y preguntas de desarrollo.",
    "Armé la evaluación sobre un texto informativo breve: seis preguntas de selección múltiple y dos de desarrollo."],
  ["Cambios de estado del agua", "7° básico", "Ciencias Naturales", 1,
    "Organicemos una secuencia sobre los cambios de estado del agua.",
    "Podemos partir por las ideas previas del curso y cerrar con una explicación basada en evidencia."],
];
// Títulos de materiales del arnés que delatan la prueba
const MATERIALES = [
  ["Pauta docente · Guía: Fracciones equivalentes (lista)", "Pauta docente · Guía de práctica: fracciones equivalentes"],
  ["Guía: Fracciones equivalentes (lista)", "Guía de práctica: fracciones equivalentes"],
  ["Plan de Guía de Práctica de Fracciones - 6° básico", "Guía de práctica de fracciones · 6° básico"],
  ["Plan de Guía de Práctica de Fracciones - listo", "Guía de práctica de fracciones · 6° básico"],
  ["Plan de Guía de Práctica de Fracciones - conservado", "Guía de práctica de fracciones · 6° básico"],
  ["Guía derivada de fracciones - 6° básico", "Práctica de fracciones con figuras"],
  ["Fracciones equivalentes (lista)", "Fracciones equivalentes"],
];
// El pedido y la respuesta del encargo principal: las tarjetas de sus materiales se anclan a esa respuesta
const PEDIDO = "Una guía de práctica de fracciones equivalentes para 6° básico, con selección múltiple y desarrollo, y su pauta.";
const RESPUESTA =
  "Preparé la guía de práctica: una pregunta de selección múltiple y una de desarrollo con figuras, 6 puntos en total. " +
  "La pauta docente va aparte, con la respuesta y el criterio de corrección de cada pregunta.";

/**
 * Prepara la mesa en la base del perfil sembrado: renombra los encargos y materiales del arnés, les da curso y
 * asignatura, agrega los encargos de otros cursos y archiva los encargos que la captura no usa.
 */
// Abiertos en toda captura; cada escena suma el encargo del arnés que muestra
const SIEMPRE = ["Primera conversación", "Conversación · consulta pedagógica", "Plan integrado · varios materiales"];

function prepararMesa(archivo, { abiertos: propios = [], titulos = {}, materialesDelPrincipal } = {}) {
  const abiertos = [...SIEMPRE, ...propios];
  const db = new DatabaseSync(archivo);
  const ahora = Date.now();
  const iso = (dias, minutos = 0) => new Date(ahora - dias * 86_400_000 - minutos * 60_000).toISOString();
  const sesiones = db.prepare("SELECT id, title FROM sessions").all();
  const principal = sesiones.find((s) => s.title === "Primera conversación");
  for (const sesion of sesiones) {
    const encargo = ENCARGOS[sesion.title];
    if (!encargo) continue;
    const titulo = titulos[sesion.title] ?? encargo[0];
    const abierto = abiertos.includes(sesion.title);
    db.prepare("UPDATE sessions SET title = ?, course = ?, subject = ?, closed_at = ? WHERE id = ?").run(
      titulo, encargo[1], encargo[2], abierto ? null : iso(9), sesion.id,
    );
  }
  for (const [antes, despues] of MATERIALES) {
    db.prepare("UPDATE artifacts SET title = replace(title, ?, ?)").run(antes, despues);
    for (const columna of ["blocks_json", "editor_json", "page_json"]) {
      db.prepare(`UPDATE artifact_revisions SET ${columna} = replace(${columna}, ?, ?) WHERE ${columna} IS NOT NULL`).run(
        JSON.stringify(antes).slice(1, -1), JSON.stringify(despues).slice(1, -1),
      );
    }
  }
  // La presentación del arnés se siembra con el tipo de una guía: su tarjeta diría «Guía»
  db.prepare("UPDATE artifacts SET kind = 'presentation' WHERE id = 'capture-seed-presentation'").run();
  if (principal) {
    // El encargo principal conserva la guía, su pauta y la presentación; lo demás queda en un encargo archivado
    const conservar = materialesDelPrincipal ?? ["capture-seed-guide-ready", "capture-seed-presentation"];
    const pautas = db.prepare("SELECT id FROM artifacts WHERE kind = 'answer_key' AND session_id = ?").all(principal.id).map((r) => r.id);
    const archivo = crearSesion(db, "Fracciones · borradores", "6° básico", "Matemática", iso(12), iso(12), iso(12));
    for (const { id } of db.prepare("SELECT id FROM artifacts WHERE session_id = ?").all(principal.id)) {
      if (!conservar.includes(id) && !pautas.includes(id)) db.prepare("UPDATE artifacts SET session_id = ? WHERE id = ?").run(archivo, id);
    }
    const primero = db.prepare("SELECT min(created_at) AS t FROM artifacts WHERE session_id = ?").get(principal.id)?.t;
    const antes = (ms) => new Date(new Date(primero ?? iso(0)).getTime() - ms).toISOString();
    agregarMensaje(db, principal.id, "user", PEDIDO, antes(95_000));
    agregarMensaje(db, principal.id, "assistant", RESPUESTA, antes(2_000));
  }
  for (const [titulo, curso, asignatura, dias, pedido, respuesta] of OTROS) {
    const id = crearSesion(db, titulo, curso, asignatura, iso(dias, 40), iso(dias, 12));
    agregarMensaje(db, id, "user", pedido, iso(dias, 40));
    agregarMensaje(db, id, "assistant", respuesta, iso(dias, 12));
  }
  db.close();
}

function crearSesion(db, titulo, curso, asignatura, creada, actualizada, cerrada = null) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (id, title, created_at, updated_at, closed_at, course, subject) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, titulo, creada, actualizada, cerrada, curso, asignatura,
  );
  return id;
}

function agregarMensaje(db, sesion, rol, texto, cuando) {
  db.prepare("INSERT INTO messages (id, session_id, role, content, created_at, status) VALUES (?, ?, ?, ?, ?, 'done')").run(
    crypto.randomUUID(), sesion, rol, texto, cuando,
  );
}

/* ---------- La carpeta del profesor: unos archivos de verdad, hechos con los paquetes de pteron ---------- */

const APUNTE = {
  titulo: "Fracciones equivalentes",
  bajada: "Apunte para 6° básico · Unidad 2",
  secciones: [
    ["Idea clave", "Dos fracciones son equivalentes cuando representan la misma parte de un entero, aunque se escriban con números distintos."],
    ["Cómo se obtienen", "Para amplificar, se multiplican el numerador y el denominador por un mismo número. Para simplificar, se dividen por un divisor común."],
    ["Ejemplo", "1/2 = 2/4 = 4/8: en las tres barras está pintada la misma parte."],
    ["Error frecuente", "Sumar el mismo número arriba y abajo no da una fracción equivalente: de 1/2 no se llega a 2/3."],
  ],
};

async function carpetaDelProfesor(carpeta) {
  const { Document, Packer, Paragraph, HeadingLevel } = desdePteron("docx");
  const { PDFDocument, StandardFonts, rgb } = desdePteron("pdf-lib");
  const PptxGenJS = desdePteron("pptxgenjs");
  const en = (...partes) => path.join(carpeta, ...partes);
  for (const sub of ["Apuntes", "Guías de clase", "Evaluaciones", "Planificaciones", "Presentaciones", "Lenguaje"]) await mkdir(en(sub), { recursive: true });

  const word = async (destino, titulo, renglones) => {
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
      ...renglones.map((texto) => new Paragraph({ text: texto, spacing: { after: 200 } })),
    ] }] });
    await writeFile(destino, await Packer.toBuffer(doc));
  };
  await word(en("Guías de clase", "Guía - Fracciones en la recta numérica.docx"), "Fracciones en la recta numérica", [
    "Matemática · 6° básico", "1. Ubica 1/4, 2/4 y 3/4 en la recta.", "2. ¿Qué fracción está en el mismo lugar que 1/2?", "3. Explica cómo lo comprobaste."]);
  await word(en("Guías de clase", "Ticket de salida - Fracciones.docx"), "Ticket de salida", [
    "Escribe dos fracciones equivalentes a 1/3.", "Explica cómo comprobaste tu respuesta."]);
  await word(en("Planificaciones", "Planificación Unidad 2 - Fracciones.docx"), "Unidad 2: fracciones", [
    "Clase 1: representar fracciones con barras y en la recta.", "Clase 2: fracciones equivalentes.", "Clase 3: comparar y ordenar.", "Clase 4: resolver problemas y cerrar la unidad."]);
  await word(en("Evaluaciones", "Rúbrica - Resolución de problemas.docx"), "Rúbrica de resolución de problemas", [
    "Comprende el problema: identifica los datos y lo que se pregunta.", "Elige una estrategia: dibujo, tabla o cálculo.", "Comunica: explica el procedimiento y revisa el resultado."]);
  await word(en("Lenguaje", "Texto informativo - Los volcanes de Chile.docx"), "Los volcanes de Chile", [
    "Chile tiene más de dos mil volcanes, y unos noventa están activos.", "Se forman donde una placa se hunde bajo otra."]);

  // El apunte en PDF, con sus barras: el que la vista doble abre junto al material
  const apunte = await PDFDocument.create();
  const letra = await apunte.embedFont(StandardFonts.Helvetica);
  const negrita = await apunte.embedFont(StandardFonts.HelveticaBold);
  const hoja = apunte.addPage([595, 842]);
  const tinta = rgb(0.12, 0.16, 0.24);
  const azul = rgb(0.12, 0.25, 0.58);
  hoja.drawText(APUNTE.titulo, { x: 56, y: 770, size: 24, font: negrita, color: azul });
  hoja.drawText(APUNTE.bajada, { x: 56, y: 746, size: 12, font: letra, color: tinta });
  let y = 700;
  for (const [titulo, texto] of APUNTE.secciones) {
    hoja.drawText(titulo, { x: 56, y, size: 13, font: negrita, color: tinta });
    y -= 20;
    const palabras = texto.split(" ");
    let renglon = "";
    for (const palabra of palabras) {
      const prueba = renglon ? `${renglon} ${palabra}` : palabra;
      if (letra.widthOfTextAtSize(prueba, 11.5) > 480) {
        hoja.drawText(renglon, { x: 56, y, size: 11.5, font: letra, color: tinta });
        y -= 17;
        renglon = palabra;
      } else renglon = prueba;
    }
    hoja.drawText(renglon, { x: 56, y, size: 11.5, font: letra, color: tinta });
    y -= 34;
  }
  for (const [fila, partes] of [[0, 2], [1, 4], [2, 8]]) {
    const ancho = 360 / partes;
    for (let i = 0; i < partes; i += 1) {
      hoja.drawRectangle({
        x: 56 + i * ancho, y: y - fila * 46, width: ancho, height: 30, borderColor: tinta, borderWidth: 1,
        color: i < partes / 2 ? rgb(0.56, 0.69, 0.96) : rgb(1, 1, 1),
      });
    }
    hoja.drawText(`${partes / 2}/${partes}`, { x: 432, y: y - fila * 46 + 9, size: 13, font: negrita, color: tinta });
  }
  const pdf = await apunte.save();
  await writeFile(en("Apuntes", "Apunte - Fracciones equivalentes.pdf"), pdf);

  const evaluacion = await PDFDocument.create();
  const pagina = evaluacion.addPage([595, 842]);
  const fuente = await evaluacion.embedFont(StandardFonts.Helvetica);
  pagina.drawText("Evaluación Unidad 2: fracciones", { x: 56, y: 770, size: 20, font: fuente, color: azul });
  ["1. Representa 3/4 con un dibujo.", "2. ¿Es 6/8 equivalente a 3/4? Explica.", "3. Ordena de menor a mayor: 1/2, 2/3, 3/8."].forEach((texto, i) =>
    pagina.drawText(texto, { x: 56, y: 720 - i * 34, size: 12.5, font: fuente, color: tinta }));
  await writeFile(en("Evaluaciones", "Evaluación Unidad 2 - Fracciones.pdf"), await evaluacion.save());

  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  const lamina = deck.addSlide();
  lamina.background = { color: "1E3F94" };
  lamina.addText("La recta numérica", { x: 0.7, y: 2.4, w: 11, h: 1.2, fontSize: 40, color: "FFFFFF", bold: true });
  lamina.addText("Matemática · 6° básico", { x: 0.7, y: 3.6, w: 11, h: 0.6, fontSize: 20, color: "DCE3EE" });
  await deck.writeFile({ fileName: en("Presentaciones", "La recta numérica.pptx") });
  return pdf;
}

/* ---------- Las capturas ---------- */

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** app.evaluate con reintentos: mientras Main trabaja (siembra, base, índice), Playwright puede perder la respuesta. */
async function evaluar(app, fn, arg) {
  for (let intento = 1; ; intento += 1) {
    try {
      return await app.evaluate(fn, arg);
    } catch (error) {
      if (intento >= 4 || !/garbage collected/.test(error.message)) throw error;
      await espera(300 * intento);
    }
  }
}
const clic = (selector) => async (page) => {
  await page.locator(selector).first().click();
};

// nombre del archivo · escena del arnés · cómo se prepara la mesa · qué se hace antes de la foto
const CAPTURAS = [
  { nombre: "inicio", escena: "home" },
  { nombre: "inicio-pedido", escena: "home-reconoce" },
  {
    nombre: "inicio-planificar",
    escena: "home",
    antes: async (page) => {
      await page.locator(".type-tile", { hasText: "Planificar" }).first().click();
      await espera(400);
      await page.locator(".home-surface textarea").first().click();
      await page.keyboard.type("el ciclo del agua, cuatro clases para 4° básico", { delay: 8 });
      await espera(1200);
    },
  },
  { nombre: "conversacion", escena: "conversacion", titulos: { "Conversación · consulta pedagógica": "Conversación · consulta pedagógica" } },
  { nombre: "memoria", escena: "memory" },
  { nombre: "biblioteca", escena: "library", pausa: 3000 },
  {
    nombre: "plan-decision",
    escena: "plan-questions",
    abiertos: ["Plan integrado · revisión pendiente"],
    // El hilo se ancla al final; arriba queda a la vista la frase con que pteron presenta el plan
    antes: (page) => page.evaluate(() => document.querySelector(".chat-history")?.scrollTo({ top: 0 })),
  },
  { nombre: "plan-listo", escena: "plan-ready", abiertos: ["Plan integrado · listo"] },
  { nombre: "encargo", escena: "chat-files" },
  { nombre: "write-guia", escena: "artifact", pausa: 3500 },
  { nombre: "write-ficha", escena: "writer-ficha", pausa: 3500 },
  { nombre: "write-apaisada", escena: "artifact", artefacto: "capture-seed-guide-landscape", materialesDelPrincipal: ["capture-seed-guide-ready", "capture-seed-guide-landscape", "capture-seed-presentation"], pausa: 3500 },
  { nombre: "write-respuesta", escena: "writer-respuestas", pausa: 3500 },
  { nombre: "pauta", escena: "writer-teacher-key", pausa: 3500 },
  {
    nombre: "imprimir",
    escena: "writer-archivo",
    pausa: 2500,
    antes: async (page) => {
      await page.locator('.pteron-ribbon-backstage [data-backstage-id="print"]').first().click();
      await espera(800);
    },
  },
  { nombre: "cambio-aplicado", escena: "cambio-aplicado", materialesDelPrincipal: ["capture-seed-guide", "capture-seed-presentation"], pausa: 3500 },
  { nombre: "referencia", escena: "pdf", pausa: 4500 },
  { nombre: "present", escena: "presentation", pausa: 3500 },
  { nombre: "datos", escena: "privacy", abiertos: ["Plan integrado · guía creada"], titulos: { "Plan integrado · guía creada": "Observaciones del curso" } },
  { nombre: "modelo-de-ia", escena: "settings-model" },
  { nombre: "error-exportar", escena: "export-error", pausa: 3000 },
  {
    // La marca se construye en unos 7 s y queda quieta; después, dos escenas del recorrido, cada una al final de su réplica
    nombre: "recorrido",
    pausa: 9000,
    fotos: [
      { nombre: "recorrido" },
      { nombre: "recorrido-crear", antes: async (page) => {
        await clic(".recorrido-apertura .btn-primary")(page);
        await espera(600);
        await clic('.recorrido-capitulo:text-is("Crear")')(page);
      }, pausa: 6000 },
    ],
  },
  {
    // Al entrar sin una IA que responda, la guía de IA se abre sobre la Home
    nombre: "guia-ia",
    iaResponde: false,
    pausa: 1500,
    antes: async (page) => {
      await page.locator(".recorrido-saltar").click();
      await espera(500);
      await page.locator(".recorrido-pie .btn-primary").click();
      await espera(2500);
    },
  },
];

const comoRoot = process.platform === "linux" && process.getuid?.() === 0;

async function abrir(perfil, env) {
  const app = await _electron.launch({
    executablePath: path.join(pteron, electron),
    args: [pteron, `--user-data-dir=${perfil}`, "--force-device-scale-factor=2", "--hide-scrollbars", ...(comoRoot ? ["--no-sandbox"] : [])],
    cwd: pteron,
    env: {
      ...process.env,
      PTERON_CAPTURE_THEME: "light",
      PTERON_CAPTURE_WIDTH: String(W),
      PTERON_CAPTURE_HEIGHT: String(H),
      PTERON_QA_WORKSPACE_ROOT: path.join(perfil, "Documentos", "pteron"),
      ...env,
    },
  });
  // La señal de escena montada que el renderer manda a Main (el arnés la espera en `capture:ready`)
  await evaluar(app, ({ ipcMain }) => {
    globalThis.__escena = null;
    ipcMain.on("capture:ready", (_event, resultado) => {
      globalThis.__escena = resultado ?? { ok: true };
    });
  });
  return app;
}

async function cerrar(app) {
  await Promise.race([app.close().catch(() => {}), espera(4000)]);
  try {
    app.process().kill("SIGKILL");
  } catch {
    /* ya cerró */
  }
}

async function esperarEscena(app, plazo = 45_000) {
  const desde = Date.now();
  while (Date.now() - desde < plazo) {
    // Mientras Main siembra y abre la base, Playwright puede perder una consulta: se pregunta de nuevo
    const resultado = await app.evaluate(() => globalThis.__escena).catch(() => null);
    if (resultado) return resultado;
    await espera(200);
  }
  return { ok: false, reason: "sin señal" };
}

/** Main responde como en macOS y con la IA incluida lista; los avisos nativos se aceptan, como haría el profesor. */
async function comoEnMac(app, { iaResponde = true } = {}) {
  await evaluar(app, ({ ipcMain, dialog, BrowserWindow, session }, iaResponde) => {
    // El corrector de Chromium en Linux subraya el español que macOS reconoce
    session.defaultSession.setSpellCheckerEnabled(false);
    ipcMain.removeHandler("app:platform");
    ipcMain.handle("app:platform", () => "darwin");
    if (iaResponde) {
      ipcMain.removeHandler("agent:health");
      ipcMain.handle("agent:health", async () => ({
        ok: true, message: "", model: "pteron-managed", provider: "IA incluida en pteron", modelName: "IA incluida en pteron", thinking: null,
      }));
    }
    dialog.showMessageBox = async (...opciones) => {
      const { buttons = [], cancelId = 0 } = opciones.find((o) => o && Array.isArray(o.buttons)) ?? {};
      return { response: buttons.length === 2 ? 1 : cancelId, checkboxChecked: false };
    };
    const ventana = BrowserWindow.getAllWindows()[0];
    ventana?.setContentSize(1440, 880);
    globalThis.__escena = null;
  }, iaResponde);
}

/** El marco de la ventana de macOS sobre la captura a escala 2, en un lienzo de Chromium: WebP a 2880 y a 1440. */
async function enmarcar(app, png) {
  return evaluar(app, async ({ BrowserWindow }, base64) => {
    const lienzo = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { offscreen: true } });
    await lienzo.loadURL("data:text/html,<!doctype html><title>marco</title>");
    const [dos, uno] = await lienzo.webContents.executeJavaScript(`(async () => {
      const img = new Image();
      img.src = "data:image/png;base64,${base64}";
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight, s = W / 1440;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext("2d");
      g.beginPath();
      g.roundRect(0, 0, W, H, 10 * s);
      g.clip();
      g.drawImage(img, 0, 0);
      // Los semáforos de macOS donde los pone trafficLightPosition (16, 18): centros a 20, 40 y 60 pt, a 19 pt del borde
      for (const [x, relleno, borde] of [[20, "#ff5f57", "#e0443e"], [40, "#febc2e", "#dea123"], [60, "#28c840", "#1aab29"]]) {
        g.beginPath();
        g.arc(x * s, 19 * s, 6 * s - 0.25 * s, 0, Math.PI * 2);
        g.fillStyle = relleno;
        g.fill();
        g.lineWidth = 0.5 * s;
        g.strokeStyle = borde;
        g.stroke();
      }
      const webp = async (canvas) => {
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.84 });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      const chica = new OffscreenCanvas(Math.round(W / 2), Math.round(H / 2));
      const gc = chica.getContext("2d");
      gc.imageSmoothingQuality = "high";
      gc.drawImage(c, 0, 0, chica.width, chica.height);
      return [await webp(c), await webp(chica)];
    })()`);
    lienzo.destroy();
    return [dos, uno];
  }, png.toString("base64"));
}

const paso = (texto) => process.env.CAPTURAS_DEBUG && console.log(`  · ${texto}`);

// Las que docs muestra recortadas: el recorte sale de la versión a 2880
const SOLO_2X = new Set(["modelo-de-ia"]);

async function guardar(app, nombre, png) {
  if (crudo) {
    await mkdir(crudo, { recursive: true });
    await writeFile(path.join(crudo, `${nombre}.png`), png);
  }
  const [dos, uno] = await enmarcar(app, png);
  await writeFile(path.join(salida, `${nombre}-marco-2x.webp`), Buffer.from(dos, "base64"));
  if (!SOLO_2X.has(nombre)) await writeFile(path.join(salida, `${nombre}-marco.webp`), Buffer.from(uno, "base64"));
}

async function tomar(captura) {
  const perfil = await mkdtemp(path.join(os.tmpdir(), "pteron-captura-"));
  try {
    const carpeta = path.join(perfil, "Documentos", "pteron");
    const apunte = await carpetaDelProfesor(carpeta);
    paso("siembra");
    const siembra = await abrir(perfil, { PTERON_CAPTURE_SCENE: "home", PTERON_CAPTURE_SEED: "1" });
    await esperarEscena(siembra);
    await cerrar(siembra);
    // El arnés deja un PDF de ejemplo en la carpeta; su lugar lo toma el apunte
    await writeFile(path.join(carpeta, "Material de referencia.pdf"), apunte);
    paso("mesa");
    prepararMesa(path.join(perfil, "pteron.db"), captura);

    // Sin escena, la app abre como la primera vez: el recorrido de bienvenida (ADR-183)
    const app = await abrir(perfil, {
      ...(captura.escena ? { PTERON_CAPTURE_SCENE: captura.escena } : {}),
      ...(captura.artefacto ? { PTERON_CAPTURE_ARTIFACT_ID: captura.artefacto } : {}),
    });
    try {
      const page = await app.firstWindow();
      paso("macOS");
      await comoEnMac(app, { iaResponde: captura.iaResponde ?? true });
      paso("recarga");
      await page.reload();
      if (captura.escena) {
        const escena = await esperarEscena(app);
        if (escena.ok === false) throw new Error(`la escena no se montó (${escena.reason ?? "sin motivo"})`);
      }
      await espera(captura.pausa ?? 2000);
      for (const foto of captura.fotos ?? [captura]) {
        if (foto.antes) {
          await foto.antes(page);
          await espera(foto.pausa ?? 600);
        }
        paso(`foto ${foto.nombre}`);
        await guardar(app, foto.nombre, await page.screenshot({ type: "png" }));
      }
    } finally {
      await cerrar(app);
    }
  } finally {
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
  }
}

const elegidas = solo ? CAPTURAS.filter((c) => solo.includes(c.nombre)) : CAPTURAS;
if (solo && elegidas.length !== solo.length) {
  console.error(`No existe: ${solo.filter((n) => !CAPTURAS.some((c) => c.nombre === n)).join(", ")}`);
  process.exit(1);
}
let fallas = 0;
for (const captura of elegidas) {
  const desde = Date.now();
  try {
    await tomar(captura);
    console.log(`✓ ${captura.nombre} (${captura.escena}) · ${((Date.now() - desde) / 1000).toFixed(1)} s`);
  } catch (error) {
    fallas += 1;
    console.error(`✗ ${captura.nombre} (${captura.escena}): ${error.message}`);
  }
}
process.exit(fallas ? 1 : 0);
