import * as cheerio from "cheerio";
import type { GeneratedContent } from "@workspace/db";
import { htmlForListingExport, stripHtml, type ExportImageAsset } from "./listing-export-shared.js";

export const AMAZON_PRODUCT_DESCRIPTION_MAX = 2000;

export interface ListingReviewRow {
  section: string;
  field: string;
  value: string;
}

function rootChildren($: cheerio.CheerioAPI): cheerio.Element[] {
  if ($("body").length > 0) return $("body").children().toArray();
  return $.root().children().toArray();
}

/** Split generated HTML description into sections for Excel review (values stay HTML). */
export function parseHtmlDescriptionSections(html: string): Array<{ title: string; html: string }> {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const $ = cheerio.load(trimmed, undefined, false);
  const children = rootChildren($);

  const sections: Array<{ title: string; html: string }> = [];
  const openingParts: string[] = [];

  for (const node of children) {
    const el = $(node);
    const tag = node.tagName?.toLowerCase();
    if (tag === "h3") {
      const title = el.text().trim();
      const bodyParts: string[] = [];
      let sibling = el.next();
      while (sibling.length > 0 && !sibling.is("h3")) {
        bodyParts.push($.html(sibling));
        sibling = sibling.next();
      }
      if (title) {
        sections.push({ title, html: bodyParts.join("\n").trim() });
      }
      continue;
    }
    if (sections.length > 0) continue;
    if (tag === "h2" || tag === "p" || tag === "ul" || tag === "ol") {
      openingParts.push($.html(el));
    }
  }

  if (openingParts.length > 0) {
    sections.unshift({
      title: "Opening summary",
      html: openingParts.join("\n").trim(),
    });
  }

  if (sections.length === 0) {
    return [{ title: "Product description", html: trimmed }];
  }

  return sections;
}

export function buildListingContentReviewRows(
  content: GeneratedContent,
  row: Record<string, string>,
  images: ExportImageAsset[],
): ListingReviewRow[] {
  const rows: ListingReviewRow[] = [];
  const descriptionHtml = (content.htmlDescription ?? "").trim();

  rows.push({ section: "Listing", field: "Product title", value: content.title.trim() });
  for (let i = 0; i < 5; i++) {
    rows.push({
      section: "Listing",
      field: `Bullet point ${i + 1}`,
      value: (content.bulletPoints[i] ?? "").trim(),
    });
  }
  rows.push({
    section: "Listing",
    field: "Search terms",
    value: content.keywords.join(" ").trim(),
  });

  for (const block of parseHtmlDescriptionSections(descriptionHtml)) {
    rows.push({ section: "Description", field: block.title, value: block.html });
  }

  rows.push({
    section: "Description",
    field: "Full product description (HTML)",
    value: descriptionHtml,
  });

  rows.push({
    section: "Note",
    field: "Amazon Upload sheet",
    value:
      `The "Amazon Upload" worksheet product_description is limited to ${AMAZON_PRODUCT_DESCRIPTION_MAX} visible characters for flat-file compatibility. ` +
      "When HTML fits that limit it is exported as HTML; otherwise plain text is truncated. Image columns remain URLs only.",
  });

  rows.push({
    section: "Amazon Upload",
    field: "Product description (for upload)",
    value: row.product_description ?? "",
  });

  const mainUrl = row.main_image_url?.trim();
  if (mainUrl) rows.push({ section: "Images", field: "Main image URL", value: mainUrl });
  for (let i = 1; i <= 8; i++) {
    const key = `other_image_url${i}`;
    const url = (row[key] ?? "").trim();
    if (url) rows.push({ section: "Images", field: `Other image URL ${i}`, value: url });
  }
  for (const img of images.filter((a) => a.kind === "aplus")) {
    rows.push({
      section: "A+ Content",
      field: `A+ image (${img.id.replace(/^aplus-/, "")})`,
      value: img.absoluteUrl,
    });
  }

  return rows;
}

/** Visible character count for Amazon description limits (tags excluded). */
export function listingDescriptionVisibleLength(html: string): number {
  return stripHtml(html).length;
}
