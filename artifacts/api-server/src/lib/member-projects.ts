import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  creditTransactionsTable,
  graphicsProjectsTable,
} from "@workspace/db";
import type { TeamContext } from "../middlewares/team-auth";

export type WorkedProjectType = "audit" | "graphics" | "video" | "ads";

export interface MemberWorkedProjects {
  auditIds: number[];
  graphicsIds: number[];
  videoIds: number[];
  adsIds: number[];
  /** Latest credit activity per project, keyed as `audit-12`, `graphics-3`, etc. */
  lastActivityAt: Map<string, Date>;
}

const GRAPHICS_FEATURES = new Set(["graphics", "graphics_edit"]);
const VIDEO_FEATURES = new Set(["videos", "video"]);
const ADS_FEATURES = new Set(["ads"]);

function touchActivity(
  map: Map<string, Date>,
  type: WorkedProjectType,
  id: number,
  at: Date,
): void {
  const key = `${type}-${id}`;
  const prev = map.get(key);
  if (!prev || at > prev) map.set(key, at);
}

function classifyProjectId(
  featureType: string | null | undefined,
): WorkedProjectType {
  if (featureType && VIDEO_FEATURES.has(featureType)) return "video";
  if (featureType && ADS_FEATURES.has(featureType)) return "ads";
  return "graphics";
}

/** Collect project IDs a team member has worked on via credit spend metadata. */
export async function getMemberWorkedProjects(
  memberUserId: string,
): Promise<MemberWorkedProjects> {
  const txs = await db
    .select({
      metadata: creditTransactionsTable.metadata,
      featureType: creditTransactionsTable.featureType,
      createdAt: creditTransactionsTable.createdAt,
    })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, memberUserId),
        sql`${creditTransactionsTable.amount} < 0`,
      ),
    );

  const auditIds = new Set<number>();
  const graphicsIds = new Set<number>();
  const videoIds = new Set<number>();
  const adsIds = new Set<number>();
  const lastActivityAt = new Map<string, Date>();

  for (const tx of txs) {
    const meta = (tx.metadata ?? {}) as Record<string, unknown>;
    const at = tx.createdAt ?? new Date();

    if (typeof meta.auditId === "number") {
      auditIds.add(meta.auditId);
      touchActivity(lastActivityAt, "audit", meta.auditId, at);
    }

    if (typeof meta.projectId === "number") {
      const projectType = classifyProjectId(tx.featureType);
      if (projectType === "video") {
        videoIds.add(meta.projectId);
        touchActivity(lastActivityAt, "video", meta.projectId, at);
      } else if (projectType === "ads") {
        adsIds.add(meta.projectId);
        touchActivity(lastActivityAt, "ads", meta.projectId, at);
      } else {
        graphicsIds.add(meta.projectId);
        touchActivity(lastActivityAt, "graphics", meta.projectId, at);
      }
    }
  }

  if (auditIds.size > 0) {
    const linked = await db
      .select({ id: graphicsProjectsTable.id, auditId: graphicsProjectsTable.auditId })
      .from(graphicsProjectsTable)
      .where(
        and(
          inArray(graphicsProjectsTable.auditId, [...auditIds]),
          eq(graphicsProjectsTable.isDeleted, 0),
        ),
      );
    for (const row of linked) {
      graphicsIds.add(row.id);
      if (row.auditId != null) {
        const auditActivity = lastActivityAt.get(`audit-${row.auditId}`);
        if (auditActivity) touchActivity(lastActivityAt, "graphics", row.id, auditActivity);
      }
    }
  }

  return {
    auditIds: [...auditIds],
    graphicsIds: [...graphicsIds],
    videoIds: [...videoIds],
    adsIds: [...adsIds],
    lastActivityAt,
  };
}

export function memberHasProjectAccess(
  worked: MemberWorkedProjects,
  type: WorkedProjectType,
  id: number,
): boolean {
  switch (type) {
    case "audit":
      return worked.auditIds.includes(id);
    case "graphics":
      return worked.graphicsIds.includes(id);
    case "video":
      return worked.videoIds.includes(id);
    case "ads":
      return worked.adsIds.includes(id);
    default:
      return false;
  }
}

export async function assertMemberProjectAccess(
  team: TeamContext,
  memberUserId: string,
  type: WorkedProjectType,
  projectId: number,
): Promise<MemberWorkedProjects | null> {
  if (!team.isTeamMember) return null;
  const worked = await getMemberWorkedProjects(memberUserId);
  if (!memberHasProjectAccess(worked, type, projectId)) {
    throw new ProjectAccessError();
  }
  return worked;
}

export class ProjectAccessError extends Error {
  constructor() {
    super("Forbidden: no access to this project");
    this.name = "ProjectAccessError";
  }
}
