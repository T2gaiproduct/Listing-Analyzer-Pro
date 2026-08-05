import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectShareMenu } from "@/components/project-share-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ProductDetailRibbon({
  productId,
  productName,
  workflowUrl,
  onNavigate,
}: {
  productId: number;
  productName: string;
  workflowUrl: string;
  onNavigate: (url: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/products/${productId}`
      : `${basePath}/products/${productId}`;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-0 min-h-[40px] py-1.5 px-3 sm:px-4 bg-slate-50/80 border border-slate-200 rounded-lg">
      <Link
        href="/products"
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-md px-2 py-1.5 transition-colors z-10"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Back</span>
      </Link>

      <div className="flex-1 min-w-0 sm:ml-3 flex items-center order-3 sm:order-none w-full sm:w-auto basis-full sm:basis-auto">
        <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
          {productName}
        </h1>
      </div>

      <div className="flex items-center gap-1 ml-auto z-10">
        <ProjectShareMenu
          projectCtx={{ type: "listing", id: productId }}
          projectTitle={productName}
          shareUrlOverride={shareUrl}
          onShared={() => setMenuOpen(false)}
        />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title="More options"
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors",
              menuOpen
                ? "text-slate-700 bg-slate-100"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate(workflowUrl);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Pencil className="w-3.5 h-3.5 opacity-60" />
                Edit in Workflow
              </button>
              <Link
                href="/products"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 opacity-60" />
                Back to Products
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
