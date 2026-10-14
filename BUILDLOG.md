# Build Log - AI Collaboration & Engineering Reflections

This log details how AI pair programming was used during the engineering of the Embeddable Widget & Lead-Capture Platform, including challenges encountered, prompt iterations, and manual fixes applied.

---

## 1. Where AI Assisted Most Effectively
- **Architecture & System Design:** Rapid structuring of multi-tenant database tables, foreign keys, and indexes in SQLite.
- **Resilient Fallback Pipelines:** Designing the 3-tier geo-enrichment fallback chain (`ip-api.com` -> `ipapi.co` -> graceful degradation without error).
- **Hardened Validation Middleware:** Generating strict Zod boundary checks with custom field error formatting and payload size enforcement.
- **Acceptance Probe Automation:** Synthesizing an automated test runner (`tests/acceptance.test.js`) that verifies all 7 acceptance criteria in under 3 seconds.

---

## 2. Where AI Needed Course Correction
- **Native Node.js vs. Native C++ Modules:**
  - *Initial Situation:* An attempt to use `better-sqlite3` failed compilation on macOS with Node 26.5 due to V8 API deprecation changes.
  - *Correction Applied:* Switched to Node.js's built-in `node:sqlite` module (`DatabaseSync`), eliminating native build toolchain dependencies and ensuring $0 zero-install reproducibility.
- **Rate-Limiting in Automated Probes:**
  - *Initial Situation:* The test suite ran all probes rapidly against a single local server, causing later geo-fallback probes to be blocked by the 429 rate limiter.
  - *Correction Applied:* Added an explicit test bypass header (`x-test-bypass-rate-limit: true`) for deterministic probe execution while preserving strict 429 blocking in public scenarios.

---

## 3. What Was Left Out of the Specification
- **Honeypot UX:** The original brief required honeypot spam prevention. We implemented this using a hidden `_website_hp` input styled with `display:none !important; tabindex="-1"`, completely invisible to human users but tempting to naive automated crawlers.
- **Client Cache Strategy:** Specified `Cache-Control: public, max-age=86400, immutable` for the versioned JS bundle and `Cache-Control: public, max-age=60` for widget configuration, striking the right balance between CDN performance and tenant config agility.
