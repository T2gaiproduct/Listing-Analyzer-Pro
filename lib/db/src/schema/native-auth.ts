import { pgTable, text, timestamp, varchar, integer } from "drizzle-orm/pg-core";

/** Local credentials keyed by existing Clerk-style user_id (preserved on import). */
export const authCredentialsTable = pgTable("auth_credentials", {
  userId: text("user_id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: integer("email_verified").notNull().default(0),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authOauthIdentitiesTable = pgTable("auth_oauth_identities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authSessionsTable = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authPasswordResetTokensTable = pgTable("auth_password_reset_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Short-lived 6-digit email verification codes (sign-up / unverified sign-in). */
export const authEmailVerificationCodesTable = pgTable("auth_email_verification_codes", {
  userId: text("user_id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuthCredential = typeof authCredentialsTable.$inferSelect;
export type AuthSession = typeof authSessionsTable.$inferSelect;
