/** Customer workspace features — each maps to dashboard modules. */
export const WORKSPACE_FEATURES = [
  "dashboard",
  "build_brand",
  "audits",
  "competitors",
  "graphics",
  "recent_projects",
  "archive",
  "notifications",
  "team",
  "billing",
  "profile",
  "settings",
  "videos",
  "ads",
  "amazon",
  "workspaces",
  "credits",
] as const;

export type WorkspaceFeature = (typeof WORKSPACE_FEATURES)[number];

export const WORKSPACE_ACTIONS = [
  "viewGlobal",
  "viewOwn",
  "create",
  "edit",
  "delete",
] as const;

export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

export interface FeaturePermission {
  viewGlobal: boolean;
  viewOwn: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type WorkspaceRolePermissions = Partial<Record<WorkspaceFeature, FeaturePermission>>;

export interface WorkspaceFeatureMeta {
  id: WorkspaceFeature;
  label: string;
  group: string;
  /** Actions that apply to this feature (others shown disabled in UI). */
  actions: WorkspaceAction[];
  /** Product feature not launched yet — shown with Coming Soon badge in role UI. */
  comingSoon?: boolean;
}

/** Primary sidebar product features shown first in the role permissions matrix. */
export const WORKSPACE_PRODUCT_FEATURES: WorkspaceFeature[] = [
  "build_brand",
  "audits",
  "graphics",
  "videos",
  "ads",
];

/** Display order for permission matrix groups in the role editor. */
export const WORKSPACE_FEATURE_GROUP_ORDER = [
  "Features",
  "Overview",
  "Projects",
  "Workspace",
  "Account",
  "Advanced",
] as const;

export const WORKSPACE_FEATURE_META: WorkspaceFeatureMeta[] = [
  // ── Core product features (match left sidebar) ─────────────────────────────
  { id: "build_brand", label: "Build Your Brand", group: "Features", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"] },
  { id: "audits", label: "Audit Listing", group: "Features", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"] },
  { id: "graphics", label: "Create Graphics", group: "Features", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"] },
  { id: "videos", label: "Create Video", group: "Features", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"], comingSoon: true },
  { id: "ads", label: "Manage Ads", group: "Features", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"], comingSoon: true },

  // ── Overview ───────────────────────────────────────────────────────────────
  { id: "dashboard", label: "Dashboard", group: "Overview", actions: ["viewGlobal", "viewOwn"] },

  // ── Projects & history ─────────────────────────────────────────────────────
  { id: "recent_projects", label: "Recent Projects", group: "Projects", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"] },
  { id: "archive", label: "Archive", group: "Projects", actions: ["viewGlobal", "viewOwn", "edit", "delete"] },

  // ── Workspace admin ────────────────────────────────────────────────────────
  { id: "team", label: "Team & Members", group: "Workspace", actions: ["viewGlobal", "create", "edit", "delete"] },
  { id: "credits", label: "Credits", group: "Workspace", actions: ["viewGlobal", "edit"] },
  { id: "workspaces", label: "Workspaces", group: "Workspace", actions: ["viewGlobal", "create", "edit", "delete"] },

  // ── Account ────────────────────────────────────────────────────────────────
  { id: "notifications", label: "Notifications", group: "Account", actions: ["viewOwn", "edit", "delete"] },
  { id: "billing", label: "Billing", group: "Account", actions: ["viewGlobal", "edit"] },
  { id: "profile", label: "Profile", group: "Account", actions: ["viewOwn", "edit"] },
  { id: "settings", label: "Settings", group: "Account", actions: ["viewOwn", "edit"] },

  // ── Advanced / integrations ──────────────────────────────────────────────
  { id: "competitors", label: "Competitors", group: "Advanced", actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"] },
  { id: "amazon", label: "Amazon Integration", group: "Advanced", actions: ["viewOwn", "edit"] },
];

export const WORKSPACE_OWNER_ROLE_NAME = "Owner";
export const WORKSPACE_LEGACY_ROLES = ["admin", "editor", "viewer"] as const;
export type WorkspaceLegacyRole = (typeof WORKSPACE_LEGACY_ROLES)[number];

function emptyPermission(): FeaturePermission {
  return { viewGlobal: false, viewOwn: false, create: false, edit: false, delete: false };
}

function fullPermission(): FeaturePermission {
  return { viewGlobal: true, viewOwn: true, create: true, edit: true, delete: true };
}

function readOnlyGlobal(): FeaturePermission {
  return { viewGlobal: true, viewOwn: true, create: false, edit: false, delete: false };
}

function editorPermission(): FeaturePermission {
  return { viewGlobal: true, viewOwn: true, create: true, edit: true, delete: false };
}

/** Full access for account/workspace owners. */
export function ownerPermissions(): WorkspaceRolePermissions {
  const perms: WorkspaceRolePermissions = {};
  for (const f of WORKSPACE_FEATURES) {
    perms[f] = fullPermission();
  }
  return perms;
}

/** Legacy role presets — used when preserveLegacyMode is on or role has legacyRoleKey. */
export function legacyRolePermissions(role: WorkspaceLegacyRole | "owner"): WorkspaceRolePermissions {
  if (role === "owner") return ownerPermissions();

  const perms: WorkspaceRolePermissions = {};
  for (const meta of WORKSPACE_FEATURE_META) {
    if (role === "viewer") {
      if (meta.id === "billing" || meta.id === "workspaces" || meta.id === "team" || meta.id === "credits") {
        perms[meta.id] = emptyPermission();
      } else if (meta.id === "profile" || meta.id === "settings" || meta.id === "notifications") {
        perms[meta.id] = { ...emptyPermission(), viewOwn: true, edit: meta.id !== "notifications" };
      } else {
        perms[meta.id] = readOnlyGlobal();
      }
    } else if (role === "editor") {
      if (meta.id === "billing" || meta.id === "workspaces") {
        perms[meta.id] = emptyPermission();
      } else if (meta.id === "team") {
        perms[meta.id] = { ...emptyPermission(), viewGlobal: true };
      } else if (meta.id === "credits") {
        perms[meta.id] = { ...emptyPermission(), viewGlobal: true };
      } else if (meta.id === "profile" || meta.id === "settings" || meta.id === "notifications") {
        perms[meta.id] = { ...emptyPermission(), viewOwn: true, edit: true };
      } else {
        perms[meta.id] = editorPermission();
      }
    } else if (role === "admin") {
      if (meta.id === "billing") {
        perms[meta.id] = { ...emptyPermission(), viewGlobal: true };
      } else if (meta.id === "workspaces") {
        perms[meta.id] = { ...emptyPermission(), viewGlobal: true, create: true, edit: true };
      } else if (meta.id === "credits") {
        perms[meta.id] = { ...emptyPermission(), viewGlobal: true, edit: true };
      } else if (meta.id === "profile" || meta.id === "settings" || meta.id === "notifications") {
        perms[meta.id] = { ...emptyPermission(), viewOwn: true, edit: true };
      } else {
        perms[meta.id] = { ...editorPermission(), delete: true };
      }
    }
  }
  return perms;
}

export function hasWorkspacePermission(
  permissions: WorkspaceRolePermissions | null | undefined,
  feature: WorkspaceFeature,
  action: WorkspaceAction,
  opts?: { legacyRole?: WorkspaceLegacyRole | "owner"; useLegacy?: boolean },
): boolean {
  let perms = permissions;
  if (opts?.useLegacy && opts.legacyRole) {
    perms = legacyRolePermissions(opts.legacyRole);
  }
  if (opts?.legacyRole === "owner") return true;
  const fp = perms?.[feature];
  if (!fp) return false;
  return Boolean(fp[action]);
}

export function canViewInWorkspace(
  permissions: WorkspaceRolePermissions | null | undefined,
  feature: WorkspaceFeature,
  opts?: { legacyRole?: WorkspaceLegacyRole | "owner"; useLegacy?: boolean; isCreator?: boolean },
): boolean {
  if (opts?.legacyRole === "owner") return true;
  const global = hasWorkspacePermission(permissions, feature, "viewGlobal", opts);
  const own = hasWorkspacePermission(permissions, feature, "viewOwn", opts) && (opts?.isCreator ?? false);
  return global || own;
}

export function canWriteInWorkspace(
  permissions: WorkspaceRolePermissions | null | undefined,
  feature: WorkspaceFeature,
  action: "create" | "edit" | "delete",
  opts?: { legacyRole?: WorkspaceLegacyRole | "owner"; useLegacy?: boolean },
): boolean {
  if (opts?.legacyRole === "owner") return true;
  return hasWorkspacePermission(permissions, feature, action, opts);
}

export function mergePermissionsFromForm(
  form: Record<string, Partial<FeaturePermission>>,
): WorkspaceRolePermissions {
  const out: WorkspaceRolePermissions = {};
  for (const feature of WORKSPACE_FEATURES) {
    const row = form[feature];
    if (!row) continue;
    out[feature] = {
      viewGlobal: Boolean(row.viewGlobal),
      viewOwn: Boolean(row.viewOwn),
      create: Boolean(row.create),
      edit: Boolean(row.edit),
      delete: Boolean(row.delete),
    };
  }
  return out;
}
