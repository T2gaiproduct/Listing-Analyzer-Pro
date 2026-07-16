import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, count, sql, desc, gte, lte, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
  creditTransactionsTable,
  creditsTable,
  userProfilesTable,
  subscriptionsTable,
  plansTable,
  teamMembersTable,
  type AuditResult,
} from "@workspace/db";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import { getMemberCredits } from "../lib/credits";
import { getMemberWorkedProjects } from "../lib/member-projects";
import { sumAllocatedCreditsForOwner, sumCreditsUsedInPeriod } from "../lib/team-stats";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

const AI_FEATURE_TYPES = new Set([
  "audit",
  "content",
  "ebc",
  "images",
  "graphics",
  "graphics_edit",
  "image_regenerate",
  "image_edit",
  "competitors",
  "videos",
  "ads",
]);

/** Estimated minutes saved per completed AI task type. */
const AI_TASK_MINUTES: Record<string, number> = {
  audit: 15,
  content: 10,
  ebc: 12,
  images: 25,
  graphics: 20,
  graphics_edit: 5,
  image_regenerate: 5,
  image_edit: 5,
  competitors: 10,
  videos: 30,
  ads: 15,
};

const NON_AI_FEATURE_TYPES = new Set([
  "subscription",
  "admin_adjustment",
  "credit_purchase",
  "purchase",
]);

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function getOwnerId(req: Request): string {
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isAiTask(featureType: string | null): boolean {
  if (!featureType || NON_AI_FEATURE_TYPES.has(featureType)) return false;
  return AI_FEATURE_TYPES.has(featureType);
}

function minutesForAiTask(featureType: string): number {
  return AI_TASK_MINUTES[featureType] ?? 10;
}

function countIssuesInResult(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const r = result as AuditResult;
  const sections = [r.titleScore, r.bulletScore, r.imageScore, r.keywordScore];
  return sections.reduce((sum, sec) => sum + (sec?.issues?.length ?? 0), 0);
}

function auditStatusLabel(status: string, overallScore: number | null): string {
  if (status === "pending" || status === "draft") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "archived") return "Archived";
  if (overallScore != null && overallScore >= 70) return "High Score";
  if (overallScore != null && overallScore < 50) return "Needs Work";
  return "Completed";
}

function projectStatusLabel(type: string, status: string, overallScore?: number | null): string {
  if (type === "audit" || type === "listing") {
    return auditStatusLabel(status, overallScore ?? null);
  }
  if (status === "generating" || status === "processing" || status === "draft") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "completed") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function typeLabel(type: string): string {
  switch (type) {
    case "audit": return "Audit Listing";
    case "listing": return "Build Your Brand";
    case "graphics": return "Create Graphics";
    case "video": return "Create Videos";
    case "ads": return "Manage Ads";
    default: return "Project";
  }
}

function statusBadgeColor(label: string): "orange" | "green" | "blue" | "red" | "gray" {
  if (label === "Needs Work") return "orange";
  if (label === "High Score" || label === "Completed") return "green";
  if (label === "In Progress") return "blue";
  if (label === "Failed") return "red";
  return "gray";
}

async function countProjectsSaved(ownerId: string): Promise<number> {
  const [auditCount, graphicsCount, videosCount, adsCount] = await Promise.all([
    db.select({ c: count() }).from(auditsTable)
      .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), sql`${auditsTable.status} != 'archived'`)),
    db.select({ c: count() }).from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, ownerId), eq(graphicsProjectsTable.isDeleted, 0), sql`${graphicsProjectsTable.status} != 'archived'`)),
    db.select({ c: count() }).from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, ownerId), eq(videosProjectsTable.isDeleted, 0), sql`${videosProjectsTable.status} != 'archived'`)),
    db.select({ c: count() }).from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, ownerId), eq(adsProjectsTable.isDeleted, 0), sql`${adsProjectsTable.status} != 'archived'`)),
  ]);
  return Number(auditCount[0]?.c ?? 0) + Number(graphicsCount[0]?.c ?? 0)
    + Number(videosCount[0]?.c ?? 0) + Number(adsCount[0]?.c ?? 0);
}

