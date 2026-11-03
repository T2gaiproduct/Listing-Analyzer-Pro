import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  graphicsModuleExamplesTable,
  graphicsProductCategoriesTable,
} from "@workspace/db";
import { DEFAULT_GRAPHICS_PRODUCT_CATEGORY } from "./amazon-category-seeds.js";
import { listEnabledImagePromptTemplates } from "./image-prompt-template-service.js";

export const MAX_GRAPHICS_MODULE_EXAMPLES_PER_TYPE = 12;

export type GraphicsModuleExampleImage = {
  id: number;
  url: string;
};

export type GraphicsModuleExampleRow = {
  templateSlug: string;
  name: string;
  description: string | null;
  icon: string | null;
  /** First image — backward compatible with single-image clients. */
  exampleImageUrl: string | null;
  exampleImages: GraphicsModuleExampleImage[];
  sortOrder: number;
};

export async function listProductCategoryNames(): Promise<string[]> {
  const rows = await db
    .select({ name: graphicsProductCategoriesTable.name })
    .from(graphicsProductCategoriesTable)
    .orderBy(asc(graphicsProductCategoriesTable.sortOrder), asc(graphicsProductCategoriesTable.name));
  return rows.map((r) => r.name);
}

export async function listProductCategoriesAdmin(): Promise<
  { id: number; name: string; isSystem: boolean; sortOrder: number }[]
> {
  const rows = await db
    .select()
    .from(graphicsProductCategoriesTable)
    .orderBy(asc(graphicsProductCategoriesTable.sortOrder), asc(graphicsProductCategoriesTable.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.isSystem === 1,
    sortOrder: r.sortOrder,
  }));
}

function resolveCategoryName(requested: string | null | undefined, knownNames: Set<string>): string {
  const trimmed = requested?.trim();
  if (trimmed && knownNames.has(trimmed)) return trimmed;
  if (knownNames.has(DEFAULT_GRAPHICS_PRODUCT_CATEGORY)) return DEFAULT_GRAPHICS_PRODUCT_CATEGORY;
  return trimmed || DEFAULT_GRAPHICS_PRODUCT_CATEGORY;
}

function groupExampleImages(
  rows: { id: number; templateSlug: string; exampleImageUrl: string; displayOrder: number }[],
): Map<string, GraphicsModuleExampleImage[]> {
  const bySlug = new Map<string, GraphicsModuleExampleImage[]>();
  for (const row of rows) {
    const slug = row.templateSlug;
    const list = bySlug.get(slug) ?? [];
    list.push({ id: row.id, url: row.exampleImageUrl });
    bySlug.set(slug, list);
  }
  return bySlug;
}

function mergeCategoryAndDefaultImages(
  categoryImages: GraphicsModuleExampleImage[],
  defaultImages: GraphicsModuleExampleImage[],
): { images: GraphicsModuleExampleImage[]; usedDefaultImages: boolean } {
  if (defaultImages.length === 0) {
    return { images: categoryImages, usedDefaultImages: false };
  }
  const seen = new Set(categoryImages.map((i) => i.url));
  const merged = [...categoryImages];
  let usedDefaultImages = false;
  for (const img of defaultImages) {
    if (seen.has(img.url)) continue;
    if (merged.length >= MAX_GRAPHICS_MODULE_EXAMPLES_PER_TYPE) break;
    merged.push(img);
    seen.add(img.url);
    usedDefaultImages = true;
  }
  return { images: merged, usedDefaultImages };
}

export type GetGraphicsModuleExamplesOptions = {
  /** Seller API: include Default category examples after category-specific ones (same module). */
  mergeDefaultExamples?: boolean;
};

export async function getGraphicsModuleExamplesForCategory(
  requestedCategory: string | null | undefined,
  options: GetGraphicsModuleExamplesOptions = {},
): Promise<{
  requestedCategory: string | null;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  /** True when Default examples were merged into one or more modules (seller view). */
  includesDefaultExamples: boolean;
  examples: GraphicsModuleExampleRow[];
}> {
  const categoryNames = await listProductCategoryNames();
  const known = new Set(categoryNames);
  const requested = requestedCategory?.trim() || null;
  const resolvedCategory = resolveCategoryName(requested, known);
  const usedDefaultFallback = Boolean(requested && requested !== resolvedCategory);

  const templates = await listEnabledImagePromptTemplates("graphics");
  const exampleRows = await db
    .select({
      id: graphicsModuleExamplesTable.id,
      templateSlug: graphicsModuleExamplesTable.templateSlug,
      exampleImageUrl: graphicsModuleExamplesTable.exampleImageUrl,
      displayOrder: graphicsModuleExamplesTable.displayOrder,
    })
    .from(graphicsModuleExamplesTable)
    .where(eq(graphicsModuleExamplesTable.productCategoryName, resolvedCategory))
    .orderBy(
      asc(graphicsModuleExamplesTable.templateSlug),
      asc(graphicsModuleExamplesTable.displayOrder),
      asc(graphicsModuleExamplesTable.id),
    );

  const bySlug = groupExampleImages(exampleRows);

  let defaultBySlug: Map<string, GraphicsModuleExampleImage[]> | null = null;
  if (
    options.mergeDefaultExamples &&
    resolvedCategory !== DEFAULT_GRAPHICS_PRODUCT_CATEGORY &&
    known.has(DEFAULT_GRAPHICS_PRODUCT_CATEGORY)
  ) {
    const defaultRows = await db
      .select({
        id: graphicsModuleExamplesTable.id,
        templateSlug: graphicsModuleExamplesTable.templateSlug,
        exampleImageUrl: graphicsModuleExamplesTable.exampleImageUrl,
        displayOrder: graphicsModuleExamplesTable.displayOrder,
      })
      .from(graphicsModuleExamplesTable)
      .where(eq(graphicsModuleExamplesTable.productCategoryName, DEFAULT_GRAPHICS_PRODUCT_CATEGORY))
      .orderBy(
        asc(graphicsModuleExamplesTable.templateSlug),
        asc(graphicsModuleExamplesTable.displayOrder),
        asc(graphicsModuleExamplesTable.id),
      );
    defaultBySlug = groupExampleImages(defaultRows);
  }

  let includesDefaultExamples = false;

  const examples: GraphicsModuleExampleRow[] = templates
    .filter((t) => t.slug !== "custom")
    .map((t) => {
      const categoryImages = bySlug.get(t.slug) ?? [];
      let exampleImages = categoryImages;
      if (defaultBySlug) {
        const { images, usedDefaultImages } = mergeCategoryAndDefaultImages(
          categoryImages,
          defaultBySlug.get(t.slug) ?? [],
        );
        exampleImages = images;
        if (usedDefaultImages) includesDefaultExamples = true;
      }
      return {
        templateSlug: t.slug,
        name: t.name,
        description: t.description,
        icon: (t.metadata as { icon?: string } | null)?.icon ?? null,
        exampleImages,
        exampleImageUrl: exampleImages[0]?.url ?? null,
        sortOrder: t.sortOrder,
      };
    });

  return {
    requestedCategory: requested,
    resolvedCategory,
    usedDefaultFallback,
    includesDefaultExamples,
    examples,
  };
}

