const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ListingPreviewImage = { url: string; label: string };

export function resolveListingPreviewImageUrl(url: string): string {
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
  ) {
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

/** Gallery images for listing preview: generated graphics first, then uploads. */
export function collectListingPreviewImages(opts: {
  imageUrls?: string[] | null;
  imageRecords?: GraphicsImageRecord[] | null;
  generatedImages?: unknown;
  graphicsProjectRecords?: GraphicsImageRecord[] | null;
  productImageUrl?: string | null;
  fallbackImageUrls?: string[] | null;
  /** A+ module image URLs — shown only in the A+ section, not the PDP gallery. */
  excludeUrls?: Iterable<string> | null;
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

  return items;
}
