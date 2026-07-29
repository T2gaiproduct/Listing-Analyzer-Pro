import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SidebarWorkspaceSwitcherProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarWorkspaceSwitcher({ collapsed, onNavigate }: SidebarWorkspaceSwitcherProps) {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    isAccountOwner,
    can,
    refetch,
    isLoading,
  } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [expanded, setExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsedOpen, setCollapsedOpen] = useState(false);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });

  const canCreate = isAccountOwner || can("workspaces", "create");
  const showSection = workspaces.length > 0 || canCreate;

  useEffect(() => {
    if (!collapsedOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (collapsedRef.current && !collapsedRef.current.contains(e.target as Node)) {
        setCollapsedOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [collapsedOpen]);

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
      onNavigate?.();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create workspace", description: err.message, variant: "destructive" }),
  });

  if (!showSection) return null;

  const selectWorkspace = (id: number) => {
    if (id === activeWorkspaceId) return;
    setActiveWorkspaceId(id);
    onNavigate?.();
  };

  const createDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="sidebar-ws-name">Name</Label>
            <Input
              id="sidebar-ws-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <Label htmlFor="sidebar-ws-client">Client label (optional)</Label>
            <Input
              id="sidebar-ws-client"
              value={form.clientLabel}
              onChange={(e) => setForm((f) => ({ ...f, clientLabel: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="sidebar-ws-desc">Description (optional)</Label>
            <Input
              id="sidebar-ws-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            onClick={() => createWorkspace.mutate()}
            disabled={!form.name.trim() || createWorkspace.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (collapsed) {
    return (
      <>
        <div className="px-2 mb-2 relative" ref={collapsedRef}>
        <button
          type="button"
          title={activeWorkspace?.name ?? "Workspaces"}
          onClick={() => setCollapsedOpen((v) => !v)}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-xl transition-colors mx-auto",
            collapsedOpen
              ? "bg-orange-500/15 text-orange-600"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Building2 className="w-5 h-5" />
        </button>
        {collapsedOpen && (
          <div className="absolute left-full top-0 ml-2 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-2">
            <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Workspaces</p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  selectWorkspace(ws.id);
                  setCollapsedOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50",
                  ws.id === activeWorkspaceId && "bg-orange-50 text-orange-700 font-medium",
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", ws.id === activeWorkspaceId ? "bg-orange-500" : "bg-slate-300")} />
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setForm({ name: "", description: "", clientLabel: "" });
                  setCreateOpen(true);
                  setCollapsedOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-orange-600 hover:bg-orange-50 border-t border-slate-100 mt-1"
              >
                <Plus className="w-4 h-4" />
                Create workspace
              </button>
            )}
          </div>
        )}
        </div>
        {createDialog}
      </>
    );
  }

  return (
    <>
      <div className={cn("mb-3", collapsed ? "px-2" : "px-3")}>
        <div className="flex items-center gap-1 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-sm font-semibold text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors py-1"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/50" />
            )}
            <Building2 className="w-4 h-4 flex-shrink-0 text-orange-500" />
            <span className="truncate">Workspaces</span>
          </button>
          {canCreate && (
            <button
              type="button"
              title="Create workspace"
              onClick={() => {
                setForm({ name: "", description: "", clientLabel: "" });
                setCreateOpen(true);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/80 border border-sidebar-border/50 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {isLoading && workspaces.length === 0 ? (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/50">Loading…</p>
            ) : (
              workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => selectWorkspace(ws.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors",
                      isActive
                        ? "bg-orange-500/15 text-orange-700 font-medium"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isActive ? "bg-orange-500" : "bg-sidebar-foreground/25",
                      )}
                    />
                    <span className="truncate flex-1">{ws.name}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {createDialog}
    </>
  );
}
