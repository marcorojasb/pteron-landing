import { HttpError, body, json, method, requireAuth, requireString } from "../lib/http.js";
import { verifyLicense } from "../lib/license.js";

// Acciones detrás de /api/license/{refresh,renew}.
//
// refresh reemite a partir de una sesión de Supabase (la cuenta web);
// renew reemite a partir de la licencia firmada que ya tiene el escritorio,
// que nunca guarda esa sesión. Las dos responden lo mismo que antes (ok,
// token, plan, expiresAt, keyId) más `subscription`, el estado del plan.

async function refresh({ request, services }) {
  method(request, "POST");
  const user = await services.supabase.authUser(requireAuth(request));
  const issued = await services.license.issueLicense(user.id, services);
  return json(200, { ok: true, ...issued });
}

async function renew({ request, services }) {
  method(request, "POST");
  const input = await body(request);
  const token = requireString(input.token, "token", 4000);
  const verified = await verifyLicense(token, services.publicKeys);
  if (!verified) throw new HttpError(401, "invalid_license", "La licencia no pudo verificarse.");
  const issued = await services.license.issueLicense(verified.sub, services);
  return json(200, { ok: true, ...issued });
}

export const ACTIONS = { refresh, renew };
