const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const dbPath = path.resolve(__dirname, "../../leadcapture.db");
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    title TEXT NOT NULL,
    button_text TEXT NOT NULL,
    color TEXT NOT NULL,
    fields TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    widget_id TEXT NOT NULL REFERENCES widgets(id),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    data TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    country TEXT,
    city TEXT,
    geo_provider TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_widgets_tenant ON widgets(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_widget ON submissions(widget_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants(api_key);
`);

module.exports = db;
