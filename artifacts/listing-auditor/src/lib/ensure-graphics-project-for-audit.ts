import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type GraphicsProjectRow = { id: number };

type AuditSummary = {
  productName?: string | null;
  title?: string | null;
  category?: string | null;
};

/** Resolve or create a graphics project linked to an audit/listing id for Graphics in Detail. */
export async function ensureGraphicsProjectForAudit(auditId: number): Promise<number> {
  const listed = await fetchJson<{ projects: GraphicsProjectRow[] }>(
    `${basePath}/api/graphics/projects?auditId=${auditId}`,
  );
  const existing = listed.projects?.[0];
  if (existing?.id) return existing.id;

  let audit: AuditSummary | null = null;
  try {
    audit = await fetchJson<AuditSummary>(`${basePath}/api/audits/${auditId}`);
  } catch {
    audit = null;
  }

  const productName = audit?.productName?.trim() || audit?.title?.trim() || `Product ${auditId}`;
  const created = await fetchJson<GraphicsProjectRow>(`${basePath}/api/graphics/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: productName,
      productName,
      category: audit?.category?.trim() || undefined,
      auditId,
      imageTypes: [],
      lifestyleCount: 0,
      featureCount: 0,
    }),
  });

  if (!created?.id) {
    throw new Error("Graphics project was not created");
  }
  return created.id;
}
