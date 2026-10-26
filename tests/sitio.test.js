import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const read = (rel) => readFileSync(path.join(pub, rel), "utf8");

function* pages(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "assets") continue;
    if (statSync(full).isDirectory()) yield* pages(full);
    else if (name.endsWith(".html")) yield path.relative(pub, full).split(path.sep).join("/");
  }
}
const ALL = [...pages(pub)];

test("cada página trae la esquina, el colofón y el índice al día (node scripts/sitio.mjs)", () => {
  assert.ok(ALL.length >= 9, "están todas las páginas");
  for (const page of ALL) {
    const html = read(page);
    for (const name of ["esquina", "colofon", "indice"]) {
      assert.equal(html.split(`<!-- ${name}:inicio -->`).length, 2, `${page}: un solo bloque ${name}`);
    }
    assert.equal((html.match(/<dialog class="indice" id="indice"/g) || []).length, 1, `${page}: un índice`);
    assert.equal((html.match(/<footer class="colofon" id="colofon">/g) || []).length, 1, `${page}: un colofón`);
  }
  // --revisar sale con error si alguna página quedó desactualizada
  execFileSync(process.execPath, [path.join(root, "scripts/sitio.mjs"), "--revisar"], { stdio: "pipe" });
});

test("el pie legal de todas las páginas nombra al vendedor y su RUT, con los enlaces legales", () => {
  for (const page of ALL) {
    const legal = /<div class="colofon-legal">([\s\S]*?)<\/div>/.exec(read(page))[1];
    assert.match(legal, /© <span data-year>2026<\/span> Patagua\.dev SpA · RUT 78\.418\.149-9/, `${page}: vendedor y RUT`);
    assert.doesNotMatch(legal, /pteron · Patagua/, `${page}: sin la línea anterior`);
    assert.ok(legal.includes('href="/privacidad"') && legal.includes('href="/terminos"'), `${page}: enlaces legales`);
  }
});

test("el índice y el colofón marcan la página actual, y sólo esa", () => {
  const cases = [["index.html", "/"], ["planes/index.html", "/planes"], ["descargar/index.html", "/descargar"], ["docs/index.html", "/docs"], ["cuenta/index.html", "/cuenta"]];
  for (const [page, href] of cases) {
    const html = read(page);
    const current = [...html.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(current, [href, href], `${page}: colofón e índice marcan ${href}`);
  }
  // Las páginas legales se marcan en el pie del colofón y en el pie del índice
  assert.deepEqual([...read("privacidad.html").matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]), ["/privacidad", "/privacidad"]);
  assert.equal(read("404.html").includes('aria-current="page"'), false);
});

test("Descargar flota sólo en el inicio (parte oculto) y en /planes; en la documentación taparía el texto", () => {
  const corner = (page) => read(page).match(/<nav class="esquina"[\s\S]*?<\/nav>/)[0];
  assert.match(corner("planes/index.html"), /esquina-descargar" href="\/descargar" data-descargar>Descargar<\/a>/);
  assert.match(corner("index.html"), /data-descargar data-oculto>Descargar<\/a>/);
  for (const page of ["docs/index.html", "descargar/index.html", "admin/index.html", "cuenta/index.html", "privacidad.html", "terminos.html", "404.html", "marca/index.html"]) {
    assert.doesNotMatch(corner(page), /esquina-descargar/, `${page} no lleva Descargar flotante`);
  }
});

test("todas las páginas usan la misma versión de caché y ninguna carga letras de terceros", () => {
  const versions = new Set();
  for (const page of ALL) {
    const html = read(page);
    for (const m of html.matchAll(/\?v=([0-9.-]+)/g)) versions.add(m[1]);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, `${page} no pide letras a Google`);
    assert.match(html, /<html lang="es-CL" class="no-js">/, `${page} parte sin JavaScript`);
  }
  assert.equal(versions.size, 1, `una sola versión: ${[...versions].join(", ")}`);
});

test("el inicio se presenta a los buscadores como el sitio pteron, sin datos de producto ni de precio", () => {
  const html = read("index.html");
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(bloques.length, 1, "un solo bloque de datos estructurados");
  const canonica = /<link rel="canonical" href="([^"]+)">/.exec(html)[1];
  assert.deepEqual(bloques[0], { "@context": "https://schema.org", "@type": "WebSite", name: "pteron", url: canonica, inLanguage: "es-CL" });
  for (const page of ALL.filter((page) => page !== "index.html")) {
    assert.doesNotMatch(read(page), /application\/ld\+json/, `${page}: sólo el inicio`);
  }
});

