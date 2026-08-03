import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText, resolveCmsAssetUrl } from "@/lib/homepage-cms";

export const MAX_WORKFLOW_MARQUEE_ITEMS = 12;
export const DEFAULT_WORKFLOW_MARQUEE_VISIBLE = 6;

export interface WorkflowMarqueeItem {
  id: string;
  index: number;
  beforeImage: string;
  afterImage: string;
  beforeScore: string;
  afterScore: string;
  caption: string;
}

export function workflowMarqueeItemIndices(): number[] {
  return Array.from({ length: MAX_WORKFLOW_MARQUEE_ITEMS }, (_, i) => i + 1);
}

export function workflowMarqueeItemKeys(index: number) {
  return {
    beforeImage: `workflow.item${index}_before_image`,
    afterImage: `workflow.item${index}_after_image`,
    beforeScore: `workflow.item${index}_before_score`,
    afterScore: `workflow.item${index}_after_score`,
    caption: `workflow.item${index}_caption`,
  } as const;
}

export function visibleWorkflowMarqueeItemCount(cms: HomepageCmsMap): number {
  let max = DEFAULT_WORKFLOW_MARQUEE_VISIBLE;
  for (let i = DEFAULT_WORKFLOW_MARQUEE_VISIBLE + 1; i <= MAX_WORKFLOW_MARQUEE_ITEMS; i++) {
    const keys = workflowMarqueeItemKeys(i);
    if (cms[keys.beforeImage]?.trim() || cms[keys.afterImage]?.trim()) {
      max = i;
    }
  }
  return max;
}

/** Before/after pairs for the homepage workflow marquee. */
export function parseWorkflowMarqueeItems(cms: HomepageCmsMap, basePath: string): WorkflowMarqueeItem[] {
  return workflowMarqueeItemIndices().flatMap((i) => {
    const keys = workflowMarqueeItemKeys(i);
    const beforePath = cmsText(cms, keys.beforeImage).trim();
    const afterPath = cmsText(cms, keys.afterImage).trim();
    if (!beforePath && !afterPath) return [];

    return [{
      id: `workflow-${i}`,
      index: i,
      beforeImage: beforePath ? resolveCmsAssetUrl(beforePath, basePath) : "",
      afterImage: afterPath ? resolveCmsAssetUrl(afterPath, basePath) : "",
      beforeScore: cmsText(cms, keys.beforeScore).trim() || "62",
      afterScore: cmsText(cms, keys.afterScore).trim() || "96",
      caption: cmsText(cms, keys.caption).trim(),
    }];
  });
}
