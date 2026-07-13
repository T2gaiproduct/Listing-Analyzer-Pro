import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSearch, Palette, FilePlus2, Video, Megaphone,
  Info, CheckCircle2, ArrowUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Credits {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}

interface Subscription {
  planId: number;
  planName: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  planAiCredits: number;
  planImageCredits: number;
  planAuditCredits: number;
}

interface Plan {
  id: number;
  name: string;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  features: string[];
}

interface CreditRule {
  activityName: string;
  creditsRequired: number;
  creditType: string;
  featureType: string;
}

interface CreditUsage {
  transactions: {
    creditType: string;
    amount: number;
    reason: string | null;
    featureType: string | null;
    createdAt: string;
  }[];
  breakdown: Record<string, { spent: number; earned: number; count: number }>;
}

interface TeamMember {
  id: number;
  invitedName: string;
  status: string;
  memberUserId: string | null;
}

interface MemberStat {
  memberId: number;
  creditBalance: Credits | null;
  allocatedCredits: Credits | null;
}

interface TeamData {
  members: TeamMember[];
  memberStats: MemberStat[];
}

const SERVICE_CONFIG = [
  {
    id: "audit",
    label: "Audit Listing",
    icon: FileSearch,
    featureTypes: ["audit"],
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    barColor: "bg-emerald-500",
    ruleFeature: "audit",
    unit: "Audit",
    fallbackCost: 1,
  },
  {
    id: "graphics",
    label: "Create Graphics",
    icon: Palette,
    featureTypes: ["images", "image_regenerate", "image_edit", "graphics", "graphics_edit"],
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    barColor: "bg-violet-500",
    ruleFeature: "graphics",
    unit: "Graphic",
    fallbackCost: 8,
  },
  {
    id: "brand",
    label: "Build Your Brand",
    icon: FilePlus2,
    featureTypes: ["ebc", "content"],
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    barColor: "bg-blue-500",
    ruleFeature: "ebc",
    unit: "Generation",
    fallbackCost: 2,
  },
  {
    id: "videos",
    label: "Create Videos",
    icon: Video,
    featureTypes: ["videos", "video"],
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    barColor: "bg-pink-500",
    ruleFeature: "videos",
    unit: "Video",
    fallbackCost: 0,
    unavailable: true,
  },
  {
    id: "ads",
    label: "Manage Ads",
    icon: Megaphone,
    featureTypes: ["ads", "manage_ads"],
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    barColor: "bg-orange-500",
    ruleFeature: "ads",
    unit: "Campaign",
    fallbackCost: 0,
    unavailable: true,
  },
] as const;

function serviceDisplayCost(
  svc: (typeof SERVICE_CONFIG)[number],
  lookupRuleCost: (featureType: string, fallback: number) => number,
): number {
  if ("unavailable" in svc && svc.unavailable) return 0;
  return lookupRuleCost(svc.ruleFeature, svc.fallbackCost);
}

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-pink-500",
  "bg-amber-500",
];

type PeriodFilter = "this_month" | "billing_period";

