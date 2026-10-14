# Capstone 1 - Embeddable Widget & Lead-Capture Platform Design Document

## 1. System Overview & Architecture
An embeddable JavaScript widget platform that enables third-party websites to embed customizable lead-capture forms. Submitted leads are received by a hardened public ingestion API, enriched with geographic data via a resilient provider fallback chain, safely dispatched to background side-effects (confirmation emails/webhooks), and made available in an authenticated multi-tenant dashboard.

```
Third-Party Website (Origin B: e.g. :5500)
    │
    ├─► 1. <script src="http://api:3000/v1/widget.v1.js" data-widget-id="wid_123">
    │        │
    │        ▼ (Cached bundle)
    ├─► 2. GET http://api:3000/v1/widgets/wid_123/config (Cache-Control: max-age=60)
    │        │
    │        ▼ (Renders Form UI with Honeypot field)
    └─► 3. POST http://api:3000/v1/submissions
             │
             ├──► CORS Preflight (OPTIONS 204)
             ├──► Rate Limiter (IP + Widget ID, 429 on abuse)
             ├──► Spam / Honeypot Defense (Drop / Reject bot leads)
             ├──► Zod Schema Validation (Boundary check: 400 on malformed, 413 on oversized)
             ├──► Geo-Enrichment Fallback Chain:
             │       Provider A (ip-api) ──(fail)──► Provider B (ipapi.co) ──(fail)──► Store without geo
             ├──► Real Persistence (SQLite with tenant_id, foreign keys, and indexes)
             └──► Safe Side Effect (Async email/webhook log - never blocks 201 success)
```

## 2. Data Models & Tenant Isolation
Database: SQLite (`leadcapture.db`) using Node.js built-in `node:sqlite`.

### Tables
1. `tenants`:
   - `id` (TEXT PRIMARY KEY)
   - `name` (TEXT NOT NULL)
   - `api_key` (TEXT NOT NULL UNIQUE)
   - `created_at` (TEXT NOT NULL)

2. `widgets`:
   - `id` (TEXT PRIMARY KEY)
   - `tenant_id` (TEXT NOT NULL REFERENCES tenants(id))
   - `title` (TEXT NOT NULL)
   - `button_text` (TEXT NOT NULL)
   - `color` (TEXT NOT NULL)
   - `fields` (TEXT NOT NULL JSON array)
   - `created_at` (TEXT NOT NULL)

3. `submissions`:
   - `id` (TEXT PRIMARY KEY)
   - `widget_id` (TEXT NOT NULL REFERENCES widgets(id))
   - `tenant_id` (TEXT NOT NULL REFERENCES tenants(id))
   - `data` (TEXT NOT NULL JSON)
   - `ip_address` (TEXT NOT NULL)
   - `country` (TEXT)
   - `city` (TEXT)
   - `geo_provider` (TEXT)
   - `created_at` (TEXT NOT NULL)

### Indexes
- `idx_widgets_tenant`: `widgets(tenant_id)`
- `idx_submissions_widget`: `submissions(widget_id)`
- `idx_submissions_tenant`: `submissions(tenant_id)`
- `idx_tenants_api_key`: `tenants(api_key)`

## 3. API Contracts
- `GET /health` -> `200 { status: "ok" }`
- `GET /v1/widget.v1.js` -> 200 JS bundle (`Cache-Control: public, max-age=86400, immutable`)
- `GET /v1/widgets/:id/config` -> 200 JSON (`Cache-Control: public, max-age=60`)
- `POST /v1/submissions` -> 201 Created (`{ success: true, id: "sub_..." }`)
- `GET /v1/dashboard/widgets` -> 200 Authenticated list (Requires `x-api-key` header)
- `POST /v1/dashboard/widgets` -> 201 Create widget (Requires `x-api-key` header)
- `GET /v1/dashboard/submissions` -> 200 List tenant submissions (Requires `x-api-key` header)
- `GET /v1/dashboard/stats` -> 200 Aggregated conversion metrics

## 4. Explicit Non-Goals
1. No WYSIWYG visual drag-and-drop form builder; widget configurations are defined via JSON schema.
2. Real SMTP server setup is not required; email side-effects are dispatched to a resilient safe notifier module.
