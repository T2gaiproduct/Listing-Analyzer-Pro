import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  TrendingUp,
  Clock,
  Wallet,
  ChevronRight,
  Plus,
  FilePlus2,
  FileSearch,
  Palette,
  Video,
  Megaphone,
  LayoutGrid,
  Zap,
  LineChart,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { useWorkspace } from "@/hooks/use-workspace";

import { fetchJson, ApiFetchError } from "@/lib/api-fetch";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DashboardData {
  greetingName: string | null;
  period: { start: string; end: string; billingStart: string; billingEnd: string };
  stats: {
    projectsSaved: number;
    projectsSavedThisWeek: number;
    totalAudits: number;
    auditsWeekOverWeekPct: number;
    timeSavedHours: number;
    timeSavedThisWeek: number;
    creditsBalance: number;
    creditsAllowance: number;
    creditScope?: "member" | "workspace_pool" | "account";
    isTeamMember?: boolean;
    teamCreditsUsedInPeriod?: number;
    memberCreditsAllocated?: number;
    workspaceCount?: number;
  };
  viewMode?: "account" | "workspace";
  impact: {
    listingsOptimized: number;
    issuesIdentified: number;
    timeSavedHours: number;
  };
  creditBreakdown: Array<{ key: string; label: string; balance: number; pct: number; color: string }>;
  recentProjects: Array<{
    type: string;
    id: number;
    name: string;
    typeLabel: string;
    statusLabel: string;
    statusColor: "orange" | "green" | "blue" | "red" | "gray";
    url: string;
    createdAt: string;
  }>;
  quickActions: Array<{ label: string; href: string; icon: string }>;
}

