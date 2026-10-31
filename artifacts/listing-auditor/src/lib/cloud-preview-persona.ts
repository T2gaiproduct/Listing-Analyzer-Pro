export type CloudPreviewPersona = "admin" | "customer";

export const CLOUD_PREVIEW_PERSONA_STORAGE_KEY = "cloudPreviewPersona";

export function getStoredPreviewPersona(): CloudPreviewPersona {
  if (typeof window === "undefined") return "customer";

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("previewAs");
  if (fromQuery === "admin" || fromQuery === "customer") {
    try {
      sessionStorage.setItem(CLOUD_PREVIEW_PERSONA_STORAGE_KEY, fromQuery);
    } catch {
      /* ignore */
    }
    return fromQuery;
  }

  try {
    const stored = sessionStorage.getItem(CLOUD_PREVIEW_PERSONA_STORAGE_KEY);
    if (stored === "admin" || stored === "customer") return stored;
  } catch {
    /* ignore */
  }

  return "customer";
}

export function setStoredPreviewPersona(persona: CloudPreviewPersona): void {
  try {
    sessionStorage.setItem(CLOUD_PREVIEW_PERSONA_STORAGE_KEY, persona);
  } catch {
    /* ignore */
  }
}

export function switchCloudPreviewPersona(persona: CloudPreviewPersona, href: string): void {
  setStoredPreviewPersona(persona);
  window.location.assign(href);
}
