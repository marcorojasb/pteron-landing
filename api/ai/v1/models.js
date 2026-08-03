const { handler, json, method } = require("../../_lib/http");
const { authenticateGateway } = require("../../_lib/gateway");

/**
 * Un único modelo virtual: el profesor nunca ve el proveedor real detrás del
 * plan (ADR-056), y el gateway queda libre de cambiarlo sin que el cliente
 * tenga que hacer nada. Exige licencia igual que el chat: una licencia vencida
 * no debería poder ni siquiera listar el modelo.
 */
module.exports = handler(async (req, res) => {
  method(req, "GET");
  authenticateGateway(req);
  json(res, 200, { object: "list", data: [{ id: "pteron-managed", object: "model", owned_by: "pteron" }] });
});
