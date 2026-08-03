import { Link } from "wouter";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WORKSPACES_INCLUDED_PLANS_LABEL,
  WORKSPACES_UPGRADE_MESSAGE,
} from "@workspace/workspace-permissions";

interface WorkspacesPlanUpgradeBannerProps {
  className?: string;
  compact?: boolean;
}

export function WorkspacesPlanUpgradeBanner({ className, compact }: WorkspacesPlanUpgradeBannerProps) {
  if (compact) {
    return (
      <div
        className={[
          "rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex flex-wrap items-center gap-3",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Lock className="w-4 h-4 text-amber-700 shrink-0" />
        <p className="text-sm text-amber-900 flex-1 min-w-0">
          {WORKSPACES_UPGRADE_MESSAGE}
        </p>
        <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
          <Link href="/billing">Upgrade plan</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-5 sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Unlock multiple workspaces
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {WORKSPACES_UPGRADE_MESSAGE}
          </p>
          <p className="text-xs text-slate-500">
            Available on {WORKSPACES_INCLUDED_PLANS_LABEL} plans.
          </p>
          <Button asChild className="mt-2 bg-orange-500 hover:bg-orange-600">
            <Link href="/billing">View plans & upgrade</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
