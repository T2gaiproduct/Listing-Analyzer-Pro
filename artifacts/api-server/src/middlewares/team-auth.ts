import { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";

export interface TeamContext {
  role: "admin" | "editor" | "viewer" | "owner";
  ownerUserId: string;
  isTeamMember: boolean;
  memberId?: number;
}

export interface TeamAuthedRequest extends Request {
  team: TeamContext;
}

export async function resolveTeamContext(
  userId: string
): Promise<TeamContext> {
  // Check if user is an active member of any workspace
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(
      and(
        eq(teamMembersTable.memberUserId, userId),
        eq(teamMembersTable.status, "active")
      )
    );

  if (membership) {
    return {
      role: membership.role as "admin" | "editor" | "viewer",
      ownerUserId: membership.ownerUserId,
      isTeamMember: true,
      memberId: membership.id,
    };
  }

  // No membership — user is their own owner
  return {
    role: "owner",
    ownerUserId: userId,
    isTeamMember: false,
  };
}

/**
 * Attach team context to the request.
 * Use after requireAuth. Populates req.team with role + ownerUserId.
 */
export async function teamAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

export function requireTeamRole(
  ...allowedRoles: ("admin" | "editor" | "viewer" | "owner")[]
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const team = (req as TeamAuthedRequest).team;
    if (!team) {
      res.status(401).json({ error: "Team context not resolved" });
      return;
    }
    if (!allowedRoles.includes(team.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }
    next();
  };
}

export function requireWriteAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const team = (req as TeamAuthedRequest).team;
  if (!team) {
    res.status(401).json({ error: "Team context not resolved" });
    return;
  }
  if (team.role === "viewer") {
    res.status(403).json({ error: "Forbidden: viewers cannot modify data" });
    return;
  }
  next();
}
