const LEADING_LIST_MARKER = /^[\s\u2022\u2023\u25E6\u2043\u2219•●○◦\-–—*]+/;
const LEADING_NUMBER = /^\d+[\.\)\]:\-]\s*/;

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

export function normalizeBulletPoints(bullets: string[] | null | undefined): string[] {
  return (bullets ?? [])
    .map((b) => normalizeBulletPoint(b))
    .filter(Boolean);
}

/** Normalize legacy AI HTML for preview (browser). */
export function normalizeListingHtmlDescription(html: string): string {
  const input = html.trim();
  if (!input || typeof document === "undefined") return input;

  const doc = new DOMParser().parseFromString(input, "text/html");

  doc.querySelectorAll("h1").forEach((h1) => {
    const h2 = doc.createElement("h2");
    h2.innerHTML = h1.innerHTML;
    h1.replaceWith(h2);
  });

  doc.querySelectorAll("ol").forEach((ol) => {
    const ul = doc.createElement("ul");
    ul.innerHTML = ol.innerHTML;
    ol.replaceWith(ul);
  });

  doc.querySelectorAll("li").forEach((li) => {
    const text = normalizeBulletPoint(li.textContent ?? "");
    const strong = li.querySelector("strong");
    if (strong && text) {
      const label = strong.textContent?.trim() ?? "";
      const rest = text.replace(new RegExp(`^${label}\\s*[–—\\-:]?\\s*`, "i"), "").trim();
      li.innerHTML = `<strong>${label}</strong> – ${rest}`;
    } else {
      li.textContent = text;
    }
  });

  return doc.body.innerHTML.trim();
}

export function formatHtmlDescriptionForPreview(html: string): string {
  return normalizeListingHtmlDescription(html);
}
