import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import type { EbcContent } from "./ebc-generator";
import { generateImageBuffer, generateImageWithReferenceProxy, editImagesProxy } from "./openai-image";
import { generatePreservedProductImage } from "./product-preserve-graphics.js";
import {
  ensureAuditImageDir,
  saveReferenceImageUrls,
  imageUrlPath,
  resolveAuditImagePath,
} from "./image-storage";
import {
  APLUS_SAFE_MARGIN_PROMPT,
  resizeAplusModuleBuffer,
} from "./aplus-image-size.js";
import {
  getRuntimeAplusModuleSpec,
  getRuntimeAplusModuleSpecs,
  type RuntimeAplusModuleSpec,
} from "./image-prompt-template-service.js";
import {
  buildReferenceGenerationPrompt,
  buildReferenceRetryPrompt,
  resolveWrappersForTemplateSlug,
} from "./image-prompt-runtime.js";
import {
  isOpenAiInvalidImageDataError,
  prepareImageForOpenAiEdit,
} from "./reference-image-normalize.js";
import {
  collectAuditOverviewImageUrls,
  findGraphicsProjectIdForAudit,
  resolvePrimaryAuditProductReference,
} from "./product-overview-reference.js";

const MIN_FILE_SIZE = 1024;
const MAX_CONCURRENT_APLUS_IMAGES = 4;

const QUALITY_PROMPT_SUFFIX: Record<string, string> = {
  standard: "",
  hd: " Ultra high resolution, maximum sharp detail, professional commercial photography quality.",
};

function applyQualityToPrompt(prompt: string, quality?: string): string {
  const suffix = QUALITY_PROMPT_SUFFIX[quality ?? "standard"] ?? "";
  return suffix ? `${prompt}${suffix}` : prompt;
}

export interface AplusModuleVersion {
  url: string;
  isEdit: boolean;
  prompt?: string;
  generatedAt: string;
}

export type AplusAspectRatio = "970:300" | "16:10" | "9:16" | "1:1";

const APLUS_GENERATION_SIZE = "1792x1024" as const;

export type AplusModuleId = string;

export interface AplusModule {
  id: AplusModuleId;
  title: string;
  description: string;
  headline: string;
  body: string;
  imageUrl: string;
  aspectRatio?: AplusAspectRatio;
  versions?: AplusModuleVersion[];
}

export interface AplusGenerationResult {
  content: EbcContent;
  modules: AplusModule[];
}

export interface AplusStoredState {
  status: "generating" | "completed" | "failed";
  progress?: { done: number; total: number };
  content?: EbcContent;
  modules?: AplusModule[];
  errorMessage?: string;
}

export {
  parseAplusModuleIds,
  mergeAplusModules,
  getEnabledAplusModuleSlugs,
} from "./image-prompt-template-service.js";

function specToAspectRatio(): AplusAspectRatio {
  return "970:300";
}

export async function getModuleSpec(id: AplusModuleId): Promise<RuntimeAplusModuleSpec | undefined> {
  return getRuntimeAplusModuleSpec(id);
}

export function normalizeAplusModule(module: AplusModule): AplusModule {
  return {
    ...module,
    aspectRatio: module.aspectRatio ?? specToAspectRatio(),
    versions: module.versions ?? [],
  };
}

function resolveImageFilePath(auditId: number, imageUrl: string): string | null {
  return resolveAuditImagePath(auditId, imageUrl);
}

function isValidSourcePath(sourcePath: string | null): boolean {
  return sourcePath !== null
    && fs.existsSync(sourcePath)
    && fs.statSync(sourcePath).size >= MIN_FILE_SIZE;
}

/** A+ banners always request high API quality; UI "HD" still adds extra prompt detail. */
function aplusApiImageQuality(): "high" {
  return "high";
}

async function generateModuleBuffer(
  spec: RuntimeAplusModuleSpec,
  data: {
    auditId: number;
    productName: string;
    category?: string | null;
    content: EbcContent;
    imageUrls: string[];
    sourcePath?: string | null;
    prompt?: string;
    quality?: "standard" | "hd";
  },
): Promise<Buffer> {
  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;
  const sourcePath = data.sourcePath;
  if (!sourcePath || !isValidSourcePath(sourcePath)) {
    throw new Error(
      "No product reference image found from listing overview. Import or upload product images before generating A+.",
    );
  }
  const basePrompt = data.prompt ?? spec.buildPrompt(productDesc, data.content);
  const prompt = `${basePrompt} ${APLUS_SAFE_MARGIN_PROMPT}`;
  const apiQuality = aplusApiImageQuality();
  const imageOpts = { quality: apiQuality as const };

  const wrappers = await resolveWrappersForTemplateSlug("aplus", spec.id);
  const refPrompt = buildReferenceGenerationPrompt(prompt, wrappers);
  let normalizedRef = sourcePath;
  try {
    normalizedRef = await prepareImageForOpenAiEdit(sourcePath);
  } catch {
    /* use original file */
  }

  const compositeFallback = () =>
    generatePreservedProductImage({
      imageType: spec.id,
      sourceFilePath: sourcePath,
      size: APLUS_GENERATION_SIZE,
      prompt,
      productLabel: data.productName,
      compositeSceneSuffix: wrappers.compositeSceneSuffix,
      compositeFallbackScene: wrappers.compositeFallbackScene,
      generateScene: (scenePrompt, sz) => generateImageBuffer(scenePrompt, sz, imageOpts),
    });

  let raw: Buffer;
  try {
    raw = await generateImageWithReferenceProxy(
      refPrompt,
      normalizedRef,
      APLUS_GENERATION_SIZE,
      imageOpts,
    );
  } catch (err) {
    if (!isOpenAiInvalidImageDataError(err)) {
      raw = await compositeFallback();
    } else {
      try {
        raw = await generateImageWithReferenceProxy(
          buildReferenceRetryPrompt(wrappers),
          normalizedRef,
          APLUS_GENERATION_SIZE,
          imageOpts,
        );
      } catch {
        raw = await compositeFallback();
      }
    }
  }
  return resizeAplusModuleBuffer(raw);
}

