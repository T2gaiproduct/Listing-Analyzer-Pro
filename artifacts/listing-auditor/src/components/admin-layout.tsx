import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Users, FileText, BarChart2, CreditCard,
  Layers, Shield, LogOut, ChevronRight, Settings,
  BadgePercent, ClipboardList, Download,
  Bell, BrainCircuit, KeyRound, Lock, Wallet,
  Globe, BookOpen, TrendingUp, MessageSquare, Image, Navigation, Home,
  ChevronDown, ChevronUp, FileSearch, Palette, Archive,
  Video, Megaphone, HelpCircle, Mail, LifeBuoy, PanelLeftClose, PanelLeftOpen, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "User Management",
    collapsible: true,
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/roles", label: "Roles", icon: Shield },
    ],
  },
  {
    label: "Services",
    collapsible: true,
    items: [
      { href: "/admin/content/build-brand-logs", label: "Build Your Brand", icon: ClipboardList },
      { href: "/admin/content/logs", label: "Audit Listing", icon: FileSearch },
      { href: "/admin/content/graphics-logs", label: "Graphics Creation", icon: Palette },
      { href: "/videos", label: "Create Videos", icon: Video },
      { href: "/ads", label: "Manage Ads", icon: Megaphone },
    ],
  },
  {
    label: "Billing",
    collapsible: true,
    items: [
      { href: "/admin/plans", label: "Plans & Packages", icon: Layers },
      { href: "/admin/credit-rules", label: "Credit Rules", icon: Shield },
      { href: "/admin/billing/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/billing/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/billing/refunds", label: "Refunds", icon: Layers },
    ],
  },
  {
    label: "Reports",
    collapsible: true,
    items: [
      { href: "/admin/reports/revenue", label: "Revenue Reports", icon: BarChart2 },
      { href: "/admin/reports/customers", label: "Customer Reports", icon: Users },
      { href: "/admin/reports/subscriptions", label: "Subscription Reports", icon: CreditCard },
    ],
  },
  {
    label: "Marketing",
    collapsible: true,
    items: [
      { href: "/admin/notifications", label: "Announcements", icon: Megaphone },
      { href: "/admin/billing/coupons", label: "Coupons", icon: BadgePercent },
    ],
  },
  {
    label: "Website CMS",
    collapsible: true,
    items: [
      { href: "/admin/marketing/homepage", label: "Homepage", icon: Home },
      { href: "/admin/marketing/pages", label: "Pages", icon: Globe },
      { href: "/admin/marketing/navigation", label: "Navigation Menu", icon: Navigation },
      { href: "/admin/marketing/blog", label: "Blog", icon: BookOpen },
      { href: "/admin/marketing/seo", label: "SEO", icon: TrendingUp },
      { href: "/admin/marketing/testimonials", label: "Testimonials", icon: MessageSquare },
      { href: "/admin/marketing/faqs", label: "FAQ", icon: HelpCircle },
      { href: "/admin/marketing/media", label: "Media Library", icon: Image },
    ],
  },
  {
    label: "Help & Support",
    collapsible: true,
    items: [
      { href: "/admin/help/support-tickets", label: "Support Tickets", icon: LifeBuoy },
      { href: "/admin/marketing/forms?type=contact", label: "Contact Messages", icon: Mail },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      { href: "/admin/settings/platform", label: "Company Settings", icon: Settings },
      { href: "/admin/settings/ai", label: "AI Settings", icon: BrainCircuit },
      { href: "/admin/settings/api", label: "Webhook Settings", icon: KeyRound },
      { href: "/admin/settings/email", label: "Email Settings", icon: Mail },
      { href: "/admin/settings/payment-gateway", label: "Payment Settings", icon: Wallet },
      { href: "/admin/settings/security", label: "Security Settings", icon: Lock },
      { href: "/admin/team-activity", label: "Team Activity", icon: Users },
    ],
  },
];

function AdminNavSections({
  location,
  collapsed,
  collapsedSections,
  toggleSection,
  onNavigate,
}: {
  location: string;
  collapsed: boolean;
  collapsedSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navSections.map((section) => {
        const collapsible = (section as { collapsible?: boolean }).collapsible === true;
        const isSectionCollapsed = !collapsed && collapsible && (collapsedSections[section.label] ?? false);
        return (
          <div key={section.label}>
            {!collapsed && (collapsible ? (
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 hover:text-slate-300 transition-colors min-h-11"
              >
                <span>{section.label}</span>
                {isSectionCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {section.label}
              </p>
            ))}
            <div className={cn("space-y-0.5", isSectionCollapsed && "hidden")}>
              {section.items.map((item) => {
                const itemPath = item.href.split("?")[0];
                const isActive = location.startsWith(itemPath);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center rounded-md text-sm font-medium transition-all group min-h-11",
                      collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                    {!collapsed && item.label}
                    {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toggleSection = (label: string) =>
    setCollapsedSections((s) => ({ ...s, [label]: !s[label] }));

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <aside className={cn("hidden lg:flex flex-shrink-0 bg-slate-900 text-slate-100 flex-col shadow-2xl z-10 transition-[width] duration-200", collapsed ? "w-16" : "w-64")}>
        {collapsed ? (
          <div className="h-16 flex flex-col items-center justify-center gap-1 px-2 border-b border-slate-700/50">
            <Link href="/admin/dashboard" aria-label="Dashboard">
              <Shield className="w-5 h-5 text-orange-400" />
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50 gap-2">
            <Link href="/admin/dashboard" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity min-w-0">
              <Shield className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div className="font-bold text-lg tracking-tight truncate">
                <span className="text-white">Super</span>
                <span className="text-orange-400">Admin</span>
              </div>
            </Link>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Link
                href="/admin/notifications"
                aria-label="Notifications"
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
              >
                <Bell className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/archive"
                aria-label="Archive"
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
              >
                <Archive className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Collapse Sidebar"
                aria-label="Collapse Sidebar"
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <nav className={cn("flex-1 py-4 overflow-y-auto", collapsed ? "px-2 space-y-1" : "px-3 space-y-5")}>
          <AdminNavSections
            location={location}
            collapsed={collapsed}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
          />
        </nav>

        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <button
            onClick={() => signOut({ redirectUrl: `${basePath}/` })}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center rounded-md text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full min-h-11",
              collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2 text-left"
            )}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw-3rem,18rem)] p-0 bg-slate-900 text-slate-100 border-slate-800 flex flex-col lg:hidden">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="h-14 flex items-center px-4 border-b border-slate-700/50 gap-2">
            <Shield className="w-5 h-5 text-orange-400" />
            <span className="font-bold text-white">Super<span className="text-orange-400">Admin</span></span>
          </div>
          <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-5">
            <AdminNavSections
              location={location}
              collapsed={false}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </nav>
          <div className="p-3 border-t border-slate-700/50">
            <button
              onClick={() => signOut({ redirectUrl: `${basePath}/` })}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 w-full min-h-11"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400 flex-shrink-0" />
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-slate-200 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="touch-target flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Open admin menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-900 truncate">Admin</span>
        </div>
        <div className="flex-1 overflow-y-auto app-shell-padding bg-slate-50">
          <div className="app-content-max max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
