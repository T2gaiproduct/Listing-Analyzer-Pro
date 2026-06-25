import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  FilePlus2,
  FileSearch,
  Palette,
  Video,
  Megaphone,
  Bell,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  LogOut,
  Shield,
  UserCircle,
  Receipt,
  Settings,
  HelpCircle,
  Users,
  X,
  Pin,
  MoreHorizontal,
  Share2,
  PenLine,
  Trash2,
  Zap,
  LifeBuoy,
  FileText,
  Download,
  Keyboard,
  ScrollText,
  Lock,
  Bug,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser, useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const adminUserIds = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const mainNavItems = [
  { icon: FilePlus2, label: "Create Listings", href: "/audits/new" },
  { icon: FileSearch, label: "Audit Listings", href: "/audit-listings" },
  { icon: Palette, label: "Create Graphics", href: "/projects" },
  { icon: Video, label: "Create Videos", href: "/videos" },
  { icon: Megaphone, label: "Manage Ads", href: "/ads" },
];

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile", href: "/profile" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const helpSubmenuItems = [
  { icon: LifeBuoy,   label: "Help center",         href: "/help" },
  { icon: FileText,   label: "Release notes",        href: "/help#release" },
  { icon: Download,   label: "Download apps",        href: "/help#apps" },
  { icon: Keyboard,   label: "Keyboard shortcuts",   href: "/help#shortcuts" },
  { icon: ScrollText, label: "Terms of Service",     href: "/terms" },
  { icon: Lock,       label: "Privacy Policy",       href: "/privacy" },
  { icon: Bug,        label: "Report a bug",         href: "/contact" },
];

const contextMenuOptions = [
  { icon: Share2, label: "Share" },
  { icon: PenLine, label: "Rename" },
  { icon: Pin, label: "Pin project" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete", danger: true },
];

// --- Tooltip ----------------------------------------------------------------
function SidebarTooltip({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "bottom" | "right" }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className="flex items-center cursor-pointer">{children}</div>
      </TooltipTrigger>
      <TooltipContent side={side} className="bg-slate-900 text-white border-slate-800 text-xs font-medium px-2 py-1.5 rounded-md shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// --- Notification bell in header --------------------------------------------
interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  sentAt: string;
}

function NotificationIcon({ collapsed }: { collapsed: boolean }) {
  const [, navigate] = useLocation();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<{ notifications: NotificationItem[] }> => {
      const r = await fetch(`${basePath}/api/notifications`);
      if (!r.ok) throw new Error("Failed to load notifications");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SidebarTooltip label="Notifications" side={collapsed ? "right" : "bottom"}>
      <button
        onClick={() => navigate("/notifications")}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100",
          collapsed ? "w-9 h-9" : "w-8 h-8"
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-white" />
        )}
      </button>
    </SidebarTooltip>
  );
}

