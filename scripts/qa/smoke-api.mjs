#!/usr/bin/env node
/**
 * Local smoke tests — safe for dev VM only. No secrets printed.
 * Usage: BASE_URL=http://127.0.0.1:8080 node scripts/qa/smoke-api.mjs
 *        PROXY_URL=http://127.0.0.1:3000 node scripts/qa/smoke-api.mjs
 */
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const API_BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const PROXY_BASE = process.env.PROXY_URL?.replace(/\/$/, "");
const FRONTEND_BASE = process.env.FRONTEND_URL ?? "http://127.0.0.1:19145";
const OUT = process.env.QA_OUT ?? "/opt/cursor/artifacts/qa-smoke-latest.json";

const results = [];

function record(caseName, expected, actual, pass, extra = {}) {
  results.push({
    case: caseName,
    expected,
    actual,
    status: pass ? "PASS" : "FAIL",
    ...extra,
  });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${caseName} | expected: ${expected} | actual: ${actual}`);
  if (!pass && extra.error) console.log(`       ${extra.error}`);
}

async function fetchStatus(url, init = {}) {
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  let bodySnippet = text.slice(0, 200);
  try {
    const j = JSON.parse(text);
    bodySnippet = JSON.stringify(j).slice(0, 200);
  } catch {
    /* html */
  }
  return { status: res.status, bodySnippet, headers: res.headers };
}

async function main() {
  // API health
  try {
    const { status, bodySnippet } = await fetchStatus(`${API_BASE}/api/healthz`);
    record("API GET /api/healthz", "200", String(status), status === 200, {
      httpStatus: status,
      evidence: bodySnippet,
    });
  } catch (e) {
    record("API GET /api/healthz", "200", "error", false, {
      error: e instanceof Error ? e.message : String(e),
      blocker: true,
    });
  }

  // Public plans (DB-backed)
  try {
    const { status, bodySnippet } = await fetchStatus(`${API_BASE}/api/plans`);
    const pass = status === 200 && bodySnippet.includes("[");
    record("API GET /api/plans", "200 + JSON array", `${status}`, pass, {
      httpStatus: status,
      evidence: bodySnippet,
      blocker: !pass,
    });
  } catch (e) {
    record("API GET /api/plans", "200", "error", false, { error: String(e), blocker: true });
  }

  const protectedPaths = [
    "/api/audits",
    "/api/dashboard",
    "/api/profile",
    "/api/audits/1/export/preview",
    "/api/workspaces",
  ];
  for (const path of protectedPaths) {
    const { status, bodySnippet } = await fetchStatus(`${API_BASE}${path}`);
    const pass = status === 401;
    record(`API GET ${path} (no auth)`, "401", String(status), pass, {
      httpStatus: status,
      evidence: bodySnippet,
      blocker: path.includes("export/preview") && status === 404,
    });
  }

  // Malformed body on protected route still 401 before parse issues
  const badPost = await fetch(`${API_BASE}/api/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not-json",
  });
  record(
    "API POST /api/audits malformed JSON (no auth)",
    "400",
    String(badPost.status),
    badPost.status === 400,
    { httpStatus: badPost.status },
  );

  try {
    const healthRes = await fetch(`${API_BASE}/api/healthz`);
    const healthText = await healthRes.text();
    const parsed = JSON.parse(healthText);
    const hasBuild = typeof parsed.apiBuildId === "string" && parsed.apiBuildId.length > 0;
    const stale = parsed.staleProcess === true;
    const metaOk = healthRes.status === 200 && hasBuild && !stale;
    const actualDesc = !hasBuild
      ? "missing apiBuildId (restart API on latest main)"
      : stale
        ? "staleProcess=true"
        : "ok";
    record(
      "API GET /api/healthz build metadata",
      "apiBuildId present, staleProcess false",
      actualDesc,
      metaOk,
      {
        httpStatus: healthRes.status,
        evidence: healthText.slice(0, 160),
        blocker: !hasBuild,
      },
    );
  } catch (e) {
    record("API GET /api/healthz build metadata", "ok", "error", false, { error: String(e) });
  }

  if (PROXY_BASE) {
    const proxyHealth = await fetchStatus(`${PROXY_BASE}/api/healthz`);
    record(
      "Proxy GET /api/healthz",
      "200",
      String(proxyHealth.status),
      proxyHealth.status === 200,
      { httpStatus: proxyHealth.status },
    );
  }

  // Frontend shell (no Clerk JS execution)
  for (const [name, url] of [
    ["Frontend GET /sign-in", `${FRONTEND_BASE}/sign-in`],
    ["Frontend GET /dashboard", `${FRONTEND_BASE}/dashboard`],
  ]) {
    try {
      const { status } = await fetchStatus(url);
      record(name, "200", String(status), status === 200, { httpStatus: status });
    } catch (e) {
      record(name, "200", "error", false, { error: String(e) });
    }
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const blockers = results.filter((r) => r.blocker && r.status === "FAIL");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        apiBase: API_BASE,
        proxyBase: PROXY_BASE ?? null,
        summary: { total: results.length, passed: results.length - failed.length, failed: failed.length, blockers: blockers.length },
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\nWrote ${OUT}`);
  if (blockers.length) {
    console.error(`BLOCKERS: ${blockers.map((b) => b.case).join(", ")}`);
    process.exit(2);
  }
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
