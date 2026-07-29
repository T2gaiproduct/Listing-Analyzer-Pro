import { Link, useLocation } from "wouter";
import { Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceAdminNavProps {
  workspaceId: number;
  workspaceName: string;
  canManageRoles?: boolean;
}

export function WorkspaceAdminNav({ workspaceId, workspaceName, canManageRoles = true }: WorkspaceAdminNavProps) {
  const [location] = useLocation();
  const base = `/workspaces/${workspaceId}`;
  const onRoles = location === `${base}/roles`;
  const onMembers = location === `${base}/members`;

  const tabs = [
    ...(canManageRoles
      ? [{ href: `${base}/roles`, label: "Roles", icon: Shield, description: "Create & edit roles", active: onRoles }]
      : []),
    { href: `${base}/members`, label: "Members", icon: Users, description: "Assign roles to users", active: onMembers },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{workspaceName}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create roles first, then assign them to members.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ href, label, icon: Icon, description, active }) => (
          <Link key={href} href={href}>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300",
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span className="hidden sm:inline text-xs font-normal text-slate-400">— {description}</span>
            </button>
          </Link>
        ))}
      </nav>
    </div>
  );
}