function formatHours(hours: number): string {
  if (hours >= 1) return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs`;
  return `${Math.round(hours * 60)} min`;
}

const STATUS_STYLES: Record<string, string> = {
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-slate-50 text-slate-600 border-slate-200",
};

const QUICK_ACTION_ICONS: Record<string, typeof FilePlus2> = {
  brand: FilePlus2,
  audit: FileSearch,
  graphics: Palette,
  video: Video,
  ads: Megaphone,
  projects: LayoutGrid,
};

function StatCard({
  title,
  value,
  subtext,
  subtextPositive,
  icon: Icon,
  href,
  locked,
  lockedHref,
}: {
  title: string;
  value: string | number;
  subtext: string;
  subtextPositive?: boolean;
  icon: typeof Folder;
  href?: string;
  locked?: boolean;
  lockedHref?: string;
}) {
  const card = (
    <div
      className={cn(
        "bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-3 sm:p-5 min-w-0",
        !locked && href && "hover:border-orange-300 hover:shadow-md hover:bg-orange-50/30 transition-all cursor-pointer",
        locked && "opacity-90 border-dashed border-amber-200 bg-amber-50/20",
      )}
    >
      <div className="flex items-center gap-2 sm:block">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
        </div>
        <p className="text-xs sm:text-sm text-slate-500 sm:mt-4 truncate min-w-0">{title}</p>
      </div>
      <p className="text-xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-1 tracking-tight">{value}</p>
      <p className={cn(
        "text-[10px] sm:text-xs mt-1 sm:mt-2 line-clamp-2 leading-snug",
        locked ? "text-amber-700" : subtextPositive ? "text-emerald-600" : "text-slate-400",
      )}>
        {subtext}
      </p>
    </div>
  );

  if (locked && lockedHref) {
    return (
      <Link href={lockedHref} className="block min-w-0 rounded-xl sm:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        {card}
      </Link>
    );
  }

  if (href && !locked) {
    return (
      <Link href={href} className="block min-w-0 rounded-xl sm:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        {card}
      </Link>
    );
  }

  return card;
}

function DonutChart({ data, total }: { data: DashboardData["creditBreakdown"]; total: number }) {
  const chartData = data.filter((d) => d.balance > 0);
  const display = chartData.length > 0 ? chartData : data;

  return (
    <div className="relative h-40 sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={display}
            dataKey="balance"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="48%"
            outerRadius="68%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {display.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xl sm:text-2xl font-bold text-slate-900">{total.toLocaleString()}</p>
        <p className="text-[10px] sm:text-xs text-slate-500">Total Credits</p>
      </div>
    </div>
  );
}

function MemberHomePanel({
  name,
  roleName,
  workspaceName,
  creditsBalance,
  actions,
}: {
  name: string;
  roleName: string;
  workspaceName: string;
  creditsBalance: number;
  actions: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Welcome, {name}! 👋
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">
          You&apos;re a <span className="font-medium text-slate-700">{roleName}</span> on{" "}
          <span className="font-medium text-slate-700">{workspaceName}</span>.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Your credits</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{creditsBalance}</p>
          <p className="text-xs text-slate-500 mt-1">Allocated by your workspace owner</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Your access</p>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">
            Use the sidebar to open the tools your role allows. If something is missing, ask your workspace owner to update your role on the Team page.
          </p>
        </div>
      </div>
      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900 mb-3">Quick links</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action.href} asChild variant="outline" size="sm">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isTeamMember, memberCredits } = useTeam();
  const {
    featureWorkspaceId,
    featureWorkspace,
    activeWorkspaceId,
    isLoading: wsLoading,
    needsWorkspaceSelection,
    canView,
    isAccountOwner,
    isTeamMemberAccount,
    roleName,
    workspaces,
    isWorkspaceApiScopeActive,
    refetch: refetchWorkspaces,
    isBillingAccountOwner,
    profileLoading,
  } = useWorkspace();
  const { workspacesEnabled, includedPlansLabel } = useWorkspacesPlan();

  const needsAutoWorkspace =
    isBillingAccountOwner && workspaces.length === 0 && !wsLoading;
  const [workspaceProvisionAttempted, setWorkspaceProvisionAttempted] = useState(false);
  const provisioningWorkspace = needsAutoWorkspace && !workspaceProvisionAttempted;

  useEffect(() => {
    if (!needsAutoWorkspace || workspaceProvisionAttempted) return;
    setWorkspaceProvisionAttempted(true);
    void refetchWorkspaces();
  }, [needsAutoWorkspace, workspaceProvisionAttempted, refetchWorkspaces]);

  const hasSharedWorkspace = workspaces.some((w) => !w.isAccountOwner);
  const memberWorkspaceId = isBillingAccountOwner ? null : (featureWorkspaceId ?? activeWorkspaceId);
  const isMemberView = isTeamMemberAccount || (isTeamMember && hasSharedWorkspace);

  const memberActions = [
    { href: "/audits/new", label: "Build Your Brand", feature: "build_brand" as const },
    { href: "/audit-listings", label: "Audit Listings", feature: "audits" as const },
    { href: "/projects", label: "Create Graphics", feature: "graphics" as const },
    { href: "/videos", label: "Create Videos", feature: "videos" as const },
    { href: "/ads", label: "Manage Ads", feature: "ads" as const },
    { href: "/recent-projects", label: "Recent Projects", feature: "recent_projects" as const },
  ].filter((item) => isAccountOwner || canView(item.feature));

  const newProjectActions = [
    { href: "/audits/new", label: "Build Your Brand", feature: "build_brand" as const },
    { href: "/audit-listings", label: "Audit Listings", feature: "audits" as const },
    { href: "/projects/create", label: "Create Graphics", feature: "graphics" as const },
    { href: "/videos", label: "Create Videos", feature: "videos" as const },
    { href: "/ads", label: "Manage Ads", feature: "ads" as const },
  ].filter((item) => isAccountOwner || canView(item.feature));

  const defaultOwnedWorkspaceId =
    workspaces.find((w) => w.isAccountOwner && w.isDefault)?.id
    ?? workspaces.find((w) => w.isAccountOwner)?.id
    ?? activeWorkspaceId;

  async function loadDashboardData(): Promise<DashboardData> {
    if (isBillingAccountOwner) {
      try {
        return await fetchJson<DashboardData>(
          `${basePath}/api/dashboard?scope=account`,
          { skipWorkspaceHeader: true },
        );
      } catch (err) {
        const wsId = defaultOwnedWorkspaceId ?? activeWorkspaceId;
        if (wsId != null && err instanceof ApiFetchError && err.status >= 400) {
          return await fetchJson<DashboardData>(`${basePath}/api/dashboard`);
        }
        throw err;
      }
    }
    return await fetchJson<DashboardData>(`${basePath}/api/dashboard`);
  }

  const showWorkspacePoolCredits =
    !isBillingAccountOwner
    && isAccountOwner
    && !isTeamMember
    && featureWorkspaceId != null
    && isWorkspaceApiScopeActive;

  const { data: dashboard, isLoading, isFetching, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", isBillingAccountOwner ? "account" : featureWorkspaceId, defaultOwnedWorkspaceId],
    queryFn: () => loadDashboardData(),
    enabled:
      clerkLoaded
      && !!user
      && !profileLoading
      && (isBillingAccountOwner || !!featureWorkspaceId)
      && (isBillingAccountOwner || isAccountOwner || canView("dashboard")),
    staleTime: 30_000,
    retry: (failureCount, err) => {
      if (err instanceof ApiFetchError && err.status >= 400) return failureCount < 1;
      return failureCount < 3;
    },
  });

  const { data: workspacePoolData } = useQuery<{
    poolCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
    memberAllocatedCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
  }>({
    queryKey: ["workspace-pool-credits", featureWorkspaceId],
    queryFn: () =>
      fetchJson<{
        poolCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
        memberAllocatedCredits?: { aiCredits: number; imageCredits: number; auditCredits: number };
      }>(`${basePath}/api/workspaces/${featureWorkspaceId}/members`),
    enabled: clerkLoaded && !!user && showWorkspacePoolCredits,
    staleTime: 30_000,
  });

  const memberName =
    user?.firstName ?? user?.fullName?.split(" ")[0] ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "there";
  const memberCreditTotal =
    (memberCredits?.auditCredits ?? 0) + (memberCredits?.aiCredits ?? 0) + (memberCredits?.imageCredits ?? 0);

  if (isMemberView && memberWorkspaceId && !canView("dashboard") && !isAccountOwner) {
    return (
      <MemberHomePanel
        name={memberName}
        roleName={roleName}
        workspaceName={featureWorkspace?.name ?? workspaces.find((w) => w.id === memberWorkspaceId)?.name ?? "your workspace"}
        creditsBalance={memberCreditTotal}
        actions={memberActions.map(({ href, label }) => ({ href, label }))}
      />
    );
  }

  if (wsLoading || provisioningWorkspace || (isLoading && !isError && (isBillingAccountOwner || memberWorkspaceId))) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-64 sm:h-12 sm:w-96" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 sm:h-36 rounded-xl sm:rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if ((!memberWorkspaceId && !isMemberView && !isBillingAccountOwner) || (needsWorkspaceSelection && !isMemberView)) {
    if (wsLoading || provisioningWorkspace) {
      return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in">
          <Skeleton className="h-10 w-64 sm:h-12 sm:w-96" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 sm:h-36 rounded-xl sm:rounded-2xl" />)}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Folder className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">Select a workspace</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Pick a workspace in the top bar to view its overview, or manage all workspaces to fund pools and members.
        </p>
        <Button asChild className="mt-6 bg-orange-500 hover:bg-orange-600">
          <Link href="/workspaces">{WORKSPACES_HUB_LABEL}</Link>
        </Button>
      </div>
    );
  }

  if (!dashboard || isError) {
    if (isMemberView && memberWorkspaceId) {
      return (
        <MemberHomePanel
          name={memberName}
          roleName={roleName}
          workspaceName={featureWorkspace?.name ?? workspaces.find((w) => w.id === memberWorkspaceId)?.name ?? "your workspace"}
          creditsBalance={memberCreditTotal}
          actions={memberActions.map(({ href, label }) => ({ href, label }))}
        />
      );
    }
    return (
      <div className="text-center py-16 text-slate-500 px-4">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-orange-500" />
        <p>Could not load dashboard data.</p>
        {error instanceof Error && error.message && (
          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">{error.message}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">Restart the API server after deploying the latest code.</p>
        <button
          type="button"
          onClick={() => {
            void refetchWorkspaces();
            void refetch();
          }}
          className="mt-4 text-sm font-medium text-orange-500 hover:text-orange-600"
        >
          Try again
        </button>
      </div>
    );
  }

  const name = dashboard.greetingName
    ?? user?.firstName
    ?? user?.fullName?.split(" ")[0]
    ?? "there";
  const { stats, impact, recentProjects, quickActions } = dashboard;
  const auditsTrendPositive = stats.auditsWeekOverWeekPct >= 0;

  const memberPool = memberCredits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const memberBalance = memberPool.auditCredits + memberPool.aiCredits + memberPool.imageCredits;
  const showMemberCredits =
    stats.creditScope === "member" || (!isAccountOwner && (isTeamMember || stats.isTeamMember));

  const workspacePoolCredits = workspacePoolData?.poolCredits;
  const workspacePoolBalance = workspacePoolCredits
    ? workspacePoolCredits.auditCredits + workspacePoolCredits.aiCredits + workspacePoolCredits.imageCredits
    : null;

  const creditsBalance = showMemberCredits
    ? memberBalance
    : showWorkspacePoolCredits && workspacePoolBalance != null
      ? workspacePoolBalance
      : stats.creditsBalance;
  const creditsAllowance = showMemberCredits ? (stats.creditsAllowance ?? 0) : stats.creditsAllowance;
  const creditScopeLabel = showMemberCredits
    ? "member"
    : showWorkspacePoolCredits && (workspacePoolBalance != null || stats.creditScope === "workspace_pool")
      ? "workspace_pool"
      : stats.creditScope ?? "account";

  const workspacePoolBreakdown = workspacePoolCredits
    ? [
        { key: "audit", label: "Audit Credits", balance: workspacePoolCredits.auditCredits, color: "#f97316" },
        { key: "graphic", label: "Graphic Credits", balance: workspacePoolCredits.imageCredits, color: "#1e293b" },
        { key: "brand", label: "Brand Credits", balance: workspacePoolCredits.aiCredits, color: "#94a3b8" },
      ]
    : null;

  const creditBreakdown = showMemberCredits
    ? [
        { key: "audit", label: "Audit Credits", balance: memberPool.auditCredits, color: "#f97316" },
        { key: "graphic", label: "Graphic Credits", balance: memberPool.imageCredits, color: "#1e293b" },
        { key: "brand", label: "Brand Credits", balance: memberPool.aiCredits, color: "#94a3b8" },
      ]
        .filter((seg) => seg.balance > 0)
        .map((seg) => {
          const total = memberBalance || 1;
          return { ...seg, pct: Math.round((seg.balance / total) * 100) };
        })
    : showWorkspacePoolCredits && workspacePoolBreakdown
      ? workspacePoolBreakdown
          .filter((seg) => seg.balance > 0)
          .map((seg) => {
            const total = workspacePoolBalance || 1;
            return { ...seg, pct: Math.round((seg.balance / total) * 100) };
          })
      : dashboard.creditBreakdown;

  return (
    <div className={cn("space-y-4 sm:space-y-6 animate-in fade-in duration-500 w-full min-w-0", isFetching && "opacity-90")}>
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {name}! 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-0.5 sm:mt-1">
            {isBillingAccountOwner || dashboard.viewMode === "account"
              ? "Account overview across all your workspaces."
              : <>Overview for <span className="font-medium text-slate-700">{featureWorkspace?.name ?? "this workspace"}</span>.</>}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shrink-0" disabled={newProjectActions.length === 0}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {newProjectActions.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title="Projects Saved"
          value={stats.projectsSaved}
          subtext={`+${stats.projectsSavedThisWeek} this week`}
          subtextPositive
          icon={Folder}
        />
        <StatCard
          title="Total Audits"
          value={stats.totalAudits}
          subtext={`${auditsTrendPositive ? "+" : ""}${stats.auditsWeekOverWeekPct}% vs last week`}
          subtextPositive={auditsTrendPositive}
          icon={TrendingUp}
        />
        <StatCard
          title={isBillingAccountOwner ? "Number of Workspaces" : "Time Saved"}
          value={
            isBillingAccountOwner
              ? (stats.workspaceCount ?? workspaces.filter((w) => w.isAccountOwner).length)
              : formatHours(stats.timeSavedHours)
          }
          subtext={
            isBillingAccountOwner
              ? workspacesEnabled
                ? stats.workspaceCount === 1 ? "Active workspace" : "Active workspaces"
                : `Upgrade to ${includedPlansLabel} to manage multiple workspaces`
              : "From AI tasks completed"
          }
          icon={isBillingAccountOwner ? LayoutGrid : Clock}
          href={isBillingAccountOwner && workspacesEnabled ? "/workspaces" : undefined}
          locked={isBillingAccountOwner && !workspacesEnabled}
          lockedHref={isBillingAccountOwner && !workspacesEnabled ? "/billing" : undefined}
        />
        <StatCard
          title="Credits Balance"
          value={creditsBalance.toLocaleString()}
          subtext={
            showMemberCredits
              ? creditsAllowance > 0
                ? `of ${creditsAllowance.toLocaleString()} allocated by owner`
                : "No credits allocated yet"
              : creditScopeLabel === "workspace_pool"
                ? creditsAllowance > 0
                  ? `of ${creditsAllowance.toLocaleString()} assigned to this workspace`
                  : `No credits assigned — fund on ${WORKSPACES_HUB_LABEL}`
                : (stats.teamCreditsUsedInPeriod ?? 0) > 0
                  ? `${(stats.teamCreditsUsedInPeriod ?? 0).toLocaleString()} used by team · ${(stats.memberCreditsAllocated ?? 0).toLocaleString()} assigned`
                  : `of ${creditsAllowance.toLocaleString()} credits`
          }
          icon={Wallet}
        />
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Impact card */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Your Impact This Week</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">You&apos;re doing great! Here&apos;s the value you&apos;ve created.</p>
                <ul className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                  <li className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Listings Optimized</p>
                      <p className="text-xs text-slate-500">Improve visibility and ranking</p>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0 ml-2">{impact.listingsOptimized}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Key Issues Identified</p>
                      <p className="text-xs text-slate-500">Fixed or flagged for improvement</p>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0 ml-2">{impact.issuesIdentified}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Time Saved</p>
                      <p className="text-xs text-slate-500">By using SellerLens</p>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-slate-900 shrink-0 ml-2">{formatHours(impact.timeSavedHours)}</span>
                  </li>
                </ul>
              </div>
              <div className="hidden sm:flex w-40 items-center justify-center">
                <div className="relative w-32 h-32">
                  <div className="absolute inset-0 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    <LineChart className="w-12 h-12 text-orange-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent projects */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Recent Projects</h2>
              <Link
                href="/recent-projects"
                className="text-sm font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1"
              >
                View All Projects <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {recentProjects.length === 0 ? (
              <div className="px-4 py-10 sm:px-6 sm:py-12 text-center text-slate-500 text-sm">
                No projects yet. Start with a quick action below.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentProjects.map((project) => (
                  <li key={`${project.type}-${project.id}`}>
                    <Link href={project.url}>
                      <div className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-6 sm:py-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-orange-600 transition-colors">
                            {project.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {project.typeLabel} • {format(new Date(project.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <span className={cn(
                          "text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0",
                          STATUS_STYLES[project.statusColor] ?? STATUS_STYLES.gray,
                        )}>
                          {project.statusLabel}
                        </span>
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 group-hover:text-orange-400 flex-shrink-0" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Credits donut */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">Credits Usage</h2>
            <DonutChart data={creditBreakdown} total={creditsBalance} />
            {creditBreakdown.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 text-center">
                {showMemberCredits
                  ? "No credits allocated yet. Ask your workspace owner to assign credits."
                  : "No credits available."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {creditBreakdown.map((seg) => (
                  <li key={seg.key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-slate-600">{seg.label}</span>
                    </div>
                    <span className="text-slate-800 font-medium">
                      {seg.balance.toLocaleString()} ({seg.pct}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/billing"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-600"
            >
              View Detailed Usage <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {quickActions.map((action) => {
                const Icon = QUICK_ACTION_ICONS[action.icon] ?? FilePlus2;
                return (
                  <Link key={action.href + action.label} href={action.href}>
                    <button
                      type="button"
                      className="w-full flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-orange-50 hover:border-orange-200 transition-colors text-center min-h-[72px] sm:min-h-[88px]"
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">{action.label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <Zap className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Tip: Use credits wisely to get the most out of your plan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
