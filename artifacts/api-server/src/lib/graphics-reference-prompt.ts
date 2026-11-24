/** Hero / main listing images: composite uploaded pixels on white (Amazon-style), not generative scene+paste. */
const UPLOAD_COMPOSITE_ONLY_SLUGS = new Set(["hero", "main"]);

export function shouldCompositeUploadOnlyForGraphicsType(imageType: string | undefined): boolean {
  const slug = (imageType ?? "").trim().toLowerCase();
  return UPLOAD_COMPOSITE_ONLY_SLUGS.has(slug);
}

const MODULE_REFERENCE_HINTS: Record<string, string> = {
  social:
    "Social proof listing image: the reference product is the clear focal subject, photorealistic, integrated with natural lighting. "
    + "No other branded bottles or competing products in the frame. No fake customer names.",
  lifestyle:
    "Lifestyle in-use image: place the reference product naturally in the scene — held, on counter, or in context — with believable lighting and shadows. "
    + "SFW, fully clothed people only if shown. Do not paste a cutout; render one cohesive photograph.",
  lifestyle2: "Alternate lifestyle angle featuring the same reference product in a fresh believable setting.",
  callouts:
    "Feature callout graphic: reference product prominent with clean callout-style composition; no substitute SKU.",
  size: "Size / scale reference image: show the reference product with scale context; exact packaging from the reference.",
  beforeafter: "Before/after style layout using the reference product packaging consistently.",
  infographic: "Infographic-style product image using the reference product as the visual anchor.",
  dimensions: "Dimensions graphic with the reference product; faithful label and shape.",
  bundle: "Bundle layout featuring the reference product as the hero item.",
  custom: "Custom creative shot: reference product integrated naturally per the creative brief.",
  ingredients: "Ingredients / contents visual featuring the reference product packaging.",
  packaging: "Packaging detail shot of the reference product.",
};

export function moduleReferenceHint(imageType: string | undefined): string {
  const slug = (imageType ?? "").trim().toLowerCase();
  return (
    MODULE_REFERENCE_HINTS[slug]
    ?? "Commercial e-commerce product photograph: the reference product must be the focal subject, photorealistic, one unified image."
  );
}

export const GRAPHICS_REFERENCE_PRODUCT_RULES =
  "Use the attached reference image as the ONLY authority for this product's shape, label text, colors, cap, and packaging. "
  + "Do not invent or swap in a different bottle, jar, brand, or SKU. Match perspective and lighting so the product belongs in the scene.";

export function buildGraphicsReferenceGenerationPrompt(
  modulePrompt: string,
  imageType: string | undefined,
  referenceInstruction: string,
): string {
  const base = modulePrompt.trim();
  const hint = moduleReferenceHint(imageType);
  return `${referenceInstruction} ${GRAPHICS_REFERENCE_PRODUCT_RULES} ${hint} ${base}`.trim();
}