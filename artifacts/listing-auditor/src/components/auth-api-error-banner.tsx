import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiAuthReady } from "@/components/api-token-bridge";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ApiHealthz = {
  clerkKeyPair?: string;
  clerkProxySecret?: string;
  clerkPublishableHost?: string;
  clerkSecretLooksLikePlaceholder?: boolean;
};

/** Shown when the user is signed in to Clerk but API calls return 401 (stale/wrong session on preview URLs). */
export function AuthApiErrorBanner() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const apiAuthReady = useApiAuthReady();
  const onPreview = isCloudflareQuickPreviewHost();

  const { data, isError, error, isFetched, failureCount } = useQuery({
    queryKey: ["auth-api-probe", "workspaces"],
    queryFn: () => fetchJson<{ workspaces: unknown[] }>(`${basePath}/api/workspaces`),
    enabled: isLoaded && isSignedIn && apiAuthReady,
    staleTime: 15_000,
    retry: (count, err) => {
      if (err instanceof ApiFetchError && err.status === 401) {
        return count < (onPreview ? 8 : 2);
      }
      return false;
    },
    retryDelay: (attempt) => {
      const base = onPreview ? 750 : 500;
      return Math.min(base * 2 ** attempt, 8000);
    },
  });

  const healthQuery = useQuery({
    queryKey: ["auth-api-probe", "healthz"],
    queryFn: () => fetchJson<ApiHealthz>(`${basePath}/api/healthz`),
    enabled:
      isLoaded
      && isSignedIn
      && isFetched
      && isError
      && error instanceof ApiFetchError
      && error.status === 401,
    staleTime: 60_000,
    retry: false,
  });

  if (!isLoaded || !isSignedIn || !apiAuthReady || !isFetched) return null;
  if (!isError || !(error instanceof ApiFetchError) || error.status !== 401) {
    if (data) return null;
    return null;
  }

  const health = healthQuery.data;
  const clerkKeyMismatch = health?.clerkKeyPair === "mismatch";
  const clerkSecretBad =
    health?.clerkProxySecret === "missing"
    || health?.clerkProxySecret === "invalid"
    || health?.clerkSecretLooksLikePlaceholder === true;

  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Session could not reach the API</p>
          <p className="text-amber-800/90 mt-0.5">
            Sign out and sign in again on this preview URL. This often happens after the Cloudflare link changes or
            Clerk keys were updated.
          </p>
          {clerkKeyMismatch && (
            <p className="text-amber-800/90 mt-2">
              Server check: <span className="font-medium">CLERK_SECRET_KEY</span> and{" "}
              <span className="font-medium">VITE_CLERK_PUBLISHABLE_KEY</span> are from different Clerk apps — update
              both in Cursor Cloud Environment, run{" "}
              <span className="font-mono text-xs">bash scripts/dev-stack.sh</span>, then sign in again.
            </p>
          )}
          {clerkSecretBad && !clerkKeyMismatch && (
            <p className="text-amber-800/90 mt-2">
              Server check: API <span className="font-medium">CLERK_SECRET_KEY</span> is missing or invalid
              {health?.clerkPublishableHost ? (
                <>
                  {" "}
                  (frontend uses <span className="font-mono text-xs">{health.clerkPublishableHost}</span>)
                </>
              ) : null}
              . Set the secret from that Clerk app, restart the dev stack, then sign in again.
            </p>
          )}
          {onPreview && failureCount > 0 && !clerkKeyMismatch && !clerkSecretBad && (
            <p className="text-amber-800/70 mt-1 text-xs">
              Retried {failureCount} time{failureCount === 1 ? "" : "s"}; session still rejected.
            </p>
          )}
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
