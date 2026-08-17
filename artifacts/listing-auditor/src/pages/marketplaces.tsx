import { useState, useEffect } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  connectAmazonSelfAuth,
  saveAmazonMarketplaceCredentials,
  testAmazonMarketplaceCredentials,
  syncShopifyProducts,
  syncWooCommerceProducts,
  syncAmazonProducts,
  type StoreMarketplace,
} from "@/lib/marketplace-connections";
import { AMAZON_MARKETPLACES } from "@/lib/amazon-export";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type DialogTarget = StoreMarketplace;

const CONNECT_CARDS: Array<{
  id: StoreMarketplace;
  marketplace: string;
  description: string;
  placeholder: string;
}> = [
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
  pending,
  detail,
  connectLabel,
  loading,
  onConnect,
  onDisconnect,
  onImport,
  importLoading,
  importDisabled,
  importDisabledReason,
  setupRequired,
  setupMessage,
  setupHref,
}: {
  marketplace: string;
  description: string;
  connected: boolean;
  pending?: boolean;
  detail?: string | null;
  connectLabel?: string;
  loading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onImport?: () => void;
  importLoading?: boolean;
  importDisabled?: boolean;
  importDisabledReason?: string;
  setupRequired?: boolean;
  setupMessage?: string;
  setupHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <MarketplaceLogo marketplace={marketplace} className="h-7 w-32" />
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Check className="w-3 h-3" />
            Connected
          </span>
        ) : pending ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            Pending
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>

      {detail ? (
        <p
          className={cn(
            "text-[11px] break-all rounded-lg border px-3 py-2",
            connected
              ? "text-muted-foreground bg-muted border-border"
              : "text-amber-900 bg-amber-50 border-amber-200",
          )}
        >
          {detail}
        </p>
      ) : null}

      {setupRequired && setupMessage && !connected ? (
        <p className="text-[11px] text-amber-800 leading-relaxed rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          {setupMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {connected ? (
          <>
            {(onImport || importDisabled) ? (
              importDisabled && importDisabledReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60"
                        disabled={loading || importLoading || importDisabled}
                        onClick={onImport}
                      >
                        {importLoading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Import products
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-xs">
                    {importDisabledReason}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={loading || importLoading || importDisabled}
                  onClick={onImport}
                >
                  {importLoading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Import products
                </Button>
              )
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
        ) : setupRequired && setupHref ? (
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
            className="h-8 text-xs bg-foreground hover:bg-foreground/90 text-background"
            disabled={loading}
            onClick={onConnect}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plug className="w-3.5 h-3.5 mr-1.5" />
            )}
            {connectLabel ?? `Connect with ${marketplace}`}
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
  const [pendingAction, setPendingAction] = useState<DialogTarget | "amazon" | null>(null);
  const [amazonSelfAuthOpen, setAmazonSelfAuthOpen] = useState(false);
  const [amazonCredentialsOpen, setAmazonCredentialsOpen] = useState(false);
  const [amazonSellerId, setAmazonSellerId] = useState("");
  const [amazonRefreshToken, setAmazonRefreshToken] = useState("");
  const [amazonApplicationId, setAmazonApplicationId] = useState("");
  const [amazonClientId, setAmazonClientId] = useState("");
  const [amazonClientSecret, setAmazonClientSecret] = useState("");
  const [amazonDefaultMarketplace, setAmazonDefaultMarketplace] = useState("US");
  const [amazonSandbox, setAmazonSandbox] = useState(true);
  const [amazonAwsAccessKeyId, setAmazonAwsAccessKeyId] = useState("");
  const [amazonAwsSecretAccessKey, setAmazonAwsSecretAccessKey] = useState("");
  const [amazonAwsRoleArn, setAmazonAwsRoleArn] = useState("");

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

  const amazonSyncMutation = useMutation({
    mutationFn: syncAmazonProducts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      const skippedNote = result.skipped > 0 ? ` ${result.skipped} already imported.` : "";
      const updatedNote = result.updated > 0 ? ` ${result.updated} refreshed from Amazon.` : "";
      const ordersNote = (result.ordersImported ?? 0) > 0 || (result.ordersUpdated ?? 0) > 0
        ? ` Synced ${(result.ordersImported ?? 0) + (result.ordersUpdated ?? 0)} Amazon order${(result.ordersImported ?? 0) + (result.ordersUpdated ?? 0) === 1 ? "" : "s"}.`
        : result.ordersSyncQueued
          ? " Syncing Amazon orders in the background."
          : "";
      toast({
        title: "Amazon listings imported",
        description: `Imported ${result.imported} of ${result.total} listings from Seller Central.${updatedNote}${skippedNote}${ordersNote}`,
      });
      if (result.errors.length > 0) {
        toast({
          title: "Some listings could not be imported",
          description: result.errors.slice(0, 2).map((e) => e.error).join(" "),
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import Amazon listings.",
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

  function handleAmazonConnect() {
    if (!data?.amazon.workspaceCredentialsSaved) {
      openAmazonCredentialsDialog();
      return;
    }
    setAmazonSelfAuthOpen(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("amazon") !== "connected") return;
    void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
    toast({ title: "Amazon connected", description: "Your seller account is linked to this workspace." });
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient, toast]);

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

  function openAmazonCredentialsDialog() {
    setAmazonApplicationId(data?.amazon.applicationId ?? "");
    setAmazonClientId(data?.amazon.clientId ?? "");
    setAmazonClientSecret("");
    setAmazonDefaultMarketplace(data?.amazon.defaultMarketplace ?? "US");
    setAmazonSandbox(data?.amazon.sandbox ?? true);
    setAmazonAwsAccessKeyId("");
    setAmazonAwsSecretAccessKey("");
    setAmazonAwsRoleArn(data?.amazon.awsRoleArn ?? "");
    setAmazonCredentialsOpen(true);
  }

  const saveAmazonCredentialsMutation = useMutation({
    mutationFn: () =>
      saveAmazonMarketplaceCredentials({
        applicationId: amazonApplicationId.trim() || undefined,
        clientId: amazonClientId.trim(),
        clientSecret: amazonClientSecret.trim() || undefined,
        defaultMarketplace: amazonDefaultMarketplace,
        sandbox: amazonSandbox,
        awsAccessKeyId: amazonAwsAccessKeyId.trim() || undefined,
        awsSecretAccessKey: amazonAwsSecretAccessKey.trim() || undefined,
        awsRoleArn: amazonAwsRoleArn.trim() || undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      setAmazonCredentialsOpen(false);
      toast({
        title: "Amazon SP-API credentials saved",
        description: result.message ?? "You can now connect your seller account.",
      });
    },
    onError: (error) => {
      toast({
        title: "Could not save credentials",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
    },
  });

  const testAmazonCredentialsMutation = useMutation({
    mutationFn: () =>
      testAmazonMarketplaceCredentials({
        applicationId: amazonApplicationId.trim() || undefined,
        clientId: amazonClientId.trim() || undefined,
        clientSecret: amazonClientSecret.trim() || undefined,
        defaultMarketplace: amazonDefaultMarketplace,
        sandbox: amazonSandbox,
      }),
    onSuccess: (result) => {
      toast({
        title: result.ok ? "LWA credentials valid" : "Connection test failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection test failed",
        description: error instanceof Error ? error.message : "Test failed.",
        variant: "destructive",
      });
    },
  });

  function submitAmazonCredentials() {
    if (!amazonClientId.trim()) {
      toast({
        title: "LWA Client ID required",
        description: "Enter the Client identifier from Develop Apps → LWA credentials.",
        variant: "destructive",
      });
      return;
    }
    if (!amazonClientSecret.trim() && !data?.amazon.hasClientSecret) {
      toast({
        title: "LWA Client Secret required",
        description: "Enter the Client secret from Develop Apps → LWA credentials.",
        variant: "destructive",
      });
      return;
    }
    saveAmazonCredentialsMutation.mutate();
  }

  function handleAmazonImport() {
    if (!data?.amazon.canSignRequests) {
      toast({
        title: "AWS credentials required",
        description:
          "Add AWS Access Key and Secret in Amazon SP-API credentials (Edit SP-API credentials), then try Import products again.",
        variant: "destructive",
      });
      return;
    }
    amazonSyncMutation.mutate();
  }

  async function submitAmazonSelfAuth() {
    const sellerId = amazonSellerId.trim();
    const refreshToken = amazonRefreshToken.trim();
    if (!sellerId || !refreshToken) {
      toast({
        title: "Seller ID and token required",
        description: "Copy both from Seller Central → Develop Apps → Authorize (self-authorization).",
        variant: "destructive",
      });
      return;
    }
    setPendingAction("amazon");
    try {
      const result = await connectAmazonSelfAuth({ sellerId, refreshToken });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-connections"] });
      setAmazonSelfAuthOpen(false);
      setAmazonSellerId("");
      setAmazonRefreshToken("");
      toast({
        title: "Amazon connected",
        description: `Seller ${result.sellerId} linked.`,
      });
    } catch (error) {
      toast({
        title: "Could not link Amazon",
        description: error instanceof Error ? error.message : "Self-authorization failed.",
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
      <div className="space-y-4 animate-in fade-in w-full min-w-0">
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
        <Store className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <h2 className="text-base font-semibold text-foreground">Select a workspace</h2>
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          Marketplace connections are scoped to a workspace. Choose one in the top bar, or create a workspace from {WORKSPACES_HUB_LABEL}.
        </p>
        <Button asChild size="sm" className="mt-5 bg-orange-500 hover:bg-orange-600 text-xs h-8">
          <Link href="/workspaces">{WORKSPACES_HUB_LABEL}</Link>
        </Button>
      </div>
    );
  }

  const amazonConnected = Boolean(data?.amazon.connected || data?.amazon.sellerId);
  const amazonWorkspaceCredentialsSaved = Boolean(data?.amazon.workspaceCredentialsSaved);
  const amazonCanSignRequests = Boolean(data?.amazon.canSignRequests);
  const shopifyConnected = Boolean(data?.shopify.connected);
  const woocommerceConnected = Boolean(data?.woocommerce.connected);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Marketplaces</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Marketplaces</h1>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Connect the sales channels you use in this workspace. Once connected, you can publish and export listings to Amazon, Shopify, and WooCommerce.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <ConnectCard
            marketplace="Amazon"
            description="Step 1: Add Develop Apps credentials. Step 2: Connect with Amazon using your refresh token. Then import your catalog."
            connected={amazonConnected}
            pending={false}
            connectLabel={
              !amazonWorkspaceCredentialsSaved
                ? "Add SP-API credentials"
                : !amazonConnected
                  ? "Connect with Amazon"
                  : undefined
            }
            setupRequired={!amazonWorkspaceCredentialsSaved}
            setupMessage="Add LWA Client ID, Client Secret, and AWS keys from Seller Central → Develop Apps."
            detail={
              amazonConnected
                ? [
                    data?.amazon.sellerId ? `Seller ${data.amazon.sellerId}` : "Seller account linked",
                    data?.amazon.publishReady
                      ? "Import, publish & sync enabled"
                      : data?.amazon.canSignRequests
                        ? "Ready to import after seller connect"
                        : "Add AWS keys in credentials to import & publish",
                  ].filter(Boolean).join(" · ")
                : amazonWorkspaceCredentialsSaved && !amazonConnected
                  ? "Credentials saved — click Connect with Amazon and paste Seller ID + refresh token from Develop Apps"
                  : null
            }
            loading={pendingAction === "amazon"}
            importLoading={amazonSyncMutation.isPending}
            onConnect={handleAmazonConnect}
            onDisconnect={handleAmazonDisconnect}
            onImport={amazonConnected ? handleAmazonImport : undefined}
            importDisabled={amazonConnected && !amazonCanSignRequests}
            importDisabledReason="Add AWS Access Key and Secret in Amazon SP-API credentials, then click Import products."
          />
          {amazonWorkspaceCredentialsSaved ? (
            <p className="text-[11px] text-muted-foreground px-1">
              <button
                type="button"
                className="hover:text-foreground underline"
                onClick={openAmazonCredentialsDialog}
              >
                Edit credentials
              </button>
            </p>
          ) : null}
        </div>
        <ConnectCard
          marketplace="Shopify"
          description={CONNECT_CARDS[0]!.description}
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
          description={CONNECT_CARDS[1]!.description}
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
              Connect with {dialogTarget === "shopify" ? "Shopify" : "WooCommerce"}
            </DialogTitle>
            <DialogDescription>
              {dialogTarget === "shopify"
                ? "Enter your Shopify store URL and Admin API credentials from the Dev Dashboard (Settings → Client ID & secret). Required API scopes: read_products, write_products, read_publications, write_publications."
                : "Enter your WooCommerce store URL and REST API credentials from WordPress → WooCommerce → Settings → Advanced → REST API. Create a key with Read/Write permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="store-url" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="client-id" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="client-secret" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="consumer-key" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="consumer-secret" className="text-xs text-muted-foreground">
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
              className={cn("h-9 text-xs bg-foreground hover:bg-foreground/90 text-background")}
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

      <Dialog open={amazonCredentialsOpen} onOpenChange={setAmazonCredentialsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Amazon SP-API credentials</DialogTitle>
            <DialogDescription>
              LWA credentials and AWS keys from Seller Central → Apps &amp; Services → Develop Apps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Application ID (optional)</Label>
              <Input
                value={amazonApplicationId}
                onChange={(e) => setAmazonApplicationId(e.target.value)}
                placeholder="amzn1.sp.solution...."
                className="h-9 text-xs font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">LWA Client ID</Label>
              <Input
                value={amazonClientId}
                onChange={(e) => setAmazonClientId(e.target.value)}
                placeholder="amzn1.application-oa2-client...."
                className="h-9 text-xs font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">LWA Client Secret</Label>
              <Input
                type="password"
                value={amazonClientSecret}
                onChange={(e) => setAmazonClientSecret(e.target.value)}
                placeholder={
                  data?.amazon.hasClientSecret ? "Saved — re-enter to replace" : "amzn1.oa2-cs.v1...."
                }
                className="h-9 text-xs font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Default marketplace</Label>
              <select
                value={amazonDefaultMarketplace}
                onChange={(e) => setAmazonDefaultMarketplace(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs"
              >
                {AMAZON_MARKETPLACES.map((marketplace) => (
                  <option key={marketplace.id} value={marketplace.id}>
                    {marketplace.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Match your Seller Central account (e.g. India for amazon.in sellers).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={amazonSandbox}
                onChange={(e) => setAmazonSandbox(e.target.checked)}
              />
              Use SP-API sandbox
            </label>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 space-y-3">
              <p className="text-[11px] font-medium text-foreground">AWS IAM (import, publish &amp; sync)</p>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">AWS Access Key ID</Label>
                <Input
                  value={amazonAwsAccessKeyId}
                  onChange={(e) => setAmazonAwsAccessKeyId(e.target.value)}
                  placeholder={data?.amazon.hasAwsAccessKey ? "Saved — re-enter to replace" : "AKIA..."}
                  className="h-9 text-xs font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">AWS Secret Access Key</Label>
                <Input
                  type="password"
                  value={amazonAwsSecretAccessKey}
                  onChange={(e) => setAmazonAwsSecretAccessKey(e.target.value)}
                  placeholder={data?.amazon.hasAwsSecretKey ? "Saved — re-enter to replace" : "40-character secret"}
                  className="h-9 text-xs font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">AWS Role ARN (optional)</Label>
                <Input
                  value={amazonAwsRoleArn}
                  onChange={(e) => setAmazonAwsRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::...:role/..."
                  className="h-9 text-xs font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              disabled={testAmazonCredentialsMutation.isPending || saveAmazonCredentialsMutation.isPending}
              onClick={() => testAmazonCredentialsMutation.mutate()}
            >
              {testAmazonCredentialsMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : null}
              Test LWA
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => setAmazonCredentialsOpen(false)}
                disabled={saveAmazonCredentialsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 text-xs bg-foreground hover:bg-foreground/90 text-background"
                onClick={submitAmazonCredentials}
                disabled={saveAmazonCredentialsMutation.isPending}
              >
                {saveAmazonCredentialsMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save credentials"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={amazonSelfAuthOpen} onOpenChange={setAmazonSelfAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect with Amazon</DialogTitle>
            <DialogDescription>
              In Seller Central → Develop Apps → your app → Authorize (self-authorization), copy the
              Selling Partner ID and LWA refresh token (starts with Atzr|).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="amazon-seller-id" className="text-xs text-muted-foreground">
                Selling Partner ID
              </Label>
              <Input
                id="amazon-seller-id"
                value={amazonSellerId}
                onChange={(e) => setAmazonSellerId(e.target.value)}
                placeholder="A1PA6795UKMFR9"
                className="h-9 text-xs font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amazon-refresh-token" className="text-xs text-muted-foreground">
                LWA refresh token
              </Label>
              <Input
                id="amazon-refresh-token"
                type="password"
                value={amazonRefreshToken}
                onChange={(e) => setAmazonRefreshToken(e.target.value)}
                placeholder="Atzr|…"
                className="h-9 text-xs font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => setAmazonSelfAuthOpen(false)}
              disabled={pendingAction === "amazon"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-9 text-xs bg-foreground hover:bg-foreground/90 text-background"
              onClick={() => void submitAmazonSelfAuth()}
              disabled={pendingAction === "amazon"}
            >
              {pendingAction === "amazon" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Linking…
                </>
              ) : (
                "Connect with Amazon"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
