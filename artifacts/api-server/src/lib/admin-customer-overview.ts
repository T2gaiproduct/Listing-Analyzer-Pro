import { and, eq, inArray, desc, sql } from "drizzle-orm";
import {
  db,
  settingsTable,
  workspacesTable,
  amazonSellerConnectionsTable,
  paymentsTable,
  invoicesTable,
  graphicsProjectsTable,
  auditsTable,
} from "@workspace/db";
import { getWorkspaceMemberSummaryForOwner } from "./workspace-member-summary.js";

const MARKETPLACE_PLATFORMS = [
  "amazon",
  "ebay",
  "walmart",
  "shopify",
  "woocommerce",
] as const;

export type AdminMarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export type AdminCustomerMarketplaceConnection = {
  platform: AdminMarketplacePlatform;
  connected: boolean;
  workspaceId: number | null;
  workspaceName: string | null;
  label: string | null;
  environment: string | null;
  connectedAt: string | null;
  source: "workspace_settings" | "user_amazon_seller";
};

export type AdminCustomerBillingSummary = {
  completedPaymentsTotal: number;
  pendingPaymentsTotal: number;
  pendingPaymentsCount: number;
  failedPaymentsCount: number;
  paidInvoicesTotal: number;
  unpaidInvoicesTotal: number;
  /** Best available spend figure for the header card. */
  totalSpend: number;
  spendSource: "payments" | "invoices" | "none";
  hasActiveSubscriptionWithoutSpend: boolean;
};

function marketplaceConnectionKey(workspaceId: number, platform: string): string {
  return `marketplace_connection_${workspaceId}_${platform}`;
}

function safeJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseMarketplacePublic(
  platform: AdminMarketplacePlatform,
  raw: string | null | undefined,
): { connected: boolean; label: string | null; environment: string | null; connectedAt: string | null } {
  const data = safeJson(raw);
  if (!data) {
    return { connected: false, label: null, environment: null, connectedAt: null };
  }

  if (platform === "amazon") {
    const sellerId = asString(data.sellerId);
    const refreshToken = asString(data.refreshToken);
    const connected = Boolean(sellerId || refreshToken);
    return {
      connected,
      label: sellerId,
      environment: data.sandbox === false ? "production" : (connected ? "sandbox" : null),
      connectedAt: asString(data.sellerConnectedAt) ?? asString(data.connectedAt),
    };
  }

  if (platform === "ebay") {
    const refreshToken = asString(data.refreshToken);
    const connected = Boolean(refreshToken);
    return {
      connected,
      label: asString(data.username) ?? asString(data.ebayUserId),
      environment: asString(data.environment),
      connectedAt: asString(data.connectedAt),
    };
  }

  if (platform === "walmart") {
    const partnerId = asString(data.partnerId);
    const refreshToken = asString(data.refreshToken);
    const connected = Boolean(partnerId && refreshToken);
    return {
      connected,
      label: partnerId,
      environment: asString(data.environment),
      connectedAt: asString(data.connectedAt),
    };
  }

  // shopify / woocommerce
  const storeUrl = asString(data.storeUrl);
  const connected = Boolean(storeUrl);
  return {
    connected,
    label: storeUrl,
    environment: null,
    connectedAt: asString(data.connectedAt),
  };
}

export async function loadAdminCustomerMarketplaces(
  userId: string,
): Promise<AdminCustomerMarketplaceConnection[]> {
  const ownedWorkspaces = await db
    .select({
      id: workspacesTable.id,
      name: workspacesTable.name,
    })
    .from(workspacesTable)
    .where(and(
      eq(workspacesTable.accountOwnerId, userId),
      eq(workspacesTable.isDeleted, 0),
    ))
    .orderBy(desc(workspacesTable.isDefault), workspacesTable.name);

  const results: AdminCustomerMarketplaceConnection[] = [];
  const workspaceIds = ownedWorkspaces.map((w) => w.id);
  const workspaceNameById = new Map(ownedWorkspaces.map((w) => [w.id, w.name]));

  if (workspaceIds.length > 0) {
    const keys = workspaceIds.flatMap((id) =>
      MARKETPLACE_PLATFORMS.map((platform) => marketplaceConnectionKey(id, platform)),
    );
    const rows = await db
      .select({ key: settingsTable.key, value: settingsTable.value })
      .from(settingsTable)
      .where(inArray(settingsTable.key, keys));
    const valueByKey = new Map(rows.map((r) => [r.key, r.value]));

    for (const workspaceId of workspaceIds) {
      for (const platform of MARKETPLACE_PLATFORMS) {
        const key = marketplaceConnectionKey(workspaceId, platform);
        const parsed = parseMarketplacePublic(platform, valueByKey.get(key));
        if (!parsed.connected) continue;
        results.push({
          platform,
          connected: true,
          workspaceId,
          workspaceName: workspaceNameById.get(workspaceId) ?? null,
          label: parsed.label,
          environment: parsed.environment,
          connectedAt: parsed.connectedAt,
          source: "workspace_settings",
        });
      }
    }
  }

  const [amazonUser] = await db
    .select({
      sellerId: amazonSellerConnectionsTable.sellerId,
      connectedAt: amazonSellerConnectionsTable.connectedAt,
      marketplaceIds: amazonSellerConnectionsTable.marketplaceIds,
    })
    .from(amazonSellerConnectionsTable)
    .where(and(
      eq(amazonSellerConnectionsTable.userId, userId),
      eq(amazonSellerConnectionsTable.isDeleted, 0),
    ))
    .limit(1);

  if (amazonUser?.sellerId) {
    const already = results.some(
      (r) => r.platform === "amazon" && r.label === amazonUser.sellerId,
    );
    if (!already) {
      results.push({
        platform: "amazon",
        connected: true,
        workspaceId: null,
        workspaceName: null,
        label: amazonUser.sellerId,
        environment: null,
        connectedAt: amazonUser.connectedAt instanceof Date
          ? amazonUser.connectedAt.toISOString()
          : amazonUser.connectedAt
            ? String(amazonUser.connectedAt)
            : null,
        source: "user_amazon_seller",
      });
    }
  }

  return results;
}

