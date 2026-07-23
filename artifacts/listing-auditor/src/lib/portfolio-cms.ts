import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText, resolveCmsAssetUrl } from "@/lib/homepage-cms";

export const MAX_PORTFOLIO_ITEMS = 16;
export const DEFAULT_PORTFOLIO_VISIBLE = 8;

export interface PortfolioCmsItem {
  id: string;
  index: number;
  title: string;
  brand: string;
  image: string;
  badge: string | null;
  square: boolean;
}

export function portfolioItemIndices(): number[] {
  return Array.from({ length: MAX_PORTFOLIO_ITEMS }, (_, i) => i + 1);
}

export function portfolioItemKeys(index: number) {
  return {
    title: `portfolio.item${index}_title`,
    brand: `portfolio.item${index}_brand`,
    badge: `portfolio.item${index}_badge`,
    image: `portfolio.item${index}_image`,
    fit: `portfolio.item${index}_fit`,
  } as const;
}

export function visiblePortfolioItemCount(cms: HomepageCmsMap): number {
  let max = DEFAULT_PORTFOLIO_VISIBLE;
  for (let i = DEFAULT_PORTFOLIO_VISIBLE + 1; i <= MAX_PORTFOLIO_ITEMS; i++) {
    const keys = portfolioItemKeys(i);
    if (cms[keys.title]?.trim() || cms[keys.image]?.trim()) {
      max = i;
    }
  }
  return max;
}

/** Portfolio tiles for the homepage — respects admin-cleared empty strings. */
export function parsePortfolioItems(cms: HomepageCmsMap, basePath: string): PortfolioCmsItem[] {
  return portfolioItemIndices().flatMap((i) => {
    const keys = portfolioItemKeys(i);
    const imagePath = cmsText(cms, keys.image);
    if (!imagePath.trim()) return [];

    const title = cmsText(cms, keys.title).trim();
    const brand = cmsText(cms, keys.brand).trim();
    const badge = cmsText(cms, keys.badge).trim();
    const fit = cmsText(cms, keys.fit);

    return [{
      id: `portfolio-${i}`,
      index: i,
      title,
      brand,
      image: resolveCmsAssetUrl(imagePath, basePath),
      badge: badge || null,
      square: fit === "cover",
    }];
  });
}
