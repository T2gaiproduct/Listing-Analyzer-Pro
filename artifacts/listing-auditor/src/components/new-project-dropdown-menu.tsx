import { Link } from "wouter";
import type { WorkspaceFeature } from "@workspace/workspace-permissions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CREATE_VIDEOS_COMING_SOON, MANAGE_ADS_COMING_SOON } from "@/lib/ads-nav";
import { cn } from "@/lib/utils";

export type NewProjectMenuItem = {
  href: string;
  label: string;
  feature: WorkspaceFeature;
};

const NEW_PROJECT_ITEMS: NewProjectMenuItem[] = [
  { href: "/audits/new", label: "Build Your Brand", feature: "build_brand" },
  { href: "/audit-listings", label: "Audit Listings", feature: "audits" },
  { href: "/projects/create", label: "Create Graphics", feature: "graphics" },
  { href: "/videos", label: "Create Videos", feature: "videos" },
  { href: "/ads/campaigns", label: "Manage Ads", feature: "ads" },
];

function isNewProjectComingSoon(feature: WorkspaceFeature): boolean {
  if (feature === "videos") return CREATE_VIDEOS_COMING_SOON;
  if (feature === "ads") return MANAGE_ADS_COMING_SOON;
  return false;
}

export function filterNewProjectMenuItems(
  items: NewProjectMenuItem[],
  canAccess: (feature: WorkspaceFeature) => boolean,
): NewProjectMenuItem[] {
  return items.filter((item) => canAccess(item.feature));
}

export const defaultNewProjectMenuItems = NEW_PROJECT_ITEMS;

function ComingSoonBadge() {
  return (
    <span
      className={cn(
        "ml-auto text-[10px] font-semibold uppercase tracking-wide",
        "text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5",
      )}
    >
      Soon
    </span>
  );
}

export function NewProjectDropdownMenuItems({
  items = NEW_PROJECT_ITEMS,
}: {
  items?: NewProjectMenuItem[];
}) {
  return (
    <>
      {items.map((item) => {
        const comingSoon = isNewProjectComingSoon(item.feature);
        if (comingSoon) {
          return (
            <DropdownMenuItem
              key={item.label}
              disabled
              className="flex items-center gap-2 opacity-100 data-[disabled]:opacity-100 cursor-not-allowed"
              onSelect={(e) => e.preventDefault()}
            >
              <span className="text-slate-500">{item.label}</span>
              <ComingSoonBadge />
            </DropdownMenuItem>
          );
        }
        return (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
