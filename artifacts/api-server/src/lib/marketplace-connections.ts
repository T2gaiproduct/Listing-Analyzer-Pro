import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { clearShopifyAccessTokenCache, parseShopifyShopHost } from "./shopify-admin-client.js";

export type StoreMarketplace = "shopify" | "woocommerce";

export type StoreConnection = {
  storeUrl: string;
  connectedAt: string;
};

export type ShopifyStoreConnection = StoreConnection & {
  clientId: string;
};

export type ShopifyStoreConnectionWithSecret = ShopifyStoreConnection & {
  clientSecret: string;
};

function connectionKey(workspaceId: number, platform: StoreMarketplace): string {
  return `marketplace_connection_${workspaceId}_${platform}`;
}

function parseStoreConnection(raw: string | null | undefined): StoreConnection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoreConnection & { clientId?: string };
    if (!parsed.storeUrl?.trim()) return null;
    return {
      storeUrl: parsed.storeUrl.trim(),
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseShopifyConnectionPublic(raw: string | null | undefined): ShopifyStoreConnection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopifyStoreConnectionWithSecret;
    if (!parsed.storeUrl?.trim()) return null;
    return {
      storeUrl: parsed.storeUrl.trim(),
      clientId: parsed.clientId?.trim() ?? "",
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseShopifyConnection(raw: string | null | undefined): ShopifyStoreConnectionWithSecret | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopifyStoreConnectionWithSecret;
    if (!parsed.storeUrl?.trim() || !parsed.clientId?.trim() || !parsed.clientSecret?.trim()) {
      return null;
    }
    return {
      storeUrl: parsed.storeUrl.trim(),
      clientId: parsed.clientId.trim(),
      clientSecret: parsed.clientSecret.trim(),
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function isShopifyPublishReady(
  connection: ShopifyStoreConnection | ShopifyStoreConnectionWithSecret | null,
): boolean {
  if (!connection?.storeUrl || !connection.clientId) return false;
  return "clientSecret" in connection && Boolean(connection.clientSecret?.trim());
}

export async function getStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
): Promise<StoreConnection | null> {
  if (platform === "shopify") {
    return getShopifyConnectionPublic(workspaceId);
  }

  const key = connectionKey(workspaceId, platform);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  return parseStoreConnection(row?.value);
}

export async function getShopifyConnection(
  workspaceId: number,
): Promise<ShopifyStoreConnectionWithSecret | null> {
  const key = connectionKey(workspaceId, "shopify");
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  return parseShopifyConnection(row?.value);
}

export async function getShopifyConnectionPublic(
  workspaceId: number,
): Promise<ShopifyStoreConnection | null> {
  const key = connectionKey(workspaceId, "shopify");
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  return parseShopifyConnectionPublic(row?.value);
}

export async function saveStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
  storeUrl: string,
): Promise<StoreConnection> {
  if (platform === "shopify") {
    throw new Error("Use saveShopifyConnection for Shopify credentials");
  }

  const key = connectionKey(workspaceId, platform);
  const connection: StoreConnection = {
    storeUrl: storeUrl.trim(),
    connectedAt: new Date().toISOString(),
  };

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(settingsTable)
      .set({ value: JSON.stringify(connection), updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({
      key,
      value: JSON.stringify(connection),
      category: "marketplace_connections",
      isSecret: false,
    });
  }

  return connection;
}

export async function saveShopifyConnection(
  workspaceId: number,
  input: {
    storeUrl: string;
    clientId: string;
    clientSecret: string;
  },
): Promise<ShopifyStoreConnection> {
  const key = connectionKey(workspaceId, "shopify");
  const connection: ShopifyStoreConnectionWithSecret = {
    storeUrl: input.storeUrl.trim(),
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    connectedAt: new Date().toISOString(),
  };

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  const payload = JSON.stringify(connection);
  if (existing) {
    await db
      .update(settingsTable)
      .set({ value: payload, updatedAt: new Date(), isSecret: true })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({
      key,
      value: payload,
      category: "marketplace_connections",
      isSecret: true,
    });
  }

  try {
    clearShopifyAccessTokenCache({
      shopHost: parseShopifyShopHost(connection.storeUrl),
      clientId: connection.clientId,
    });
  } catch {
    clearShopifyAccessTokenCache();
  }

  return {
    storeUrl: connection.storeUrl,
    clientId: connection.clientId,
    connectedAt: connection.connectedAt,
  };
}

export async function disconnectStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
): Promise<void> {
  const key = connectionKey(workspaceId, platform);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}
