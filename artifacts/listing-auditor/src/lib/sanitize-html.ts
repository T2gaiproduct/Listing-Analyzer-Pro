import DOMPurify from "dompurify";

/** Strip unsafe markup before rendering AI-generated HTML in the browser. */
export function sanitizeHtmlDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "strong", "em", "b", "i", "br", "span", "div", "a", "img",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class"],
  });
}
