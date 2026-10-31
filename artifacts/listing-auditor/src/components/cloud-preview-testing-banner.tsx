import { Link } from "wouter";
import { isCloudPreviewSkipAuthBuild } from "@/lib/cloud-preview-skip-auth";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

/** Quick-tunnel testing only — jump between customer dashboard and admin without sign-in. */
export function CloudPreviewTestingBanner({ variant }: { variant: "customer" | "admin" }) {
  if (!isCloudPreviewSkipAuthBuild() || !isCloudflareQuickPreviewHost()) return null;

  return (
    <div className="border-b border-orange-200 bg-orange-50 px-3 py-2 text-center text-xs text-orange-950">
      <span className="font-medium">Cloud preview (testing)</span>
      {" · "}
      {variant === "customer" ? (
        <>
          You are on the <span className="font-medium">user dashboard</span>.
          {" "}
          <Link href="/admin/dashboard" className="font-semibold text-orange-700 underline underline-offset-2">
            Open admin
          </Link>
        </>
      ) : (
        <>
          You are in <span className="font-medium">admin</span>.
          {" "}
          <Link href="/dashboard" className="font-semibold text-orange-700 underline underline-offset-2">
            Open user dashboard
          </Link>
        </>
      )}
    </div>
  );
}
