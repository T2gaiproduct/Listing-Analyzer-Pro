import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FetchedListing } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { displayListingDescription } from "@/lib/listing-display-sanitize";
import { Button } from "@/components/ui/button";

type PreviewTab = "content" | "attributes";

export function BuildBrandFetchedListingPreview({
  listing,
  className,
}: {
  listing: FetchedListing;
  className?: string;
}) {
  const [tab, setTab] = useState<PreviewTab>("content");
  const images = listing.imageUrls?.filter(Boolean) ?? [];
  const [activeImage, setActiveImage] = useState(0);
  const bullets = listing.bulletPoints?.filter(Boolean) ?? [];
  const attributes = listing.attributes?.filter((r) => r.attribute?.trim() && r.value?.trim()) ?? [];
  const descriptionText =
    displayListingDescription(listing.description) ??
    (bullets.length > 0 ? bullets.join("\n\n") : null);

  const mainImage = images[activeImage] ?? images[0];

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:gap-6", className)}>
      <nav className="flex lg:w-36 lg:flex-col gap-1 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 hidden lg:block">
          On this page
        </p>
        {(["content", "attributes"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              tab === id
                ? "bg-orange-100 text-orange-800"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {id === "content" ? "Content" : "Attributes"}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 space-y-4">
        {tab === "content" ? (
          <>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <div className="relative aspect-square max-h-[320px] w-full overflow-hidden rounded-xl border border-border bg-muted">
                  {mainImage ? (
                    <img src={mainImage} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No images
                    </div>
                  )}
                  {images.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-90"
                        onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-90"
                        onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        className={cn(
                          "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-muted",
                          idx === activeImage ? "border-orange-500" : "border-transparent",
                        )}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <section className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Product title
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-snug">{listing.title}</p>
                </section>
                <section className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {descriptionText || "No description provided."}
                  </p>
                </section>
                <section className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Bullet points
                  </p>
                  {bullets.length ? (
                    <ul className="space-y-2 text-sm text-foreground list-disc pl-4 marker:text-orange-500">
                      {bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No bullet points found.</p>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : (
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Product attributes
            </p>
            {attributes.length ? (
              <dl className="divide-y divide-border">
                {attributes.map((row) => (
                  <div key={`${row.attribute}-${row.value}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-1 py-2.5 text-sm">
                    <dt className="font-medium text-foreground">{row.attribute}</dt>
                    <dd className="text-muted-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No attributes were extracted from this link.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
