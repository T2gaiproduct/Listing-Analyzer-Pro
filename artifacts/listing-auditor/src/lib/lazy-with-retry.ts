import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/chunk-load-error";

async function importWithChunkRecovery<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): Promise<{ default: T }> {
  try {
    return await factory();
  } catch (error) {
    if (!isChunkLoadError(error)) throw error;
    try {
      return await factory();
    } catch (retryError) {
      if (!isChunkLoadError(retryError)) throw retryError;
      reloadOnceForStaleChunk();
      return new Promise(() => {
        /* reload in flight */
      });
    }
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithChunkRecovery(factory));
}