// --- Project context menu ---------------------------------------------------
function ProjectItem({
  label,
  href,
  openMenu,
  setOpenMenu,
  id,
}: {
  label: string;
  href: string;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  id: string;
}) {
  const [location] = useLocation();
  const [hovered, setHovered] = useState(false);
  const menuOpen = openMenu === id;
  const ref = useRef<HTMLDivElement>(null);
  const isActive = location === href;

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, setOpenMenu]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
          isActive
            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
            : hovered || menuOpen
            ? "bg-sidebar-accent/40 text-sidebar-foreground/90"
            : "text-sidebar-foreground/60"
        )}
      >
        <Link href={href} className="truncate flex-1 text-left min-w-0">
          {label}
        </Link>
        {(hovered || menuOpen) && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button className="w-5 h-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
              <Pin className="w-3 h-3" />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setOpenMenu(menuOpen ? null : id); }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-xl shadow-2xl z-[100] overflow-hidden py-1">
          {contextMenuOptions.map(({ icon: Icon, label: optLabel, danger }) => (
            <button
              key={optLabel}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
              )}
              onClick={() => setOpenMenu(null)}
            >
              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
              {optLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Layout ------------------------------------------------------------
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const isAdmin = user ? adminUserIds.includes(user.id) : false;

  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const helpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch audits for My Projects list
  const { data: auditsData } = useQuery({
    queryKey: ["audits-sidebar"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/audits`);
      if (!r.ok) return { audits: [] };
      return r.json() as Promise<{ audits: { id: number; productTitle: string }[] }>;
    },
  });
  const projects = auditsData?.audits ?? [];

  // Close profile popup on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?";

  const displayName = user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account";
  const planLabel = "Free"; // Can be wired to subscription API later

  return (
    <div
      className="flex h-screen w-full bg-background overflow-hidden"
      onClick={() => { setProfileOpen(false); setOpenMenu(null); }}
    >
      {/* Sidebar */}
      <TooltipProvider>
        <aside
          className={cn(
            "flex-shrink-0 bg-white text-slate-800 border-r border-slate-200 flex flex-col shadow-2xl z-10 transition-all duration-200 overflow-y-auto overflow-x-visible",
            collapsed ? "w-16" : "w-64"
          )}
          onClick={(e) => e.stopPropagation()}
        >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "border-b border-sidebar-border/50 flex-shrink-0",
            collapsed ? "px-2 py-3 flex flex-col items-center gap-2" : "px-4 py-4 flex items-center"
          )}
        >
          {/* Logo */}
          <Link href="/dashboard">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
              <Zap className="w-4 h-4 text-white" />
            </div>
          </Link>

          {!collapsed && (
            <>
              <div className="flex-1" />

              {/* Notifications */}
              <NotificationIcon collapsed={false} />

              {/* Archive */}
              <SidebarTooltip label="Archive" side="bottom">
                <Link href="/archive">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ml-1">
                    <Archive className="w-4 h-4" />
                  </button>
                </Link>
              </SidebarTooltip>

              {/* Divider */}
              <div className="w-px h-5 bg-sidebar-border/60 mx-2" />

              {/* Collapse */}
              <SidebarTooltip label="Collapse Sidebar" side="bottom">
                <button
                  onClick={() => setCollapsed(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </SidebarTooltip>
            </>
          )}

          {/* Expand button — sits below logo when collapsed */}
          {collapsed && (
            <SidebarTooltip label="Expand Sidebar" side="right">
              <button
                onClick={() => setCollapsed(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 border border-sidebar-border/60 transition-colors"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </SidebarTooltip>
          )}
        </div>

        {/* ── Nav + Projects (scrollable) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-visible py-4 flex flex-col">
          {/* Main nav items */}
          <div className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")}>
            {mainNavItems.map(({ icon: Icon, label, href }) => {
              const isActive = location === href || (href === "/dashboard" && location === "/");
              if (collapsed) {
                return (
                  <SidebarTooltip key={href} label={label} side="right">
                    <Link href={href}>
                      <button
                        className={cn(
                          "w-full flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-primary"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    </Link>
                  </SidebarTooltip>
                );
              }
              return (
                <Link key={href} href={href}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-left",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* My Projects icon — collapsed mode only */}
          {collapsed && (
            <div className="px-2 mt-1">
              <SidebarTooltip label="My Projects" side="right">
                <button
                  className="w-full flex items-center justify-center h-10 rounded-xl transition-colors text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => setCollapsed(false)}
                >
                  <Folder className="w-5 h-5" />
                </button>
              </SidebarTooltip>
            </div>
          )}

          {/* My Projects section — only when expanded */}
          {!collapsed && (
            <>
              <div className="mx-3 my-4 border-t border-sidebar-border/50" />

              <div className="px-3">
                <button
                  className="flex items-center gap-2 px-3 mb-2 w-full group"
                  onClick={() => setProjectsOpen((p) => !p)}
                >
                  <Folder className="w-3.5 h-3.5 text-sidebar-foreground/40" />
                  <span className="text-xs font-bold text-sidebar-foreground/50 uppercase tracking-wider flex-1 text-left">
                    My Projects
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform duration-200",
                      projectsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>

                {projectsOpen && (
                  <div className="space-y-0.5">
                    {[
                      { id: "demo-1", label: "Wireless Earbuds Pro Listing", href: "/dashboard" },
                      { id: "demo-2", label: "Yoga Mat Premium Audit", href: "/dashboard" },
                      { id: "demo-3", label: "Coffee Grinder Rewrite", href: "/dashboard" },
                      { id: "demo-4", label: "Standing Desk Q4 Review", href: "/dashboard" },
                    ].concat(
                      projects.map((p) => ({ id: String(p.id), label: p.productTitle, href: `/audits/${p.id}` }))
                    ).map((item) => (
                      <ProjectItem
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        href={item.href}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Admin Panel */}
          {isAdmin && (
            <div className={cn("mt-2", collapsed ? "px-2" : "px-3")}>
              {collapsed ? (
                <SidebarTooltip label="Admin Panel" side="right">
                  <Link href="/admin/dashboard">
                    <button className="w-full flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-primary transition-colors">
                      <Shield className="w-4 h-4 text-primary" />
                    </button>
                  </Link>
                </SidebarTooltip>
              ) : (
                <Link href="/admin/dashboard">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Admin Panel
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: Profile + Upgrade ──────────────────────── */}
        <div
          className={cn(
            "border-t border-sidebar-border/50 flex-shrink-0",
            collapsed ? "px-2 py-3 flex justify-center" : "px-4 py-4 flex items-center justify-between gap-3"
          )}
        >
          {collapsed ? (
            /* Collapsed: just avatar */
            <SidebarTooltip label={displayName} side="right">
              <button
                onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
                className="w-9 h-9 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              >
                {initials}
              </button>
            </SidebarTooltip>
          ) : (
            <>
              {/* Profile button */}
              <div ref={profileRef} className="relative min-w-0">
                <button
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-1 py-1 -mx-1 transition-colors min-w-0",
                    profileOpen ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent/50"
                  )}
                  onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-sidebar-foreground leading-tight truncate max-w-[90px]">
                      {displayName}
                    </p>
                    <p className="text-xs text-sidebar-foreground/50 leading-tight">{planLabel}</p>
                  </div>
                </button>

                {/* Profile popup */}
                {profileOpen && (
                  <div
                    className="absolute left-0 bottom-full mb-3 w-56 bg-popover border border-border rounded-2xl shadow-2xl z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3 rounded-t-2xl overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground leading-tight truncate">
                          {user?.emailAddresses?.[0]?.emailAddress ?? ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setProfileOpen(false)}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Menu items */}
                    <div className="py-1.5">
                      {profileMenuItems.map(({ icon: Icon, label, href }) => (
                        <Link key={label} href={href}>
                          <button
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            {label}
                          </button>
                        </Link>
                      ))}

                      {/* Help & Support — flyout on hover */}
                      <div
                        className="relative"
                        onMouseEnter={() => {
                          if (helpTimeoutRef.current) clearTimeout(helpTimeoutRef.current);
                          setHelpOpen(true);
                        }}
                        onMouseLeave={() => {
                          helpTimeoutRef.current = setTimeout(() => setHelpOpen(false), 120);
                        }}
                      >
                        <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left">
                          <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1">Help &amp; Support</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>

                        {/* Flyout submenu */}
                        {helpOpen && (
                          <div
                            className="absolute left-full bottom-0 ml-1 w-52 bg-popover border border-border rounded-xl shadow-2xl z-[110] py-1.5"
                            onMouseEnter={() => {
                              if (helpTimeoutRef.current) clearTimeout(helpTimeoutRef.current);
                              setHelpOpen(true);
                            }}
                            onMouseLeave={() => {
                              helpTimeoutRef.current = setTimeout(() => setHelpOpen(false), 120);
                            }}
                          >
                            {helpSubmenuItems.map(({ icon: Icon, label, href }) => (
                              <Link key={label} href={href}>
                                <button
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                                  onClick={() => { setHelpOpen(false); setProfileOpen(false); }}
                                >
                                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  {label}
                                </button>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border py-1.5 rounded-b-2xl overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                        onClick={() => signOut({ redirectUrl: `${basePath}/` })}
                      >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upgrade button */}
              <Link href="/billing">
                <button className="flex-shrink-0 text-sm font-medium text-sidebar-foreground/80 border border-sidebar-border rounded-full px-4 py-1.5 hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors">
                  Upgrade
                </button>
              </Link>
            </>
          )}
        </div>
        </aside>
      </TooltipProvider>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-orange-300 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
