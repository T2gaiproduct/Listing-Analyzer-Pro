import { useState, useEffect, useMemo } from "react";
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
import { AMAZON_MARKETPLACES } from "@/lib/amazon-export";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { useToast } from "@/hooks/use-toast";
import { MarketplaceLogo } from "@/components/marketplace-logos";
import {
  connectAmazonMarketplace,
  connectStoreMarketplace,
  disconnectAmazon,
  disconnectStoreMarketplace,
  fetchMarketplaceConnections,
  startAmazonConnect,
  syncShopifyProducts,
  syncWooCommerceProducts,
  type StoreMarketplace,
} from "@/lib/marketplace-connections";

type DialogTarget = StoreMarketplace | "amazon";

function buildAmazonRedirectUri(): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = `${basePath}/api/amazon/oauth/callback`.replace(/^\/\//, "/").replace(/([^:]\/)\/+/g, "$1");
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

const CONNECT_CARDS: Array<{
  id: DialogTarget;
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
    description: "Connect your WooCommerce store with REST API credentials to sync and export listings.",
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
  setupRequired,
  setupMessage,
  setupHref,
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
  setupRequired?: boolean;
  setupMessage?: string;
  setupHref?: string;
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

      {setupRequired && setupMessage ? (
        <p className="text-[11px] text-amber-800 leading-relaxed rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          {setupMessage}
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
        ) : setupRequired ? (
          setupHref ? (
            <Button
              asChild
              type="button"
              size="sm"
              className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href={setupHref}>Configure Amazon SP-API</Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              variant="outline"
              disabled
            >
              Setup required
            </Button>
          )
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
  const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null);
  const [storeUrl, setStoreUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [amazonApplicationId, setAmazonApplicationId] = useState("");
  const [amazonClientId, setAmazonClientId] = useState("");
  const [amazonClientSecret, setAmazonClientSecret] = useState("");
  const [amazonAwsAccessKeyId, setAmazonAwsAccessKeyId] = useState("");
  const [amazonAwsSecretAccessKey, setAmazonAwsSecretAccessKey] = useState("");
  const [amazonAwsRoleArn, setAmazonAwsRoleArn] = useState("");
  const [amazonDefaultMarketplace, setAmazonDefaultMarketplace] = useState("US");
  const [amazonSandbox, setAmazonSandbox] = useState(true);
  const [pendingAction, setPendingAction] = useState<DialogTarget | null>(null);
  const amazonRedirectUri = useMemo(() => (
    typeof window === "undefined" ? "" : buildAmazonRedirectUri()
  ), []);

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
      wooConsumerKey,
      wooConsumerSecret,
    }: {
      platform: StoreMarketplace;
      url: string;
      shopifyClientId?: string;
      shopifyClientSecret?: string;
      wooConsumerKey?: string;
      wooConsumerSecret?: string;
    }) => connectStoreMarketplace(platform, {
      storeUrl: url,
      clientId: shopifyClientId,
      clientSecret: shopifyClientSecret,
      consumerKey: wooConsumerKey,
      consumerSecret: wooConsumerSecret,
    }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      void queryClient.invalidateQueries({ queryKey: ["shopify-connection-status"] });
      void queryClient.invalidateQueries({ queryKey: ["shopify-status"] });
      setDialogTarget(null);
      setStoreUrl("");
      setClientId("");
      setClientSecret("");
      setConsumerKey("");
      setConsumerSecret("");
      const message = typeof result === "object" && result && "message" in result && typeof result.message === "string"
        ? result.message
        : "Your marketplace connection is ready.";
      toast({ title: "Store connected", description: message });
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

  const woocommerceSyncMutation = useMutation({
    mutationFn: syncWooCommerceProducts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      const skippedNote = result.skipped > 0 ? ` ${result.skipped} already imported.` : "";
      const updatedNote = result.updated > 0 ? ` ${result.updated} refreshed from WooCommerce.` : "";
      toast({
        title: "WooCommerce products imported",
        description: `Imported ${result.imported} of ${result.total} products.${updatedNote}${skippedNote}`,
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
        description: error instanceof Error ? error.message : "Could not import WooCommerce products.",
        variant: "destructive",
      });
    },
  });

  const connectAmazonMutation = useMutation({
    mutationFn: connectAmazonMarketplace,
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      setDialogTarget(null);
      toast({
        title: "Amazon credentials saved",
        description: result.message ?? "Authorize your seller account to finish connecting.",
      });
      try {
        await startAmazonConnect();
      } catch (error) {
        toast({
          title: "Authorize your seller account",
          description: error instanceof Error ? error.message : "Open Marketplaces and click Connect with Amazon again to authorize.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Amazon connection failed",
        description: error instanceof Error ? error.message : "Could not save Amazon credentials.",
        variant: "destructive",
      });
    },
    onSettled: () => setPendingAction(null),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("amazon") !== "connected") return;
    void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
    toast({ title: "Amazon connected", description: "Your seller account is linked to this workspace." });
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient, toast]);

  async function handleAmazonConnect() {
    if (data?.amazon.configured && !data.amazon.connected) {
      setPendingAction("amazon");
      try {
        await startAmazonConnect();
      } catch (error) {
        toast({
          title: "Amazon authorization failed",
          description: error instanceof Error ? error.message : "Could not start Amazon authorization.",
          variant: "destructive",
        });
      } finally {
        setPendingAction(null);
      }
      return;
    }

    setAmazonApplicationId("");
    setAmazonClientId("");
    setAmazonClientSecret("");
    setAmazonAwsAccessKeyId("");
    setAmazonAwsSecretAccessKey("");
    setAmazonAwsRoleArn("");
    setAmazonDefaultMarketplace(data?.amazon.defaultMarketplace ?? "US");
    setAmazonSandbox(data?.amazon.sandbox ?? true);
    setDialogTarget("amazon");
  }

  function submitAmazonConnection() {
    if (!amazonApplicationId.trim() || !amazonClientId.trim() || !amazonClientSecret.trim()) {
      toast({
        title: "Amazon credentials required",
        description: "Enter your Application ID, LWA Client ID, and Client secret.",
        variant: "destructive",
      });
      return;
    }

    setPendingAction("amazon");
    connectAmazonMutation.mutate({
      applicationId: amazonApplicationId.trim(),
      clientId: amazonClientId.trim(),
      clientSecret: amazonClientSecret.trim(),
      awsAccessKeyId: amazonAwsAccessKeyId.trim() || undefined,
      awsSecretAccessKey: amazonAwsSecretAccessKey.trim() || undefined,
      awsRoleArn: amazonAwsRoleArn.trim() || undefined,
      defaultMarketplace: amazonDefaultMarketplace,
      sandbox: amazonSandbox,
    });
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
    setConsumerKey("");
    setConsumerSecret("");
    setDialogTarget(platform);
  }

  function submitStoreConnection() {
    if (!dialogTarget || dialogTarget === "amazon") return;
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
    if (dialogTarget === "woocommerce") {
      if (!consumerKey.trim() || !consumerSecret.trim()) {
        toast({
          title: "API credentials required",
          description: "Enter your WooCommerce consumer key and consumer secret from WordPress → WooCommerce → Settings → Advanced → REST API.",
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
      wooConsumerKey: dialogTarget === "woocommerce" ? consumerKey.trim() : undefined,
      wooConsumerSecret: dialogTarget === "woocommerce" ? consumerSecret.trim() : undefined,
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
  const amazonConfigured = Boolean(data?.amazon.configured);
  const amazonAwaitingSellerAuth = amazonConfigured && !amazonConnected;
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
          detail={
            amazonConnected
              ? [
                  data?.amazon.sellerId ?? "Seller account linked",
                  data?.amazon.publishReady
                    ? "Direct publish enabled"
                    : "Add AWS IAM keys to publish listings",
                ].filter(Boolean).join(" · ")
              : amazonAwaitingSellerAuth
                ? "SP-API credentials saved · authorize your seller account to finish"
                : null
          }
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
          detail={
            woocommerceConnected
              ? [
                  data?.woocommerce.storeUrl,
                  data?.woocommerce.publishReady ? "REST API connected" : "Add API credentials to connect",
                ].filter(Boolean).join(" · ")
              : null
          }
          loading={pendingAction === "woocommerce"}
          importLoading={woocommerceSyncMutation.isPending}
          onConnect={() => openStoreDialog("woocommerce")}
          onDisconnect={() => void handleStoreDisconnect("woocommerce")}
          onImport={
            woocommerceConnected && data?.woocommerce.publishReady
              ? () => woocommerceSyncMutation.mutate()
              : undefined
          }
        />
      </div>

      <Dialog open={dialogTarget != null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Connect with {dialogTarget === "amazon" ? "Amazon" : dialogTarget === "shopify" ? "Shopify" : "WooCommerce"}
            </DialogTitle>
            <DialogDescription>
              {dialogTarget === "amazon"
                ? "Enter your Amazon SP-API app credentials from Seller Central → Apps & Services → Develop Apps. Add the redirect URI below to your LWA app before authorizing. AWS keys are optional now — add them only if you want to publish listings from SellerLens."
                : dialogTarget === "shopify"
                  ? "Enter your Shopify store URL and Admin API credentials from the Dev Dashboard (Settings → Client ID & secret). Required API scopes: read_products, write_products, read_publications, write_publications."
                  : "Enter your WooCommerce store URL and REST API credentials from WordPress → WooCommerce → Settings → Advanced → REST API. Create a key with Read/Write permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dialogTarget === "amazon" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="amazon-redirect-uri" className="text-xs text-slate-600">
                    OAuth redirect URI
                  </Label>
                  <Input
                    id="amazon-redirect-uri"
                    value={amazonRedirectUri}
                    readOnly
                    className="h-9 text-[10px] font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-application-id" className="text-xs text-slate-600">
                    Application ID
                  </Label>
                  <Input
                    id="amazon-application-id"
                    value={amazonApplicationId}
                    onChange={(e) => setAmazonApplicationId(e.target.value)}
                    placeholder="amzn1.sp.solution...."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-id" className="text-xs text-slate-600">
                    LWA Client ID
                  </Label>
                  <Input
                    id="amazon-client-id"
                    value={amazonClientId}
                    onChange={(e) => setAmazonClientId(e.target.value)}
                    placeholder="amzn1.application-oa2-client...."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-client-secret" className="text-xs text-slate-600">
                    LWA Client secret
                  </Label>
                  <Input
                    id="amazon-client-secret"
                    type="password"
                    value={amazonClientSecret}
                    onChange={(e) => setAmazonClientSecret(e.target.value)}
                    placeholder="amzn1.oa2-cs.v1...."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  Optional — only needed if you want to publish listings to Amazon. You can connect your seller account now and add AWS IAM keys later.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="amazon-aws-access-key" className="text-xs text-slate-600">
                    AWS Access Key ID <span className="text-slate-400">(optional)</span>
                  </Label>
                  <Input
                    id="amazon-aws-access-key"
                    value={amazonAwsAccessKeyId}
                    onChange={(e) => setAmazonAwsAccessKeyId(e.target.value)}
                    placeholder="AKIA..."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-aws-secret-key" className="text-xs text-slate-600">
                    AWS Secret Access Key <span className="text-slate-400">(optional)</span>
                  </Label>
                  <Input
                    id="amazon-aws-secret-key"
                    type="password"
                    value={amazonAwsSecretAccessKey}
                    onChange={(e) => setAmazonAwsSecretAccessKey(e.target.value)}
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-aws-role-arn" className="text-xs text-slate-600">
                    AWS Role ARN (optional)
                  </Label>
                  <Input
                    id="amazon-aws-role-arn"
                    value={amazonAwsRoleArn}
                    onChange={(e) => setAmazonAwsRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::..."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-marketplace" className="text-xs text-slate-600">
                    Default marketplace
                  </Label>
                  <select
                    id="amazon-marketplace"
                    value={amazonDefaultMarketplace}
                    onChange={(e) => setAmazonDefaultMarketplace(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    {AMAZON_MARKETPLACES.map((marketplace) => (
                      <option key={marketplace.id} value={marketplace.id}>
                        {marketplace.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={amazonSandbox}
                    onChange={(e) => setAmazonSandbox(e.target.checked)}
                  />
                  Use Amazon SP-API sandbox
                </label>
              </>
            ) : (
              <>
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
            {dialogTarget === "woocommerce" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="consumer-key" className="text-xs text-slate-600">
                    Consumer key
                  </Label>
                  <Input
                    id="consumer-key"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    placeholder="ck_..."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consumer-secret" className="text-xs text-slate-600">
                    Consumer secret
                  </Label>
                  <Input
                    id="consumer-secret"
                    type="password"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder="cs_..."
                    className="h-9 text-xs font-mono"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => setDialogTarget(null)}
              disabled={connectStoreMutation.isPending || connectAmazonMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn("h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white")}
              onClick={dialogTarget === "amazon" ? submitAmazonConnection : submitStoreConnection}
              disabled={connectStoreMutation.isPending || connectAmazonMutation.isPending}
            >
              {(connectStoreMutation.isPending || connectAmazonMutation.isPending) ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Connecting…
                </>
              ) : (
                dialogTarget === "amazon" ? "Save & authorize" : "Connect store"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
