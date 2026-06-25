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

export function CustomerSidebar() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
      {/* Sidebar */}
      <div
        className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
        style={{ width: 260, height: 720 }}
      >
        {/* Logo / Brand */}
        <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
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

        {/* Bottom Footer — Profile (left) + Upgrade (right) */}
        <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* My Profile */}
          <button className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
            {/* Avatar circle with initials */}
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">
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
