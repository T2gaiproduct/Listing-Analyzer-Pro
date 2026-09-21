import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { setApiAuthReady, setApiTokenGetter } from "@/lib/api-fetch";
import { showCreditUsageToast, CREDIT_USAGE_EVENT, type CreditUsagePayload } from "@/lib/credit-usage-toast";

const ApiAuthReadyContext = createContext(false);

/** True once Clerk auth is loaded and API Bearer tokens can be resolved. */
export function useApiAuthReady(): boolean {
  return useContext(ApiAuthReadyContext);
}

/** Wires Clerk session tokens into all same-origin /api fetch calls. */
export function ApiTokenBridge({ children }: { children?: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [authReady, setAuthReady] = useState(false);

  // useLayoutEffect runs before child useEffects (React Query fetches), avoiding 401 races.
  useLayoutEffect(() => {
    const onCreditUsage = (event: Event) => {
      const detail = (event as CustomEvent<CreditUsagePayload>).detail;
      if (detail?.title && detail?.message) {
        showCreditUsageToast(detail);
      }
    };
    window.addEventListener(CREDIT_USAGE_EVENT, onCreditUsage);
    return () => window.removeEventListener(CREDIT_USAGE_EVENT, onCreditUsage);
  }, []);

  useLayoutEffect(() => {
    if (!isLoaded) {
      setApiTokenGetter(null);
      setApiAuthReady(false);
      setAuthReady(false);
      return;
    }
    if (!isSignedIn) {
      setApiTokenGetter(null);
      setApiAuthReady(false);
      setAuthReady(false);
      return;
    }
    setApiTokenGetter(async () => {
      const getToken = getTokenRef.current;
      if (!getToken) return null;
      try {
        const fresh = await getToken({ skipCache: true });
        if (fresh) return fresh;
        return await getToken();
      } catch {
        return null;
      }
    });
    setApiAuthReady(true);
    setAuthReady(true);
    return () => {
      setApiTokenGetter(null);
      setApiAuthReady(false);
      setAuthReady(false);
    };
  }, [isLoaded, isSignedIn]);

  return (
    <ApiAuthReadyContext.Provider value={authReady}>
      {children}
    </ApiAuthReadyContext.Provider>
  );
}
