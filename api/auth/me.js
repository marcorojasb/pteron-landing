const { handler, json, method, requireAuth } = require("../_lib/http");
const { authUser } = require("../_lib/supabase");

module.exports = handler(async (req, res) => {
  method(req, "GET");
  const user = await authUser(requireAuth(req));
  json(res, 200, { user: { id: user.id, email: user.email || null, createdAt: user.created_at || null } });
});
