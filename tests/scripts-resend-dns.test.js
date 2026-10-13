import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMINIO, compararRegistro, cuerpoRegistroCloudflare, limpiarContenido, main, nombreCompleto, normalizarRegistroResend } from "../scripts/resend-dns.mjs";

const CLAVE_RESEND = "re_clave_resend_de_prueba_0123456789";
const TOKEN_CF = "cf_token_de_prueba_9876543210abcdef";
const ENV = { RESEND_API_KEY: CLAVE_RESEND, CLOUDFLARE_API_TOKEN: TOKEN_CF };
const ID_DOMINIO = "d91cd9bd-1176-453e-8fc1-35364d380206";
const ZONA = "zona123";
const DKIM = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDsc4Lh8xilsngyKEgN2S84";

// Lo que Resend devuelve: nombres relativos (como en su documentación), el SPF entre comillas.
const REGISTROS_RESEND = [
  { record: "DKIM", name: "resend._domainkey", type: "TXT", value: DKIM, status: "verified", ttl: "Auto" },
  { record: "SPF", name: "send", type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, status: "verified", ttl: "Auto" },
  { record: "SPF", name: "send", type: "TXT", value: "\"v=spf1 include:amazonses.com ~all\"", status: "verified", ttl: "Auto" },
];

// Los mismos registros ya puestos en Cloudflare, más otros ajenos.
const DNS_COMPLETO = [
  { id: "r1", type: "TXT", name: "resend._domainkey.patagua.dev", content: `"${DKIM}"` },
  { id: "r2", type: "MX", name: "send.patagua.dev", content: "feedback-smtp.us-east-1.amazonses.com", priority: 10 },
  { id: "r3", type: "TXT", name: "send.patagua.dev", content: "v=spf1 include:amazonses.com ~all" },
  { id: "r4", type: "A", name: "patagua.dev", content: "192.0.2.1", proxied: true },
  { id: "r5", type: "TXT", name: "patagua.dev", content: "google-site-verification=abc" },
];

/** Resend y Cloudflare simulados. `estado` se puede mutar entre llamadas. */
function simular({ dominios, registros = REGISTROS_RESEND, dns = DNS_COMPLETO, estadoDominio = "verified", zonas } = {}) {
  const e = { dominios: dominios ?? [{ id: ID_DOMINIO, name: DOMINIO, status: estadoDominio }], dns: [...dns], zonas: zonas ?? [{ id: ZONA, name: DOMINIO }] };
  const llamadas = [];
  const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
  const fetch = async (url, init) => {
    const u = new URL(url);
    const metodo = init.method;
    const cuerpo = init.body ? JSON.parse(init.body) : undefined;
    llamadas.push({ host: u.host, ruta: u.pathname, consulta: u.search, metodo, auth: init.headers.Authorization, cuerpo });
    if (u.host === "api.resend.com") {
      if (u.pathname === "/domains" && metodo === "GET") return json({ object: "list", has_more: false, data: e.dominios });
      if (u.pathname === "/domains" && metodo === "POST") {
        e.dominios.push({ id: ID_DOMINIO, name: cuerpo.name, status: "not_started" });
        return json({ id: ID_DOMINIO, name: cuerpo.name, status: "not_started", records: registros });
      }
      if (u.pathname === `/domains/${ID_DOMINIO}` && metodo === "GET") return json({ object: "domain", id: ID_DOMINIO, name: DOMINIO, status: estadoDominio, records: registros });
      if (u.pathname === `/domains/${ID_DOMINIO}/verify` && metodo === "POST") return json({ object: "domain", id: ID_DOMINIO });
    }
    if (u.host === "api.cloudflare.com") {
      if (u.pathname === "/client/v4/zones") return json({ success: true, result: e.zonas });
      if (u.pathname === `/client/v4/zones/${ZONA}/dns_records` && metodo === "GET") return json({ success: true, result: e.dns, result_info: { page: 1, total_pages: 1 } });
      if (u.pathname === `/client/v4/zones/${ZONA}/dns_records` && metodo === "POST") {
        e.dns.push({ id: `nuevo${e.dns.length}`, ...cuerpo });
        return json({ success: true, result: cuerpo });
      }
    }
    return json({ message: "no simulado" }, 404);
  };
  return { fetch, llamadas, estado: e };
}

