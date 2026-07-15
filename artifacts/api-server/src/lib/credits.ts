import { eq, and } from "drizzle-orm";
import { db, creditsTable, creditTransactionsTable, creditRulesTable, notificationsTable, memberCreditsTable, teamMembersTable } from "@workspace/db";

export type CreditType = "ai" | "image" | "audit";

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

function getMemberColumn(type: CreditType) {
  switch (type) {
    case "ai": return memberCreditsTable.aiCredits;
    case "image": return memberCreditsTable.imageCredits;
    case "audit": return memberCreditsTable.auditCredits;
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
    graphics: { creditType: "image", creditsRequired: 8, activityName: "Graphics" },
    graphics_edit: { creditType: "image", creditsRequired: 1, activityName: "Graphics Edit" },
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

  const remaining = check.currentBalance - amount;

  // Notify user when credits are depleted or running low
  if (remaining === 0) {
    await db.insert(notificationsTable).values({
      userId,
      type: "credit_depleted",
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Credits Depleted`,
      message: `You have used all your ${type} credits. Purchase more to continue using this feature.`,
      read: false,
    });
  } else if (remaining <= 5) {
    await db.insert(notificationsTable).values({
      userId,
      type: "credit_low",
      title: `Low ${type.charAt(0).toUpperCase() + type.slice(1)} Credits`,
      message: `Only ${remaining} ${type} credits remaining. Consider purchasing more to avoid interruptions.`,
      read: false,
    });
  }

  return { success: true, remaining };
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

// ─── Team-aware credit wrappers (auto-deduct from member credits if available) ───

export interface TeamAwareContext {
  userId: string;
  memberId?: number;
  ownerUserId?: string;
  isTeamMember: boolean;
}

export async function checkCreditsTeamAware(
  ctx: TeamAwareContext,
  type: CreditType,
  amount: number,
): Promise<CreditCheckResult> {
  if (ctx.isTeamMember && ctx.memberId != null) {
    const memberCheck = await checkMemberCredits(ctx.memberId, type, amount);
    if (memberCheck.hasCredits) return memberCheck;
    // Fall back to owner credits if member pool empty
    if (ctx.ownerUserId) {
      const ownerCheck = await checkCredits(ctx.ownerUserId, type, amount);
      return ownerCheck;
    }
    return memberCheck;
  }
  return checkCredits(ctx.userId, type, amount);
}

export async function hasCreditsTeamAware(
  ctx: TeamAwareContext,
  type: CreditType,
  amount: number,
): Promise<boolean> {
  const result = await checkCreditsTeamAware(ctx, type, amount);
  return result.hasCredits;
}

export async function deductCreditsTeamAware(
  ctx: TeamAwareContext,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<DeductResult> {
  if (ctx.isTeamMember && ctx.memberId != null) {
    const memberResult = await deductMemberCredits(ctx.memberId, type, amount, reason, featureType, metadata);
    if (memberResult.success) return memberResult;
    // Fall back to owner credits if member pool insufficient
    if (ctx.ownerUserId) {
      return deductCredits(ctx.ownerUserId, type, amount, reason, featureType, metadata);
    }
    return memberResult;
  }
  return deductCredits(ctx.userId, type, amount, reason, featureType, metadata);
}

// ─── Member credit functions (team members use allocated credits) ─────────────

export async function getMemberId(userId: string): Promise<number | null> {
  const [membership] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(
      and(
        eq(teamMembersTable.memberUserId, userId),
        eq(teamMembersTable.status, "active")
      )
    );
  return membership?.id ?? null;
}

export async function checkMemberCredits(
  memberId: number,
  type: CreditType,
  amount: number,
): Promise<CreditCheckResult> {
  const [row] = await db
    .select({ balance: getMemberColumn(type) })
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));
  const currentBalance = row?.balance ?? 0;
  return {
    hasCredits: currentBalance >= amount,
    currentBalance,
    needed: amount,
  };
}

export async function hasMemberCredits(memberId: number, type: CreditType, amount: number): Promise<boolean> {
  const result = await checkMemberCredits(memberId, type, amount);
  return result.hasCredits;
}

export async function deductMemberCredits(
  memberId: number,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<DeductResult> {
  const check = await checkMemberCredits(memberId, type, amount);
  if (!check.hasCredits) {
    return { success: false, remaining: check.currentBalance };
  }

  const key = type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits";
  const now = new Date();

  const [existing] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));

  if (existing) {
    await db
      .update(memberCreditsTable)
      .set({ [key]: check.currentBalance - amount, updatedAt: now })
      .where(eq(memberCreditsTable.memberId, memberId));
  } else {
    await db.insert(memberCreditsTable).values({
      memberId,
      aiCredits: type === "ai" ? check.currentBalance - amount : 0,
      imageCredits: type === "image" ? check.currentBalance - amount : 0,
      auditCredits: type === "audit" ? check.currentBalance - amount : 0,
    });
  }

  // Get userId for transaction record
  const [member] = await db
    .select({ memberUserId: teamMembersTable.memberUserId, ownerUserId: teamMembersTable.ownerUserId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, memberId));
  const userId = member?.memberUserId ?? member?.ownerUserId ?? "";

  await db.insert(creditTransactionsTable).values({
    userId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    metadata: metadata ?? null,
    createdAt: now,
  });

  const remaining = check.currentBalance - amount;
  return { success: true, remaining };
}

export async function addMemberCredits(
  memberId: number,
  type: CreditType,
  amount: number,
): Promise<number> {
  const [existing] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));

  const now = new Date();
  let newBalance: number;
  const key = type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits";

  if (existing) {
    newBalance = (existing[key as keyof typeof existing] as number) + amount;
    await db
      .update(memberCreditsTable)
      .set({ [key]: newBalance, updatedAt: now })
      .where(eq(memberCreditsTable.memberId, memberId));
  } else {
    newBalance = Math.max(0, amount);
    await db.insert(memberCreditsTable).values({
      memberId,
      aiCredits: type === "ai" ? newBalance : 0,
      imageCredits: type === "image" ? newBalance : 0,
      auditCredits: type === "audit" ? newBalance : 0,
    });
  }

  return newBalance;
}

export async function setMemberCredits(
  memberId: number,
  aiCredits: number,
  imageCredits: number,
  auditCredits: number,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));

  const now = new Date();
  if (existing) {
    await db
      .update(memberCreditsTable)
      .set({ aiCredits, imageCredits, auditCredits, updatedAt: now })
      .where(eq(memberCreditsTable.memberId, memberId));
  } else {
    await db.insert(memberCreditsTable).values({
      memberId,
      aiCredits,
      imageCredits,
      auditCredits,
    });
  }
}

export async function getMemberCredits(memberId: number): Promise<{ aiCredits: number; imageCredits: number; auditCredits: number } | null> {
  const [row] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));
  if (!row) return null;
  return { aiCredits: row.aiCredits, imageCredits: row.imageCredits, auditCredits: row.auditCredits };
}
