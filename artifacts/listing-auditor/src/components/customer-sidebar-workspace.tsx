import { Link } from "wouter";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";
import { TopbarWorkspaceSwitcher } from "@/components/topbar-workspace-switcher";

type CustomerSidebarWorkspaceProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

function StaticWorkspaceBlock({
  collapsed,
  name,
  showUpgrade,
  upgradeTitle,
}: {
  collapsed: boolean;
  name: string;
  showUpgrade: boolean;
  upgradeTitle: string;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-sidebar-border/40 bg-sidebar-accent/30 transition-colors",
        collapsed ? "w-10 h-10 justify-center mx-auto" : "w-full px-2.5 py-1 min-h-0",
      )}
      title={name}
    >
      <Building2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1 text-left flex flex-col gap-0 py-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/55 leading-none">
              Workspace
            </p>
            <p className="text-sm font-semibold text-sidebar-foreground leading-snug truncate">{name}</p>
          </div>
          {showUpgrade && (
            <Link
              href="/billing"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-orange-600 hover:text-orange-700 px-2 py-1 rounded-md bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
              title={upgradeTitle}
            >
              Upgrade
            </Link>
          )}
        </>
      )}
    </div>
  );

  if (collapsed) {
    return <div className="px-2 mb-2">{inner}</div>;
  }

  return <div className="px-3 mb-2">{inner}</div>;
}

export function CustomerSidebarWorkspace({ collapsed, onNavigate }: CustomerSidebarWorkspaceProps) {
  const { activeWorkspace, isAccountOwner } = useWorkspace();
  const { workspacesEnabled, workspacesPlanLocked, upgradeShort, includedPlansLabel } = useWorkspacesPlan();

  if (workspacesEnabled) {
    return (
      <TopbarWorkspaceSwitcher
        placement="sidebar"
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    );
  }

  const name = activeWorkspace?.name?.trim();
  if (!name) return null;

  return (
    <StaticWorkspaceBlock
      collapsed={collapsed}
      name={name}
      showUpgrade={workspacesPlanLocked && isAccountOwner}
      upgradeTitle={upgradeShort || `Upgrade to ${includedPlansLabel} to enable multiple workspaces`}
    />
  );
}