async function correr(argv, opciones, env = ENV) {
  const sim = simular(opciones);
  const lineas = [];
  const codigo = await main({ argv, env, fetch: sim.fetch, log: (l) => lineas.push(l), pausa: 0 });
  const escrituras = sim.llamadas.filter((l) => l.metodo !== "GET");
  return { codigo, salida: lineas.join("\n"), llamadas: sim.llamadas, escrituras, sim };
}

test("normaliza nombres y contenido como los entiende Cloudflare", () => {
  assert.equal(nombreCompleto("send"), "send.patagua.dev");
  assert.equal(nombreCompleto("links.patagua.dev"), "links.patagua.dev");
  assert.equal(nombreCompleto("@"), "patagua.dev");
  assert.equal(nombreCompleto("Send.Patagua.Dev."), "send.patagua.dev");
  assert.equal(limpiarContenido("TXT", '"v=spf1 " "~all"'), "v=spf1 ~all");
  assert.equal(limpiarContenido("MX", "Feedback-SMTP.example.com."), "feedback-smtp.example.com");
  const r = normalizarRegistroResend({ record: "SPF", name: "send", type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10 });
  assert.deepEqual([r.tipo, r.nombre, r.prioridad], ["MX", "send.patagua.dev", 10]);
});

test("el ensayo con todo en su lugar no escribe nada y avisa que está en orden", async () => {
  const r = await correr([]);
  assert.equal(r.codigo, 0);
  assert.equal(r.escrituras.length, 0);
  assert.match(r.salida, /Resend: patagua\.dev existe, estado verified/);
  assert.match(r.salida, /DKIM TXT resend\._domainkey\.patagua\.dev: ya está · Resend: verified/);
  assert.match(r.salida, /SPF MX send\.patagua\.dev: ya está/);
  assert.match(r.salida, /SPF TXT send\.patagua\.dev: ya está/);
  assert.match(r.salida, /Todo en orden/);
  assert.equal(r.llamadas.find((l) => l.host === "api.cloudflare.com").auth, `Bearer ${TOKEN_CF}`);
  assert.equal(r.llamadas[0].auth, `Bearer ${CLAVE_RESEND}`);
});

test("--aplicar con todo en su lugar y el dominio verificado no hace ninguna escritura", async () => {
  const r = await correr(["--aplicar"]);
  assert.equal(r.codigo, 0);
  assert.equal(r.escrituras.length, 0);
});

test("ensayo: lo que falta se informa y no se crea; --aplicar lo crea sin proxy y pide verificar", async () => {
  const dns = DNS_COMPLETO.filter((d) => d.id !== "r1" && d.id !== "r3");
  const ensayo = await correr([], { dns, estadoDominio: "not_started" });
  assert.equal(ensayo.codigo, 0);
  assert.equal(ensayo.escrituras.length, 0);
  assert.match(ensayo.salida, /DKIM TXT resend\._domainkey\.patagua\.dev: falta \(se crearía\)/);
  assert.match(ensayo.salida, /faltan 2 registro\(s\)/);

  const r = await correr(["--aplicar"], { dns, estadoDominio: "not_started" });
  assert.equal(r.codigo, 0);
  const cf = r.escrituras.filter((l) => l.host === "api.cloudflare.com");
  assert.equal(cf.length, 2);
  for (const c of cf) assert.equal(c.cuerpo.proxied, false);
  assert.deepEqual(cf.map((c) => [c.cuerpo.type, c.cuerpo.name, c.cuerpo.content]), [
    ["TXT", "resend._domainkey.patagua.dev", DKIM],
    ["TXT", "send.patagua.dev", "v=spf1 include:amazonses.com ~all"],
  ]);
  assert.ok(cf.every((c) => c.cuerpo.ttl === 1));
  const verificar = r.escrituras.filter((l) => l.ruta.endsWith("/verify"));
  assert.equal(verificar.length, 1);
  assert.ok(r.escrituras.indexOf(verificar[0]) > r.escrituras.indexOf(cf[1]), "verifica después de crear los registros");
  assert.match(r.salida, /DKIM TXT resend\._domainkey\.patagua\.dev: creado/);
  assert.match(r.salida, /Creados: 2/);
});