function sumCredits(c: Credits): number {
  return c.aiCredits + c.imageCredits + c.auditCredits;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function spentInRange(
  transactions: CreditUsage["transactions"],
  start: Date,
  end: Date,
  featureTypes: readonly string[],
): number {
  return transactions
    .filter((tx) => {
      if (tx.amount >= 0) return false;
      if (!tx.featureType || !featureTypes.includes(tx.featureType)) return false;
      const at = new Date(tx.createdAt);
      return isWithinInterval(at, { start, end });
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

function totalSpentInRange(
  transactions: CreditUsage["transactions"],
  start: Date,
  end: Date,
): number {
  return transactions
    .filter((tx) => tx.amount < 0 && tx.featureType !== "subscription")
    .filter((tx) => isWithinInterval(new Date(tx.createdAt), { start, end }))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

interface BillingOverviewProps {
  sub: Subscription;
  plans: Plan[];
  creditUsage: CreditUsage | undefined;
  onAddCredits: () => void;
  onUpgradePlan: () => void;
  paymentSection: ReactNode;
}

export function BillingOverview({
  sub,
  plans,
  creditUsage,
  onAddCredits,
  onUpgradePlan,
  paymentSection,
}: BillingOverviewProps) {
  const { user } = useUser();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month");

  const { data: creditRules = [] } = useQuery<CreditRule[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`).then((r) => r.json()),
  });

  const { data: teamData } = useQuery<TeamData>({
    queryKey: ["team-overview"],
    queryFn: () => fetch(`${basePath}/api/team`, { credentials: "include" }).then((r) => r.json()),
  });

  const currentPlan = plans.find((p) => p.id === sub.planId)
    ?? plans.find((p) => p.name === sub.planName);

  const planTotalCredits = sub.planAiCredits + sub.planImageCredits + sub.planAuditCredits;

  const periodStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : startOfMonth(new Date());
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : endOfMonth(new Date());

  const filterStart = periodFilter === "this_month" ? startOfMonth(new Date()) : periodStart;
  const filterEnd = periodFilter === "this_month" ? endOfMonth(new Date()) : periodEnd;

  const transactions = creditUsage?.transactions ?? [];

  const usedInPeriod = useMemo(
    () => totalSpentInRange(transactions, periodStart, periodEnd),
    [transactions, periodStart, periodEnd],
  );

  const usagePct = planTotalCredits > 0 ? Math.min(100, Math.round((usedInPeriod / planTotalCredits) * 100)) : 0;

  const ruleCost = (featureType: string, fallback: number) =>
    creditRules.find((r) => r.featureType === featureType)?.creditsRequired ?? fallback;

  const serviceUsage = useMemo(() => {
    return SERVICE_CONFIG.map((svc) => {
      const spent = spentInRange(transactions, filterStart, filterEnd, svc.featureTypes);
      const pct = planTotalCredits > 0 ? Math.min(100, Math.round((spent / planTotalCredits) * 100)) : 0;
      const cost = serviceDisplayCost(svc, ruleCost);
      return { ...svc, spent, pct, cost };
    });
  }, [transactions, filterStart, filterEnd, creditRules, planTotalCredits]);

  const displayName = user?.fullName ?? user?.firstName ?? "You";
  const ownerUsed = totalSpentInRange(transactions, filterStart, filterEnd);

  const teamRows = useMemo(() => {
    const rows: { id: string; name: string; label: string; used: number; color: string }[] = [
      {
        id: "owner",
        name: initials(displayName),
        label: `You (${displayName})`,
        used: ownerUsed,
        color: AVATAR_COLORS[0],
      },
    ];

    const activeMembers = (teamData?.members ?? []).filter((m) => m.status === "active");
    activeMembers.forEach((member, idx) => {
      const stat = teamData?.memberStats.find((s) => s.memberId === member.id);
      let used = 0;
      if (stat?.allocatedCredits && stat.creditBalance) {
        used = Math.max(0, sumCredits(stat.allocatedCredits) - sumCredits(stat.creditBalance));
      }
      rows.push({
        id: String(member.id),
        name: initials(member.invitedName),
        label: member.invitedName,
        used,
        color: AVATAR_COLORS[(idx + 1) % AVATAR_COLORS.length],
      });
    });

    return rows;
  }, [teamData, displayName, ownerUsed]);

  const teamTotalUsed = teamRows.reduce((sum, r) => sum + r.used, 0);
  const teamUsagePct = planTotalCredits > 0 ? Math.min(100, Math.round((teamTotalUsed / planTotalCredits) * 100)) : 0;

  const planFeatures = currentPlan?.features?.length
    ? currentPlan.features
    : [
        "Audit Listings",
        "Create Graphics",
        "Create Videos",
        "Build Your Brand",
        "Manage Ads",
        "Priority Support",
      ];

  const monthlyCredits = currentPlan
    ? currentPlan.aiCredits + currentPlan.imageCredits + currentPlan.auditCredits
    : planTotalCredits;

  return (
    <div className="space-y-6">
      {/* Total credit usage */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">Total credit usage</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {format(periodStart, "MMM d, yyyy")} – {format(periodEnd, "MMM d, yyyy")}
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-4">
              {usedInPeriod.toLocaleString()}{" "}
              <span className="text-lg font-semibold text-slate-500">
                of {planTotalCredits.toLocaleString()} credits used
              </span>
            </p>
            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden max-w-xl">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {sub.currentPeriodEnd && (
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Estimated Credit Renewal on:{" "}
                {format(new Date(sub.currentPeriodEnd), "MMM d, yyyy, h:mm a")} GMT+5:30
              </p>
            )}
          </div>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0"
            onClick={onAddCredits}
          >
            Add More Credits
          </Button>
        </div>
      </div>

      {/* Credit cost per action */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Credit Cost (per action)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SERVICE_CONFIG.map((svc) => {
            const cost = serviceDisplayCost(svc, ruleCost);
            const Icon = svc.icon;
            return (
              <div
                key={svc.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center gap-2"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", svc.iconBg)}>
                  <Icon className={cn("w-5 h-5", svc.iconColor)} />
                </div>
                <p className="text-sm font-semibold text-slate-900 leading-tight">{svc.label}</p>
                <p className="text-xs text-slate-500">
                  {cost} Credit{cost !== 1 ? "s" : ""} / {svc.unit}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit usage breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Credit usage breakdown</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              See how your credits are being used across different services. Percentages are of your monthly plan total ({planTotalCredits.toLocaleString()} credits).
            </p>
          </div>
          <div className="relative">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="appearance-none h-9 pl-3 pr-8 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="this_month">This Month</option>
              <option value="billing_period">Billing Period</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-5">
          {serviceUsage.map((svc) => {
            const Icon = svc.icon;
            return (
              <div key={svc.id}>
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", svc.iconBg)}>
                      <Icon className={cn("w-4 h-4", svc.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{svc.label}</p>
                      <p className="text-xs text-slate-500">
                        {svc.cost} Credit{svc.cost !== 1 ? "s" : ""} / {svc.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{svc.spent} Credits used</p>
                    <p className="text-xs text-slate-500">{svc.pct}%</p>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", svc.barColor)}
                    style={{ width: `${svc.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team + Subscription */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Team credit usage</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                See how your team members are using credits.
              </p>
            </div>
            <Link href="/team">
              <Button variant="outline" size="sm" className="flex-shrink-0">
                Manage Team
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {teamRows.map((member) => {
              const memberPct = teamTotalUsed > 0 ? Math.round((member.used / teamTotalUsed) * 100) : 0;
              return (
                <div key={member.id} className="text-center">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white text-sm font-bold",
                      member.color,
                    )}
                  >
                    {member.name}
                  </div>
                  <p className="text-xs font-semibold text-slate-900 mt-2 truncate" title={member.label}>
                    {member.label}
                  </p>
                  <p className="text-xs text-slate-500">{member.used} Credits</p>
                  <p className="text-xs font-medium text-slate-600">{memberPct}%</p>
                </div>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-slate-900">Total Team Usage</span>
              <span className="text-slate-600">
                {teamTotalUsed.toLocaleString()} / {planTotalCredits.toLocaleString()} Credits
                <span className="ml-2 font-semibold text-slate-900">{teamUsagePct}%</span>
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${teamUsagePct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col">
          <h3 className="text-base font-bold text-slate-900 mb-1">Subscription</h3>
          <p className="text-sm font-semibold text-slate-800">{sub.planName ?? "Free"} Plan</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {monthlyCredits.toLocaleString()} Credits / Month
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-5 flex-1">
            {planFeatures.slice(0, 6).map((feat) => (
              <div key={feat} className="flex items-start gap-1.5 text-xs text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{feat}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full mt-5 bg-white border-slate-200 hover:bg-slate-50"
            onClick={onUpgradePlan}
          >
            <ArrowUp className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Payment Method</h3>
        {paymentSection}
      </div>
    </div>
  );
}
