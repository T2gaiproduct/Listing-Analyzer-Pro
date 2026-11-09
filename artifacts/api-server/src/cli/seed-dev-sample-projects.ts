/**
 * Idempotent sample listing + graphics projects for local dev accounts (dashboard / recents).
 *
 *   export DATABASE_URL=postgresql://...
 *   pnpm --filter @workspace/api-server exec tsx src/cli/seed-dev-sample-projects.ts USER_ID
 */
import { and, eq } from "drizzle-orm";
import { db, auditsTable, graphicsProjectsTable, workspacesTable } from "@workspace/db";
import type { AuditResult, GeneratedContent } from "@workspace/db";

const userId = process.argv[2]?.trim();
if (!userId) {
  console.error("Usage: seed-dev-sample-projects.ts USER_ID");
  process.exit(1);
}

const DEV_ASIN_LISTING = "DEV-LOCAL-BYB-001";
const DEV_ASIN_AUDIT = "B08DEVLOCAL2";

const [workspace] = await db
  .select({ id: workspacesTable.id })
  .from(workspacesTable)
  .where(
    and(
      eq(workspacesTable.accountOwnerId, userId),
      eq(workspacesTable.isDefault, true),
      eq(workspacesTable.isDeleted, 0),
    ),
  )
  .limit(1);

const workspaceId = workspace?.id ?? null;

async function ensureAudit(
  asin: string,
  row: typeof auditsTable.$inferInsert,
): Promise<number> {
  const [existing] = await db
    .select({ id: auditsTable.id, isDeleted: auditsTable.isDeleted })
    .from(auditsTable)
    .where(and(eq(auditsTable.userId, userId), eq(auditsTable.asin, asin)))
    .limit(1);

  if (existing) {
    if (existing.isDeleted) {
      await db
        .update(auditsTable)
        .set({ isDeleted: 0, deletedAt: null, updatedAt: new Date() })
        .where(eq(auditsTable.id, existing.id));
    }
    return existing.id;
  }

  const [inserted] = await db
    .insert(auditsTable)
    .values({ ...row, asin, userId, workspaceId })
    .returning({ id: auditsTable.id });
  return inserted!.id;
}

const sampleResult: AuditResult = {
  overallScore: 82,
  summary: "Solid listing with room to improve bullets and main image contrast.",
  titleScore: { score: 85, issues: [], suggestions: ["Add primary keyword near the front."] },
  bulletScore: { score: 78, issues: ["Bullets 2–3 are similar."], suggestions: ["Lead each bullet with a benefit."] },
  imageScore: { score: 80, issues: [], suggestions: ["Add an infographic slide."] },
  keywordScore: { score: 84, issues: [], suggestions: [] },
};

const sampleGenerated: GeneratedContent = {
  title: "Premium Stainless Water Bottle — 32oz Insulated, Leak-Proof Lid",
  bulletPoints: [
    "KEEPS DRINKS COLD 24H / HOT 12H — double-wall vacuum insulation.",
    "LEAK-PROOF FLIP LID — gym bag and commute ready.",
    "WIDE MOUTH — fits ice cubes and cleans easily.",
    "BPA-FREE 18/8 STEEL — durable powder-coat finish.",
    "FITS STANDARD CUP HOLDERS — take it anywhere.",
  ],
  keywords: ["insulated water bottle", "32oz", "stainless steel", "leak proof"],
  htmlDescription: "<p>Stay hydrated with our insulated 32oz bottle.</p>",
};

const listingAuditId = await ensureAudit(DEV_ASIN_LISTING, {
  projectName: "Summit Trail Bottle — Launch",
  productName: "Summit Trail Insulated Bottle",
  brandName: "Summit Trail Co.",
  category: "Sports & Outdoors",
  title: "Summit Trail 32oz Insulated Water Bottle — Matte Black",
  bulletPoints: [
    "Double-wall vacuum insulation",
    "Leak-proof sport lid",
    "Fits most cup holders",
  ],
  imageUrls: [
    "https://images.unsplash.com/photo-1602143404851-0d0f041b5bb2?w=400",
  ],
  targetKeywords: ["water bottle", "insulated", "32oz"],
  overallScore: 0,
  status: "in_progress",
  currentStep: 2,
  projectOrigin: "build_brand",
  createdByUserId: userId,
});

const auditAuditId = await ensureAudit(DEV_ASIN_AUDIT, {
  projectName: "Competitor ASIN Audit",
  productName: "Rival Brand Bottle 24oz",
  brandName: "Rival Brand",
  category: "Kitchen",
  title: "Rival 24oz Steel Bottle — Silver",
  bulletPoints: ["Single wall steel", "Screw cap", "Lightweight"],
  imageUrls: [
    "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400",
  ],
  targetKeywords: ["steel bottle", "24oz"],
  overallScore: 82,
  status: "completed",
  result: sampleResult,
  generatedContent: sampleGenerated,
  currentStep: 6,
  projectOrigin: "asin",
  createdByUserId: userId,
});

const graphicsName = "Summit Bottle — Lifestyle Pack";
const [existingGfx] = await db
  .select({ id: graphicsProjectsTable.id, isDeleted: graphicsProjectsTable.isDeleted })
  .from(graphicsProjectsTable)
  .where(
    and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.name, graphicsName)),
  )
  .limit(1);

let graphicsId = existingGfx?.id;
if (existingGfx?.isDeleted) {
  await db
    .update(graphicsProjectsTable)
    .set({ isDeleted: 0, deletedAt: null, updatedAt: new Date() })
    .where(eq(graphicsProjectsTable.id, existingGfx.id));
}

if (!graphicsId) {
  const [gfx] = await db
    .insert(graphicsProjectsTable)
    .values({
      userId,
      workspaceId,
      auditId: listingAuditId,
      name: graphicsName,
      productName: "Summit Trail Insulated Bottle",
      category: "Sports & Outdoors",
      sourceImageUrls: [
        "https://images.unsplash.com/photo-1602143404851-0d0f041b5bb2?w=400",
      ],
      status: "draft",
      lifestyleCount: 3,
      featureCount: 2,
      createdByUserId: userId,
    })
    .returning({ id: graphicsProjectsTable.id });
  graphicsId = gfx!.id;
}

console.log(
  JSON.stringify({
    ok: true,
    userId,
    workspaceId,
    listingAuditId,
    auditAuditId,
    graphicsProjectId: graphicsId,
  }),
);
