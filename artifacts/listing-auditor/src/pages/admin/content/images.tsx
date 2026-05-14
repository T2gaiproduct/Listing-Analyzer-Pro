import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ImageIcon } from "lucide-react";

interface ImageItem {
  id: number; userId: string; productName: string;
  generatedImages: { main: string[]; infographic: string[]; lifestyle: string[] } | null;
  imageRecords: Array<{ id: string; type: string; currentUrl: string; versions: Array<{ url: string }> }> | null;
  createdAt: string;
}

function fetchImages(): Promise<{ images: ImageItem[] }> {
  return fetch("/api/admin/images").then((r) => r.json());
}

export default function AdminContentImages() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-images"], queryFn: fetchImages });
  const items = data?.images ?? [];

  const collectUrls = (item: ImageItem): string[] => {
    const urls: string[] = [];
    if (item.generatedImages) {
      urls.push(...(item.generatedImages.main ?? []));
      urls.push(...(item.generatedImages.infographic ?? []));
      urls.push(...(item.generatedImages.lifestyle ?? []));
    }
    if (item.imageRecords) {
      for (const rec of item.imageRecords) {
        urls.push(rec.currentUrl);
        for (const v of rec.versions ?? []) urls.push(v.url);
      }
    }
    return urls.filter(Boolean);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Generated Images</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No generated images found.</Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const urls = collectUrls(item);
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-orange-500" />
                      <span className="font-semibold">{item.productName}</span>
                      <Badge variant="outline">#{item.id}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  {urls.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {urls.slice(0, 12).map((url, i) => (
                        <div key={i} className="aspect-square rounded-md border bg-muted overflow-hidden">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No images available.</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
