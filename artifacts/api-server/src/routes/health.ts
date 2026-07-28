import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  const clerkDummyPublishable = publishableKey.includes("ZXhhbXBsZS5jb20k");
  const clerkAuthReady =
    Boolean(secretKey)
    && Boolean(publishableKey)
    && !clerkDummyPublishable;

  res.json({
    status: "ok",
    supportTicketReply: true,
    clerkAuthReady,
    clerkPublishableKeyPrefix: publishableKey.slice(0, 20),
  });
});

export default router;
