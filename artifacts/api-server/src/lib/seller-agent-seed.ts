import { and, eq } from "drizzle-orm";
import { db, sellerAgentsTable } from "@workspace/db";
import { DEFAULT_SELLER_AGENT_TEMPLATES } from "./seller-agent-defaults.js";

export async function ensureDefaultSellerAgentsForWorkspace(
  workspaceId: number,
  userId: string,
): Promise<void> {
  const existing = await db
    .select({ id: sellerAgentsTable.id })
    .from(sellerAgentsTable)
    .where(and(
      eq(sellerAgentsTable.workspaceId, workspaceId),
      eq(sellerAgentsTable.isDeleted, 0),
    ))
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date();
  await db.insert(sellerAgentsTable).values(
    DEFAULT_SELLER_AGENT_TEMPLATES.map((template) => ({
      workspaceId,
      userId,
      name: template.name,
      description: template.description,
      instructions: template.instructions,
      icon: template.icon,
      isDefault: 1,
      isPlatformTemplate: 1,
      mode: "basic",
      enabledSkills: template.enabledSkills,
      learnFromWorkspace: 1,
      createdAt: now,
      updatedAt: now,
    })),
  );
}
