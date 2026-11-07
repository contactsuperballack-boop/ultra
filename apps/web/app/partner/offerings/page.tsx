"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Pause, Play } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  PAINTING: "Painting",
  PLUMBING: "Plumbing",
  FUMIGATION: "Fumigation",
  ELECTRICAL: "Electrical",
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed price",
  HOURLY: "Per hour",
  QUOTE: "Quote on request",
};

function formatNaira(n: bigint | number | null) {
  if (n === null || n === undefined) return "—";
  return `\u20a6${Number(n).toLocaleString()}`;
}

export default function PartnerOfferingsPage() {
  const { data: profile } = trpc.providers.myProfile.useQuery();
  const { data: offerings, isLoading, refetch } = trpc.providers.myOfferings.useQuery(undefined, {
    enabled: profile?.verificationStatus === "VERIFIED",
  });
  const create = trpc.providers.createOffering.useMutation({
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setTitle("");
      setDescription("");
      setPriceNaira("");
    },
  });
  const toggleActive = trpc.providers.setOfferingActive.useMutation({ onSuccess: () => refetch() });

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<"FIXED" | "HOURLY" | "QUOTE">("FIXED");
  const [priceNaira, setPriceNaira] = useState("");

  const availableCategories = profile?.categories ?? [];

  if (profile && profile.verificationStatus !== "VERIFIED") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Verification required</h1>
        <p className="text-sm text-stone-600 mb-6">You'll be able to add offerings once your provider account is verified.</p>
        <a href="/partner/verification" className="text-sm font-semibold text-teal-800 underline">
          Go to verification
        </a>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-stone-900">Your offerings</h1>
        <button
          onClick={() => {
            setShowForm((s) => !s);
            if (!category && availableCategories.length > 0) setCategory(availableCategories[0]);
          }}
          className="flex items-center gap-1.5 text-sm font-semibold text-teal-800"
        >
          <Plus size={15} /> Add offering
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-8">What you offer, and how you price it. Customers see these on your public profile.</p>

      {showForm && (
        <div className="border border-stone-200 rounded-xl p-5 mb-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none">
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Standard 3-bedroom interior painting"
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's included, materials, typical turnaround."
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Pricing</label>
            <div className="flex gap-2 mb-2">
              {(["FIXED", "HOURLY", "QUOTE"] as const).map((pt) => (
                <button
                  key={pt}
                  onClick={() => setPriceType(pt)}
                  className={`flex-1 border rounded-lg py-2 text-xs font-semibold ${
                    priceType === pt ? "border-teal-700 bg-teal-50 text-teal-900" : "border-stone-300 text-stone-600"
                  }`}
                >
                  {PRICE_TYPE_LABELS[pt]}
                </button>
              ))}
            </div>
            {priceType !== "QUOTE" && (
              <input
                type="number"
                value={priceNaira}
                onChange={(e) => setPriceNaira(e.target.value)}
                placeholder={priceType === "HOURLY" ? "Rate per hour (\u20a6)" : "Price (\u20a6)"}
                className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            )}
          </div>

          {create.error && <p className="text-xs text-red-700">{create.error.message}</p>}

          <button
            onClick={() =>
              create.mutate({
                category: category as any,
                title,
                description,
                priceType,
                priceNaira: priceType === "QUOTE" ? undefined : Number(priceNaira),
              })
            }
            disabled={create.isPending || !category || title.length < 3 || description.length < 10 || (priceType !== "QUOTE" && !priceNaira)}
            className="w-full bg-teal-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {create.isPending && <Loader2 size={15} className="animate-spin" />}
            {create.isPending ? "Adding…" : "Add offering"}
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {offerings?.length === 0 && !showForm && (
        <div className="text-sm text-stone-500 text-center py-10 border border-dashed border-stone-300 rounded-xl">
          No offerings yet. Add one so customers can find and book you.
        </div>
      )}

      <div className="space-y-2">
        {offerings?.map((o) => (
          <div key={o.id} className="flex items-center justify-between border border-stone-200 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">{CATEGORY_LABELS[o.category]}</span>
                {!o.active && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">PAUSED</span>}
              </div>
              <div className="text-sm text-stone-900 mt-1">{o.title}</div>
              <div className="text-xs text-stone-500">{PRICE_TYPE_LABELS[o.priceType]}{o.priceNaira ? ` · ${formatNaira(o.priceNaira)}` : ""}</div>
            </div>
            <button
              onClick={() => toggleActive.mutate({ id: o.id, active: !o.active })}
              className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 border border-stone-300 rounded-lg px-3 py-1.5"
            >
              {o.active ? (
                <>
                  <Pause size={12} /> Pause
                </>
              ) : (
                <>
                  <Play size={12} /> Resume
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {offerings && offerings.length > 0 && (
        <a href="/partner/dashboard" className="block text-center text-sm font-semibold text-teal-800 underline pt-8">
          Go to dashboard →
        </a>
      )}
    </main>
  );
}
