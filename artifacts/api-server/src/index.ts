import { runMigrations } from "stripe-replit-sync";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import app, { serverRef } from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./stripeClient";
import { handleStripeEvent } from "./lib/stripeWebhook";
import { wsHandler } from "./routes/ws";
import { ensureDefaultPromoCoupons } from "./lib/promo-coupon-sync";
import { ensureAdminRolePermissions } from "./lib/ensure-admin-role-permissions";
import type Stripe from "stripe";

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server remains up");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — server remains up");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL missing — skipping Stripe initialization");
    return;
  }
  try {
    logger.info("Initializing Stripe schema…");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    // Wrap stripe-replit-sync event handlers to run app logic after sync
    const wrapHandler = (eventType: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncHandler = (stripeSync as any).eventHandlers?.[eventType];
      if (!syncHandler) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stripeSync as any).eventHandlers[eventType] = async (event: Stripe.Event, accountId: string) => {
        await syncHandler.call(stripeSync, event, accountId);
        await handleStripeEvent(event).catch((err) => {
          logger.error({ err, eventType }, "App webhook handler error");
        });
      };
    };

    wrapHandler("invoice.paid");
    wrapHandler("customer.subscription.deleted");
    wrapHandler("customer.subscription.updated");
    wrapHandler("checkout.session.completed");

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Stripe webhook configured");
    }

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization failed — payments will not work until Stripe is connected");
  }
}

await initStripe();

ensureDefaultPromoCoupons()
  .then(() => logger.info("Default promo coupons ready"))
  .catch((err) => logger.error({ err }, "Default promo coupon seed failed"));

ensureAdminRolePermissions()
  .then(() => logger.info("Admin role permissions ready"))
  .catch((err) => logger.error({ err }, "Admin role permission seed failed"));

// Create HTTP server and attach WebSocket
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", wsHandler);

httpServer.on("upgrade", (req, socket, head) => {
  // Only handle WebSocket upgrade for /api/ws
  if (req.url === "/api/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

serverRef.current = httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