export async function loadAdminCustomerBillingSummary(
  userId: string,
  hasActiveSubscription: boolean,
): Promise<AdminCustomerBillingSummary> {
  const [paymentRows, invoiceRows] = await Promise.all([
    db
      .select({
        amount: paymentsTable.amount,
        status: paymentsTable.status,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.userId, userId)),
    db
      .select({
        amount: invoicesTable.amount,
        status: invoicesTable.status,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.userId, userId)),
  ]);

  let completedPaymentsTotal = 0;
  let pendingPaymentsTotal = 0;
  let pendingPaymentsCount = 0;
  let failedPaymentsCount = 0;
  for (const row of paymentRows) {
    const amount = Number(row.amount) || 0;
    const status = (row.status ?? "").toLowerCase();
    if (status === "completed" || status === "paid" || status === "succeeded") {
      completedPaymentsTotal += amount;
    } else if (status === "pending") {
      pendingPaymentsTotal += amount;
      pendingPaymentsCount += 1;
    } else if (status === "failed") {
      failedPaymentsCount += 1;
    }
  }

  let paidInvoicesTotal = 0;
  let unpaidInvoicesTotal = 0;
  for (const row of invoiceRows) {
    const amount = Number(row.amount) || 0;
    const status = (row.status ?? "").toLowerCase();
    if (status === "paid") paidInvoicesTotal += amount;
    else if (status === "unpaid" || status === "open") unpaidInvoicesTotal += amount;
  }

  let totalSpend = completedPaymentsTotal;
  let spendSource: AdminCustomerBillingSummary["spendSource"] = "payments";
  if (completedPaymentsTotal <= 0 && paidInvoicesTotal > 0) {
    totalSpend = paidInvoicesTotal;
    spendSource = "invoices";
  } else if (completedPaymentsTotal <= 0 && paidInvoicesTotal <= 0) {
    spendSource = "none";
  }

  return {
    completedPaymentsTotal,
    pendingPaymentsTotal,
    pendingPaymentsCount,
    failedPaymentsCount,
    paidInvoicesTotal,
    unpaidInvoicesTotal,
    totalSpend,
    spendSource,
    hasActiveSubscriptionWithoutSpend: hasActiveSubscription && totalSpend <= 0,
  };
}

export async function loadAdminCustomerOverviewExtras(userId: string, opts?: {
  hasActiveSubscription?: boolean;
}) {
  const [marketplaces, workspaces, billingSummary, graphicsCountRow, auditCountRow] = await Promise.all([
    loadAdminCustomerMarketplaces(userId),
    getWorkspaceMemberSummaryForOwner(userId, { includeMembers: true }),
    loadAdminCustomerBillingSummary(userId, Boolean(opts?.hasActiveSubscription)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(graphicsProjectsTable)
      .where(and(
        eq(graphicsProjectsTable.userId, userId),
        eq(graphicsProjectsTable.isDeleted, 0),
      )),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditsTable)
      .where(and(
        eq(auditsTable.userId, userId),
        eq(auditsTable.isDeleted, 0),
      )),
  ]);

  return {
    marketplaces,
    workspaces,
    billingSummary,
    projectCounts: {
      audits: Number(auditCountRow[0]?.total ?? 0),
      graphics: Number(graphicsCountRow[0]?.total ?? 0),
      workspaces: workspaces.workspaces.length,
      connectedMarketplaces: marketplaces.filter((m) => m.connected).length,
    },
  };
}
