import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { RAIZ } from "../scripts/operador.mjs";
import { SEGURIDAD, SITE_URL, SMTP, entradasDeLista, entradasDudosas, fusionarLista, leerPlantilla, leerPlantillas, main, planear, plantillasQueDifieren } from "../scripts/supabase-auth.mjs";

const TOKEN = "sbp_token_de_prueba_0123456789";
const CLAVE_SMTP = "re_clave_smtp_de_prueba_9876543210";
const REF = "abcdefghijklmnopqrst";
const WRANGLER = { vars: { SUPABASE_URL: `https://${REF}.supabase.co`, EMAIL_FROM: "pteron <otro@patagua.dev>" } };
const URL_API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const PLANTILLAS = leerPlantillas();

// Lo que Supabase devuelve hoy en producción (sin la clave SMTP, que la API nunca da).
const CONFIG_ACTUAL = {
  site_url: "https://pteron.patagua.dev/cuenta",
  uri_allow_list: "https://pteron.patagua.dev,https://pteron.patagua.dev/cuenta",
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: "oculta-por-la-api",
  smtp_admin_email: "no-reply@patagua.dev",
  smtp_sender_name: "pteron",
  rate_limit_email_sent: 30,
  mailer_subjects_magic_link: "Your sign-in link",
  mailer_subjects_confirmation: "Confirm your email address",
  mailer_templates_magic_link_content: "<h2>Magic Link</h2><p><a href=\"{{ .ConfirmationURL }}\">Log In</a></p>",
  mailer_templates_confirmation_content: "<h2>Confirm your signup</h2>",
};

