import { eq } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import { analyzeListingWithAI } from "./analyzer.js";
import {
  deductCreditsTeamAware,
  getCreditCost,
  hasCreditsTeamAware,
  type TeamAwareContext,
} from "./credits.js";

export function auditNeedsAnalysis(audit: {
  result?: unknown | null;
  overallScore?: number | null;
}): boolean {
  if (audit.result) return false;
  return (audit.overallScore ?? 0) <= 0;
}

export type RunListingAuditResult =
  | { status: "completed"; overallScore: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export async function runListingAuditForAuditId(
  auditId: number,
  creditCtx?: TeamAwareContext,
): Promise<RunListingAuditResult> {
  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);

  if (!audit) return { status: "skipped", reason: "Audit not found" };
  if (!auditNeedsAnalysis(audit)) return { status: "skipped", reason: "Already analyzed" };

  const title = audit.title?.trim() || audit.productName?.trim();
  if (!title) return { status: "skipped", reason: "Missing listing title" };

  if (creditCtx) {
    const cost = await getCreditCost("audit");
    const hasCredits = await hasCreditsTeamAware(creditCtx, cost.creditType, cost.creditsRequired);
    if (!hasCredits) {
      return { status: "skipped", reason: "Insufficient audit credits" };
    }
    await deductCreditsTeamAware(
      creditCtx,
      cost.creditType,
      cost.creditsRequired,
      cost.activityName,
      "audit",
      { auditId },
    );
  }

  try {
    await db
      .update(auditsTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(auditsTable.id, auditId));

    const result = await analyzeListingWithAI({
      title,
      bulletPoints: audit.bulletPoints ?? [],
      imageUrls: audit.imageUrls ?? [],
      targetKeywords: audit.targetKeywords ?? [],
      category: audit.category ?? undefined,
    });

    await db
      .update(auditsTable)
      .set({
        result,
        overallScore: result.overallScore,
        status: "complete",
        updatedAt: new Date(),
      })
      .where(eq(auditsTable.id, auditId));

    return { status: "completed", overallScore: result.overallScore };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(auditsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(auditsTable.id, auditId));
    return { status: "failed", error: errMsg };
  }
}

export async function runListingAuditsInBackground(
  auditIds: number[],
  creditCtx?: TeamAwareContext,
): Promise<{ completed: number; failed: number; skipped: number }> {
  const summary = { completed: 0, failed: 0, skipped: 0 };

  for (const auditId of auditIds) {
    const outcome = await runListingAuditForAuditId(auditId, creditCtx);
    if (outcome.status === "completed") {
      summary.completed += 1;
    } else if (outcome.status === "failed") {
      summary.failed += 1;
    } else {
      summary.skipped += 1;
      if (outcome.reason === "Insufficient audit credits") break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return summary;
}
