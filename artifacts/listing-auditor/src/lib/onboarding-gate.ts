export interface ProfileSummaryForGate {
  onboardingCompleted?: boolean;
  subscription?: { status?: string } | null;
  accountRole?: { type?: string };
  pendingWorkspaceInvite?: { token: string; workspaceName?: string; workspaceId?: number } | null;
}

export function hasActiveSubscription(summary: ProfileSummaryForGate): boolean {
  const status = summary.subscription?.status;
  return status === "active" || status === "trial";
}

/** Account owners must finish onboarding unless summary marks them exempt. */
export function requiresOnboarding(summary: ProfileSummaryForGate): boolean {
  if (summary.pendingWorkspaceInvite?.token) return false;
  if (summary.onboardingCompleted) return false;
  if (hasActiveSubscription(summary)) return false;
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
