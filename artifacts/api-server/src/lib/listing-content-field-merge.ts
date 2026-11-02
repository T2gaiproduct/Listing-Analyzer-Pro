import type { GeneratedContent } from "@workspace/db";
import type { ListingContentFieldKey, ListingContentFieldSource } from "@workspace/db";

export type ListingContentFieldSources = Partial<Record<ListingContentFieldKey, ListingContentFieldSource>>;

export const LISTING_CONTENT_FIELD_KEYS: ListingContentFieldKey[] = [
  "title",
  "bulletPoints",
  "keywords",
  "htmlDescription",
  "attributes",
];

export function defaultFieldSourcesAi(): ListingContentFieldSources {
  return {
    title: "ai",
    bulletPoints: "ai",
    keywords: "ai",
    htmlDescription: "ai",
    attributes: "ai",
  };
}

export function resolveAiSnapshot(variant: GeneratedContent & {
  aiSnapshot?: GeneratedContent;
}): GeneratedContent {
  if (variant.aiSnapshot?.title?.trim()) {
    return variant.aiSnapshot;
  }
  const { fieldSources: _fs, aiSnapshot: _ai, ...rest } = variant as GeneratedContent & {
    fieldSources?: ListingContentFieldSources;
    aiSnapshot?: GeneratedContent;
  };
  return rest;
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
