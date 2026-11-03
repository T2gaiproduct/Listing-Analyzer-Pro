import { and, asc, eq } from "drizzle-orm";
import {
  db,
  graphicsModuleExamplesTable,
  graphicsProductCategoriesTable,
} from "@workspace/db";
import { DEFAULT_GRAPHICS_PRODUCT_CATEGORY } from "./amazon-category-seeds.js";
import { listEnabledImagePromptTemplates } from "./image-prompt-template-service.js";

export type GraphicsModuleExampleRow = {
  templateSlug: string;
  name: string;
  description: string | null;
  icon: string | null;
  exampleImageUrl: string | null;
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

export async function getGraphicsModuleExamplesForCategory(
  requestedCategory: string | null | undefined,
): Promise<{
  requestedCategory: string | null;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  examples: GraphicsModuleExampleRow[];
}> {
  const categoryNames = await listProductCategoryNames();
  const known = new Set(categoryNames);
  const requested = requestedCategory?.trim() || null;
  const resolvedCategory = resolveCategoryName(requested, known);
  const usedDefaultFallback = Boolean(requested && requested !== resolvedCategory);

  const templates = await listEnabledImagePromptTemplates("graphics");
  const exampleRows = await db
    .select()
    .from(graphicsModuleExamplesTable)
    .where(eq(graphicsModuleExamplesTable.productCategoryName, resolvedCategory));

  const bySlug = new Map(exampleRows.map((r) => [r.templateSlug, r.exampleImageUrl]));

  const examples: GraphicsModuleExampleRow[] = templates
    .filter((t) => t.slug !== "custom")
    .map((t) => ({
      templateSlug: t.slug,
      name: t.name,
      description: t.description,
      icon: (t.metadata as { icon?: string } | null)?.icon ?? null,
      exampleImageUrl: bySlug.get(t.slug) ?? null,
      sortOrder: t.sortOrder,
    }));

  return {
    requestedCategory: requested,
    resolvedCategory,
    usedDefaultFallback,
    examples,
  };
}

export async function upsertGraphicsModuleExample(
  productCategoryName: string,
  templateSlug: string,
  exampleImageUrl: string,
): Promise<void> {
  const category = productCategoryName.trim();
  const slug = templateSlug.trim().toLowerCase();
  const url = exampleImageUrl.trim();
  if (!category || !slug || !url) {
    throw new Error("Category, template slug, and image URL are required.");
  }

  const existing = await db
    .select({ id: graphicsModuleExamplesTable.id })
    .from(graphicsModuleExamplesTable)
    .where(
      and(
        eq(graphicsModuleExamplesTable.productCategoryName, category),
        eq(graphicsModuleExamplesTable.templateSlug, slug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(graphicsModuleExamplesTable)
      .set({ exampleImageUrl: url, updatedAt: new Date() })
      .where(eq(graphicsModuleExamplesTable.id, existing[0].id));
    return;
  }

  await db.insert(graphicsModuleExamplesTable).values({
    productCategoryName: category,
    templateSlug: slug,
    exampleImageUrl: url,
  });
}

export async function deleteGraphicsModuleExample(
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
