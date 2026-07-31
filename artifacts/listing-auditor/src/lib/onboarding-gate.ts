export interface ProfileSummaryForGate {
  onboardingCompleted?: boolean;
  accountRole?: { type?: string };
  pendingWorkspaceInvite?: { token: string; workspaceName?: string; workspaceId?: number } | null;
}

/** Account owners must finish onboarding unless summary marks them exempt. */
export function requiresOnboarding(summary: ProfileSummaryForGate): boolean {
  if (summary.pendingWorkspaceInvite?.token) return false;
  if (summary.onboardingCompleted) return false;
  if (summary.accountRole?.type === "team_member") return false;
  if (summary.accountRole?.type === "platform_admin") return false;
  return true;
}

export function pendingWorkspaceInviteRedirect(
  summary: ProfileSummaryForGate | undefined,
): string | null {
  const token = summary?.pendingWorkspaceInvite?.token;
  if (!token) return null;
  return `/accept-workspace-invite?token=${encodeURIComponent(token)}`;
}
