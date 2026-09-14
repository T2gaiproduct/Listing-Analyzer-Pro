import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const duration = new Trend("request_duration", true);

const BASE = __ENV.BASE_URL || "http://127.0.0.1:8080";

export const options = {
  scenarios: {
    smoke_10: { executor: "constant-vus", vus: 10, duration: "15s", startTime: "0s", tags: { load: "10" } },
    ramp_50: { executor: "constant-vus", vus: 50, duration: "20s", startTime: "16s", tags: { load: "50" } },
    ramp_100: { executor: "constant-vus", vus: 100, duration: "25s", startTime: "37s", tags: { load: "100" } },
  },
  thresholds: {
    errors: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  const res = http.get(`${BASE}/api/healthz`);
  duration.add(res.timings.duration);
  const ok = check(res, { "status 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  sleep(0.1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const summary = {
    http_reqs: m.http_reqs?.values?.count,
    http_req_failed_rate: m.http_req_failed?.values?.rate,
    avg_ms: m.http_req_duration?.values?.avg,
    p50_ms: m.http_req_duration?.values?.med,
    p95_ms: m.http_req_duration?.values["p(95)"],
    p99_ms: m.http_req_duration?.values["p(99)"],
    rps: m.http_reqs?.values?.rate,
  };
  const stdout = Object.entries(summary)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return {
    stdout,
    "/opt/cursor/artifacts/qa-k6-summary.json": JSON.stringify({ summary, raw: data }, null, 2),
  };
}
