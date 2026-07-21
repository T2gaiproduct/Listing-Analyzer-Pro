/** All admin permission identifiers. */
export const ADMIN_PERMISSIONS = [
  "view_dashboard",
  "view_analytics",
  "view_reports",
  "manage_customers",
  "ban_customers",
  "delete_customers",
  "manage_audits",
  "delete_audits",
  "manage_plans",
  "manage_credits",
  "manage_credit_rules",
  "manage_payments",
  "manage_invoices",
  "manage_refunds",
  "manage_coupons",
  "view_content",
  "view_logs",
  "view_downloads",
  "manage_roles",
  "manage_settings",
  "manage_notifications",
  "manage_support",
  "manage_team_activity",
  // Website CMS — granular (option B)
  "manage_homepage_cms",
  "manage_pages_cms",
  "manage_navigation",
  "manage_blog",
  "manage_seo",
  "manage_testimonials",
  "manage_faqs",
  "manage_media",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminPermissionGroup =
  | "Overview"
  | "User Management"
  | "Services"
  | "Billing"
  | "Reports"
  | "Marketing"
  | "Website CMS"
  | "Help & Support"
  | "Settings";

export interface AdminPermissionMeta {
  id: AdminPermission;
  label: string;
  group: AdminPermissionGroup;
  description?: string;
}

/** Human-readable labels for the Roles UI and docs. */
export const ADMIN_PERMISSION_META: AdminPermissionMeta[] = [
  { id: "view_dashboard", label: "View Dashboard", group: "Overview" },
  { id: "view_analytics", label: "View Analytics", group: "Overview" },
  { id: "view_reports", label: "View Reports", group: "Reports" },
  { id: "manage_customers", label: "Manage Customers", group: "User Management" },
  { id: "ban_customers", label: "Ban Customers", group: "User Management" },
  { id: "delete_customers", label: "Delete Customers", group: "User Management" },
  { id: "manage_roles", label: "Manage Roles", group: "User Management" },
  { id: "manage_audits", label: "Manage Audits", group: "Services" },
  { id: "delete_audits", label: "Delete Audits", group: "Services" },
  { id: "view_content", label: "View Generated Content", group: "Services" },
  { id: "view_logs", label: "View Service Logs", group: "Services" },
  { id: "view_downloads", label: "View Downloads", group: "Services" },
  { id: "manage_plans", label: "Manage Plans", group: "Billing" },
  { id: "manage_credits", label: "Manage Credits", group: "Billing" },
  { id: "manage_credit_rules", label: "Manage Credit Rules", group: "Billing" },
  { id: "manage_payments", label: "Manage Payments", group: "Billing" },
  { id: "manage_invoices", label: "Manage Invoices", group: "Billing" },
  { id: "manage_refunds", label: "Manage Refunds", group: "Billing" },
  { id: "manage_coupons", label: "Manage Coupons", group: "Marketing" },
  { id: "manage_notifications", label: "Manage Announcements", group: "Marketing" },
  { id: "manage_homepage_cms", label: "Homepage CMS", group: "Website CMS" },
  { id: "manage_pages_cms", label: "Pages CMS", group: "Website CMS" },
  { id: "manage_navigation", label: "Navigation Menu", group: "Website CMS" },
  { id: "manage_blog", label: "Blog", group: "Website CMS" },
  { id: "manage_seo", label: "SEO Settings", group: "Website CMS" },
  { id: "manage_testimonials", label: "Testimonials", group: "Website CMS" },
  { id: "manage_faqs", label: "FAQ", group: "Website CMS" },
  { id: "manage_media", label: "Media Library", group: "Website CMS" },
  { id: "manage_support", label: "Support & Contact Messages", group: "Help & Support" },
  { id: "manage_settings", label: "Platform Settings", group: "Settings" },
  { id: "manage_team_activity", label: "Team Activity", group: "Settings" },
];

export const SUPER_ADMIN_ROLE_NAME = "Super Admin";

export function isSuperAdminRoleName(roleName: string | null | undefined): boolean {
  return (roleName ?? "").trim().toLowerCase() === SUPER_ADMIN_ROLE_NAME.toLowerCase();
}

export function hasAdminPermission(
  permissions: readonly string[] | null | undefined,
  required: AdminPermission | AdminPermission[],
  opts?: { isSuperAdmin?: boolean; roleName?: string | null },
): boolean {
  if (opts?.isSuperAdmin || isSuperAdminRoleName(opts?.roleName)) return true;
  const granted = permissions ?? [];
  if (granted.includes("*")) return true;
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((p) => granted.includes(p));
}

export function hasAllAdminPermissions(
  permissions: readonly string[] | null | undefined,
  required: AdminPermission[],
  opts?: { isSuperAdmin?: boolean; roleName?: string | null },
): boolean {
  if (opts?.isSuperAdmin || isSuperAdminRoleName(opts?.roleName)) return true;
  const granted = permissions ?? [];
  if (granted.includes("*")) return true;
  return required.every((p) => granted.includes(p));
}

/** Frontend route path (no query) → required permission(s); any match grants access. */
export const ADMIN_ROUTE_PERMISSIONS: Record<string, AdminPermission | AdminPermission[]> = {
  "/admin/dashboard": "view_dashboard",
  "/admin/analytics": "view_analytics",
  "/admin/customers": "manage_customers",
  "/admin/roles": "manage_roles",
  "/admin/content/build-brand-logs": "view_logs",
  "/admin/content/logs": "view_logs",
  "/admin/content/graphics-logs": "view_logs",
  "/admin/content/generated": "view_content",
  "/admin/content/images": "view_content",
  "/admin/content/downloads": "view_downloads",
  "/admin/audits": "manage_audits",
  "/admin/plans": "manage_plans",
  "/admin/credits": "manage_credits",
  "/admin/credit-rules": "manage_credit_rules",
  "/admin/billing/payments": "manage_payments",
  "/admin/billing/invoices": "manage_invoices",
  "/admin/billing/refunds": "manage_refunds",
  "/admin/billing/coupons": "manage_coupons",
  "/admin/reports/revenue": "view_reports",
  "/admin/reports/customers": "view_reports",
  "/admin/reports/subscriptions": "view_reports",
  "/admin/notifications": "manage_notifications",
  "/admin/marketing/homepage": "manage_homepage_cms",
  "/admin/marketing/pages": "manage_pages_cms",
  "/admin/marketing/navigation": "manage_navigation",
  "/admin/marketing/blog": "manage_blog",
  "/admin/marketing/seo": "manage_seo",
  "/admin/marketing/testimonials": "manage_testimonials",
  "/admin/marketing/faqs": "manage_faqs",
  "/admin/marketing/media": "manage_media",
  "/admin/help/support-tickets": "manage_support",
  "/admin/marketing/forms": "manage_support",
  "/admin/settings/platform": "manage_settings",
  "/admin/settings/ai": "manage_settings",
  "/admin/settings/api": "manage_settings",
  "/admin/settings/email": "manage_settings",
  "/admin/settings/payment-gateway": "manage_settings",
  "/admin/settings/security": "manage_settings",
  "/admin/team-activity": "manage_team_activity",
  "/admin/archive": "manage_settings",
};

/** Resolve permission for a frontend admin path (longest prefix match). */
export function resolveAdminRoutePermission(pathname: string): AdminPermission | AdminPermission[] | null {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/admin/dashboard";
  if (path.startsWith("/admin/customers/")) return "manage_customers";
  if (path.startsWith("/admin/marketing/blog/")) return "manage_blog";

  const entries = Object.entries(ADMIN_ROUTE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [route, perm] of entries) {
    if (path === route || path.startsWith(`${route}/`)) return perm;
  }
  return null;
}

export function canAccessAdminRoute(
  pathname: string,
  permissions: readonly string[] | null | undefined,
  opts?: { isSuperAdmin?: boolean; roleName?: string | null },
): boolean {
  const required = resolveAdminRoutePermission(pathname);
  if (!required) return opts?.isSuperAdmin === true || isSuperAdminRoleName(opts?.roleName);
  return hasAdminPermission(permissions, required, opts);
}

/** First admin route the user may open (for default redirect). */
export function getDefaultAdminRoute(
  permissions: readonly string[] | null | undefined,
  opts?: { isSuperAdmin?: boolean; roleName?: string | null },
): string {
  const ordered = [
    "/admin/dashboard",
    "/admin/analytics",
    "/admin/marketing/homepage",
    "/admin/marketing/blog",
    "/admin/marketing/seo",
    "/admin/marketing/pages",
    "/admin/marketing/navigation",
    "/admin/marketing/testimonials",
    "/admin/marketing/faqs",
    "/admin/marketing/media",
    "/admin/notifications",
    "/admin/customers",
    "/admin/roles",
    "/admin/plans",
    "/admin/settings/platform",
  ];
  for (const route of ordered) {
    if (canAccessAdminRoute(route, permissions, opts)) return route;
  }
  return "/admin/dashboard";
}

type ApiPermissionRule = {
  match: RegExp;
  method?: string;
  permissions: AdminPermission | AdminPermission[];
};

/**
 * API path + method → required permission(s). First matching rule wins.
 * Paths are relative to /api (e.g. /admin/plans).
 */
const API_PERMISSION_RULES: ApiPermissionRule[] = [
  { match: /^\/admin\/is-admin$/, permissions: [] },
  { match: /^\/admin\/me$/, permissions: [] },
  { match: /^\/admin\/stats$/, permissions: "view_dashboard" },
  { match: /^\/admin\/analytics$/, permissions: "view_analytics" },
  { match: /^\/admin\/billing-stats$/, permissions: ["view_reports", "manage_payments"] },
  { match: /^\/admin\/customers\/[^/]+\/ban$/, method: "PATCH", permissions: "ban_customers" },
  { match: /^\/admin\/customers\/[^/]+\/unban$/, method: "PATCH", permissions: "ban_customers" },
  { match: /^\/admin\/customers\/[^/]+$/, method: "DELETE", permissions: "delete_customers" },
  { match: /^\/admin\/customers/, permissions: "manage_customers" },
  { match: /^\/admin\/audits\/[^/]+$/, method: "DELETE", permissions: "delete_audits" },
  { match: /^\/admin\/audits/, permissions: "manage_audits" },
  { match: /^\/admin\/graphics-logs/, permissions: "view_logs" },
  { match: /^\/admin\/plans/, permissions: "manage_plans" },
  { match: /^\/admin\/credits/, permissions: "manage_credits" },
  { match: /^\/admin\/credit-rules/, permissions: "manage_credit_rules" },
  { match: /^\/admin\/credit-packs/, permissions: "manage_credit_rules" },
  { match: /^\/admin\/payments/, permissions: "manage_payments" },
  { match: /^\/admin\/subscriptions/, permissions: "view_reports" },
  { match: /^\/admin\/invoices/, permissions: "manage_invoices" },
  { match: /^\/admin\/receipts/, permissions: "manage_payments" },
  { match: /^\/admin\/refunds/, permissions: "manage_refunds" },
  { match: /^\/admin\/coupons/, permissions: "manage_coupons" },
  { match: /^\/admin\/content/, permissions: "view_content" },
  { match: /^\/admin\/images/, permissions: "view_content" },
  { match: /^\/admin\/audit-logs/, permissions: "manage_team_activity" },
  { match: /^\/admin\/downloads/, permissions: "view_downloads" },
  { match: /^\/admin\/roles/, permissions: "manage_roles" },
  { match: /^\/admin\/admin-users/, permissions: "manage_roles" },
  { match: /^\/admin\/admin-invites/, permissions: "manage_roles" },
  { match: /^\/admin\/notifications/, permissions: "manage_notifications" },
  { match: /^\/admin\/settings/, permissions: "manage_settings" },
  { match: /^\/admin\/test-openai-key$/, permissions: "manage_settings" },
  { match: /^\/admin\/test-gemini-key$/, permissions: "manage_settings" },
  { match: /^\/admin\/test-replit-ai$/, permissions: "manage_settings" },
  { match: /^\/admin\/cms-pages/, permissions: "manage_pages_cms" },
  { match: /^\/admin\/cms\//, permissions: "manage_homepage_cms" },
  { match: /^\/admin\/blog/, permissions: "manage_blog" },
  { match: /^\/admin\/testimonials/, permissions: "manage_testimonials" },
  { match: /^\/admin\/faqs/, permissions: "manage_faqs" },
  { match: /^\/admin\/seo\//, permissions: "manage_seo" },
  { match: /^\/admin\/nav/, permissions: "manage_navigation" },
  { match: /^\/admin\/forms/, permissions: "manage_support" },
  { match: /^\/admin\/media/, permissions: "manage_media" },
  { match: /^\/admin\/hero-image$/, permissions: ["manage_homepage_cms", "manage_media"] },
  { match: /^\/admin\/portfolio-image$/, permissions: ["manage_homepage_cms", "manage_media"] },
  { match: /^\/admin\/workflow-image$/, permissions: ["manage_homepage_cms", "manage_media"] },
  { match: /^\/admin\/team-activity/, permissions: "manage_team_activity" },
];

export function resolveAdminApiPermission(pathname: string, method: string): AdminPermission | AdminPermission[] | null {
  const path = pathname.split("?")[0];
  const upperMethod = method.toUpperCase();
  for (const rule of API_PERMISSION_RULES) {
    if (!rule.match.test(path)) continue;
    if (rule.method && rule.method.toUpperCase() !== upperMethod) continue;
    return rule.permissions;
  }
  return null;
}

export function canAccessAdminApi(
  pathname: string,
  method: string,
  permissions: readonly string[] | null | undefined,
  opts?: { isSuperAdmin?: boolean; roleName?: string | null },
): boolean {
  const required = resolveAdminApiPermission(pathname, method);
  if (required === null) {
    return opts?.isSuperAdmin === true || isSuperAdminRoleName(opts?.roleName);
  }
  if (Array.isArray(required) && required.length === 0) return true;
  return hasAdminPermission(permissions, required as AdminPermission | AdminPermission[], opts);
}
