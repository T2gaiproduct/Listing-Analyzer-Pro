import type { LucideIcon } from "lucide-react";
import {
  UserCircle,
  Receipt,
  Users,
  Building2,
  Settings,
  Shield,
} from "lucide-react";
import type { WorkspaceAction, WorkspaceFeature } from "@workspace/workspace-permissions";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";

export interface ProfileMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  locked?: boolean;
  lockedHint?: string;
}

type CanFn = (feature: WorkspaceFeature, action: WorkspaceAction) => boolean;
type CanViewFn = (feature: WorkspaceFeature) => boolean;

export function buildProfileMenuItems(
  isTeamMember: boolean,
  isOwner: boolean,
  isAccountOwner: boolean,
  variant: "customer" | "admin",
  canView: CanViewFn,
  can: CanFn,
  workspacesPlanLocked = false,
): ProfileMenuItem[] {
  if (variant === "admin") {
    return [
      { icon: Settings, label: "Admin Settings", href: "/admin/settings/platform" },
      { icon: UserCircle, label: "My Profile", href: "/admin/profile" },
    ];
  }

  const items: ProfileMenuItem[] = [];

  if (isAccountOwner || canView("profile")) {
    items.push({ icon: UserCircle, label: "Edit Profile", href: "/profile" });
  }

  if (isAccountOwner || canView("billing")) {
    items.push({
      icon: Receipt,
      label: isTeamMember && !isOwner ? "My Usage" : "Billing",
      href: "/billing",
    });
  }

  if (isAccountOwner || can("team", "viewGlobal")) {
    items.push({ icon: Users, label: "Team", href: "/team" });
  }

  if (isAccountOwner) {
    items.push({ icon: Shield, label: "Roles", href: "/roles" });
  }

  if (isAccountOwner || canView("workspaces")) {
    items.push({
      icon: Building2,
      label: WORKSPACES_HUB_LABEL,
      href: "/workspaces",
      locked: isAccountOwner && workspacesPlanLocked,
      lockedHint: workspacesPlanLocked ? "Upgrade to unlock" : undefined,
    });
  }

  if (isAccountOwner || canView("settings")) {
    items.push({ icon: Settings, label: "Settings", href: "/settings" });
  }

  return items;
}
