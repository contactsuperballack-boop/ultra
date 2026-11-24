import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/support";
import { MORTGAGE_ENABLED } from "@/lib/featureFlags";

// Services lives in the header nav, not here. Support channels only render
// when configured (see lib/support.ts).

const EXPLORE = [
  { href: "/buy", label: "Buy" },
  { href: "/to-let", label: "To Let" },
  { href: "/land", label: "Land" },
  ...(MORTGAGE_ENABLED ? [{ href: "/mortgage", label: "Mortgage calculator" }] : []),
];

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 mt-16 bg-white">
      <div className="max-w-6xl mx-auto px-5 py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <div className="text-lg font-semibold tracking-[0.28em] text-emerald-900">ULTRA</div>
          <p className="text-stone-500 mt-2 max-w-xs">The trusted property marketplace for Abuja.</p>
        </div>
        <nav aria-label="Explore" className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-stone-900 mb-1">Explore</div>
          {EXPLORE.map((l) => (
            <Link key={l.href} href={l.href} className="text-stone-500 hover:text-emerald-800">{l.label}</Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-stone-900 mb-1">Help & legal</div>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-stone-500 hover:text-emerald-800">{SUPPORT_EMAIL}</a>
          )}
          {SUPPORT_WHATSAPP && (
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-stone-500 hover:text-emerald-800">WhatsApp support</a>
          )}
          <Link href="/privacy" className="text-stone-500 hover:text-emerald-800">Privacy Policy</Link>
          <Link href="/terms" className="text-stone-500 hover:text-emerald-800">Terms of Service</Link>
        </div>
      </div>
      <div className="border-t border-stone-100 text-center text-xs text-stone-500 py-4">© {new Date().getFullYear()} ULTRA</div>
    </footer>
  );
}
