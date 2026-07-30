const LEGACY_PRESET_ROLES = new Set(["admin", "editor", "viewer", "member"]);

/** Show only account-defined role template names — never legacy preset labels. */
export function accountRoleLabel(
  roleId: number | null | undefined,
  roleName: string | null | undefined,
  roles?: Array<{ id: number; name: string }>,
): string {
  if (roleId != null) {
    const fromList = roles?.find((r) => r.id === roleId)?.name;
    if (fromList) return fromList;
    if (roleName && !LEGACY_PRESET_ROLES.has(roleName.toLowerCase())) return roleName;
  }
  return "Unassigned";
}
