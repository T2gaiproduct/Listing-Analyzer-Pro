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

/** Copy plain text; uses Clipboard API with execCommand fallback (works in more browsers/contexts). */
export async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim();
  if (!value) {
    throw new Error("Nothing to copy");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // fall through to legacy copy
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error("Copy command failed");
  }
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
  await copyTextToClipboard(message);
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
}

/** Copy the shareable project URL only (for “Copy link”). */
export async function copyShareUrl(url: string): Promise<void> {
  await copyTextToClipboard(url);
}

export async function copyShareMessage(message: string): Promise<void> {
  await copyTextToClipboard(message);
}
