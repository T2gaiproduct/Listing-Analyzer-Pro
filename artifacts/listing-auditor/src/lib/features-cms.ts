import type { HomepageCmsMap } from "@/lib/homepage-cms";

export const MAX_FEATURE_ITEMS = 5;

export function featureItemKeys(index: number) {
  return {
    title: `features.item${index}_title`,
    desc: `features.item${index}_desc`,
    href: `features.item${index}_href`,
  } as const;
}

export function visibleFeatureItemCount(cms: HomepageCmsMap): number {
  let max = MAX_FEATURE_ITEMS;
  for (let i = MAX_FEATURE_ITEMS; i >= 1; i--) {
    const keys = featureItemKeys(i);
    if (cms[keys.title]?.trim() || cms[keys.desc]?.trim() || cms[keys.href]?.trim()) {
      return i;
    }
  }
  return MAX_FEATURE_ITEMS;
}