function buildAplusModuleFromSpec(
  spec: RuntimeAplusModuleSpec,
  auditId: number,
  content: EbcContent,
  imageUrl: string,
  existing?: AplusModule,
): AplusModule {
  return normalizeAplusModule({
    id: spec.id,
    title: spec.title,
    description: spec.description,
    headline: spec.headline(content),
    body: spec.body(content),
    imageUrl,
    aspectRatio: specToAspectRatio(),
    versions: existing?.versions ?? [],
  });
}

export async function regenerateAplusModule(data: {
  auditId: number;
  moduleId: AplusModule["id"];
  productName: string;
  category?: string | null;
  content: EbcContent;
  imageUrls: string[];
  existing: AplusModule;
  quality?: "standard" | "hd";
}): Promise<AplusModule> {
  const spec = await getModuleSpec(data.moduleId);
  if (!spec) throw new Error("Invalid A+ module");

  const dir = ensureAuditImageDir(data.auditId);
  const graphicsProjectId = await findGraphicsProjectIdForAudit(data.auditId);
  const overview = await collectAuditOverviewImageUrls(
    data.auditId,
    data.imageUrls,
    graphicsProjectId,
  );
  const sourcePath = await resolvePrimaryAuditProductReference(
    data.auditId,
    overview,
    { graphicsProjectId },
  );
  if (!sourcePath) {
    throw new Error(
      "No product reference image found from listing overview. Import or upload product images before regenerating A+.",
    );
  }

  const buffer = await generateModuleBuffer(spec, { ...data, sourcePath });
  if (!buffer?.length) throw new Error("No image data returned");

  const filename = `aplus_${spec.id}_${Date.now()}.png`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  const imageUrl = urlPath(data.auditId, filename);

  const normalized = normalizeAplusModule(data.existing);
  const newVersion: AplusModuleVersion = {
    url: imageUrl,
    isEdit: false,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...buildAplusModuleFromSpec(spec, data.auditId, data.content, imageUrl, normalized),
    versions: [...(normalized.versions ?? []), newVersion],
  };
}

