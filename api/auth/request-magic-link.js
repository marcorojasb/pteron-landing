const { body, handler, json, method, requireEmail, siteUrl } = require("../_lib/http");
const { request } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "POST");
  const input = await body(req);
  const email = requireEmail(input.email);
  await request("/auth/v1/otp", {
    method: "POST",
    body: {
      email,
      create_user: true,
      options: { email_redirect_to: `${siteUrl(req)}/cuenta/` },
    },
  });
  json(res, 200, { ok: true, message: "Si el correo puede recibir el enlace, lo enviaremos ahora." });
});
