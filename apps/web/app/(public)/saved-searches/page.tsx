"use client";

import Link from "next/link";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatNaira(value: bigint | number | null) {
  if (value == null) return null;
  return `₦${Number(value).toLocaleString("en-NG")}`;
}

export default function SavedSearchesPage() {
  const utils = trpc.useUtils();
  const { data: searches, isLoading, error } = trpc.savedSearches.list.useQuery();
  const setAlerts = trpc.savedSearches.setAlerts.useMutation({ onSuccess: () => utils.savedSearches.list.invalidate() });
  const remove = trpc.savedSearches.delete.useMutation({ onSuccess: () => utils.savedSearches.list.invalidate() });

  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] tracking-widest text-stone-500 font-mono mb-1">YOUR PROPERTY DISCOVERY</p>
          <h1 className="text-3xl font-semibold text-stone-900">Saved searches</h1>
          <p className="text-sm text-stone-500 mt-2">Manage alerts for properties that match your criteria.</p>
        </div>
        <Link href="/search" className="text-sm font-semibold text-emerald-800 underline">Find properties</Link>
      </div>

      {isLoading && <p className="text-sm text-stone-500">Loading saved searches…</p>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error.message.includes("Sign in") ? <>Please <Link className="font-semibold underline" href="/auth/login?next=%2Fsaved-searches">sign in</Link> to manage saved searches.</> : error.message}</div>}
      {searches && searches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <Bell size={24} className="mx-auto text-stone-400 mb-3" />
          <h2 className="font-semibold text-stone-800">No saved searches yet</h2>
          <p className="text-sm text-stone-500 mt-1 mb-4">Save a property search to receive an alert when a matching listing is approved and published.</p>
          <Link href="/search" className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Search properties</Link>
        </div>
      )}

      <div className="space-y-3">
        {searches?.map((search) => {
          const params = new URLSearchParams();
          if (search.query) params.set("query", search.query);
          if (search.minPriceNaira != null) params.set("minPrice", String(search.minPriceNaira));
          if (search.maxPriceNaira != null) params.set("maxPrice", String(search.maxPriceNaira));
          if (search.minBeds != null) params.set("minBeds", String(search.minBeds));
          if (search.minBathrooms != null) params.set("minBathrooms", String(search.minBathrooms));
          if (search.category) params.set("category", search.category);
          if (search.verifiedOnly) params.set("verifiedOnly", "true");
          const href = `${search.type === "SALE" ? "/buy" : search.type === "RENT" ? "/to-let" : search.type === "LAND" ? "/land" : "/search"}${params.toString() ? `?${params.toString()}` : ""}`;
          const priceRange = search.minPriceNaira != null && search.maxPriceNaira != null
            ? `${formatNaira(search.minPriceNaira)} – ${formatNaira(search.maxPriceNaira)}`
            : search.minPriceNaira != null ? `From ${formatNaira(search.minPriceNaira)}`
            : search.maxPriceNaira != null ? `Up to ${formatNaira(search.maxPriceNaira)}` : null;
          return (
            <article key={search.id} className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <Link href={href} className="font-semibold text-stone-900 hover:text-emerald-800">{search.name}</Link>
                <p className="text-xs text-stone-500 mt-1">
                  {[search.type === "SALE" ? "For sale" : search.type === "RENT" ? "To let" : search.type === "LAND" ? "Land" : "All properties", search.category?.toLowerCase(), search.query, priceRange, search.minBeds ? `${search.minBeds}+ beds` : null, search.minBathrooms ? `${search.minBathrooms}+ baths` : null, search.verifiedOnly ? "Verified realtors" : null].filter(Boolean).join(" · ")}
                </p>
                <p className="text-[11px] text-stone-400 mt-1">Created {new Date(search.createdAt).toLocaleDateString("en-NG")}{search.lastMatchedAt ? ` · Last match ${new Date(search.lastMatchedAt).toLocaleDateString("en-NG")}` : " · No matching publication yet"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setAlerts.mutate({ id: search.id, enabled: !search.alertEnabled })} disabled={setAlerts.isPending} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border ${search.alertEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-stone-200 text-stone-600"}`}>
                  {search.alertEnabled ? <Bell size={14} /> : <BellOff size={14} />}{search.alertEnabled ? "Alerts on" : "Alerts off"}
                </button>
                <button onClick={() => { if (window.confirm("Delete this saved search?")) remove.mutate({ id: search.id }); }} disabled={remove.isPending} aria-label={`Delete ${search.name}`} className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:text-red-700 hover:border-red-200">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {(setAlerts.error || remove.error) && <p role="alert" className="text-xs text-red-700 mt-4">{setAlerts.error?.message || remove.error?.message}</p>}
    </main>
  );
}
