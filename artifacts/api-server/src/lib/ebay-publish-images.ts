import type { Audit, ImageRecord } from "@workspace/db";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { uploadEbaySiteHostedPicture } from "./ebay-trading-client.js";
import { collectGeneratedProductImages, loadImageBuffer } from "./listing-export-shared.js";
import {
  resolvePublishImageCandidate,
  sanitizeMarketplacePublishImageUrl,
} from "./materialize-audit-images-for-publish.js";

function pictureNameForIndex(auditId: number, index: number, sourceUrl: string): string {
  const lower = sourceUrl.toLowerCase();
  const ext = lower.includes(".png") ? "png" : lower.includes(".webp") ? "webp" : "jpg";
  return `sellerlens-${auditId}-${index + 1}.${ext}`;
}

export async function resolveEbayHostedPictureUrls(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[] | null;
  graphicsProjectId?: number | null;
  publicBaseUrl: string;
  maxImages?: number;
}): Promise<{ urls: string[]; warning?: string }> {
  const productImages = collectGeneratedProductImages(
    input.audit,
    input.graphicsImageRecords ?? undefined,
  );
  const max = input.maxImages ?? 12;
  const urls: string[] = [];
  const seen = new Set<string>();
  let uploadFailures = 0;

  for (const [index, img] of productImages.entries()) {
    if (urls.length >= max) break;

    const buffer = await loadImageBuffer({
      auditId: input.audit.id,
      sourceUrl: img.url,
      graphicsProjectId: input.graphicsProjectId ?? null,
    });

    if (buffer && buffer.length >= 512) {
      try {
        const hosted = await uploadEbaySiteHostedPicture({
          environment: input.environment,
          accessToken: input.accessToken,
          pictureName: pictureNameForIndex(input.audit.id, index, img.url),
          pictureData: buffer,
        });
        if (hosted && !seen.has(hosted)) {
          urls.push(hosted);
          seen.add(hosted);
          continue;
        }
      } catch {
        uploadFailures += 1;
      }
    }

    const candidate = resolvePublishImageCandidate({
      auditId: input.audit.id,
      sourceUrl: img.url,
      publicBaseUrl: input.publicBaseUrl,
      graphicsProjectId: input.graphicsProjectId ?? null,
      index,
    });
    const safe = sanitizeMarketplacePublishImageUrl(candidate);
    if (safe && !seen.has(safe)) {
      urls.push(safe);
      seen.add(safe);
    }
  }

  let warning: string | undefined;
  if (urls.length === 0 && productImages.length > 0) {
    warning = "Could not prepare gallery images for eBay. Add images in Graphics and try again.";
  } else if (uploadFailures > 0) {
    warning = "Some images used external URLs because eBay picture upload failed for one or more files.";
  }

  return { urls, warning };
}
