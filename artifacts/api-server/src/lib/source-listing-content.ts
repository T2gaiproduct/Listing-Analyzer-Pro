import type { Audit, GeneratedContent } from "@workspace/db";
import { bulletsToHtmlDescription, resolveDescriptionHtml } from "./resolve-listing-content.js";

export function buildSourceListingSnapshot(
  audit: Pick<Audit, "title" | "productName" | "bulletPoints" | "targetKeywords" | "generatedContent">,
): GeneratedContent {
  const bulletPoints = (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const keywords = (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const htmlDescription = resolveDescriptionHtml(audit as Audit);
  return {
    title: audit.title?.trim() || audit.productName?.trim() || "",
    bulletPoints,
    keywords,
    htmlDescription: htmlDescription || bulletsToHtmlDescription(bulletPoints),
  };
}
