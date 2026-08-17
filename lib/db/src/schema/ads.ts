import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const AD_STATUS = ["draft", "active", "paused", "completed", "failed"] as const;
export type AdStatus = (typeof AD_STATUS)[number];

export const ADS_KEYWORD_MATCH_TYPES = ["EXACT", "PHRASE", "BROAD"] as const;
export type AdsKeywordMatchType = (typeof ADS_KEYWORD_MATCH_TYPES)[number];

export const adsKeywordEntrySchema = z.object({
  keyword: z.string(),
  matchType: z.enum(ADS_KEYWORD_MATCH_TYPES),
  score: z.number(),
  sources: z.array(z.string()),
  suggestedBidCents: z.number().optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  orders: z.number().optional(),
  costCents: z.number().optional(),
  selected: z.boolean(),
  aiNote: z.string().optional(),
});

export const adsSourcesSnapshotSchema = z.object({
  amazonRecommendations: z.array(z.object({
    keyword: z.string(),
    suggestedBidCents: z.number().optional(),
    rank: z.number().optional(),
  })).optional(),
  existingCampaignKeywords: z.array(z.object({
    keyword: z.string(),
    matchType: z.string().optional(),
    campaignId: z.string().optional(),
    adGroupId: z.string().optional(),
    impressions: z.number().optional(),
    clicks: z.number().optional(),
  })).optional(),
  searchTermReport: z.array(z.object({
    searchTerm: z.string(),
    impressions: z.number().optional(),
    clicks: z.number().optional(),
    orders: z.number().optional(),
    costCents: z.number().optional(),
  })).optional(),
  listingKeywords: z.array(z.string()).optional(),
  productTitle: z.string().optional(),
  productBullets: z.array(z.string()).optional(),
  gatheredAt: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

export type AdsKeywordEntry = z.infer<typeof adsKeywordEntrySchema>;
export type AdsSourcesSnapshot = z.infer<typeof adsSourcesSnapshotSchema>;

export const adsProjectsTable = pgTable("ads_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  workspaceId: integer("workspace_id"),
  teamId: text("team_id"),
  auditId: integer("audit_id"),
  name: text("name").notNull().default("Untitled Campaign"),
  productName: text("product_name").notNull(),
  category: text("category"),
  asin: text("asin"),
  status: text("status").notNull().default("draft"),
  platform: text("platform").notNull().default("amazon"),
  currentStep: integer("current_step").notNull().default(1),
  amazonProfileId: text("amazon_profile_id"),
  amazonCampaignId: text("amazon_campaign_id"),
  amazonAdGroupId: text("amazon_ad_group_id"),
  dailyBudgetCents: integer("daily_budget_cents"),
  budget: integer("budget"),
  spend: integer("spend").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  targeting: jsonb("targeting").$type<string[]>(),
  keywordData: jsonb("keyword_data").$type<AdsKeywordEntry[]>(),
  sourcesSnapshot: jsonb("sources_snapshot").$type<AdsSourcesSnapshot>(),
  creativeUrls: jsonb("creative_urls").$type<string[]>(),
  errorMessage: text("error_message"),
  isDeleted: integer("is_deleted").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdsProjectSchema = createInsertSchema(adsProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdsProject = z.infer<typeof insertAdsProjectSchema>;
export type AdsProject = typeof adsProjectsTable.$inferSelect;
