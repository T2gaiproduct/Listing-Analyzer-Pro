import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { HOMEPAGE_CMS_DEFAULTS, cmsText, resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { youtubeThumbnailUrl } from "@/lib/video-embed";

export const MAX_TUTORIAL_ITEMS = 12;
export const DEFAULT_TUTORIAL_VISIBLE = 5;

export const TUTORIAL_CATEGORIES = [
  { id: "getting-started", label: "Getting Started" },
  { id: "optimization", label: "Optimization" },
  { id: "analytics", label: "Analytics" },
  { id: "images", label: "Images & Content" },
  { id: "reports", label: "Reports" },
] as const;

export type TutorialCategoryId = (typeof TUTORIAL_CATEGORIES)[number]["id"];

export interface TutorialCmsItem {
  index: number;
  title: string;
  duration: string;
  image: string;
  videoUrl: string;
  description: string;
  category: string;
  steps: string;
  linkUrl: string;
}

export interface TutorialPreviewItem {
  title: string;
  duration: string;
  image: string;
  videoUrl: string;
  description?: string;
  category?: string;
  steps?: string;
  linkUrl?: string;
}

export function tutorialItemIndices(): number[] {
  return Array.from({ length: MAX_TUTORIAL_ITEMS }, (_, i) => i + 1);
}

export function visibleTutorialItemCount(cms: HomepageCmsMap): number {
  let max = 1;
  for (let i = 1; i <= MAX_TUTORIAL_ITEMS; i++) {
    if (tutorialSlotHasContent(cms, i)) {
      max = i;
    }
  }
  return max;
}

export function parseTutorialItems(cms: HomepageCmsMap): TutorialCmsItem[] {
  return tutorialItemIndices().flatMap((i) => {
    const title = cmsText(cms, `tutorials.item${i}_title`);
    if (!title) return [];
    return [{
      index: i,
      title,
      duration: cmsText(cms, `tutorials.item${i}_duration`),
      image: cmsText(cms, `tutorials.item${i}_image`),
      videoUrl: (cms[`tutorials.item${i}_video_url`] ?? "").trim(),
      description: cmsText(cms, `tutorials.item${i}_description`),
      category: cmsText(cms, `tutorials.item${i}_category`) || "getting-started",
      steps: cmsText(cms, `tutorials.item${i}_steps`),
      linkUrl: (cms[`tutorials.item${i}_link_url`] ?? "").trim(),
    }];
  });
}

export function tutorialItemKeys(index: number) {
  return {
    title: `tutorials.item${index}_title`,
    duration: `tutorials.item${index}_duration`,
    image: `tutorials.item${index}_image`,
    videoUrl: `tutorials.item${index}_video_url`,
    description: `tutorials.item${index}_description`,
    category: `tutorials.item${index}_category`,
    steps: `tutorials.item${index}_steps`,
    linkUrl: `tutorials.item${index}_link_url`,
  } as const;
}

/** Prefer admin-uploaded images, then YouTube posters, then stock defaults. */
export function resolveTutorialPreviewImage(
  cms: HomepageCmsMap,
  item: Pick<TutorialCmsItem, "index" | "videoUrl">,
  basePath: string,
): string {
  const keys = tutorialItemKeys(item.index);
  const defaultImage = HOMEPAGE_CMS_DEFAULTS[keys.image] ?? "";
  const rawImage = (cms[keys.image] ?? "").trim();
  const hasCustomImage = Boolean(rawImage && rawImage !== defaultImage);
  const youtubeThumb = item.videoUrl ? youtubeThumbnailUrl(item.videoUrl) : null;

  if (hasCustomImage) {
    return resolveCmsAssetUrl(rawImage, basePath);
  }

  if (youtubeThumb) return youtubeThumb;

  const mergedImage = cmsText(cms, keys.image);
  return mergedImage ? resolveCmsAssetUrl(mergedImage, basePath) : "";
}

export function buildTutorialPreviewItems(cms: HomepageCmsMap, basePath: string): TutorialPreviewItem[] {
  return parseTutorialItems(cms).map((item) => ({
    title: item.title,
    duration: item.duration,
    image: resolveTutorialPreviewImage(cms, item, basePath),
    videoUrl: item.videoUrl,
    description: item.description,
    category: item.category,
    steps: item.steps,
    linkUrl: item.linkUrl,
  }));
}

export function tutorialCategoryLabel(categoryId: string): string {
  return TUTORIAL_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

export function tutorialSlotHasContent(cms: HomepageCmsMap, index: number): boolean {
  const keys = tutorialItemKeys(index);
  return Boolean(
    cms[keys.title]?.trim()
    || cms[keys.duration]?.trim()
    || cms[keys.image]?.trim()
    || cms[keys.videoUrl]?.trim()
    || cms[keys.description]?.trim()
    || cms[keys.category]?.trim()
    || cms[keys.steps]?.trim()
    || cms[keys.linkUrl]?.trim(),
  );
}
