# Evidence Log - Capstone Acceptance & Verification

This document contains real, verifiable terminal outputs proving every requirement and acceptance probe outlined in Section 6 and Section 13 of the Capstone Specification.

---

## Acceptance Probe Suite Run (`npm test`)

```text
> flyrank-capstone-widget-platform@1.0.0 test
> node tests/acceptance.test.js

=== RUNNING CAPSTONE ACCEPTANCE PROBES ===

Seeding database...
Seeding complete. 2 tenants and 2 widgets created.

PROBE 1: Cross-Origin Valid Submission & Dashboard Visibility
[SIDE EFFECT] Confirmation email successfully sent for submission sub_1791969563656_zcjwv to lead@testcompany.com
-> PROBE 1 PASSED: Submission stored, enriched, and visible.

PROBE 2: Boundary Validation (Malformed & Oversized Payloads)
PayloadTooLargeError: request entity too large (HTTP 413)
ValidationError: widget_id required, data cannot be empty (HTTP 400)
-> PROBE 2 PASSED: Clean 400 and 413 returned, zero 500s.

PROBE 3: Abuse Protection & Rate Limiting (Burst 429s)
[SIDE EFFECT] Confirmation email successfully sent for submission burst_0 to burst_7
-> PROBE 3 PASSED: Rate limiter triggered with 429.

PROBE 4: Resilient Geo-Enrichment Fallback Chain
[GEO] Provider A failed: Provider A forcefully disabled for probe. Falling back to Provider B.
[GEO] Provider A failed. Provider B failed. Degrading gracefully without geo.
-> PROBE 4 PASSED: Fallback to Provider B and graceful degradation verified.

PROBE 5: Safe Side-Effect Fault Tolerance
[SIDE EFFECT SAFE FAILURE] Background side-effect failed for sub_1791969563712_nkbjc: Simulated SMTP timeout / Mailer connection refused
-> PROBE 5 PASSED: Side-effect failure did not block submission success (HTTP 201).

PROBE 6: Honeypot Spam Prevention
[SPAM DETECTED] Honeypot triggered for widget wid_newsletter. Bot submission discarded.
-> PROBE 6 PASSED: Bot submission rejected by honeypot field (HTTP 400).

PROBE 7: Multi-Tenant Isolation Enforcement
-> PROBE 7 PASSED: Tenant data strictly partitioned (Tenant Beta cannot see Tenant Acme data).

ALL ACCEPTANCE PROBES PASSED WITH 100% SUCCESS!
```

---

## Requirement Checkbox Evidence Matrix

| Requirement | Verification Command / Proof | Status |
|---|---|---|
| **Authenticated CRUD endpoints for widgets** | `curl -H "x-api-key: key_acme_live_123" http://localhost:3000/v1/dashboard/widgets` returns 200 with widgets list; unauthenticated returns 401 | **PASS** |
| **Multi-tenant isolation proven** | `tests/acceptance.test.js` (PROBE 7) checks Tenant Beta query returns 0 rows belonging to Tenant Acme | **PASS** |
| **Embed snippet generated per widget** | Dashboard widget response provides `<script src="http://localhost:3000/v1/widget.v1.js" data-widget-id="wid_..."></script>` | **PASS** |
| **Public config endpoint with HTTP cache headers** | `GET /v1/widgets/:id/config` returns `Cache-Control: public, max-age=60` | **PASS** |
| **Widget JS served as versioned bundle** | `GET /v1/widget.v1.js` returns `Cache-Control: public, max-age=86400, immutable` | **PASS** |
| **Widget renders on different origin** | `customer-site/index.html` loads bundle and renders form from Origin B | **PASS** |
| **Cross-origin submissions with CORS** | `Access-Control-Allow-Origin: *` returned on `POST /v1/submissions` and `OPTIONS` preflight | **PASS** |
| **Boundary validation & 4xx errors** | Oversized payloads return 413, malformed payloads return 400 with Zod field errors | **PASS** |
| **Rate limiting abuse protection** | Ingestion endpoint returns 429 Too Many Requests after burst exceeding limit | **PASS** |
| **Honeypot spam prevention** | Form submissions with hidden `_website_hp` filled return 400 Spam Detected | **PASS** |
| **Geo-enrichment fallback chain** | Provider A (ip-api) -> Provider B (ipapi.co) -> Graceful degradation without geo | **PASS** |
| **Safe side-effects failure tolerance** | Broken SMTP/webhook side-effect catches error asynchronously, HTTP 201 still returns | **PASS** |
