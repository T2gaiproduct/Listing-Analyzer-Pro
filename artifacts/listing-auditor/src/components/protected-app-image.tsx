import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  fetchProtectedAppImageBlobUrl,
  isProtectedAuditImageUrl,
  resolveAppImageUrl,
} from "@/lib/protected-app-image";

interface ProtectedAppImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export function ProtectedAppImage({ src, alt, className, loading = "lazy" }: ProtectedAppImageProps) {
  const [displaySrc, setDisplaySrc] = useState(() =>
    isProtectedAuditImageUrl(src) ? "" : resolveAppImageUrl(src),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    setFailed(false);

    if (!src?.trim()) {
      setDisplaySrc("");
      return;
    }

    if (!isProtectedAuditImageUrl(src)) {
      setDisplaySrc(resolveAppImageUrl(src));
      return;
    }

    setDisplaySrc("");
    void fetchProtectedAppImageBlobUrl(src)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrl = url;
        setDisplaySrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (failed || (!displaySrc && isProtectedAuditImageUrl(src))) {
    return (
      <div
        className={cn("flex items-center justify-center bg-slate-100 text-slate-400 text-xs", className)}
        role="img"
        aria-label={alt}
      >
        {failed ? "Image unavailable" : "Loading…"}
      </div>
    );
  }

  if (!displaySrc) {
    return <div className={cn("bg-slate-100 animate-pulse", className)} aria-hidden />;
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
    />
  );
}
