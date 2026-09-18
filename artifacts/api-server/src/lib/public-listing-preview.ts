import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  type Audit,
  type ReferenceIntelligenceRow,
  type SellerProductDetail,
} from "@workspace/db";
import { readGeneratedContent } from "./listing-export-shared.js";
import { verifyListingPreviewShareToken } from "./listing-preview-share-token.js";
import { buildSignedPublishImagePath } from "./marketplace-publish-image-token.js";
import type { AplusModule } from "./aplus-generator.js";

export type PublicListingPreviewImage = { url: string; label: string };

function signImageUrl(auditId: number, sourceUrl: string): string | null {
  const signed = buildSignedPublishImagePath({
    auditId,
    sourceUrl,
    exportListing: true,
  });
  if (signed) return signed;
  const trimmed = sourceUrl.trim();
  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return null;
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

function isAppGeneratedImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.includes("/api/images/")) return true;
  if (trimmed.includes("/api/marketplace-publish/images/")) return true;
  return !/^https?:\/\//i.test(trimmed);
}

function auditImageRecords(audit: Audit): Array<{ type?: string; currentUrl?: string }> {
  const raw = audit.imageRecords;
  return Array.isArray(raw) ? (raw as Array<{ type?: string; currentUrl?: string }>) : [];
}

/** Public listing preview: generated graphics only (no scrape/import/upload URLs). */
function collectGeneratedPreviewImages(
  audit: Audit,
  graphicsRecords: Array<{ type?: string; currentUrl?: string }> | null,
): PublicListingPreviewImage[] {
  const auditId = audit.id;
  const items: PublicListingPreviewImage[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string, label: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    const signed = signImageUrl(auditId, trimmed);
    if (!signed) return;
    items.push({ url: signed, label });
  };

  for (const record of graphicsRecords ?? []) {
    if (record.currentUrl?.trim()) {
      push(record.currentUrl, recordTypeLabel(record.type));
    }
  }

  for (const record of auditImageRecords(audit)) {
    const url = record.currentUrl?.trim();
    if (url && isAppGeneratedImageUrl(url)) {
      push(url, recordTypeLabel(record.type));
    }
  }

  for (const url of legacyGeneratedUrls(audit.generatedImages)) {
    push(url, "Generated");
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
  _req: Request,
  auditId: number,
  token: string,
): Promise<
  | {
      productName: string;
      brandName: string | null;
      category: string | null;
      generatedContent: {
        title: string;
        bulletPoints: string[];
        keywords: string[];
        htmlDescription: string;
      };
      imageUrls: string[];
      imageRecords: Array<{ type?: string; currentUrl?: string }>;
      generatedImages: unknown;
      referenceIntelligence: ReferenceIntelligenceRow[];
      productDetails: SellerProductDetail[];
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
  const gallery = collectGeneratedPreviewImages(audit, graphicsRecords);

  const signedRecords = gallery.map((img) => ({
    type: img.label === "Upload" ? "main" : "lifestyle",
    currentUrl: img.url,
  }));

  const aplusModules = readAplusModules(audit.generatedImages).map((mod) => ({
    ...mod,
    imageUrl: mod.imageUrl
      ? (signImageUrl(auditId, mod.imageUrl) ?? mod.imageUrl)
      : mod.imageUrl,
  }));

  const generated = readGeneratedContent(audit);
  const generatedContent = generated?.title?.trim()
    ? {
        title: generated.title.trim(),
        bulletPoints: (generated.bulletPoints ?? []).filter((b) => typeof b === "string" && b.trim()),
        keywords: (generated.keywords ?? []).filter((k) => typeof k === "string" && k.trim()),
        htmlDescription: generated.htmlDescription?.trim() ?? "",
      }
    : {
        title: "",
        bulletPoints: [],
        keywords: [],
        htmlDescription: "",
      };

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

  const referenceResearch = audit.referenceResearch as {
    intelligence?: ReferenceIntelligenceRow[];
    productDetails?: SellerProductDetail[];
  } | null;

  const referenceIntelligence = referenceResearch?.intelligence?.filter((row) => row.attribute?.trim()) ?? [];

  const productDetails =
    referenceResearch?.productDetails?.filter((row) => row.attribute?.trim() && row.value?.trim()) ?? [];

  return {
    productName: audit.productName,
    brandName: audit.brandName,
    category: audit.category,
    generatedContent,
    imageUrls: gallery.map((g) => g.url),
    imageRecords: signedRecords,
    generatedImages,
    referenceIntelligence,
    productDetails,
  };
}
