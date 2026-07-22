import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Folder,
  TrendingUp,
  Clock,
  Wallet,
  ChevronRight,
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
import { useSidebarProjects } from "@/contexts/sidebar-projects";
import { useTeam } from "@/hooks/use-team";

import { fetchJson } from "@/lib/api-fetch";

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
    isTeamMember?: boolean;
    teamCreditsUsedInPeriod?: number;
    memberCreditsAllocated?: number;
  };
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
}: {
  title: string;
  value: string | number;
  subtext: string;
  subtextPositive?: boolean;
  icon: typeof Folder;
}) {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-3 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 sm:block">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
        </div>
        <p className="text-xs sm:text-sm text-slate-500 sm:mt-4 truncate min-w-0">{title}</p>
      </div>
      <p className="text-xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-1 tracking-tight">{value}</p>
      <p className={cn(
        "text-[10px] sm:text-xs mt-1 sm:mt-2 line-clamp-2 leading-snug",
        subtextPositive ? "text-emerald-600" : "text-slate-400",
      )}>
        {subtext}
      </p>
    </div>
  );
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

export default function Dashboard() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { focusRecentProjects } = useSidebarProjects();
  const { isTeamMember, memberCredits } = useTeam();

  const { data: dashboard, isLoading, isFetching, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetchJson<DashboardData>(`${basePath}/api/dashboard`),
    enabled: clerkLoaded && !!user,
    staleTime: 30_000,
    retry: 3,
  });

  if (isLoading) {
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

  if (!dashboard || isError) {
    return (
      <div className="text-center py-16 text-slate-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-orange-500" />
        <p>Could not load dashboard data.</p>
        <button
          type="button"
          onClick={() => void refetch()}
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
  const showMemberCredits = isTeamMember || stats.isTeamMember;

  const creditsBalance = showMemberCredits ? memberBalance : stats.creditsBalance;
  const creditsAllowance = showMemberCredits ? (stats.creditsAllowance ?? 0) : stats.creditsAllowance;

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
    : dashboard.creditBreakdown;

  return (
    <div className={cn("space-y-4 sm:space-y-6 animate-in fade-in duration-500 w-full min-w-0", isFetching && "opacity-90")}>
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
          Welcome back, {name}! 👋
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-0.5 sm:mt-1">Here&apos;s your overview for today.</p>
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
          title="Time Saved"
          value={formatHours(stats.timeSavedHours)}
          subtext="From AI tasks completed"
          icon={Clock}
        />
        <StatCard
          title="Credits Balance"
          value={creditsBalance.toLocaleString()}
          subtext={
            showMemberCredits
              ? creditsAllowance > 0
                ? `of ${creditsAllowance.toLocaleString()} allocated by owner`
                : "No credits allocated yet"
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
              <button
                type="button"
                onClick={focusRecentProjects}
                className="text-sm font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1"
              >
                View All Projects <ChevronRight className="w-4 h-4" />
              </button>
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
