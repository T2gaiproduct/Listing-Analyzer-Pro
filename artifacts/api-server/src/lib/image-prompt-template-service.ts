import { and, asc, eq } from "drizzle-orm";
import {
  imagePromptTemplatesTable,
  type ImagePromptTemplate,
  type ImagePromptTemplateCategory,
  type ImagePromptTemplateMetadata,
  imagePromptTemplateMetadataSchema,
} from "@workspace/db";
import { db } from "@workspace/db";
import type { EbcContent } from "./ebc-generator.js";
import { APLUS_EDGE_TO_EDGE_PROMPT } from "./aplus-image-size.js";

export class ImagePromptTemplateError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "disabled" | "validation" = "not_found",
  ) {
    super(message);
    this.name = "ImagePromptTemplateError";
  }
}

const GRAPHICS_PLACEHOLDERS = ["productDesc"] as const;
const APLUS_PLACEHOLDERS = [
  "productDesc",
  "aplusEdgeToEdge",
  "heroHeadline",
  "heroSubheadline",
  "feature1Title",
  "feature2Title",
  "feature3Title",
  "feature1Body",
  "feature2Body",
  "gridTitle",
  "grid1Title",
  "grid2Title",
  "grid3Title",
  "grid4Title",
  "storyHeadline",
  "storyBody",
  "grid1Desc",
] as const;

export function renderPromptTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function ebcContentToTemplateVars(content: EbcContent): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") vars[key] = value;
  }
  return vars;
}

export function validateTemplatePlaceholders(
  category: ImagePromptTemplateCategory,
  promptTemplate: string,
  headlineTemplate?: string | null,
  bodyTemplate?: string | null,
): string | null {
  const allowed = new Set<string>(
    category === "graphics" ? GRAPHICS_PLACEHOLDERS : [...APLUS_PLACEHOLDERS],
  );
  const combined = [promptTemplate, headlineTemplate ?? "", bodyTemplate ?? ""].join(" ");
  const unknown: string[] = [];
  for (const match of combined.matchAll(/\{\{(\w+)\}\}/g)) {
    const key = match[1];
    if (!allowed.has(key)) unknown.push(key);
  }
  if (unknown.length === 0) return null;
  const unique = [...new Set(unknown)];
  return `Unknown placeholders for ${category}: ${unique.join(", ")}. Allowed: ${[...allowed].join(", ")}`;
}

export async function listEnabledImagePromptTemplates(
  category: ImagePromptTemplateCategory,
): Promise<ImagePromptTemplate[]> {
  return db
    .select()
    .from(imagePromptTemplatesTable)
    .where(
      and(
        eq(imagePromptTemplatesTable.category, category),
        eq(imagePromptTemplatesTable.enabled, 1),
      ),
    )
    .orderBy(asc(imagePromptTemplatesTable.sortOrder), asc(imagePromptTemplatesTable.name));
}

export async function listAllImagePromptTemplatesAdmin(
  category?: ImagePromptTemplateCategory,
): Promise<ImagePromptTemplate[]> {
  if (category) {
    return db
      .select()
      .from(imagePromptTemplatesTable)
      .where(eq(imagePromptTemplatesTable.category, category))
      .orderBy(asc(imagePromptTemplatesTable.sortOrder), asc(imagePromptTemplatesTable.name));
  }
  return db
    .select()
    .from(imagePromptTemplatesTable)
    .orderBy(
      asc(imagePromptTemplatesTable.category),
      asc(imagePromptTemplatesTable.sortOrder),
      asc(imagePromptTemplatesTable.name),
    );
}

export async function getImagePromptTemplateById(id: number): Promise<ImagePromptTemplate | undefined> {
  const [row] = await db
    .select()
    .from(imagePromptTemplatesTable)
    .where(eq(imagePromptTemplatesTable.id, id))
    .limit(1);
  return row;
}

export async function getImagePromptTemplateBySlug(
  category: ImagePromptTemplateCategory,
  slug: string,
): Promise<ImagePromptTemplate | undefined> {
  const normalized = slug.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(imagePromptTemplatesTable)
    .where(
      and(
        eq(imagePromptTemplatesTable.category, category),
        eq(imagePromptTemplatesTable.slug, normalized),
      ),
    )
    .limit(1);
  return row;
}

