const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Routes that need homepage CMS / public promo banner data. */
const PUBLIC_CMS_PREFIXES = [
  "/",
  "/features",
  "/pricing",
  "/contact",
  "/help",
  "/enterprise",
  "/about",
  "/blog",
  "/terms",
  "/privacy",
  "/tutorials",
  "/sign-in",
  "/sign-up",
];

const PRIVATE_PREFIXES = [
  "/dashboard",
  "/admin",
  "/audits",
  "/projects",
  "/billing",
  "/team",
  "/roles",
  "/workspaces",
  "/profile",
  "/settings",
  "/archive",
  "/notifications",
  "/onboarding",
  "/checkout",
  "/accept-",
  "/recent-projects",
  "/audit-listings",
  "/videos",
  "/ads",
];

function normalizePath(pathname: string): string {
  let path = pathname || "/";
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || "/";
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path.split("?")[0].split("#")[0] || "/";
}

export function isPublicCmsRoute(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (path === "/") return true;
  return PUBLIC_CMS_PREFIXES.some(
    (prefix) => path === prefix || (prefix !== "/" && path.startsWith(`${prefix}/`)),
  );
}
