/** Labels for UI/API — only account-defined role templates, never legacy preset keys. */
export function displayWorkspaceRoleLabel(opts: {
  isAccountOwner?: boolean;
  roleId?: number | null;
  roleName?: string | null;
}): string {
  if (opts.isAccountOwner) return "Owner";
  if (opts.roleId != null && opts.roleName?.trim()) return opts.roleName.trim();
  return "Unassigned";
}
