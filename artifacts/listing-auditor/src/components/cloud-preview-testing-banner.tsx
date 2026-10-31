import { isCloudPreviewSkipAuthBuild } from "@/lib/cloud-preview-skip-auth";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";
import { switchCloudPreviewPersona } from "@/lib/cloud-preview-persona";

/** Quick-tunnel testing only — jump between customer dashboard and admin without sign-in. */
export function CloudPreviewTestingBanner({ variant }: { variant: "customer" | "admin" }) {
  if (!isCloudPreviewSkipAuthBuild() || !isCloudflareQuickPreviewHost()) return null;

  return (
    <div className="border-b border-orange-200 bg-orange-50 px-3 py-2 text-center text-xs text-orange-950">
      <span className="font-medium">Cloud preview (testing)</span>
      {" · "}
      {variant === "customer" ? (
        <>
          Signed in as <span className="font-medium">demo customer</span>.
          {" "}
          <button
            type="button"
            className="font-semibold text-orange-700 underline underline-offset-2"
            onClick={() => switchCloudPreviewPersona("admin", "/admin/dashboard")}
          >
            Switch to admin
          </button>
        </>
      ) : (
        <>
          Signed in as <span className="font-medium">admin</span>.
          {" "}
          <button
            type="button"
            className="font-semibold text-orange-700 underline underline-offset-2"
            onClick={() => switchCloudPreviewPersona("customer", "/dashboard")}
          >
            Switch to demo customer
          </button>
        </>
      )}
    </div>
  );
}
