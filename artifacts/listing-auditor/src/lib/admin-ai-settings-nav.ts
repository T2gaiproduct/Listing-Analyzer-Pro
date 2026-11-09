export const ADMIN_AI_OVERVIEW_HREF = "/admin/settings/ai/overview";
export const ADMIN_AI_SKILLS_HREF = "/admin/settings/ai/skills";
export const ADMIN_AI_PROVIDERS_HREF = "/admin/settings/ai/providers";

export const ADMIN_AI_NAV_ITEMS = [
  { href: ADMIN_AI_OVERVIEW_HREF, label: "Overview" },
  { href: ADMIN_AI_SKILLS_HREF, label: "Skills" },
  { href: ADMIN_AI_PROVIDERS_HREF, label: "Providers" },
] as const;

export function isAdminAiSettingsPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === "/admin/settings/ai" || p.startsWith("/admin/settings/ai/");
}

export function isAdminAiSettingsHomePath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === "/admin/settings/ai" || p === ADMIN_AI_OVERVIEW_HREF;
}