test("la 404 dice qué pasó y es noindex", () => {
  const html = read("404.html");
  assert.match(html, /<h1>Página no encontrada<\/h1>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test("la esquina doblada abre el índice: sin JavaScript lleva al pie y su nombre es «Índice»", () => {
  for (const page of ALL) {
    const corner = read(page).match(/<nav class="esquina"[\s\S]*?<\/nav>/)[0];
    assert.match(corner, /<a class="oreja" href="#colofon" data-indice>/, `${page}: la esquina lleva al pie sin JavaScript`);
    assert.match(corner, /<span class="sr-only">Índice<\/span><\/a>/, `${page}: nombre accesible`);
  }
  const dialog = read("planes/index.html").match(/<dialog class="indice"[\s\S]*?<\/dialog>/)[0];
  assert.match(dialog, /<h2 class="indice-titulo" id="indice-titulo">Índice<\/h2>/);
  assert.match(dialog, /<nav class="indice-bloque" aria-labelledby="indice-aqui" data-indice-capitulos hidden>/, "los capítulos parten ocultos: los arma script.js");
  assert.match(dialog, /<a href="\/planes" aria-current="page">Planes<\/a>/);
});

test("los capítulos de cada página tienen ancla y nombre; los del inicio siguen el recorrido", () => {
  for (const page of ALL) {
    for (const m of read(page).matchAll(/<[a-z]+ [^>]*data-capitulo="([^"]*)"[^>]*>/g)) {
      assert.match(m[0], /\sid="[^"]+"/, `${page}: capítulo «${m[1]}» sin id`);
      assert.ok(m[1].trim(), `${page}: capítulo sin nombre en ${m[0]}`);
    }
  }
  const home = [...read("index.html").matchAll(/data-capitulo="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(home, ["Portada", "Cuatro hojas", "Cómo funciona", "La hoja", "En tu computador", "macOS, Windows y Linux"]);
  assert.match(read("index.html"), /id="hojas" data-mesa data-capitulo="Cuatro hojas" data-capitulo-avance="0\.9"/, "las hojas son un momento de la escena");
  const legal = (page) => [...read(page).matchAll(/<section id="([^"]+)" data-capitulo/g)].map((m) => m[1]);
  assert.deepEqual(legal("terminos.html"), ["naturaleza", "disponibilidad", "precio", "prueba", "renovacion", "cobros", "cuota", "ia-incluida", "uso", "responsabilidad", "propiedad", "contacto"]);
  assert.deepEqual(legal("privacidad.html"), ["minimizacion", "trabajo-local", "originales", "estudiantes", "cuenta", "ia-incluida", "proveedores", "sitio-web", "consultas"]);
  // El índice al costado de cada página legal nombra y numera sus secciones en el mismo orden
  for (const page of ["terminos.html", "privacidad.html"]) {
    const html = read(page);
    const indice = [...html.match(/<nav class="legal-indice"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="#([^"]+)">/g)].map((m) => m[1]).filter((id) => id !== "creditos");
    assert.deepEqual(indice, legal(page), `${page}: el índice sigue las secciones`);
  }
});

// Lo que se cobra y cómo, dicho igual en todo el sitio (contrato R9 §11). Una cifra o una condición que cambie en una
// página y no en otra es justo lo que no puede pasar con un precio.
test("precio, prueba y cuota de los planes: los mismos en el inicio, /planes, /cuenta y los Términos", () => {
  const PRUEBA = "Registras tu tarjeta en Flow y no se cobra nada durante la prueba. Si no cancelas antes, se cobran $2.990 al terminar los 7 días y luego cada mes, hasta que canceles.";
  for (const page of ALL.filter((page) => !page.startsWith("admin/"))) {
    assert.doesNotMatch(read(page), /\$\s?2\.999/, `${page}: no queda el precio anterior`);
    assert.doesNotMatch(read(page), /hoy no tiene tope|por definir/, `${page}: la cuota ya está publicada`);
  }
  const planes = read("planes/index.html");
  assert.match(planes, /\$2\.990 <small>CLP al mes, IVA incluido<\/small>/);
  assert.match(planes, /\$9\.990 <small>CLP al mes, IVA incluido<\/small>/);
  assert.ok(planes.includes(`<span class="destacado">7 días gratis.</span> ${PRUEBA}`), "/planes: la prueba y la renovación juntas");
  assert.match(planes, /Una prueba por persona\./);
  // La barra que acompaña cada cuota es un dibujo (aria-hidden): la cifra la dice el texto
  assert.match(planes, /<li>6\.000\.000 unidades de IA por período \(1\.500\.000 durante la prueba\)<span class="plan-ia" aria-hidden="true" style="--ia:\.2"><i><\/i><\/span><\/li>/);
  assert.match(planes, /<li>30\.000\.000 unidades de IA por período<span class="plan-ia" aria-hidden="true" style="--ia:1"><i><\/i><\/span><\/li>/);
  assert.match(planes, /El período se renueva con tu cobro/);
  assert.doesNotMatch(planes, /\d+ (guías|pruebas|materiales|planificaciones) (al|por) (mes|período)/, "la equivalencia en materiales no se inventa");
  assert.doesNotMatch(planes, /Conexión prioritaria/);
  assert.ok(read("terminos.html").includes(`7 días gratis. ${PRUEBA}`), "Términos: la prueba con las mismas palabras");
  // Un precio que se nombre en cualquier página es uno de los del catálogo; el de /cuenta, antes de Flow, lo arma
  // cuenta.js desde el catálogo (tests/cuenta.test.js)
  for (const page of ALL.filter((page) => !page.startsWith("admin/"))) {
    for (const [, cifra] of read(page).matchAll(/\$\s?(\d{1,3}(?:\.\d{3})+)/g)) {
      assert.ok(["2.990", "9.990"].includes(cifra), `${page}: $${cifra} no es un precio del catálogo`);
    }
  }
});

test("/cuenta parte con la venta cerrada y pide aceptar los Términos vigentes antes de Flow", () => {
  const cuenta = read("cuenta/index.html");
  for (const plan of ["basic", "pro"]) {
    assert.match(cuenta, new RegExp(`data-checkout-plan="${plan}" disabled>Disponible pronto</button>`), `${plan}: sin catálogo no se vende`);
  }
  const resumen = cuenta.match(/<section class="hoja-panel resumen"[\s\S]*?<\/section>/)[0];
  assert.match(resumen, /data-checkout-summary/);
  assert.match(resumen, /<input type="checkbox" data-terms-accept/);
  const casilla = resumen.match(/<label class="casilla">([\s\S]*?)<\/label>/)[1].replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  assert.equal(casilla, "Leí y acepto los Términos (versión 2026-10-13) y la Política de privacidad");
  assert.match(resumen, /<a href="\/terminos"/);
  assert.match(resumen, /<a href="\/privacidad"/);
  // La versión que muestra la casilla es la que publica la página de los Términos
  assert.match(read("terminos.html"), /<p class="legal-fecha">Versión 2026-10-13<\/p>/);
  // Privacidad lleva su propia versión (la casilla no la cita): la de arriba y la del final son la misma
  const privacidad = read("privacidad.html");
  const version = /<p class="legal-fecha">Versión (\d{4}-\d{2}-\d{2})<\/p>/.exec(privacidad)?.[1];
  assert.ok(version, "Privacidad muestra su versión");
  assert.match(privacidad, new RegExp(`<p>Esta es la versión ${version} de la política\\.</p>`));
});

// Entrar con un proveedor le entrega datos de la cuenta: cada botón a la vista en /cuenta tiene su párrafo en «Cuenta y
// planes» y su línea en «Proveedores», y uno oculto todavía no se declara
test("cada proveedor con que se entra a /cuenta está declarado en Privacidad; el que sigue oculto, no", () => {
  const privacidad = read("privacidad.html");
  const seccion = (id) => new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(privacidad)[0];
  const botones = [...read("cuenta/index.html").matchAll(/data-oauth-provider="(\w+)"( hidden)?>/g)].map((m) => [m[1], Boolean(m[2])]);
  assert.deepEqual(botones, [["google", false], ["apple", false]]);
  for (const [proveedor, oculto] of botones) {
    const nombre = { google: "Google", apple: "Apple" }[proveedor];
    const declarado = seccion("cuenta").includes(`<p>Si entras con ${nombre},`) && seccion("proveedores").includes(`<li><strong>${nombre}</strong>, sólo si eliges entrar con ${nombre},`);
    assert.equal(declarado, !oculto, oculto ? `${nombre} sigue oculto: Privacidad todavía no lo nombra` : `${nombre} está a la vista: Privacidad lo declara`);
  }
});

test("/planes parte con «Disponible pronto»: «Elegir» queda oculto hasta que /api/plans diga que se vende", () => {
  const planes = read("planes/index.html");
  for (const [id, nombre, estilo] of [["basic", "Basic", "boton-tinta"], ["pro", "Pro", "boton-papel"]]) {
    assert.ok(planes.includes(`<a class="boton ${estilo} plan-accion" href="/cuenta?plan=${id}" data-plan-venta="${id}" hidden>Elegir ${nombre}</a>`), `${id}: el enlace parte oculto`);
    assert.ok(planes.includes(`<button class="boton ${estilo} plan-accion" type="button" data-plan-pronto="${id}" disabled>Disponible pronto</button>`), `${id}: sin catálogo no se vende`);
  }
  assert.match(read("planes/planes.css"), /\.plan-accion:disabled\{opacity:\.7;cursor:default\}/);
});

test("lo que se dice de Anthropic calza con su política: borra lo de la API dentro de 30 días", () => {
  // Anthropic borra entradas y salidas de la API dentro de 30 días; «por defecto, no lo guarda» no era cierto
  for (const ruta of ["privacidad.html", "planes/index.html", "docs/content.js"]) {
    const texto = read(ruta);
    assert.doesNotMatch(texto, /por defecto, no lo (guarda|conserva)/, ruta);
    assert.match(texto, /Anthropic no entrena sus modelos con ese contenido y lo borra (de sus sistemas )?dentro de 30 días/, ruta);
  }
});

test("/descargar: los comandos GPG se copian tal cual y se cortan entre argumentos, no en un guion", () => {
  const pre = /<pre id="gpg-comandos">([\s\S]*?)<\/pre>/.exec(read("descargar/index.html"))?.[1];
  assert.ok(pre, "/descargar trae los comandos");
  // «Copiar» copia el textContent: los <span> no agregan nada
  const texto = pre.replace(/<\/?span>/g, "").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  assert.equal(texto, "gpg --show-keys --fingerprint pteron-releases-public.asc\ngpg --import pteron-releases-public.asc\ngpg --verify pteron-<versión>-x86_64.AppImage.asc pteron-<versión>-x86_64.AppImage");
  // Después de un guion se puede cortar la línea: cada argumento que lo lleva va en un <span> que descargar.css no parte
  for (const palabra of pre.replace(/<span>[^<]*<\/span>/g, "").split(/\s+/)) assert.doesNotMatch(palabra, /-/, `${palabra} va en un <span>`);
  assert.match(read("descargar/descargar.css"), /\.codigo pre span\{display:inline-block;max-width:calc\(100% - 2ch\);/);
});

// Privacidad dice lo que hace la analítica de visitas (README, «Analítica»): Cloudflare Web Analytics, que el borde
// inyecta, sin cookies y sin lo que va tras «?» o «#». El ejemplo de una descarga es una página que existe
test("Privacidad declara la analítica de visitas y sólo lo que registra", () => {
  const privacidad = read("privacidad.html");
  const sitio = privacidad.match(/<section id="sitio-web"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(privacidad, /no incorpora analítica/, "ya no dice que no hay analítica");
  assert.match(sitio, /cuenta sus visitas con Cloudflare Web Analytics, sin cookies y sin guardar nada en tu navegador/);
  assert.match(sitio, /sin lo que va tras «\?» o «#»/);
  assert.match(sitio, /No sirve para seguirte entre sitios ni para publicidad/);
  for (const [, ruta] of sitio.matchAll(/\((?:por ejemplo, )?(\/descargar\/[a-z]+)\)/g)) {
    assert.ok(read(`${ruta.slice(1)}/index.html`), `${ruta} existe`);
  }
  assert.match(privacidad, /<strong>Cloudflare<\/strong> aloja este sitio y el servidor de pteron en su red global, y cuenta las visitas de esta web/);
});
