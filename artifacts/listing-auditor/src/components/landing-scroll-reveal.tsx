import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInViewOnce, usePrefersReducedMotion } from "@/lib/landing-motion";

export function LandingScrollReveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      className={cn(
        !reducedMotion && "transition-all duration-700 ease-out",
        !reducedMotion && !inView && "opacity-0 translate-y-6",
        !reducedMotion && inView && "opacity-100 translate-y-0",
        className,
      )}
      style={delayMs && !reducedMotion ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