test("un MX faltante se crea con su prioridad", async () => {
  const r = await correr(["--aplicar"], { dns: DNS_COMPLETO.filter((d) => d.id !== "r2"), estadoDominio: "pending" });
  const mx = r.escrituras.find((l) => l.cuerpo?.type === "MX");
  assert.deepEqual([mx.cuerpo.name, mx.cuerpo.content, mx.cuerpo.priority, mx.cuerpo.proxied], ["send.patagua.dev", "feedback-smtp.us-east-1.amazonses.com", 10, false]);
});

test("conflicto: otro SPF en el mismo nombre se informa, no se toca ni se crea el de Resend", async () => {
  const dns = [...DNS_COMPLETO.filter((d) => d.id !== "r3"), { id: "spf", type: "TXT", name: "send.patagua.dev", content: "v=spf1 include:otro.com -all" }];
  for (const argv of [[], ["--aplicar"]]) {
    const r = await correr(argv, { dns });
    assert.equal(r.codigo, 1);
    assert.match(r.salida, /SPF TXT send\.patagua\.dev: CONFLICTO .* ya hay otro SPF en send\.patagua\.dev/);
    assert.match(r.salida, /1 conflicto\(s\): no se tocó ningún registro existente/);
    assert.equal(r.escrituras.filter((l) => l.host === "api.cloudflare.com").length, 0);
    assert.ok(!r.escrituras.some((l) => l.metodo === "DELETE" || l.metodo === "PUT" || l.metodo === "PATCH"));
  }
});

test("con un conflicto, --aplicar igual crea los registros que faltan sin conflicto", async () => {
  const dns = [{ id: "otra", type: "TXT", name: "resend._domainkey.patagua.dev", content: "p=OTRACLAVE" }, ...DNS_COMPLETO.filter((d) => d.id === "r2" || d.id === "r4")];
  const r = await correr(["--aplicar"], { dns, estadoDominio: "pending" });
  assert.equal(r.codigo, 1);
  const creados = r.escrituras.filter((l) => l.host === "api.cloudflare.com").map((l) => l.cuerpo.name + l.cuerpo.type);
  assert.deepEqual(creados, ["send.patagua.dev" + "TXT"]);
  assert.match(r.salida, /DKIM TXT .*CONFLICTO.*otra clave DKIM/);
});

test("compararRegistro: un CNAME choca con cualquier registro del nombre; un TXT ajeno no choca", () => {
  const cname = { tipo: "CNAME", nombre: "links.patagua.dev", contenido: "links1.resend-dns.com" };
  assert.equal(compararRegistro(cname, []).estado, "falta");
  assert.equal(compararRegistro(cname, [{ type: "CNAME", name: "links.patagua.dev", content: "Links1.resend-dns.com." }]).estado, "ok");
  assert.equal(compararRegistro(cname, [{ type: "A", name: "links.patagua.dev", content: "1.1.1.1" }]).estado, "conflicto");
  assert.equal(compararRegistro(cname, [{ type: "CNAME", name: "links.patagua.dev", content: "otro.com" }]).estado, "conflicto");
  const spf = { tipo: "TXT", nombre: "send.patagua.dev", contenido: "v=spf1 include:amazonses.com ~all" };
  assert.equal(compararRegistro(spf, [{ type: "TXT", name: "send.patagua.dev", content: "google-site-verification=x" }]).estado, "falta");
  assert.equal(compararRegistro(spf, [{ type: "CNAME", name: "send.patagua.dev", content: "x.com" }]).estado, "conflicto");
  const mx = { tipo: "MX", nombre: "send.patagua.dev", contenido: "feedback-smtp.us-east-1.amazonses.com", prioridad: 10 };
  assert.equal(compararRegistro(mx, [{ type: "MX", name: "send.patagua.dev", content: "feedback-smtp.us-east-1.amazonses.com", priority: 20 }]).estado, "conflicto");
  assert.deepEqual(cuerpoRegistroCloudflare(mx), { type: "MX", name: "send.patagua.dev", content: mx.contenido, ttl: 1, proxied: false, priority: 10, comment: "Resend (scripts/resend-dns.mjs)" });
});

