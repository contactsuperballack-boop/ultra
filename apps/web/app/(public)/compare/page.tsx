"use client";

import Link from "next/link";
import { ArrowLeftRight, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCompare } from "@/components/CompareProvider";

function formatPrice(value: bigint | number, frequency?: string, type?: string) {
  const amount = Number(value);
  const formatted = amount >= 1_000_000 ? `₦${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M` : `₦${amount.toLocaleString("en-NG")}`;
  if (type !== "RENT") return formatted;
  return `${formatted} /${frequency === "PER_MONTH" ? "month" : "year"}`;
}

export default function ComparePage() {
  const compare = useCompare();
  const { data: listings, isLoading, error } = trpc.listings.compare.useQuery({ ids: compare.ids }, { enabled: compare.ids.length >= 2 });

  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] tracking-widest text-stone-500 font-mono mb-1">PROPERTY SHORTLIST</p>
          <h1 className="text-3xl font-semibold text-stone-900">Compare properties</h1>
          <p className="text-sm text-stone-500 mt-2">Compare the details side by side. Always confirm important information directly and complete independent due diligence.</p>
        </div>
        <button onClick={compare.clear} className="text-xs font-semibold text-stone-500 underline">Clear selection</button>
      </div>

      {compare.ids.length < 2 && <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center"><ArrowLeftRight size={24} className="mx-auto text-stone-400 mb-3"/><h2 className="font-semibold text-stone-800">Select at least two properties</h2><p className="text-sm text-stone-500 mt-1 mb-4">Return to property search and select up to four properties to compare.</p><Link href="/search" className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Browse properties</Link></div>}
      {isLoading && <p className="text-sm text-stone-500">Loading comparison…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error.message}</p>}
      {listings && listings.length < compare.ids.length && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">One or more selected properties are no longer publicly available and have been excluded.</p>}
      {listings && listings.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="w-40 bg-stone-50 p-4 text-xs font-semibold text-stone-500">Property</th>
                {listings.map((listing) => <th key={listing.id} className="p-4 align-top min-w-[220px] border-l border-stone-100">
                  <div className="flex items-start justify-between gap-2"><Link href={`/listings/${listing.id}`} className="font-semibold text-stone-900 hover:text-emerald-800">{listing.title}</Link><button onClick={() => compare.toggle(listing.id)} aria-label={`Remove ${listing.title} from comparison`} className="text-stone-400 hover:text-red-700"><X size={15}/></button></div>
                  <p className="text-xs text-stone-500 mt-1">{listing.area}, {listing.city}</p>
                  {listing.photos[0]?.url && <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- R2 may use a custom public host. */}
                    <img src={listing.photos[0].url} alt={listing.title} className="w-full h-28 object-cover rounded-lg mt-3" />
                  </>}
                  <p className="font-semibold text-emerald-900 mt-3">{formatPrice(listing.priceNaira, listing.priceFrequency, listing.type)}</p>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Transaction", (l: typeof listings[number]) => l.type === "SALE" ? "For sale" : l.type === "RENT" ? "To let" : "Land"],
                ["Property use", (l: typeof listings[number]) => l.category === "COMMERCIAL" ? "Commercial" : l.category === "RESIDENTIAL" ? "Residential" : "—"],
                ["Bedrooms", (l: typeof listings[number]) => l.bedrooms ?? "—"],
                ["Bathrooms", (l: typeof listings[number]) => l.bathrooms ?? "—"],
                ["Floor / land area", (l: typeof listings[number]) => `${l.sizeSqm.toLocaleString("en-NG")} m²`],
                ["Furnishing", (l: typeof listings[number]) => l.furnishing === "NOT_APPLICABLE" ? "—" : l.furnishing.replaceAll("_", " ").toLowerCase()],
                ["Realtor", (l: typeof listings[number]) => l.realtorProfile.agencyName],
                ["Realtor identity", (l: typeof listings[number]) => l.realtorProfile.verificationStatus === "VERIFIED" ? "Verified" : "Not verified"],
                ["Published", (l: typeof listings[number]) => l.publishedAt ? new Date(l.publishedAt).toLocaleDateString("en-NG") : "—"],
              ].map(([label, value]) => <tr key={String(label)} className="border-t border-stone-100"><th className="bg-stone-50 p-4 text-xs font-semibold text-stone-600">{String(label)}</th>{listings.map((listing) => <td key={listing.id} className="border-l border-stone-100 p-4 text-sm text-stone-700">{String((value as (listing: typeof listings[number]) => string | number)(listing))}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
