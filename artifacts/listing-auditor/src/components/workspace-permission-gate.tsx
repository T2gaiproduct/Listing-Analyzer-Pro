import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldOff } from "lucide-react";
import type { WorkspaceAction, WorkspaceFeature } from "@workspace/workspace-permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/use-workspace";
import { canCreateForPath, canViewPath } from "@/lib/workspace-route-access";

interface WorkspacePermissionGateProps {
  path: string;
  requireCreate?: boolean;
  children: ReactNode;
}

function AccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
      <ShieldOff className="w-12 h-12 text-slate-300 mb-4" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
      <Button asChild className="mt-6 bg-orange-500 hover:bg-orange-600">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

export function WorkspacePermissionGate({ path, requireCreate, children }: WorkspacePermissionGateProps) {
  const { isAccountOwner, isLoading, can, canView } = useWorkspace();

  if (isLoading && !isAccountOwner) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!canViewPath(path, isAccountOwner, canView, can)) {
    return (
      <AccessDenied
        title="Access restricted"
        description="Your workspace role does not include permission to open this page. Ask your workspace owner to update your role if you need access."
      />
    );
  }

  if (requireCreate && !canCreateForPath(path, isAccountOwner, can)) {
    return (
      <AccessDenied
        title="Create not allowed"
        description="Your role can view this area but cannot create new items here. Ask your workspace owner to enable Create for this feature."
      />
    );
  }

  return <>{children}</>;
}

interface WorkspaceFeatureGateProps {
  feature: WorkspaceFeature;
  action?: WorkspaceAction;
  anyOf?: Array<{ feature: WorkspaceFeature; action?: WorkspaceAction }>;
  children: ReactNode;
}

/** Gate inline UI (not full routes) by one or more feature permissions. */
export function WorkspaceFeatureGate({ feature, action, anyOf, children }: WorkspaceFeatureGateProps) {
  const { isAccountOwner, can } = useWorkspace();
  if (isAccountOwner) return <>{children}</>;

  if (anyOf?.length) {
    const allowed = anyOf.some((row) =>
      row.action ? can(row.feature, row.action) : can(row.feature, "viewGlobal") || can(row.feature, "viewOwn"),
    );
    if (!allowed) return null;
    return <>{children}</>;
  }

  if (action) {
    if (!can(feature, action)) return null;
    return <>{children}</>;
  }

  if (!can(feature, "viewGlobal") && !can(feature, "viewOwn")) return null;
  return <>{children}</>;
}
