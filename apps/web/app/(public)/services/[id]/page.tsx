"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, Star } from "lucide-react";

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

export default function ProviderDetailPage({ params }: { params: { id: string } }) {
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const { data: provider, isLoading } = trpc.providers.byId.useQuery({ id: params.id });
  const request = trpc.serviceRequests.create.useMutation({ onSuccess: () => setSent(true) });

  if (isLoading) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Loading…</div>;
  if (!provider) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Provider not found.</div>;

  const selectedOffering = provider.offerings.find((o: any) => o.id === selectedOfferingId) ?? provider.offerings[0];

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-semibold text-xl flex-shrink-0">
          {provider.businessName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            {provider.businessName}
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white">
              <Check size={13} strokeWidth={3} />
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
            <Star size={13} className="text-amber-500" /> {provider.rating ?? "New"} · {provider.serviceArea}
          </div>
        </div>
      </div>

      {provider.bio && <p className="text-sm text-stone-600 leading-relaxed mb-6">{provider.bio}</p>}

      <div className="text-sm font-semibold text-stone-900 mb-3">Offerings</div>
      <div className="space-y-2 mb-6">
        {provider.offerings.map((o: any) => (
          <button
            key={o.id}
            onClick={() => {
              setSelectedOfferingId(o.id);
              setSent(false);
            }}
            className={`w-full text-left border rounded-xl p-4 ${
              (selectedOfferingId ?? provider.offerings[0]?.id) === o.id ? "border-teal-700 bg-teal-50" : "border-stone-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-semibold text-stone-900">{o.title}</div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">{CATEGORY_LABELS[o.category]}</span>
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {o.priceNaira ? formatNaira(o.priceNaira) : PRICE_TYPE_LABELS[o.priceType]}
                {o.priceType === "HOURLY" && o.priceNaira && <span className="text-xs text-stone-500 font-normal">/hr</span>}
              </div>
            </div>
            <p className="text-xs text-stone-600 mt-1.5">{o.description}</p>
          </button>
        ))}
      </div>

      {provider.offerings.length === 0 && (
        <div className="text-sm text-stone-500 text-center py-10 border border-dashed border-stone-300 rounded-xl mb-6">
          This provider hasn't added any offerings yet.
        </div>
      )}

      {provider.offerings.length > 0 && (
        <div>
          {sent ? (
            <div className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-xl p-4">
              Request sent — {provider.businessName} will respond in-app with a price and schedule.
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-stone-900 mb-2">Describe the job</div>
              <div className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 3-bedroom flat, need full interior repaint"
                  className="flex-1 border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
                />
                <button
                  disabled={request.isPending || note.trim().length < 10 || !selectedOffering}
                  onClick={() =>
                    request.mutate({
                      providerProfileId: provider.id,
                      offeringId: selectedOffering?.id,
                      category: selectedOffering?.category,
                      note,
                    })
                  }
                  className="bg-teal-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Request
                </button>
              </div>
            </>
          )}
          {request.error && (
            <div className="text-xs text-red-700 mt-2">
              {request.error.message === "Sign in required." ? "Sign in required to request a provider." : request.error.message}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
