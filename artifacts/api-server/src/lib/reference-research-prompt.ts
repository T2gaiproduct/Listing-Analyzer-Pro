import type { ReferenceResearchData } from "@workspace/db";

/** Text block from Upload-step attributes + reference research for listing / A+ copy prompts. */
export function formatReferenceResearchForContentPrompt(
  raw: ReferenceResearchData | null | undefined,
): string | undefined {
  if (!raw) return undefined;

  const sections: string[] = [];

  const attributes = (raw.productDetails ?? []).filter(
    (row) => row.attribute?.trim() && row.value?.trim(),
  );
  if (attributes.length > 0) {
    sections.push(
      "Seller-confirmed product attributes (treat as factual when writing copy):",
      ...attributes.map((row) => `- ${row.attribute.trim()}: ${row.value.trim()}`),
    );
  }

  const intelligence = (raw.intelligence ?? []).filter((row) => row.attribute?.trim());
  if (intelligence.length > 0) {
    sections.push(
      "Reference research signals (use for category-typical specs and phrasing — do not copy competitor wording verbatim):",
      ...intelligence.map((row) => {
        const notes = row.referencePatternNotes?.trim();
        const allowed = row.allowedUse?.trim();
        const parts = [`- ${row.attribute.trim()}`];
        if (notes) parts.push(`  Pattern: ${notes}`);
        if (allowed) parts.push(`  Allowed use: ${allowed}`);
        return parts.join("\n");
      }),
    );
  }

  const slots = (raw.slots ?? []).filter((s) => s.url.trim() || s.notes.trim());
  if (slots.length > 0) {
    sections.push("Reference listings (research context only — never paste competitor text):");
    for (const slot of slots) {
      const url = slot.url.trim();
      const notes = slot.notes.trim();
      if (url) sections.push(`- URL: ${url}${notes ? `\n  Notes: ${notes}` : ""}`);
      else if (notes) sections.push(`- Notes: ${notes}`);
    }
  }

  if (sections.length === 0) return undefined;
  return sections.join("\n");
}
