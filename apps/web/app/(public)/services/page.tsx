"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Check, Sparkles, Star } from "lucide-react";

const CATEGORIES = [
  { value: "PAINTING", label: "Painting" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "FUMIGATION", label: "Fumigation" },
  { value: "ELECTRICAL", label: "Electrical" },
] as const;

function VerifiedSeal() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white flex-shrink-0">
      <Check size={10} strokeWidth={3} />
    </span>
  );
}

export default function ServicesSearchPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"] | undefined>(undefined);

  const { data, isLoading, error } = trpc.providers.search.useQuery({ category, limit: 20 });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="text-xs tracking-widest text-stone-500 font-mono mb-1">ABUJA, NIGERIA</div>
        <h1 className="text-3xl font-semibold text-stone-900">Find a verified home service provider</h1>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setCategory(undefined)}
          className={`px-4 py-2 rounded-full text-sm font-medium border ${
            !category ? "bg-teal-800 text-white border-teal-800" : "border-stone-300 text-stone-700"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              category === c.value ? "bg-teal-800 text-white border-teal-800" : "border-stone-300 text-stone-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-stone-500 text-sm">Loading providers…</div>}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          Couldn't load providers: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.items.map((provider) => {
          const isPremium = provider.subscriptionTier === "PREMIUM" && provider.subscriptionExpiresAt && new Date(provider.subscriptionExpiresAt) > new Date();
          return (
            <Link
              key={provider.id}
              href={`/services/${provider.id}`}
              className="block border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-semibold text-sm">
                  {provider.businessName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                {isPremium && (
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    <Sparkles size={10} /> PREMIUM
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-stone-900 flex items-center gap-1">
                {provider.businessName}
                <VerifiedSeal />
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {provider.offerings.map((o: any) => o.category).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ")}
              </div>
              <div className="flex items-center gap-1 text-xs text-stone-500 mt-2 font-mono">
                <Star size={11} className="text-amber-500" /> {provider.rating ?? "New"}
              </div>
            </Link>
          );
        })}
      </div>

      {data && data.items.length === 0 && (
        <div className="text-center text-stone-500 text-sm mt-16">No providers match these filters yet.</div>
      )}
    </main>
  );
}
