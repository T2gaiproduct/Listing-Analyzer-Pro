import { sql, eq, and, or, desc, count, inArray } from "drizzle-orm";
import {
  db,
  authCredentialsTable,
  authSessionsTable,
  userProfilesTable,
  auditsTable,
} from "@workspace/db";
import { isNativeAuthEnabled } from "./native-auth/config.js";

export type AdminCustomerListItem = {
  id: string;
  profileId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string | null;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  auditCount: number;
};

export function usesNativeCustomerDirectory(): boolean {
  const clerkKey = process.env.CLERK_SECRET_KEY?.trim();
  return isNativeAuthEnabled() || !clerkKey;
}

function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  if (!fullName?.trim()) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function toEpochMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function countNativeCustomers(query: string): Promise<number> {
  const q = query.trim().toLowerCase();
  const pattern = q ? `%${q}%` : null;

  const result = await db.execute(sql`
    SELECT count(*)::int AS c
    FROM (
      SELECT c.user_id AS id
      FROM auth_credentials c
      LEFT JOIN user_profiles p ON p.user_id = c.user_id AND coalesce(p.is_deleted, 0) = 0
      WHERE (${pattern === null ? sql`true` : sql`
        lower(c.email) LIKE ${pattern}
        OR lower(coalesce(p.login_email, '')) LIKE ${pattern}
        OR lower(coalesce(p.full_name, '')) LIKE ${pattern}
      `})
      UNION
      SELECT p.user_id AS id
      FROM user_profiles p
      LEFT JOIN auth_credentials c ON c.user_id = p.user_id
      WHERE coalesce(p.is_deleted, 0) = 0
        AND c.user_id IS NULL
        AND (${pattern === null ? sql`true` : sql`
          lower(coalesce(p.login_email, '')) LIKE ${pattern}
          OR lower(coalesce(p.full_name, '')) LIKE ${pattern}
        `})
    ) u
  `);
  const rows = result.rows as Array<{ c: number }>;
  return Number(rows[0]?.c ?? 0);
}

