import * as cheerio from "cheerio";
import type { GeneratedContent } from "@workspace/db";
import { stripHtml, type ExportImageAsset } from "./listing-export-shared.js";

export const AMAZON_PRODUCT_DESCRIPTION_MAX = 2000;

export interface ListingReviewRow {
  section: string;
  field: string;
  value: string;
}

/** Split generated HTML description into human-readable sections for Excel review. */
export function parseHtmlDescriptionSections(html: string): Array<{ title: string; plainText: string }> {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const $ = cheerio.load(trimmed);
  const rootChildren = $("body").length > 0 ? $("body").children().toArray() : $.root().children().toArray();

  const sections: Array<{ title: string; plainText: string }> = [];
  const openingParts: string[] = [];

  for (const node of rootChildren) {
    const el = $(node);
    const tag = node.tagName?.toLowerCase();
    if (tag === "h3") {
      const title = el.text().trim();
      const bodyParts: string[] = [];
      let sibling = el.next();
      while (sibling.length > 0 && !sibling.is("h3")) {
        if (sibling.is("ul") || sibling.is("ol")) {
          sibling.find("li").each((_, li) => {
            const line = $(li).text().trim();
            if (line) bodyParts.push(`• ${line}`);
          });
        } else {
          const text = sibling.text().trim();
          if (text) bodyParts.push(text);
        }
        sibling = sibling.next();
      }
      if (title) {
        sections.push({ title, plainText: bodyParts.join("\n") });
      }
      continue;
    }
    if (sections.length > 0) continue;
    if (tag === "h2") {
      const t = el.text().trim();
      if (t) openingParts.push(t);
    } else if (tag === "p") {
      const t = el.text().trim();
      if (t) openingParts.push(t);
    }
  }

  if (openingParts.length > 0) {
    sections.unshift({
      title: "Opening summary",
      plainText: openingParts.join("\n\n"),
    });
  }

  return sections;
}

export function buildListingContentReviewRows(
  content: GeneratedContent,
  row: Record<string, string>,
  images: ExportImageAsset[],
): ListingReviewRow[] {
  const rows: ListingReviewRow[] = [];

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

  for (const block of parseHtmlDescriptionSections(content.htmlDescription ?? "")) {
    rows.push({ section: "Description", field: block.title, value: block.plainText });
  }

  const fullPlain = stripHtml(content.htmlDescription ?? "");
  rows.push({
    section: "Description",
    field: "Full product description (complete)",
    value: fullPlain,
  });

  rows.push({
    section: "Note",
    field: "Amazon Upload sheet",
    value:
      `The "Amazon Upload" worksheet product_description is limited to ${AMAZON_PRODUCT_DESCRIPTION_MAX} characters for flat-file compatibility. ` +
      "End sections (e.g. Why Choose This Product?) may be cut there — use this sheet for the full text.",
  });

  rows.push({ section: "Amazon Upload", field: "Product description (truncated for upload)", value: row.product_description ?? "" });

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
