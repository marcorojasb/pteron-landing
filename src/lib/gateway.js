import { HttpError, bearerToken } from "./http.js";
import { verifyLicense } from "./license.js";

/**
 * Autentica una llamada al gateway con la licencia como credencial (ADR-054/055):
 * sin sesión, sin base de sesiones propia — la misma firma que ya verifica el
 * cliente. A diferencia de la renovación, acá el vencimiento sí importa: una
 * licencia vencida no debe poder seguir gastando cuota.
 */
export async function authenticateGateway(request, keys) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "not_authenticated", "Falta la licencia.");
  const verified = await verifyLicense(token, keys);
  if (!verified) throw new HttpError(401, "invalid_license", "La licencia no pudo verificarse.");
  if (Date.parse(verified.exp) <= Date.now()) throw new HttpError(401, "license_expired", "La licencia venció.");
  return verified;
}

/** Mes calendario en UTC. Alinearlo al ciclo exacto de cada suscripción es una mejora posterior, no un requisito de correctitud. */
export function currentPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createGateway(supabase) {
  async function planAiUnitsLimit(planId) {
    const rows = await supabase.select("plan_catalog", `id=eq.${encodeURIComponent(planId)}&select=ai_units_limit`, { admin: true });
    return rows?.[0]?.ai_units_limit ?? null;
  }

  /**
   * Registra `units` (tokens) contra la cuota del período actual y guarda qué
   * modelo real respondió: el cliente sólo pide "pteron-managed" (ADR-056
   * permite ocultar el nombre en la superficie principal), así que si el
   * servidor no anota el modelo real en algún lado, "qué modelo usó y por qué"
   * deja de ser respondible — justo lo que esa ADR exige que siga siéndolo.
   *
   * `limit` nulo — el estado real de hoy, ver `plan_catalog.ai_units_limit` —
   * significa "sin tope todavía": una decisión de producto pendiente
   * (D-3/PLAN-0.3.md), no algo que este endpoint deba inventar. Con `units: 0`
   * sirve como chequeo previo sin registrar nada; se usa así antes de llamar al
   * proveedor, y de nuevo después con el gasto real ya conocido.
   */
  async function reserveAiUsage(sub, planId, units, metadata = {}) {
    const limit = await planAiUnitsLimit(planId);
    const period = currentPeriod();
    const rows = await supabase.request("/rest/v1/rpc/reserve_ai_usage", {
      method: "POST",
      admin: true,
      body: {
        p_user_id: sub,
        p_plan_id: planId,
        p_period_start: period.start,
        p_period_end: period.end,
        p_units: units,
        p_limit: limit,
        p_metadata: metadata,
      },
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { allowed: Boolean(row?.allowed ?? true), unitsUsed: row?.units_used ?? 0, limit };
  }

  return { planAiUnitsLimit, reserveAiUsage };
}

/**
 * Busca en un bloque de eventos SSE (`data: {...}`) el último `usage` y el
 * último `model` reportados por el proveedor real detrás del gateway. Nunca
 * lanza: un fragmento cortado se ignora en vez de reventar el proxy.
 */
export function latestUsageAndModelFromSseChunk(text) {
  let usage = null;
  let model = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const value = trimmed.slice(5).trim();
    if (!value || value === "[DONE]") continue;
    try {
      const parsed = JSON.parse(value);
      if (parsed?.usage && typeof parsed.usage === "object") usage = parsed.usage;
      if (typeof parsed?.model === "string" && parsed.model) model = parsed.model;
    } catch {
      // Fragmento SSE incompleto; el rastreador del proxy lo reintenta al llegar el resto.
    }
  }
  return { usage, model };
}

/**
 * Acumula texto SSE entre chunks: una línea `data:` que la red cortó por la
 * mitad se completa con el chunk siguiente en vez de perderse. Devuelve lo
 * último visto hasta ahora; `flush()` procesa el resto final sin salto de línea.
 */
export function createSseTracker() {
  let pending = "";
  let usage = null;
  let model = null;
  function absorb(text) {
    const found = latestUsageAndModelFromSseChunk(text);
    usage = found.usage || usage;
    model = found.model || model;
  }
  return {
    push(text) {
      const combined = pending + text;
      const cut = combined.lastIndexOf("\n");
      if (cut === -1) {
        pending = combined;
        return;
      }
      absorb(combined.slice(0, cut + 1));
      pending = combined.slice(cut + 1);
    },
    flush() {
      if (pending) absorb(pending);
      pending = "";
      return { usage, model };
    },
    current() {
      return { usage, model };
    },
  };
}

export function totalTokensFromUsage(usage) {
  if (!usage || typeof usage !== "object") return 0;
  const value = usage.total_tokens ?? (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
