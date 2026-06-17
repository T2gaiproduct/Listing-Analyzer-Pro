import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, BarChart2, CreditCard,
  Layers, Shield, LogOut, ChevronRight, Settings,
  BadgePercent, ClipboardList, Download,
  Bell, BrainCircuit, KeyRound, Lock, Wallet,
  Globe, BookOpen, TrendingUp, MessageSquare, Image, Inbox, Navigation, Home,
  ChevronDown, ChevronUp, FileSearch, Palette, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

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
    ],
  },
  {
    label: "Audit Logs",
    items: [
      { href: "/admin/content/logs", label: "Listing Optimization", icon: FileSearch },
      { href: "/admin/content/graphics-logs", label: "Graphics Creation", icon: Palette },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/admin/plans", label: "Plans & Packages", icon: Layers },
      { href: "/admin/credit-rules", label: "Credit Rules", icon: Shield },
      { href: "/admin/billing/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/billing/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/billing/refunds", label: "Refunds", icon: Layers },
      { href: "/admin/billing/coupons", label: "Coupons", icon: BadgePercent },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/marketing/homepage", label: "Homepage CMS", icon: Home },
      { href: "/admin/marketing/pages", label: "Pages", icon: Globe },
      { href: "/admin/marketing/blog", label: "Blog", icon: BookOpen },
      { href: "/admin/marketing/seo", label: "SEO", icon: TrendingUp },
      { href: "/admin/marketing/testimonials", label: "Testimonials", icon: MessageSquare },
      { href: "/admin/marketing/media", label: "Media Library", icon: Image },
      { href: "/admin/marketing/forms", label: "Form Submissions", icon: Inbox },
      { href: "/admin/marketing/navigation", label: "Navigation", icon: Navigation },
    ],
  },
  {
    label: "Roles",
    items: [
      { href: "/admin/roles", label: "Admin Roles", icon: Shield },
    ],
  },
  {
    label: "Teams",
    items: [
      { href: "/admin/team-activity", label: "Team Activity", icon: Users },
    ],
  },
  {
    label: "Notifications",
    items: [
      { href: "/admin/notifications", label: "Alerts", icon: Bell },
      { href: "/admin/archive", label: "Archive", icon: Trash2 },
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

interface AdminNotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  sentAt: string;
}

function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async (): Promise<{ notifications: AdminNotificationItem[] }> => {
      const r = await fetch("/api/admin/my-notifications");
      if (!r.ok) throw new Error("Failed to load notifications");
      return r.json();
    },
    refetchInterval: 30000,
  });
  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/my-notifications/${id}/read`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => fetch("/api/admin/my-notifications/read-all", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-orange-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-slate-100 last:border-0 cursor-pointer transition-colors",
                    n.read ? "bg-white" : "bg-orange-50 hover:bg-orange-100"
                  )}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    if (n.link) {
                      setTimeout(() => {
                        window.location.href = n.link as string;
                      }, 150);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium leading-snug text-slate-900", n.link && "text-orange-600")}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(n.sentAt), { addSuffix: true })}
                    </p>
                    {n.link && (
                      <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                        <ChevronRight className="w-3 h-3" /> Open
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col shadow-2xl z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-700/50 gap-2">
          <Link href="/admin/dashboard" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-orange-400" />
            <div className="font-bold text-lg tracking-tight">
              <span className="text-white">Super</span>
              <span className="text-orange-400">Admin</span>
            </div>
          </Link>
          <div className="ml-auto">
            <AdminNotificationBell />
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
