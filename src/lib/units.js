/**
 * Unidades de IA: el equivalente de token de entrada. 1 unidad = US$0,0000001
 * de costo a precio de lista, lo que cuesta un token de entrada de Haiku 5.5
 * mientras el prompt no pasa de 100.000 tokens; 10.000.000 unidades = US$1.
 * La cuota se cuenta así y no en tokens brutos porque el costo de un token
 * varía hasta 250 veces entre una lectura de caché y una salida larga.
 *
 * Los pesos van en veinteavos de unidad para sumar sólo enteros: entrada 1,
 * escritura de caché de 5 minutos 1,25, de 1 hora 2, lectura de caché 0,1 y
 * salida 5. Sobre el umbral de contexto largo, toda la petición vale `factor`
 * veces más (el prompt cuenta entrada, escrituras y lecturas de caché).
 */
export const MODEL_PRICES = Object.freeze({
  "claude-haiku-5-5": Object.freeze({
    input: 20,
    cacheWrite5m: 25,
    cacheWrite1h: 40,
    cacheRead: 2,
    output: 100,
    longContextAbove: 100_000,
    longContextFactor: 5,
  }),
});

const WEIGHT_SCALE = 20;
// Cada búsqueda web cuesta US$0,01 aparte de los tokens. El gateway quita las
// herramientas de servidor, pero si alguna llegara a correr se cobra igual.
const UNITS_PER_WEB_SEARCH = 100_000;

// La reserva previa supone el peor caso razonable: toda la entrada escrita en
// caché de 5 minutos (4 bytes por token) y la salida que pide la app.
const RESERVED_OUTPUT_TOKENS = 32_768;
// Un stream cortado antes de message_delta no dice cuánta salida hubo: se
// estima con 3 caracteres por token y un 50 % más por el razonamiento, que no
// se reenvía.
const CHARS_PER_TOKEN = 3;
const OMITTED_REASONING_FACTOR = 1.5;

/** El gateway nunca llama a un modelo sin precio conocido: sin precio no hay cuota que valga. */
export function hasKnownPrice(modelId) {
  return Object.hasOwn(MODEL_PRICES, String(modelId ?? ""));
}

function tokens(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/**
 * Convierte el `usage` de Anthropic en unidades con el precio de `modelId` y
 * devuelve también el desglose que se guarda en `usage_events.event_metadata`,
 * sin contenido. Sin el desglose por duración, la escritura de caché cuenta
 * como de 5 minutos: el gateway quita el ttl de 1 hora antes de enviar.
 */
export function unitsFromUsage(usage, modelId) {
  if (!hasKnownPrice(modelId)) throw new Error(`Sin precio para el modelo ${modelId}.`);
  const price = MODEL_PRICES[modelId];
  const source = usage && typeof usage === "object" ? usage : {};
  const creation = source.cache_creation && typeof source.cache_creation === "object" ? source.cache_creation : {};
  const input = tokens(source.input_tokens);
  const cacheRead = tokens(source.cache_read_input_tokens);
  const output = tokens(source.output_tokens);
  const write1h = tokens(creation.ephemeral_1h_input_tokens);
  const write5m = creation.ephemeral_5m_input_tokens != null
    ? tokens(creation.ephemeral_5m_input_tokens)
    : Math.max(0, tokens(source.cache_creation_input_tokens) - write1h);
  const searches = tokens(source.server_tool_use?.web_search_requests);
  const longContext = input + write5m + write1h + cacheRead > price.longContextAbove;
  const weighted =
    price.input * input +
    price.cacheWrite5m * write5m +
    price.cacheWrite1h * write1h +
    price.cacheRead * cacheRead +
    price.output * output;
  const factor = longContext ? price.longContextFactor : 1;
  return {
    in: input,
    cw5m: write5m,
    cw1h: write1h,
    cr: cacheRead,
    out: output,
    searches,
    long_context: longContext,
    units: Math.ceil((weighted * factor) / WEIGHT_SCALE) + UNITS_PER_WEB_SEARCH * searches,
  };
}

/** Unidades que se reservan antes de llamar al proveedor; al terminar se anota el gasto real. */
export function reservationEstimate(bodyBytes, maxTokens) {
  return Math.ceil(Math.ceil(bodyBytes / 4) * 1.25 + Math.min(maxTokens, RESERVED_OUTPUT_TOKENS) * 5);
}

/** Tokens de salida estimados a partir de los caracteres de texto y JSON ya reenviados. */
export function estimatedOutputTokens(forwardedChars) {
  return Math.ceil((forwardedChars / CHARS_PER_TOKEN) * OMITTED_REASONING_FACTOR);
}
