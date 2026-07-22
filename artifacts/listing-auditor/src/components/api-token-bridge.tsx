import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setApiTokenGetter } from "@/lib/api-fetch";

/** Wires Clerk session tokens into fetchJson for reliable API auth behind proxies/tunnels. */
export function ApiTokenBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setApiTokenGetter(() => getToken());
    return () => setApiTokenGetter(null);
  }, [getToken, isLoaded]);

  return null;
}
