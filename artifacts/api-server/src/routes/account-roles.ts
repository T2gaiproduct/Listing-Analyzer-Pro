import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, workspaceRolesTable, workspaceMembersTable } from "@workspace/db";
import {
  mergePermissionsFromForm,
  legacyRolePermissions,
} from "@workspace/workspace-permissions";
import { resolveAccountOwnerId } from "../lib/workspace-context";
import { ensureAccountRolesMigrated, listAccountRoles, getAccountRole } from "../lib/ensure-account-roles";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as AuthedRequest).userId = userId;
  next();
}

async function requireAccountOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const accountOwnerId = await resolveAccountOwnerId(userId);
  if (accountOwnerId !== userId) {
    res.status(403).json({ error: "Only the account owner can manage roles." });
    return;
  }
  (req as AuthedRequest & { accountOwnerId: string }).accountOwnerId = accountOwnerId;
  next();
}

router.get("/account/roles", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const accountOwnerId = await resolveAccountOwnerId(userId);
  const roles = await listAccountRoles(accountOwnerId);
  res.json({ roles });
});

router.post("/account/roles", requireAuth, requireAccountOwner, async (req, res): Promise<void> => {
  const accountOwnerId = (req as AuthedRequest & { accountOwnerId: string }).accountOwnerId;
  const { name, description, permissions, preserveExisting } = req.body as {
    name?: string;
    description?: string;
    permissions?: Record<string, Record<string, boolean>>;
    preserveExisting?: boolean;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }

  const perms = preserveExisting
    ? legacyRolePermissions("editor")
    : mergePermissionsFromForm(permissions ?? {});

  const [role] = await db.insert(workspaceRolesTable).values({
    accountOwnerId,
    workspaceId: null,
    name: name.trim(),
    description: description?.trim() || null,
    permissions: perms,
    isSystem: false,
  }).returning();

  res.status(201).json(role);
});

router.patch("/account/roles/:roleId", requireAuth, requireAccountOwner, async (req, res): Promise<void> => {
  const accountOwnerId = (req as AuthedRequest & { accountOwnerId: string }).accountOwnerId;
  const roleId = Number(req.params.roleId);
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: Record<string, Record<string, boolean>>;
  };

  const existing = await getAccountRole(accountOwnerId, roleId);
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const [updated] = await db.update(workspaceRolesTable)
    .set({
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(permissions !== undefined && { permissions: mergePermissionsFromForm(permissions) }),
      updatedAt: new Date(),
    })
    .where(eq(workspaceRolesTable.id, roleId))
    .returning();

  res.json(updated);
});

router.delete("/account/roles/:roleId", requireAuth, requireAccountOwner, async (req, res): Promise<void> => {
  const accountOwnerId = (req as AuthedRequest & { accountOwnerId: string }).accountOwnerId;
  const roleId = Number(req.params.roleId);

  const existing = await getAccountRole(accountOwnerId, roleId);
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  await db.update(workspaceMembersTable)
    .set({ roleId: null })
    .where(eq(workspaceMembersTable.roleId, roleId));

  await db.delete(workspaceRolesTable).where(eq(workspaceRolesTable.id, roleId));
  res.sendStatus(204);
});

export default router;
