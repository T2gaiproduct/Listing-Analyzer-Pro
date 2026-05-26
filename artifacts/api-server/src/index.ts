import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./stripeClient";
import { handleStripeEvent } from "./lib/stripeWebhook";
import type Stripe from "stripe";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
