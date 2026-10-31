import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";
import { isCloudPreviewSkipAuthBuild } from "@/lib/cloud-preview-skip-auth";
import { clerkFrontendHostFromPublishableKey } from "@/lib/clerk-proxy-host";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const viteClerkHost = clerkFrontendHostFromPublishableKey(
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string) ?? "",
);

type Healthz = {
  clerkProxySecret?: string;
  clerkSecretLooksLikePlaceholder?: boolean;
  clerkPublishableHost?: string;
  cloudPreviewSkipAuth?: boolean;
};

/** Blocks Cloudflare preview when API has placeholder/invalid Clerk secret (infinite loading otherwise). */
export function CloudPreviewClerkSetupGate({ children }: { children: ReactNode }) {
  const onPreview = isCloudflareQuickPreviewHost();

  const { data, isPending, isError } = useQuery({
    queryKey: ["cloud-preview-clerk-health"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/healthz`, { cache: "no-store" });
      if (!res.ok) throw new Error("healthz failed");
      return (await res.json()) as Healthz;
    },
    enabled: onPreview,
    retry: false,
    staleTime: 30_000,
  });

  if (!onPreview) return children;
  if (isCloudPreviewSkipAuthBuild()) return children;
  if (isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-label="Loading" />
      </div>
    );
  }
  if (isError) return children;
  if (data?.cloudPreviewSkipAuth === true) return children;

  const badSecret =
    data?.clerkSecretLooksLikePlaceholder === true
    || data?.clerkProxySecret === "invalid"
    || data?.clerkProxySecret === "missing";

  if (!badSecret) return children;

  const clerkHost = data?.clerkPublishableHost || viteClerkHost;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg rounded-xl border border-amber-200 bg-white px-6 py-8 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Preview needs Clerk API secret</h1>
        <p className="text-sm text-slate-600">
          This Cloudflare link can load the app, but <span className="font-medium">CLERK_SECRET_KEY</span> in Cursor
          Environment is still the documentation dummy (<span className="font-mono text-xs">sk_test_0123456…</span>), not
          your real Clerk secret — so sign-in and admin pages stay on a loading spinner.
        </p>
        {clerkHost ? (
          <p className="text-sm text-slate-600">
            Frontend uses Clerk instance{" "}
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{clerkHost}</span>. In{" "}
            <span className="font-medium">Cursor → Cloud → Environment</span>, set{" "}
            <span className="font-medium">CLERK_SECRET_KEY</span> to the <span className="font-medium">Secret key</span>{" "}
            from that same app (API Keys), and set <span className="font-medium">CLERK_PUBLISHABLE_KEY</span> to match{" "}
            <span className="font-medium">VITE_CLERK_PUBLISHABLE_KEY</span>.
          </p>
        ) : null}
        <p className="text-sm text-slate-600">
          Start a <span className="font-medium">new Cloud Agent run</span> (or run{" "}
          <span className="font-mono text-xs">bash scripts/dev-stack.sh</span> on the VM), then open this preview URL
          again in a private window.
        </p>
      </div>
    </div>
  );
}
