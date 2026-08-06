import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export type StoreMarketplace = "shopify" | "woocommerce";

export type StoreConnection = {
  storeUrl: string;
  connectedAt: string;
};

function connectionKey(workspaceId: number, platform: StoreMarketplace): string {
  return `marketplace_connection_${workspaceId}_${platform}`;
}

export async function getStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
): Promise<StoreConnection | null> {
  const key = connectionKey(workspaceId, platform);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  if (!row?.value) return null;

  try {
    const parsed = JSON.parse(row.value) as StoreConnection;
    if (!parsed.storeUrl?.trim()) return null;
    return {
      storeUrl: parsed.storeUrl.trim(),
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
  storeUrl: string,
): Promise<StoreConnection> {
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

export async function disconnectStoreConnection(
  workspaceId: number,
  platform: StoreMarketplace,
): Promise<void> {
  const key = connectionKey(workspaceId, platform);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}
