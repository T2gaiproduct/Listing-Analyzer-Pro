import type { WorkspaceAction, WorkspaceFeature } from "@workspace/workspace-permissions";

type CanFn = (feature: WorkspaceFeature, action: WorkspaceAction) => boolean;
type CanViewFn = (feature: WorkspaceFeature) => boolean;

/** Map a customer app path to the workspace feature that gates viewing the page. */
export function viewFeatureForPath(path: string): WorkspaceFeature | null {
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return null;
  if (p === "/marketplaces") return "amazon";
  if (p === "/ai") return "sellermate_ai";
  if (p === "/products") return "build_brand";
  if (p.startsWith("/products/")) return "build_brand";
  if (p === "/recent-projects") return "recent_projects";
  if (p === "/audit-listings") return "audits";
  if (p === "/audits/new" || p === "/audits/workflow") return "build_brand";
  if (p.startsWith("/audits/")) return "audits";
  if (p === "/projects" || p === "/projects/create") return "graphics";
  if (p.startsWith("/projects/")) return "graphics";
  if (p === "/videos") return "videos";
  if (p === "/ads" || p.startsWith("/ads/")) return "ads";
  if (p === "/archive") return "archive";
  if (p === "/team") return "team";
  if (p === "/roles") return null;
  if (p === "/workspaces" || p.startsWith("/workspaces/")) return "workspaces";
  if (p === "/billing") return "billing";
  if (p === "/profile") return "profile";
  if (p === "/settings") return "settings";
  if (p === "/support-ticket") return null;
  if (p === "/notifications") return "notifications";
  return null;
}

export function canViewPath(
  path: string,
  isWorkspaceAccountOwner: boolean,
  isBillingAccountOwner: boolean,
  canView: CanViewFn,
  can: CanFn,
): boolean {
  if (isWorkspaceAccountOwner || isBillingAccountOwner) return true;
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return true;
  if (p === "/roles") return false;

  // Direct project viewing via shared link (e.g. /audits/:id, /projects/:id, /audits/workflow?resume=..., /products/:id):
  // Any authenticated user with the direct link can view the project in read-only mode.
  // Full project creation and edits remain strictly enforced by permission checks.
  if (p.startsWith("/audits/") || p.startsWith("/projects/") || p.startsWith("/products/")) {
    return true;
  }

  if (p === "/team") return can("team", "viewGlobal");
  if (p === "/workspaces" || p.startsWith("/workspaces/")) return canView("workspaces");
  if (p === "/notifications") return canView("notifications");
  if (p === "/profile") return canView("profile");
  if (p === "/settings") return canView("settings");
  if (p === "/billing") return canView("billing");

  if (p === "/audits/new") {
    return canView("build_brand") || canView("audits");
  }

  const feature = viewFeatureForPath(p);
  if (!feature) return true;
  return canView(feature);
}

/** True when the route needs a committed workspace (not account-wide dashboard / admin hub). */
export function pathRequiresCommittedWorkspace(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return false;
  if (p === "/billing" || p === "/profile" || p === "/settings" || p === "/support-ticket" || p === "/notifications") return false;
  if (p === "/workspaces" || p.startsWith("/workspaces/")) return false;
  return true;
}

export function canCreateForPath(
  path: string,
  isWorkspaceAccountOwner: boolean,
  isBillingAccountOwner: boolean,
  can: CanFn,
): boolean {
  if (isWorkspaceAccountOwner || isBillingAccountOwner) return true;
  const p = path.split("?")[0] ?? path;
  if (p === "/audits/workflow") {
    // Opening an existing project via /audits/workflow?resume=... is viewing an existing workflow project,
    // not creating a new one. Full creation permission is enforced when creating new drafts.
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    if (params.get("resume")) return true;
    return can("build_brand", "create") || can("audits", "create");
  }
  if (p === "/audits/new") {
    return can("build_brand", "create") || can("audits", "create");
  }
  if (p === "/projects/create") return can("graphics", "create");
  if (p === "/audit-listings") return can("audits", "create");
  return true;
}

export function projectTypeToFeature(type: string): WorkspaceFeature {
  switch (type) {
    case "audit":
    case "listing":
      return "audits";
    case "graphics":
    case "project":
      return "graphics";
    case "video":
      return "videos";
    case "ad":
    case "ads":
      return "ads";
    default:
      return "audits";
  }
}
