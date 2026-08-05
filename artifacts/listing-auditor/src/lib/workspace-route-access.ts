import type { WorkspaceAction, WorkspaceFeature } from "@workspace/workspace-permissions";

type CanFn = (feature: WorkspaceFeature, action: WorkspaceAction) => boolean;
type CanViewFn = (feature: WorkspaceFeature) => boolean;

/** Map a customer app path to the workspace feature that gates viewing the page. */
export function viewFeatureForPath(path: string): WorkspaceFeature | null {
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return null;
  if (p === "/marketplaces") return "build_brand";
  if (p === "/products") return "build_brand";
  if (p.startsWith("/products/")) return "build_brand";
  if (p === "/recent-projects") return "recent_projects";
  if (p === "/audit-listings") return "audits";
  if (p === "/audits/new" || p === "/audits/workflow") return "build_brand";
  if (p.startsWith("/audits/")) return "audits";
  if (p === "/projects" || p === "/projects/create") return "graphics";
  if (p.startsWith("/projects/")) return "graphics";
  if (p === "/videos") return "videos";
  if (p === "/ads") return "ads";
  if (p === "/archive") return "archive";
  if (p === "/team") return "team";
  if (p === "/roles") return null;
  if (p === "/workspaces" || p.startsWith("/workspaces/")) return "workspaces";
  if (p === "/billing") return "billing";
  if (p === "/profile") return "profile";
  if (p === "/settings") return "settings";
  if (p === "/notifications") return "notifications";
  return null;
}

export function canViewPath(
  path: string,
  isAccountOwner: boolean,
  canView: CanViewFn,
  can: CanFn,
): boolean {
  if (isAccountOwner) return true;
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return true;
  if (p === "/roles") return false;

  if (p === "/team") return can("team", "viewGlobal");
  if (p === "/workspaces" || p.startsWith("/workspaces/")) return canView("workspaces");
  if (p === "/notifications") return canView("notifications");
  if (p === "/profile") return canView("profile");
  if (p === "/settings") return canView("settings");
  if (p === "/billing") return canView("billing");

  if (p === "/audits/new" || p === "/audits/workflow") {
    return canView("build_brand") || canView("audits");
  }
  if (p.startsWith("/audits/")) {
    return canView("audits") || canView("build_brand");
  }

  const feature = viewFeatureForPath(p);
  if (!feature) return true;
  return canView(feature);
}

export function canCreateForPath(
  path: string,
  isAccountOwner: boolean,
  can: CanFn,
): boolean {
  if (isAccountOwner) return true;
  const p = path.split("?")[0] ?? path;
  if (p === "/audits/new" || p === "/audits/workflow") {
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
