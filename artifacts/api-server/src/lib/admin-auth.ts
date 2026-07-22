import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, adminRolesTable, adminUsersTable } from "@workspace/db";
import { acceptAdminInviteForUser } from "./admin-invites.js";
import {
  ADMIN_PERMISSIONS,
  canAccessAdminApi,
  isSuperAdminRoleName,
  type AdminPermission,
} from "@workspace/admin-permissions";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export interface AdminContext {
  userId: string;
  isSuperAdmin: boolean;
  role: { id: number; name: string; permissions: string[] } | null;
  permissions: string[];
}

export interface AdminRequest extends Request {
  admin: AdminContext;
}

export function isEnvSuperAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

async function resolveAuthEmail(userId: string, sessionEmail?: string | null): Promise<string | null> {
  if (sessionEmail?.trim()) return sessionEmail.trim().toLowerCase();
  try {
    const cu = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY ?? ""}` },
    }).then((r) => r.json()) as Record<string, unknown>;
    const emails = cu.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emails?.[0]?.email_address;
    return email ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function loadAdminContext(userId: string, email?: string | null): Promise<AdminContext | null> {
  if (isEnvSuperAdmin(userId)) {
    return { userId, isSuperAdmin: true, role: null, permissions: [...ADMIN_PERMISSIONS] };
  }

  const resolvedEmail = await resolveAuthEmail(userId, email);
  await acceptAdminInviteForUser(userId, resolvedEmail);

  const [assignment] = await db
    .select({
      roleId: adminUsersTable.roleId,
      roleName: adminRolesTable.name,
      permissions: adminRolesTable.permissions,
    })
    .from(adminUsersTable)
    .innerJoin(adminRolesTable, eq(adminUsersTable.roleId, adminRolesTable.id))
    .where(eq(adminUsersTable.userId, userId))
    .limit(1);

  if (!assignment) return null;

  const permissions = assignment.permissions ?? [];
  const isSuperAdmin = isSuperAdminRoleName(assignment.roleName);

  return {
    userId,
    isSuperAdmin,
    role: { id: assignment.roleId, name: assignment.roleName, permissions },
    permissions: isSuperAdmin ? [...ADMIN_PERMISSIONS] : permissions,
  };
}

export async function isAdminUser(userId: string, email?: string | null): Promise<boolean> {
  if (isEnvSuperAdmin(userId)) return true;
  const resolvedEmail = await resolveAuthEmail(userId, email);
  await acceptAdminInviteForUser(userId, resolvedEmail);
  const [row] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.userId, userId));
  return !!row;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  const email = auth?.sessionClaims?.email as string | undefined;
  if (!userId) { res.status(403).json({ error: "Forbidden" }); return; }

  loadAdminContext(userId, email).then((ctx) => {
    if (!ctx) { res.status(403).json({ error: "Forbidden" }); return; }
    (req as AdminRequest).admin = ctx;
    next();
  }).catch(() => { res.status(500).json({ error: "Internal server error" }); });
}

/** Enforce permission for the current admin API request based on path + method. */
export function enforceAdminApiPermission(req: Request, res: Response, next: NextFunction): void {
  const adminReq = req as AdminRequest;
  const ctx = adminReq.admin;
  if (!ctx) { res.status(403).json({ error: "Forbidden" }); return; }

  const allowed = canAccessAdminApi(req.path, req.method, ctx.permissions, {
    isSuperAdmin: ctx.isSuperAdmin,
    roleName: ctx.role?.name,
  });

  if (!allowed) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
}

export function requireAdminWithPermission(req: Request, res: Response, next: NextFunction): void {
  requireAdmin(req, res, () => enforceAdminApiPermission(req, res, next));
}

export function requireAdminPermission(...permissions: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = (req as AdminRequest).admin;
    if (!ctx) { res.status(403).json({ error: "Forbidden" }); return; }
    if (ctx.isSuperAdmin || isSuperAdminRoleName(ctx.role?.name)) { next(); return; }

    const ok = permissions.some((p) => ctx.permissions.includes(p));
    if (!ok) { res.status(403).json({ error: "Insufficient permissions" }); return; }
    next();
  };
}
