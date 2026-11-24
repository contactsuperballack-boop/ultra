"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const naira = (n: number | null) => (n == null ? "" : `₦${Number(n).toLocaleString("en-NG")}`);

/** Up to three developments that currently have units available. Renders nothing when there are none. */
export function HomeDevelopments() {
  const { data } = trpc.developments.list.useQuery({ limit: 3 });
  if (!data || data.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-stone-900 mb-3">Developments</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {data.map((d) => (
          <Link key={d.id} href={`/developments/${d.id}`} className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:border-emerald-800 transition">
            <div className="h-32 bg-gradient-to-br from-emerald-800 to-emerald-900 relative">
              {d.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- see ListingCard.tsx: plain <img> is deliberate
                <img src={d.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <Building2 className="absolute inset-0 m-auto text-white/40" size={28} />
              )}
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-stone-900">{d.name}</div>
              <div className="text-xs text-stone-500">{d.area} · {d.summary.availableCount} unit{d.summary.availableCount === 1 ? "" : "s"} available</div>
              {d.summary.minPriceNaira != null && <div className="text-xs font-medium text-emerald-800 mt-1">From {naira(d.summary.minPriceNaira)}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
