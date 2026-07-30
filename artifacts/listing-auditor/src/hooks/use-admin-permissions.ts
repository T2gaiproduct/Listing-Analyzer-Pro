import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  ADMIN_PERMISSIONS,
  canAccessAdminRoute,
  getDefaultAdminRoute,
  hasAdminPermission,
  isSuperAdminRoleName,
  type AdminPermission,
} from "@workspace/admin-permissions";
import { fetchJson } from "@/lib/api-fetch";
import { useIsAdmin } from "@/hooks/use-is-admin";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const adminUserIdsEnv = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface AdminMeResponse {
  isSuperAdmin: boolean;
  role: { id: number; name: string } | null;
  permissions: string[];
}

export function useAdminPermissions() {
  const { user, isLoaded } = useUser();
  const envSuperAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-me", user?.id],
    queryFn: () => fetchJson<AdminMeResponse>(`${basePath}/api/admin/me`),
    enabled: isLoaded && !!user && isAdmin && !envSuperAdmin,
    staleTime: 60_000,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const isSuperAdmin = envSuperAdmin || (data?.isSuperAdmin ?? false) || isSuperAdminRoleName(data?.role?.name);
  const permissions = envSuperAdmin
    ? [...ADMIN_PERMISSIONS]
    : (data?.permissions ?? []);

  const resolved = isLoaded && adminLoaded && (!isAdmin || envSuperAdmin || !isLoading || isError);
  const fatalError = isError && data === undefined;

  const can = (required: AdminPermission | AdminPermission[]) =>
    hasAdminPermission(permissions, required, { isSuperAdmin, roleName: data?.role?.name });

  const canAccessRoute = (pathname: string) =>
    canAccessAdminRoute(pathname, permissions, { isSuperAdmin, roleName: data?.role?.name });

  const defaultRoute = getDefaultAdminRoute(permissions, { isSuperAdmin, roleName: data?.role?.name });

  return {
    isAdmin,
    isSuperAdmin,
    role: data?.role ?? null,
    permissions,
    isLoaded: resolved,
    isError: fatalError,
    can,
    canAccessRoute,
    defaultRoute,
  };
}
