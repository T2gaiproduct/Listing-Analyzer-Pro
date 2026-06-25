import { useState } from "react";
import {
  LayoutDashboard,
  FileSearch,
  CreditCard,
  BarChart3,
  Settings,
  HelpCircle,
  Bell,
  Users,
  ChevronRight,
  Zap,
  UserCircle,
  Receipt,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: FileSearch, label: "Audits", active: false, badge: "3" },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Users, label: "Competitors", active: false },
  { icon: Bell, label: "Notifications", active: false, badge: "5" },
  { icon: CreditCard, label: "Billing", active: false },
  { icon: Settings, label: "Settings", active: false },
  { icon: HelpCircle, label: "Help & Support", active: false },
];

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile", href: "/profile" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: HelpCircle, label: "Help & Support", href: "/help" },
];

export function CustomerSidebar() {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-slate-100 flex items-center justify-center p-8"
      onClick={() => setProfileOpen(false)}
    >
      {/* Sidebar */}
      <div
        className="relative flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-visible"
        style={{ width: 260, height: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo / Brand */}
        <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3 rounded-t-2xl overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">
            ListingAuditor
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, active, badge }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                active
                  ? "bg-orange-50 text-orange-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  active ? "text-orange-500" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="ml-auto text-[10px] font-semibold bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              )}
              {active && (
                <ChevronRight className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </nav>

        {/* Profile popup — anchored above the footer */}
        {profileOpen && (
          <div
            className="absolute left-3 right-3 bottom-[76px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
          >
            {/* Popup header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">
                TE
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">temp</p>
                <p className="text-xs text-slate-400 leading-tight">temp@example.com</p>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              {profileMenuItems.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Divider + Log out */}
            <div className="border-t border-slate-100 py-1.5">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Bottom Footer — Profile (left) + Upgrade (right) */}
        <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between gap-3 rounded-b-2xl">
          {/* My Profile — click to toggle popup */}
          <button
            className={`flex items-center gap-2.5 min-w-0 transition-opacity rounded-xl px-1 py-1 -mx-1 ${
              profileOpen ? "bg-slate-50" : "hover:bg-slate-50"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((prev) => !prev);
            }}
          >
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none ring-2 ring-transparent hover:ring-orange-200 transition-all">
              TE
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">
                temp
              </p>
              <p className="text-xs text-slate-400 leading-tight">Free</p>
            </div>
          </button>

          {/* Upgrade button */}
          <button className="flex-shrink-0 text-sm font-medium text-slate-700 border border-slate-300 rounded-full px-4 py-1.5 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
