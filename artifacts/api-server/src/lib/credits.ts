import { eq } from "drizzle-orm";
import { db, creditsTable, creditTransactionsTable } from "@workspace/db";

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

  const col = getColumn(type);
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
