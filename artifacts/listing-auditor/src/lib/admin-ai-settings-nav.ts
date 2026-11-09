/** Provider keys + model configuration (original AI Settings page). */
export const ADMIN_AI_SETTINGS_HREF = "/admin/settings/ai";

export const ADMIN_AI_OVERVIEW_HREF = "/admin/settings/ai/overview";
export const ADMIN_AI_SKILLS_HREF = "/admin/settings/ai/skills";
export const ADMIN_CONTENT_MARKETPLACES_HREF = "/admin/settings/content-marketplaces";

/** Sub-items under the AI Settings group (not the provider page itself). */
export const ADMIN_AI_NAV_ITEMS = [
  { href: ADMIN_AI_OVERVIEW_HREF, label: "Overview" },
  { href: ADMIN_AI_SKILLS_HREF, label: "Skills" },
  { href: ADMIN_CONTENT_MARKETPLACES_HREF, label: "Marketplaces" },
] as const;

export function isAdminAiSettingsPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === ADMIN_AI_SETTINGS_HREF || p.startsWith(`${ADMIN_AI_SETTINGS_HREF}/`);
}

export function isAdminAiProviderPage(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === ADMIN_AI_SETTINGS_HREF || p === `${ADMIN_AI_SETTINGS_HREF}/providers`;
}

export function isAdminAiSkillsPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === ADMIN_AI_SKILLS_HREF || p.startsWith(`${ADMIN_AI_SKILLS_HREF}/`);
}

export function isAdminContentMarketplacesPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === ADMIN_CONTENT_MARKETPLACES_HREF;
}

/** Skill create/edit screen (not the Skills catalog list). */
export function isAdminAiSkillEditorPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p.startsWith(`${ADMIN_AI_SKILLS_HREF}/`);
}
