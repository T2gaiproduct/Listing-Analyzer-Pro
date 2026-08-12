import type { Audit, GeneratedContent } from "@workspace/db";
import { bulletsToHtmlDescription } from "./resolve-listing-content.js";

export function buildSourceListingSnapshot(
  audit: Pick<Audit, "title" | "productName" | "bulletPoints" | "targetKeywords">,
): GeneratedContent {
  const bulletPoints = (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const keywords = (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  return {
    title: audit.title?.trim() || audit.productName?.trim() || "",
    bulletPoints,
    keywords,
    htmlDescription: bulletsToHtmlDescription(bulletPoints),
  };
}
