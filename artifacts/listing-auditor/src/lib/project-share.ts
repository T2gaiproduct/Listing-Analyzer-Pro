export type ProjectShareContext = {
  type: string;
  id: number;
};

export function buildProjectShareUrl(
  origin: string,
  basePath: string,
  projectCtx: ProjectShareContext | null,
  fallbackHref?: string,
): string {
  const base = basePath.replace(/\/$/, "") || "";
  if (projectCtx?.type === "listing") {
    return `${origin}${base}/audits/workflow?resume=${projectCtx.id}`;
  }
  if (projectCtx?.type === "audit") {
    return `${origin}${base}/audits/${projectCtx.id}`;
  }
  if (projectCtx?.type === "graphics") {
    return `${origin}${base}/projects/${projectCtx.id}`;
  }
  if (fallbackHref) return fallbackHref;
  if (typeof window !== "undefined") return window.location.href;
  return origin;
}

export function buildShareMessage(projectTitle: string | undefined, url: string): string {
  const name = projectTitle?.trim() || "this project";
  return `Check out ${name} on SellerLens:\n${url}`;
}

export function openWhatsAppShare(message: string): void {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

/** Instagram has no web URL scheme for link sharing — copy message and open Instagram. */
export async function shareToInstagram(message: string): Promise<void> {
  await navigator.clipboard.writeText(message);
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
}

export async function copyShareMessage(message: string): Promise<void> {
  await navigator.clipboard.writeText(message);
}
