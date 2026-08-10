import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Download, Loader2, Plug, Store, Unplug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { useWorkspace } from "@/hooks/use-workspace";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { useToast } from "@/hooks/use-toast";
import { MarketplaceLogo } from "@/components/marketplace-logos";
import {
  connectStoreMarketplace,
  disconnectAmazon,
  disconnectStoreMarketplace,
  fetchMarketplaceConnections,
  startAmazonConnect,
  syncShopifyProducts,
  type StoreMarketplace,
} from "@/lib/marketplace-connections";

type ConnectTarget = "amazon" | StoreMarketplace;

const CONNECT_CARDS: Array<{
  id: ConnectTarget;
  marketplace: string;
  description: string;
  placeholder: string;
}> = [
  {
    id: "amazon",
    marketplace: "Amazon",
    description: "Link your Amazon Seller Central account to publish listings directly from SellerLens.",
    placeholder: "",
  },
  {
    id: "shopify",
    marketplace: "Shopify",
    description: "Connect your Shopify store with Admin API credentials to sync, export, and publish listings.",
    placeholder: "https://your-store.myshopify.com",
  },
  {
    id: "woocommerce",
    marketplace: "WooCommerce",
    description: "Connect your WooCommerce store to manage catalog exports from one workspace.",
    placeholder: "https://your-store.com",
  },
];

