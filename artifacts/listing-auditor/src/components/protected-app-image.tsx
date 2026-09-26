import { cn } from "@/lib/utils";
import { resolveAppImageUrl } from "@/lib/protected-app-image";

interface ProtectedAppImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/** Resolves app image paths and renders a normal img (images are served publicly on /api/images/...). */
export function ProtectedAppImage({ src, alt, className, loading = "lazy" }: ProtectedAppImageProps) {
  const trimmed = src?.trim() ?? "";
  const displaySrc = trimmed ? resolveAppImageUrl(trimmed) : "";

  if (!displaySrc) {
    return (
      <div
        className={cn("flex items-center justify-center bg-slate-100 text-slate-400 text-xs", className)}
        role="img"
        aria-label={alt}
      >
        No image
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
    />
  );
}
