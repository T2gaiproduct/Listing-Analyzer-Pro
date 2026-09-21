import { useEffect, useRef, useState } from "react";

/**
 * True from when workspace scope changes until the scoped query finishes its first fetch.
 * Use with Product Explorer, Recent Projects, dashboard, etc. to avoid showing stale rows.
 */
export function useWorkspaceScopeLoading(
  scope: string | number | null | undefined,
  query: { isFetching: boolean; isLoading: boolean; isEnabled: boolean },
): boolean {
  const prevScope = useRef(scope);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (prevScope.current !== scope) {
      prevScope.current = scope;
      setPending(true);
    }
  }, [scope]);

  useEffect(() => {
    if (!pending) return;
    if (!query.isEnabled) return;
    if (!query.isFetching && !query.isLoading) {
      setPending(false);
    }
  }, [pending, query.isEnabled, query.isFetching, query.isLoading]);

  return pending;
}
