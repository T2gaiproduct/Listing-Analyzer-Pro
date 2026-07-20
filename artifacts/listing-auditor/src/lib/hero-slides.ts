import { cmsText, type HomepageCmsMap } from "@/lib/homepage-cms";

export interface HeroSlide {
  id: string;
  enabled: boolean;
  badgeText: string;
  headingLine1: string;
  headingHighlight: string;
  subheading: string;
  ctaPrimaryText: string;
  ctaPrimaryUrl: string;
  ctaSecondaryText: string;
  ctaSecondaryUrl: string;
  imageUrl: string;
}

export const HERO_SLIDES_JSON_KEY = "hero.slides_json";
export const HERO_AUTOPLAY_ENABLED_KEY = "hero.autoplay_enabled";
export const HERO_AUTOPLAY_INTERVAL_KEY = "hero.autoplay_interval";

export const DEFAULT_HERO_SLIDE_IMAGE = "/hero/dashboard-mockup.png";

export function createHeroSlide(partial?: Partial<HeroSlide>): HeroSlide {
  return {
    id: partial?.id ?? `slide-${Date.now()}`,
    enabled: partial?.enabled ?? true,
    badgeText: partial?.badgeText ?? "",
    headingLine1: partial?.headingLine1 ?? "",
    headingHighlight: partial?.headingHighlight ?? "",
    subheading: partial?.subheading ?? "",
    ctaPrimaryText: partial?.ctaPrimaryText ?? "Get Started Free",
    ctaPrimaryUrl: partial?.ctaPrimaryUrl ?? "/sign-up",
    ctaSecondaryText: partial?.ctaSecondaryText ?? "See How It Works",
    ctaSecondaryUrl: partial?.ctaSecondaryUrl ?? "/features",
    imageUrl: partial?.imageUrl ?? "",
  };
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  createHeroSlide({
    id: "slide-1",
    badgeText: "AI-Powered Listing Optimization",
    headingLine1: "Optimize Listings. Increase Sales.",
    headingHighlight: "Grow Faster.",
    subheading: "Audit listings, create stunning content, manage ads and dominate every marketplace.",
    ctaPrimaryText: "Get Started Free",
    ctaPrimaryUrl: "/sign-up",
    ctaSecondaryText: "See How It Works",
    ctaSecondaryUrl: "/features",
    imageUrl: DEFAULT_HERO_SLIDE_IMAGE,
  }),
];

function legacySlideFromCms(cms: HomepageCmsMap): HeroSlide {
  return createHeroSlide({
    id: "legacy",
    badgeText: cmsText(cms, "hero.badge_text"),
    headingLine1: cmsText(cms, "hero.heading_line1"),
    headingHighlight: cmsText(cms, "hero.heading_highlight"),
    subheading: cmsText(cms, "hero.subheading"),
    ctaPrimaryText: cmsText(cms, "hero.cta_primary_text"),
    ctaPrimaryUrl: cmsText(cms, "hero.cta_primary_url"),
    ctaSecondaryText: cmsText(cms, "hero.cta_secondary_text"),
    ctaSecondaryUrl: cmsText(cms, "hero.cta_secondary_url"),
    imageUrl: DEFAULT_HERO_SLIDE_IMAGE,
  });
}

function normalizeSlide(raw: Partial<HeroSlide>): HeroSlide {
  return createHeroSlide({
    id: raw.id,
    enabled: raw.enabled !== false,
    badgeText: raw.badgeText ?? "",
    headingLine1: raw.headingLine1 ?? "",
    headingHighlight: raw.headingHighlight ?? "",
    subheading: raw.subheading ?? "",
    ctaPrimaryText: raw.ctaPrimaryText ?? "",
    ctaPrimaryUrl: raw.ctaPrimaryUrl ?? "",
    ctaSecondaryText: raw.ctaSecondaryText ?? "",
    ctaSecondaryUrl: raw.ctaSecondaryUrl ?? "",
    imageUrl: raw.imageUrl ?? "",
  });
}

export function parseHeroSlidesJson(raw: string | undefined): HeroSlide[] | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HeroSlide>[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizeSlide);
  } catch {
    return null;
  }
}

export function parseHeroSlides(cms: HomepageCmsMap): HeroSlide[] {
  const fromJson = parseHeroSlidesJson(cms[HERO_SLIDES_JSON_KEY]);
  if (fromJson !== null) {
    return fromJson.filter((slide) => slide.enabled);
  }
  return [legacySlideFromCms(cms)];
}

export function allHeroSlides(cms: HomepageCmsMap): HeroSlide[] {
  const fromJson = parseHeroSlidesJson(cms[HERO_SLIDES_JSON_KEY]);
  if (fromJson !== null) return fromJson;
  return [legacySlideFromCms(cms)];
}

export function serializeHeroSlides(slides: HeroSlide[]): string {
  return JSON.stringify(slides);
}

export function heroAutoplayEnabled(cms: HomepageCmsMap): boolean {
  const value = cmsText(cms, HERO_AUTOPLAY_ENABLED_KEY);
  return value !== "false" && value !== "0";
}

export function heroAutoplayIntervalMs(cms: HomepageCmsMap): number {
  const seconds = Number.parseInt(cmsText(cms, HERO_AUTOPLAY_INTERVAL_KEY) || "6", 10);
  if (!Number.isFinite(seconds) || seconds < 3) return 6000;
  return seconds * 1000;
}
