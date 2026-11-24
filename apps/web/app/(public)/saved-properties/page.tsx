"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ListingCard } from "@/components/ListingCard";

export default function SavedPropertiesPage() {
  const { data: listings, isLoading, error } = trpc.savedListings.list.useQuery();
  const { data: savedIds } = trpc.savedListings.ids.useQuery();

  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] tracking-widest text-stone-500 font-mono mb-1">YOUR PROPERTY SHORTLIST</p>
          <h1 className="text-3xl font-semibold text-stone-900">Saved properties</h1>
          <p className="text-sm text-stone-500 mt-2">Keep the properties you want to revisit in one place.</p>
        </div>
        <Link href="/search" className="text-sm font-semibold text-emerald-800 underline">Explore properties</Link>
      </div>
      {isLoading && <p className="text-sm text-stone-500">Loading saved properties…</p>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error.message.includes("Sign in") ? <>Please <Link className="font-semibold underline" href="/auth/login?next=%2Fsaved-properties">sign in</Link> to view your saved properties.</> : error.message}</div>}
      {listings && listings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <Heart size={24} className="mx-auto text-stone-400 mb-3" />
          <h2 className="font-semibold text-stone-800">Your shortlist is empty</h2>
          <p className="text-sm text-stone-500 mt-1 mb-4">Tap the heart on a property to save it here.</p>
          <Link href="/buy" className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Browse properties</Link>
        </div>
      )}
      {listings && listings.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{listings.map((listing) => <ListingCard key={listing.id} listing={listing as any} savedIds={savedIds} />)}</div>}
    </main>
  );
}
