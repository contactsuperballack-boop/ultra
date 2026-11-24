"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { session } from "@/lib/session";
import { HOME_SERVICES_ENABLED } from "@/lib/featureFlags";

// The five top-level categories. Services is ALWAYS present: when the
// Phase 2 freeze is on, /services itself renders the "coming soon" page
// (app/(public)/services/layout.tsx is the enforcement), so showing the
// tab never exposes the pilot — it just stops the category from vanishing.
export const MAIN_NAV = [
  { href: "/buy", label: "Buy" },
  { href: "/to-let", label: "To Let" },
  { href: "/land", label: "Land" },
  { href: "/mortgage", label: "Mortgage" },
  { href: "/services", label: "Services" },
] as const;

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Come back to the page they were on after signing in.
  const signInHref = pathname && !pathname.startsWith("/auth") ? `/auth/login?next=${encodeURIComponent(pathname)}` : "/auth/login";

  useEffect(() => {
    setSignedIn(!!session.accessToken);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => pathname === href || pathname?.startsWith(href + "/");
  const linkCls = (href: string) =>
    `text-sm font-medium transition-colors ${active(href) ? "text-emerald-800" : "text-stone-600 hover:text-emerald-800"}`;

  const accountLinks = signedIn
    ? [
        { href: "/messages", label: "Messages" },
        ...(HOME_SERVICES_ENABLED ? [{ href: "/bookings", label: "Bookings" }] : []),
        { href: "/notifications", label: "Notifications" },
        { href: "/support", label: "Help & Support" },
        { href: "/support", label: "Help & Support" },
        { href: "/account", label: "Account" },
        { href: "/saved-searches", label: "Saved searches" },
        { href: "/saved-properties", label: "Saved properties" },
        { href: "/my-inspections", label: "My inspections" },
        { href: "/dashboard/listings", label: "Realtor dashboard" },
        ...(HOME_SERVICES_ENABLED ? [{ href: "/partner/dashboard", label: "Partner dashboard" }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="text-xl font-semibold tracking-[0.28em] text-emerald-900" aria-label="ULTRA home">
          ULTRA
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Main">
          {MAIN_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.href)}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {signedIn ? (
            accountLinks.slice(0, 4).map((l) => (
              <Link key={l.href} href={l.href} className={linkCls(l.href)}>
                {l.label}
              </Link>
            ))
          ) : (
            <>
              <Link href={signInHref} className="text-sm font-medium text-stone-600 hover:text-emerald-800">
                Sign in
              </Link>
              <Link href="/dashboard/verification" className="text-sm font-semibold bg-emerald-800 text-white rounded-lg px-4 py-2 hover:bg-emerald-700">
                List with us
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2 -mr-2 text-stone-700" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-stone-200 bg-white px-5 py-4 flex flex-col gap-1">
          {MAIN_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`py-2.5 ${linkCls(n.href)}`}>
              {n.label}
            </Link>
          ))}
          <div className="h-px bg-stone-200 my-2" />
          {signedIn ? (
            accountLinks.map((l) => (
              <Link key={l.href} href={l.href} className="py-2.5 text-sm text-stone-600">
                {l.label}
              </Link>
            ))
          ) : (
            <>
              <Link href={signInHref} className="py-2.5 text-sm text-stone-600">Sign in</Link>
              <Link href="/dashboard/verification" className="py-2.5 text-sm font-semibold text-emerald-800">List with us</Link>
              {HOME_SERVICES_ENABLED && <Link href="/partner/verification" className="py-2.5 text-sm font-semibold text-teal-800">Offer services</Link>}
            </>
          )}
        </div>
      )}
    </header>
  );
}
