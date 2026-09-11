import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchShopifyCollections, publishAuditToShopify } from "@/lib/shopify-publish";

export function ShopifyPublishCollectionsDialog({
  auditId,
  open,
  onOpenChange,
  publishMode = "live",
  onPublished,
  onPublishingChange,
}: {
  auditId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishMode?: "draft" | "live";
  onPublishingChange?: (publishing: boolean) => void;
  onPublished?: (result: {
    message: string;
    warning?: string;
    listingUrl?: string;
    collectionsAssigned?: Array<{ id: string; title?: string }>;
  }) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["shopify-collections"],
    queryFn: fetchShopifyCollections,
    enabled: open,
    staleTime: 60_000,
  });

  const collections = data?.collections ?? [];

  useEffect(() => {
    if (!open) {
      setError(null);
      setPublishing(false);
    }
  }, [open]);

  const selectedGids = useMemo(
    () => collections.filter((c) => selected[c.id]).map((c) => c.id),
    [collections, selected],
  );

  async function handlePublish() {
    setPublishing(true);
    onPublishingChange?.(true);
    setError(null);
    const titleMap: Record<string, string> = {};
    for (const c of collections) {
      if (selected[c.id]) titleMap[c.id] = c.title;
    }
    try {
      const result = await publishAuditToShopify({
        auditId,
        publishMode,
        shopifyCollectionGids: selectedGids,
        shopifyCollectionTitles: titleMap,
      });
      onOpenChange(false);
      onPublished?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
      onPublishingChange?.(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to Shopify</DialogTitle>
          <DialogDescription>
            Choose custom collections for this product (Shopify only). Product type still comes from your listing category field.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-2 py-1">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading collections…
            </div>
          )}
          {isError && (
            <div className="text-sm text-red-600 space-y-2">
              <p>Could not load collections from your store.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          )}
          {!isLoading && !isError && collections.length === 0 && (
            <p className="text-sm text-slate-500 py-2">
              No manual collections found in Shopify. Create custom collections in Shopify Admin, then try again.
            </p>
          )}
          {!isLoading && collections.map((collection) => (
            <label
              key={collection.id}
              className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
            >
              <Checkbox
                checked={Boolean(selected[collection.id])}
                onCheckedChange={(checked) => {
                  setSelected((prev) => ({
                    ...prev,
                    [collection.id]: checked === true,
                  }));
                }}
                className="mt-0.5"
              />
              <span className="text-sm font-medium text-slate-800">{collection.title}</span>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handlePublish()} disabled={publishing || isLoading}>
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing…
              </>
            ) : publishMode === "live" ? "Publish live" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
