import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import type { EbcContent } from "./ebc-generator";
import { generateImageBuffer, generateImageWithReferenceProxy } from "./openai-image";

const IMAGES_DIR = path.join(process.cwd(), "public", "images");
const MIN_FILE_SIZE = 1024;
const REFERENCE_IMAGE_INSTRUCTION =
  "This image is a visual reference of the exact product you MUST feature. The product's appearance, shape, colors, branding, and design must be faithfully reproduced — not changed or substituted.";

export interface AplusModule {
  id: "hero" | "features" | "comparison" | "brand_story";
  title: string;
  description: string;
  headline: string;
  body: string;
  imageUrl: string;
}

export interface AplusGenerationResult {
  content: EbcContent;
  modules: AplusModule[];
}

type ModuleSpec = {
  id: AplusModule["id"];
  title: string;
  description: string;
  size: "1024x1024" | "1792x1024" | "1024x1792";
  buildPrompt: (productDesc: string, content: EbcContent) => string;
  headline: (content: EbcContent) => string;
  body: (content: EbcContent) => string;
};

const MODULE_SPECS: ModuleSpec[] = [
  {
    id: "hero",
    title: "Hero Banner",
    description: "Full-width product hero image with headline",
    size: "1792x1024",
    buildPrompt: (productDesc, c) =>
      `Amazon A+ Enhanced Brand Content hero banner for ${productDesc}. Wide cinematic composition with the product as the hero. Space for headline "${c.heroHeadline}" and subheadline "${c.heroSubheadline}". Premium e-commerce design, clean layout, professional commercial photography. Text areas for headline and subheadline are allowed.`,
    headline: (c) => c.heroHeadline,
    body: (c) => c.heroSubheadline,
  },
  {
    id: "features",
    title: "Feature Highlights",
    description: "Icon + text modules showcasing key features",
    size: "1792x1024",
    buildPrompt: (productDesc, c) =>
      `Amazon A+ feature highlights module for ${productDesc}. Three-column layout with product and feature callouts: "${c.feature1Title}", "${c.feature2Title}", "${c.feature3Title}". Clean modern e-commerce infographic style. Short benefit text for each feature is allowed.`,
    headline: (c) => c.feature1Title,
    body: (c) => `${c.feature1Body} · ${c.feature2Body}`,
  },
  {
    id: "comparison",
    title: "Comparison Chart",
    description: "Compare your product against competitors",
    size: "1792x1024",
    buildPrompt: (productDesc, c) =>
      `Amazon A+ comparison chart module for ${productDesc}. Side-by-side comparison layout highlighting advantages. Section title "${c.gridTitle}". Features: "${c.grid1Title}", "${c.grid2Title}", "${c.grid3Title}", "${c.grid4Title}". Clean chart-style e-commerce design. Comparison labels and feature names are allowed.`,
    headline: (c) => c.gridTitle,
    body: (c) => `${c.grid1Title}: ${c.grid1Desc}`,
  },
  {
    id: "brand_story",
    title: "Brand Story",
    description: "Tell your brand story with rich imagery",
    size: "1024x1792",
    buildPrompt: (productDesc, c) =>
      `Amazon A+ brand story module for ${productDesc}. Emotional brand storytelling layout with rich imagery and product integration. Headline "${c.storyHeadline}". Warm aspirational atmosphere, premium brand aesthetic. Headline and short story text are allowed.`,
    headline: (c) => c.storyHeadline,
    body: (c) => c.storyBody,
  },
];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function urlPath(auditId: number, filename: string): string {
  return `/api/images/${auditId}/${filename}`;
}

function saveBase64Image(base64Data: string, dir: string, filename: string): string | null {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < MIN_FILE_SIZE) return null;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function downloadImage(url: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_FILE_SIZE) return null;
    fs.writeFileSync(destPath, buffer);
    return destPath;
  } catch {
    return null;
  }
}

async function resolveSourceImage(auditId: number, imageUrls: string[]): Promise<string | null> {
  const dir = path.join(IMAGES_DIR, String(auditId));
  ensureDir(dir);

  for (let i = 0; i < imageUrls.length; i++) {
    const raw = imageUrls[i];
    if (!raw) continue;

    if (raw.startsWith("data:image/")) {
      const ext = raw.startsWith("data:image/png") ? "png" : "jpg";
      const saved = saveBase64Image(raw, dir, `aplus_source_${i}.${ext}`);
      if (saved) return saved;
      continue;
    }

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const dest = path.join(dir, `aplus_source_remote_${i}.jpg`);
      const downloaded = await downloadImage(raw, dest);
      if (downloaded) return downloaded;
      continue;
    }

    if (fs.existsSync(raw) && fs.statSync(raw).size >= MIN_FILE_SIZE) {
      return raw;
    }
  }

  return null;
}

export function buildDefaultAplusPrompt(data: {
  productName: string;
  brandName?: string | null;
  category?: string | null;
  bulletPoints: string[];
  targetKeywords: string[];
  summary?: string;
}): string {
  const brand = data.brandName?.trim();
  const category = data.category?.trim();
  const bullets = data.bulletPoints.slice(0, 5).join("; ");
  const keywords = data.targetKeywords.slice(0, 8).join(", ");
  return [
    `Create compelling Amazon A+ Enhanced Brand Content for ${data.productName}.`,
    brand ? `Brand: ${brand}.` : "",
    category ? `Category: ${category}.` : "",
    bullets ? `Key benefits: ${bullets}.` : "",
    keywords ? `Keywords: ${keywords}.` : "",
    data.summary ? `Summary: ${data.summary}` : "",
    "Tone: professional, benefit-driven, conversion-focused. Target Amazon Brand Registry A+ modules.",
  ].filter(Boolean).join(" ");
}

export async function generateAplusModuleImages(data: {
  auditId: number;
  productName: string;
  category?: string | null;
  content: EbcContent;
  imageUrls: string[];
}): Promise<AplusModule[]> {
  const dir = path.join(IMAGES_DIR, String(data.auditId));
  ensureDir(dir);

  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;
  const sourcePath = await resolveSourceImage(data.auditId, data.imageUrls);
  const sourceValid = sourcePath !== null && fs.existsSync(sourcePath) && fs.statSync(sourcePath).size >= MIN_FILE_SIZE;

  const limit = pLimit(2);
  const modules: AplusModule[] = [];
  const errors: string[] = [];

  await Promise.all(
    MODULE_SPECS.map((spec) =>
      limit(async () => {
        const filename = `aplus_${spec.id}_${Date.now()}.png`;
        const filePath = path.join(dir, filename);
        const imageUrl = urlPath(data.auditId, filename);
        const prompt = spec.buildPrompt(productDesc, data.content);

        try {
          let buffer: Buffer;
          if (sourceValid) {
            buffer = await generateImageWithReferenceProxy(
              `${REFERENCE_IMAGE_INSTRUCTION} ${prompt}`,
              sourcePath!,
              spec.size,
            );
          } else {
            buffer = await generateImageBuffer(prompt, spec.size);
          }
          if (!buffer?.length) throw new Error("No image data returned");
          fs.writeFileSync(filePath, buffer);

          modules.push({
            id: spec.id,
            title: spec.title,
            description: spec.description,
            headline: spec.headline(data.content),
            body: spec.body(data.content),
            imageUrl,
          });
        } catch (err) {
          errors.push(`${spec.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    ),
  );

  if (modules.length === 0) {
    throw new Error(errors[0] ?? "A+ image generation failed");
  }

  return MODULE_SPECS
    .map((spec) => modules.find((m) => m.id === spec.id))
    .filter((m): m is AplusModule => !!m);
}
