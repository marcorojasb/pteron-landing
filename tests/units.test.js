import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_PRICES, estimatedOutputTokens, hasKnownPrice, reservationEstimate, unitsFromUsage } from "../src/lib/units.js";

const MODEL = "claude-haiku-5-5";

test("una unidad es un token de entrada en el tramo corto: 10.000.000 unidades = US$1", () => {
  assert.equal(unitsFromUsage({ input_tokens: 1000 }, MODEL).units, 1000);
  // Haiku 5.5 cobra US$0,10 por millón de tokens de entrada: 100.000 tokens son US$0,01.
  assert.equal(unitsFromUsage({ input_tokens: 100_000 }, MODEL).units / 10_000_000, 0.01);
});

test("unitsFromUsage pondera cada clase de token: un material típico vale 48.935 unidades", () => {
  // Guía con figuras (informe gateway-cuota): 3 llamadas con caché de 5 minutos.
  assert.deepEqual(unitsFromUsage({ input_tokens: 300, cache_creation_input_tokens: 15_900, cache_read_input_tokens: 20_100, output_tokens: 5350 }, MODEL), {
    in: 300,
    cw5m: 15_900,
    cw1h: 0,
    cr: 20_100,
    out: 5350,
    searches: 0,
    long_context: false,
    units: 48_935,
  });
});

test("la peor petición con los topes del gateway (100K escritos en caché y 65.536 de salida) vale 452.680 unidades", () => {
  assert.equal(unitsFromUsage({ cache_creation_input_tokens: 100_000, output_tokens: 65_536 }, MODEL).units, 452_680);
});

test("sobre 100.000 tokens de prompt toda la petición vale cinco veces, contando las lecturas y escrituras de caché", () => {
  assert.equal(unitsFromUsage({ input_tokens: 100_000 }, MODEL).units, 100_000, "100.000 justos siguen en el tramo corto");
  const long = unitsFromUsage({ input_tokens: 100_001 }, MODEL);
  assert.equal(long.long_context, true);
  assert.equal(long.units, 500_005);
  // 10 de entrada + 99.991 leídos de caché = 100.001: cruza el umbral aunque casi todo sea lectura.
  const reads = unitsFromUsage({ input_tokens: 10, cache_read_input_tokens: 99_991 }, MODEL);
  assert.equal(reads.long_context, true);
  assert.equal(reads.units, Math.ceil(((20 * 10 + 2 * 99_991) * 5) / 20));
});

test("cada búsqueda web suma 100.000 unidades aparte de los tokens", () => {
  assert.equal(unitsFromUsage({ input_tokens: 1000, output_tokens: 100, server_tool_use: { web_search_requests: 2 } }, MODEL).units, 1500 + 200_000);
});

test("la escritura de caché se separa por duración y, sin desglose, cuenta como de 5 minutos", () => {
  const split = unitsFromUsage({ cache_creation_input_tokens: 3000, cache_creation: { ephemeral_1h_input_tokens: 1000 } }, MODEL);
  assert.equal(split.cw5m, 2000, "lo que no es de 1 hora es de 5 minutos");
  assert.equal(split.cw1h, 1000);
  assert.equal(split.units, (25 * 2000 + 40 * 1000) / 20);
  const explicit = unitsFromUsage({ cache_creation_input_tokens: 3000, cache_creation: { ephemeral_5m_input_tokens: 500, ephemeral_1h_input_tokens: 2500 } }, MODEL);
  assert.deepEqual([explicit.cw5m, explicit.cw1h], [500, 2500]);
  assert.equal(unitsFromUsage({ cache_creation_input_tokens: 3000 }, MODEL).cw5m, 3000);
});

test("unitsFromUsage trata como 0 lo ausente, nulo o inválido, y redondea hacia arriba", () => {
  assert.equal(unitsFromUsage(null, MODEL).units, 0);
  assert.equal(unitsFromUsage({ input_tokens: null, output_tokens: "x", cache_read_input_tokens: -5 }, MODEL).units, 0);
  assert.equal(unitsFromUsage({ cache_read_input_tokens: 1 }, MODEL).units, 1, "0,1 unidad se cobra como 1");
});

test("sólo los modelos de la tabla tienen precio: con otro modelo no hay unidades", () => {
  assert.equal(hasKnownPrice(MODEL), true);
  assert.equal(hasKnownPrice("claude-otro"), false);
  assert.equal(hasKnownPrice(""), false);
  assert.equal(hasKnownPrice("constructor"), false);
  assert.throws(() => unitsFromUsage({ input_tokens: 1 }, "claude-otro"));
  assert.ok(Object.isFrozen(MODEL_PRICES) && Object.isFrozen(MODEL_PRICES[MODEL]));
});

test("la reserva supone la entrada escrita en caché (4 bytes por token) y a lo más 32.768 de salida", () => {
  assert.equal(reservationEstimate(4000, 32_768), 1000 * 1.25 + 32_768 * 5);
  assert.equal(reservationEstimate(4000, 65_536), reservationEstimate(4000, 32_768), "el reintento por longitud no reserva más");
  assert.equal(reservationEstimate(4000, 1000), 6250);
  assert.equal(reservationEstimate(1, 0), 2, "se redondea hacia arriba");
});

test("la salida de un stream cortado se estima con 3 caracteres por token y un 50 % por el razonamiento", () => {
  assert.equal(estimatedOutputTokens(300), 150);
  assert.equal(estimatedOutputTokens(1), 1);
  assert.equal(estimatedOutputTokens(0), 0);
});
