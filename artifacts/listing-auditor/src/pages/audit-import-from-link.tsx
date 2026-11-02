import { useState } from "react";
import { Link2, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_TAB_FIELD_CLASS } from "@/components/build-brand-upload-attributes-section";
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
      <div className="mx-auto w-full max-w-[min(96rem,calc(100vw-2rem))] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-2 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 sm:px-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-[11px] font-semibold"
            onClick={() => nav("/audits/new")}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
              <Link2 className="h-4 w-4 text-orange-600" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground sm:text-base">Import from link</h1>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Fetch a listing, preview it, then save to Product Explorer
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-4">
          <div className="grid w-full gap-4 md:grid-cols-[minmax(0,16rem)_1fr] md:items-end lg:grid-cols-[minmax(0,18rem)_1fr]">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="import-marketplace" className="text-xs">
                Marketplace
              </Label>
              <Select value={marketplace} onValueChange={(v) => setMarketplace(v as ImportLinkMarketplace)}>
                <SelectTrigger
                  id="import-marketplace"
                  className={cn(UPLOAD_TAB_FIELD_CLASS, "h-11 sm:h-12 bg-card")}
                >
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
            <div className="space-y-1.5 min-w-0 md:col-span-1">
              <Label htmlFor="import-url" className="text-xs">
                Product link
              </Label>
              <p className="text-[11px] text-muted-foreground">{marketplaceMeta.hint}</p>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="import-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setListing(null);
                  }}
                  placeholder={marketplaceMeta.placeholder}
                  className={cn(UPLOAD_TAB_FIELD_CLASS, "h-11 sm:h-12 flex-1 text-sm")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFetch();
                  }}
                />
                <Button
                  type="button"
                  className="h-11 shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-white hover:from-orange-600 hover:to-amber-600 sm:h-12"
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
        </div>

        {listing && (
          <>
            <BuildBrandFetchedListingPreview listing={listing} />
            <div className="flex flex-wrap justify-end gap-2 pt-2">
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
