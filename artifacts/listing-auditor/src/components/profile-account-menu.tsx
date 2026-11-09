import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, LogOut, Lock, X } from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildProfileMenuItems } from "@/lib/profile-menu-items";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ProfileAccountMenuProps = {
  displayName: string;
  initials: string;
  email: string;
  planLabel: string;
  roleLabel: string;
  variant?: "customer" | "admin";
  /** Sidebar icon-only mode */
  collapsed?: boolean;
  /** Dropdown opens above trigger (sidebar footer) or below (top bar) */
  dropdownDirection?: "up" | "down";
  layout?: "sidebar" | "topbar";
  className?: string;
};

export function ProfileAccountMenu({
  displayName,
  initials,
  email,
  planLabel,
  roleLabel,
  variant = "customer",
  collapsed = false,
  dropdownDirection = "up",
  layout = "sidebar",
  className,
}: ProfileAccountMenuProps) {
  const { signOut } = useClerk();
  const { isTeamMember, isOwner } = useTeam();
  const { isAccountOwner, isWorkspaceAccountOwner, canView, can } = useWorkspace();
  const { workspacesPlanLocked, workspacesEnabled } = useWorkspacesPlan();
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const menuItems = buildProfileMenuItems(
    isTeamMember,
    isOwner,
    isAccountOwner,
    isWorkspaceAccountOwner,
    variant,
    canView,
    can,
    workspacesPlanLocked,
    workspacesEnabled,
  );

  const profileSubtitle =
    variant === "admin"
      ? roleLabel
      : planLabel && planLabel !== "No plan"
        ? `${roleLabel} · ${planLabel}`
        : roleLabel;

  const planOnly =
    variant !== "admin" && planLabel && planLabel !== "No plan"
      ? planLabel.replace(/ Plan$/, "")
      : null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const dropdownPosition =
    dropdownDirection === "up"
      ? "bottom-full left-0 right-0 mb-1.5"
      : "top-full right-0 mt-1.5";

  return (
    <div ref={profileRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setProfileOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors touch-target",
          layout === "topbar"
            ? cn(
                "h-9 pl-1.5 pr-2 w-auto",
                profileOpen ? "bg-muted" : "hover:bg-muted",
              )
            : cn(
                "w-full",
                collapsed ? "justify-center w-10 h-10 mx-auto p-0" : "px-2 py-2",
                variant === "admin"
                  ? "hover:bg-slate-800/80"
                  : "hover:bg-sidebar-accent/50",
                profileOpen && !collapsed && (variant === "admin" ? "bg-slate-800/80" : "bg-sidebar-accent/50"),
              ),
        )}
        aria-label="Account menu"
        title={collapsed ? displayName : undefined}
      >
        <div
          className={cn(
            "rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0",
            layout === "topbar" ? "w-7 h-7 text-[11px]" : "w-8 h-8 text-[11px]",
          )}
        >
          {initials}
        </div>
        {!collapsed && (
          <>
            <div
              className={cn(
                "text-left flex-1 min-w-0",
                layout === "topbar" && "hidden md:block",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold leading-tight truncate",
                  layout === "topbar"
                    ? "text-foreground max-w-[7.5rem] lg:max-w-[120px]"
                    : variant === "admin"
                      ? "text-white"
                      : "text-sidebar-foreground",
                )}
              >
                {displayName}
              </p>
              <p
                className={cn(
                  "text-[10px] leading-tight truncate",
                  layout === "topbar"
                    ? "text-muted-foreground text-[11px] max-w-[7.5rem] lg:max-w-[140px]"
                    : variant === "admin"
                      ? "text-white/75"
                      : "text-sidebar-foreground/65",
                )}
              >
                {layout === "topbar" ? profileSubtitle : (planOnly ?? profileSubtitle)}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 flex-shrink-0 transition-transform",
                layout === "topbar"
                  ? "text-muted-foreground hidden sm:block"
                  : variant === "admin"
                    ? "text-white/60"
                    : "text-sidebar-foreground/50",
                profileOpen && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {profileOpen && (
        <div
          className={cn(
            "absolute z-50 w-[min(100vw-2rem,14rem)] sm:w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden",
            dropdownPosition,
            collapsed && "left-full right-auto bottom-0 ml-2 w-56",
          )}
        >
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              <p className="text-xs text-orange-600 font-medium mt-0.5">{roleLabel}</p>
              {variant !== "admin" && planLabel && planLabel !== "No plan" && (
                <p className="text-xs text-muted-foreground mt-0.5">{planLabel}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground touch-target"
              aria-label="Close menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="py-1.5">
            {menuItems.map(({ icon: Icon, label, href, locked, lockedHint }) =>
              locked ? (
                <div
                  key={label}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground cursor-not-allowed min-h-11"
                  title={lockedHint ?? "Upgrade your plan to unlock"}
                >
                  <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    {label}
                    {lockedHint && (
                      <span className="block text-[10px] text-amber-700 font-medium mt-0.5">{lockedHint}</span>
                    )}
                  </span>
                  <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                </div>
              ) : (
                <Link key={label} href={href}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground/90 hover:bg-muted transition-colors text-left min-h-11"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {label}
                  </button>
                </Link>
              ),
            )}
          </div>
          <div className="border-t border-border py-1.5">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left min-h-11"
              onClick={() => signOut({ redirectUrl: `${basePath}/` })}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
