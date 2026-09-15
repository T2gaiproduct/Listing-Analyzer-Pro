/** Minimal audit draft for standalone Create Graphics + optional A+ generation. */

export function buildSyntheticListingFields(productName: string, brandName: string, category: string) {
  const name = productName.trim();
  const syntheticTitle = brandName.trim()
    ? `${brandName.trim()} ${name} — ${category}`
    : `${name} — ${category}`;
  const syntheticBullets = [
    `High-quality ${name.toLowerCase()} designed for everyday use`,
    `Perfect for ${category.toLowerCase()} enthusiasts and professionals`,
    `Durable, reliable, and built to last`,
    `Easy to use and maintain — great value for money`,
    `Premium quality backed by customer satisfaction`,
  ];
  const syntheticKeywords = name.split(/\s+/).filter((w) => w.length > 2);
  if (category) {
    syntheticKeywords.push(...category.split(/\s+/).filter((w) => w.length > 2));
  }
  const filler = [
    "premium", "best seller", "top rated", "quality", "durable", "reliable", "easy", "value",
    "professional", "home", "gift", "essential", "popular", "recommended", "trusted",
  ];
  while (syntheticKeywords.length < 10 && filler.length > 0) {
    syntheticKeywords.push(filler.shift()!);
  }
  return {
    syntheticTitle,
    syntheticBullets,
    syntheticKeywords: syntheticKeywords.slice(0, 10),
  };
}

export function buildGraphicsAuditDraftBody(
  projectName: string,
  productName: string,
  brandName: string,
  category: string,
  uploadedImages: string[],
) {
  if (!productName.trim() || !category.trim()) return null;
  const { syntheticTitle, syntheticBullets, syntheticKeywords } = buildSyntheticListingFields(
    productName,
    brandName,
    category,
  );
  return {
    projectName: projectName.trim() || productName.trim(),
    productName: productName.trim(),
    brandName: brandName.trim() || undefined,
    category,
    title: syntheticTitle,
    bulletPoints: syntheticBullets,
    targetKeywords: syntheticKeywords,
    imageUrls: uploadedImages,
  };
}
