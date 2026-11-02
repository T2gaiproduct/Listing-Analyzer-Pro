import type { GeneratedContent } from "@workspace/api-client-react";

export type ListingContentFieldKey =
  | "title"
  | "bulletPoints"
  | "keywords"
  | "htmlDescription"
  | "attributes";

export type ListingContentFieldSource = "current" | "ai";
export type ListingContentFieldSources = Partial<Record<ListingContentFieldKey, ListingContentFieldSource>>;

export const LISTING_CONTENT_FIELD_KEYS: ListingContentFieldKey[] = [
  "title",
  "bulletPoints",
  "keywords",
  "htmlDescription",
  "attributes",
];

export type ContentVariantWithMeta = GeneratedContent & {
  fieldSources?: ListingContentFieldSources;
  aiSnapshot?: GeneratedContent;
};

export function defaultFieldSourcesAi(): ListingContentFieldSources {
  return {
    title: "ai",
    bulletPoints: "ai",
    keywords: "ai",
    htmlDescription: "ai",
    attributes: "ai",
  };
}

export function resolveAiSnapshot(variant: ContentVariantWithMeta): GeneratedContent {
  if (variant.aiSnapshot?.title?.trim()) {
    return variant.aiSnapshot;
  }
  const { fieldSources: _fs, aiSnapshot: _ai, ...rest } = variant;
  return rest;
}

/** User-approved merged copy for listing preview (after ✓/✕ field picks). */
export function variantToPreviewGeneratedContent(
  raw: ContentVariantWithMeta | undefined | null,
  existing: GeneratedContent | null | undefined,
): GeneratedContent | null {
  if (!raw) return null;
  const ai = resolveAiSnapshot(raw);
  const fieldSources = raw.fieldSources ?? defaultFieldSourcesAi();
  const existingGc: GeneratedContent = existing ?? {
    title: "",
    bulletPoints: [],
    keywords: [],
    htmlDescription: "",
  };
  const merged = mergeListingContentByFieldSources(existingGc, ai, fieldSources);
  const hasCopy = Boolean(
    merged.title?.trim()
    || (merged.bulletPoints?.some((b) => b.trim()))
    || (merged.keywords?.some((k) => k.trim()))
    || merged.htmlDescription?.trim()
    || (merged.attributes?.length ?? 0) > 0,
  );
  if (!hasCopy) return null;
  return merged;
}

export function mergeListingContentByFieldSources(
  existing: GeneratedContent,
  ai: GeneratedContent,
  fieldSources: ListingContentFieldSources | undefined,
): GeneratedContent {
  const pick = (key: ListingContentFieldKey) => {
    const source = fieldSources?.[key] ?? "ai";
    if (source === "current") {
      if (key === "attributes") {
        return existing.attributes?.length ? existing.attributes : ai.attributes;
      }
      return existing[key];
    }
    if (key === "attributes") {
      return ai.attributes?.length ? ai.attributes : existing.attributes;
    }
    return ai[key];
  };

  return {
    title: pick("title") as string,
    bulletPoints: pick("bulletPoints") as string[],
    keywords: pick("keywords") as string[],
    htmlDescription: pick("htmlDescription") as string,
    attributes: pick("attributes") as GeneratedContent["attributes"],
  };
}
