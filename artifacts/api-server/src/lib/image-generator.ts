import { openai } from "@workspace/integrations-openai-ai-server";
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
  outputPath: string
): Promise<string> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
    quality: "standard",
  });

  const b64 = response.data[0]?.b64_json;
  if (!b64) throw new Error("No image data returned from OpenAI");

  const buffer = Buffer.from(b64, "base64");
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
  const topFeature = data.bulletPoints[0]?.slice(0, 120) || "";
  const secondFeature = data.bulletPoints[1]?.slice(0, 120) || "";

  const imageSpecs = [
    {
      type: "main",
      index: 0,
      prompt: `Professional Amazon product photography of ${productDesc}. Pure white background (#FFFFFF), centered product, studio lighting with soft shadows, multiple angles showing the full product. No text, no logos, no props. High-resolution commercial product photo, photo-realistic, 8K quality.`,
    },
    {
      type: "main",
      index: 1,
      prompt: `Professional Amazon product photo of ${productDesc} showing all included accessories and components laid out flat. Pure white background, overhead shot (flat lay), studio lighting. No text overlays. Clean, commercial photography style.`,
    },
    {
      type: "infographic",
      index: 0,
      prompt: `Amazon listing infographic image for ${productDesc}. Clean white background with the product prominently displayed in the center. Minimalist design with 3-4 simple arrow callout lines pointing to key product parts. Modern flat design style with navy blue (#003087) and orange (#FF6600) accent colors. Professional e-commerce graphic. No text (text will be added separately). Photo-realistic product rendering.`,
    },
    {
      type: "infographic",
      index: 1,
      prompt: `Amazon product comparison/specification infographic for ${productDesc}. Split layout showing the product prominently on a white background with simple geometric icon placeholders for feature highlights. Clean, modern design with navy and orange color scheme. Professional e-commerce style. No text. Icon boxes arranged around the product.`,
    },
    {
      type: "lifestyle",
      index: 0,
      prompt: `Amazon lifestyle product photo of ${productDesc} being used by a person in a modern, aspirational setting. Natural lighting, realistic environment, genuine use case. Professional photography. The product is the hero of the image. Warm, inviting atmosphere. Shot on camera, photo-realistic.`,
    },
    {
      type: "lifestyle",
      index: 1,
      prompt: `Amazon lifestyle image showing ${productDesc} in a beautifully styled real-world setting. Aspirational home or office environment with perfect styling and professional photography. The product is prominently featured and in active use. Natural daylight or warm artificial lighting. Premium lifestyle aesthetic, editorial quality.`,
    },
  ];

  const results: GeneratedImages = { main: [], infographic: [], lifestyle: [] };
  const errors: string[] = [];

  await Promise.all(
    imageSpecs.map(async (spec) => {
      const filename = `${spec.type}_${spec.index}.png`;
      const filePath = path.join(dir, filename);
      const urlPath = `/api/images/${data.auditId}/${filename}`;

      try {
        await generateAndSaveImage(spec.prompt, filePath);
        results[spec.type as keyof GeneratedImages].push(urlPath);
      } catch (err) {
        errors.push(`${spec.type}_${spec.index}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  results.main.sort();
  results.infographic.sort();
  results.lifestyle.sort();

  return results;
}
