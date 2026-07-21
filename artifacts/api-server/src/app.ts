import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { IMAGES_DIR, GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./lib/image-storage";
import { HERO_IMAGES_DIR } from "./lib/hero-image-storage";
import { PORTFOLIO_IMAGES_DIR } from "./lib/portfolio-image-storage";
import { WORKFLOW_IMAGES_DIR } from "./lib/workflow-image-storage";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ─── Stripe webhook MUST be registered BEFORE express.json() ─────────────────
// Stripe requires the raw Buffer body to verify the signature.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// ─── General middleware (after webhook) ──────────────────────────────────────
app.use(cors({ credentials: true, origin: true, exposedHeaders: ["Upgrade"] }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  }),
);

app.get("/api/images/:auditId/:filename", (req, res, next) => {
  const auditId = parseInt(String(req.params.auditId ?? ""), 10);
  const filename = String(req.params.filename ?? "");
  if (isNaN(auditId) || !filename || filename.includes("..")) {
    next();
    return;
  }
  const resolved = resolveAuditImagePath(auditId, `/api/images/${auditId}/${filename}`);
  if (resolved) {
    res.sendFile(resolved);
    return;
  }
  next();
});

app.use("/api/images", express.static(IMAGES_DIR));
app.use("/api/images/graphics", express.static(GRAPHICS_IMAGES_DIR));
app.use("/api/images/heroes", express.static(HERO_IMAGES_DIR));
app.use("/api/images/portfolio", express.static(PORTFOLIO_IMAGES_DIR));
app.use("/api/images/workflow", express.static(WORKFLOW_IMAGES_DIR));
app.use("/api", router);

export default app;
export const serverRef: { current: import("node:http").Server | null } = { current: null };
