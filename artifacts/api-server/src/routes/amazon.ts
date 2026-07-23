import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  amazonSellerConnectionsTable,
} from "@workspace/db";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import {
  buildAmazonListingExportData,
  buildAmazonFlatFileTsv,
  buildAmazonExportZip,
  validateAmazonListingExport,
} from "../lib/amazon-listing-export";
import {
  getAmazonOAuthAuthorizeUrl,
  isAmazonSpApiConfigured,
  publishListingToAmazon,
} from "../lib/amazon-sp-api";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as AuthedRequest).userId = userId;
  next();
}

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function getEffectiveUserId(req: Request): string {
  return (req as TeamAuthedRequest).team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const team = (req as TeamAuthedRequest).team;
  if (!team) { res.status(401).json({ error: "Team context not resolved" }); return; }
  if (team.role === "viewer") { res.status(403).json({ error: "Forbidden: viewers cannot modify data" }); return; }
  next();
}

function publicBaseUrl(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL ?? process.env.APP_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

async function loadAuditForExport(req: Request, auditId: number) {
  const ownerId = getEffectiveUserId(req);
  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, auditId), eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0)));

  if (!audit) return null;

  const [graphicsProject] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(
      eq(graphicsProjectsTable.userId, ownerId),
      eq(graphicsProjectsTable.auditId, auditId),
      eq(graphicsProjectsTable.isDeleted, 0),
    ))
    .limit(1);

  const exportData = buildAmazonListingExportData(audit, graphicsProject ?? null, publicBaseUrl(req));
  return { audit, exportData };
}

router.get("/amazon/connection", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(eq(amazonSellerConnectionsTable.userId, userId))
    .limit(1);

  res.json({
    connected: Boolean(connection?.refreshToken),
    sellerId: connection?.sellerId ?? null,
    marketplaceId: connection?.marketplaceId ?? "ATVPDKIKX0DER",
    spApiConfigured: isAmazonSpApiConfigured(),
  });
});

router.get("/amazon/auth-url", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const redirectUri = `${publicBaseUrl(req)}/api/amazon/oauth/callback`;
  const state = Buffer.from(JSON.stringify({ userId: getEffectiveUserId(req) })).toString("base64url");
  const url = getAmazonOAuthAuthorizeUrl(redirectUri, state);
  if (!url) {
    res.status(503).json({
      error: "Amazon SP-API is not configured. Use Excel/ZIP export to upload via Seller Central.",
    });
    return;
  }
  res.json({ url });
});

router.get("/audits/:id/export/validate", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const auditId = parseInt(String(req.params.id ?? ""));
  if (isNaN(auditId)) { res.status(400).json({ error: "Invalid audit id" }); return; }

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) { res.status(404).json({ error: "Audit not found" }); return; }
  if (!loaded.exportData) {
    res.status(400).json({ error: "Generate listing content (Step 2) before exporting." });
    return;
  }

  const validation = validateAmazonListingExport(loaded.exportData);
  const hasErrors = validation.some((v) => v.level === "error");
  res.json({
    ready: !hasErrors,
    validation,
    summary: {
      sku: loaded.exportData.sku,
      imageCount: loaded.exportData.images.length,
      hasAsin: Boolean(loaded.exportData.asin),
      aplusModuleCount: loaded.exportData.aplusModuleCount,
    },
  });
});

router.get("/audits/:id/export/excel", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const auditId = parseInt(String(req.params.id ?? ""));
  if (isNaN(auditId)) { res.status(400).json({ error: "Invalid audit id" }); return; }

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) { res.status(404).json({ error: "Audit not found" }); return; }
  if (!loaded.exportData) {
    res.status(400).json({ error: "Generate listing content (Step 2) before exporting." });
    return;
  }

  const tsv = buildAmazonFlatFileTsv(loaded.exportData);
  const filename = `${loaded.exportData.sku}_amazon_listing.tsv`;
  res.setHeader("Content-Type", "text/tab-separated-values; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(tsv);
});

router.get("/audits/:id/export/zip", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const auditId = parseInt(String(req.params.id ?? ""));
  if (isNaN(auditId)) { res.status(400).json({ error: "Invalid audit id" }); return; }

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) { res.status(404).json({ error: "Audit not found" }); return; }
  if (!loaded.exportData) {
    res.status(400).json({ error: "Generate listing content (Step 2) before exporting." });
    return;
  }

  try {
    const zipBuffer = await buildAmazonExportZip(loaded.exportData);
    const filename = `${loaded.exportData.sku}_amazon_listing.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ZIP export failed";
    res.status(500).json({ error: message });
  }
});

router.post("/audits/:id/publish-amazon", requireAuth, resolveTeam, requireWriteAccess, async (req, res): Promise<void> => {
  const auditId = parseInt(String(req.params.id ?? ""));
  if (isNaN(auditId)) { res.status(400).json({ error: "Invalid audit id" }); return; }

  const body = req.body as { mode?: "update" | "create" };
  const mode = body.mode === "create" ? "create" : "update";

  const loaded = await loadAuditForExport(req, auditId);
  if (!loaded) { res.status(404).json({ error: "Audit not found" }); return; }
  if (!loaded.exportData) {
    res.status(400).json({ error: "Generate listing content (Step 2) before publishing." });
    return;
  }

  const validation = validateAmazonListingExport(loaded.exportData);
  const errors = validation.filter((v) => v.level === "error");
  if (errors.length > 0) {
    res.status(400).json({ error: "Listing validation failed", validation: errors });
    return;
  }

  const userId = getEffectiveUserId(req);
  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(eq(amazonSellerConnectionsTable.userId, userId))
    .limit(1);

  const result = await publishListingToAmazon(loaded.exportData, {
    sellerConnected: Boolean(connection?.refreshToken),
    mode,
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json({
    ...result,
    validation: validation.filter((v) => v.level !== "info"),
    warnings: validation.filter((v) => v.level === "warning"),
  });
});

export default router;
