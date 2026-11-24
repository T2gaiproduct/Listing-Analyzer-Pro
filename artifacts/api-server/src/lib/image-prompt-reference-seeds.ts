import type { ImagePromptTemplateMetadata } from "@workspace/db";

/** Seed/backfill only — runtime reads prompts from DB admin templates, not from this file. */
export const DEFAULT_GRAPHICS_REFERENCE_INSTRUCTION =
  "This image is a visual reference of the exact product you MUST feature. The product's appearance, shape, colors, branding, and design must be faithfully reproduced — not changed or substituted. Use this reference image as the visual basis for the product in the scene.";

const PRODUCT_REFERENCE_RULES =
  "Use the attached reference image as the ONLY authority for this product's shape, label text, colors, cap, and packaging. "
  + "Do not invent or swap in a different bottle, jar, brand, or SKU. Match perspective and lighting so the product belongs in the scene. "
  + "The final image MUST show that exact product prominently (at least 30% of the frame) with sharp label detail and bright professional e-commerce lighting.";

const COMPOSITE_SCENE_SUFFIX =
  "Do not draw or depict any product, bottle, jar, tube, packaging, or label in the generated scene layer — only background and optional people/props. "
  + "Leave clear space to composite the exact uploaded product photo afterward. Bright professional Amazon listing lighting.";

const COMPOSITE_FALLBACK_SCENE =
  "Bright clean modern bathroom or vanity interior, soft natural daylight, neutral beige tiles, folded towel, small plant. "
  + "Empty countertop with uncluttered space in the lower-right. No people. Professional stock interior, SFW, PG. "
  + "No product, bottle, jar, packaging, or labels anywhere in the scene.";

const MODULE_RULES: Record<string, string> = {
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
  hero: DEFAULT_GRAPHICS_REFERENCE_INSTRUCTION,
  main: DEFAULT_GRAPHICS_REFERENCE_INSTRUCTION,
};

export function defaultGraphicsReferenceMetadataForSlug(slug: string): Partial<ImagePromptTemplateMetadata> {
  const rules = [PRODUCT_REFERENCE_RULES, MODULE_RULES[slug] ?? MODULE_RULES.custom].filter(Boolean).join(" ");
  return {
    referenceInstruction: DEFAULT_GRAPHICS_REFERENCE_INSTRUCTION,
    referenceRules: rules,
    referenceRetry: rules,
    compositeSceneSuffix: COMPOSITE_SCENE_SUFFIX,
    compositeFallbackScene: COMPOSITE_FALLBACK_SCENE,
  };
}

export function defaultAplusReferenceMetadata(): Partial<ImagePromptTemplateMetadata> {
  return {
    referenceInstruction: DEFAULT_GRAPHICS_REFERENCE_INSTRUCTION,
    referenceRules: PRODUCT_REFERENCE_RULES,
    referenceRetry: PRODUCT_REFERENCE_RULES,
  };
}