import { useMemo } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { GeneratedContent } from "@workspace/api-client-react";
import type { ReferenceIntelligenceRow, SellerProductDetail } from "@/lib/reference-research";
import { ProductListingPreview } from "@/components/product-listing-preview";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PublicListingPreviewResponse = {
  productName: string;
  brandName: string | null;
  category: string | null;
  generatedContent: GeneratedContent;
  imageUrls: string[];
  imageRecords: Array<{ type?: string; currentUrl?: string }>;
  generatedImages: unknown;
  referenceIntelligence?: ReferenceIntelligenceRow[];
  productDetails?: SellerProductDetail[];
};

export default function PublicListingPreviewPage({ auditId }: { auditId: number }) {
  const search = useSearch();
  const token = useMemo(() => new URLSearchParams(search).get("token")?.trim() ?? "", [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-listing-preview", auditId, token],
    queryFn: async () => {
      const qs = new URLSearchParams({ token });
      const res = await fetch(
        `${basePath}/api/public/listing-preview/${auditId}?${qs.toString()}`,
      );
      if (!res.ok) throw new Error("Preview not available");
      return res.json() as Promise<PublicListingPreviewResponse>;
    },
    enabled: Number.isFinite(auditId) && auditId > 0 && token.length > 0,
    retry: false,
  });

  const auditLike = data
    ? {
        productName: data.productName,
        brandName: data.brandName,
        category: data.category,
        generatedContent: data.generatedContent,
        imageUrls: data.imageUrls,
        imageRecords: data.imageRecords,
        generatedImages: data.generatedImages,
        title: data.generatedContent.title,
        bulletPoints: data.generatedContent.bulletPoints,
      }
    : null;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />
      <div className="flex-1 w-full min-w-0 px-4 py-8 sm:py-10 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Listing preview</p>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {data?.productName ?? "Amazon-style listing preview"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Shared preview — no sign-in required. Content reflects the listing at share time.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            SellerLens home
          </Link>
        </div>

        {!token && (
          <p className="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            This preview link is missing its access token. Ask the sender to copy the link again from Listing preview.
          </p>
        )}

        {token && isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" aria-label="Loading preview" />
          </div>
        )}

        {token && !isLoading && (isError || !auditLike) && (
          <p className="text-sm text-slate-600 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            This preview is unavailable. The link may be invalid or the listing was removed.
          </p>
        )}

        {auditLike && (
          <ProductListingPreview
            auditId={auditId}
            audit={auditLike}
            generatedContent={data!.generatedContent}
            productName={data!.productName}
            brandName={data!.brandName}
            category={data!.category}
            edgeToEdge
            publicView
            generatedOnly
            referenceIntelligence={data!.referenceIntelligence ?? null}
            productDetails={data!.productDetails ?? null}
          />
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