export function parseImagePromptMetadata(
  raw: ImagePromptTemplateMetadata | null | undefined,
): ImagePromptTemplateMetadata {
  if (!raw) return {};
  const parsed = imagePromptTemplateMetadataSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function isGraphicsFeatureBucket(metadata: ImagePromptTemplateMetadata | null | undefined): boolean {
  return parseImagePromptMetadata(metadata).graphicsBucket === "feature";
}

export async function getEnabledGraphicsTypeSlugs(): Promise<string[]> {
  const rows = await listEnabledImagePromptTemplates("graphics");
  return rows.map((r) => r.slug);
}

export async function getEnabledAplusModuleSlugs(): Promise<string[]> {
  const rows = await listEnabledImagePromptTemplates("aplus");
  return rows.map((r) => r.slug);
}

export async function isEnabledAplusModuleSlug(slug: string): Promise<boolean> {
  const row = await getImagePromptTemplateBySlug("aplus", slug);
  return !!row && row.enabled === 1;
}

export async function parseAplusModuleIds(moduleIds: unknown): Promise<string[]> {
  const allEnabled = await getEnabledAplusModuleSlugs();
  if (allEnabled.length === 0) {
    throw new Error("No A+ modules are configured");
  }
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    return [...allEnabled];
  }
  const valid = new Set(allEnabled);
  const parsed = moduleIds.filter((id): id is string => typeof id === "string" && valid.has(id));
  if (parsed.length === 0) {
    throw new Error("Select at least one A+ module");
  }
  return parsed;
}

export async function mergeAplusModules<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): Promise<T[]> {
  const order = await getEnabledAplusModuleSlugs();
  const byId = new Map<string, T>();
  for (const module of existing) byId.set(module.id, module);
  for (const module of incoming) byId.set(module.id, module);
  return order
    .map((id) => byId.get(id))
    .filter((m): m is T => !!m);
}

export async function buildGraphicsPromptForType(
  typeSlug: string,
  productDesc: string,
): Promise<string | null> {
  const row = await getImagePromptTemplateBySlug("graphics", typeSlug);
  if (!row || row.enabled !== 1) return null;
  if (!row.promptTemplate.trim()) return null;
  return renderPromptTemplate(row.promptTemplate, { productDesc });
}

export async function resolveGraphicsBucketForType(typeSlug: string): Promise<"feature" | "lifestyle"> {
  const row = await getImagePromptTemplateBySlug("graphics", typeSlug);
  if (!row) {
    const legacyFeature = ["callouts", "social", "size", "beforeafter"];
    return legacyFeature.includes(typeSlug) ? "feature" : "lifestyle";
  }
  return isGraphicsFeatureBucket(row.metadata) ? "feature" : "lifestyle";
}

export type RuntimeAplusModuleSpec = {
  id: string;
  title: string;
  description: string;
  buildPrompt: (productDesc: string, content: EbcContent) => string;
  headline: (content: EbcContent) => string;
  body: (content: EbcContent) => string;
};

export async function getRuntimeAplusModuleSpec(slug: string): Promise<RuntimeAplusModuleSpec | undefined> {
  const row = await getImagePromptTemplateBySlug("aplus", slug);
  if (!row || row.enabled !== 1) return undefined;

  return {
    id: row.slug,
    title: row.name,
    description: row.description ?? "",
    buildPrompt: (productDesc, content) => {
      const vars = {
        ...ebcContentToTemplateVars(content),
        productDesc,
        aplusEdgeToEdge: APLUS_EDGE_TO_EDGE_PROMPT,
      };
      return renderPromptTemplate(row.promptTemplate, vars);
    },
    headline: (content) => {
      const template = row.headlineTemplate?.trim() || "{{heroHeadline}}";
      return renderPromptTemplate(template, ebcContentToTemplateVars(content));
    },
    body: (content) => {
      const template = row.bodyTemplate?.trim() || "";
      if (!template) return "";
      return renderPromptTemplate(template, ebcContentToTemplateVars(content));
    },
  };
}

export async function getRuntimeAplusModuleSpecs(moduleIds: string[]): Promise<RuntimeAplusModuleSpec[]> {
  const specs: RuntimeAplusModuleSpec[] = [];
  for (const id of moduleIds) {
    const spec = await getRuntimeAplusModuleSpec(id);
    if (spec) specs.push(spec);
  }
  return specs;
}

export function serializeImagePromptTemplatePublic(row: ImagePromptTemplate) {
  const meta = parseImagePromptMetadata(row.metadata);
  return {
    slug: row.slug,
    category: row.category,
    name: row.name,
    description: row.description,
    icon: meta.icon ?? null,
    sortOrder: row.sortOrder,
  };
}

export function serializeImagePromptTemplateAdmin(row: ImagePromptTemplate) {
  const meta = parseImagePromptMetadata(row.metadata);
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    isSystem: row.isSystem === 1,
    sortOrder: row.sortOrder,
    promptTemplate: row.promptTemplate,
    headlineTemplate: row.headlineTemplate,
    bodyTemplate: row.bodyTemplate,
    metadata: meta,
  };
}
