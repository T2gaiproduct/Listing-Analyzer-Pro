import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, competitorsTable, userProfilesTable } from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
} from "../lib/workspace-route-helpers";
import type { TeamAuthedRequest } from "../middlewares/team-auth";
import { buildProductSuggestions, type ProductSuggestionInput } from "../lib/product-suggestions.js";
import { mapProductPriority } from "../lib/product-priority.js";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  return true;
}

function pickThumbnail(opts: {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): string | null {
  const candidates: string[] = [];
  for (const rec of opts.imageRecords ?? []) {
    if (isUsableImageUrl(rec.currentUrl)) candidates.push(rec.currentUrl.trim());
  }
  for (const url of opts.imageUrls ?? []) {
    if (isUsableImageUrl(url)) candidates.push(url.trim());
  }
  const generated = opts.generatedImages;
  if (generated) {
    for (const url of [
      ...(generated.main ?? []),
      ...(generated.lifestyle ?? []),
      ...(generated.infographic ?? []),
    ]) {
      if (isUsableImageUrl(url)) candidates.push(url.trim());
    }
  }
  return candidates[0] ?? null;
}

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

type ProductStatus = "active" | "in_progress" | "draft" | "failed";

function mapProductStatus(status: string, currentStep: number | null): { status: ProductStatus; label: string } {
  if (status === "complete") return { status: "active", label: "Active" };
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (status === "draft" && (currentStep ?? 1) > 1) {
    return { status: "in_progress", label: "In progress" };
  }
  if (status === "pending") return { status: "in_progress", label: "In progress" };
  return { status: "draft", label: "Draft" };
}

const WORKFLOW_STEP_LABELS = ["Upload", "Listing", "Graphics", "A+ Content", "Export"];

function mapStageLabel(status: string, currentStep: number | null): string {
  if (status === "complete") return "Live";
  const step = Math.min(5, Math.max(1, currentStep ?? 1));
  if (step >= 5) return "Ready to export";
  return WORKFLOW_STEP_LABELS[step - 1] ?? "Upload";
}

function calcProgress(status: string, currentStep: number | null): number {
  if (status === "complete") return 100;
  const step = currentStep ?? 1;
  return Math.min(100, Math.round((step / 5) * 100));
}

function managerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function buildNotes(audit: {
  result?: { summary?: string } | null;
  generatedContent?: { bulletPoints?: string[] } | null;
  bulletPoints?: string[];
}): string {
  const summary = audit.result?.summary?.trim();
  if (summary) return summary;
  const bullets = audit.generatedContent?.bulletPoints ?? audit.bulletPoints ?? [];
  if (bullets.length > 0) {
    return bullets.slice(0, 2).join(" ");
  }
  return "No notes yet. Complete the listing step in Build Your Brand to generate product notes.";
}

function countImages(row: {
  imageUrls?: string[] | null;
  imageRecords?: unknown[] | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}): number {
  const urls = new Set<string>();
  for (const u of row.imageUrls ?? []) {
    if (isUsableImageUrl(u)) urls.add(u.trim());
  }
  for (const rec of row.imageRecords ?? []) {
    const url = (rec as { currentUrl?: string }).currentUrl;
    if (isUsableImageUrl(url)) urls.add(url.trim());
  }
  const g = row.generatedImages;
  if (g) {
    for (const u of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (isUsableImageUrl(u)) urls.add(u.trim());
    }
  }
  return urls.size;
}

function mapRowToProductListItem(row: {
  id: number;
  productName: string;
  projectName: string | null;
  brandName: string | null;
  category: string | null;
  status: string;
  currentStep: number | null;
  imageUrls: string[] | null;
  imageRecords: unknown;
  generatedImages: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
  const mapped = mapProductStatus(row.status, row.currentStep);
  return {
    id: row.id,
    name,
    sku: deriveSku(name, row.id),
    imageUrl: pickThumbnail({
      imageUrls: row.imageUrls,
      imageRecords: row.imageRecords as Array<{ currentUrl?: string }> | null,
      generatedImages: row.generatedImages as { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null,
    }),
    channels: [] as string[],
    price: null as number | null,
    currency: "INR",
    stock: null as number | null,
    status: mapped.status,
    statusLabel: mapped.label,
    currentStep: row.currentStep,
    brandName: row.brandName,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    workflowUrl: `/audits/workflow?resume=${row.id}`,
  };
}

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function productsWorkspaceFilter(ownerId: string, workspaceId: number) {
  return and(
    eq(auditsTable.userId, ownerId),
    or(
      eq(auditsTable.workspaceId, workspaceId),
      and(isNull(auditsTable.workspaceId), eq(auditsTable.userId, ownerId)),
    ),
  );
}

async function productsScopeWhere(req: Request) {
  const ownerId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "build_brand", worked, "audit", auditsTable);
  return and(
    productsWorkspaceFilter(ownerId, workspaceId),
    eq(auditsTable.isDeleted, 0),
    sql`${auditsTable.status} != 'archived'`,
    sql`(${auditsTable.asin} IS NULL OR trim(${auditsTable.asin}) = '')`,
    ownFilter,
  );
}

router.get("/products", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const where = await productsScopeWhere(req);
  const rows = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      projectName: auditsTable.projectName,
      brandName: auditsTable.brandName,
      category: auditsTable.category,
      status: auditsTable.status,
      currentStep: auditsTable.currentStep,
      imageUrls: auditsTable.imageUrls,
      imageRecords: auditsTable.imageRecords,
      generatedImages: auditsTable.generatedImages,
      createdAt: auditsTable.createdAt,
      updatedAt: auditsTable.updatedAt,
    })
    .from(auditsTable)
    .where(where)
    .orderBy(desc(auditsTable.updatedAt));

  const products = rows.map((row) => mapRowToProductListItem(row));

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({ products });
});

