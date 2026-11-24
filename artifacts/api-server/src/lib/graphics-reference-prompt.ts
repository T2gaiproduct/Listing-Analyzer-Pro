/** Hero / main listing images: composite uploaded pixels on white (Amazon-style), not generative scene+paste. */
const UPLOAD_COMPOSITE_ONLY_SLUGS = new Set(["hero", "main"]);

export function shouldCompositeUploadOnlyForGraphicsType(imageType: string | undefined): boolean {
  const slug = (imageType ?? "").trim().toLowerCase();
  return UPLOAD_COMPOSITE_ONLY_SLUGS.has(slug);
}

export {
  buildReferenceGenerationPrompt as buildGraphicsReferenceGenerationPrompt,
  buildReferenceRetryPrompt as buildGraphicsReferenceRetryPrompt,
} from "./image-prompt-runtime.js";