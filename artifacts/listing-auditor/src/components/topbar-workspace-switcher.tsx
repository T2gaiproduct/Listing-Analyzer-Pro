import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Plus, Search, Check, LayoutGrid, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";
import {
  isAccountScopedRoute,
  isWorkspaceAdminOverviewRoute,
  parseWorkspaceRouteId,
} from "@/lib/workspace-routes";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const DROPDOWN_PREVIEW_LIMIT = 8;

type SortMode = "az" | "za";

/** Pages scoped to the account, not a single workspace — don't highlight one workspace in the switcher. */
function accountScopedPill(location: string): { name: string; subtitle: string } | null {
  if (location === "/roles") {
    return { name: "Account", subtitle: "Roles & permissions" };
  }
  return null;
}

export function TopbarWorkspaceSwitcher() {
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
  } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();

  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("az");
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });

  const canCreate = isAccountOwner || can("workspaces", "create");

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
  const hasMore = workspaces.length > DROPDOWN_PREVIEW_LIMIT;

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
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      refetch();
      setCreateOpen(false);
      setForm({ name: "", description: "", clientLabel: "" });
      if (ws?.id) setActiveWorkspaceId(ws.id);
      toast({ title: "Workspace created" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create workspace", description: err.message, variant: "destructive" }),
  });

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
      navigate("/dashboard");
      return;
    }

    if (isWorkspaceAdminOverviewRoute(location) || needsWorkspaceSelection) {
      navigate("/dashboard");
    }
  };

  const openWorkspaceHub = () => {
    setOpen(false);
    navigate("/workspaces");
  };

  const openActiveWorkspace = () => {
    setOpen(false);
    if (isAccountOwner) {
      if (onWorkspaceDashboard) {
        navigate("/workspaces");
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
  const onAccountScopedPage = isAccountScopedRoute(location);
  const accountPill = accountScopedPill(location);
  const viewedWorkspaceId = parseWorkspaceRouteId(location);
  const viewedWorkspace = viewedWorkspaceId
    ? workspaces.find((w) => w.id === viewedWorkspaceId) ?? null
    : null;

  const highlightedWorkspaceId = onWorkspaceDashboard
    ? null
    : viewedWorkspaceId ?? (onAccountScopedPage ? null : (activeWorkspaceId ?? featureWorkspaceId));

  const scopedWorkspace = viewedWorkspace ?? activeWorkspace ?? featureWorkspace;

  const pillName = onWorkspaceDashboard
    ? "All workspaces"
    : accountPill?.name
      ?? (viewedWorkspaceId != null
        ? (viewedWorkspace?.name ?? scopedWorkspace?.name ?? "Workspace")
        : needsWorkspaceSelection
          ? "Select workspace"
          : scopedWorkspace?.name ?? "Select workspace");
  const pillSubtitle = onWorkspaceDashboard
    ? "Manage pools & members"
    : accountPill?.subtitle
      ?? (viewedWorkspaceId != null
        ? (viewedWorkspace?.clientLabel?.trim() || scopedWorkspace?.clientLabel?.trim() || null)
        : needsWorkspaceSelection
          ? "Choose a workspace to continue"
          : (scopedWorkspace?.clientLabel?.trim() || null));

  if (!workspaces.length && !canCreate && !isLoading) return null;

  return (
    <>
      <div ref={rootRef} className="relative flex-shrink-0 hidden sm:flex items-center">
        <div
          className={cn(
            "flex items-center h-11 rounded-lg border bg-white transition-colors",
            open
              ? "border-orange-500 ring-2 ring-orange-200 bg-orange-50/30"
              : "border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200",
          )}
        >
          <button
            type="button"
            onClick={openActiveWorkspace}
            className="flex items-center gap-2 pl-2.5 pr-1 h-full min-w-0 max-w-[10rem] md:max-w-[12rem] lg:max-w-[14rem] rounded-l-lg focus:outline-none focus-visible:outline-none hover:bg-orange-50/50 transition-colors"
            aria-label={onWorkspaceDashboard ? "All workspaces" : `Workspace: ${pillName}${pillSubtitle ? `, ${pillSubtitle}` : ""}`}
            title={isAccountOwner ? "Manage all workspaces" : `Workspace: ${pillName}${pillSubtitle ? ` (${pillSubtitle})` : ""}`}
          >
            {onWorkspaceDashboard ? (
              <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : onAccountScopedPage && location === "/roles" ? (
              <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
            )}
            <div className="min-w-0 text-left hidden md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-none">Workspace</p>
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{pillName}</p>
              {pillSubtitle && (
                <p className="text-[10px] text-slate-400 leading-tight truncate">{pillSubtitle}</p>
              )}
            </div>
            <div className="min-w-0 text-left md:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-none">Workspace</p>
              <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[5.5rem]">{pillName}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={toggleDropdown}
            className="flex items-center justify-center w-8 h-full hover:bg-orange-50/50 transition-colors focus:outline-none focus-visible:outline-none"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Switch workspace"
          >
            <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          {canCreate && (
            <>
              <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
              <button
                type="button"
                title="Create workspace"
                onClick={() => {
                  setOpen(false);
                  setForm({ name: "", description: "", clientLabel: "" });
                  setCreateOpen(true);
                }}
                className="flex items-center justify-center w-9 h-full text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-r-lg transition-colors focus:outline-none focus-visible:outline-none"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {open && (
          <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45" />
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Switch workspace</p>
              <p className="text-xs text-slate-600 mt-0.5">Projects and data are scoped to the selected workspace.</p>
            </div>
            {isAccountOwner && (
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors border-b border-slate-100",
                  onWorkspaceDashboard && "bg-orange-50 text-orange-800",
                )}
                onClick={openWorkspaceHub}
              >
                <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span className="truncate flex-1 font-medium">All workspaces</span>
                {onWorkspaceDashboard && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
              </button>
            )}
            <div className="relative max-h-80 overflow-y-auto py-1">
              {isLoading && workspaces.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">Loading workspaces…</p>
              ) : (
                dropdownWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors",
                      highlightedWorkspaceId === ws.id && "bg-orange-50 text-orange-800",
                    )}
                    onClick={() => selectWorkspace(ws.id)}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium">{workspaceListLabel(ws)}</span>
                    {highlightedWorkspaceId === ws.id && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
            {hasMore && (
              <div className="border-t border-slate-100 py-2 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                  onClick={openSeeAll}
                >
                  See all
                </button>
              </div>
            )}
            {!hasMore && workspaces.length > 0 && (
              <div className="border-t border-slate-100 py-2 text-center">
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

      {/* Mobile: compact with label */}
      <button
        type="button"
        className="sm:hidden flex flex-col items-center justify-center min-w-[3.25rem] h-10 px-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 flex-shrink-0 hover:border-orange-400 hover:bg-orange-50/40 transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:border-orange-400"
        onClick={() => {
          if (isAccountOwner && onWorkspaceDashboard) {
            navigate("/workspaces");
          } else {
            openSeeAll();
          }
        }}
        aria-label={onWorkspaceDashboard ? "All workspaces" : `Workspace: ${pillName}`}
        title={onWorkspaceDashboard ? "All workspaces" : `Workspace: ${pillName}`}
      >
        <Building2 className="w-4 h-4 text-orange-500" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-none mt-0.5">Workspace</span>
        {onWorkspaceDashboard ? (
          <span className="text-[9px] font-semibold text-slate-800 leading-none truncate max-w-[4.5rem]">All</span>
        ) : (
          <span className="text-[9px] font-semibold text-slate-800 leading-none truncate max-w-[4.5rem]">{pillName}</span>
        )}
      </button>

      <Dialog open={seeAllOpen} onOpenChange={setSeeAllOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0 border border-slate-200 shadow-xl sm:rounded-lg overflow-hidden bg-white">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Switch workspace</p>
            <p className="text-xs text-slate-600 mt-0.5">Projects and data are scoped to the selected workspace.</p>
          </div>

          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workspaces…"
                className="h-9 pl-9 text-sm border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:border-orange-400"
              />
            </div>
          </div>

          {isAccountOwner && (
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors border-b border-slate-100",
                onWorkspaceDashboard && "bg-orange-50 text-orange-800",
              )}
              onClick={() => {
                setSeeAllOpen(false);
                navigate("/workspaces");
              }}
            >
              <LayoutGrid className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate flex-1 font-medium">All workspaces</span>
              {onWorkspaceDashboard && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
            </button>
          )}

          <div className="flex-1 overflow-y-auto min-h-[min(320px,50vh)] max-h-[55vh] py-1">
            {isLoading && workspaces.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">Loading workspaces…</p>
            ) : sortedWorkspaces.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">No workspaces match your search.</p>
            ) : (
              sortedWorkspaces.map((ws) => {
                const isCurrent = highlightedWorkspaceId === ws.id;
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
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium text-slate-800">{workspaceListLabel(ws)}</span>
                    {isCurrent && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 py-2.5 text-center shrink-0 bg-white">
            {isAccountOwner ? (
              <button
                type="button"
                className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                onClick={() => {
                  setSeeAllOpen(false);
                  navigate("/workspaces");
                }}
              >
                Manage workspaces
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
                className="text-sm font-medium text-slate-600 hover:text-orange-600 ml-4 hover:underline"
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
                placeholder="e.g. Acme Corp"
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
