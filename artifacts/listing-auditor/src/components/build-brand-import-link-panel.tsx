import { useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { useFetchListing } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseListingFetchInput } from "@/lib/listing-input";
import { useToast } from "@/hooks/use-toast";

export type ImportedListingDraft = {
  productName: string;
  category: string;
  productDescription: string;
  projectName: string;
  imageUrls: string[];
};

export function BuildBrandImportLinkPanel({
  onImported,
  onBack,
}: {
  onImported: (draft: ImportedListingDraft) => void;
  onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  const fetchListing = useFetchListing();

  function handleImport() {
    const trimmed = url.trim();
    if (!trimmed || fetchListing.isPending) return;

    let fetchPayload: { asin?: string; url?: string };
    try {
      fetchPayload = parseListingFetchInput(trimmed);
    } catch (err) {
      toast({
        title: "Invalid link",
        description: err instanceof Error ? err.message : "Enter a product URL or ASIN.",
        variant: "destructive",
      });
      return;
    }

    fetchListing.mutate(
      { data: fetchPayload },
      {
        onSuccess: (listing) => {
          const productName = listing.productName?.trim() || listing.title?.trim() || "Imported product";
          onImported({
            productName,
            projectName: productName,
            category: listing.category?.trim() || "General",
            productDescription: listing.title?.trim() || productName,
            imageUrls: listing.imageUrls ?? [],
          });
        },
        onError: (err) => {
          toast({
            title: "Could not import listing",
            description: err instanceof Error ? err.message : "Check the link and try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
          <Link2 className="h-5 w-5 text-orange-600" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Import from links</h2>
          <p className="text-xs text-muted-foreground">Paste a product URL or Amazon ASIN</p>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… or B0XXXXXXXX"
          className="border-orange-200 focus-visible:ring-orange-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleImport();
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          disabled={!url.trim() || fetchListing.isPending}
          onClick={() => handleImport()}
        >
          {fetchListing.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            "Continue"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
