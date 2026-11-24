"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ListingCard } from "@/components/ListingCard";
import { ListingGridSkeleton } from "@/components/ListingCardSkeleton";

export function LatestVerified() {
  const { data, isLoading } = trpc.listings.search.useQuery({ verifiedOnly: true, limit: 6 });
  const { data: savedIds } = trpc.savedListings.ids.useQuery();

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-lg font-semibold text-stone-900">Latest verified listings</h2>
        <Link href="/search" className="text-sm font-medium text-emerald-800">View all</Link>
      </div>
      {isLoading && <ListingGridSkeleton count={3} />}
      {data && data.items.length === 0 && <div className="text-sm text-stone-500">New verified listings will appear here.</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.items.map((l) => (
          <ListingCard key={l.id} listing={l as any} savedIds={savedIds} />
        ))}
      </div>
    </section>
  );
}
