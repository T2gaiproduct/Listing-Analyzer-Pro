import { eq } from "drizzle-orm";
import { db, productProfilesTable } from "@workspace/db";

function deriveSku(productName: string, id: number): string {
  const parts = productName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase());
  const prefix = parts.join("-") || "PRD";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

export interface ProductProfilePatchInput {
  sku?: string;
  priority?: string;
  assignedManager?: string;
  notes?: string;
}

export async function applyProductProfileUpdates(
  auditId: number,
  body: ProductProfilePatchInput,
  fallbackProductName: string,
): Promise<void> {
  const profileUpdates: Record<string, unknown> = {};

  if (typeof body.sku === "string") {
    const trimmedSku = body.sku.trim();
    if (!trimmedSku) throw new Error("SKU is required");
    profileUpdates.sku = trimmedSku;
  }
  if (typeof body.priority === "string") {
    profileUpdates.priority =
      body.priority === "high" || body.priority === "low" ? body.priority : "medium";
  }
  if (typeof body.assignedManager === "string") {
    profileUpdates.assignedManager = body.assignedManager.trim() || null;
  }
  if (typeof body.notes === "string") {
    profileUpdates.notes = body.notes.trim() || null;
  }

  if (Object.keys(profileUpdates).length === 0) return;

  const [existingProfile] = await db
    .select()
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, auditId))
    .limit(1);

  if (existingProfile) {
    await db
      .update(productProfilesTable)
      .set(profileUpdates)
      .where(eq(productProfilesTable.auditId, auditId));
    return;
  }

  await db.insert(productProfilesTable).values({
    auditId,
    sku: (profileUpdates.sku as string | undefined) ?? deriveSku(fallbackProductName, auditId),
    priority: (profileUpdates.priority as string | undefined) ?? "medium",
    assignedManager: (profileUpdates.assignedManager as string | null | undefined) ?? null,
    notes: (profileUpdates.notes as string | null | undefined) ?? null,
    workflowTemplate: "build-brand-standard",
    targetMarketplaces: [],
  });
}
