import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, body, handleError, json, parseBody, readText, redirect, requireEmail, siteUrl } from "../src/lib/http.js";

function streamRequest(chunks, headers = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("https://pteron.test/api/x", { method: "POST", body: stream, duplex: "half", headers });
}

test("readText corta un cuerpo que supera el límite aunque no declare content-length", async () => {
  await assert.rejects(readText(streamRequest(["a".repeat(40), "b".repeat(40)]), 64), { status: 413, code: "body_too_large" });
  assert.equal(await readText(streamRequest(["hola ", "mundo"]), 64), "hola mundo");
});

test("readText rechaza de inmediato un content-length mayor al límite", async () => {
  await assert.rejects(readText(streamRequest(["x"], { "content-length": "999999" }), 64), { status: 413 });
});

test("body acepta JSON y formularios urlencoded, y rechaza JSON malformado", async () => {
  assert.deepEqual(await body(new Request("https://pteron.test/x", { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json" } })), { a: 1 });
  assert.deepEqual(await body(new Request("https://pteron.test/x", { method: "POST", body: "token=abc&s=1", headers: { "content-type": "application/x-www-form-urlencoded" } })), { token: "abc", s: "1" });
  assert.deepEqual(await body(new Request("https://pteron.test/x", { method: "POST", body: "   " })), {});
  await assert.rejects(body(new Request("https://pteron.test/x", { method: "POST", body: "{no" })), { status: 400, code: "invalid_json" });
  assert.deepEqual(parseBody("", "application/json"), {});
});

test("requireEmail normaliza y valida", () => {
  assert.equal(requireEmail("  Profe@Escuela.cl "), "profe@escuela.cl");
  assert.throws(() => requireEmail("sin-arroba"), { code: "invalid_email" });
  assert.throws(() => requireEmail(""), { code: "invalid_input" });
});

test("json y redirect no se cachean y json va con nosniff", async () => {
  const res = json(201, { ok: true });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await res.json(), { ok: true });
  const moved = redirect("https://pteron.test/cuenta?billing=success");
  assert.equal(moved.status, 303);
  assert.equal(moved.headers.get("location"), "https://pteron.test/cuenta?billing=success");
});

test("handleError traduce HttpError y oculta los errores internos", async () => {
  const known = handleError(new HttpError(409, "conflicto", "Ya existe."));
  assert.equal(known.status, 409);
  assert.deepEqual(await known.json(), { error: "conflicto", message: "Ya existe." });
  const originalError = console.error;
  const registro = [];
  console.error = (...args) => registro.push(args);
  try {
    const interno = new Error("detalle interno con secreto");
    const unknown = handleError(interno);
    assert.equal(unknown.status, 500);
    const payload = await unknown.json();
    assert.equal(payload.error, "server_error");
    assert.doesNotMatch(JSON.stringify(payload), /secreto/);
    // El registro lleva la pila (con source maps, la línea del código); el cliente nunca.
    assert.deepEqual(registro, [["pteron api error", interno.stack]]);
    assert.match(registro[0][1], /\n\s+at /);
    handleError("algo que no es un Error");
    assert.deepEqual(registro[1], ["pteron api error", "algo que no es un Error"]);
  } finally {
    console.error = originalError;
  }
});

test("siteUrl prefiere la variable configurada y cae al origen de la petición", () => {
  const request = new Request("http://localhost:8787/api/auth/me");
  assert.equal(siteUrl({ PUBLIC_SITE_URL: "https://pteron.patagua.dev/" }, request), "https://pteron.patagua.dev");
  assert.equal(siteUrl({}, request), "http://localhost:8787");
});
