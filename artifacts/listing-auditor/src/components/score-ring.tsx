import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}

export function ScoreRing({ score, size = "md", showLabel = true, className }: ScoreRingProps) {
  const getColor = (val: number) => {
    if (val >= 70) return "text-emerald-500";
    if (val >= 50) return "text-amber-500";
    return "text-rose-500";
  };
  
  const getBgColor = (val: number) => {
    if (val >= 70) return "text-emerald-500/10";
    if (val >= 50) return "text-amber-500/10";
    return "text-rose-500/10";
  };

  const dimensions = {
    sm: { w: 40, h: 40, stroke: 3, text: "text-xs", label: "text-[10px]" },
    md: { w: 64, h: 64, stroke: 4, text: "text-lg", label: "text-xs" },
    lg: { w: 96, h: 96, stroke: 6, text: "text-3xl", label: "text-sm" },
    xl: { w: 160, h: 160, stroke: 10, text: "text-5xl", label: "text-base" },
  };

  const dim = dimensions[size];
  const radius = (dim.w - dim.stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const colorClass = getColor(score);
  const bgColorClass = getBgColor(score);

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <div className="relative flex items-center justify-center" style={{ width: dim.w, height: dim.h }}>
        {/* Background track */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
          <circle
            cx={dim.w / 2}
            cy={dim.h / 2}
            r={radius}
            strokeWidth={dim.stroke}
            fill="transparent"
            className={cn("stroke-current", bgColorClass)}
          />
        </svg>
        
        {/* Progress track */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
          <circle
            cx={dim.w / 2}
            cy={dim.h / 2}
            r={radius}
            strokeWidth={dim.stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn("stroke-current transition-all duration-1000 ease-out", colorClass)}
          />
        </svg>
        
        {/* Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold font-mono tracking-tighter", dim.text, colorClass)}>
            {score}
          </span>
        </div>
      </div>
      
      {showLabel && (
        <span className={cn("font-medium uppercase tracking-wider text-muted-foreground mt-2", dim.label)}>
          Score
        </span>
      )}
    </div>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const getColor = (val: number) => {
    if (val >= 70) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (val >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  };
  
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border font-mono", getColor(score), className)}>
      {score}
    </span>
  );
}
