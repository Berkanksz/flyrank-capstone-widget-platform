let forceFailA = false;
let forceFailB = false;

function setMockGeoFailures(options = {}) {
  if (typeof options.providerA === "boolean") forceFailA = options.providerA;
  if (typeof options.providerB === "boolean") forceFailB = options.providerB;
}

async function lookupProviderA(ip) {
  if (forceFailA) throw new Error("Provider A forcefully disabled for probe");
  
  // Real or mock fallback for local testing
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
    return { country: "Local Network", city: "Development", provider: "ip-api.com" };
  }

  const url = `http://ip-api.com/json/${ip}?fields=status,country,city`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Provider A HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === "fail") throw new Error("Provider A lookup failed");
    return { country: data.country || "Unknown", city: data.city || "Unknown", provider: "ip-api.com" };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function lookupProviderB(ip) {
  if (forceFailB) throw new Error("Provider B forcefully disabled for probe");

  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
    return { country: "Local Network", city: "Development", provider: "ipapi.co" };
  }

  const url = `https://ipapi.co/${ip}/json/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Provider B HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.reason || "Provider B lookup error");
    return { country: data.country_name || "Unknown", city: data.city || "Unknown", provider: "ipapi.co" };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Fallback chain: Provider A -> Provider B -> Store anyway (degrade gracefully)
 */
async function resolveGeo(ip) {
  // Try Provider A
  try {
    return await lookupProviderA(ip);
  } catch (errA) {
    console.warn(`[GEO] Provider A failed: ${errA.message}. Falling back to Provider B.`);
  }

  // Try Provider B
  try {
    return await lookupProviderB(ip);
  } catch (errB) {
    console.warn(`[GEO] Provider B failed: ${errB.message}. Degrading gracefully.`);
  }

  // Both providers failed: store submission without geo
  return {
    country: null,
    city: null,
    provider: "none (degraded)",
  };
}

module.exports = {
  resolveGeo,
  setMockGeoFailures,
};
