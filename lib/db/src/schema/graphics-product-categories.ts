import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const graphicsProductCategoriesTable = pgTable("graphics_product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isSystem: integer("is_system").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const graphicsModuleExamplesTable = pgTable(
  "graphics_module_examples",
  {
    id: serial("id").primaryKey(),
    productCategoryName: text("product_category_name").notNull(),
    templateSlug: text("template_slug").notNull(),
    exampleImageUrl: text("example_image_url").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    categorySlugUnique: uniqueIndex("graphics_module_examples_category_slug_uidx").on(
      table.productCategoryName,
      table.templateSlug,
    ),
  }),
);

export const insertGraphicsProductCategorySchema = createInsertSchema(graphicsProductCategoriesTable).omit({
  id: true,
  createdAt: true,
});

export const insertGraphicsModuleExampleSchema = createInsertSchema(graphicsModuleExamplesTable).omit({
  id: true,
  updatedAt: true,
});

export type GraphicsProductCategory = typeof graphicsProductCategoriesTable.$inferSelect;
export type GraphicsModuleExample = typeof graphicsModuleExamplesTable.$inferSelect;
export type InsertGraphicsProductCategory = z.infer<typeof insertGraphicsProductCategorySchema>;
export type InsertGraphicsModuleExample = z.infer<typeof insertGraphicsModuleExampleSchema>;
