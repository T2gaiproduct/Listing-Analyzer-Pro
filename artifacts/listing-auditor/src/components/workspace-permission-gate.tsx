import type { ReactNode } from "react";
import { Link } from "wouter";
import type { WorkspaceAction, WorkspaceFeature } from "@workspace/workspace-permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  canCreateForPath,
  canViewPath,
  pathRequiresCommittedWorkspace,
} from "@/lib/workspace-route-access";

interface WorkspacePermissionGateProps {
  path: string;
  requireCreate?: boolean;
  children: ReactNode;
}

function GateLoadingSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-in fade-in">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

function GateMessage({
  title,
  description,
  primaryHref,
  primaryLabel,
}: {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
      <Button asChild className="mt-6 bg-orange-500 hover:bg-orange-600">
        <Link href={primaryHref}>{primaryLabel}</Link>
      </Button>
    </div>
  );
}

export function WorkspacePermissionGate({ path, requireCreate, children }: WorkspacePermissionGateProps) {
  const {
    isWorkspaceAccountOwner,
    isBillingAccountOwner,
    isLoading,
    permissionsLoading,
    needsWorkspaceSelection,
    workspaces,
    activeWorkspaceId,
    can,
    canView,
  } = useWorkspace();

  if (isLoading || permissionsLoading) {
    return <GateLoadingSkeleton />;
  }

  const resolvingWorkspace =
    needsWorkspaceSelection
    && pathRequiresCommittedWorkspace(path)
    && workspaces.length > 0
    && activeWorkspaceId == null;

  if (resolvingWorkspace) {
    return <GateLoadingSkeleton />;
  }

  if (needsWorkspaceSelection && pathRequiresCommittedWorkspace(path)) {
    return (
      <GateMessage
        title="Select a workspace"
        description="Choose a workspace from the header switcher (or open Workspaces) before using this page. Account overview shows rollups on the dashboard only."
        primaryHref="/workspaces"
        primaryLabel="Go to workspaces"
      />
    );
  }

  if (!canViewPath(path, isWorkspaceAccountOwner, isBillingAccountOwner, canView, can)) {
    return (
      <GateMessage
        title="Access restricted"
        description="Your workspace role does not include permission to open this page. Ask your workspace owner to update your role if you need access."
        primaryHref="/dashboard"
        primaryLabel="Back to dashboard"
      />
    );
  }

  if (requireCreate && !canCreateForPath(path, isWorkspaceAccountOwner, isBillingAccountOwner, can)) {
    return (
      <GateMessage
        title="Create not allowed"
        description="Your role can view this area but cannot create new items here. Ask your workspace owner to enable Create for this feature."
        primaryHref="/dashboard"
        primaryLabel="Back to dashboard"
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
  const { isWorkspaceAccountOwner, can } = useWorkspace();
  if (isWorkspaceAccountOwner) return <>{children}</>;

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
