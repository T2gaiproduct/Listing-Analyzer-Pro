import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const BASE = __ENV.BASE_URL || "http://127.0.0.1:8080";
const MAX_VUS = Number(__ENV.MAX_VUS || 500);

export const options = {
  stages: [
    { duration: "20s", target: 100 },
    { duration: "20s", target: 250 },
    { duration: "20s", target: MAX_VUS },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  const res = http.get(`${BASE}/api/healthz`);
  errorRate.add(!check(res, { ok: (r) => r.status === 200 }));
  sleep(0.05);
}

export function handleSummary(data) {
  const m = data.metrics;
  return {
    stdout: `stress max_vus=${MAX_VUS} rps=${m.http_reqs?.values?.rate} err=${m.http_req_failed?.values?.rate} p95=${m.http_req_duration?.values["p(95)"]}ms\n`,
    "/opt/cursor/artifacts/qa-k6-stress-summary.json": JSON.stringify(data, null, 2),
  };
}
