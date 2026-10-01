import type { Audit, ImageRecord } from "@workspace/db";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { normalizeImageBufferForEbayUpload } from "./ebay-picture-normalize.js";
import { uploadEbaySiteHostedPicture } from "./ebay-trading-client.js";
import { collectGeneratedProductImages, loadImageBuffer } from "./listing-export-shared.js";
import {
  isPublicRemoteImageUrl,
  repairCorruptedImageUrl,
} from "./materialize-audit-images-for-publish.js";
import {
  buildSignedPublishImagePath,
  buildSignedPublishImageUrl,
} from "./marketplace-publish-image-token.js";

function pictureNameForIndex(auditId: number, index: number): string {
  return `sellerlens-${auditId}-${index + 1}.jpg`;
}

/** HTTPS URL eBay can fetch during ExternalPictureURL upload (public audit/graphics routes, no token). */
function resolveEbayExternalFetchUrl(input: {
  auditId: number;
  sourceUrl: string;
  publicBaseUrl: string;
  graphicsProjectId?: number | null;
  index: number;
}): string | null {
  let source = repairCorruptedImageUrl(input.sourceUrl);
  if (!source) return null;

  if (isPublicRemoteImageUrl(source) && source.startsWith("https://")) {
    return source;
  }

  const base = input.publicBaseUrl.trim().replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;

  const pathMatch = source.match(/(\/api\/images\/(?:graphics\/\d+\/[^/?]+|\d+\/[^/?]+))/i);
  if (pathMatch?.[1]) {
    return `${base}${pathMatch[1]}`;
  }

  if (source.startsWith("/api/images/")) {
    return `${base}${source.split("?")[0]}`;
  }

  const signed = buildSignedPublishImageUrl({
    publicBaseUrl: base,
    auditId: input.auditId,
    sourceUrl: source,
    graphicsProjectId: input.graphicsProjectId ?? null,
  });
  if (signed?.startsWith("https://")) return signed;

  const signedPath = buildSignedPublishImagePath({
    auditId: input.auditId,
    sourceUrl: source,
    graphicsProjectId: input.graphicsProjectId ?? null,
  });
  if (signedPath) return `${base}${signedPath}`;

  return null;
}

function isEbayHostedPictureUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("ebayimg.com") || host.includes("ebaystatic.com");
  } catch {
    return false;
  }
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
  const errors: string[] = [];

  for (const [index, img] of productImages.entries()) {
    if (urls.length >= max) break;

    const pictureName = pictureNameForIndex(input.audit.id, index);
    let hosted: string | null = null;

    const buffer = await loadImageBuffer({
      auditId: input.audit.id,
      sourceUrl: img.url,
      graphicsProjectId: input.graphicsProjectId ?? null,
    });

    if (buffer && buffer.length >= 512) {
      try {
        const normalized = await normalizeImageBufferForEbayUpload(buffer);
        hosted = await uploadEbaySiteHostedPicture({
          environment: input.environment,
          accessToken: input.accessToken,
          pictureName,
          pictureData: normalized,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "binary upload failed";
        errors.push(`Image ${index + 1}: ${message}`);
      }
    }

    if (!hosted) {
      const external = resolveEbayExternalFetchUrl({
        auditId: input.audit.id,
        sourceUrl: img.url,
        publicBaseUrl: input.publicBaseUrl,
        graphicsProjectId: input.graphicsProjectId ?? null,
        index,
      });
      if (external) {
        try {
          hosted = await uploadEbaySiteHostedPicture({
            environment: input.environment,
            accessToken: input.accessToken,
            pictureName,
            externalPictureUrl: external,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "URL import failed";
          errors.push(`Image ${index + 1}: ${message}`);
        }
      }
    }

    if (hosted && isEbayHostedPictureUrl(hosted) && !seen.has(hosted)) {
      urls.push(hosted);
      seen.add(hosted);
    }
  }

  if (urls.length === 0 && productImages.length > 0) {
    const detail = errors[0] ? ` ${errors[0]}` : "";
    throw new Error(
      `Could not upload gallery images to eBay.${detail} Add images in Graphics and try again.`,
    );
  }

  let warning: string | undefined;
  if (errors.length > 0 && urls.length > 0) {
    warning = "Some gallery images could not be uploaded to eBay; only hosted pictures were applied.";
  }

  return { urls, warning };
}
