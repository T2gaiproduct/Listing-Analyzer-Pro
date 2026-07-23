import { useLayoutEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { setApiAuthReady, setApiTokenGetter } from "@/lib/api-fetch";

/** Wires Clerk session tokens into all same-origin /api fetch calls. */
export function ApiTokenBridge() {
  const { getToken, isLoaded } = useAuth();
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
    return () => {
      setApiTokenGetter(null);
      setApiAuthReady(false);
    };
  }, [isLoaded]);

  return null;
}
