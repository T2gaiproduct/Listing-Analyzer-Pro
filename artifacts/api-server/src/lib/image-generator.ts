import { generateImageBuffer, editImagesProxy } from "./openai-image";
import * as fs from "fs";
import * as path from "path";
import type { ImageRecord, ImageVersion, ImageStyle, AspectRatio } from "@workspace/db";
import { ensureAuditImageDir, imageUrlPath, resolveAuditImagePath, saveReferenceImageUrls } from "./image-storage";

export const STYLE_LABELS: Record<ImageStyle, string> = {
  premium: "Premium",
  minimal: "Minimal",
  luxury: "Luxury",
  modern: "Modern",
  infographic: "Infographic",
  lifestyle: "Lifestyle",
};

const STYLE_SUFFIXES: Record<ImageStyle, string> = {
  premium: "Professional studio photography, ultra-sharp, pure white background, soft fill lighting with subtle shadows, pristine product condition, commercial quality.",
  minimal: "Minimalist Scandinavian-inspired product photography, generous white space, clean simple composition, barely-there drop shadow, elegant restraint.",
  luxury: "Dramatic directional lighting, rich moody atmosphere, opulent premium brand aesthetic, dark complementary tones, editorial high-fashion feel.",
  modern: "Contemporary bold composition, dynamic product angle, vibrant accent colors, energetic and fresh, striking visual impact.",
  infographic: "Clean diagram layout on white background, geometric callout arrow lines pointing to product features, numbered annotation circles, structured educational visual, no text.",
  lifestyle: "Natural window daylight, warm aspirational real-world setting, beautifully styled home environment, product as the hero, authentic and inviting.",
};

