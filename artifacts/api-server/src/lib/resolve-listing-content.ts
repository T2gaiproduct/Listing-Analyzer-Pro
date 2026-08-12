import type { Audit, GeneratedContent } from "@workspace/db";
import { readGeneratedContent } from "./listing-export-shared.js";
import { isWooCommerceImportAsin } from "./woocommerce-import-utils.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bulletsToHtmlDescription(bullets: string[]): string {
  const items = bullets.map((bullet) => bullet.trim()).filter(Boolean);
  if (items.length === 0) return "";
  return `<ul>\n${items.map((bullet) => `  <li>${escapeHtml(bullet)}</li>`).join("\n")}\n</ul>`;
}

export function resolveListingContentForExport(audit: Audit): GeneratedContent {
  const generated = readGeneratedContent(audit);
  const title = audit.title?.trim()
    || generated?.title?.trim()
    || audit.productName?.trim()
    || "Untitled Product";
  const auditBullets = (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const bulletPoints = auditBullets.length > 0
    ? auditBullets
    : (generated?.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const auditKeywords = (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const keywords = auditKeywords.length > 0
    ? auditKeywords
    : (generated?.keywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const htmlDescription = resolveDescriptionHtml(audit);

  return { title, bulletPoints, keywords, htmlDescription };
}

export function resolveDescriptionHtml(audit: Audit): string {
  if (isWooCommerceImportAsin(audit.asin) && audit.storeDescriptionHtml?.trim()) {
    return audit.storeDescriptionHtml.trim();
  }

  const generated = audit.generatedContent as GeneratedContent | null | undefined;
  if (generated?.htmlDescription?.trim()) {
    return generated.htmlDescription.trim();
  }
  const bullets = (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  return bulletsToHtmlDescription(bullets);
}
