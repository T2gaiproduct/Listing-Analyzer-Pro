import * as cheerio from "cheerio";

const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "strong", "em", "b", "i", "br", "span", "div", "a", "img",
]);

const ALLOWED_ATTRS = new Set(["href", "src", "alt", "title", "class"]);

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("https://")
    || trimmed.startsWith("http://")
    || trimmed.startsWith("/")
    || trimmed.startsWith("#");
}

/** Strip unsafe markup from AI-generated or user-edited HTML descriptions. */
export function sanitizeHtmlDescription(html: string): string {
  const input = html.trim();
  if (!input) return "";

  const $ = cheerio.load(input, { xml: false }, false);
  $("script, style, iframe, object, embed, form, link, meta, base").remove();

  $("*").each((_index, element) => {
    if (element.type !== "tag") return;

    const tagName = element.name.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      $(element).replaceWith($(element).html() ?? "");
      return;
    }

    const attribs = element.attribs ?? {};
    for (const attr of Object.keys(attribs)) {
      const lower = attr.toLowerCase();
      if (lower.startsWith("on") || !ALLOWED_ATTRS.has(lower)) {
        $(element).removeAttr(attr);
        continue;
      }
      if ((lower === "href" || lower === "src") && !isSafeUrl(attribs[attr] ?? "")) {
        $(element).removeAttr(attr);
      }
    }
  });

  return $.root().html()?.trim() ?? "";
}
