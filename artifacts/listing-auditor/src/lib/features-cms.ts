import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";

export const MAX_FEATURE_ITEMS = 5;
export const FEATURE_BULLETS_PER_ITEM = 3;

export function featureItemKeys(index: number) {
  return {
    title: `features.item${index}_title`,
    desc: `features.item${index}_desc`,
    href: `features.item${index}_href`,
    image: `features.item${index}_image`,
    bullet1: `features.item${index}_bullet1`,
    bullet2: `features.item${index}_bullet2`,
    bullet3: `features.item${index}_bullet3`,
  } as const;
}

export function parseFeatureBullets(cms: HomepageCmsMap, index: number): string[] {
  const keys = featureItemKeys(index);
  return [keys.bullet1, keys.bullet2, keys.bullet3]
    .map((key) => cmsText(cms, key))
    .filter(Boolean);
}

export function visibleFeatureItemCount(cms: HomepageCmsMap): number {
  for (let i = MAX_FEATURE_ITEMS; i >= 1; i--) {
    const keys = featureItemKeys(i);
    if (
      cms[keys.title]?.trim()
      || cms[keys.desc]?.trim()
      || cms[keys.href]?.trim()
      || cms[keys.image]?.trim()
    ) {
      return i;
    }
  }
  return MAX_FEATURE_ITEMS;
}
