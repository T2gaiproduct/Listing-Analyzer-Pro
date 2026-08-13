import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plug, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchShopifyStatus } from "@/lib/shopify-publish";
import { fetchWooCommerceStatus } from "@/lib/woocommerce-publish";
import { fetchAmazonStatus } from "@/lib/amazon-publish";
import { MarketplaceLogo } from "@/components/marketplace-logos";

function ConnectionRow({
  name,
  marketplace,
  connected,
  detail,
}: {
  name: string;
  marketplace: "shopify" | "woocommerce" | "amazon";
  connected: boolean;
  detail?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <MarketplaceLogo marketplace={marketplace} className="w-8 h-8 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          {detail ? (
            <p className="text-xs text-slate-500 truncate">{detail}</p>
          ) : (
            <p className="text-xs text-slate-500">Not connected in this workspace</p>
          )}
        </div>
      </div>
      <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
        {connected ? "Connected" : "Not connected"}
      </Badge>
    </div>
  );
}

export function SettingsIntegrationsCard() {
  const { data: shopify } = useQuery({ queryKey: ["shopify-status"], queryFn: fetchShopifyStatus });
  const { data: woo } = useQuery({ queryKey: ["woocommerce-status"], queryFn: fetchWooCommerceStatus });
  const { data: amazon } = useQuery({ queryKey: ["amazon-status"], queryFn: fetchAmazonStatus });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="w-4 h-4 text-orange-500" />
          Integrations
        </CardTitle>
        <CardDescription>
          Marketplace connections for your active workspace. Manage credentials and sync on the Marketplaces page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConnectionRow
          name="Shopify"
          marketplace="shopify"
          connected={Boolean(shopify?.connected)}
          detail={shopify?.storeUrl}
        />
        <ConnectionRow
          name="WooCommerce"
          marketplace="woocommerce"
          connected={Boolean(woo?.connected)}
          detail={woo?.storeUrl}
        />
        <ConnectionRow
          name="Amazon"
          marketplace="amazon"
          connected={Boolean(amazon?.connected || amazon?.sellerId)}
          detail={amazon?.sellerId ? `Seller ${amazon.sellerId}` : null}
        />
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href="/marketplaces">
            <Store className="w-4 h-4 mr-2" />
            Manage marketplaces
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
