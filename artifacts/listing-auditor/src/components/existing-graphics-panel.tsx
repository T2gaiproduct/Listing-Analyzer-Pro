import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type GraphicsImageRecord = {
  id: string;
  type?: string;
  currentUrl?: string;
};

type AuditGraphicsLike = {
  imageUrls?: string[] | null;
  imageRecords?: GraphicsImageRecord[] | null;
  generatedImages?: {
    main?: string[];
    lifestyle?: string[];
    infographic?: string[];
  } | null;
};

function resolveImageUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function legacyGeneratedUrls(generatedImages: AuditGraphicsLike["generatedImages"]): string[] {
  if (!generatedImages) return [];
  const urls: string[] = [];
  for (const url of generatedImages.main ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generatedImages.lifestyle ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  for (const url of generatedImages.infographic ?? []) {
    if (url?.trim() && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

async function fetchGraphicsProjectForAudit(auditId: number) {
  const res = await fetch(`${basePath}/api/graphics/projects?auditId=${auditId}`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json() as { projects?: Array<{ auditId?: number | null; imageRecords?: GraphicsImageRecord[] }> };
  return data.projects?.find((project) => project.auditId === auditId) ?? null;
}

function GraphicsImageTile({
  url,
  label,
  className,
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("group relative aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50", className)}>
      <img src={resolveImageUrl(url)} alt={label ?? "Product graphic"} className="w-full h-full object-cover" />
      {label && (
        <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-medium px-1.5 py-0.5 truncate">
          {label}
        </span>
      )}
    </div>
  );
}

export function ExistingGraphicsPanel({
  auditId,
  audit,
  fallbackImageUrls,
}: {
  auditId: number;
  audit: AuditGraphicsLike | null | undefined;
  fallbackImageUrls?: string[] | null;
}) {
  const { data: graphicsProject } = useQuery({
    queryKey: ["graphics-project-for-audit", auditId],
    queryFn: () => fetchGraphicsProjectForAudit(auditId),
    staleTime: 10_000,
  });

  const uploadedImages = useMemo(() => {
    const urls: string[] = [];
    const add = (url: string | undefined | null) => {
      const trimmed = url?.trim();
      if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
    };
    for (const url of audit?.imageUrls ?? []) add(url);
    for (const url of fallbackImageUrls ?? []) add(url);
    return urls;
  }, [audit?.imageUrls, fallbackImageUrls]);

  const uploadedUrlSet = useMemo(() => new Set(uploadedImages), [uploadedImages]);

  const generatedGraphics = useMemo(() => {
    const items: Array<{ url: string; label: string }> = [];
    const seen = new Set<string>();

    const add = (url: string | undefined, label: string) => {
      const trimmed = url?.trim();
      if (!trimmed || seen.has(trimmed) || uploadedUrlSet.has(trimmed)) return;
      seen.add(trimmed);
      items.push({ url: trimmed, label });
    };

    for (const record of graphicsProject?.imageRecords ?? audit?.imageRecords ?? []) {
      const typeLabel = record.type === "lifestyle"
        ? "Lifestyle"
        : record.type === "feature"
          ? "Infographic"
          : record.type === "main"
            ? "Main"
            : "Graphic";
      add(record.currentUrl, typeLabel);
    }

    for (const url of legacyGeneratedUrls(audit?.generatedImages)) {
      add(url, "Generated");
    }

    return items;
  }, [audit?.generatedImages, audit?.imageRecords, graphicsProject?.imageRecords, uploadedUrlSet]);

  const hasContent = uploadedImages.length > 0 || generatedGraphics.length > 0;

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center gap-1.5 px-1">
        <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Existing Graphics
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold text-slate-700">Product images &amp; graphics</p>
        </div>
        <div className="px-4 py-4 space-y-4">
          {!hasContent ? (
            <p className="text-[11px] text-slate-500 text-center py-6">
              No images yet. Uploaded product photos and generated graphics will appear here.
            </p>
          ) : (
            <>
              {uploadedImages.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Product Images ({uploadedImages.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {uploadedImages.map((url) => (
                      <GraphicsImageTile key={`upload-${url}`} url={url} label="Product" />
                    ))}
                  </div>
                </div>
              )}

              {generatedGraphics.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Generated Graphics ({generatedGraphics.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {generatedGraphics.map((item) => (
                      <GraphicsImageTile key={`generated-${item.url}`} url={item.url} label={item.label} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
