import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Plus, Search, Check, LayoutGrid, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";
import {
  isAccountScopedRoute,
  isWorkspaceAdminOverviewRoute,
  isWorkspaceApiScopeActive,
  parseWorkspaceRouteId,
} from "@/lib/workspace-routes";
import { WORKSPACES_HUB_LABEL, WORKSPACES_HUB_PATH } from "@/lib/workspaces-hub";
import { isAgencyAccountOverviewDashboard } from "@/lib/agency-dashboard-scope";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { egPlaceholderCompanyWithPrefix } from "@/lib/ecommerce-guru-placeholders";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";
import { applyWorkspaceCreated } from "@/lib/on-workspace-created";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const DROPDOWN_PREVIEW_LIMIT = 8;

type SortMode = "az" | "za";

/** Client label is already visible in the workspace name (e.g. "Client — Brand B"). */
function isRedundantWorkspacePillSubtitle(name: string, subtitle: string | null | undefined): boolean {
  if (!subtitle) return false;
  const s = subtitle.trim();
  if (!s) return false;
  const n = name.trim();
  if (n === s) return true;
  return n.includes(`— ${s}`) || n.includes(`| ${s}`);
}

/** Pages scoped to the account, not a single workspace — don't highlight one workspace in the switcher. */
function accountScopedPill(location: string): { name: string; subtitle: string } | null {
  if (location === "/roles") {
    return { name: "Account", subtitle: "Roles & permissions" };
  }
  return null;
}

