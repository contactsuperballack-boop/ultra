"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Search as SearchIcon } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { ListingGridSkeleton } from "@/components/ListingCardSkeleton";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
// Deep import: pure rules (category-aware price ranges, sort, which filters apply), no Prisma in the browser bundle.
import { PRICE_RANGES, filterApplies, sortOptionsFor, type SortOption } from "@ultra/db/src/searchFilters";

type ListingType = "SALE" | "RENT" | "LAND";

export function ListingsBrowser({ type, heading, eyebrow = "ABUJA, NIGERIA" }: { type?: ListingType; heading: string; eyebrow?: string }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("query") ?? "");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");
  const [minBeds, setMinBeds] = useState<number | undefined>(params.get("minBeds") ? Number(params.get("minBeds")) : undefined);
  const [minBathrooms, setMinBathrooms] = useState<number | undefined>(params.get("minBathrooms") ? Number(params.get("minBathrooms")) : undefined);
  const [category, setCategory] = useState<"RESIDENTIAL" | "COMMERCIAL" | undefined>((params.get("category") || undefined) as "RESIDENTIAL" | "COMMERCIAL" | undefined);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");
  const [verifiedOnly, setVerifiedOnly] = useState(params.get("verifiedOnly") === "true");
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [searchName, setSearchName] = useState("My Abuja property search");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Wait for a pause in typing before searching: one request per word, not per keystroke.
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  // Keep the address bar in step with the search so a result page can be shared or reloaded. (No navigation: replaceState only.)
  useEffect(() => {
    const url = new URL(window.location.href);
    const values: Record<string, string | undefined> = {
      query: debouncedQuery || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minBeds: minBeds === undefined ? undefined : String(minBeds),
      minBathrooms: minBathrooms === undefined ? undefined : String(minBathrooms),
      category,
      verifiedOnly: verifiedOnly ? "true" : undefined,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }, [debouncedQuery, minPrice, maxPrice, minBeds, minBathrooms, category, verifiedOnly]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, refetch } = trpc.listings.search.useInfiniteQuery(
    {
    type,
    query: debouncedQuery || undefined,
    minPriceNaira: minPrice ? Number(minPrice) : undefined,
    maxPriceNaira: maxPrice ? Number(maxPrice) : undefined,
    minBeds,
    minBathrooms,
    category: type === "LAND" ? undefined : category,
    verifiedOnly,
    sortBy,
    limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // While a new search loads, keep showing the previous results instead of flashing empty.
      placeholderData: (previous) => previous,
    }
  );
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const { data: savedIds } = trpc.savedListings.ids.useQuery();
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const saveSearch = trpc.savedSearches.create.useMutation({
    onSuccess: () => {
      setSaveMessage("Search saved. We'll notify you when a matching property is published.");
      setShowSaveSearch(false);
      utils.savedSearches.list.invalidate();
    },
    onError: (err) => setSaveMessage(err.message),
  });

  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <div className="mb-6">
        <div className="text-xs tracking-widest text-stone-500 font-mono mb-1">{eyebrow}</div>
        <h1 className="text-3xl font-semibold text-stone-900">{heading}</h1>
      </div>

      <div className="relative mb-4">
        <SearchIcon size={16} className="absolute left-4 top-3.5 text-stone-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by location, estate, or keyword"
          className="w-full bg-white border border-stone-300 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-emerald-800"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${verifiedOnly ? "bg-emerald-800 text-white border-emerald-800" : "bg-white border-stone-300 text-stone-700"}`}
          >
            Verified only
          </button>
          {sortOptionsFor(type).length > 1 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort listings"
              className="px-4 py-2 rounded-full text-sm font-medium border border-stone-300 bg-white text-stone-700 outline-none"
            >
              {sortOptionsFor(type).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowFilters((s) => !s)} className="px-4 py-2 rounded-full text-sm font-medium border border-stone-300 bg-white text-stone-700">
            {showFilters ? "Hide filters" : "More filters"}
          </button>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => { setShowSaveSearch((v) => !v); setSaveMessage(null); }} className="px-4 py-2 rounded-full text-sm font-semibold border border-emerald-800 text-emerald-800 bg-white">
            Save search alert
          </button>
          <a href="/saved-searches" className="text-xs text-stone-500 underline">Manage alerts</a>
        </div>
      </div>

      {showSaveSearch && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="font-semibold text-sm text-emerald-950 mb-1">Get notified about matching properties</div>
          <p className="text-xs text-emerald-900 mb-3">Alerts are created only after a listing passes ULTRA's review and is published.</p>
          {me ? (
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(event) => {
              event.preventDefault();
              saveSearch.mutate({
                name: searchName.trim(), type, category: type === "LAND" ? undefined : category,
                query: debouncedQuery || undefined,
                minPriceNaira: minPrice ? Number(minPrice) : undefined,
                maxPriceNaira: maxPrice ? Number(maxPrice) : undefined,
                minBeds, minBathrooms, verifiedOnly,
              });
            }}>
              <input value={searchName} onChange={(event) => setSearchName(event.target.value)} maxLength={50} required minLength={2} aria-label="Saved search name" className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" />
              <button disabled={saveSearch.isPending} className="rounded-lg bg-emerald-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{saveSearch.isPending ? "Saving…" : "Save alert"}</button>
            </form>
          ) : (
            <p className="text-sm text-emerald-950"><a className="font-semibold underline" href={`/auth/login?next=${encodeURIComponent(typeof window === "undefined" ? "/search" : window.location.pathname + window.location.search)}`}>Sign in</a> to save this search.</p>
          )}
          {saveMessage && <p role="status" className="text-xs text-emerald-950 mt-2">{saveMessage}</p>}
        </div>
      )}

      {saveMessage && !showSaveSearch && <p role="status" className="text-xs text-emerald-800 mb-4">{saveMessage}</p>}

      {showFilters && (
        <div className="flex gap-3 mb-6 flex-wrap items-end bg-white border border-stone-200 rounded-xl p-4">
          {type && (
            <div className="w-full">
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Price range</label>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGES[type].map((r) => {
                  const on = rangeLabel === r.label;
                  return (
                    <button
                      key={r.label}
                      onClick={() => {
                        setRangeLabel(on ? null : r.label);
                        setMinPrice(on || r.minNaira === undefined ? "" : String(r.minNaira));
                        setMaxPrice(on || r.maxNaira === undefined ? "" : String(r.maxNaira));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${on ? "bg-emerald-800 text-white border-emerald-800" : "bg-white border-stone-300 text-stone-600"}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Min price (₦)</label>
            <input type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setRangeLabel(null); }} placeholder="No min" className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Max price (₦)</label>
            <input type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setRangeLabel(null); }} placeholder="No max" className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          {filterApplies(type, "bedrooms") && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Min bedrooms</label>
              <select value={minBeds ?? ""} onChange={(e) => setMinBeds(e.target.value ? Number(e.target.value) : undefined)} className="w-28 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}+</option>
                ))}
              </select>
            </div>
          )}
          {filterApplies(type, "bedrooms") && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Min bathrooms</label>
              <select value={minBathrooms ?? ""} onChange={(e) => setMinBathrooms(e.target.value ? Number(e.target.value) : undefined)} className="w-28 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
              </select>
            </div>
          )}
          {filterApplies(type, "category") && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Property use</label>
              <select value={category ?? ""} onChange={(e) => setCategory((e.target.value || undefined) as typeof category)} className="w-36 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Any</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
          )}
          {(minPrice || maxPrice || minBeds || minBathrooms || category) && (
            <button onClick={() => { setMinPrice(""); setMaxPrice(""); setRangeLabel(null); setMinBeds(undefined); setMinBathrooms(undefined); setCategory(undefined); }} className="text-xs text-stone-500 underline pb-2">
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading && <ListingGridSkeleton />}
      {error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-3">
          <span>We couldn't load listings right now.</span>
          <button onClick={() => refetch()} className="font-semibold underline whitespace-nowrap">Try again</button>
        </div>
      )}

      {data && (
        <div aria-live="polite" className="text-xs text-stone-500 mb-3">
          {items.length}{hasNextPage ? "+" : ""} result{items.length === 1 && !hasNextPage ? "" : "s"}
          {isFetching && !isFetchingNextPage ? " · updating…" : ""}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((listing) => (
          <ListingCard key={listing.id} listing={listing as any} savedIds={savedIds} />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-3 rounded-xl border border-emerald-800 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60"
          >
            {isFetchingNextPage ? "Loading…" : "Show more homes"}
          </button>
        </div>
      )}

      {data && !isLoading && items.length === 0 && (
        <div className="text-center mt-16">
          <p className="text-stone-700 text-sm font-medium">No listings match yet.</p>
          <p className="text-stone-500 text-xs mt-1">Try a different area or clear some filters.</p>
          {(query || minPrice || maxPrice || minBeds || minBathrooms || category || verifiedOnly) && (
            <button
              onClick={() => { setQuery(""); setMinPrice(""); setMaxPrice(""); setRangeLabel(null); setMinBeds(undefined); setMinBathrooms(undefined); setCategory(undefined); setVerifiedOnly(false); }}
              className="mt-4 text-sm font-semibold text-emerald-800 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </main>
  );
}
