import type { CreateAuditBody } from "@workspace/api-client-react";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AuditDraftRecord = {
  id: number;
  projectName?: string | null;
  productName?: string | null;
};

/** Create a Build Your Brand draft via same-origin apiFetch (Bearer + cookie retry on preview). */
export async function postAuditDraft(body: CreateAuditBody): Promise<AuditDraftRecord> {
  return fetchJson<AuditDraftRecord>(`${basePath}/api/audits/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
