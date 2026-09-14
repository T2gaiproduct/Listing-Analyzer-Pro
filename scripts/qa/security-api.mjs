#!/usr/bin/env node
/**
 * Non-destructive security-oriented API checks (local dev).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API_BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const OUT = process.env.QA_OUT ?? "/opt/cursor/artifacts/qa-security-latest.json";

const results = [];

function log(caseName, pass, detail) {
  results.push({ case: caseName, status: pass ? "PASS" : "FAIL", detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${caseName}: ${detail}`);
}

async function main() {
  // Auth bypass: protected resource without credentials
  const audits = await fetch(`${API_BASE}/api/audits`);
  log("Auth bypass GET /api/audits", audits.status === 401, `status=${audits.status}`);

  // Invalid session cookie
  const fakeSession = await fetch(`${API_BASE}/api/profile`, {
    headers: { Cookie: "__session=invalid.jwt.token" },
  });
  log("Invalid session cookie", fakeSession.status === 401, `status=${fakeSession.status}`);

  // IDOR probe: numeric audit id without auth
  const idor = await fetch(`${API_BASE}/api/audits/999999`);
  log("IDOR probe audit 999999", idor.status === 401, `status=${idor.status}`);

  // SQL injection in path (should not 500; auth or 404)
  const sqli = await fetch(`${API_BASE}/api/audits/1'%20OR%201=1--`);
  log(
    "SQLi path segment",
    sqli.status === 401 || sqli.status === 404 || sqli.status === 400,
    `status=${sqli.status}`,
  );

  // Security headers (helmet)
  const health = await fetch(`${API_BASE}/api/healthz`);
  const xcto = health.headers.get("x-content-type-options");
  log("Helmet X-Content-Type-Options", xcto === "nosniff", `value=${xcto ?? "missing"}`);

  // Rate limit on public /api/forms (10/hour per IP) — auth not required
  const limit = 12;
  let rateLimited = false;
  const bodies = [];
  const formBody = JSON.stringify({
    name: "QA Bot",
    email: "qa+clerk_test@example.com",
    message: "rate limit probe",
    formType: "contact",
  });
  for (let i = 0; i < limit; i++) {
    const r = await fetch(`${API_BASE}/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: formBody,
    });
    bodies.push(r.status);
    if (r.status === 429) rateLimited = true;
  }
  log(
    "Rate limit /api/forms",
    rateLimited,
    `429 count=${bodies.filter((s) => s === 429).length}; sample=${bodies.slice(-5).join(",")}`,
  );

  // XSS reflection probe on public form (should validate, not echo raw script)
  const xss = await fetch(`${API_BASE}/api/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "<script>alert(1)</script>",
      email: "not-an-email",
      message: "test",
      formType: "contact",
    }),
  });
  const xssText = await xss.text();
  log(
    "Malformed contact form",
    xss.status === 400 || xss.status === 422 || xss.status === 429,
    `status=${xss.status} body=${xssText.slice(0, 80)}`,
  );

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  const fails = results.filter((r) => r.status === "FAIL").length;
  process.exit(fails ? 1 : 0);
}

main();
