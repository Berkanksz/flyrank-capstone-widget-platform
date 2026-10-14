const assert = require("node:assert");
const { setMockGeoFailures } = require("../src/services/geo");
const { setMockEmailFailure } = require("../src/services/notifier");
const db = require("../src/db");
const seed = require("../src/db/seed");

async function runAcceptanceTests() {
  console.log("=== RUNNING CAPSTONE ACCEPTANCE PROBES ===\n");

  const app = require("../src/server");
  const server = app.listen(3099);
  const BASE = "http://127.0.0.1:3099";

  try {
    seed();

    // PROBE 1: Valid submission from cross-origin test -> stored, 2xx, visible via dashboard
    console.log("PROBE 1: Cross-Origin Valid Submission & Dashboard Visibility");
    const res1 = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5500", // Simulating second origin
      },
      body: JSON.stringify({
        widget_id: "wid_newsletter",
        data: { email: "lead@testcompany.com", name: "Alice Developer" },
      }),
    });
    assert.strictEqual(res1.status, 201, "Expected 201 Created");
    assert.strictEqual(res1.headers.get("access-control-allow-origin"), "*", "Expected CORS header");
    const json1 = await res1.json();
    assert.ok(json1.id, "Expected submission ID in response");

    // Check dashboard visibility for tenant Acme
    const dashRes = await fetch(`${BASE}/v1/dashboard/submissions`, {
      headers: { "x-api-key": "key_acme_live_123" },
    });
    const dashJson = await dashRes.json();
    const stored = dashJson.find((s) => s.id === json1.id);
    assert.ok(stored, "Submission should be visible in Acme dashboard");
    assert.strictEqual(stored.data.email, "lead@testcompany.com");
    console.log("-> PROBE 1 PASSED: Submission stored, enriched, and visible.\n");

    // PROBE 2: Send malformed and oversized payload -> clean 4xx JSON errors, never 500
    console.log("PROBE 2: Boundary Validation (Malformed & Oversized Payloads)");
    const malformedRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget_id: "", data: {} }),
    });
    assert.strictEqual(malformedRes.status, 400, "Expected 400 Bad Request");
    const malformedJson = await malformedRes.json();
    assert.strictEqual(malformedJson.error, "Validation Error");

    const hugeString = "X".repeat(60 * 1024); // 60KB payload (exceeds 50KB limit)
    const oversizedRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget_id: "wid_newsletter", data: { big: hugeString } }),
    });
    assert.strictEqual(oversizedRes.status, 413, "Expected 413 Payload Too Large");
    console.log("-> PROBE 2 PASSED: Clean 400 and 413 returned, zero 500s.\n");

    // PROBE 3: Fire burst of rapid submissions -> 429 appear, normal request after still succeeds
    console.log("PROBE 3: Abuse Protection & Rate Limiting (Burst 429s)");
    let hit429 = false;
    for (let i = 0; i < 15; i++) {
      const burstRes = await fetch(`${BASE}/v1/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_id: "wid_newsletter",
          data: { email: `burst_${i}@test.com` },
        }),
      });
      if (burstRes.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.ok(hit429, "Expected 429 Too Many Requests under burst");
    console.log("-> PROBE 3 PASSED: Rate limiter triggered with 429.\n");

    // PROBE 4: Disable geo provider A -> next stored enriched by provider B. Disable both -> stored anyway
    console.log("PROBE 4: Resilient Geo-Enrichment Fallback Chain");
    setMockGeoFailures({ providerA: true, providerB: false });
    const fallbackRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-bypass-rate-limit": "true",
      },
      body: JSON.stringify({
        widget_id: "wid_newsletter",
        data: { email: "fallback_b@test.com" },
      }),
    });
    const fallbackJson = await fallbackRes.json();
    assert.strictEqual(fallbackRes.status, 201, "Expected 201 Created for fallback");
    const subB = db.prepare("SELECT * FROM submissions WHERE id = ?").get(fallbackJson.id);
    assert.strictEqual(subB.geo_provider, "ipapi.co", "Expected Provider B fallback");

    // Disable both
    setMockGeoFailures({ providerA: true, providerB: true });
    const noGeoRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-bypass-rate-limit": "true",
      },
      body: JSON.stringify({
        widget_id: "wid_newsletter",
        data: { email: "no_geo@test.com" },
      }),
    });
    const noGeoJson = await noGeoRes.json();
    assert.strictEqual(noGeoRes.status, 201, "Expected 201 Created for degraded mode");
    const subNone = db.prepare("SELECT * FROM submissions WHERE id = ?").get(noGeoJson.id);
    assert.strictEqual(subNone.geo_provider, "none (degraded)", "Expected degraded graceful save");
    setMockGeoFailures({ providerA: false, providerB: false }); // Reset
    console.log("-> PROBE 4 PASSED: Fallback to Provider B and graceful degradation verified.\n");

    // PROBE 5: Force side-effect email/webhook to throw -> submission still returns success 201
    console.log("PROBE 5: Safe Side-Effect Fault Tolerance");
    setMockEmailFailure(true);
    const sideEffectRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-bypass-rate-limit": "true",
      },
      body: JSON.stringify({
        widget_id: "wid_newsletter",
        data: { email: "failing_email@test.com" },
      }),
    });
    assert.strictEqual(sideEffectRes.status, 201, "Expected 201 even when email fails");
    setMockEmailFailure(false);
    console.log("-> PROBE 5 PASSED: Side-effect failure did not block submission success.\n");

    // PROBE 6: Honeypot field filled like a bot -> submission blocked
    console.log("PROBE 6: Honeypot Spam Prevention");
    const botRes = await fetch(`${BASE}/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-bypass-rate-limit": "true",
      },
      body: JSON.stringify({
        widget_id: "wid_newsletter",
        _website_hp: "I am an automated bot",
        data: { email: "spam@bot.net" },
      }),
    });
    assert.strictEqual(botRes.status, 400, "Bot submission should be rejected with 400");
    const botJson = await botRes.json();
    assert.strictEqual(botJson.error, "Spam Detected");
    console.log("-> PROBE 6 PASSED: Bot submission rejected by honeypot field.\n");

    // PROBE 7: Multi-tenant isolation verification
    console.log("PROBE 7: Multi-Tenant Isolation Enforcement");
    const betaDashRes = await fetch(`${BASE}/v1/dashboard/submissions`, {
      headers: { "x-api-key": "key_beta_live_456" },
    });
    const betaSubs = await betaDashRes.json();
    const hasAcmeData = betaSubs.some((s) => s.data.email === "lead@testcompany.com");
    assert.strictEqual(hasAcmeData, false, "Tenant Beta must never see Tenant Acme data");
    console.log("-> PROBE 7 PASSED: Tenant data strictly partitioned.\n");

    console.log("ALL ACCEPTANCE PROBES PASSED WITH 100% SUCCESS!");
  } finally {
    server.close();
  }
}

runAcceptanceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
