import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TutorialCard } from "@/components/tutorial-card";
import type { TutorialPreviewItem } from "@/lib/tutorials-cms";

export function TutorialCarousel({ tutorials }: { tutorials: TutorialPreviewItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const cardWidth = scrollRef.current?.firstElementChild?.clientWidth ?? 280;
    scrollRef.current?.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="relative sm:hidden px-2">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Previous tutorial"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
        aria-label="Next tutorial"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4 overscroll-x-contain"
      >
        {tutorials.map((t) => (
          <div key={t.title} className="snap-start shrink-0 w-[min(92vw,22rem)] sm:w-[24rem]">
            <TutorialCard {...t} layout="carousel" />
          </div>
        ))}
      </div>
    </div>
  );
}
