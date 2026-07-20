import { useEffect, useState } from "react";
import { Plus, Trash2, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";
import {
  MAX_TUTORIAL_ITEMS,
  tutorialItemKeys,
  visibleTutorialItemCount,
} from "@/lib/tutorials-cms";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TutorialsCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

export function TutorialsCmsEditor({ data, onChange }: TutorialsCmsEditorProps) {
  const [visibleCount, setVisibleCount] = useState(() => visibleTutorialItemCount(data));

  useEffect(() => {
    setVisibleCount((count) => Math.max(count, visibleTutorialItemCount(data)));
  }, [data]);

  function clearTutorialItem(index: number) {
    const keys = tutorialItemKeys(index);
    onChange(keys.title, "");
    onChange(keys.duration, "");
    onChange(keys.image, "");
    onChange(keys.videoUrl, "");
  }

  function removeTutorialItem(index: number) {
    if (visibleCount <= 1) return;

    for (let i = index; i < visibleCount; i++) {
      const current = tutorialItemKeys(i);
      const next = tutorialItemKeys(i + 1);
      onChange(current.title, data[next.title] ?? "");
      onChange(current.duration, data[next.duration] ?? "");
      onChange(current.image, data[next.image] ?? "");
      onChange(current.videoUrl, data[next.videoUrl] ?? "");
    }

    clearTutorialItem(visibleCount);
    setVisibleCount((count) => count - 1);
  }

  function addTutorialItem() {
    if (visibleCount >= MAX_TUTORIAL_ITEMS) return;
    setVisibleCount((count) => count + 1);
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-700">Tutorial videos</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Add YouTube or video links. Each tutorial needs a title; video URL opens in a player on the homepage.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 shrink-0"
          disabled={visibleCount >= MAX_TUTORIAL_ITEMS}
          onClick={addTutorialItem}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add tutorial
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: visibleCount }, (_, i) => i + 1).map((index) => {
          const keys = tutorialItemKeys(index);
          const previewUrl = data[keys.image]
            ? resolveCmsAssetUrl(data[keys.image], basePath)
            : "";

          return (
            <Card key={index} className="border border-slate-200 shadow-none">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-slate-800">
                  Tutorial {index}
                  {data[keys.title] ? ` — ${data[keys.title]}` : ""}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600 shrink-0"
                  disabled={visibleCount <= 1}
                  onClick={() => removeTutorialItem(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.title] ?? ""}
                      onChange={(e) => onChange(keys.title, e.target.value)}
                      placeholder="Getting Started"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Duration</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.duration] ?? ""}
                      onChange={(e) => onChange(keys.duration, e.target.value)}
                      placeholder="5:32"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    Video URL (YouTube or direct link)
                  </Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={data[keys.videoUrl] ?? ""}
                    onChange={(e) => onChange(keys.videoUrl, e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports YouTube watch, youtu.be, and embed links.
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Thumbnail image URL</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={data[keys.image] ?? ""}
                    onChange={(e) => onChange(keys.image, e.target.value)}
                    placeholder="https://... or /portfolio/example.jpg"
                  />
                  {previewUrl && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 max-w-[200px]">
                      <img src={previewUrl} alt="" className="w-full h-auto rounded-md object-contain max-h-28" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
