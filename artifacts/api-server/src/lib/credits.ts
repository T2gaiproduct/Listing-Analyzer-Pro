import { eq, and, gte, sql } from "drizzle-orm";
import { db, creditsTable, creditTransactionsTable, creditRulesTable, memberCreditsTable, teamMembersTable } from "@workspace/db";
import { createNotification } from "./notifications";
import {
  deductWorkspaceMemberCredits,
  deductWorkspacePoolForOwner,
  getWorkspaceCredits,
  getWorkspaceMemberCredits,
  resolveWorkspaceMemberIdForTeamMember,
  setWorkspaceMemberCredits,
} from "./workspace-credits.js";

export type CreditType = "ai" | "image" | "audit";

/** Admin credit rules may use shorthand keys (ai, img) alongside canonical API keys (content, graphics). */
export const CREDIT_RULE_FEATURE_ALIASES: Record<string, string[]> = {
  audit: ["audit"],
  content: ["content", "ai"],
  ai: ["content", "ai"],
  graphics: ["graphics", "img", "images"],
  images: ["graphics", "img", "images"],
  img: ["graphics", "img", "images"],
  ebc: ["ebc"],
  competitors: ["competitors"],
};

export function creditRuleLookupTypes(featureType: string): string[] {
  return CREDIT_RULE_FEATURE_ALIASES[featureType] ?? [featureType];
}

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
  for (const lookupType of creditRuleLookupTypes(featureType)) {
    const [rule] = await db
      .select()
      .from(creditRulesTable)
      .where(eq(creditRulesTable.featureType, lookupType));

    if (rule && rule.isActive) {
      return {
        creditType: (rule.creditType as CreditType) ?? "audit",
        creditsRequired: rule.creditsRequired,
        activityName: rule.activityName,
      };
    }
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
  const balanceColumn = getColumn(type);

  const [updated] = await db
    .update(creditsTable)
    .set({
      [type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits"]:
        sql`${balanceColumn} - ${amount}`,
      updatedAt: now,
    })
    .where(and(eq(creditsTable.userId, userId), gte(balanceColumn, amount)))
    .returning({ balance: balanceColumn });

  if (!updated) {
    return { success: false, remaining: check.currentBalance };
  }

  await db.insert(creditTransactionsTable).values({
    userId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    metadata: metadata ?? null,
    createdAt: now,
  });

  const remaining = updated.balance;

  // Notify user when credits are depleted or running low (in-app + SMTP email)
  if (remaining === 0) {
    await createNotification({
      userId,
      type: "credit_depleted",
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Credits Depleted`,
      message: `You have used all your ${type} credits. Purchase more to continue using this feature.`,
      link: "/billing",
    });
  } else if (remaining <= 5) {
    await createNotification({
      userId,
      type: "credit_low",
      title: `Low ${type.charAt(0).toUpperCase() + type.slice(1)} Credits`,
      message: `Only ${remaining} ${type} credits remaining. Consider purchasing more to avoid interruptions.`,
      link: "/billing",
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
  workspaceId?: number;
  workspaceMemberId?: number;
  isAccountOwner?: boolean;
  isDefaultWorkspace?: boolean;
}

async function resolveWorkspaceMemberId(ctx: TeamAwareContext): Promise<number | null> {
  if (ctx.workspaceMemberId != null) return ctx.workspaceMemberId;
  if (ctx.memberId != null && ctx.workspaceId != null) {
    return resolveWorkspaceMemberIdForTeamMember(ctx.memberId, ctx.workspaceId);
  }
  return null;
}

export async function checkCreditsTeamAware(
  ctx: TeamAwareContext,
  type: CreditType,
  amount: number,
): Promise<CreditCheckResult> {
  const wmId = await resolveWorkspaceMemberId(ctx);
  if (wmId != null && ctx.workspaceId != null) {
    const memberCredits = await getWorkspaceMemberCredits(wmId);
    const currentBalance = memberCredits?.[type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits"] ?? 0;
    return { hasCredits: currentBalance >= amount, currentBalance, needed: amount };
  }

  if (ctx.workspaceId != null && !ctx.isTeamMember && !ctx.isDefaultWorkspace) {
    const pool = await getWorkspaceCredits(ctx.workspaceId);
    const currentBalance = pool[type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits"];
    return { hasCredits: currentBalance >= amount, currentBalance, needed: amount };
  }

  if (ctx.isTeamMember && ctx.memberId != null) {
    return checkMemberCredits(ctx.memberId, type, amount, ctx.workspaceId);
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
  const wmId = await resolveWorkspaceMemberId(ctx);
  if (wmId != null && ctx.workspaceId != null) {
    return deductWorkspaceMemberCredits(
      wmId,
      ctx.workspaceId,
      ctx.userId,
      type,
      amount,
      reason,
      featureType,
      metadata,
    );
  }

  if (ctx.workspaceId != null && !ctx.isTeamMember && !ctx.isDefaultWorkspace) {
    return deductWorkspacePoolForOwner(
      ctx.workspaceId,
      ctx.userId,
      type,
      amount,
      reason,
      featureType,
      metadata,
    );
  }

  if (ctx.isTeamMember && ctx.memberId != null) {
    return deductMemberCredits(ctx.memberId, type, amount, reason, featureType, metadata, ctx.workspaceId);
  }
  return deductCredits(ctx.userId, type, amount, reason, featureType, metadata);
}

/**
 * Deduct from the workspace owner's balance but attribute the transaction to the acting member.
 */
export async function deductOwnerCreditsForMember(
  ownerUserId: string,
  actorUserId: string,
  memberId: number,
  type: CreditType,
  amount: number,
  reason: string,
  featureType: string,
  metadata?: Record<string, unknown>,
): Promise<DeductResult> {
  const check = await checkCredits(ownerUserId, type, amount);
  if (!check.hasCredits) {
    return { success: false, remaining: check.currentBalance };
  }

  const now = new Date();
  const key = type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits";

  await db
    .update(creditsTable)
    .set({ [key]: check.currentBalance - amount, updatedAt: now })
    .where(eq(creditsTable.userId, ownerUserId));

  await db.insert(creditTransactionsTable).values({
    userId: actorUserId,
    creditType: type,
    amount: -amount,
    reason,
    featureType,
    metadata: { ...(metadata ?? {}), chargedFrom: "owner_pool", ownerUserId, memberId },
    createdAt: now,
  });

  const remaining = check.currentBalance - amount;
  return { success: true, remaining };
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
  workspaceId?: number,
): Promise<CreditCheckResult> {
  if (workspaceId != null) {
    const wmId = await resolveWorkspaceMemberIdForTeamMember(memberId, workspaceId);
    if (wmId != null) {
      const row = await getWorkspaceMemberCredits(wmId);
      const currentBalance = row?.[type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits"] ?? 0;
      return { hasCredits: currentBalance >= amount, currentBalance, needed: amount };
    }
  }

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
  workspaceId?: number,
): Promise<DeductResult> {
  if (workspaceId != null) {
    const wmId = await resolveWorkspaceMemberIdForTeamMember(memberId, workspaceId);
    if (wmId != null) {
      const [member] = await db
        .select({ memberUserId: teamMembersTable.memberUserId })
        .from(teamMembersTable)
        .where(eq(teamMembersTable.id, memberId));
      const userId = member?.memberUserId ?? "";
      return deductWorkspaceMemberCredits(wmId, workspaceId, userId, type, amount, reason, featureType, metadata);
    }
  }

  const check = await checkMemberCredits(memberId, type, amount, workspaceId);
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
    return { success: false, remaining: 0 };
  }

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
    workspaceId,
    metadata: { ...(metadata ?? {}), chargedFrom: "member_pool_legacy", memberId },
    createdAt: now,
  });

  return { success: true, remaining: check.currentBalance - amount };
}

export async function addMemberCredits(
  memberId: number,
  type: CreditType,
  amount: number,
  workspaceId: number,
): Promise<number> {
  const workspaceMemberId = await resolveWorkspaceMemberIdForTeamMember(memberId, workspaceId);
  if (workspaceMemberId == null) {
    throw new Error("Workspace member not found for team member");
  }

  const current = await getWorkspaceMemberCredits(workspaceMemberId) ?? {
    aiCredits: 0,
    imageCredits: 0,
    auditCredits: 0,
  };
  const key = type === "ai" ? "aiCredits" : type === "image" ? "imageCredits" : "auditCredits";
  const newBalance = Math.max(0, current[key] + amount);
  const updated = await setWorkspaceMemberCredits(
    workspaceId,
    workspaceMemberId,
    memberId,
    type === "ai" ? newBalance : current.aiCredits,
    type === "image" ? newBalance : current.imageCredits,
    type === "audit" ? newBalance : current.auditCredits,
  );
  return updated[key];
}

export async function setMemberCredits(
  memberId: number,
  aiCredits: number,
  imageCredits: number,
  auditCredits: number,
  workspaceId: number,
): Promise<void> {
  const workspaceMemberId = await resolveWorkspaceMemberIdForTeamMember(memberId, workspaceId);
  if (workspaceMemberId == null) {
    throw new Error("Workspace member not found for team member");
  }
  await setWorkspaceMemberCredits(
    workspaceId,
    workspaceMemberId,
    memberId,
    aiCredits,
    imageCredits,
    auditCredits,
  );
}

export async function getMemberCredits(
  memberId: number,
  workspaceId?: number,
): Promise<{ aiCredits: number; imageCredits: number; auditCredits: number } | null> {
  if (workspaceId != null) {
    const wmId = await resolveWorkspaceMemberIdForTeamMember(memberId, workspaceId);
    if (wmId != null) {
      return getWorkspaceMemberCredits(wmId);
    }
  }

  const [row] = await db
    .select()
    .from(memberCreditsTable)
    .where(eq(memberCreditsTable.memberId, memberId));
  if (!row) return null;
  return { aiCredits: row.aiCredits, imageCredits: row.imageCredits, auditCredits: row.auditCredits };
}
