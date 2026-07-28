import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, adminRolesTable, adminUsersTable, userProfilesTable } from "@workspace/db";
import { acceptAdminInviteForUser } from "./admin-invites.js";
import { syncUserLoginEmail } from "./user-profile.js";
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

/** Clerk user IDs granted super-admin via ADMIN_USER_IDS env (not always in admin_users). */
export function getEnvSuperAdminUserIds(): string[] {
  return [...ADMIN_USER_IDS];
}

export function sessionEmailFromClaims(sessionClaims: Record<string, unknown> | null | undefined): string | null {
  if (!sessionClaims) return null;
  const candidates = [
    sessionClaims.email,
    sessionClaims.primary_email_address,
    sessionClaims.primary_email,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

/** Clerk documented test inboxes: *+clerk_test@example.com */
export function isClerkDevTestEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@example.com") && normalized.includes("clerk_test");
}

/** Local dev / cloud preview — never enable on production Postgres. */
export function allowDevAdminBootstrap(): boolean {
  if (process.env.ALLOW_DEV_ADMIN_BOOTSTRAP === "true") return true;
  if (process.env.NODE_ENV === "production") return false;
  const db = process.env.DATABASE_URL ?? "";
  return /localhost|127\.0\.0\.1/.test(db);
}

/** Auto-grant Super Admin to Clerk test accounts in local dev (demo sign-in). */
export async function ensureDevClerkTestAdminAccess(
  userId: string,
  email?: string | null,
): Promise<void> {
  if (!allowDevAdminBootstrap()) return;

  let resolvedEmail = email?.trim().toLowerCase() || null;
  if (!resolvedEmail) {
    const [profile] = await db
      .select({ loginEmail: userProfilesTable.loginEmail })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);
    resolvedEmail = profile?.loginEmail?.trim().toLowerCase() ?? null;
  }

  if (!isClerkDevTestEmail(resolvedEmail)) return;

  if (resolvedEmail) {
    await syncUserLoginEmail(userId, resolvedEmail);
  }

  const [superRole] = await db
    .select({ id: adminRolesTable.id })
    .from(adminRolesTable)
    .where(eq(adminRolesTable.name, "Super Admin"))
    .limit(1);
  if (!superRole) return;

  await db
    .insert(adminUsersTable)
    .values({ userId, roleId: superRole.id })
    .onConflictDoUpdate({
      target: adminUsersTable.userId,
      set: { roleId: superRole.id, isDeleted: 0 },
    });
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
  await ensureDevClerkTestAdminAccess(userId, resolvedEmail ?? email);
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
  await ensureDevClerkTestAdminAccess(userId, resolvedEmail ?? email);
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
