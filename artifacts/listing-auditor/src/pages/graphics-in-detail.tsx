import { LayoutDashboard, Wand2 } from "lucide-react";
import { FeatureProductHistoryTable } from "@/components/feature-product-history-table";
import { GRAPHICS_IN_DETAIL_FROM } from "@/lib/graphics-in-detail-nav";

export default function GraphicsInDetail() {
  return (
    <div className="w-full min-w-0 pt-0 pb-8 space-y-12 animate-in fade-in duration-500">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          Graphics in <span className="text-orange-500">detail</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
          Open any graphics project: start on the full product overview, then switch to Create Graphics to
          generate or reuse images.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium text-foreground">Product summary overview</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium text-foreground">Create &amp; reuse graphics</span>
          </div>
        </div>
      </div>

      <FeatureProductHistoryTable
        sourceType="graphics"
        viewTarget="graphics-detail"
        graphicsDetailFrom={GRAPHICS_IN_DETAIL_FROM}
        sectionTitle="Your graphics projects"
        emptyTitle="No graphics projects yet"
        emptyDescription="Start from Create Graphics, then return here to open overview and reuse generated images."
      />
    </div>
  );
}
