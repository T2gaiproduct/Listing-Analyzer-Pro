import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { getActiveWorkspaceId } from "./workspace-route-helpers.js";
import {
  getShopifyConnection,
  getShopifyConnectionPublic,
  getWooCommerceConnection,
} from "./marketplace-connections.js";
import { maybeSyncShopifyOrdersForWorkspace } from "./shopify-order-sync.js";
import { maybeSyncWooCommerceOrdersForWorkspace } from "./woocommerce-order-sync.js";
import { maybeSyncAmazonOrdersForWorkspace } from "./amazon-order-sync.js";
import { resolveAmazonConnectionForWorkspace } from "./resolve-amazon-settings.js";

export async function maybeRefreshMarketplaceOrders(req: Request): Promise<void> {
  const workspaceId = getActiveWorkspaceId(req);
  const userId = getAuth(req)?.userId;
  if (!workspaceId) return;

  const shopifyConnection = await getShopifyConnectionPublic(workspaceId);
  if (shopifyConnection?.storeUrl) {
    const credentials = await getShopifyConnection(workspaceId);
    await maybeSyncShopifyOrdersForWorkspace({
      workspaceId,
      storeUrl: shopifyConnection.storeUrl,
      clientId: credentials?.clientId,
      clientSecret: credentials?.clientSecret,
    });
  }

  const wooConnection = await getWooCommerceConnection(workspaceId);
  if (wooConnection?.storeUrl && wooConnection.consumerKey && wooConnection.consumerSecret) {
    await maybeSyncWooCommerceOrdersForWorkspace({
      workspaceId,
      storeUrl: wooConnection.storeUrl,
      consumerKey: wooConnection.consumerKey,
      consumerSecret: wooConnection.consumerSecret,
    });
  }

  if (userId) {
    const amazonConnection = await resolveAmazonConnectionForWorkspace({ workspaceId, userId });
    if (amazonConnection) {
      await maybeSyncAmazonOrdersForWorkspace({
        workspaceId,
        connection: amazonConnection,
      });
    }
  }
}
