/* eslint-disable no-console */
const BASE_URL = (process.env.VERIFY_BASE_URL || "https://school-management-system-1-ach4.onrender.com").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 20000);

const endpoints = [
  { name: "health", path: "/api/health", method: "GET", expectJson: true },
  { name: "home", path: "/", method: "GET" },
  { name: "login", path: "/login", method: "GET" },
  { name: "forgot-password-sms", path: "/forgot-password-sms", method: "GET" },
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function classifyBody(text, status) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("application loading") || normalized.includes("service waking up") || normalized.includes("free_interstitialv2")) {
    return "render-interstitial";
  }

  if (status >= 200 && status < 300) {
    if (normalized.includes("\"success\":true") || normalized.includes("<!doctype html") || normalized.includes("<html")) {
      return "ok";
    }
    return "unexpected-2xx";
  }

  if (status === 404) return "not-found";
  if (status === 503) return "service-unavailable";
  return "http-error";
}

async function checkEndpoint({ name, path, method, expectJson }) {
  const url = `${BASE_URL}${path}`;

  const response = await withTimeout(fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "school-management-deploy-verifier",
    },
  }), TIMEOUT_MS);

  const text = await response.text();
  const classification = classifyBody(text, response.status);

  let parsed = null;
  if (expectJson) {
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      parsed = null;
    }
  }

  return {
    name,
    url,
    status: response.status,
    classification,
    successFlag: parsed?.success,
    preview: text.slice(0, 200).replace(/\s+/g, " ").trim(),
  };
}

function printResult(result) {
  const marker = result.classification === "ok" ? "✅" : "❌";
  console.log(`${marker} [${result.name}] ${result.status} ${result.classification}`);
  console.log(`   ${result.url}`);
  if (result.successFlag !== undefined) {
    console.log(`   success: ${String(result.successFlag)}`);
  }
  if (result.classification !== "ok") {
    console.log(`   preview: ${result.preview}`);
  }
}

(async () => {
  console.log(`\n🔎 Post-deploy verification`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout : ${TIMEOUT_MS}ms\n`);

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const result = await checkEndpoint(endpoint);
      results.push(result);
      printResult(result);
    } catch (error) {
      const failed = {
        name: endpoint.name,
        url: `${BASE_URL}${endpoint.path}`,
        status: 0,
        classification: "request-failed",
        preview: error.message,
      };
      results.push(failed);
      printResult(failed);
    }
  }

  const failed = results.filter((r) => r.classification !== "ok");
  console.log("\n--- Summary ---");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\n❗Some checks failed. Common causes:");
    console.log("- Render cold start / free-tier interstitial");
    console.log("- Service not healthy yet");
    console.log("- Env vars missing (e.g., MONGO_URI)");
    process.exitCode = 1;
    return;
  }

  console.log("\n✅ Deploy verification passed.");
})();
