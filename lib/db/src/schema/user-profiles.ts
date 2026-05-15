import { pgTable, text, serial, boolean, timestamp, varchar } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  fullName: varchar("full_name", { length: 200 }),
  companyName: varchar("company_name", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
