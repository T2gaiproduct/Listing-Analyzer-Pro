import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Search, LayoutDashboard, Plus, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/audits/new", label: "New Audit", icon: Plus },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl z-10">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Search className="w-5 h-5 text-primary" />
            <span>Listing<span className="text-primary">Auditor</span></span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-4 px-2">Navigation</div>
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-primary/70 transition-colors")} />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors group">
            <Settings className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground" />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top decorative bar */}
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
