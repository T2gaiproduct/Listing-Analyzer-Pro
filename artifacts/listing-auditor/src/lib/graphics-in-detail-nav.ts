export const GRAPHICS_IN_DETAIL_FROM = "graphics-in-detail";

/** Query flag when a graphics project was started via Create Graphics → From scratch. */
export const GRAPHICS_PROJECT_ORIGIN_SCRATCH = "scratch";

export function isScratchGraphicsProjectOpen(search: string | undefined): boolean {
  const raw = search ?? "";
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q).get("graphicsOrigin") === GRAPHICS_PROJECT_ORIGIN_SCRATCH;
}

export function graphicsScratchProjectViewPath(
  projectId: number,
  returnTo = "/projects",
): string {
  const params = new URLSearchParams({
    returnTo,
    graphicsOrigin: GRAPHICS_PROJECT_ORIGIN_SCRATCH,
    tab: "create_graphics",
  });
  return `/projects/${projectId}?${params.toString()}`;
}

export type GraphicsInDetailTab = "overview" | "create_graphics";

export function parseGraphicsDetailOpenFrom(search: string | undefined): typeof GRAPHICS_IN_DETAIL_FROM | null {
  const raw = search ?? "";
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  const from = new URLSearchParams(q).get("from");
  if (from === GRAPHICS_IN_DETAIL_FROM) return GRAPHICS_IN_DETAIL_FROM;
  return null;
}

export function isOpenedFromGraphicsInDetail(search: string | undefined): boolean {
  return parseGraphicsDetailOpenFrom(search) === GRAPHICS_IN_DETAIL_FROM;
}

export function isOpenedFromGraphicsInDetailHub(search: string | undefined): boolean {
  return parseGraphicsDetailOpenFrom(search) != null;
}

export function parseGraphicsInDetailTab(search: string | undefined): GraphicsInDetailTab {
  const raw = search ?? "";
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  const tab = new URLSearchParams(q).get("tab");
  if (tab === "create_graphics" || tab === "reuse_graphics") return "create_graphics";
  return "overview";
}

export function graphicsInDetailViewPath(
  projectId: number,
  tab: GraphicsInDetailTab = "overview",
): string {
  const params = new URLSearchParams({ from: GRAPHICS_IN_DETAIL_FROM, tab });
  return `/projects/${projectId}?${params.toString()}`;
}

export const GRAPHICS_IN_DETAIL_HREF = "/graphics-in-detail";

function isGraphicsProjectPath(location: string): boolean {
  return /^\/projects\/\d+(?:\/|$)/.test(location);
}

export function isGraphicsInDetailNavActive(location: string, search = ""): boolean {
  if (location === GRAPHICS_IN_DETAIL_HREF) return true;
  if (isGraphicsProjectPath(location) && isOpenedFromGraphicsInDetail(search)) return true;
  return false;
}

export function isCreateGraphicsLandingActive(location: string, search = ""): boolean {
  if (location === "/projects") return true;
  if (location === "/projects/create") return true;
  if (location.endsWith("/generating")) return true;
  if (isGraphicsProjectPath(location) && !isOpenedFromGraphicsInDetail(search)) return true;
  return false;
}

export function isCreateGraphicsSectionPath(location: string, search = ""): boolean {
  return isCreateGraphicsLandingActive(location, search) || isGraphicsInDetailNavActive(location, search);
}
