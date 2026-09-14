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

/** Synchronous copy — must run in the same turn as the user click (Safari / strict browsers). */
function copyTextToClipboardSync(text: string): boolean {
  if (typeof document === "undefined") return false;
  const value = text.trim();
  if (!value) return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
}

/** Copy plain text; sync execCommand first (click gesture), then Clipboard API fallback. */
export async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim();
  if (!value) {
    throw new Error("Nothing to copy");
  }

  if (copyTextToClipboardSync(value)) {
    return;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // fall through
    }
  }

  if (copyTextToClipboardSync(value)) {
    return;
  }

  throw new Error("Copy command failed");
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
