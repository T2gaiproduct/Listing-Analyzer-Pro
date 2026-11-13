/**
 * One-off: align account credit balances with active subscription plan (delta grant).
 * Usage: DATABASE_URL=... pnpm exec tsx scripts/sync-user-subscription-credits.ts karan.singh@tech2globe.in
 */
import { eq, ilike, or } from "drizzle-orm";
import { db, userProfilesTable, subscriptionsTable, plansTable, creditsTable } from "@workspace/db";
import { ensureSubscriptionCredits } from "../artifacts/api-server/src/lib/subscription-credits.js";
import { resolveSessionEmail } from "../artifacts/api-server/src/lib/admin-auth.js";

async function main(): Promise<void> {
  const needle = process.argv[2]?.trim();
  if (!needle) {
    console.error("Usage: tsx scripts/sync-user-subscription-credits.ts <email-or-user-id>");
    process.exit(1);
  }

  let userId: string | null = null;
  let profileEmail: string | null = null;

  if (needle.includes("@")) {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(
        or(
          ilike(userProfilesTable.loginEmail, needle),
          ilike(userProfilesTable.companyName, needle),
        ),
      )
      .limit(1);
    if (profile) {
      userId = profile.userId;
      profileEmail = profile.loginEmail ?? null;
    }
  }

  if (!userId) {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, needle))
      .limit(1);
    if (profile) {
      userId = profile.userId;
      profileEmail = profile.loginEmail ?? null;
    }
  }

  if (!userId) {
    console.error(`No user_profiles row for "${needle}". Use login email, company name, or Clerk user id.`);
    process.exit(1);
  }

  const resolved = await resolveSessionEmail(userId, profileEmail ? { email: profileEmail } : null);

  const [sub] = await db
    .select({
      status: subscriptionsTable.status,
      planName: plansTable.name,
      planImage: plansTable.imageCredits,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  const before = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const after = await ensureSubscriptionCredits(userId);

  console.log(
    JSON.stringify(
      {
        userId,
        email: resolved ?? profileEmail,
        subscription: sub ?? null,
        creditsBefore: before[0] ?? null,
        creditsAfter: after,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
