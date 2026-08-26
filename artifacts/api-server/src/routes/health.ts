import { Router, type IRouter } from "express";

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
  const clerkProxySecret = await checkClerkProxySecret();
  res.json({
    status: "ok",
    publishImageFix: "marketplace-signed-url-v5",
    clerkProxySecret,
  });
});

export default router;