function ConnectCard({
  marketplace,
  description,
  connected,
  detail,
  loading,
  onConnect,
  onDisconnect,
  onImport,
  importLoading,
}: {
  marketplace: string;
  description: string;
  connected: boolean;
  detail?: string | null;
  loading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onImport?: () => void;
  importLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <MarketplaceLogo marketplace={marketplace} className="h-7 w-32" />
        {connected && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Check className="w-3 h-3" />
            Connected
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed flex-1">{description}</p>

      {connected && detail ? (
        <p className="text-[11px] text-slate-500 break-all rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          {detail}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {connected ? (
          <>
            {onImport ? (
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading || importLoading}
                onClick={onImport}
              >
                {importLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Import products
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={loading || importLoading}
              onClick={onDisconnect}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
              )}
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
            disabled={loading}
            onClick={onConnect}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plug className="w-3.5 h-3.5 mr-1.5" />
            )}
            Connect with {marketplace}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MarketplacesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { platformName } = useBranding();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { featureWorkspaceId, isLoading: wsLoading, needsWorkspaceSelection } = useWorkspace();
  const [dialogTarget, setDialogTarget] = useState<StoreMarketplace | null>(null);
  const [storeUrl, setStoreUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pendingAction, setPendingAction] = useState<ConnectTarget | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-connections", featureWorkspaceId],
    queryFn: fetchMarketplaceConnections,
    enabled: clerkLoaded && !!user && !!featureWorkspaceId,
    staleTime: 10_000,
    refetchOnMount: "always",
    retry: 1,
  });

  const connectStoreMutation = useMutation({
    mutationFn: ({
      platform,
      url,
      shopifyClientId,
      shopifyClientSecret,
    }: {
      platform: StoreMarketplace;
      url: string;
      shopifyClientId?: string;
      shopifyClientSecret?: string;
    }) => connectStoreMarketplace(platform, {
      storeUrl: url,
      clientId: shopifyClientId,
      clientSecret: shopifyClientSecret,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      void queryClient.invalidateQueries({ queryKey: ["shopify-connection-status"] });
      setDialogTarget(null);
      setStoreUrl("");
      setClientId("");
      setClientSecret("");
      toast({ title: "Store connected", description: "Your marketplace connection is ready." });
    },
    onError: (error) => {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Could not connect store.",
        variant: "destructive",
      });
    },
    onSettled: () => setPendingAction(null),
  });

  const shopifySyncMutation = useMutation({
    mutationFn: syncShopifyProducts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      const skippedNote = result.skipped > 0 ? ` ${result.skipped} already imported.` : "";
      const updatedNote = result.updated > 0 ? ` ${result.updated} refreshed from Shopify.` : "";
      const ordersNote = (result.ordersImported ?? 0) > 0 || (result.ordersUpdated ?? 0) > 0
        ? ` Synced ${(result.ordersImported ?? 0) + (result.ordersUpdated ?? 0)} Shopify order${(result.ordersImported ?? 0) + (result.ordersUpdated ?? 0) === 1 ? "" : "s"}.`
        : result.ordersSyncQueued
          ? " Syncing Shopify orders in the background."
          : "";
      toast({
        title: "Shopify products imported",
        description: `Imported ${result.imported} of ${result.total} products.${updatedNote}${skippedNote}${ordersNote}`,
      });
      if (result.errors.length > 0) {
        toast({
          title: "Some products could not be imported",
          description: result.errors.slice(0, 2).map((e) => e.error).join(" "),
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import Shopify products.",
        variant: "destructive",
      });
    },
  });

  async function handleAmazonConnect() {
    setPendingAction("amazon");
    try {
      await startAmazonConnect();
    } catch (error) {
      setPendingAction(null);
      toast({
        title: "Amazon connection failed",
        description: error instanceof Error ? error.message : "Could not start Amazon authorization.",
        variant: "destructive",
      });
    }
  }

  async function handleAmazonDisconnect() {
    setPendingAction("amazon");
    try {
      await disconnectAmazon();
      await queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      toast({ title: "Amazon disconnected" });
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: error instanceof Error ? error.message : "Could not disconnect Amazon.",
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  }

  function openStoreDialog(platform: StoreMarketplace) {
    setStoreUrl("");
    setClientId("");
    setClientSecret("");
    setDialogTarget(platform);
  }

  function submitStoreConnection() {
    if (!dialogTarget) return;
    const url = storeUrl.trim();
    if (!url) {
      toast({
        title: "Store URL required",
        description: "Enter your store URL to continue.",
        variant: "destructive",
      });
      return;
    }
    if (dialogTarget === "shopify") {
      if (!clientId.trim() || !clientSecret.trim()) {
        toast({
          title: "API credentials required",
          description: "Enter your Shopify Client ID and Client secret from the Dev Dashboard.",
          variant: "destructive",
        });
        return;
      }
    }
    setPendingAction(dialogTarget);
    connectStoreMutation.mutate({
      platform: dialogTarget,
      url,
      shopifyClientId: dialogTarget === "shopify" ? clientId.trim() : undefined,
      shopifyClientSecret: dialogTarget === "shopify" ? clientSecret.trim() : undefined,
    });
  }

  async function handleStoreDisconnect(platform: StoreMarketplace) {
    setPendingAction(platform);
    try {
      await disconnectStoreMarketplace(platform);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      toast({ title: `${platform === "shopify" ? "Shopify" : "WooCommerce"} disconnected` });
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: error instanceof Error ? error.message : "Could not disconnect store.",
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (wsLoading || (isLoading && featureWorkspaceId)) {
    return (
      <div className="space-y-4 animate-in fade-in max-w-5xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!featureWorkspaceId || needsWorkspaceSelection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Store className="w-10 h-10 text-slate-300 mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Select a workspace</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md">
          Marketplace connections are scoped to a workspace. Choose one in the top bar, or create a workspace from {WORKSPACES_HUB_LABEL}.
        </p>
        <Button asChild size="sm" className="mt-5 bg-orange-500 hover:bg-orange-600 text-xs h-8">
          <Link href="/workspaces">{WORKSPACES_HUB_LABEL}</Link>
        </Button>
      </div>
    );
  }

  const amazonConnected = Boolean(data?.amazon.connected);
  const shopifyConnected = Boolean(data?.shopify.connected);
  const woocommerceConnected = Boolean(data?.woocommerce.connected);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-5xl">
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <span>{platformName}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600">Marketplaces</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Marketplaces</h1>
        <p className="text-xs text-slate-500 max-w-2xl">
          Connect the sales channels you use in this workspace. Once connected, you can publish and export listings to Amazon, Shopify, and WooCommerce.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ConnectCard
          marketplace="Amazon"
          description={CONNECT_CARDS[0]!.description}
          connected={amazonConnected}
          detail={amazonConnected ? data?.amazon.sellerId ?? "Seller account linked" : null}
          loading={pendingAction === "amazon"}
          onConnect={handleAmazonConnect}
          onDisconnect={handleAmazonDisconnect}
        />
        <ConnectCard
          marketplace="Shopify"
          description={CONNECT_CARDS[1]!.description}
          connected={shopifyConnected}
          detail={
            shopifyConnected
              ? [
                  data?.shopify.storeUrl,
                  data?.shopify.publishReady ? "Direct publish enabled" : "Add API credentials to publish",
                ].filter(Boolean).join(" · ")
              : null
          }
          loading={pendingAction === "shopify"}
          importLoading={shopifySyncMutation.isPending}
          onConnect={() => openStoreDialog("shopify")}
          onDisconnect={() => void handleStoreDisconnect("shopify")}
          onImport={shopifyConnected ? () => shopifySyncMutation.mutate() : undefined}
        />
        <ConnectCard
          marketplace="WooCommerce"
          description={CONNECT_CARDS[2]!.description}
          connected={woocommerceConnected}
          detail={data?.woocommerce.storeUrl}
          loading={pendingAction === "woocommerce"}
          onConnect={() => openStoreDialog("woocommerce")}
          onDisconnect={() => void handleStoreDisconnect("woocommerce")}
        />
      </div>

      <Dialog open={dialogTarget != null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Connect with {dialogTarget === "shopify" ? "Shopify" : "WooCommerce"}
            </DialogTitle>
            <DialogDescription>
              {dialogTarget === "shopify"
                ? "Enter your Shopify store URL and Admin API credentials from the Dev Dashboard (Settings → Client ID & secret)."
                : "Enter your store URL. We will use it for exports and marketplace sync in this workspace."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="store-url" className="text-xs text-slate-600">
                Store URL
              </Label>
              <Input
                id="store-url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder={
                  dialogTarget === "shopify"
                    ? "https://your-store.myshopify.com"
                    : "https://your-store.com"
                }
                className="h-9 text-xs"
              />
            </div>
            {dialogTarget === "shopify" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="client-id" className="text-xs text-slate-600">
                    Client ID
                  </Label>
                  <Input
                    id="client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="From Dev Dashboard → Settings"
                    className="h-9 text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-secret" className="text-xs text-slate-600">
                    Client secret
                  </Label>
                  <Input
                    id="client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="From Dev Dashboard → Settings"
                    className="h-9 text-xs"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => setDialogTarget(null)}
              disabled={connectStoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn("h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white")}
              onClick={submitStoreConnection}
              disabled={connectStoreMutation.isPending}
            >
              {connectStoreMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect store"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
