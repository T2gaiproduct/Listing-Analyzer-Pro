import * as cheerio from "cheerio";

const LEADING_LIST_MARKER = /^[\s\u2022\u2023\u25E6\u2043\u2219•●○◦\-–—*]+/;
const LEADING_NUMBER = /^\d+[\.\)\]:\-]\s*/;

/** Plain-text Amazon bullet (Seller Central field) — no •, numbering, or markdown. */
export function normalizeBulletPoint(text: string): string {
  let t = text.trim();
  if (!t) return "";

  t = t.replace(LEADING_LIST_MARKER, "");
  t = t.replace(LEADING_NUMBER, "");
  t = t.replace(/\*\*/g, "");

  const capsLabel = t.match(/^([A-Z][A-Z0-9\s/&'’\-]{2,48}):\s*(.+)$/);
  if (capsLabel) {
    t = `${capsLabel[1].trim()} – ${capsLabel[2].trim()}`;
  }

  return t.replace(/\s+/g, " ").trim();
}

export function normalizeBulletPoints(bullets: unknown): string[] {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((b): b is string => typeof b === "string")
    .map((b) => normalizeBulletPoint(b))
    .filter(Boolean);
}

function stripListItemPrefix(text: string): string {
  return normalizeBulletPoint(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/** Amazon-style HTML description: h2/h3/p, ul only, no duplicate numbering inside li. */
export function normalizeListingHtmlDescription(html: string): string {
  const input = html.trim();
  if (!input) return "";

  const $ = cheerio.load(input, { xml: false }, false);

  $("h1").each((_i, el) => {
    const $el = $(el);
    const $h2 = cheerio.load("<h2></h2>", { xml: false }, false)("h2");
    $h2.html($el.html() ?? "");
    $el.replaceWith($h2);
  });

  $("ol").each((_i, el) => {
    const $el = $(el);
    const $ul = cheerio.load("<ul></ul>", { xml: false }, false)("ul");
    $ul.html($el.html() ?? "");
    $el.replaceWith($ul);
  });

  $("li").each((_i, el) => {
    const $el = $(el);
    const inner = $el.html() ?? "";
    const plain = stripListItemPrefix($el.text());
    if (!plain) return;

    const strongMatch = inner.match(/^\s*<strong[^>]*>([^<]+)<\/strong>\s*[–—\-:]?\s*/i);
    if (strongMatch) {
      const label = strongMatch[1].trim();
      const rest = plain.replace(new RegExp(`^${label}\\s*[–—\\-:]?\\s*`, "i"), "").trim();
      $el.html(`<strong>${label}</strong> – ${rest}`);
    } else {
      $el.text(plain);
    }
  });

  return $.root().html()?.trim() ?? "";
}

/** Remove <strong> inside body paragraphs (keeps headings and Key Features list labels). */
export function stripInlineStrongFromParagraphs(html: string): string {
  const input = html.trim();
  if (!input) return "";

  const $ = cheerio.load(input, { xml: false }, false);

  $("p").each((_i, el) => {
    const $el = $(el);
    $el.find("strong, b").each((_j, strong) => {
      const $strong = $(strong);
      $strong.replaceWith($strong.text());
    });
  });

  return $.root().html()?.trim() ?? "";
}
