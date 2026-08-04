type VitalMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
} as const;

function rate(name: keyof typeof THRESHOLDS, value: number): VitalMetric["rating"] {
  const t = THRESHOLDS[name];
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

function send(metric: VitalMetric) {
  if (import.meta.env.DEV) {
    console.info(`[web-vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

export function initWebVitalsReporting() {
  if (typeof window === "undefined") return;

  void import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
    onLCP((m) => send({ name: "LCP", value: m.value, rating: rate("LCP", m.value) }));
    onINP((m) => send({ name: "INP", value: m.value, rating: rate("INP", m.value) }));
    onCLS((m) => send({ name: "CLS", value: m.value, rating: rate("CLS", m.value) }));
  }).catch(() => {
    // Optional dependency — ignore if unavailable.
  });
}
