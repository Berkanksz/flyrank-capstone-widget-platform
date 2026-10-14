# Embeddable Widget & Lead-Capture Platform (FlyRank Live Capstone)

A production-grade, multi-tenant lead-capture platform with an embeddable JavaScript widget bundle, hardened cross-origin ingestion API, resilient geo-enrichment fallback chain, and authenticated tenant analytics dashboard.

---

## Architecture Diagram

```
Customer Website (Origin B: e.g. port 5500)
    │
    ├─► 1. Loads <script src="http://api:3000/v1/widget.v1.js" data-widget-id="wid_...">
    │        └─ (Cached: public, max-age=86400, immutable)
    │
    ├─► 2. GET http://api:3000/v1/widgets/:id/config
    │        └─ (Cached: public, max-age=60)
    │
    └─► 3. POST http://api:3000/v1/submissions
             │
             ├──► CORS Preflight (OPTIONS 204 Allow-Origin: *)
             ├──► Abuse Protection: Rate Limiter (10 req/min/IP -> 429)
             ├──► Spam Defense: Honeypot field (_website_hp -> 400)
             ├──► Boundary Validation: Zod schema & 50KB size cap (400/413)
             ├──► Geo-Enrichment Fallback:
             │       ip-api.com ──(fail)──► ipapi.co ──(fail)──► Degrade gracefully (no geo)
             ├──► Multi-tenant SQLite Storage: (tenant_id, foreign keys, indexes)
             └──► Safe Side-Effect: Async confirmation email (failure never blocks 201)
```

---

## Required Files Checklist (Section 11)
- `README.md` (This file: Architecture, setup, API docs, and verification proof)
- `DESIGN.md` (Detailed system architecture and tenant data models)
- `EVIDENCE.md` (Pasted proof for every requirement and acceptance probe)
- `BUILDLOG.md` (AI pair programming notes and engineering decisions)
- `capstone.yaml` (Evaluator manifest with run, seed, and probe commands)
- `.env.example` (Safe environment variables template)

---

## Getting Started in Under 2 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
```bash
npm run seed
```
Creates two tenants:
- **Tenant Acme:** API Key `key_acme_live_123` (Widget ID: `wid_newsletter`)
- **Tenant Beta:** API Key `key_beta_live_456` (Widget ID: `wid_beta_contact`)

### 3. Run Acceptance Test Suite
```bash
npm test
```
Executes all 7 behavioral probes (cross-origin submit, boundary checks, rate limits, geo fallback, side-effect safety, honeypot spam filter, and tenant isolation).

### 4. Start the Server
```bash
npm start
```
Server boots at `http://localhost:3000`.

---

## Testing the Customer Embed

In a second terminal, serve the customer test site:
```bash
npx serve customer-site -p 5500
```
Open [http://localhost:5500](http://localhost:5500) to see the widget loaded and functional across origins!

---

## API Documentation

### Public Endpoints
| Endpoint | Method | Cache / Behavior | Purpose |
|---|---|---|---|
| `/health` | GET | `200 OK` | Liveness health check |
| `/v1/widget.v1.js` | GET | `max-age=86400, immutable` | Versioned client JS bundle |
| `/v1/widgets/:id/config` | GET | `max-age=60` | Form field definitions |
| `/v1/submissions` | POST | Rate limited, CORS `*` | Ingests lead submissions |

### Authenticated Dashboard Endpoints (Header: `x-api-key`)
| Endpoint | Method | Status | Purpose |
|---|---|---|---|
| `/v1/dashboard/widgets` | GET | `200` | List widgets with embed snippet |
| `/v1/dashboard/widgets` | POST | `201` | Create new widget |
| `/v1/dashboard/submissions` | GET | `200` | List submissions (isolated to tenant) |
| `/v1/dashboard/stats` | GET | `200` | Aggregated conversion & geo statistics |
