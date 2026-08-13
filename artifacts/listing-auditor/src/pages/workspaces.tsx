import { useState, Fragment, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Building2,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Zap,
  Wallet,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/api-fetch";
import { refetchCreditQueries } from "@/lib/credit-queries";
import { setActiveWorkspaceId as setHeaderWorkspaceId } from "@/lib/workspace-header";
import { ResponsiveTable } from "@/components/responsive-table";
import { format } from "date-fns";
import { computePlanCreditsFromAllocations } from "@/lib/plan-credits";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";
import { WorkspacesPlanUpgradeBanner } from "@/components/workspaces-plan-upgrade";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "la_active_workspace_id";

interface CreditBuckets {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

interface WorkspaceMemberListItem {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  roleName: string | null;
  legacyRole?: string | null;
  userId?: string | null;
  allocatedCredits?: CreditBuckets;
  remainingCredits?: CreditBuckets;
  creditsUsedInPeriod?: number;
}

interface WorkspaceOverviewRow {
  id: number;
  name: string;
  description: string | null;
  clientLabel: string | null;
  isDefault: boolean;
  memberCount: number;
  activeMemberCount: number;
  pendingMemberCount: number;
  members: WorkspaceMemberListItem[];
  poolCredits?: CreditBuckets;
  poolCreditsTotal?: number;
  memberAllocatedCredits?: CreditBuckets;
  toMembersTotal?: number;
  poolAvailableForMembers?: CreditBuckets;
  creditsUsedInPeriod?: number;
  fundedTotal?: number;
  poolRemaining?: number;
}

interface WorkspaceOverview {
  totalWorkspaces: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  totalRoles: number;
  planName?: string | null;
  planCreditsTotal?: number;
  planCredits?: CreditBuckets;
  billingPeriod?: { start: string; end: string };
  accountUsedInPeriod?: number;
  accountCreditsTotal?: number;
  accountUnallocatedTotal?: number;
  accountBalancePlusUsed?: number;
  inWorkspacePoolsTotal?: number;
  inWorkspacePools?: CreditBuckets;
  ownerCredits?: CreditBuckets;
  availableToFundWorkspaces?: CreditBuckets;
  workspaces: WorkspaceOverviewRow[];
  workspacesEnabled?: boolean;
}

function sumCredits(c?: CreditBuckets | null): number {
  if (!c) return 0;
  return c.aiCredits + c.imageCredits + c.auditCredits;
}

function formatCreditBuckets(c: CreditBuckets): string {
  return `${c.auditCredits} audit · ${c.aiCredits} text · ${c.imageCredits} img`;
}

function workspacePoolTotal(ws: WorkspaceOverviewRow): number {
  if (ws.poolCreditsTotal != null) return ws.poolCreditsTotal;
  return sumCredits(ws.poolCredits);
}

function memberCreditsTotal(ws: WorkspaceOverviewRow): number {
  if (ws.toMembersTotal != null) return ws.toMembersTotal;
  const poolTotal = sumCredits(ws.poolCredits);
  if (poolTotal <= 0) return 0;
  return sumCredits(ws.memberAllocatedCredits);
}

function poolUnassignedTotal(ws: WorkspaceOverviewRow): number {
  if (ws.poolRemaining != null) return ws.poolRemaining;
  return sumCredits(ws.poolAvailableForMembers);
}

export default function WorkspacesPage() {
  const { workspaces, activeWorkspaceId, isAccountOwner, can, refetch, setActiveWorkspaceId } = useWorkspace();
  const { workspacesEnabled, upgradeShort } = useWorkspacesPlan();
  const workspacesLocked = isAccountOwner && !workspacesEnabled;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<typeof workspaces[0] | null>(null);
  const [form, setForm] = useState({ name: "", description: "", clientLabel: "" });
  const [fundingWorkspace, setFundingWorkspace] = useState<WorkspaceOverviewRow | null>(null);
  const [poolForm, setPoolForm] = useState({ aiCredits: "0", imageCredits: "0", auditCredits: "0" });
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<number>>(new Set());

  const canCreate = !workspacesLocked && (isAccountOwner || can("workspaces", "create"));
  const canEdit = !workspacesLocked && (isAccountOwner || can("workspaces", "edit"));
  const canDelete = !workspacesLocked && isAccountOwner;
  const canFundPools = !workspacesLocked && isAccountOwner;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["workspaces-overview"],
    queryFn: () => fetchJson<WorkspaceOverview>(`${basePath}/api/workspaces/overview`),
    enabled: isAccountOwner,
    staleTime: 15_000,
    refetchOnMount: "always",
  });

  const { data: sub } = useQuery<{
    planName: string | null;
    planAiCredits: number;
    planImageCredits: number;
    planAuditCredits: number;
    creditAllocations?: Record<string, number> | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null>({
    queryKey: ["user-subscription"],
    queryFn: () => fetch(`${basePath}/api/subscription`, { credentials: "include" }).then((r) => r.json()),
    enabled: isAccountOwner,
    staleTime: 30_000,
  });

  const { data: creditRules = [] } = useQuery<{ featureType: string; creditsRequired: number; isActive?: boolean }[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`).then((r) => r.json()),
    enabled: isAccountOwner,
    staleTime: 60_000,
  });

  const planCreditsTotal = useMemo(() => {
    if (overview?.planCreditsTotal != null) return overview.planCreditsTotal;
    if (overview?.planCredits) {
      const fromOverview = sumCredits(overview.planCredits);
      if (fromOverview > 0) return fromOverview;
    }
    if (sub) {
      const computed = computePlanCreditsFromAllocations(sub.creditAllocations, creditRules);
      if (computed.totalCredits > 0) return computed.totalCredits;
      return sub.planAiCredits + sub.planImageCredits + sub.planAuditCredits;
    }
    return 0;
  }, [overview, sub, creditRules]);

  const accountUnallocatedTotal = useMemo(() => {
    if (overview?.accountUnallocatedTotal != null) return overview.accountUnallocatedTotal;
    return sumCredits(overview?.availableToFundWorkspaces ?? overview?.ownerCredits);
  }, [overview]);

  const inWorkspacePoolsTotal = useMemo(() => {
    if (overview?.inWorkspacePoolsTotal != null) return overview.inWorkspacePoolsTotal;
    return overview?.workspaces?.length
      ? overview.workspaces.reduce((sum, ws) => sum + workspacePoolTotal(ws), 0)
      : 0;
  }, [overview]);

  const workspacePoolsBreakdown = useMemo(() => {
    if (!overview?.workspaces?.length) return "";
    const parts = overview.workspaces
      .filter((ws) => workspacePoolTotal(ws) > 0)
      .map((ws) => `${ws.name} ${workspacePoolTotal(ws).toLocaleString()}`);
    return parts.join(" + ");
  }, [overview]);

  const fundingPoolTotal = useMemo(() => {
    return (
      Math.max(0, parseInt(poolForm.auditCredits, 10) || 0) +
      Math.max(0, parseInt(poolForm.aiCredits, 10) || 0) +
      Math.max(0, parseInt(poolForm.imageCredits, 10) || 0)
    );
  }, [poolForm]);

  const accountCreditsTotal = useMemo(() => {
    if (overview?.accountCreditsTotal != null) return overview.accountCreditsTotal;
    return accountUnallocatedTotal + inWorkspacePoolsTotal;
  }, [overview, accountUnallocatedTotal, inWorkspacePoolsTotal]);

  const accountUsedInPeriod = overview?.accountUsedInPeriod ?? 0;

  const accountBalancePlusUsed = useMemo(() => {
    if (overview?.accountBalancePlusUsed != null) return overview.accountBalancePlusUsed;
    return accountCreditsTotal + accountUsedInPeriod;
  }, [overview, accountCreditsTotal, accountUsedInPeriod]);

  const planDisplayName = overview?.planName ?? sub?.planName ?? "Your plan";
  const billingPeriod = overview?.billingPeriod ?? (
    sub?.currentPeriodStart && sub?.currentPeriodEnd
      ? { start: sub.currentPeriodStart, end: sub.currentPeriodEnd }
      : null
  );

  const toggleExpanded = (id: number) => {
    setExpandedWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", clientLabel: "" });
    setOpen(true);
  };

  const openEdit = (ws: typeof workspaces[0]) => {
    setEditing(ws);
    setForm({
      name: ws.name,
      description: ws.description ?? "",
      clientLabel: ws.clientLabel ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        clientLabel: form.clientLabel.trim() || undefined,
      };
      if (editing) {
        return fetchJson(`${basePath}/api/workspaces/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return fetchJson(`${basePath}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      refetch();
      setOpen(false);
      toast({ title: editing ? "Workspace updated" : "Workspace created" });
    },
    onError: (err: Error) => toast({ title: "Failed to save workspace", description: err.message, variant: "destructive" }),
  });

  const deleteWorkspace = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/workspaces/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: async (_data, deletedId) => {
      const remaining = workspaces.filter((w) => w.id !== deletedId);
      if (activeWorkspaceId === deletedId) {
        const next = remaining.find((w) => w.isDefault) ?? remaining[0];
        if (next) {
          setActiveWorkspaceId(next.id);
        } else {
          setHeaderWorkspaceId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      qc.setQueryData<WorkspaceOverview>(["workspaces-overview"], (old) => {
        if (!old) return old;
        const nextWorkspaces = old.workspaces.filter((w) => w.id !== deletedId);
        return {
          ...old,
          totalWorkspaces: nextWorkspaces.length,
          workspaces: nextWorkspaces,
        };
      });
      qc.setQueryData<{ workspaces: typeof workspaces }>(["workspaces"], (old) => {
        if (!old) return old;
        return { workspaces: old.workspaces.filter((w) => w.id !== deletedId) };
      });

      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      await qc.invalidateQueries({ queryKey: ["archive"] });
      refetch();
      toast({
        title: "Workspace deleted",
        description: "It was moved to Archive → Workspaces. You can restore it from there.",
        action: (
          <Button variant="outline" size="sm" onClick={() => navigate("/archive?tab=workspaces")}>
            View Archive
          </Button>
        ),
      });
    },
    onError: () => toast({ title: "Failed to delete workspace", variant: "destructive" }),
  });

  const fundPool = useMutation({
    mutationFn: async () => {
      if (!fundingWorkspace) throw new Error("No workspace selected");
      return fetchJson(`${basePath}/api/workspaces/${fundingWorkspace.id}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiCredits: Math.max(0, parseInt(poolForm.aiCredits) || 0),
          imageCredits: Math.max(0, parseInt(poolForm.imageCredits) || 0),
          auditCredits: Math.max(0, parseInt(poolForm.auditCredits) || 0),
        }),
      });
    },
    onSuccess: () => {
      void refetchCreditQueries(qc);
      qc.invalidateQueries({ queryKey: ["workspaces-overview"] });
      setFundingWorkspace(null);
      toast({ title: "Workspace credit pool updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update pool", description: err.message, variant: "destructive" }),
  });

  const openFundPool = (ws: WorkspaceOverviewRow) => {
    setFundingWorkspace(ws);
    setPoolForm({
      aiCredits: String(ws.poolCredits?.aiCredits ?? 0),
      imageCredits: String(ws.poolCredits?.imageCredits ?? 0),
      auditCredits: String(ws.poolCredits?.auditCredits ?? 0),
    });
  };

  const displayWorkspaces: WorkspaceOverviewRow[] = isAccountOwner && overview
    ? overview.workspaces.map((ws) => ({
        ...ws,
        members: ws.members ?? [],
      }))
    : workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        description: ws.description,
        clientLabel: ws.clientLabel,
        isDefault: ws.isDefault,
        memberCount: 0,
        activeMemberCount: 0,
        pendingMemberCount: 0,
        members: [] as WorkspaceMemberListItem[],
      }));

  return (
    <div className="w-full min-w-0 mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-900">{WORKSPACES_HUB_LABEL}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isAccountOwner
              ? "Agency account hub — plan credits, workspace pools, member allocation, and usage."
              : "Manage client workspaces and members."}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New workspace
          </Button>
        )}
        {workspacesLocked && (
          <Button variant="outline" disabled className="gap-2 cursor-not-allowed opacity-70" title={upgradeShort}>
            <Plus className="w-4 h-4" />
            New workspace
          </Button>
        )}
      </div>

      {workspacesLocked && <WorkspacesPlanUpgradeBanner />}

      {isAccountOwner && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  Plan credits / month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">
                  {overviewLoading ? "—" : planCreditsTotal.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {planDisplayName}
                  {billingPeriod && (
                    <>
                      {" · "}
                      {format(new Date(billingPeriod.start), "MMM d")} –{" "}
                      {format(new Date(billingPeriod.end), "MMM d")}
                    </>
                  )}
                  {!overviewLoading && planCreditsTotal > 0 && (
                    <>
                      <br />
                      Plan allocation for this billing period (not your current balance).
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Unallocated (account)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  {overviewLoading ? "—" : accountUnallocatedTotal.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {overview?.availableToFundWorkspaces
                    ? formatCreditBuckets(overview.availableToFundWorkspaces)
                    : "Available to fund workspaces"}
                  {" · "}
                  matches top bar unallocated balance
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  In workspace pools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">
                  {overviewLoading ? "—" : inWorkspacePoolsTotal.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {overview?.inWorkspacePools
                    ? formatCreditBuckets(overview.inWorkspacePools)
                    : null}
                  {overview?.inWorkspacePools && workspacePoolsBreakdown ? " · " : null}
                  {workspacePoolsBreakdown
                    ? `${workspacePoolsBreakdown} = ${inWorkspacePoolsTotal.toLocaleString()}`
                    : `${overview?.totalWorkspaces ?? 0} workspace${overview?.totalWorkspaces === 1 ? "" : "s"}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Used this period</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">
                  {overviewLoading ? "—" : accountUsedInPeriod.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  In account + workspaces this period
                  <br />
                  Total in account: {accountCreditsTotal.toLocaleString()}
                  <br />
                  {accountCreditsTotal.toLocaleString()} remaining + {accountUsedInPeriod.toLocaleString()} used ={" "}
                  {accountBalancePlusUsed.toLocaleString()}
                  {planCreditsTotal > 0 && accountBalancePlusUsed === planCreditsTotal
                    ? " (matches plan)"
                    : planCreditsTotal > 0
                      ? ` · plan grants ${planCreditsTotal.toLocaleString()}`
                      : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">Workspace credits & usage</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Credits you funded to each client workspace. Members can only use what you assign from each pool.
              </p>
            </CardHeader>
            <CardContent className={cn("p-0 sm:px-6 sm:pb-6", workspacesLocked && "relative")}>
              {workspacesLocked && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center p-6">
                  <div className="max-w-md text-center space-y-3">
                    <p className="text-sm text-slate-700 font-medium">{upgradeShort}</p>
                    <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                      <Link href="/billing">Upgrade plan</Link>
                    </Button>
                  </div>
                </div>
              )}
              {overviewLoading ? (
                <p className="text-sm text-slate-500 px-6 pb-6">Loading…</p>
              ) : displayWorkspaces.length === 0 ? (
                <p className="text-sm text-slate-500 px-6 pb-6">No workspaces yet. Create one to fund client pools.</p>
              ) : (
                <ResponsiveTable minWidth="52rem">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="py-3 pr-3 w-8" />
                        <th className="py-3 pr-4">Workspace</th>
                        <th className="py-3 pr-4">Funded (pool)</th>
                        <th className="py-3 pr-4">To members</th>
                        <th className="py-3 pr-4">Used</th>
                        <th className="py-3 pr-4">Unassigned in pool</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayWorkspaces.map((ws) => {
                        const expanded = expandedWorkspaceIds.has(ws.id);
                        const memberAlloc = memberCreditsTotal(ws);
                        return (
                          <Fragment key={ws.id}>
                            <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="py-3 pr-3">
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(ws.id)}
                                  className="p-1 rounded hover:bg-slate-100"
                                  aria-expanded={expanded}
                                >
                                  {expanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                  )}
                                </button>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{ws.name}</p>
                                    {ws.clientLabel && (
                                      <p className="text-xs text-slate-500 truncate">{ws.clientLabel}</p>
                                    )}
                                  </div>
                                  {ws.isDefault && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-4 font-medium text-slate-800">
                                {workspacePoolTotal(ws).toLocaleString()}
                              </td>
                              <td className="py-3 pr-4 text-slate-600">{memberAlloc.toLocaleString()}</td>
                              <td className="py-3 pr-4 text-slate-600">
                                {(ws.creditsUsedInPeriod ?? 0).toLocaleString()}
                              </td>
                              <td className="py-3 pr-4 font-medium text-slate-800">
                                {poolUnassignedTotal(ws).toLocaleString()}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  <Button variant="ghost" size="sm" className="h-8 text-orange-600" onClick={() => openFundPool(ws)}>
                                    Fund
                                  </Button>
                                  <Link href={`/workspaces/${ws.id}/members`}>
                                    <Button variant="ghost" size="sm" className="h-8">Members</Button>
                                  </Link>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => openEdit(workspaces.find((w) => w.id === ws.id)!)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-red-600"
                                      onClick={() => {
                                        const message = ws.isDefault
                                          ? `Delete default workspace "${ws.name}"?`
                                          : `Delete workspace "${ws.name}"?`;
                                        if (confirm(message)) deleteWorkspace.mutate(ws.id);
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="bg-slate-50/60">
                                <td colSpan={7} className="px-4 py-3">
                                  {ws.members.length === 0 ? (
                                    <p className="text-xs text-slate-500">No members yet.</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-slate-500">
                                          <th className="py-2 pr-3 text-left font-medium">Member</th>
                                          <th className="py-2 pr-3 text-left font-medium">Role</th>
                                          <th className="py-2 pr-3 text-left font-medium">Status</th>
                                          <th className="py-2 pr-3 text-right font-medium">Allocated</th>
                                          <th className="py-2 pr-3 text-right font-medium">Used</th>
                                          <th className="py-2 text-right font-medium">Remaining</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ws.members.map((m) => (
                                          <tr key={m.id} className="border-t border-slate-100">
                                            <td className="py-2 pr-3 text-slate-800">
                                              {m.invitedName || m.invitedEmail}
                                            </td>
                                            <td className="py-2 pr-3 text-slate-600">{m.roleName ?? "—"}</td>
                                            <td className="py-2 pr-3 capitalize text-slate-600">{m.status}</td>
                                            <td className="py-2 pr-3 text-right text-slate-800">
                                              {sumCredits(m.allocatedCredits).toLocaleString()}
                                            </td>
                                            <td className="py-2 pr-3 text-right text-slate-600">
                                              {(m.creditsUsedInPeriod ?? 0).toLocaleString()}
                                            </td>
                                            <td className="py-2 text-right font-medium text-slate-800">
                                              {sumCredits(m.remainingCredits).toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                  {ws.poolCredits && (
                                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                                      <Zap className="w-3 h-3" />
                                      Pool detail: {formatCreditBuckets(ws.poolCredits)}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-4 text-center sm:text-left">
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{overview?.totalMembers ?? 0}</span> total members
            </div>
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{overview?.activeMembers ?? 0}</span> active
            </div>
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{overview?.pendingInvites ?? 0}</span> pending invites
            </div>
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{overview?.totalRoles ?? 0}</span> roles
            </div>
          </div>
        </div>
      )}

      {!isAccountOwner && (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayWorkspaces.map((ws) => (
            <Card key={ws.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <CardTitle className="text-lg truncate">{ws.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-400">
                  Your role: {workspaces.find((w) => w.id === ws.id)?.roleName ?? "Unassigned"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/workspaces/${ws.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5" />
                      Open
                    </Button>
                  </Link>
                  <Link href={`/workspaces/${ws.id}/members`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Members
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workspace" : "Create workspace"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ws-client">Client label (optional)</Label>
              <Input id="ws-client" placeholder="e.g. Acme Corp" value={form.clientLabel} onChange={(e) => setForm((f) => ({ ...f, clientLabel: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ws-desc">Description</Label>
              <Input id="ws-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fundingWorkspace != null} onOpenChange={(v) => !v && setFundingWorkspace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund workspace pool — {fundingWorkspace?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Move credits from your unallocated account balance into this workspace pool. Members are assigned only from this pool.
          </p>
          {overview?.availableToFundWorkspaces && (
            <p className="text-xs text-slate-500">
              Unallocated in account: {formatCreditBuckets(overview.availableToFundWorkspaces)}
            </p>
          )}
          {fundingWorkspace && (
            <p className="text-sm font-medium text-slate-800">
              This workspace pool: <span className="text-orange-600">{fundingPoolTotal.toLocaleString()}</span> credits total
              {fundingWorkspace.poolCredits && (
                <span className="text-xs font-normal text-slate-500">
                  {" "}
                  ({formatCreditBuckets({
                    auditCredits: Math.max(0, parseInt(poolForm.auditCredits, 10) || 0),
                    aiCredits: Math.max(0, parseInt(poolForm.aiCredits, 10) || 0),
                    imageCredits: Math.max(0, parseInt(poolForm.imageCredits, 10) || 0),
                  })})
                </span>
              )}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Each field is a credit type. Total pool = audit + text + images (e.g. 20 + 20 + 20 = 60 for this workspace).
          </p>
          <div className="grid grid-cols-3 gap-3 py-2">
            <div>
              <Label className="text-xs">Audit</Label>
              <Input type="number" min={0} value={poolForm.auditCredits} onChange={(e) => setPoolForm((f) => ({ ...f, auditCredits: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Text (AI)</Label>
              <Input type="number" min={0} value={poolForm.aiCredits} onChange={(e) => setPoolForm((f) => ({ ...f, aiCredits: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Images</Label>
              <Input type="number" min={0} value={poolForm.imageCredits} onChange={(e) => setPoolForm((f) => ({ ...f, imageCredits: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundingWorkspace(null)}>Cancel</Button>
            <Button onClick={() => fundPool.mutate()} disabled={fundPool.isPending}>
              {fundPool.isPending ? "Saving…" : "Update pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
