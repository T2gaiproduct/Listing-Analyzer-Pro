import { ApiFetchError, fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type RunAuditResponse = { overallScore: number };

export async function runListingAudit(auditId: number): Promise<RunAuditResponse> {
  const attempts: Array<() => Promise<RunAuditResponse>> = [
    () => fetchJson(`${basePath}/api/audits/${auditId}/analyze`, { method: "POST" }),
    () => fetchJson(`${basePath}/api/products/${auditId}/run-audit`, { method: "POST" }),
    () => fetchJson(`${basePath}/api/audits/${auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runAnalysis: true }),
    }),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (err instanceof ApiFetchError && err.status === 404) {
        continue;
      }
      throw err;
    }
  }

  if (lastError instanceof ApiFetchError) {
    throw new ApiFetchError(
      "Audit API is not available yet. Restart the API server (or Replit API workflow) to load the latest code, then try again.",
      lastError.status,
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Audit API is not available. Restart the API server and try again.");
}
