import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const [location] = useLocation();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Search className="w-5 h-5 text-primary" />
          <span>Listing<span className="text-primary">Auditor</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location === l.href
                  ? "text-orange-600 bg-orange-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
        <Button size="sm" className="shadow-sm" asChild>
          <Link href="/sign-up">Get Started Free</Link>
        </Button>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-8 py-12">
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
              {[["Features", "/features"], ["Pricing", "/pricing"], ["Enterprise", "/enterprise"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm mb-3">Support</p>
            <ul className="space-y-2">
              {[["Help Center", "/help"], ["Contact", "/contact"], ["Sign In", "/sign-in"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm mb-3">Company</p>
            <ul className="space-y-2">
              {[["About", "/"], ["Blog", "/"], ["Privacy", "/"], ["Terms", "/"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} ListingAuditor. All rights reserved.</p>
          <p className="text-sm text-slate-400">Built for Amazon sellers worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
