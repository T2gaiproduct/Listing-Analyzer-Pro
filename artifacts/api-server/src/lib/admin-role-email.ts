import { eq } from "drizzle-orm";
import { ADMIN_PERMISSION_META } from "@workspace/admin-permissions";
import { db, adminRolesTable } from "@workspace/db";
import { adminRoleAssignedEmailTemplate } from "./email-templates.js";
import { sendEmail } from "./email.js";

const PERMISSION_LABELS = Object.fromEntries(
  ADMIN_PERMISSION_META.map((item) => [item.id, item.label]),
) as Record<string, string>;

function formatPermissionLabels(permissions: string[]): string[] {
  if (permissions.includes("*")) return ["Full admin access"];
  return permissions.map((p) => PERMISSION_LABELS[p] ?? p.replace(/_/g, " "));
}

function getAppBaseUrl(override?: string): string {
  if (override?.trim()) return override.replace(/\/$/, "");
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://listingauditor.com").replace(/\/$/, "");
}

export async function sendAdminRoleAssignedEmail(opts: {
  toEmail: string;
  recipientName: string;
  roleId: number;
  assignedByName: string;
  isUpdate?: boolean;
  appBaseUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const [role] = await db
    .select({ name: adminRolesTable.name, permissions: adminRolesTable.permissions })
    .from(adminRolesTable)
    .where(eq(adminRolesTable.id, opts.roleId))
    .limit(1);

  if (!role) return { success: false, error: "Role not found" };

  const adminSignInUrl = `${getAppBaseUrl(opts.appBaseUrl)}/sign-in?redirect_url=${encodeURIComponent("/admin")}`;
  const permissionLabels = formatPermissionLabels(role.permissions ?? []);
  const subject = opts.isUpdate
    ? `Your SellerLens admin role was updated to "${role.name}"`
    : `You've been granted SellerLens admin access (${role.name})`;

  const html = adminRoleAssignedEmailTemplate({
    recipientName: opts.recipientName,
    roleName: role.name,
    permissionLabels,
    adminSignInUrl,
    assignedByName: opts.assignedByName,
    isUpdate: opts.isUpdate,
  });

  return sendEmail({ to: opts.toEmail, subject, html });
}

export async function getClerkUserEmailAndName(userId: string, clerkFetch: (path: string) => Promise<unknown>): Promise<{ email: string; name: string } | null> {
  try {
    const cu = await clerkFetch(`/users/${userId}`) as Record<string, unknown>;
    const emails = cu.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emails?.[0]?.email_address;
    if (!email) return null;
    const fullName = [cu.first_name as string, cu.last_name as string].filter(Boolean).join(" ").trim();
    return { email, name: fullName || email };
  } catch {
    return null;
  }
}
