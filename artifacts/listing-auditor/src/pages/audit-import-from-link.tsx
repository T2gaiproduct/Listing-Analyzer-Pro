import { useState } from "react";
import { Link2, Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import type { FetchedListing } from "@workspace/api-client-react";
import { useCreateAuditDraft, useFetchListing } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuildBrandFetchedListingPreview } from "@/components/build-brand-fetched-listing-preview";
import {
  IMPORT_LINK_MARKETPLACES,
  marketplaceMatchesUrl,
  type ImportLinkMarketplace,
} from "@/lib/import-link-marketplace";
import { parseListingFetchInput } from "@/lib/listing-input";
import { fetchJson } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { getGetAuditQueryKey } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AuditImportFromLinkPage() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchListing = useFetchListing();
  const createAuditDraft = useCreateAuditDraft();

  const [marketplace, setMarketplace] = useState<ImportLinkMarketplace>("amazon");
  const [url, setUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [listing, setListing] = useState<FetchedListing | null>(null);
  const [saving, setSaving] = useState(false);

  const marketplaceMeta = IMPORT_LINK_MARKETPLACES.find((m) => m.id === marketplace)!;

  function handleFetch() {
    const trimmed = url.trim();
    if (!trimmed || fetchListing.isPending) return;

    if (!marketplaceMatchesUrl(marketplace, trimmed)) {
      toast({
        title: "Link does not match marketplace",
        description: `Choose ${marketplaceMeta.label} or paste a matching product URL.`,
        variant: "destructive",
      });
      return;
    }

    let fetchPayload: { asin?: string; url?: string };
    try {
      fetchPayload = marketplace === "amazon"
        ? parseListingFetchInput(trimmed)
        : { url: trimmed.startsWith("http") ? trimmed : `https://${trimmed}` };
    } catch (err) {
      toast({
        title: "Invalid link",
        description: err instanceof Error ? err.message : "Enter a valid product URL.",
        variant: "destructive",
      });
      return;
    }

    fetchListing.mutate(
      { data: fetchPayload },
      {
        onSuccess: (data) => {
          setListing(data);
          setSourceUrl(trimmed);
        },
        onError: (err) => {
          setListing(null);
          toast({
            title: "Could not import listing",
            description: err instanceof Error ? err.message : "Check the link and try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  async function handleSaveToProductExplorer() {
    if (!listing || saving) return;
    setSaving(true);
    try {
      const audit = await createAuditDraft.mutateAsync({
        data: {
          productName: listing.productName,
          projectName: listing.productName,
          title: listing.title,
          bulletPoints: listing.bulletPoints ?? [],
          imageUrls: listing.imageUrls ?? [],
          targetKeywords: listing.targetKeywords ?? [],
          category: listing.category ?? undefined,
          asin: listing.asin || undefined,
          productDescription: listing.description ?? undefined,
        },
      });

      const productDetails = (listing.attributes ?? []).slice(0, 24);
      if (productDetails.length > 0 || sourceUrl.trim()) {
        await fetchJson(`${basePath}/api/audits/${audit.id}/reference-research`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slots: sourceUrl.trim() ? [{ url: sourceUrl.trim(), notes: marketplace }] : [],
            productDetails,
          }),
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(audit.id) });

      toast({
        title: "Saved to Product Explorer",
        description: "Your imported listing is ready in Product Explorer.",
      });
      nav(`/products/${audit.id}?source=listing`);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save to Product Explorer.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => nav("/audits/new")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
            <Link2 className="h-4 w-4 text-orange-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Import from link</h1>
            <p className="text-xs text-muted-foreground">Fetch a listing, preview it, then save to Product Explorer</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-4 rounded-xl border border-orange-100 bg-orange-50/30 p-4 sm:grid-cols-2 sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="import-marketplace">Marketplace</Label>
            <Select value={marketplace} onValueChange={(v) => setMarketplace(v as ImportLinkMarketplace)}>
              <SelectTrigger id="import-marketplace" className="border-orange-200 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_LINK_MARKETPLACES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="import-url">Product link</Label>
            <p className="text-xs text-muted-foreground">{marketplaceMeta.hint}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="import-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setListing(null);
                }}
                placeholder={marketplaceMeta.placeholder}
                className="border-orange-200 focus-visible:ring-orange-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFetch();
                }}
              />
              <Button
                type="button"
                className="shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                disabled={!url.trim() || fetchListing.isPending}
                onClick={handleFetch}
              >
                {fetchListing.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching…
                  </>
                ) : (
                  "Fetch listing"
                )}
              </Button>
            </div>
          </div>
        </div>

        {listing && (
          <>
            <BuildBrandFetchedListingPreview listing={listing} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => nav("/audits/new")}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                disabled={saving || createAuditDraft.isPending}
                onClick={() => void handleSaveToProductExplorer()}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save to Product Explorer"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
