import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Facebook, Twitter, Linkedin, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/hooks/use-branding";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/tutorials", label: "Tutorials" },
  { href: "/ads", label: "Manage Ads" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-10 py-3 sm:py-3.5 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm gap-2 sm:gap-4 min-w-0">
      <div className="flex items-center gap-3 sm:gap-6 lg:gap-10 min-w-0 flex-1">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 font-bold text-base sm:text-lg tracking-tight flex-shrink-0 text-slate-900 min-w-0">
          <SiteLogo nameClassName="text-base sm:text-lg" />
        </Link>
        <nav className="hidden lg:flex items-center gap-0.5">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === l.href
                  ? "text-orange-600"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-600 hover:text-slate-900" asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm px-3 sm:px-4 text-xs sm:text-sm" asChild>
          <Link href="/sign-up">
            <span className="sm:hidden">Start Free</span>
            <span className="hidden sm:inline">Get Started Free</span>
          </Link>
        </Button>
        <button
          type="button"
          className="lg:hidden touch-target flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 p-2"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[min(100vw-3rem,20rem)] p-0 flex flex-col lg:hidden">
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <div className="flex items-center gap-2.5 px-4 py-4 pr-12 border-b border-slate-200">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg min-w-0" onClick={() => setMobileOpen(false)}>
              <SiteLogo />
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
                    location === l.href ? "bg-orange-50 text-orange-600" : "text-slate-700 hover:bg-slate-100",
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
            <Button className="w-full min-h-11 bg-orange-500 hover:bg-orange-600" asChild>
              <Link href="/sign-up" onClick={() => setMobileOpen(false)}>Get Started Free</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="flex flex-col gap-2.5 w-full sm:flex-row sm:max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setDone(true);
        setEmail("");
        setTimeout(() => setDone(false), 4000);
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="w-full h-11 sm:h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-0"
      />
      <Button type="submit" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 h-11 sm:h-10 px-5 shrink-0">
        {done ? "Subscribed!" : "Subscribe"}
      </Button>
    </form>
  );
}

const footerColumns = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["Pricing", "/pricing"],
      ["Integrations", "/enterprise"],
      ["Manage Ads", "/ads"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About Us", "/about"],
      ["Careers", "/about"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Blog", "/blog"],
      ["Tutorials", "/tutorials"],
      ["Help Center", "/help"],
      ["API Docs", "/help"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms of Service", "/terms"],
      ["Refund Policy", "/terms"],
    ],
  },
];

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
];

export function PublicFooter() {
  const { platformName } = useBranding();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0B0E11] text-slate-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16 min-w-0">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-8 sm:gap-10 mb-10 sm:mb-12 min-w-0">
          <div className="col-span-2 lg:col-span-2 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-bold text-lg text-white mb-4 max-w-full flex-nowrap min-w-0"
            >
              <SiteLogo nameClassName="text-white text-base sm:text-lg" />
            </Link>
            <p className="text-sm leading-relaxed mb-5 max-w-xs">
              AI-powered listing optimization for sellers who want to rank higher and convert better.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors shrink-0"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title} className="min-w-0">
              <p className="font-semibold text-white text-sm mb-3 sm:mb-4">{col.title}</p>
              <ul className="space-y-2 sm:space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm hover:text-white transition-colors break-words">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 lg:col-span-1 min-w-0">
            <p className="font-semibold text-white text-sm mb-2">Stay updated</p>
            <p className="text-xs mb-4 leading-relaxed">Get tips and product updates in your inbox.</p>
            <FooterNewsletter />
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 pb-20 sm:pb-0">
          <p className="text-xs sm:text-sm text-slate-500 text-center sm:text-left leading-relaxed max-w-full break-words pr-0 sm:pr-0">
            <span className="block sm:inline">© {year} {platformName}.</span>{" "}
            <span className="block sm:inline">All rights reserved.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
