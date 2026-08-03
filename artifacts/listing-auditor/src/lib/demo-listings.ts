import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText, resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { parsePortfolioItems, type PortfolioCmsItem } from "@/lib/portfolio-cms";

export interface DemoListingImage {
  id: string;
  url: string;
  label: string;
}

export interface DemoListing {
  id: string;
  tabLabel: string;
  productTitle: string;
  price: string;
  bullets: string[];
  gallery: DemoListingImage[];
  aplusImages: DemoListingImage[];
}

const MAX_AUTO_LISTINGS = 3;

function isAplusItem(item: PortfolioCmsItem): boolean {
  const title = item.title.toLowerCase();
  return (
    title.includes("a+")
    || title.includes("ebc")
    || title.includes("brand story")
    || title.includes("hero banner")
    || title.includes("module")
  );
}

function portfolioToImage(item: PortfolioCmsItem): DemoListingImage {
  return {
    id: item.id,
    url: item.image,
    label: item.title || item.brand || "Image",
  };
}

function groupPortfolioByBrand(items: PortfolioCmsItem[]): Map<string, PortfolioCmsItem[]> {
  const groups = new Map<string, PortfolioCmsItem[]>();
  for (const item of items) {
    const key = item.brand.trim() || item.title.trim() || item.id;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function defaultBullets(cms: HomepageCmsMap): string[] {
  return [1, 2, 3, 4].flatMap((i) => {
    const text = cmsText(cms, `demo.default_bullet${i}`).trim();
    return text ? [text] : [];
  });
}

function listingBullets(cms: HomepageCmsMap, index: number, fallback: string[]): string[] {
  const bullets = [1, 2, 3, 4].flatMap((i) => {
    const text = cmsText(cms, `demo.listing${index}_bullet${i}`).trim();
    return text ? [text] : [];
  });
  return bullets.length > 0 ? bullets : fallback;
}

function parseExplicitListing(
  cms: HomepageCmsMap,
  basePath: string,
  index: number,
  portfolioByIndex: Map<number, PortfolioCmsItem>,
  fallbackBullets: string[],
): DemoListing | null {
  const tabLabel = cmsText(cms, `demo.listing${index}_tab`).trim();
  const indicesRaw = cmsText(cms, `demo.listing${index}_gallery_indices`).trim();
  if (!tabLabel && !indicesRaw) return null;

  const indices = indicesRaw
    ? indicesRaw.split(/[,;\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0)
    : [];

  const portfolioItems = indices.flatMap((i) => portfolioByIndex.get(i) ?? []);
  if (portfolioItems.length === 0 && !tabLabel) return null;

  const galleryItems = portfolioItems.filter((item) => !isAplusItem(item));
  const aplusItems = portfolioItems.filter((item) => isAplusItem(item));
  const aplusUrl = cmsText(cms, `demo.listing${index}_aplus_image`).trim();

  const gallery = galleryItems.length > 0
    ? galleryItems.map(portfolioToImage)
    : portfolioItems.map(portfolioToImage);

  const aplusImages: DemoListingImage[] = aplusItems.map(portfolioToImage);
  if (aplusUrl) {
    aplusImages.unshift({
      id: `demo-${index}-aplus`,
      url: resolveCmsAssetUrl(aplusUrl, basePath),
      label: "A+ Content",
    });
  }

  const first = portfolioItems[0] ?? galleryItems[0];
  const productTitle = cmsText(cms, `demo.listing${index}_title`).trim()
    || first?.title
    || tabLabel
    || "Demo product";
  const price = cmsText(cms, `demo.listing${index}_price`).trim()
    || cmsText(cms, "demo.default_price").trim()
    || "$29.99";

  return {
    id: `demo-explicit-${index}`,
    tabLabel: tabLabel || first?.brand || productTitle,
    productTitle,
    price,
    bullets: listingBullets(cms, index, fallbackBullets),
    gallery,
    aplusImages,
  };
}

function buildAutoListing(
  brand: string,
  items: PortfolioCmsItem[],
  cms: HomepageCmsMap,
  fallbackBullets: string[],
): DemoListing {
  const galleryItems = items.filter((item) => !isAplusItem(item));
  const aplusItems = items.filter((item) => isAplusItem(item));
  const gallery = galleryItems.length > 0 ? galleryItems : items;
  const main = gallery[0];

  const price = cmsText(cms, "demo.default_price").trim() || "$29.99";
  const productTitle = main?.title.trim() || brand;

  return {
    id: `demo-auto-${brand}`,
    tabLabel: brand,
    productTitle,
    price,
    bullets: fallbackBullets.length > 0 ? fallbackBullets : [
      "AI-optimized listing assets in Seller Central-ready formats",
      "Consistent visual language across your product line",
      "Gallery, infographics, and lifestyle shots from one workflow",
      "Built to improve click-through and conversion on Amazon",
    ],
    gallery: gallery.map(portfolioToImage),
    aplusImages: aplusItems.map(portfolioToImage),
  };
}

/** Demo listings for the interactive Amazon mock — CMS overrides, then auto-grouped portfolio. */
export function parseDemoListings(cms: HomepageCmsMap, basePath: string): DemoListing[] {
  const portfolioItems = parsePortfolioItems(cms, basePath);
  if (portfolioItems.length === 0) return [];

  const portfolioByIndex = new Map(portfolioItems.map((item) => [item.index, item]));
  const fallbackBullets = defaultBullets(cms);

  const explicit = [1, 2, 3].flatMap((i) => {
    const listing = parseExplicitListing(cms, basePath, i, portfolioByIndex, fallbackBullets);
    return listing ? [listing] : [];
  });

  if (explicit.length > 0) return explicit;

  const groups = groupPortfolioByBrand(portfolioItems);
  const sorted = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_AUTO_LISTINGS);

  return sorted.map(([brand, items]) => buildAutoListing(brand, items, cms, fallbackBullets));
}
