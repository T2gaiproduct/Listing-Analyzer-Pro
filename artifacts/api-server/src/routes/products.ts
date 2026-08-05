import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable } from "@workspace/db";
import {
  resolveTeamAndWorkspace,
  getAccountOwnerId,
  getActiveWorkspaceId,
  workspaceOwnerFilter,
  loadWorkedProjects,
  viewOwnIdFilter,
  getWorkspaceCtx,
} from "../lib/workspace-route-helpers";
import type { TeamAuthedRequest } from "../middlewares/team-auth";

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

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

async function productsScopeWhere(req: Request) {
  const ownerId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "audits", worked, "audit", auditsTable);
  return and(
    workspaceOwnerFilter(auditsTable, auditsTable, ownerId, workspaceId),
    eq(auditsTable.isDeleted, 0),
    sql`${auditsTable.status} != 'archived'`,
    sql`(${auditsTable.asin} IS NULL OR ${auditsTable.asin} = '')`,
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

  const products = rows.map((row) => {
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
  });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({ products });
});

export default router;
