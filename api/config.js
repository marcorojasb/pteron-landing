const { handler, HttpError, json, method } = require("./_lib/http");

function publicConfig(req) {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (!siteUrl) throw new HttpError(503, "server_not_configured", "El servidor todavía no está configurado.");
  return {
    siteUrl,
    appProtocol: String(process.env.PUBLIC_APP_PROTOCOL || "pteron").trim().toLowerCase(),
  };
}

module.exports = handler((req, res) => {
  method(req, "GET");
  json(res, 200, publicConfig(req));
});
