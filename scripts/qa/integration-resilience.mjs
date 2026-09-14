#!/usr/bin/env node
/**
 * Integration / failure-handling checks. Only runs safe scenarios on local API.
 * DB-down test is optional: RUN_DB_DOWN_TEST=1 (stops postgres briefly).
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API_BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const OUT = process.env.QA_OUT ?? "/opt/cursor/artifacts/qa-integration-latest.json";
const results = [];

function row(name, scenario, pass, problem = "") {
  results.push({ integration: name, scenario, status: pass ? "PASS" : "FAIL", problem });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} — ${scenario}${problem ? ` (${problem})` : ""}`);
}

async function main() {
  // Frontend → API via proxy
  const proxy = process.env.PROXY_URL ?? "http://127.0.0.1:3000";
  try {
    const r = await fetch(`${proxy}/api/plans`);
    const j = await r.json();
    row("Frontend→Proxy→API", "GET /api/plans via proxy", r.status === 200 && Array.isArray(j), r.status !== 200 ? `status ${r.status}` : "");
  } catch (e) {
    row("Frontend→Proxy→API", "GET /api/plans via proxy", false, String(e));
  }

  // API → Database
  try {
    const r = await fetch(`${API_BASE}/api/plans`);
    row("API→Postgres", "plans list", r.status === 200, r.status !== 200 ? `status ${r.status}` : "");
  } catch (e) {
    row("API→Postgres", "plans list", false, String(e));
  }

  // Invalid auth
  const unauth = await fetch(`${API_BASE}/api/workspaces`);
  row("API auth gate", "workspaces without session", unauth.status === 401);

  // External fetch-listing (may fail on bad URL — graceful error)
  const listing = await fetch(`${API_BASE}/api/fetch-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.invalid/not-a-listing" }),
  });
  const listingOk = listing.status >= 400 && listing.status < 600;
  row(
    "API→external Amazon scrape",
    "invalid hostname",
    listingOk,
    `status ${listing.status}`,
  );

  // Redis / RabbitMQ — not in stack
  row("Redis", "N/A — not used in codebase", true, "skipped");
  row("RabbitMQ", "N/A — not used in codebase", true, "skipped");

  if (process.env.RUN_DB_DOWN_TEST === "1") {
    console.log("Stopping Postgres for 5s (local only)...");
    try {
      execSync("sudo pg_ctlcluster 16 main stop", { stdio: "pipe" });
      await new Promise((r) => setTimeout(r, 2000));
      let status = 0;
      try {
        const res = await fetch(`${API_BASE}/api/plans`);
        status = res.status;
      } catch {
        status = 0;
      }
      const graceful = status === 500 || status === 503 || status === 0;
      row("API→Postgres failure", "DB stopped", graceful, `plans status=${status}`);
    } finally {
      execSync("sudo pg_ctlcluster 16 main start", { stdio: "pipe" });
      await new Promise((r) => setTimeout(r, 3000));
    }
  } else {
    row("API→Postgres failure", "DB down (skipped)", true, "set RUN_DB_DOWN_TEST=1 to run");
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  const fails = results.filter((r) => r.status === "FAIL").length;
  process.exit(fails ? 1 : 0);
}

main();
