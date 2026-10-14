const db = require("../db");

function authenticateTenant(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query.api_key;
  if (!apiKey) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing x-api-key header" });
  }

  const stmt = db.prepare("SELECT * FROM tenants WHERE api_key = ?");
  const tenant = stmt.get(apiKey);

  if (!tenant) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid API key" });
  }

  req.tenant = tenant;
  next();
}

module.exports = {
  authenticateTenant,
};