type TopbarWorkspaceSwitcherProps = {
  placement?: "topbar" | "sidebar";
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function TopbarWorkspaceSwitcher({
  placement = "topbar",
  collapsed = false,
  onNavigate,
}: TopbarWorkspaceSwitcherProps = {}) {
  const isSidebar = placement === "sidebar";
  const [location, navigate] = useLocation();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    featureWorkspaceId,
    featureWorkspace,
    setActiveWorkspaceId,
    isAccountOwner,
    can,
    refetch,
    isLoading,
    needsWorkspaceSelection,
    isBillingAccountOwner,
    isAgencyAccountOverview,
    setAgencyAccountOverview,
  } = useWorkspace();
  const { workspacesEnabled, upgradeShort } = useWorkspacesPlan();
  const workspacesLocked = isAccountOwner && !workspacesEnabled;
  const accountWorkspacesAvailable = workspacesEnabled;
  const { toast } = useToast();
  const qc = useQueryClient();

  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("az");
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });

  const canCreate = accountWorkspacesAvailable && (isAccountOwner || can("workspaces", "create"));

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (seeAllOpen) {
      setSearch("");
      setSort("az");
    }
  }, [seeAllOpen]);

  const sortedWorkspaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = workspaces.filter((ws) => {
      if (!q) return true;
      return (
        ws.name.toLowerCase().includes(q) ||
        (ws.clientLabel?.toLowerCase().includes(q) ?? false)
      );
    });
    list = [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return sort === "az" ? cmp : -cmp;
    });
    return list;
  }, [workspaces, search, sort]);

  const dropdownWorkspaces = workspaces.slice(0, DROPDOWN_PREVIEW_LIMIT);
  const inlineDropdownWorkspaces = useMemo(() => {
    if (isSidebar) {
      return [...workspaces].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }
    return dropdownWorkspaces;
  }, [isSidebar, workspaces, dropdownWorkspaces]);
  const hasMore = !isSidebar && workspaces.length > DROPDOWN_PREVIEW_LIMIT;

  const createWorkspace = useMutation({
    mutationFn: async () =>
      fetchJson<{ id: number }>(`${basePath}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          clientLabel: form.clientLabel.trim() || undefined,
        }),
      }),
    onSuccess: (ws) => {
      setCreateOpen(false);
      const savedForm = { ...form };
      setForm({ name: "", description: "", clientLabel: "" });
      if (ws?.id) {
        applyWorkspaceCreated(qc, ws, savedForm, isAccountOwner, setActiveWorkspaceId);
      } else {
        void qc.invalidateQueries({ queryKey: ["workspaces"] });
      }
      refetch();
      toast({ title: "Workspace created" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create workspace", description: err.message, variant: "destructive" }),
  });

  const selectAccountOverview = () => {
    setAgencyAccountOverview(true);
    setOpen(false);
    setSeeAllOpen(false);
    if (location !== "/dashboard" && location !== "/") {
      navigate("/dashboard");
    }
    onNavigate?.();
  };

  const selectWorkspace = (id: number) => {
    setActiveWorkspaceId(id);
    setOpen(false);
    setSeeAllOpen(false);

    if (isAccountOwner) {
      if (isWorkspaceAdminOverviewRoute(location)) {
        navigate(`/workspaces/${id}`);
        return;
      }
      const wsRouteMatch = location.match(/^\/workspaces\/(\d+)(\/.*)?$/);
      if (wsRouteMatch) {
        const suffix = wsRouteMatch[2] ?? "";
        navigate(`/workspaces/${id}${suffix}`);
        return;
      }
      if (location === "/dashboard" || location === "/") {
        if (isBillingAccountOwner) {
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
          return;
        }
        navigate(`/workspaces/${id}`);
        return;
      }
      if (isWorkspaceApiScopeActive(location)) {
        return;
      }
      navigate(`/workspaces/${id}`);
      return;
    }

    if (isWorkspaceAdminOverviewRoute(location) || needsWorkspaceSelection) {
      navigate("/dashboard");
    }
    onNavigate?.();
  };

  const openActiveWorkspace = () => {
    if (isSidebar && showWorkspaceDropdown) {
      toggleDropdown();
      return;
    }
    setOpen(false);
    if (isAccountOwner) {
      if (onWorkspaceDashboard) {
        navigate("/dashboard");
        return;
      }
      navigate("/dashboard");
      return;
    }
    setOpen((v) => !v);
  };

  const workspaceListLabel = (ws: { name: string; clientLabel?: string | null }) => {
    const client = ws.clientLabel?.trim();
    return client ? `${ws.name} | ${client}` : ws.name;
  };

  const openSeeAll = () => {
    setOpen(false);
    setSeeAllOpen(true);
  };

  const toggleDropdown = () => setOpen((v) => !v);

  const onWorkspaceDashboard = isAccountOwner && isWorkspaceAdminOverviewRoute(location);
  const onAccountDashboard =
    isAgencyAccountOverviewDashboard(isBillingAccountOwner, isAgencyAccountOverview);
  const onBillingOwnerWorkspaceSelected =
    isBillingAccountOwner
    && !isAgencyAccountOverview
    && activeWorkspaceId != null;
  const onAccountScopedPage = isAccountScopedRoute(location);
  const accountPill = accountScopedPill(location);
  const viewedWorkspaceId = parseWorkspaceRouteId(location);
  const viewedWorkspace = viewedWorkspaceId
    ? workspaces.find((w) => w.id === viewedWorkspaceId) ?? null
    : null;

  const highlightedWorkspaceId = onWorkspaceDashboard
    ? null
    : onAccountDashboard
      ? null
      : viewedWorkspaceId ?? (onAccountScopedPage ? null : (activeWorkspaceId ?? featureWorkspaceId));

  const activeSelectionId =
    onAccountDashboard || onWorkspaceDashboard
      ? null
      : (activeWorkspaceId ?? highlightedWorkspaceId);

  const hasMultipleWorkspaces = workspaces.length > 1;
  const showWorkspaceDropdown =
    !isSidebar || hasMultipleWorkspaces || isBillingAccountOwner;

  const scopedWorkspace = viewedWorkspace ?? activeWorkspace ?? featureWorkspace;

  const billingOwnerScopedWorkspace = onBillingOwnerWorkspaceSelected
    ? (workspaces.find((w) => w.id === activeWorkspaceId) ?? activeWorkspace)
    : null;

  const pillName = onWorkspaceDashboard
    ? WORKSPACES_HUB_LABEL
    : onAccountDashboard
      ? "Account overview"
      : onBillingOwnerWorkspaceSelected
        ? (billingOwnerScopedWorkspace?.name ?? "Workspace")
      : accountPill?.name
      ?? (viewedWorkspaceId != null
        ? (viewedWorkspace?.name ?? scopedWorkspace?.name ?? "Workspace")
        : needsWorkspaceSelection
          ? "Select workspace"
          : scopedWorkspace?.name ?? "Select workspace");
  const pillSubtitle = onWorkspaceDashboard
    ? "Manage pools & members"
    : onAccountDashboard
      ? "All workspaces"
      : onBillingOwnerWorkspaceSelected
        ? (billingOwnerScopedWorkspace?.clientLabel?.trim() || null)
      : accountPill?.subtitle
      ?? (viewedWorkspaceId != null
        ? (viewedWorkspace?.clientLabel?.trim() || scopedWorkspace?.clientLabel?.trim() || null)
        : needsWorkspaceSelection
          ? "Choose a workspace to continue"
          : (scopedWorkspace?.clientLabel?.trim() || null));

  const displayPillSubtitle =
    pillSubtitle && !(isSidebar && isRedundantWorkspacePillSubtitle(pillName, pillSubtitle))
      ? pillSubtitle
      : null;

  if (!workspacesEnabled) return null;
  if (!workspaces.length && !canCreate && !isLoading && !isBillingAccountOwner) return null;

  if (isSidebar && collapsed) {
    return (
      <>
        <div className="px-2 mb-2">
          <button
            type="button"
            title={pillName}
            onClick={() => setSeeAllOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl mx-auto text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label={`Workspace: ${pillName}`}
          >
            <Building2 className="w-5 h-5 text-orange-500" />
          </button>
        </div>
        <Dialog open={seeAllOpen} onOpenChange={setSeeAllOpen}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0 border border-border shadow-xl sm:rounded-lg overflow-hidden bg-card">
            <div className="px-3 py-2.5 border-b border-border bg-muted/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Switch workspace</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[min(280px,45vh)] max-h-[55vh] py-1">
              {inlineDropdownWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => selectWorkspace(ws.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50",
                    activeSelectionId === ws.id && "bg-orange-500/15 text-orange-800 font-medium ring-1 ring-inset ring-orange-500/25",
                  )}
                >
                  <span className="truncate flex-1">{workspaceListLabel(ws)}</span>
                  {activeSelectionId === ws.id && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div>
                <Label htmlFor="topbar-ws-name-collapsed">Name</Label>
                <Input
                  id="topbar-ws-name-collapsed"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={egPlaceholderCompanyWithPrefix()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => createWorkspace.mutate()}
                disabled={!form.name.trim() || createWorkspace.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "relative flex-shrink-0 items-center",
          isSidebar ? "flex w-full px-3 mb-2" : "hidden lg:flex",
        )}
      >
        <div
          className={cn(
            "flex items-stretch rounded-md border-0 shadow-none transition-colors w-full",
            isSidebar ? "h-auto min-h-0 py-0.5" : "items-center h-10",
            isSidebar
              ? cn(
                  "rounded-xl border border-sidebar-border/40 bg-sidebar-accent/30",
                  open ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent/45",
                )
              : cn("bg-transparent", open ? "bg-muted/60" : "hover:bg-muted/45"),
          )}
        >
          <button
            type="button"
            onClick={openActiveWorkspace}
            className={cn(
              "flex items-center gap-2 pl-2.5 pr-1 min-w-0 flex-1 rounded-l-md focus:outline-none focus-visible:outline-none transition-colors",
              isSidebar ? "py-0.5 self-center" : "h-full max-w-[10rem] md:max-w-[12rem] lg:max-w-[14rem]",
            )}
            aria-label={onWorkspaceDashboard ? WORKSPACES_HUB_LABEL : `Workspace: ${pillName}${displayPillSubtitle ? `, ${displayPillSubtitle}` : ""}`}
            title={isAccountOwner ? WORKSPACES_HUB_LABEL : `Workspace: ${pillName}${displayPillSubtitle ? ` (${displayPillSubtitle})` : ""}`}
          >
            {onWorkspaceDashboard ? (
              <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : onAccountScopedPage && location === "/roles" ? (
              <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
            )}
            <div
              className={cn(
                "min-w-0 text-left flex-1",
                !isSidebar && "hidden md:block",
                isSidebar && "flex flex-col gap-0 py-0",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  isSidebar ? "leading-none text-sidebar-foreground/55" : "leading-none text-slate-500",
                )}
              >
                Workspace
              </p>
              <div className={cn(isSidebar && displayPillSubtitle && "flex flex-col gap-0")}>
                <p
                  className={cn(
                    "text-sm font-semibold truncate",
                    isSidebar ? "leading-tight text-sidebar-foreground" : "leading-tight text-slate-900",
                  )}
                >
                  {pillName}
                </p>
                {displayPillSubtitle && (
                  <p
                    className={cn(
                      "truncate",
                      isSidebar
                        ? "text-[10px] leading-tight text-sidebar-foreground/55"
                        : "text-[10px] leading-tight text-slate-400",
                    )}
                  >
                    {displayPillSubtitle}
                  </p>
                )}
              </div>
            </div>
            {!isSidebar && (
            <div className="min-w-0 text-left md:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-none">Workspace</p>
              <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[5.5rem]">{pillName}</p>
            </div>
            )}
          </button>
          {showWorkspaceDropdown && (
          <button
            type="button"
            onClick={toggleDropdown}
            className={cn(
              "flex items-center justify-center w-7 transition-colors focus:outline-none focus-visible:outline-none",
              isSidebar ? "self-center shrink-0 h-8" : "h-full w-8",
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Switch workspace"
          >
            <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          )}
          {canCreate ? (
            <>
              <div className="w-px self-stretch min-h-[1.25rem] my-auto bg-border/80 flex-shrink-0" />
              <button
                type="button"
                title="Create workspace"
                onClick={() => {
                  setOpen(false);
                  setForm({ name: "", description: "", clientLabel: "" });
                  setCreateOpen(true);
                }}
                className={cn(
                  "flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-r-lg transition-colors focus:outline-none focus-visible:outline-none",
                  isSidebar ? "self-center shrink-0 h-8 w-8" : "h-full w-9",
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          ) : workspacesLocked ? (
            <>
              <div className="w-px self-stretch min-h-[1.25rem] my-auto bg-border/80 flex-shrink-0" />
              <button
                type="button"
                title={upgradeShort}
                disabled
                className={cn(
                  "flex items-center justify-center text-slate-300 cursor-not-allowed rounded-r-lg",
                  isSidebar ? "self-center shrink-0 h-8 w-8" : "h-full w-9",
                )}
                onClick={() => toast({ title: "Upgrade required", description: upgradeShort })}
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          ) : null}
        </div>

        {open && (
          <div
            className={cn(
              "absolute left-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden",
              isSidebar ? "right-0 w-full" : "w-72",
            )}
          >
            <div className="absolute -top-1.5 left-6 w-3 h-3 bg-card border-l border-t border-border rotate-45" />
            <div className="px-3 py-2 border-b border-border bg-muted/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Switch workspace</p>
              <p className="text-xs text-muted-foreground mt-0.5">Projects and data are scoped to the selected workspace.</p>
            </div>
            <div className="relative max-h-80 overflow-y-auto py-1">
              {isBillingAccountOwner && (
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors border-b border-border",
                    onAccountDashboard && "bg-orange-50 text-orange-800",
                  )}
                  onClick={selectAccountOverview}
                >
                  <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="truncate flex-1 font-medium">Account overview</span>
                  {onAccountDashboard && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                </button>
              )}
              {isLoading && workspaces.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">Loading workspaces…</p>
              ) : (
                inlineDropdownWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors",
                      activeSelectionId === ws.id && cn(
                        "bg-orange-50 text-orange-800 font-medium",
                        isSidebar && "bg-orange-500/15 ring-1 ring-inset ring-orange-500/25",
                      ),
                    )}
                    onClick={() => selectWorkspace(ws.id)}
                  >
                    <span className="truncate flex-1">{workspaceListLabel(ws)}</span>
                    {activeSelectionId === ws.id && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
            {hasMore && (
              <div className="border-t border-border py-2 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                  onClick={openSeeAll}
                >
                  See all
                </button>
              </div>
            )}
            {!isSidebar && !hasMore && workspaces.length > 0 && (
              <div className="border-t border-border py-2 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                  onClick={openSeeAll}
                >
                  See all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!isSidebar && (
      <button
        type="button"
        className="sm:hidden flex flex-col items-center justify-center min-w-[3.25rem] h-10 px-1.5 rounded-md border-0 shadow-none bg-transparent text-muted-foreground flex-shrink-0 hover:bg-muted/45 transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/80"
        onClick={() => {
          if (isAccountOwner && onWorkspaceDashboard) {
            navigate(WORKSPACES_HUB_PATH);
          } else {
            openSeeAll();
          }
        }}
        aria-label={onWorkspaceDashboard ? WORKSPACES_HUB_LABEL : `Workspace: ${pillName}`}
        title={onWorkspaceDashboard ? WORKSPACES_HUB_LABEL : `Workspace: ${pillName}`}
      >
        <Building2 className="w-4 h-4 text-orange-500" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-none mt-0.5">Workspace</span>
        {onWorkspaceDashboard ? (
          <span className="text-[9px] font-semibold text-slate-800 leading-none truncate max-w-[4.5rem]">All</span>
        ) : (
          <span className="text-[9px] font-semibold text-slate-800 leading-none truncate max-w-[4.5rem]">{pillName}</span>
        )}
      </button>
      )}

      <Dialog open={seeAllOpen} onOpenChange={setSeeAllOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0 border border-border shadow-xl sm:rounded-lg overflow-hidden bg-card">
          <div className="px-3 py-2.5 border-b border-border bg-muted/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Switch workspace</p>
            <p className="text-xs text-muted-foreground mt-0.5">Projects and data are scoped to the selected workspace.</p>
          </div>

          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workspaces…"
                className="h-9 pl-9 text-sm border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:border-orange-400"
              />
            </div>
          </div>

          {isAccountOwner && (
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors border-b border-border",
                onWorkspaceDashboard && "bg-orange-50 text-orange-800",
              )}
              onClick={() => {
                setSeeAllOpen(false);
                navigate(WORKSPACES_HUB_PATH);
              }}
            >
              <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate flex-1 font-medium">{WORKSPACES_HUB_LABEL}</span>
              {onWorkspaceDashboard && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
            </button>
          )}

          {isBillingAccountOwner && (
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors border-b border-border",
                onAccountDashboard && "bg-orange-50 text-orange-800",
              )}
              onClick={() => {
                setSeeAllOpen(false);
                selectAccountOverview();
              }}
            >
              <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate flex-1 font-medium">Account overview</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">All workspaces</span>
              {onAccountDashboard && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
            </button>
          )}

          <div className="flex-1 overflow-y-auto min-h-[min(320px,50vh)] max-h-[55vh] py-1">
            {isLoading && workspaces.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">Loading workspaces…</p>
            ) : sortedWorkspaces.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">No workspaces match your search.</p>
            ) : (
              sortedWorkspaces.map((ws) => {
                const isCurrent = activeSelectionId === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => selectWorkspace(ws.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors",
                      isCurrent && "bg-orange-50 text-orange-800",
                    )}
                  >
                    <span className="truncate flex-1 font-medium text-slate-800">{workspaceListLabel(ws)}</span>
                    {isCurrent && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border py-2.5 text-center shrink-0 bg-card">
            {isAccountOwner ? (
              <button
                type="button"
                className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                onClick={() => {
                  setSeeAllOpen(false);
                  navigate(WORKSPACES_HUB_PATH);
                }}
              >
                {WORKSPACES_HUB_LABEL}
              </button>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                onClick={() => setSeeAllOpen(false)}
              >
                Close
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-orange-600 ml-4 hover:underline"
                onClick={() => {
                  setSeeAllOpen(false);
                  setForm({ name: "", description: "", clientLabel: "" });
                  setCreateOpen(true);
                }}
              >
                New workspace
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label htmlFor="topbar-ws-name">Name</Label>
              <Input
                id="topbar-ws-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={egPlaceholderCompanyWithPrefix()}
              />
            </div>
            <div>
              <Label htmlFor="topbar-ws-client">Client label (optional)</Label>
              <Input
                id="topbar-ws-client"
                value={form.clientLabel}
                onChange={(e) => setForm((f) => ({ ...f, clientLabel: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="topbar-ws-desc">Description (optional)</Label>
              <Input
                id="topbar-ws-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => createWorkspace.mutate()}
              disabled={!form.name.trim() || createWorkspace.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
