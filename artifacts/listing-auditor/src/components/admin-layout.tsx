import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, BarChart2, CreditCard,
  Layers, Shield, LogOut, ChevronRight, Settings,
  BadgePercent, ClipboardList, Download,
  Bell, BrainCircuit, KeyRound, Lock, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/audits", label: "All Audits", icon: FileText },
      { href: "/admin/content/logs", label: "Audit Logs", icon: ClipboardList },
      { href: "/admin/content/downloads", label: "Downloads", icon: Download },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/admin/plans", label: "Plans & Packages", icon: Layers },
      { href: "/admin/billing/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/billing/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/billing/refunds", label: "Refunds", icon: Layers },
      { href: "/admin/billing/coupons", label: "Coupons", icon: BadgePercent },
    ],
  },
  {
    label: "Roles",
    items: [
      { href: "/admin/roles", label: "Admin Roles", icon: Shield },
    ],
  },
  {
    label: "Notifications",
    items: [
      { href: "/admin/notifications", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings/platform", label: "Platform", icon: Settings },
      { href: "/admin/settings/ai", label: "AI Settings", icon: BrainCircuit },
      { href: "/admin/settings/api", label: "API Management", icon: KeyRound },
      { href: "/admin/settings/security", label: "Security", icon: Lock },
      { href: "/admin/settings/payment-gateway", label: "Payment Gateway", icon: Wallet },
    ],
  },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col shadow-2xl z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-700/50 gap-2">
          <Shield className="w-5 h-5 text-orange-400" />
          <div className="font-bold text-lg tracking-tight">
            <span className="text-white">Super</span>
            <span className="text-orange-400">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
                        isActive
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                      {item.label}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <button
            onClick={() => signOut({ redirectUrl: `${basePath}/` })}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
