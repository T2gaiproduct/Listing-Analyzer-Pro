import { Router, type IRouter } from "express";
import { loadedBuildId, readDiskBuildMeta, isStaleApiProcess } from "../lib/api-build-meta";
import {
  checkClerkPublishableSecretPair,
  clerkFrontendHostFromPublishableKey,
} from "../lib/clerk-key-pair.js";

function clerkPublishableFromEnv(): string {
  return (
    process.env.CLERK_PUBLISHABLE_KEY?.trim()
    || process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()
    || ""
  );
}

/** AGENTS.md dummy secret pattern — cannot verify real VITE publishable keys. */
function clerkSecretLooksLikeDocsPlaceholder(secret: string): boolean {
  return /^sk_test_0123456/i.test(secret.trim());
}

const router: IRouter = Router();

async function checkClerkProxySecret(): Promise<"ok" | "missing" | "invalid" | "skipped"> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return "missing";
  try {
    const resp = await fetch("https://api.clerk.com/v1/instance", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    return resp.ok ? "ok" : "invalid";
  } catch {
    return "invalid";
  }
}

router.get("/healthz", async (_req, res) => {
  const build = {
    apiBuildId: loadedBuildId,
    staleProcess: isStaleApiProcess(),
    latestBuildId: readDiskBuildMeta()?.buildId ?? null,
  };

  if (process.env.NODE_ENV === "production") {
    res.json({ status: "ok", ...build });
    return;
  }

  const clerkProxySecret = await checkClerkProxySecret();
  const clerkKeyPair = await checkClerkPublishableSecretPair();
  const clerkPublishable = clerkPublishableFromEnv();
  const clerkPublishableHost = clerkFrontendHostFromPublishableKey(clerkPublishable);
  const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim() ?? "";
  res.json({
    status: "ok",
    publishImageFix: "marketplace-signed-url-v5",
    clerkProxySecret,
    clerkKeyPair,
    clerkPublishableHost,
    clerkSecretLooksLikePlaceholder: clerkSecretKey
      ? clerkSecretLooksLikeDocsPlaceholder(clerkSecretKey)
      : false,
    ...build,
  });
});

export default router;
