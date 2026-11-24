import Link from "next/link";
import { Home, Key, Trees, Landmark, Wrench } from "lucide-react";
import { MORTGAGE_ENABLED } from "@/lib/featureFlags";

const TILES = [
  { href: "/buy", label: "Buy", sub: "Homes for sale", icon: Home },
  { href: "/to-let", label: "To Let", sub: "Rentals", icon: Key },
  { href: "/land", label: "Land", sub: "Plots", icon: Trees },
  { href: "/mortgage", label: "Mortgage", sub: MORTGAGE_ENABLED ? "Estimate repayments" : "Coming soon", icon: Landmark },
  { href: "/services", label: "Services", sub: "Home services", icon: Wrench },
];

export function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {TILES.map((t) => (
        <Link key={t.href} href={t.href} className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col items-start gap-3 hover:border-emerald-800 hover:shadow-sm transition">
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <t.icon size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-stone-900">{t.label}</span>
            <span className="block text-xs text-stone-500">{t.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
