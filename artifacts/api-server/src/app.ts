import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "node:fs";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { IMAGES_DIR } from "./lib/image-storage";
import { HERO_IMAGES_DIR } from "./lib/hero-image-storage";
import { handleHeroVideoUpload } from "./lib/hero-video-upload";
import { PORTFOLIO_IMAGES_DIR } from "./lib/portfolio-image-storage";
import { WORKFLOW_IMAGES_DIR } from "./lib/workflow-image-storage";
import { BLOG_IMAGES_DIR } from "./lib/blog-image-storage";
import {
  requireAuditImageAccess,
  requireGraphicsImageAccess,
  sendAuditImage,
  sendGraphicsImage,
} from "./lib/protected-images";
import { isAllowedOrigin } from "./lib/allowed-origins";
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
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  exposedHeaders: ["Upgrade"],
}));

// Hero video upload uses raw body (before JSON parser) — up to 50MB
app.post(
  "/api/admin/hero-video",
  express.raw({ type: ["video/*", "application/octet-stream"], limit: "50mb" }),
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
  (req, res) => { void handleHeroVideoUpload(req, res); },
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

// Public CMS/branding assets — register before /api/images/:auditId/:filename so
// segment names like "heroes" are not captured as audit ids (see protected-images.ts).
app.use("/api/images/avatars", express.static(path.join(IMAGES_DIR, "avatars")));
app.use("/api/images/branding", express.static(path.join(IMAGES_DIR, "branding")));
app.use("/api/images/heroes", express.static(HERO_IMAGES_DIR));
app.use("/api/images/portfolio", express.static(PORTFOLIO_IMAGES_DIR));
app.use("/api/images/workflow", express.static(WORKFLOW_IMAGES_DIR));
app.use("/api/images/blog", express.static(BLOG_IMAGES_DIR));

app.get(
  /^\/api\/images\/(?<auditId>\d+)\/(?<filename>[^/]+)$/,
  requireAuditImageAccess,
  sendAuditImage,
);

app.get(
  /^\/api\/images\/graphics\/(?<projectId>\d+)\/(?<filename>[^/]+)$/,
  requireGraphicsImageAccess,
  sendGraphicsImage,
);

app.use("/api", router);

// Express 5 HTML 404 pages break admin JSON clients — always return JSON for unknown /api routes.
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `API route not found (${req.method} ${req.originalUrl}). Restart the API server after deploying the latest code.`,
  });
});

app.use("/api", (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled API error");
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

const frontendDist = process.env.FRONTEND_DIST
  ?? path.resolve(process.cwd(), "artifacts/listing-auditor/dist/public");
const shouldServeFrontend =
  process.env.SERVE_FRONTEND === "1"
  || process.env.SERVE_FRONTEND === "true"
  || (process.env.NODE_ENV === "production" && fs.existsSync(path.join(frontendDist, "index.html")));

if (shouldServeFrontend) {
  app.use(express.static(frontendDist, { index: false }));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
export const serverRef: { current: import("node:http").Server | null } = { current: null };
