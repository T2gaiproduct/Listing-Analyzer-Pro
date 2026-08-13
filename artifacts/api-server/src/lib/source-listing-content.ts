import type { Audit, GeneratedContent } from "@workspace/db";
import { bulletsToHtmlDescription, resolveDescriptionHtml } from "./resolve-listing-content.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

export function buildSourceListingSnapshot(
  audit: Pick<Audit, "asin" | "title" | "productName" | "bulletPoints" | "targetKeywords" | "generatedContent" | "storeDescriptionHtml">,
): GeneratedContent {
  const isWooImport = isWooCommerceImportAsin(audit.asin);
  const bulletPoints = isWooImport
    ? []
    : (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const keywords = (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const htmlDescription = resolveDescriptionHtml(audit as Audit);
  return {
    title: audit.title?.trim() || audit.productName?.trim() || "",
    bulletPoints,
    keywords,
    htmlDescription: htmlDescription || bulletsToHtmlDescription(bulletPoints),
  };
}
