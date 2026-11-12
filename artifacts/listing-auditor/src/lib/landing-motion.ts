import { useEffect, useRef, useState, type RefObject } from "react";

export function parseAnimatedStat(raw: string): {
  prefix: string;
  end: number;
  suffix: string;
  decimals: number;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\+?)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const numPart = match[2];
  const decimals = numPart.includes(".") ? numPart.split(".")[1]!.length : 0;
  return {
    prefix: match[1] ?? "",
    end: parseFloat(numPart),
    suffix: match[3] ?? "",
    decimals,
  };
}

export function useInViewOnce<T extends HTMLElement>(
  rootMargin = "0px 0px -10% 0px",
): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
