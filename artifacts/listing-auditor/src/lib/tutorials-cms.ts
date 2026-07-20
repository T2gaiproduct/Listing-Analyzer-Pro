import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";

export const MAX_TUTORIAL_ITEMS = 12;
export const DEFAULT_TUTORIAL_VISIBLE = 5;

export interface TutorialCmsItem {
  index: number;
  title: string;
  duration: string;
  image: string;
  videoUrl: string;
}

export function tutorialItemIndices(): number[] {
  return Array.from({ length: MAX_TUTORIAL_ITEMS }, (_, i) => i + 1);
}

export function visibleTutorialItemCount(cms: HomepageCmsMap): number {
  let max = DEFAULT_TUTORIAL_VISIBLE;
  for (let i = DEFAULT_TUTORIAL_VISIBLE + 1; i <= MAX_TUTORIAL_ITEMS; i++) {
    if (cms[`tutorials.item${i}_title`]?.trim() || cms[`tutorials.item${i}_video_url`]?.trim()) {
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
    }];
  });
}

export function tutorialItemKeys(index: number) {
  return {
    title: `tutorials.item${index}_title`,
    duration: `tutorials.item${index}_duration`,
    image: `tutorials.item${index}_image`,
    videoUrl: `tutorials.item${index}_video_url`,
  } as const;
}
