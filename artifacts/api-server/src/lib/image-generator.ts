import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import * as fs from "fs";
import * as path from "path";
import type { GeneratedImages } from "@workspace/db";

const IMAGES_DIR = path.join(process.cwd(), "public", "images");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function generateAndSaveImage(
  prompt: string,
  outputPath: string,
): Promise<string> {
  const buffer = await generateImageBuffer(prompt, "1024x1024");
  if (!buffer || buffer.length === 0) {
    throw new Error("No image data returned from OpenAI");
  }
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

export async function generateProductImages(data: {
  auditId: number;
  productName: string;
  category?: string | null;
  title: string;
  bulletPoints: string[];
}): Promise<GeneratedImages> {
  const dir = path.join(IMAGES_DIR, String(data.auditId));
  ensureDir(dir);

  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;

  const imageSpecs = [
    {
      type: "main",
      index: 0,
      prompt: `Professional Amazon product photography of ${productDesc}. Pure white background, centered product, studio lighting with soft shadows. No text, no logos, no watermarks. High-resolution commercial product photo.`,
    },
    {
      type: "main",
      index: 1,
      prompt: `Professional Amazon product photo of ${productDesc} showing all included accessories laid out flat. Pure white background, overhead flat-lay shot, studio lighting. No text overlays. Clean commercial photography.`,
    },
    {
      type: "infographic",
      index: 0,
      prompt: `Amazon listing infographic image for ${productDesc}. Clean white background with the product prominently displayed in the center. Simple arrow callout lines pointing to key product features. Modern design with navy blue and orange accent colors. No text — only visual layout.`,
    },
    {
      type: "infographic",
      index: 1,
      prompt: `Amazon product feature highlight image for ${productDesc}. Product on white background with geometric icon placeholders for feature callouts arranged around it. Clean, modern e-commerce design with navy and orange color scheme. No text.`,
    },
    {
      type: "lifestyle",
      index: 0,
      prompt: `Amazon lifestyle product scene for ${productDesc}. The product is placed prominently in a modern, beautifully decorated home setting. Warm natural lighting, clean and aspirational interior design. No people. Product is the focal point. Professional commercial photography aesthetic.`,
    },
    {
      type: "lifestyle",
      index: 1,
      prompt: `Amazon product scene for ${productDesc} styled in an upscale, contemporary environment. The product is displayed prominently on a clean surface with tasteful props and natural light. No people, no text. Editorial-quality product styling, premium brand aesthetic.`,
    },
  ];

  const results: GeneratedImages = { main: [], infographic: [], lifestyle: [] };
  const errors: Array<{ spec: string; error: string }> = [];

  // Generate sequentially to avoid rate limits (gpt-image-1 is expensive)
  for (const spec of imageSpecs) {
    const filename = `${spec.type}_${spec.index}.png`;
    const filePath = path.join(dir, filename);
    const urlPath = `/api/images/${data.auditId}/${filename}`;
    try {
      await generateAndSaveImage(spec.prompt, filePath);
      results[spec.type as keyof GeneratedImages].push(urlPath);
    } catch (err) {
      errors.push({
        spec: `${spec.type}_${spec.index}`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  results.main.sort();
  results.infographic.sort();
  results.lifestyle.sort();

  const totalGenerated = results.main.length + results.infographic.length + results.lifestyle.length;

  if (totalGenerated === 0) {
    const errorSummary = errors.map((e) => `${e.spec}: ${e.error}`).join("; ");
    throw new Error(`All image generations failed: ${errorSummary}`);
  }

  return results;
}
