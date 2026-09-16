import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, auditsTable, graphicsProjectsTable, type Audit } from "@workspace/db";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import { buildSignedPublishImageUrl } from "./marketplace-publish-image-token.js";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";
import { verifyListingPreviewShareToken } from "./listing-preview-share-token.js";
import type { AplusModule } from "./aplus-generator.js";

export type PublicListingPreviewImage = { url: string; label: string };

function signImageUrl(publicBase: string, auditId: number, sourceUrl: string): string | null {
  const signed = buildSignedPublishImageUrl({
    publicBaseUrl: publicBase,
    auditId,
    sourceUrl,
    exportListing: true,
  });
  return signed ?? sourceUrl;
}

function legacyGeneratedUrls(generatedImages: unknown): string[] {
  if (!generatedImages || typeof generatedImages !== "object") return [];
  const generated = generatedImages as {
    main?: string[];
    lifestyle?: string[];
    infographic?: string[];
  };
  const urls: string[] = [];
  for (const url of generated.main ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generated.lifestyle ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generated.infographic ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function recordTypeLabel(type: string | undefined): string {
  if (type === "lifestyle") return "Lifestyle";
  if (type === "feature") return "Infographic";
  if (type === "main") return "Main";
  return "Graphic";
}

function collectPreviewImages(
  audit: Audit,
  graphicsRecords: Array<{ type?: string; currentUrl?: string }> | null,
  publicBase: string,
): PublicListingPreviewImage[] {
  const auditId = audit.id;
  const items: PublicListingPreviewImage[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string, label: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    const signed = signImageUrl(publicBase, auditId, trimmed);
    if (!signed) return;
    items.push({ url: signed, label });
  };

  for (const record of graphicsRecords ?? []) {
    if (record.currentUrl?.trim()) {
      push(record.currentUrl, recordTypeLabel(record.type));
    }
  }

  for (const record of audit.imageRecords ?? []) {
    if (record.currentUrl?.trim()) {
      push(record.currentUrl, recordTypeLabel(record.type));
    }
  }

  for (const url of legacyGeneratedUrls(audit.generatedImages)) {
    push(url, "Graphic");
  }

  for (const url of audit.imageUrls ?? []) {
    push(url, "Upload");
  }

  return items;
}

function readAplusModules(generatedImages: unknown): AplusModule[] {
  if (!generatedImages || typeof generatedImages !== "object") return [];
  const state = generatedImages as { aplus?: { modules?: AplusModule[] } };
  const modules = state.aplus?.modules;
  if (!Array.isArray(modules)) return [];
  return modules.filter((m) => m?.imageUrl?.trim());
}

export async function loadPublicListingPreview(
  req: Request,
  auditId: number,
  token: string,
): Promise<
  | {
      productName: string;
      brandName: string | null;
      category: string | null;
      generatedContent: ReturnType<typeof resolveListingContentForExport>;
      imageUrls: string[];
      imageRecords: Array<{ type?: string; currentUrl?: string }>;
      generatedImages: unknown;
    }
  | null
> {
  if (!verifyListingPreviewShareToken(auditId, token)) return null;

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(eq(auditsTable.id, auditId), eq(auditsTable.isDeleted, 0)))
    .limit(1);

  if (!audit) return null;

  const publicBase = resolvePublicBaseUrl(req);

  const [graphics] = await db
    .select({ imageRecords: graphicsProjectsTable.imageRecords })
    .from(graphicsProjectsTable)
    .where(
      and(
        eq(graphicsProjectsTable.auditId, auditId),
        eq(graphicsProjectsTable.isDeleted, 0),
      ),
    )
    .limit(1);

  const graphicsRecords = (graphics?.imageRecords ?? null) as Array<{ type?: string; currentUrl?: string }> | null;
  const gallery = collectPreviewImages(audit, graphicsRecords, publicBase);

  const signedRecords = gallery.map((img) => ({
    type: img.label === "Upload" ? "main" : "lifestyle",
    currentUrl: img.url,
  }));

  const aplusModules = readAplusModules(audit.generatedImages).map((mod) => ({
    ...mod,
    imageUrl: mod.imageUrl
      ? (signImageUrl(publicBase, auditId, mod.imageUrl) ?? mod.imageUrl)
      : mod.imageUrl,
  }));

  const generatedContent = resolveListingContentForExport(audit);

  let generatedImages: unknown = audit.generatedImages;
  if (aplusModules.length > 0) {
    const base = audit.generatedImages && typeof audit.generatedImages === "object"
      ? { ...(audit.generatedImages as Record<string, unknown>) }
      : {};
    const existingAplus = (base.aplus && typeof base.aplus === "object")
      ? { ...(base.aplus as Record<string, unknown>) }
      : {};
    generatedImages = {
      ...base,
      aplus: {
        ...existingAplus,
        status: existingAplus.status ?? "completed",
        modules: aplusModules,
      },
    };
  }

  return {
    productName: audit.productName,
    brandName: audit.brandName,
    category: audit.category,
    generatedContent,
    imageUrls: gallery.map((g) => g.url),
    imageRecords: signedRecords,
    generatedImages,
  };
}
