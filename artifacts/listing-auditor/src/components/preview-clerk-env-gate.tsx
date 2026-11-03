import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/api-fetch";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Healthz = {
  clerkProxySecret?: string;
  clerkSecretLooksLikePlaceholder?: boolean;
  clerkKeyPair?: string;
};

function previewApiClerkMisconfigured(health: Healthz | undefined): boolean {
  if (!health) return false;
  if (health.clerkKeyPair === "mismatch") return true;
  if (health.clerkSecretLooksLikePlaceholder) return true;
  return health.clerkProxySecret === "missing" || health.clerkProxySecret === "invalid";
}

/** Non-blocking hint on Cloudflare preview when API Clerk secret is wrong (sign-in via Clerk still works). */
export function PreviewClerkEnvGate({ children }: { children: ReactNode }) {
  const onPreview = isCloudflareQuickPreviewHost();

  const { data: health } = useQuery({
    queryKey: ["api-healthz", "preview-gate"],
    queryFn: () => fetchJson<Healthz>(`${basePath}/api/healthz`),
    enabled: onPreview,
    staleTime: 60_000,
    retry: 1,
  });

  const showBanner = onPreview && previewApiClerkMisconfigured(health);

  return (
    <>
      {showBanner && (
        <div
          className="sticky top-0 z-[100] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950"
          role="status"
        >
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden />
          Clerk sign-in uses this preview URL; dashboard API calls need a valid{" "}
          <span className="font-mono">CLERK_SECRET_KEY</span> in Cursor Cloud → Environment (
          <span className="font-mono">{typeof window !== "undefined" ? window.location.hostname : "preview"}</span>
          ).
        </div>
      )}
      {children}
    </>
  );
}
