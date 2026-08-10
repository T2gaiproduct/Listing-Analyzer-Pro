import type { Audit, GeneratedContent } from "@workspace/db";
import { readGeneratedContent } from "./listing-export-shared.js";

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
  const title = generated?.title?.trim()
    || audit.title?.trim()
    || audit.productName?.trim()
    || "Untitled Product";
  const bulletPoints = generated?.bulletPoints?.length
    ? generated.bulletPoints
    : (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string" && bullet.trim());
  const keywords = generated?.keywords?.length
    ? generated.keywords
    : (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string" && keyword.trim());
  const htmlDescription = generated?.htmlDescription?.trim()
    || bulletsToHtmlDescription(bulletPoints);

  return { title, bulletPoints, keywords, htmlDescription };
}

export function resolveDescriptionHtml(audit: Audit): string {
  const generated = audit.generatedContent as GeneratedContent | null | undefined;
  if (generated?.htmlDescription?.trim()) {
    return generated.htmlDescription.trim();
  }
  return bulletsToHtmlDescription(audit.bulletPoints ?? []);
}
