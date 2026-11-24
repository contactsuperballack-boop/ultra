"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Real counts from listings.areaCounts. Areas with no LIVE listings are
// still shown (people search by district) but never with a made-up count.
const FEATURED = ["Maitama", "Asokoro", "Guzape", "Wuse 2", "Jabi", "Gwarinpa"];

export function ExploreByLocation() {
  const { data } = trpc.listings.areaCounts.useQuery();
  const counts = new Map((data ?? []).map((r) => [r.area.toLowerCase(), r.count]));

  return (
    <section>
      <h2 className="text-lg font-semibold text-stone-900 mb-3">Explore by location</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {FEATURED.map((area) => {
          const n = counts.get(area.toLowerCase()) ?? 0;
          return (
            <Link key={area} href={`/search?query=${encodeURIComponent(area)}`} className="rounded-2xl p-4 text-white bg-gradient-to-br from-emerald-800 to-emerald-900 hover:from-emerald-700 transition">
              <MapPin size={16} className="opacity-70 mb-6" />
              <div className="text-sm font-semibold">{area}</div>
              <div className="text-[11px] opacity-70">{n > 0 ? `${n} listing${n === 1 ? "" : "s"}` : "Browse area"}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
