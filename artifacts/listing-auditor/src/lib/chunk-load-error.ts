export const CHUNK_RELOAD_SESSION_KEY = "la_chunk_reload_attempted";
export const BUILD_RELOAD_SESSION_KEY = "la_reloaded_for_build";

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message) return false;
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk")
  );
}

/** One automatic full reload per page session when lazy chunks are stale after a deploy. */
export function reloadOnceForStaleChunk(): void {
  if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
  window.location.reload();
}
