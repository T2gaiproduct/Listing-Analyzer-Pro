import { pgTable, serial, text, boolean, integer, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";

export const cmsContent = pgTable("cms_content", {
  id: serial("id").primaryKey(),
  pageSlug: varchar("page_slug", { length: 100 }).notNull(),
  sectionKey: varchar("section_key", { length: 100 }).notNull(),
  fieldKey: varchar("field_key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content"),
  featuredImage: varchar("featured_image", { length: 500 }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  scheduledAt: timestamp("scheduled_at"),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  tags: text("tags").array().default([]),
  category: varchar("category", { length: 100 }),
  author: varchar("author", { length: 100 }),
  readMinutes: integer("read_minutes").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 100 }),
  company: varchar("company", { length: 100 }),
  avatar: varchar("avatar", { length: 500 }),
  content: text("content").notNull(),
  rating: integer("rating").default(5),
  isPublished: boolean("is_published").default(true),
  isVideo: boolean("is_video").default(false),
  videoUrl: varchar("video_url", { length: 500 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 100 }),
  isPublished: boolean("is_published").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seoSettings = pgTable("seo_settings", {
  id: serial("id").primaryKey(),
  pageSlug: varchar("page_slug", { length: 100 }).notNull().unique(),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  keywords: text("keywords"),
  ogTitle: varchar("og_title", { length: 255 }),
  ogDescription: text("og_description"),
  ogImage: varchar("og_image", { length: 500 }),
  schemaMarkup: text("schema_markup"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navItems = pgTable("nav_items", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  href: varchar("href", { length: 500 }).notNull(),
  location: varchar("location", { length: 20 }).default("header").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  isCta: boolean("is_cta").default(false),
  opensNewTab: boolean("opens_new_tab").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: serial("id").primaryKey(),
  formType: varchar("form_type", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 100 }),
  data: jsonb("data"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  size: integer("size"),
  folder: varchar("folder", { length: 100 }).default("general"),
  alt: varchar("alt", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cmsPages = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  scheduledAt: timestamp("scheduled_at"),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