/** Append a new example image for a category + graphics type (does not replace existing). */
export async function addGraphicsModuleExample(
  productCategoryName: string,
  templateSlug: string,
  exampleImageUrl: string,
): Promise<{ id: number }> {
  const category = productCategoryName.trim();
  const slug = templateSlug.trim().toLowerCase();
  const url = exampleImageUrl.trim();
  if (!category || !slug || !url) {
    throw new Error("Category, template slug, and image URL are required.");
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(graphicsModuleExamplesTable)
    .where(
      and(
        eq(graphicsModuleExamplesTable.productCategoryName, category),
        eq(graphicsModuleExamplesTable.templateSlug, slug),
      ),
    );

  if (count >= MAX_GRAPHICS_MODULE_EXAMPLES_PER_TYPE) {
    throw new Error(`At most ${MAX_GRAPHICS_MODULE_EXAMPLES_PER_TYPE} example images per module for this category.`);
  }

  const [maxOrder] = await db
    .select({ max: sql<number>`coalesce(max(${graphicsModuleExamplesTable.displayOrder}), -1)` })
    .from(graphicsModuleExamplesTable)
    .where(
      and(
        eq(graphicsModuleExamplesTable.productCategoryName, category),
        eq(graphicsModuleExamplesTable.templateSlug, slug),
      ),
    );

  const [inserted] = await db
    .insert(graphicsModuleExamplesTable)
    .values({
      productCategoryName: category,
      templateSlug: slug,
      exampleImageUrl: url,
      displayOrder: (maxOrder?.max ?? -1) + 1,
    })
    .returning({ id: graphicsModuleExamplesTable.id });

  return { id: inserted!.id };
}

/** @deprecated Use addGraphicsModuleExample — kept for callers that replace the only row. */
export async function upsertGraphicsModuleExample(
  productCategoryName: string,
  templateSlug: string,
  exampleImageUrl: string,
): Promise<void> {
  await addGraphicsModuleExample(productCategoryName, templateSlug, exampleImageUrl);
}

export async function deleteGraphicsModuleExampleById(id: number): Promise<void> {
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid example id.");
  await db.delete(graphicsModuleExamplesTable).where(eq(graphicsModuleExamplesTable.id, id));
}

export async function deleteGraphicsModuleExamplesForSlug(
  productCategoryName: string,
  templateSlug: string,
): Promise<void> {
  await db
    .delete(graphicsModuleExamplesTable)
    .where(
      and(
        eq(graphicsModuleExamplesTable.productCategoryName, productCategoryName.trim()),
        eq(graphicsModuleExamplesTable.templateSlug, templateSlug.trim().toLowerCase()),
      ),
    );
}

/** @deprecated Removes all examples for category + slug. */
export async function deleteGraphicsModuleExample(
  productCategoryName: string,
  templateSlug: string,
): Promise<void> {
  await deleteGraphicsModuleExamplesForSlug(productCategoryName, templateSlug);
}

export async function addProductCategory(name: string): Promise<{ id: number; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");
  if (trimmed.length > 120) throw new Error("Category name is too long.");

  const [inserted] = await db
    .insert(graphicsProductCategoriesTable)
    .values({
      name: trimmed,
      isSystem: 0,
      sortOrder: 500,
    })
    .returning({ id: graphicsProductCategoriesTable.id, name: graphicsProductCategoriesTable.name });

  return inserted;
}

export async function deleteCustomProductCategory(id: number): Promise<void> {
  const row = await db
    .select()
    .from(graphicsProductCategoriesTable)
    .where(eq(graphicsProductCategoriesTable.id, id))
    .limit(1);
  if (row.length === 0) throw new Error("Category not found.");
  if (row[0].isSystem === 1) throw new Error("System categories cannot be deleted.");
  if (row[0].name === DEFAULT_GRAPHICS_PRODUCT_CATEGORY) {
    throw new Error("The Default category cannot be deleted.");
  }

  await db
    .delete(graphicsModuleExamplesTable)
    .where(eq(graphicsModuleExamplesTable.productCategoryName, row[0].name));
  await db.delete(graphicsProductCategoriesTable).where(eq(graphicsProductCategoriesTable.id, id));
}