const ASPECT_SIZES: Record<AspectRatio, "1024x1024" | "1792x1024" | "1024x1792"> = {
  "1:1": "1024x1024",
  "3:2": "1792x1024",
  "2:3": "1024x1792",
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildPrompt(basePrompt: string, style: ImageStyle): string {
  return `${basePrompt} ${STYLE_SUFFIXES[style]}`;
}

function versionedFilename(type: string, index: number): string {
  return `${type}_${index}_${Date.now()}.png`;
}

function urlPath(auditId: number, filename: string): string {
  return imageUrlPath(auditId, filename);
}

async function generateAndSave(
  prompt: string,
  filePath: string,
  aspectRatio: AspectRatio,
): Promise<void> {
  const size = ASPECT_SIZES[aspectRatio];
  const buffer = await generateImageBuffer(prompt, size);
  if (!buffer || buffer.length === 0) throw new Error("No image data returned from AI");
  fs.writeFileSync(filePath, buffer);
}

async function editAndSave(
  sourceFilePaths: string[],
  prompt: string,
  filePath: string,
): Promise<void> {
  const buffer = await editImagesProxy(sourceFilePaths, prompt);
  if (!buffer || buffer.length === 0) throw new Error("No image data returned from AI edit");
  fs.writeFileSync(filePath, buffer);
}

type ImageSpec = {
  type: "main" | "infographic" | "lifestyle";
  index: number;
  basePrompt: string;
  defaultStyle: ImageStyle;
};

function buildSpecs(productDesc: string): ImageSpec[] {
  return [
    {
      type: "main",
      index: 0,
      basePrompt: `Amazon product photography of ${productDesc}. Pure white background, centered product, studio lighting with soft shadows. No text, no logos, no watermarks. High-resolution commercial product photo.`,
      defaultStyle: "premium",
    },
    {
      type: "main",
      index: 1,
      basePrompt: `Amazon product photo of ${productDesc} showing all included accessories laid out in a flat-lay arrangement. Pure white background, overhead shot, studio lighting. Product labels and item names are allowed. No logos, no watermarks.`,
      defaultStyle: "premium",
    },
    {
      type: "infographic",
      index: 0,
      basePrompt: `Amazon listing infographic image for ${productDesc}. Product prominently displayed in the center. Simple arrow callout lines pointing to key product features. Short benefit-driven text for each feature. Navy blue and orange accent colors. Text only for feature callouts and labels. No logos, no watermarks.`,
      defaultStyle: "infographic",
    },
    {
      type: "infographic",
      index: 1,
      basePrompt: `Amazon product feature highlight image for ${productDesc}. Product on white background with geometric icon placeholders for feature callouts arranged around it. Clean modern e-commerce design. Text only for feature callouts and labels. No logos, no watermarks.`,
      defaultStyle: "infographic",
    },
    {
      type: "lifestyle",
      index: 0,
      basePrompt: `Amazon lifestyle product scene for ${productDesc}. Product placed prominently in a modern, beautifully decorated home setting. No people. Product is the focal point. Professional commercial photography aesthetic. No text, no logos, no watermarks.`,
      defaultStyle: "lifestyle",
    },
    {
      type: "lifestyle",
      index: 1,
      basePrompt: `Amazon product scene for ${productDesc} styled in an upscale, contemporary environment. Product displayed prominently on a clean surface with tasteful props. No people, no text. Editorial-quality product styling. No logos, no watermarks.`,
      defaultStyle: "premium",
    },
  ];
}

export async function generateProductImages(data: {
  auditId: number;
  productName: string;
  category?: string | null;
  title: string;
  bulletPoints: string[];
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
}): Promise<ImageRecord[]> {
  const dir = ensureAuditImageDir(data.auditId);

  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;
  const globalStyle = data.style;
  const globalAspectRatio: AspectRatio = data.aspectRatio ?? "1:1";

  const specs = buildSpecs(productDesc);
  const records: ImageRecord[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const spec of specs) {
    const style: ImageStyle = globalStyle ?? spec.defaultStyle;
    const aspectRatio = globalAspectRatio;
    const id = `${spec.type}_${spec.index}`;
    const filename = versionedFilename(spec.type, spec.index);
    const filePath = path.join(dir, filename);
    const imgUrl = urlPath(data.auditId, filename);

    try {
      const prompt = buildPrompt(spec.basePrompt, style);
      await generateAndSave(prompt, filePath, aspectRatio);

      const version: ImageVersion = {
        url: imgUrl,
        style,
        aspectRatio,
        isEdit: false,
        generatedAt: new Date().toISOString(),
      };

      records.push({
        id,
        type: spec.type,
        index: spec.index,
        style,
        aspectRatio,
        currentUrl: imgUrl,
        versions: [version],
      });
    } catch (err) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (records.length === 0) {
    const summary = errors.map((e) => `${e.id}: ${e.error}`).join("; ");
    throw new Error(`All image generations failed: ${summary}`);
  }

  return records;
}

export async function regenerateSingleImage(data: {
  auditId: number;
  productName: string;
  category?: string | null;
  existingRecord: ImageRecord;
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
}): Promise<ImageRecord> {
  const dir = ensureAuditImageDir(data.auditId);

  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;
  const specs = buildSpecs(productDesc);
  const spec = specs.find(
    (s) => s.type === data.existingRecord.type && s.index === data.existingRecord.index,
  );
  if (!spec) throw new Error("Image spec not found");

  const style: ImageStyle = data.style ?? (data.existingRecord.style as ImageStyle) ?? spec.defaultStyle;
  const aspectRatio: AspectRatio = data.aspectRatio ?? (data.existingRecord.aspectRatio as AspectRatio) ?? "1:1";

  const filename = versionedFilename(spec.type, spec.index);
  const filePath = path.join(dir, filename);
  const imgUrl = urlPath(data.auditId, filename);

  const prompt = buildPrompt(spec.basePrompt, style);
  await generateAndSave(prompt, filePath, aspectRatio);

  const newVersion: ImageVersion = {
    url: imgUrl,
    style,
    aspectRatio,
    isEdit: false,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...data.existingRecord,
    style,
    aspectRatio,
    currentUrl: imgUrl,
    versions: [...data.existingRecord.versions, newVersion],
  };
}

export async function editSingleImage(data: {
  auditId: number;
  productName: string;
  category?: string | null;
  existingRecord: ImageRecord;
  editPrompt: string;
  referenceImageUrls?: string[];
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
}): Promise<ImageRecord> {
  const dir = ensureAuditImageDir(data.auditId);

  const style: ImageStyle = data.style ?? (data.existingRecord.style as ImageStyle) ?? "premium";
  const aspectRatio: AspectRatio = data.aspectRatio ?? (data.existingRecord.aspectRatio as AspectRatio) ?? "1:1";

  const sourceFilePath = resolveAuditImagePath(data.auditId, data.existingRecord.currentUrl);

  if (!sourceFilePath) {
    throw new Error("Source image file not found. Please regenerate the image first.");
  }

  const filename = versionedFilename(data.existingRecord.type, data.existingRecord.index);
  const destFilePath = path.join(dir, filename);
  const imgUrl = urlPath(data.auditId, filename);

  const refPaths = saveReferenceImageUrls(dir, data.referenceImageUrls);
  const fullPrompt = `${data.editPrompt} ${STYLE_SUFFIXES[style]}`;
  await editAndSave([sourceFilePath, ...refPaths], fullPrompt, destFilePath);

  const newVersion: ImageVersion = {
    url: imgUrl,
    style,
    aspectRatio,
    prompt: data.editPrompt,
    isEdit: true,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...data.existingRecord,
    style,
    aspectRatio,
    currentUrl: imgUrl,
    versions: [...data.existingRecord.versions, newVersion],
  };
}
