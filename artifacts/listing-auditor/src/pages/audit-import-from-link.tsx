import { useState } from "react";
import { Link2, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_TAB_FIELD_CLASS } from "@/components/build-brand-upload-attributes-section";
import { useLocation, useSearch } from "wouter";
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
import { useToast } from "@/hooks/use-toast";
import { getGetAuditQueryKey } from "@workspace/api-client-react";
import {
  PROJECT_ORIGIN_AUDIT_LISTING,
  PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
} from "@/lib/audit-project-origin";
import { isImportFromLinkForAuditListings } from "@/lib/import-from-link-return";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AuditImportFromLinkPage() {
  const [, nav] = useLocation();
  const search = useSearch();
  const fromAuditListing = isImportFromLinkForAuditListings(search);
  const returnPath = fromAuditListing ? "/audit-listings" : "/audits/new";
  const returnLabel = fromAuditListing ? "Back to Audit Listing" : "Back to Build Your Brand";
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
          importAttributes: (listing.attributes ?? []).slice(0, 40),
          sourceListingUrl: sourceUrl.trim() || undefined,
          projectOrigin: fromAuditListing
            ? PROJECT_ORIGIN_AUDIT_LISTING
            : PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
          importMarketplace: fromAuditListing ? undefined : marketplace,
        } as Parameters<typeof createAuditDraft.mutateAsync>[0]["data"],
      });

      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(audit.id) });

      if (fromAuditListing) {
        toast({
          title: "Listing imported",
          description: "Continue with your audit on the listing details page.",
        });
        nav(`/audits/${audit.id}`);
      } else {
        toast({
          title: "Saved to Product Explorer",
          description: "Your imported listing is ready in Product Explorer.",
        });
        nav(`/products/${audit.id}?source=listing`);
      }
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
      <div className="mx-auto w-full max-w-[min(96rem,calc(100vw-2rem))] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-4">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => nav(returnPath)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {returnLabel}
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
              <Link2 className="h-5 w-5 text-orange-600" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Import from link</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {fromAuditListing
                  ? "Fetch a listing, preview it, then continue your audit"
                  : "Fetch a listing, preview it, then save to Product Explorer"}
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
                      {fromAuditListing ? "Auditing listing…" : "Fetching…"}
                    </>
                  ) : fromAuditListing ? (
                    "Audit listing"
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
              <Button type="button" variant="outline" onClick={() => nav(returnPath)}>
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
                ) : fromAuditListing ? (
                  "Continue to audit"
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
