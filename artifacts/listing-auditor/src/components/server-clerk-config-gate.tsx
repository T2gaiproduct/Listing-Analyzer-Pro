import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/api-fetch";
import { clerkFrontendHostFromPublishableKey } from "@/lib/clerk-proxy-host";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const viteClerkHost = clerkFrontendHostFromPublishableKey(
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string) ?? "",
);

type Healthz = {
  clerkProxySecret?: string;
  clerkPublishableHost?: string;
  clerkSecretLooksLikePlaceholder?: boolean;
  clerkKeyPair?: string;
};

function serverClerkMisconfigured(health: Healthz | undefined): boolean {
  if (!health) return false;
  if (health.clerkKeyPair === "mismatch") return true;
  if (health.clerkSecretLooksLikePlaceholder) return true;
  return health.clerkProxySecret === "missing" || health.clerkProxySecret === "invalid";
}

/** Blocks the customer shell when the API cannot verify Clerk sessions (invalid secret on preview). */
export function ServerClerkConfigGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut } = useAuth();

  const { data: health, isLoading } = useQuery({
    queryKey: ["api-healthz", "clerk-gate"],
    queryFn: () => fetchJson<Healthz>(`${basePath}/api/healthz`),
    enabled: isLoaded && isSignedIn,
    staleTime: 30_000,
    retry: 1,
  });

  if (!isLoaded || !isSignedIn) return <>{children}</>;
  if (isLoading) return <>{children}</>;

  if (!serverClerkMisconfigured(health)) return <>{children}</>;

  const serverHost = health?.clerkPublishableHost;
  const hostMismatch = Boolean(viteClerkHost && serverHost && viteClerkHost !== serverHost);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-amber-950">
            <p className="text-base font-semibold">API cannot verify your sign-in</p>
            <p>
              The preview loaded, but the backend <span className="font-medium">CLERK_SECRET_KEY</span> is missing,
              invalid, or still the docs placeholder. Every dashboard and workspace request returns 401 until this is fixed.
            </p>
            {hostMismatch ? (
              <p>
                Browser uses Clerk <span className="font-mono text-xs">{viteClerkHost}</span>; API expects{" "}
                <span className="font-mono text-xs">{serverHost}</span>. Use matching keys from one Clerk app.
              </p>
            ) : serverHost ? (
              <p>
                In Cursor Cloud → Environment, set <span className="font-medium">CLERK_SECRET_KEY</span> from Clerk
                Dashboard → <span className="font-mono text-xs">{serverHost}</span> → API Keys (same app as{" "}
                <span className="font-medium">VITE_CLERK_PUBLISHABLE_KEY</span>).
              </p>
            ) : null}
            <p className="text-amber-900/80">
              Then start a <span className="font-medium">new agent run</span> or run{" "}
              <span className="font-mono text-xs">bash scripts/dev-stack-reload.sh</span>, hard-refresh this page, and
              sign in again.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 bg-white"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => void signOut({ redirectUrl: `${basePath}/sign-in` })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