export async function editAplusModule(data: {
  auditId: number;
  moduleId: AplusModule["id"];
  content: EbcContent;
  existing: AplusModule;
  editPrompt: string;
  referenceImageUrls?: string[];
}): Promise<AplusModule> {
  const spec = await getModuleSpec(data.moduleId);
  if (!spec) throw new Error("Invalid A+ module");

  const normalized = normalizeAplusModule(data.existing);
  const sourceFilePath = resolveImageFilePath(data.auditId, normalized.imageUrl);
  if (!sourceFilePath) {
    throw new Error("Source image file not found. Please regenerate the image first.");
  }

  const dir = ensureAuditImageDir(data.auditId);

  const refPaths = saveReferenceImageUrls(dir, data.referenceImageUrls);
  const filename = `aplus_${spec.id}_edit_${Date.now()}.png`;
  const filePath = path.join(dir, filename);
  const edited = await editImagesProxy([sourceFilePath, ...refPaths], data.editPrompt.trim(), filePath);
  if (!edited?.length) throw new Error("No image data returned from AI edit");
  const buffer = await resizeAplusModuleBuffer(edited);
  fs.writeFileSync(filePath, buffer);

  const imageUrl = urlPath(data.auditId, filename);
  const newVersion: AplusModuleVersion = {
    url: imageUrl,
    isEdit: true,
    prompt: data.editPrompt.trim(),
    generatedAt: new Date().toISOString(),
  };

  return {
    ...buildAplusModuleFromSpec(spec, data.auditId, data.content, imageUrl, normalized),
    versions: [...(normalized.versions ?? []), newVersion],
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function urlPath(auditId: number, filename: string): string {
  return imageUrlPath(auditId, filename);
}

export function buildDefaultAplusPrompt(data: {
  productName: string;
  brandName?: string | null;
  category?: string | null;
  productDescription?: string | null;
  bulletPoints: string[];
  targetKeywords: string[];
  summary?: string;
  uploadReferenceContext?: string;
}): string {
  const brand = data.brandName?.trim();
  const category = data.category?.trim();
  const bullets = data.bulletPoints.slice(0, 5).join("; ");
  const keywords = data.targetKeywords.slice(0, 8).join(", ");
  return [
    `Create compelling Amazon A+ Enhanced Brand Content for ${data.productName}.`,
    brand ? `Brand: ${brand}.` : "",
    category ? `Category: ${category}.` : "",
    data.productDescription?.trim() ? `Product description: ${data.productDescription.trim()}` : "",
    data.uploadReferenceContext?.trim()
      ? `Upload-step attributes & reference research: ${data.uploadReferenceContext.trim()}`
      : "",
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
  moduleIds: AplusModule["id"][];
  imageCustomPrompt?: string;
  promptReferenceImageUrls?: string[];
  quality?: "standard" | "hd";
  moduleConfigs?: Record<string, {
    imageCustomPrompt?: string;
    promptReferenceImageUrls?: string[];
    quality?: "standard" | "hd";
  }>;
  onModuleComplete?: (module: AplusModule, done: number, total: number) => void | Promise<void>;
}): Promise<AplusModule[]> {
  const dir = ensureAuditImageDir(data.auditId);
  const productDesc = `${data.productName}${data.category ? `, a ${data.category} product` : ""}`;
  const specs = await getRuntimeAplusModuleSpecs(data.moduleIds, data.category);
  const total = specs.length;
  const globalImageDirection = data.imageCustomPrompt?.trim();
  const graphicsProjectId = await findGraphicsProjectIdForAudit(data.auditId);
  const overviewUrls = await collectAuditOverviewImageUrls(
    data.auditId,
    [
      ...data.imageUrls,
      ...(data.promptReferenceImageUrls ?? []),
    ],
    graphicsProjectId,
  );
  const initialSourcePath = await resolvePrimaryAuditProductReference(
    data.auditId,
    overviewUrls,
    { graphicsProjectId },
  );
  if (!initialSourcePath) {
    throw new Error(
      "No product reference image found from listing overview. Import or upload product images before generating A+.",
    );
  }

  const limit = pLimit(MAX_CONCURRENT_APLUS_IMAGES);
  const progressLock = pLimit(1);
  let doneCount = 0;
  const errors: string[] = [];

  async function resolveModuleSourcePath(moduleConfig?: {
    promptReferenceImageUrls?: string[];
  }): Promise<string | null> {
    const liveOverview = await collectAuditOverviewImageUrls(
      data.auditId,
      [
        ...data.imageUrls,
        ...(moduleConfig?.promptReferenceImageUrls ?? []),
        ...(data.promptReferenceImageUrls ?? []),
      ],
      graphicsProjectId,
    );
    const resolved = await resolvePrimaryAuditProductReference(data.auditId, liveOverview, {
      graphicsProjectId,
    });
    if (!resolved) {
      throw new Error(
        "No product reference image from listing overview. Add Overview images, then regenerate A+.",
      );
    }
    return resolved;
  }

  const modules = await Promise.all(
    specs.map((spec) => limit(async (): Promise<AplusModule | null> => {
      const moduleConfig = data.moduleConfigs?.[spec.id];
      const sourcePath = await resolveModuleSourcePath(moduleConfig);

      const filename = `aplus_${spec.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = path.join(dir, filename);
      const imageUrl = urlPath(data.auditId, filename);
      const basePrompt = spec.buildPrompt(productDesc, data.content);
      const imageDirection = moduleConfig?.imageCustomPrompt?.trim() || globalImageDirection;
      const prompt = applyQualityToPrompt(
        imageDirection ? `${basePrompt} Additional creative direction: ${imageDirection}` : basePrompt,
        moduleConfig?.quality ?? data.quality,
      );
      const moduleQuality = moduleConfig?.quality ?? data.quality;

      try {
        const buffer = await generateModuleBuffer(spec, {
          auditId: data.auditId,
          productName: data.productName,
          category: data.category,
          content: data.content,
          imageUrls: data.imageUrls,
          sourcePath,
          prompt,
          quality: moduleQuality,
        });
        if (!buffer?.length) throw new Error("No image data returned");
        fs.writeFileSync(filePath, buffer);

        const module = buildAplusModuleFromSpec(spec, data.auditId, data.content, imageUrl);
        await progressLock(async () => {
          doneCount += 1;
          await data.onModuleComplete?.(module, doneCount, total);
        });
        return module;
      } catch (err) {
        errors.push(`${spec.id}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    })),
  );

  const successful = modules.filter((module): module is AplusModule => module !== null);
  if (successful.length === 0) {
    throw new Error(errors[0] ?? "A+ image generation failed");
  }

  return specs
    .map((spec) => successful.find((module) => module.id === spec.id))
    .filter((module): module is AplusModule => !!module);
}