export async function listNativeCustomers(opts: {
  limit: number;
  offset: number;
  query: string;
}): Promise<AdminCustomerListItem[]> {
  const { limit, offset, query } = opts;
  const q = query.trim().toLowerCase();
  const pattern = q ? `%${q}%` : null;

  const result = await db.execute(sql`
    SELECT *
    FROM (
      SELECT
        c.user_id AS id,
        coalesce(p.id, NULL::int) AS profile_id,
        coalesce(c.email, p.login_email, '') AS email,
        p.full_name,
        p.avatar_url,
        coalesce(p.account_banned, false) AS banned,
        coalesce(p.account_locked, false) AS locked,
        coalesce(c.created_at, p.created_at) AS created_at,
        (
          SELECT max(s.created_at)
          FROM auth_sessions s
          WHERE s.user_id = c.user_id
        ) AS last_sign_in_at
      FROM auth_credentials c
      LEFT JOIN user_profiles p ON p.user_id = c.user_id AND coalesce(p.is_deleted, 0) = 0
      WHERE (${pattern === null ? sql`true` : sql`
        lower(c.email) LIKE ${pattern}
        OR lower(coalesce(p.login_email, '')) LIKE ${pattern}
        OR lower(coalesce(p.full_name, '')) LIKE ${pattern}
      `})

      UNION ALL

      SELECT
        p.user_id AS id,
        p.id AS profile_id,
        coalesce(p.login_email, '') AS email,
        p.full_name,
        p.avatar_url,
        coalesce(p.account_banned, false) AS banned,
        coalesce(p.account_locked, false) AS locked,
        p.created_at AS created_at,
        (
          SELECT max(s.created_at)
          FROM auth_sessions s
          WHERE s.user_id = p.user_id
        ) AS last_sign_in_at
      FROM user_profiles p
      LEFT JOIN auth_credentials c ON c.user_id = p.user_id
      WHERE coalesce(p.is_deleted, 0) = 0
        AND c.user_id IS NULL
        AND (${pattern === null ? sql`true` : sql`
          lower(coalesce(p.login_email, '')) LIKE ${pattern}
          OR lower(coalesce(p.full_name, '')) LIKE ${pattern}
        `})
    ) customers
    ORDER BY created_at DESC NULLS LAST
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = result.rows as Array<{
    id: string;
    profile_id: number | null;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    banned: boolean;
    locked: boolean;
    created_at: Date | string | null;
    last_sign_in_at: Date | string | null;
  }>;

  const ids = rows.map((r) => r.id).filter(Boolean);
  const auditCounts = ids.length
    ? await db
        .select({ userId: auditsTable.userId, c: count() })
        .from(auditsTable)
        .where(and(inArray(auditsTable.userId, ids), eq(auditsTable.isDeleted, 0)))
        .groupBy(auditsTable.userId)
    : [];

  const countMap: Record<string, number> = {};
  for (const row of auditCounts) {
    countMap[row.userId] = Number(row.c);
  }

  const needsProfile = rows.filter((r) => r.profile_id == null).map((r) => r.id);
  if (needsProfile.length) {
    await db
      .insert(userProfilesTable)
      .values(needsProfile.map((userId) => ({ userId })))
      .onConflictDoNothing();
    const inserted = await db
      .select({ userId: userProfilesTable.userId, id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.userId, needsProfile));
    const idMap = Object.fromEntries(inserted.map((p) => [p.userId, p.id]));
    for (const row of rows) {
      if (row.profile_id == null && idMap[row.id]) {
        row.profile_id = idMap[row.id]!;
      }
    }
  }

  return rows.map((row) => {
    const { firstName, lastName } = splitFullName(row.full_name);
    return {
      id: row.id,
      profileId: row.profile_id,
      firstName,
      lastName,
      email: row.email,
      imageUrl: row.avatar_url ?? null,
      banned: Boolean(row.banned),
      locked: Boolean(row.locked),
      createdAt: toEpochMs(row.created_at) ?? Date.now(),
      lastSignInAt: toEpochMs(row.last_sign_in_at),
      auditCount: countMap[row.id] ?? 0,
    };
  });
}

export async function getNativeCustomerIdentity(userId: string): Promise<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string | null;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
} | null> {
  const [cred] = await db
    .select({
      userId: authCredentialsTable.userId,
      email: authCredentialsTable.email,
      createdAt: authCredentialsTable.createdAt,
    })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.userId, userId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.userId, userId), eq(userProfilesTable.isDeleted, 0)))
    .limit(1);

  if (!cred && !profile) return null;

  const [lastSession] = await db
    .select({ createdAt: authSessionsTable.createdAt })
    .from(authSessionsTable)
    .where(eq(authSessionsTable.userId, userId))
    .orderBy(desc(authSessionsTable.createdAt))
    .limit(1);

  const { firstName, lastName } = splitFullName(profile?.fullName);
  const email = cred?.email ?? profile?.loginEmail ?? "";
  return {
    id: userId,
    firstName,
    lastName,
    email,
    imageUrl: profile?.avatarUrl ?? null,
    banned: profile?.accountBanned ?? false,
    locked: profile?.accountLocked ?? false,
    createdAt: toEpochMs(cred?.createdAt ?? profile?.createdAt) ?? Date.now(),
    lastSignInAt: toEpochMs(lastSession?.createdAt),
  };
}

export async function setCustomerBanState(userId: string, banned: boolean): Promise<void> {
  await db
    .insert(userProfilesTable)
    .values({ userId, accountBanned: banned })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: { accountBanned: banned, updatedAt: new Date() },
    });
  if (banned) {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
  }
}

export async function setCustomerLockState(userId: string, locked: boolean): Promise<void> {
  await db
    .insert(userProfilesTable)
    .values({ userId, accountLocked: locked })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: { accountLocked: locked, updatedAt: new Date() },
    });
  if (locked) {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
  }
}

export async function lookupUserEmailAndName(userId: string): Promise<{ email: string; name: string } | null> {
  const identity = await getNativeCustomerIdentity(userId);
  if (!identity?.email) return null;
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
  return { email: identity.email, name: name || identity.email };
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const [cred] = await db
    .select({ userId: authCredentialsTable.userId })
    .from(authCredentialsTable)
    .where(sql`lower(${authCredentialsTable.email}) = ${normalized}`)
    .limit(1);
  if (cred) return cred.userId;
  const [profile] = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(
      and(
        eq(userProfilesTable.isDeleted, 0),
        or(
          sql`lower(${userProfilesTable.loginEmail}) = ${normalized}`,
          sql`lower(coalesce(${userProfilesTable.loginEmail}, '')) = ${normalized}`,
        ),
      ),
    )
    .limit(1);
  return profile?.userId ?? null;
}