router.get("/products/:id", requireAuth, resolveTeamAndWorkspace, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const where = await productsScopeWhere(req);
  const [row] = await db
    .select()
    .from(auditsTable)
    .where(and(where, eq(auditsTable.id, id)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const competitors = await db
    .select({
      id: competitorsTable.id,
      productName: competitorsTable.productName,
      asin: competitorsTable.asin,
    })
    .from(competitorsTable)
    .where(and(eq(competitorsTable.auditId, id), eq(competitorsTable.isDeleted, 0)));

  const managerUserId = row.createdByUserId ?? row.userId;
  const [managerProfile] = await db
    .select({ fullName: userProfilesTable.fullName, companyName: userProfilesTable.companyName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, managerUserId))
    .limit(1);

  const managerName = managerProfile?.fullName?.trim()
    || managerProfile?.companyName?.trim()
    || "Account Owner";

  const name = row.projectName?.trim() || row.productName?.trim() || "Untitled Product";
  const mapped = mapProductStatus(row.status, row.currentStep);
  const stageLabel = mapStageLabel(row.status, row.currentStep);
  const progress = calcProgress(row.status, row.currentStep);
  const workflowUrl = `/audits/workflow?resume=${row.id}`;

  const referenceLinks: Array<{ label: string; url: string }> = [];
  if (row.asin?.trim()) {
    referenceLinks.push({
      label: "Amazon Ref",
      url: `https://www.amazon.in/dp/${row.asin.trim()}`,
    });
  }
  competitors.forEach((c, i) => {
    const label = c.productName?.trim() || `Competitor ${String.fromCharCode(65 + i)}`;
    const url = c.asin?.trim()
      ? `https://www.amazon.in/dp/${c.asin.trim()}`
      : "#";
    referenceLinks.push({ label, url });
  });

  const brand = row.brandName?.trim() || "Brand";
  const driveFolder = `${brand} / ${name}`;

  const aiSuggestions = buildProductSuggestions({
    productName: row.productName,
    title: row.title,
    brandName: row.brandName,
    category: row.category,
    bulletPoints: row.bulletPoints,
    generatedContent: row.generatedContent as ProductSuggestionInput["generatedContent"],
    targetKeywords: row.targetKeywords,
    imageUrls: row.imageUrls,
    imageRecords: row.imageRecords as ProductSuggestionInput["imageRecords"],
    generatedImages: row.generatedImages as ProductSuggestionInput["generatedImages"],
    currentStep: row.currentStep,
    status: row.status,
    overallScore: row.overallScore,
    result: row.result,
    competitorCount: competitors.length,
  });

  const priority = mapProductPriority({
    overallScore: row.overallScore,
    status: row.status,
    currentStep: row.currentStep,
    aiSuggestionCount: aiSuggestions.length,
  });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({
    ...mapRowToProductListItem(row),
    title: name,
    stageLabel,
    priorityLabel: priority.label,
    priorityLevel: priority.level,
    progressPercent: progress,
    manager: {
      name: managerName,
      initials: managerInitials(managerName),
    },
    notes: buildNotes(row),
    referenceLinks,
    driveFolder,
    driveFolderUrl: workflowUrl,
    workflowSteps: WORKFLOW_STEP_LABELS.map((label, index) => ({
      id: index + 1,
      label,
      completed: (row.currentStep ?? 1) > index + 1 || row.status === "complete",
      active: (row.currentStep ?? 1) === index + 1 && row.status !== "complete",
    })),
    stats: {
      totalOrders: 0,
      revenue: null as number | null,
      revenueCurrency: "INR",
      marketplacesActive: 0,
      listingScore: row.overallScore ?? 0,
      competitorCount: competitors.length,
      imageCount: countImages(row),
      keywordCount: (row.targetKeywords ?? []).length,
    },
    generatedContent: row.generatedContent,
    bulletPoints: row.bulletPoints,
    targetKeywords: row.targetKeywords,
    detailUrl: `/products/${row.id}`,
    workflowUrl,
    aiSuggestions,
    status: mapped.status,
    statusLabel: mapped.status === "active" ? "Live" : mapped.statusLabel,
  });
});

export default router;
