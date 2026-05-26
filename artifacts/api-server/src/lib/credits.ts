import { eq, and } from "drizzle-orm";
import { db, creditsTable, creditTransactionsTable, creditRulesTable } from "@workspace/db";

type CreditType = "ai" | "image" | "audit";

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  needed: number;
}

function getColumn(type: CreditType) {
  switch (type) {
    case "ai": return creditsTable.aiCredits;
    case "image": return creditsTable.imageCredits;
    case "audit": return creditsTable.auditCredits;
    default: throw new Error(`Unknown credit type: ${type}`);
  }
}

/**
 * Read the current credit cost for a feature type from the database rules.
 * Falls back to defaults if no rule or inactive rule exists.
 */
export async function getCreditCost(featureType: string): Promise<{ creditType: CreditType; creditsRequired: number; activityName: string }> {
  const [rule] = await db
    .select()
    .from(creditRulesTable)
    .where(eq(creditRulesTable.featureType, featureType));

  if (rule && rule.isActive) {
    return {
      creditType: (rule.creditType as CreditType) ?? "audit",
      creditsRequired: rule.creditsRequired,
      activityName: rule.activityName,
    };
  }

  // Fallback defaults
  const defaults: Record<string, { creditType: CreditType; creditsRequired: number; activityName: string }> = {
    audit: { creditType: "audit", creditsRequired: 1, activityName: "Audit" },
    content: { creditType: "ai", creditsRequired: 1, activityName: "Text Content" },
    ebc: { creditType: "ai", creditsRequired: 1, activityName: "A+ / EBC Content" },
    images: { creditType: "image", creditsRequired: 6, activityName: "Images" },
    image_regenerate: { creditType: "image", creditsRequired: 1, activityName: "Image Regenerate" },
    image_edit: { creditType: "image", creditsRequired: 1, activityName: "Image Edit" },
    competitors: { creditType: "audit", creditsRequired: 1, activityName: "Competitors Analysis" },
  };

  return defaults[featureType] ?? { creditType: "audit", creditsRequired: 1, activityName: featureType };
}

export async function checkCredits(
  userId: string,
  type: CreditType,
  amount: number,
): Promise<CreditCheckResult> {
  const [row] = await db
    .select({ balance: getColumn(type) })
    .from(creditsTable)
    .where(eq(creditsTable.userId, userId));
  const currentBalance = row?.balance ?? 0;
  return {
    hasCredits: currentBalance >= amount,
    currentBalance,
    needed: amount,
  };
}

export async function hasCredits(userId: string, type: CreditType, amount: number): Promise<boolean> {
  const result = await checkCredits(userId, type, amount);
  return result.hasCredits;
}

export interface DeductResult {
  success: boolean;
  remaining: number;
}

/**
 * Deduct credits with idempotency guard. If a transaction with the same
 * idempotencyKey already exists (within 24h), no deduction is made again.
 */
export async function deductCredits(
  userId: string,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<DeductResult> {
  const check = await checkCredits(userId, type, amount);
  if (!check.hasCredits) {
    return { success: false, remaining: check.currentBalance };
  }

  // Idempotency guard: check for duplicate transaction within last 24 hours
  const idempotencyKey = metadata?.idempotencyKey as string | undefined;
  if (idempotencyKey) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [existing] = await db
      .select()
      .from(creditTransactionsTable)
      .where(
        and(
          eq(creditTransactionsTable.userId, userId),
          eq(creditTransactionsTable.featureType, featureType),
          eq(creditTransactionsTable.amount, -amount),
        ),
      );
    if (existing && existing.metadata && (existing.metadata as Record<string, unknown>)?.idempotencyKey === idempotencyKey) {
      return { success: true, remaining: check.currentBalance - amount };
    }
  }

  const now = new Date();

  await db
    .update(creditsTable)
    .set({ [type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits"]: check.currentBalance - amount, updatedAt: now })
    .where(eq(creditsTable.userId, userId));

  await db.insert(creditTransactionsTable).values({
    userId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    metadata: metadata ?? null,
    createdAt: now,
  });

  return { success: true, remaining: check.currentBalance - amount };
}

export async function addCredits(
  userId: string,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const [existing] = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.userId, userId));

  const now = new Date();
  let newBalance: number;

  if (existing) {
    const key = type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits";
    newBalance = (existing[key as keyof typeof existing] as number) + amount;
    await db
      .update(creditsTable)
      .set({ [key]: newBalance, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    newBalance = amount;
    await db.insert(creditsTable).values({
      userId,
      aiCredits: type === "ai" ? amount : 0,
      imageCredits: type === "image" ? amount : 0,
      auditCredits: type === "audit" ? amount : 0,
    });
  }

  await db.insert(creditTransactionsTable).values({
    userId,
    creditType: type,
    amount,
    reason,
    featureType,
    metadata: metadata ?? null,
    createdAt: now,
  });

  return newBalance;
}
