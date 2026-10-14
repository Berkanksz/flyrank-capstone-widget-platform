const db = require("./index");

function seed() {
  console.log("Seeding database...");

  // Clean existing data for idempotency
  db.exec(`
    DELETE FROM submissions;
    DELETE FROM widgets;
    DELETE FROM tenants;
  `);

  const insertTenant = db.prepare(`
    INSERT INTO tenants (id, name, api_key, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertWidget = db.prepare(`
    INSERT INTO widgets (id, tenant_id, title, button_text, color, fields, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  // Tenant A: Acme Corp
  insertTenant.run("tenant_acme", "Acme Corporation", "key_acme_live_123", now);
  insertWidget.run(
    "wid_newsletter",
    "tenant_acme",
    "Subscribe to Acme Newsletter",
    "Join Now",
    "#3b82f6",
    JSON.stringify([
      { name: "email", type: "email", label: "Work Email", required: true },
      { name: "name", type: "text", label: "Full Name", required: false },
    ]),
    now
  );

  // Tenant B: Beta Tech (For tenant isolation checks)
  insertTenant.run("tenant_beta", "Beta Technologies", "key_beta_live_456", now);
  insertWidget.run(
    "wid_beta_contact",
    "tenant_beta",
    "Contact Beta Sales",
    "Request Demo",
    "#10b981",
    JSON.stringify([
      { name: "email", type: "email", label: "Corporate Email", required: true },
      { name: "company", type: "text", label: "Company", required: true },
    ]),
    now
  );

  console.log("Seeding complete. 2 tenants and 2 widgets created.");
}

if (require.main === module) {
  seed();
}

module.exports = seed;