async function countProjectsCreatedSince(ownerId: string, since: Date): Promise<number> {
  const [auditCount, graphicsCount, videosCount, adsCount] = await Promise.all([
    db.select({ c: count() }).from(auditsTable)
      .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), sql`${auditsTable.status} != 'archived'`, gte(auditsTable.createdAt, since))),
    db.select({ c: count() }).from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, ownerId), eq(graphicsProjectsTable.isDeleted, 0), sql`${graphicsProjectsTable.status} != 'archived'`, gte(graphicsProjectsTable.createdAt, since))),
    db.select({ c: count() }).from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, ownerId), eq(videosProjectsTable.isDeleted, 0), sql`${videosProjectsTable.status} != 'archived'`, gte(videosProjectsTable.createdAt, since))),
    db.select({ c: count() }).from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, ownerId), eq(adsProjectsTable.isDeleted, 0), sql`${adsProjectsTable.status} != 'archived'`, gte(adsProjectsTable.createdAt, since))),
  ]);
  return Number(auditCount[0]?.c ?? 0) + Number(graphicsCount[0]?.c ?? 0)
    + Number(videosCount[0]?.c ?? 0) + Number(adsCount[0]?.c ?? 0);
}

function computeTimeSavedHours(transactions: { featureType: string | null; amount: number; createdAt: Date }[], start: Date, end: Date): number {
  let minutes = 0;
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    if (!isAiTask(tx.featureType)) continue;
    const at = new Date(tx.createdAt);
    if (at < start || at > end) continue;
    minutes += minutesForAiTask(tx.featureType!);
  }
  return Math.round((minutes / 60) * 10) / 10;
}

