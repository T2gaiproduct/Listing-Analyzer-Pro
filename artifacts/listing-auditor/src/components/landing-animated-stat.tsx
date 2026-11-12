import { useEffect, useState } from "react";
import { parseAnimatedStat, useInViewOnce, usePrefersReducedMotion } from "@/lib/landing-motion";

export function LandingAnimatedStat({
  value,
  className,
  durationMs = 1400,
}: {
  value: string;
  className?: string;
  durationMs?: number;
}) {
  const parsed = parseAnimatedStat(value);
  const { ref, inView } = useInViewOnce<HTMLSpanElement>();
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!parsed || !inView || reducedMotion) {
      setDisplay(value);
      return;
    }

    let start: number | null = null;
    let frame: number;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const current = parsed.end * eased;
      const num =
        parsed.decimals > 0
          ? current.toFixed(parsed.decimals)
          : String(Math.round(current));
      setDisplay(`${parsed.prefix}${num}${parsed.suffix}`);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, reducedMotion, parsed, value, durationMs]);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
