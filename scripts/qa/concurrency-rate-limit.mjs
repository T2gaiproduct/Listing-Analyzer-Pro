#!/usr/bin/env node
/** Parallel requests to exercise in-memory rate limiter (no auth). */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API_BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 30);
const OUT = process.env.QA_OUT ?? "/opt/cursor/artifacts/qa-concurrency-latest.json";

async function main() {
  const url = `${API_BASE}/api/forms`;
  const body = JSON.stringify({
    name: "Concurrency QA",
    email: "concurrency+clerk_test@example.com",
    message: "parallel probe",
    formType: "contact",
  });
  const tasks = Array.from({ length: CONCURRENCY }, () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).then((r) => r.status),
  );
  const statuses = await Promise.all(tasks);
  const counts = statuses.reduce((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const throttled = counts[429] ?? 0;
  const pass = throttled > 0 && (counts[200] ?? 0) + (counts[400] ?? 0) + (counts[502] ?? 0) >= 0;
  const result = {
    at: new Date().toISOString(),
    concurrency: CONCURRENCY,
    statusCounts: counts,
    throttled,
    pass: throttled > 0,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(throttled > 0 ? 0 : 1);
}

main();
