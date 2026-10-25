import { json, method } from "../lib/http.js";

/**
 * GET /api/plans: qué planes de pago están a la venta, para que /planes ofrezca «Elegir» sólo con la venta abierta,
 * como /cuenta (un botón que no lleva a ninguna parte no se ofrece). Público y sin sesión: lee plan_catalog con la
 * clave publicable, así que decide la política de lectura pública (planes activos y listados). Sólo sale el id y si
 * está a la venta; el precio y la cuota los dice la página.
 */
export async function plans({ request, services }) {
  method(request, "GET");
  let rows;
  try {
    rows = await services.supabase.select("plan_catalog", "active=eq.true&listed=eq.true&select=id,for_sale&order=monthly_price_clp.asc");
  } catch (error) {
    // Sin respuesta, /planes queda en «Disponible pronto» aunque la venta esté abierta: que quede en Workers Logs, y
    // que al público no le llegue el mensaje de Supabase (un permiso o una clave)
    console.error("pteron plans", { status: error?.status ?? null, code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) });
    return json(503, { error: "plans_unavailable", message: "No pudimos leer los planes." });
  }
  const planes = (Array.isArray(rows) ? rows : []).map((row) => ({ id: row.id, forSale: row.for_sale === true }));
  return json(200, { plans: planes }, { "Cache-Control": "public, max-age=60" });
}