/** Supabase simulado: GET devuelve `config`; PATCH la mezcla con el cuerpo y la devuelve. */
function simular(config = CONFIG_ACTUAL, { ignorar = [] } = {}) {
  let actual = { ...config };
  const llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push({ url, metodo: init.method, auth: init.headers.Authorization, cuerpo: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === "PATCH") {
      const cuerpo = JSON.parse(init.body);
      for (const [k, v] of Object.entries(cuerpo)) if (!ignorar.includes(k)) actual[k] = v;
    }
    return new Response(JSON.stringify(actual), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { fetch, llamadas };
}

async function correr(argv, { config, env = {}, ignorar } = {}) {
  const sim = simular(config, { ignorar });
  const lineas = [];
  const codigo = await main({ argv, env: { SUPABASE_ACCESS_TOKEN: TOKEN, ...env }, fetch: sim.fetch, log: (l) => lineas.push(l), wrangler: WRANGLER });
  return { codigo, salida: lineas.join("\n"), llamadas: sim.llamadas, patch: sim.llamadas.find((l) => l.metodo === "PATCH") };
}

test("las plantillas de supabase/correos/ traen asunto en español y las variables documentadas", () => {
  for (const archivo of ["enlace-magico.html", "confirmacion.html"]) {
    const { asunto, html } = leerPlantilla(RAIZ, archivo);
    assert.ok(asunto.length > 5 && !/[a-z] [a-z]+ your /i.test(asunto));
    assert.match(html, /^<!doctype html>/i);
    assert.ok(html.includes("{{ .ConfirmationURL }}"));
    const imagenes = [...html.matchAll(/<img\b[^>]*>/gi)].map(([img]) => img);
    assert.equal(imagenes.length, 1, "sólo el logo de la banda");
    assert.ok(imagenes[0].includes('src="https://pteron.patagua.dev/assets/correo/pteron-banda-correo.png"') && imagenes[0].includes('alt="pteron"'), "el logo publicado, con texto alternativo");
    assert.ok(html.includes('href="{{ .ConfirmationURL }}"') && html.includes("{{ .Email }}") && html.includes('href="https://pteron.patagua.dev/cuenta"'), "variables literales de Supabase");
    // Site URL ya es /cuenta: {{ .SiteURL }}/cuenta daría /cuenta/cuenta (404). El pie usa la dirección absoluta.
    assert.ok(!html.includes("{{ .SiteURL }}/cuenta"), "el pie no arma /cuenta/cuenta");
    assert.doesNotMatch(html, /por definir|\{\{ \.Token/i);
    assert.ok(!/<script\b|<link\b/i.test(html));
    const vars = [...html.matchAll(/\{\{\s*\.(\w+)\s*\}\}/g)].map((m) => m[1]);
    assert.ok(vars.every((v) => ["ConfirmationURL", "Email", "SiteURL", "Token", "TokenHash"].includes(v)), `variables: ${vars}`);
    assert.ok(!html.includes("<!-- asunto"), "el comentario del asunto no va en el HTML");
  }
  assert.equal(PLANTILLAS.mailer_subjects_magic_link, "Tu enlace para entrar a pteron");
  assert.equal(PLANTILLAS.mailer_subjects_confirmation, "Confirma tu correo en pteron");
  assert.throws(() => leerPlantilla(path.join(RAIZ, "tests"), "x.html"));
});

test("uri_allow_list: agrega la dirección y conserva todas las entradas, en su orden", () => {
  assert.deepEqual(entradasDeLista(" a , b,,c "), ["a", "b", "c"]);
  const m = fusionarLista("https://pteron.patagua.dev,http://localhost:3000, https://otra.app/*", SITE_URL);
  assert.equal(m.agregar, true);
  assert.equal(m.lista, `https://pteron.patagua.dev,http://localhost:3000,https://otra.app/*,${SITE_URL}`);
  assert.equal(fusionarLista("", SITE_URL).lista, SITE_URL);
  assert.equal(fusionarLista(null, SITE_URL).lista, SITE_URL);
  const ya = fusionarLista(`${SITE_URL},https://x.test`, SITE_URL);
  assert.equal(ya.agregar, false);
  assert.equal(ya.lista, `${SITE_URL},https://x.test`);
});

test("el ensayo lee la configuración, imprime el plan y no hace PATCH", async () => {
  const r = await correr([]);
  assert.equal(r.codigo, 0);
  assert.equal(r.patch, undefined);
  assert.equal(r.llamadas.length, 1);
  assert.equal(r.llamadas[0].url, URL_API);
  assert.equal(r.llamadas[0].metodo, "GET");
  assert.equal(r.llamadas[0].auth, `Bearer ${TOKEN}`);
  assert.match(r.salida, /site_url: https:\/\/pteron\.patagua\.dev\/cuenta/);
  assert.match(r.salida, /SMTP propio: sí/);
  assert.match(r.salida, /remitente: pteron <no-reply@patagua\.dev>/);
  assert.match(r.salida, /rate_limit_email_sent: 30/);
  assert.match(r.salida, /correos que difieren de supabase\/correos\/: enlace mágico, confirmación de correo/);
  assert.match(r.salida, /SMTP: sin tocar/);
  assert.match(r.salida, /rate_limit_email_sent: se deja en 30/);
  assert.match(r.salida, /uri_allow_list: ya incluye/);
  assert.match(r.salida, /Ensayo: no se cambió nada/);
  assert.ok(!r.salida.includes("<h2>") && !r.salida.includes("oculta-por-la-api"), "no imprime HTML ni la clave que devuelve la API");
});

test("--aplicar hace un PATCH sólo con lo que difiere y nunca manda smtp_*", async () => {
  const r = await correr(["--aplicar"]);
  assert.equal(r.codigo, 0);
  assert.equal(r.patch.url, URL_API);
  assert.deepEqual(Object.keys(r.patch.cuerpo).sort(), [
    "mailer_subjects_confirmation",
    "mailer_subjects_magic_link",
    "mailer_templates_confirmation_content",
    "mailer_templates_magic_link_content",
  ]);
  assert.equal(r.patch.cuerpo.mailer_subjects_magic_link, "Tu enlace para entrar a pteron");
  assert.ok(r.patch.cuerpo.mailer_templates_magic_link_content.startsWith("<!doctype html>"));
  assert.ok(!Object.keys(r.patch.cuerpo).some((k) => k.startsWith("smtp_")));
  assert.match(r.salida, /Comprobado/);
});

test("una segunda corrida ya no tiene nada que cambiar y no hace PATCH", async () => {
  const config = { ...CONFIG_ACTUAL, ...Object.fromEntries(Object.entries(PLANTILLAS)) };
  const r = await correr(["--aplicar"], { config });
  assert.equal(r.codigo, 0);
  assert.equal(r.patch, undefined);
  assert.match(r.salida, /Nada que cambiar/);
});

test("agrega site_url y la dirección a uri_allow_list sin perder entradas", async () => {
  const config = { ...CONFIG_ACTUAL, site_url: "https://pteron.patagua.dev", uri_allow_list: "https://pteron.patagua.dev,http://localhost:5173" };
  const r = await correr(["--aplicar"], { config });
  assert.equal(r.codigo, 0);
  assert.equal(r.patch.cuerpo.site_url, SITE_URL);
  assert.equal(r.patch.cuerpo.uri_allow_list, `https://pteron.patagua.dev,http://localhost:5173,${SITE_URL}`);
});

test("el correo prueba quién es la cuenta: --aplicar deja confirmación obligatoria, sin anónimas y con cambio de correo seguro", async () => {
  const listas = { ...CONFIG_ACTUAL, ...Object.fromEntries(Object.entries(PLANTILLAS)) };
  const inseguro = { ...listas, mailer_autoconfirm: true, mailer_allow_unverified_email_sign_ins: true, mailer_secure_email_change_enabled: false, external_anonymous_users_enabled: true };
  const ensayo = await correr([], { config: inseguro });
  assert.equal(ensayo.patch, undefined);
  assert.match(ensayo.salida, /^  mailer_autoconfirm: true$/m);
  assert.match(ensayo.salida, /mailer_autoconfirm: true -> false \(cada cuenta confirma su correo antes de entrar\)/);
  assert.match(ensayo.salida, /external_anonymous_users_enabled: true -> false \(no hay cuentas anónimas\)/);

  const r = await correr(["--aplicar"], { config: inseguro });
  assert.equal(r.codigo, 0);
  assert.deepEqual(r.patch.cuerpo, Object.fromEntries(SEGURIDAD.map(({ campo, valor }) => [campo, valor])));
  assert.match(r.salida, /Comprobado/);

  // Si Supabase no lo deja así, sale con 1 y dice cuál
  const terco = await correr(["--aplicar"], { config: inseguro, ignorar: ["mailer_autoconfirm"] });
  assert.equal(terco.codigo, 1);
  assert.match(terco.salida, /DIFIERE tras aplicar: mailer_autoconfirm/);

  // Ya seguro: nada que cambiar
  const seguro = await correr(["--aplicar"], { config: { ...listas, ...Object.fromEntries(SEGURIDAD.map(({ campo, valor }) => [campo, valor])) } });
  assert.equal(seguro.patch, undefined);
  assert.match(seguro.salida, /mailer_autoconfirm: ya es false/);
  assert.match(seguro.salida, /Nada que cambiar/);
});

test("un ajuste de seguridad que la API no devuelve no se envía: se informa para revisarlo en el panel", async () => {
  const config = { ...CONFIG_ACTUAL, ...Object.fromEntries(Object.entries(PLANTILLAS)) };
  const r = await correr(["--aplicar"], { config });
  assert.equal(r.patch, undefined);
  for (const { campo } of SEGURIDAD) assert.match(r.salida, new RegExp(`${campo}: \\(sin dato\\) no se envía`));
});

test("uri_allow_list: un comodín o un dominio ajeno se informa, sin quitarlo", async () => {
  assert.deepEqual(entradasDudosas("https://pteron.patagua.dev/cuenta,http://localhost:8787,https://*.vercel.app/**,https://otro.example/cuenta"), ["https://*.vercel.app/**", "https://otro.example/cuenta"]);
  assert.deepEqual(entradasDudosas("https://pteron.patagua.dev.otro.example/cuenta"), ["https://pteron.patagua.dev.otro.example/cuenta"]);
  const config = { ...CONFIG_ACTUAL, uri_allow_list: `${SITE_URL},https://*.vercel.app/**` };
  const r = await correr(["--aplicar"], { config });
  assert.match(r.salida, /uri_allow_list: revisa https:\/\/\*\.vercel\.app\/\*\* \(un enlace mágico puede volver ahí con la sesión; el script no quita entradas\)/);
  assert.ok(!("uri_allow_list" in (r.patch?.cuerpo ?? {})), "no se toca la lista");
});

test("--limite-correos cambia sólo ese campo; sin la bandera el límite no se toca", async () => {
  const conLimite = await correr(["--aplicar", "--limite-correos", "60"], { config: { ...CONFIG_ACTUAL, ...PLANTILLAS } });
  assert.deepEqual(conLimite.patch.cuerpo, { rate_limit_email_sent: 60 });
  const otro = await correr(["--aplicar"], { config: { ...CONFIG_ACTUAL, ...PLANTILLAS, rate_limit_email_sent: 2 } });
  assert.equal(otro.patch, undefined);
  assert.match(otro.salida, /se deja en 2/);
  for (const malo of ["0", "-3", "abc", "1.5"]) {
    const r = await correr(["--limite-correos", malo]);
    assert.equal(r.codigo, 2, malo);
    assert.equal(r.llamadas.length, 0);
  }
});

test("--smtp exige RESEND_SMTP_KEY y sólo entonces manda smtp_*; la clave nunca se imprime", async () => {
  const sin = await correr(["--smtp", "--aplicar"]);
  assert.equal(sin.codigo, 1);
  assert.match(sin.salida, /RESEND_SMTP_KEY/);
  assert.equal(sin.llamadas.length, 0);

  const ensayo = await correr(["--smtp"], { env: { RESEND_SMTP_KEY: CLAVE_SMTP } });
  assert.equal(ensayo.patch, undefined);
  assert.match(ensayo.salida, /SMTP: --smtp fija smtp\.resend\.com:465, usuario resend/);
  assert.match(ensayo.salida, /pteron <no-reply@patagua\.dev>/);

  const r = await correr(["--smtp", "--aplicar"], { env: { RESEND_SMTP_KEY: CLAVE_SMTP } });
  assert.equal(r.codigo, 0);
  assert.deepEqual(
    { ...r.patch.cuerpo, smtp_pass: undefined, mailer_templates_magic_link_content: undefined, mailer_templates_confirmation_content: undefined, mailer_subjects_magic_link: undefined, mailer_subjects_confirmation: undefined },
    { ...SMTP, smtp_pass: undefined, mailer_templates_magic_link_content: undefined, mailer_templates_confirmation_content: undefined, mailer_subjects_magic_link: undefined, mailer_subjects_confirmation: undefined },
  );
  assert.equal(r.patch.cuerpo.smtp_pass, CLAVE_SMTP);
  assert.equal(r.patch.cuerpo.smtp_port, "465", "smtp_port es texto en la API");
  assert.equal(r.patch.cuerpo.smtp_admin_email, "no-reply@patagua.dev", "no usa EMAIL_FROM del Worker");
  assert.ok(!r.salida.includes(CLAVE_SMTP));
});

test("si Supabase no deja las plantillas como se pidieron, sale con 1", async () => {
  const r = await correr(["--aplicar"], { ignorar: ["mailer_templates_confirmation_content"] });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /DIFIERE tras aplicar: correos \(confirmación de correo\)/);
});

test("ninguna salida contiene los tokens, tampoco cuando la API los repite en un error", async () => {
  const lineas = [];
  const fetch = async () => new Response(JSON.stringify({ message: `bad ${TOKEN} y ${CLAVE_SMTP}` }), { status: 403 });
  const codigo = await main({ argv: ["--smtp", "--aplicar"], env: { SUPABASE_ACCESS_TOKEN: TOKEN, RESEND_SMTP_KEY: CLAVE_SMTP }, fetch, log: (l) => lineas.push(l), wrangler: WRANGLER });
  assert.equal(codigo, 1);
  const salida = lineas.join("\n");
  assert.match(salida, /respuesta 403/);
  for (const secreto of [TOKEN, CLAVE_SMTP]) {
    assert.ok(!salida.includes(secreto));
    assert.ok(!salida.includes(secreto.slice(0, 12)));
  }
  const completa = await correr(["--smtp", "--aplicar"], { env: { RESEND_SMTP_KEY: CLAVE_SMTP } });
  assert.ok(!completa.salida.includes(TOKEN) && !completa.salida.includes(CLAVE_SMTP));
});

test("planear compara asunto y HTML sin importar espacios", () => {
  const igual = { ...CONFIG_ACTUAL, ...Object.fromEntries(Object.entries(PLANTILLAS).map(([k, v]) => [k, v.replace(/\n/g, "\r\n  ")])) };
  assert.deepEqual(plantillasQueDifieren(igual, PLANTILLAS), []);
  assert.deepEqual(plantillasQueDifieren(CONFIG_ACTUAL, PLANTILLAS), ["enlace mágico", "confirmación de correo"]);
  const { cuerpo } = planear(igual, { plantillas: PLANTILLAS });
  assert.deepEqual(cuerpo, {});
});

test("sin token falla sin llamar a la red", async () => {
  const lineas = [];
  let llamado = false;
  const codigo = await main({ argv: [], env: {}, fetch: async () => ((llamado = true), new Response("{}")), log: (l) => lineas.push(l), wrangler: WRANGLER });
  assert.equal(codigo, 1);
  assert.equal(llamado, false);
  assert.match(lineas.join("\n"), /Falta SUPABASE_ACCESS_TOKEN/);
});
