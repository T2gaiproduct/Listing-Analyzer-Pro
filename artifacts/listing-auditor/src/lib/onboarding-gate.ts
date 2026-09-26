import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

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
  if (isCloudflareQuickPreviewHost()) return false;
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

/** Shared project URLs: allow viewing after sign-in even if owner onboarding is incomplete. */
export function isSharedProjectDeepLink(path: string, search = ""): boolean {
  const p = path.split("?")[0] ?? path;
  if (p.startsWith("/products/")) return true;
  if (p.startsWith("/projects/") && p !== "/projects/create") return true;
  if (p === "/audits/workflow") {
    return new URLSearchParams(search).has("resume");
  }
  if (p.startsWith("/audits/") && p !== "/audits/new" && p !== "/audits/workflow") {
    return true;
  }
  return false;
}
