import { useState } from "react";
import { Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImagePromptTemplateCategory } from "@/lib/image-prompt-templates";
import { AdminGraphicsModuleExamplesPanel } from "@/pages/admin/settings/graphics-module-examples-panel";

/** Admin dashboard entry: manage product categories and per-module sample reference images. */
export default function AdminCategorySamplesPage() {
  const [studioCategory, setStudioCategory] = useState("Default");
  const [tab, setTab] = useState<ImagePromptTemplateCategory>("graphics");

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">
        Studio configuration
      </p>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Category sample images</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Configure product categories and upload example images for each graphics or A+ module. Sellers see these
          references when customizing image types for a category.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "graphics" ? "default" : "outline"}
          size="sm"
          className={cn(tab === "graphics" && "bg-orange-500 hover:bg-orange-600")}
          onClick={() => setTab("graphics")}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Gallery graphics
        </Button>
        <Button
          type="button"
          variant={tab === "aplus" ? "default" : "outline"}
          size="sm"
          className={cn(tab === "aplus" && "bg-orange-500 hover:bg-orange-600")}
          onClick={() => setTab("aplus")}
        >
          <Layers className="w-4 h-4 mr-1.5" />
          A+ modules
        </Button>
      </div>

      <AdminGraphicsModuleExamplesPanel
        selectedCategory={studioCategory}
        onSelectedCategoryChange={setStudioCategory}
        templateCategory={tab}
      />
    </div>
  );
}