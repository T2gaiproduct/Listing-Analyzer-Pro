import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Shown when the user is signed in to Clerk but API calls return 401 (stale/wrong session on preview URLs). */
export function AuthApiErrorBanner() {
  const { isLoaded, isSignedIn, signOut } = useAuth();

  const { data, isError, error, isFetched } = useQuery({
    queryKey: ["auth-api-probe", "workspaces"],
    queryFn: () => fetchJson<{ workspaces: unknown[] }>(`${basePath}/api/workspaces`),
    enabled: isLoaded && isSignedIn,
    staleTime: 15_000,
    retry: false,
  });

  if (!isLoaded || !isSignedIn || !isFetched) return null;
  if (!isError || !(error instanceof ApiFetchError) || error.status !== 401) {
    if (data) return null;
    return null;
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Session could not reach the API</p>
          <p className="text-amber-800/90 mt-0.5">
            Sign out and sign in again on this preview URL. This often happens after the Cloudflare link changes or Clerk keys were updated.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 border-amber-300 bg-white hover:bg-amber-100"
        onClick={() => void signOut({ redirectUrl: `${basePath}/sign-in` })}
      >
        Sign out &amp; retry
      </Button>
    </div>
  );
}
