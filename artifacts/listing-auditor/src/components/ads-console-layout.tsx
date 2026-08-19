import { Link, useLocation } from "wouter";
import {
  LayoutList,
  Megaphone,
  Search,
  Package,
  MapPin,
  Ban,
  Users,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ADS_CONSOLE_NAV = [
  { href: "/ads/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/ads/targets", label: "Targets", icon: TargetIcon },
  { href: "/ads/search-terms", label: "Search Terms", icon: Search },
  { href: "/ads/products", label: "Ads Products", icon: Package },
  { href: "/ads/placements", label: "Placements", icon: MapPin },
  { href: "/ads/negative-targets", label: "Negative Targets", icon: Ban },
  { href: "/ads/amc-audiences", label: "AMC Audiences", icon: Users, badge: "New" },
  { href: "/ads/campaign-manager", label: "Campaign Manager", icon: Settings2 },
] as const;

function TargetIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function AdsConsoleLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#f4f7f8] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <aside className="w-56 shrink-0 border-r border-slate-200/80 bg-white py-4 pr-2">
        <div className="flex items-center gap-2 px-3 mb-4 text-slate-700">
          <LayoutList className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold">Bulk Actions</span>
        </div>
        <nav className="space-y-0.5">
          {ADS_CONSOLE_NAV.map((item) => {
            const active = location === item.href || location.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-teal-50 text-teal-800 font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-teal-600" : "text-slate-400")} />
                  <span className="truncate">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-teal-700 text-white px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 py-4 pl-4 sm:pl-6">{children}</main>
    </div>
  );
}