test("si el dominio no está en Resend: el ensayo no lo crea; --aplicar lo crea y compara", async () => {
  const ensayo = await correr([], { dominios: [] });
  assert.equal(ensayo.codigo, 0);
  assert.equal(ensayo.escrituras.length, 0);
  assert.match(ensayo.salida, /patagua\.dev no está/);

  const r = await correr(["--aplicar"], { dominios: [], dns: [], estadoDominio: "not_started" });
  assert.equal(r.codigo, 0);
  const crear = r.escrituras.find((l) => l.host === "api.resend.com" && l.ruta === "/domains");
  assert.deepEqual(crear.cuerpo, { name: DOMINIO });
  assert.equal(r.escrituras.filter((l) => l.host === "api.cloudflare.com").length, 3);
  assert.match(r.salida, /dominio creado/);
});

test("sin CLOUDFLARE_API_TOKEN el ensayo sólo lista lo que pide Resend; --aplicar lo exige", async () => {
  const r = await correr([], {}, { RESEND_API_KEY: CLAVE_RESEND });
  assert.equal(r.codigo, 0);
  assert.ok(r.llamadas.every((l) => l.host === "api.resend.com"));
  assert.match(r.salida, /Sin CLOUDFLARE_API_TOKEN/);
  assert.match(r.salida, /MX send\.patagua\.dev \(prioridad 10\)/);
  const a = await correr(["--aplicar"], {}, { RESEND_API_KEY: CLAVE_RESEND });
  assert.equal(a.codigo, 1);
  assert.equal(a.llamadas.length, 0);
  assert.match(a.salida, /CLOUDFLARE_API_TOKEN/);
  const sin = await correr([], {}, {});
  assert.equal(sin.codigo, 1);
  assert.match(sin.salida, /Falta RESEND_API_KEY/);
});

test("zona inexistente y errores de la API terminan con mensaje y código 1", async () => {
  const r = await correr([], { zonas: [] });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /no hay una zona patagua\.dev/);
  const lineas = [];
  const fetch = async () => new Response(JSON.stringify({ statusCode: 401, message: `API key ${CLAVE_RESEND} is invalid`, name: "restricted_api_key" }), { status: 401 });
  assert.equal(await main({ argv: [], env: ENV, fetch, log: (l) => lineas.push(l), pausa: 0 }), 1);
  assert.match(lineas.join("\n"), /respuesta 401/);
});

test("ninguna salida contiene las claves, ni enteras ni en parte", async () => {
  const salidas = [];
  for (const argv of [[], ["--aplicar"]]) {
    salidas.push((await correr(argv, { dns: DNS_COMPLETO.slice(0, 2), estadoDominio: "pending" })).salida);
    salidas.push((await correr(argv, { dominios: [], dns: [] })).salida);
  }
  const lineas = [];
  const fetch = async () => new Response(JSON.stringify({ message: `bad ${TOKEN_CF} ${CLAVE_RESEND}` }), { status: 403 });
  await main({ argv: ["--aplicar"], env: ENV, fetch, log: (l) => lineas.push(l), pausa: 0 });
  salidas.push(lineas.join("\n"));
  const lanza = [];
  await main({ argv: [], env: ENV, fetch: async () => { throw new Error(`red ${CLAVE_RESEND}`); }, log: (l) => lanza.push(l), pausa: 0 });
  salidas.push(lanza.join("\n"));
  for (const s of salidas) {
    for (const secreto of [CLAVE_RESEND, TOKEN_CF]) {
      assert.ok(!s.includes(secreto));
      assert.ok(!s.includes(secreto.slice(0, 12)));
    }
  }
  assert.ok(salidas.every((s) => s.length > 0));
});
