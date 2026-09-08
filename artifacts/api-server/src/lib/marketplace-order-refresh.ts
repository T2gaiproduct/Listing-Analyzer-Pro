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

export type MarketplaceOrderRefreshResult = {
  warnings: string[];
};

export async function maybeRefreshMarketplaceOrders(
  req: Request,
  opts?: { force?: boolean },
): Promise<MarketplaceOrderRefreshResult> {
  const warnings: string[] = [];
  const workspaceId = getActiveWorkspaceId(req);
  const userId = getAuth(req)?.userId;
  if (!workspaceId) return { warnings };

  const shopifyConnection = await getShopifyConnectionPublic(workspaceId);
  if (shopifyConnection?.storeUrl) {
    const credentials = await getShopifyConnection(workspaceId);
    const shopifyResult = await maybeSyncShopifyOrdersForWorkspace({
      workspaceId,
      storeUrl: shopifyConnection.storeUrl,
      clientId: credentials?.clientId,
      clientSecret: credentials?.clientSecret,
      force: opts?.force === true,
    });
    if (shopifyResult?.errors?.length) {
      warnings.push(...shopifyResult.errors);
    }
  }

  const wooConnection = await getWooCommerceConnection(workspaceId);
  if (wooConnection?.storeUrl && wooConnection.consumerKey && wooConnection.consumerSecret) {
    const wooResult = await maybeSyncWooCommerceOrdersForWorkspace({
      workspaceId,
      storeUrl: wooConnection.storeUrl,
      consumerKey: wooConnection.consumerKey,
      consumerSecret: wooConnection.consumerSecret,
    });
    if (wooResult?.errors?.length) {
      warnings.push(...wooResult.errors);
    }
  }

  if (userId) {
    const amazonConnection = await resolveAmazonConnectionForWorkspace({ workspaceId, userId });
    if (amazonConnection) {
      const amazonResult = await maybeSyncAmazonOrdersForWorkspace({
        workspaceId,
        connection: amazonConnection,
      });
      if (amazonResult?.errors?.length) {
        warnings.push(...amazonResult.errors);
      }
    }
  }

  return { warnings };
}
