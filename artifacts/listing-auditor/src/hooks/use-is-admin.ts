import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const adminUserIdsEnv = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function useIsAdmin() {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () =>
      fetchJson<{ isAdmin: boolean }>(`${basePath}/api/admin/is-admin`),
    enabled: isLoaded && !!user && !envAdmin,
    staleTime: 60_000,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const isAdmin = envAdmin || (data?.isAdmin ?? false);
  const authResolved = isLoaded && (!user || envAdmin || !isLoading || isError);
  const fatalError = isError && data === undefined;

  return { isAdmin, isLoaded: authResolved, isError: fatalError, refetch };
}
