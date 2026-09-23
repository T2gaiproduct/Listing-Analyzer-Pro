import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { BUILD_RELOAD_SESSION_KEY } from "@/lib/chunk-load-error";

const POLL_MS = 5 * 60 * 1000;
const RELOAD_DELAY_MS = 2000;

function runningBuildId(): string {
  return (import.meta.env.VITE_APP_BUILD_ID as string | undefined)?.trim() || "dev";
}

export function AppVersionWatcher() {
  const { toast } = useToast();
  const reloadScheduled = useRef(false);

  useEffect(() => {
    const localId = runningBuildId();
    if (localId === "dev") return;

    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const buildIdUrl = `${basePath}/build-id.json`;

    const scheduleReload = (remoteId: string) => {
      if (reloadScheduled.current) return;
      if (sessionStorage.getItem(BUILD_RELOAD_SESSION_KEY) === remoteId) return;
      reloadScheduled.current = true;
      sessionStorage.setItem(BUILD_RELOAD_SESSION_KEY, remoteId);
      toast({
        title: "We've updated SellerLens",
        description: "Refreshing for the latest version…",
      });
      window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    };

    const check = async () => {
      try {
        const res = await fetch(buildIdUrl, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const remoteId = data.buildId?.trim();
        if (!remoteId || remoteId === localId) return;
        scheduleReload(remoteId);
      } catch {
        /* offline or dev without build-id.json */
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [toast]);

  return null;
}
