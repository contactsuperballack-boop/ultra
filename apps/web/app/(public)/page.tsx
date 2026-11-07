"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search as SearchIcon } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";

// Readiness §4A — the first screen should answer, immediately: where can I
// search, what can I buy/rent, how much does it cost, can I trust the
// listing. Every control below maps to one of those four questions rather
// than being a generic filter panel.

export default function SearchPage() {
  const [type, setType] = useState<"SALE" | "RENT" | "LAND" | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = trpc.listings.search.useQuery({
    type,
    query: query || undefined,
    minPriceNaira: minPrice ? Number(minPrice) : undefined,
    maxPriceNaira: maxPrice ? Number(maxPrice) : undefined,
    minBeds,
    verifiedOnly,
    limit: 20,
  });
  const { data: savedIds } = trpc.savedListings.ids.useQuery();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <div className="text-xs tracking-widest text-stone-500 font-mono mb-1">ABUJA, NIGERIA</div>
        <h1 className="text-3xl font-semibold text-stone-900">Find a verified home</h1>
      </div>

      <div className="relative mb-4">
        <SearchIcon size={16} className="absolute left-4 top-3.5 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by area, e.g. Maitama, Wuse, Gwarinpa…"
          className="w-full border border-stone-300 rounded-xl pl-11 pr-4 py-3 text-sm outline-none"
        />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {(["All", "SALE", "RENT", "LAND"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t === "All" ? undefined : t)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              (type ?? "All") === t ? "bg-emerald-800 text-white border-emerald-800" : "border-stone-300 text-stone-700"
            }`}
          >
            {t === "All" ? "All" : t === "SALE" ? "For Sale" : t === "RENT" ? "For Rent" : "Land"}
          </button>
        ))}
        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`px-4 py-2 rounded-full text-sm font-medium border ${
            verifiedOnly ? "bg-emerald-800 text-white border-emerald-800" : "border-stone-300 text-stone-700"
          }`}
        >
          Verified only
        </button>
        <button onClick={() => setShowFilters((s) => !s)} className="px-4 py-2 rounded-full text-sm font-medium border border-stone-300 text-stone-700">
          {showFilters ? "Hide filters" : "Price & bedrooms"}
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-3 mb-6 flex-wrap items-end bg-stone-50 border border-stone-200 rounded-xl p-4">
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Min price (\u20a6)</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="No min"
              className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Max price (\u20a6)</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="No max"
              className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Min bedrooms</label>
            <select
              value={minBeds ?? ""}
              onChange={(e) => setMinBeds(e.target.value ? Number(e.target.value) : undefined)}
              className="w-28 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
          {(minPrice || maxPrice || minBeds) && (
            <button
              onClick={() => {
                setMinPrice("");
                setMaxPrice("");
                setMinBeds(undefined);
              }}
              className="text-xs text-stone-500 underline pb-2"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading && <div className="text-stone-500 text-sm">Loading listings…</div>}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          Couldn't load listings: {error.message}. (Expected until DATABASE_URL is configured and the DB is seeded — see README.)
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.items.map((listing) => (
          <ListingCard key={listing.id} listing={listing as any} savedIds={savedIds} />
        ))}
      </div>

      {data && data.items.length === 0 && (
        <div className="text-center text-stone-500 text-sm mt-16">No listings match these filters yet.</div>
      )}
    </main>
  );
}
