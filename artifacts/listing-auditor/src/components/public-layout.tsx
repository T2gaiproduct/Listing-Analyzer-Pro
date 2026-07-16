import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/tutorials", label: "Tutorials" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm gap-4">
      <div className="flex items-center gap-3 sm:gap-8 min-w-0">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight flex-shrink-0">
          <Search className="w-5 h-5 text-primary" />
          <span className="truncate">Listing<span className="text-primary">Auditor</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-11 flex items-center",
                location === l.href
                  ? "text-orange-600 bg-orange-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex min-h-11" asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
        <Button
          size="sm"
          className="shadow-sm h-9 min-h-0 px-2.5 py-0 text-xs font-semibold sm:min-h-9 sm:px-3 sm:text-sm"
          asChild
        >
          <Link href="/sign-up">
            <span className="sm:hidden">Get Started</span>
            <span className="hidden sm:inline">Get Started Free</span>
          </Link>
        </Button>
        <button
          type="button"
          className="md:hidden touch-target flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[min(100vw-3rem,20rem)] p-0 flex flex-col md:hidden">
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <div className="flex items-center px-4 py-4 pr-12 border-b border-slate-200">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg tracking-tight"
              onClick={() => setMobileOpen(false)}
            >
              <Search className="w-5 h-5 text-primary" />
              <span>Listing<span className="text-primary">Auditor</span></span>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href}>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl text-sm font-medium min-h-11 transition-colors",
                    location === l.href
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {l.label}
                </button>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200 space-y-2">
            <Button variant="outline" className="w-full min-h-11" asChild>
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}>Sign In</Link>
            </Button>
            <Button className="w-full min-h-11" asChild>
              <Link href="/sign-up" onClick={() => setMobileOpen(false)}>Get Started Free</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
              <Search className="w-4 h-4 text-primary" />
              <span>Listing<span className="text-primary">Auditor</span></span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              AI-powered Amazon listing optimization for sellers who want to rank higher and convert better.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm mb-3">Product</p>
            <ul className="space-y-2">
              {[["Features", "/features"], ["Pricing", "/pricing"], ["Enterprise", "/enterprise"], ["Blog", "/blog"], ["Tutorials", "/tutorials"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm mb-3">Support</p>
            <ul className="space-y-2">
              {[["Help Center", "/help"], ["Contact", "/contact"], ["Sign In", "/sign-in"], ["Sign Up", "/sign-up"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm mb-3">Company</p>
            <ul className="space-y-2">
              {[["About", "/about"], ["Blog", "/blog"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} ListingAuditor. All rights reserved.</p>
          <p className="text-sm text-slate-400">Built for Amazon sellers worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
