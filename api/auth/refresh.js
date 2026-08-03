const { body, handler, HttpError, json, method, requireString } = require("../_lib/http");
const { request } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const input = await body(req);
  const refreshToken = requireString(input.refresh_token, "refresh_token", 1000);
  const result = await request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  if (!result?.access_token || !result?.refresh_token) throw new HttpError(502, "auth_error", "No pudimos renovar la sesión.");
  json(res, 200, {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
    token_type: result.token_type,
  });
});
