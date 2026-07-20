import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

export interface UserProfileFields {
  fullName?: string | null;
  companyName?: string | null;
  phone?: string | null;
  country?: string | null;
  gstNumber?: string | null;
  websiteUrl?: string | null;
  teamSize?: number | null;
  onboardingCompleted?: boolean;
  stripeCustomerId?: string | null;
}

export function hasRequiredProfileFields(fields: Pick<UserProfileFields, "fullName" | "companyName" | "country">): boolean {
  return Boolean(fields.fullName?.trim() && fields.companyName?.trim() && fields.country?.trim());
}

export async function upsertUserProfile(userId: string, fields: UserProfileFields) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.fullName !== undefined) updates.fullName = fields.fullName?.trim() || null;
  if (fields.companyName !== undefined) updates.companyName = fields.companyName?.trim() || null;
  if (fields.phone !== undefined) updates.phone = fields.phone?.trim() || null;
  if (fields.country !== undefined) updates.country = fields.country?.trim() || null;
  if (fields.gstNumber !== undefined) updates.gstNumber = fields.gstNumber?.trim() || null;
  if (fields.websiteUrl !== undefined) updates.websiteUrl = fields.websiteUrl?.trim() || null;
  if (fields.teamSize !== undefined) updates.teamSize = fields.teamSize ?? null;
  if (fields.onboardingCompleted !== undefined) updates.onboardingCompleted = fields.onboardingCompleted;
  if (fields.stripeCustomerId !== undefined) updates.stripeCustomerId = fields.stripeCustomerId;

  if (existing) {
    const [profile] = await db
      .update(userProfilesTable)
      .set(updates)
      .where(eq(userProfilesTable.userId, userId))
      .returning();
    return profile;
  }

  const [profile] = await db
    .insert(userProfilesTable)
    .values({ userId, ...updates })
    .returning();
  return profile;
}
