import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/api-fetch";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";
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

function previewClerkBlocked(health: Healthz | undefined): boolean {
  if (!health) return false;
  if (health.clerkKeyPair === "mismatch") return true;
  if (health.clerkSecretLooksLikePlaceholder) return true;
  return health.clerkProxySecret === "missing" || health.clerkProxySecret === "invalid";
}

/** Blocks Cloudflare preview when the API cannot verify Clerk (invalid CLERK_SECRET_KEY on the VM). */
export function PreviewClerkEnvGate({ children }: { children: ReactNode }) {
  const onPreview = isCloudflareQuickPreviewHost();

  const { data: health, isLoading, isError } = useQuery({
    queryKey: ["api-healthz", "preview-gate"],
    queryFn: () => fetchJson<Healthz>(`${basePath}/api/healthz`),
    enabled: onPreview,
    staleTime: 20_000,
    retry: 1,
  });

  if (!onPreview) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-label="Loading" />
        <p className="text-sm text-muted-foreground">Checking preview environment…</p>
      </div>
    );
  }

  if (isError || !previewClerkBlocked(health)) return <>{children}</>;

  const serverHost = health?.clerkPublishableHost;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg w-full rounded-2xl border border-amber-200 bg-white p-6 shadow-lg space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />
          <div className="space-y-3 text-sm text-slate-800">
            <p className="text-lg font-semibold text-slate-900">Preview cannot load your account</p>
            <p>
              This Cloudflare link works, but the <strong>API server secret</strong> for Clerk is still the
              placeholder value. Sign-in looks fine in the browser, yet every dashboard request returns unauthorized —
              so the app stays on loading skeletons.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-700">
              <li>
                Open <strong>Cursor → Cloud → Environment</strong> for this repo.
              </li>
              <li>
                Set <code className="text-xs bg-slate-100 px-1 rounded">CLERK_SECRET_KEY</code> to the secret key from
                the same Clerk app as{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code>
                {serverHost ? (
                  <>
                    {" "}
                    (<span className="font-mono text-xs">{serverHost}</span>)
                  </>
                ) : null}
                .
              </li>
              <li>Start a <strong>new Cloud Agent run</strong> (or ask the agent to run{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">bash scripts/dev-stack-reload.sh</code>).
              </li>
              <li>Hard-refresh this page and sign in again.</li>
            </ol>
            {viteClerkHost && serverHost && viteClerkHost !== serverHost && (
              <p className="text-amber-900 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs">
                Frontend Clerk: <span className="font-mono">{viteClerkHost}</span> — API expects:{" "}
                <span className="font-mono">{serverHost}</span>. Both keys must be from one Clerk application.
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <ExternalLink className="w-3.5 h-3.5" />
          After fixing secrets, confirm{" "}
          <code className="bg-slate-100 px-1 rounded">{window.location.origin}/api/healthz</code> shows{" "}
          <code className="bg-slate-100 px-1 rounded">&quot;clerkProxySecret&quot;:&quot;ok&quot;</code>
        </p>
      </div>
    </div>
  );
}
