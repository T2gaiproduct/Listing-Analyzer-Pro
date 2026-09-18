const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ListingPreviewImage = { url: string; label: string };

export function resolveListingPreviewImageUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(trimmed);
        if (parsed.pathname.includes("/api/marketplace-publish/images")) {
          return `${window.location.origin}${parsed.pathname}${parsed.search}`;
        }
      } catch {
        /* keep absolute url */
      }
    }
    return trimmed;
  }
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

type GraphicsImageRecord = {
  type?: string;
  currentUrl?: string;
};

function legacyGeneratedUrls(generatedImages: unknown): string[] {
  if (!generatedImages || typeof generatedImages !== "object") return [];
  const generated = generatedImages as {
    main?: string[];
    lifestyle?: string[];
    infographic?: string[];
  };
  const urls: string[] = [];
  for (const url of generated.main ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generated.lifestyle ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generated.infographic ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function recordTypeLabel(type: string | undefined): string {
  if (type === "lifestyle") return "Lifestyle";
  if (type === "feature") return "Infographic";
  if (type === "main") return "Main";
  return "Graphic";
}

function normalizeExcludeUrl(url: string): string {
  return url.trim();
}

/** SellerLens-generated assets stored on the app (not scraped marketplace URLs). */
export function isAppGeneratedImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.includes("/api/images/")) return true;
  if (trimmed.includes("/api/marketplace-publish/images/")) return true;
  return false;
}

function generatedImageFilename(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  return withoutQuery.split("/").pop() ?? "";
}

/** Graphics / AI-generated listing images — excludes uploads and reference/source files. */
export function isGeneratedListingPreviewImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("/api/images/graphics/")) return true;
  if (!isAppGeneratedImageUrl(trimmed)) return false;

  const name = generatedImageFilename(trimmed).toLowerCase();
  if (!name) return false;
  if (name.startsWith("source_") || name.includes("aplus_source") || name.startsWith("edit_ref")) {
    return false;
  }
  if (/^publish_\d+_\d+\.[a-z0-9]+$/i.test(name)) return false;
  if (/^(lifestyle|feature|main|infographic)_/i.test(name)) return true;
  if (name.startsWith("aplus_")) return false;
  return false;
}

function isGeneratedListingPreviewRecord(record: GraphicsImageRecord): boolean {
  const url = record.currentUrl?.trim() ?? "";
  if (!url) return false;
  const type = record.type?.toLowerCase() ?? "";
  if (type === "source" || type === "upload") return false;
  if (["lifestyle", "feature", "infographic"].includes(type)) {
    return isGeneratedListingPreviewImageUrl(url);
  }
  if (type === "main") return isGeneratedListingPreviewImageUrl(url);
  return isGeneratedListingPreviewImageUrl(url);
}

/** Gallery images for listing preview: generated graphics first, then uploads. */
export function collectListingPreviewImages(opts: {
  imageUrls?: string[] | null;
  imageRecords?: GraphicsImageRecord[] | null;
  generatedImages?: unknown;
  graphicsProjectRecords?: GraphicsImageRecord[] | null;
  productImageUrl?: string | null;
  fallbackImageUrls?: string[] | null;
  /** Optional URLs to skip in the PDP gallery (e.g. duplicates). */
  excludeUrls?: Iterable<string> | null;
  /** A+ module images appended after product/graphics images in the gallery. */
  aplusModules?: Array<{ url: string; label?: string | null }> | null;
  /**
   * Listing preview tab: only SellerLens-generated graphics (no scrape/import/upload URLs).
   */
  generatedOnly?: boolean;
}): ListingPreviewImage[] {
  const items: ListingPreviewImage[] = [];
  const seen = new Set<string>();
  const excluded = new Set<string>();
  for (const url of opts.excludeUrls ?? []) {
    const trimmed = normalizeExcludeUrl(url);
    if (trimmed) excluded.add(trimmed);
  }

  const add = (url: string | undefined | null, label: string) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed) || excluded.has(trimmed)) return;
    seen.add(trimmed);
    items.push({ url: trimmed, label });
  };

  if (opts.generatedOnly) {
    for (const record of opts.graphicsProjectRecords ?? []) {
      const url = record.currentUrl?.trim();
      if (url && isGeneratedListingPreviewImageUrl(url)) {
        add(url, recordTypeLabel(record.type));
      }
    }
    for (const record of opts.imageRecords ?? []) {
      if (isGeneratedListingPreviewRecord(record)) {
        add(record.currentUrl, recordTypeLabel(record.type));
      }
    }
    for (const url of legacyGeneratedUrls(opts.generatedImages)) {
      if (isGeneratedListingPreviewImageUrl(url) || url.startsWith("data:image/")) {
        add(url, "Generated");
      }
    }
  } else {
    const records = [
      ...(opts.graphicsProjectRecords ?? []),
      ...(opts.imageRecords ?? []),
    ];
    for (const record of records) {
      add(record.currentUrl, recordTypeLabel(record.type));
    }

    for (const url of legacyGeneratedUrls(opts.generatedImages)) {
      add(url, "Generated");
    }

    add(opts.productImageUrl, "Product");
    for (const url of opts.imageUrls ?? []) {
      add(url, "Product");
    }
    for (const url of opts.fallbackImageUrls ?? []) {
      add(url, "Product");
    }
  }

  for (const module of opts.aplusModules ?? []) {
    const label = module.label?.trim() || "A+ Content";
    add(module.url, label.startsWith("A+") ? label : `A+ ${label}`);
  }

  return items;
}
