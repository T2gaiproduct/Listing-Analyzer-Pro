import { useLayoutEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { setApiAuthReady, setApiTokenGetter } from "@/lib/api-fetch";

const AUTH_SCOPED_QUERY_KEYS = [
  ["dashboard"],
  ["user-profile-summary"],
  ["user-profile"],
  ["team-membership"],
  ["team-membership-credits"],
  ["workspaces"],
  ["workspace-permissions"],
  ["notifications"],
] as const;

/** Wires Clerk session tokens into all same-origin /api fetch calls. */
export function ApiTokenBridge() {
  const { getToken, isLoaded } = useAuth();
  const qc = useQueryClient();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // useLayoutEffect runs before child useEffects (React Query fetches), avoiding 401 races.
  useLayoutEffect(() => {
    if (!isLoaded) {
      setApiTokenGetter(null);
      setApiAuthReady(false);
      return;
    }
    setApiTokenGetter(async () => {
      const getToken = getTokenRef.current;
      return getToken ? await getToken() : null;
    });
    setApiAuthReady(true);
    for (const queryKey of AUTH_SCOPED_QUERY_KEYS) {
      void qc.invalidateQueries({ queryKey: [...queryKey] });
    }
    return () => {
      setApiTokenGetter(null);
      setApiAuthReady(false);
    };
  }, [isLoaded, qc]);

  return null;
}