router.get("/dashboard", requireAuth, resolveTeam, async (req: Request, res: Response): Promise<void> => {
  try {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getOwnerId(req);
  const team = (req as TeamAuthedRequest).team;

  const now = new Date();
  const defaultStart = startOfMonth(now);
  const defaultEnd = endOfMonth(now);

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [subRow] = await db.select({
    currentPeriodStart: subscriptionsTable.currentPeriodStart,
    currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
    planAiCredits: plansTable.aiCredits,
    planImageCredits: plansTable.imageCredits,
    planAuditCredits: plansTable.auditCredits,
    creditAllocations: plansTable.creditAllocations,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, ownerId));

  const periodStart = subRow?.currentPeriodStart ? new Date(subRow.currentPeriodStart) : defaultStart;
  const periodEnd = subRow?.currentPeriodEnd ? new Date(subRow.currentPeriodEnd) : defaultEnd;

  const filterStart = parseDate(req.query.start as string | undefined, periodStart);
  const filterEnd = parseDate(req.query.end as string | undefined, periodEnd);
  filterEnd.setHours(23, 59, 59, 999);

  const weekStart = startOfWeek(now);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setMilliseconds(-1);

  const transactionUserIds = [ownerId];
  if (userId !== ownerId) transactionUserIds.push(userId);

  const memberWorked = team?.isTeamMember ? await getMemberWorkedProjects(userId, team) : null;

  const [
    projectsSaved,
    projectsThisWeek,
    totalAuditsRow,
    auditsThisWeek,
    auditsPrevWeek,
    allTransactions,
    ownerCredits,
    auditsThisWeekRows,
    recentAudits,
    recentGraphics,
    recentVideos,
    recentAds,
  ] = await Promise.all([
    countProjectsSaved(ownerId),
    countProjectsCreatedSince(ownerId, weekStart),
    db.select({ c: count() }).from(auditsTable)
      .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0))),
    db.select({ c: count() }).from(auditsTable)
      .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), gte(auditsTable.createdAt, weekStart))),
    db.select({ c: count() }).from(auditsTable)
      .where(and(eq(auditsTable.userId, ownerId), eq(auditsTable.isDeleted, 0), gte(auditsTable.createdAt, prevWeekStart), lte(auditsTable.createdAt, prevWeekEnd))),
    db.select({
      featureType: creditTransactionsTable.featureType,
      amount: creditTransactionsTable.amount,
      createdAt: creditTransactionsTable.createdAt,
    }).from(creditTransactionsTable)
      .where(inArray(creditTransactionsTable.userId, transactionUserIds)),
    db.select().from(creditsTable).where(eq(creditsTable.userId, ownerId)),
    db.select({
      id: auditsTable.id,
      status: auditsTable.status,
      result: auditsTable.result,
    }).from(auditsTable)
      .where(and(
        eq(auditsTable.userId, ownerId),
        eq(auditsTable.isDeleted, 0),
        gte(auditsTable.createdAt, weekStart),
      )),
    team?.isTeamMember && (memberWorked?.auditIds.length ?? 0) === 0
      ? Promise.resolve([])
      : db.select({
          id: auditsTable.id,
          name: auditsTable.projectName,
          productName: auditsTable.productName,
          asin: auditsTable.asin,
          status: auditsTable.status,
          overallScore: auditsTable.overallScore,
          createdAt: auditsTable.createdAt,
        }).from(auditsTable)
          .where(and(
            eq(auditsTable.userId, ownerId),
            eq(auditsTable.isDeleted, 0),
            sql`${auditsTable.status} != 'archived'`,
            ...(team?.isTeamMember && memberWorked ? [inArray(auditsTable.id, memberWorked.auditIds)] : []),
          ))
          .orderBy(desc(auditsTable.createdAt))
          .limit(5),
    team?.isTeamMember && (memberWorked?.graphicsIds.length ?? 0) === 0
      ? Promise.resolve([])
      : db.select({
          id: graphicsProjectsTable.id,
          name: graphicsProjectsTable.name,
          status: graphicsProjectsTable.status,
          createdAt: graphicsProjectsTable.createdAt,
        }).from(graphicsProjectsTable)
          .where(and(
            eq(graphicsProjectsTable.userId, ownerId),
            eq(graphicsProjectsTable.isDeleted, 0),
            sql`${graphicsProjectsTable.status} != 'archived'`,
            sql`${graphicsProjectsTable.auditId} IS NULL`,
            ...(team?.isTeamMember && memberWorked ? [inArray(graphicsProjectsTable.id, memberWorked.graphicsIds)] : []),
          ))
          .orderBy(desc(graphicsProjectsTable.createdAt))
          .limit(5),
    team?.isTeamMember && (memberWorked?.videoIds.length ?? 0) === 0
      ? Promise.resolve([])
      : db.select({
          id: videosProjectsTable.id,
          name: videosProjectsTable.name,
          status: videosProjectsTable.status,
          createdAt: videosProjectsTable.createdAt,
        }).from(videosProjectsTable)
          .where(and(
            eq(videosProjectsTable.userId, ownerId),
            eq(videosProjectsTable.isDeleted, 0),
            sql`${videosProjectsTable.status} != 'archived'`,
            ...(team?.isTeamMember && memberWorked ? [inArray(videosProjectsTable.id, memberWorked.videoIds)] : []),
          ))
          .orderBy(desc(videosProjectsTable.createdAt))
          .limit(5),
    team?.isTeamMember && (memberWorked?.adsIds.length ?? 0) === 0
      ? Promise.resolve([])
      : db.select({
          id: adsProjectsTable.id,
          name: adsProjectsTable.name,
          status: adsProjectsTable.status,
          createdAt: adsProjectsTable.createdAt,
        }).from(adsProjectsTable)
          .where(and(
            eq(adsProjectsTable.userId, ownerId),
            eq(adsProjectsTable.isDeleted, 0),
            sql`${adsProjectsTable.status} != 'archived'`,
            ...(team?.isTeamMember && memberWorked ? [inArray(adsProjectsTable.id, memberWorked.adsIds)] : []),
          ))
          .orderBy(desc(adsProjectsTable.createdAt))
          .limit(5),
  ]);

  const totalAudits = Number(totalAuditsRow[0]?.c ?? 0);
  const auditsWeekCount = Number(auditsThisWeek[0]?.c ?? 0);
  const auditsPrevWeekCount = Number(auditsPrevWeek[0]?.c ?? 0);
  const auditsWeekOverWeekPct = auditsPrevWeekCount > 0
    ? Math.round(((auditsWeekCount - auditsPrevWeekCount) / auditsPrevWeekCount) * 100)
    : auditsWeekCount > 0 ? 100 : 0;

  type CreditBalances = { aiCredits: number; imageCredits: number; auditCredits: number };
  const zeroCredits: CreditBalances = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

  let displayCredits: CreditBalances;
  let creditsAllowance: number;

  if (team?.isTeamMember && team.memberId) {
    const memberCredits = await getMemberCredits(team.memberId);
    displayCredits = memberCredits ?? zeroCredits;
    creditsAllowance =
      displayCredits.auditCredits + displayCredits.aiCredits + displayCredits.imageCredits;
  } else {
    displayCredits = ownerCredits[0]
      ? {
          aiCredits: ownerCredits[0].aiCredits,
          imageCredits: ownerCredits[0].imageCredits,
          auditCredits: ownerCredits[0].auditCredits,
        }
      : zeroCredits;
    const alloc = (subRow?.creditAllocations ?? {}) as Record<string, number>;
    creditsAllowance = (alloc.audit ?? subRow?.planAuditCredits ?? 0)
      + (alloc.content ?? subRow?.planAiCredits ?? 0)
      + (alloc.images ?? subRow?.planImageCredits ?? 0)
      + (alloc.ebc ?? 0)
      + (alloc.competitors ?? 0);
    if (creditsAllowance <= 0) {
      creditsAllowance =
        displayCredits.auditCredits + displayCredits.aiCredits + displayCredits.imageCredits;
    }
  }

  const creditsBalance = displayCredits.auditCredits + displayCredits.aiCredits + displayCredits.imageCredits;

  let teamCreditsUsedInPeriod = 0;
  let memberCreditsAllocated = 0;
  if (!team?.isTeamMember) {
    const activeMembers = await db
      .select({ memberUserId: teamMembersTable.memberUserId })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "active")));
    for (const m of activeMembers) {
      if (m.memberUserId) {
        teamCreditsUsedInPeriod += await sumCreditsUsedInPeriod(m.memberUserId, periodStart, periodEnd);
      }
    }
    const allocated = await sumAllocatedCreditsForOwner(userId);
    memberCreditsAllocated = allocated.aiCredits + allocated.imageCredits + allocated.auditCredits;
  }

  const timeSavedHours = computeTimeSavedHours(allTransactions, filterStart, filterEnd);
  const timeSavedThisWeek = computeTimeSavedHours(allTransactions, weekStart, now);

  const impactListingsOptimized = auditsThisWeekRows.filter((a) => a.status === "complete").length;
  const impactIssuesIdentified = auditsThisWeekRows.reduce((sum, a) => sum + countIssuesInResult(a.result), 0);

  const creditSegments = [
    { key: "audit", label: "Audit Credits", balance: displayCredits.auditCredits, color: "#f97316" },
    { key: "graphic", label: "Graphic Credits", balance: displayCredits.imageCredits, color: "#1e293b" },
    { key: "brand", label: "Brand Credits", balance: displayCredits.aiCredits, color: "#94a3b8" },
  ];
  if (!team?.isTeamMember) {
    creditSegments.push(
      { key: "video", label: "Video Credits", balance: 0, color: "#475569" },
      { key: "ad", label: "Ad Credits", balance: 0, color: "#64748b" },
    );
  }
  const breakdownSegments = team?.isTeamMember
    ? creditSegments.filter((seg) => seg.balance > 0)
    : creditSegments;
  const segmentTotal = breakdownSegments.reduce((s, seg) => s + seg.balance, 0) || 1;
  const creditBreakdown = breakdownSegments.map((seg) => ({
    ...seg,
    pct: Math.round((seg.balance / segmentTotal) * 100),
  }));

  const recentProjects = [
    ...recentAudits.map((a) => {
      const type = a.asin ? "audit" as const : "listing" as const;
      const statusLabel = projectStatusLabel(type, a.status, a.overallScore);
      return {
        type,
        id: a.id,
        name: a.name || a.productName || "Untitled Project",
        typeLabel: typeLabel(type),
        statusLabel,
        statusColor: statusBadgeColor(statusLabel),
        url: type === "audit" ? `/audits/${a.id}` : `/audits/workflow?resume=${a.id}`,
        createdAt: a.createdAt,
      };
    }),
    ...recentGraphics.map((g) => {
      const statusLabel = projectStatusLabel("graphics", g.status);
      return {
        type: "graphics" as const,
        id: g.id,
        name: g.name,
        typeLabel: typeLabel("graphics"),
        statusLabel,
        statusColor: statusBadgeColor(statusLabel),
        url: `/projects/${g.id}`,
        createdAt: g.createdAt,
      };
    }),
    ...recentVideos.map((v) => {
      const statusLabel = projectStatusLabel("video", v.status);
      return {
        type: "video" as const,
        id: v.id,
        name: v.name,
        typeLabel: typeLabel("video"),
        statusLabel,
        statusColor: statusBadgeColor(statusLabel),
        url: `/videos/${v.id}`,
        createdAt: v.createdAt,
      };
    }),
    ...recentAds.map((a) => {
      const statusLabel = projectStatusLabel("ads", a.status);
      return {
        type: "ads" as const,
        id: a.id,
        name: a.name,
        typeLabel: typeLabel("ads"),
        statusLabel,
        statusColor: statusBadgeColor(statusLabel),
        url: `/ads/${a.id}`,
        createdAt: a.createdAt,
      };
    }),
  ]
    .sort((a, b) => {
      const sortTime = (type: string, id: number, createdAt: Date | null | undefined) => {
        if (memberWorked) {
          const dbType = type === "listing" ? "audit" : type;
          const last = memberWorked.lastActivityAt.get(`${dbType}-${id}`);
          if (last) return last.getTime();
        }
        return new Date(createdAt ?? 0).getTime();
      };
      return sortTime(b.type, b.id, b.createdAt) - sortTime(a.type, a.id, a.createdAt);
    })
    .slice(0, 5);

  res.json({
    greetingName: profile?.fullName?.split(" ")[0] ?? null,
    period: {
      start: filterStart.toISOString(),
      end: filterEnd.toISOString(),
      billingStart: periodStart.toISOString(),
      billingEnd: periodEnd.toISOString(),
    },
    stats: {
      projectsSaved,
      projectsSavedThisWeek: projectsThisWeek,
      totalAudits,
      auditsWeekOverWeekPct,
      timeSavedHours,
      timeSavedThisWeek,
      creditsBalance,
      creditsAllowance,
      isTeamMember: !!team?.isTeamMember,
      teamCreditsUsedInPeriod,
      memberCreditsAllocated,
    },
    impact: {
      listingsOptimized: impactListingsOptimized,
      issuesIdentified: impactIssuesIdentified,
      timeSavedHours: timeSavedThisWeek,
    },
    creditBreakdown,
    recentProjects,
    quickActions: [
      { label: "Build Your Brand", href: "/audits/new", icon: "brand" },
      { label: "Audit Listing", href: "/audit-listings", icon: "audit" },
      { label: "Create Graphics", href: "/projects", icon: "graphics" },
      { label: "Create Videos", href: "/videos", icon: "video" },
      { label: "Manage Ads", href: "/ads", icon: "ads" },
      { label: "View Projects", href: "/projects", icon: "projects" },
    ],
  });
  } catch (err) {
    console.error("[dashboard] failed to load", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default router;
