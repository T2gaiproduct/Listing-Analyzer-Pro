import type { HomepageCmsMap } from "@/lib/homepage-cms";

export const MAX_PORTFOLIO_ITEMS = 16;
export const DEFAULT_PORTFOLIO_VISIBLE = 8;

export function portfolioItemIndices(): number[] {
  return Array.from({ length: MAX_PORTFOLIO_ITEMS }, (_, i) => i + 1);
}

export function visiblePortfolioItemCount(cms: HomepageCmsMap): number {
  let max = DEFAULT_PORTFOLIO_VISIBLE;
  for (let i = DEFAULT_PORTFOLIO_VISIBLE + 1; i <= MAX_PORTFOLIO_ITEMS; i++) {
    if (cms[`portfolio.item${i}_title`]?.trim() || cms[`portfolio.item${i}_image`]?.trim()) {
      max = i;
    }
  }
  return max;
}
