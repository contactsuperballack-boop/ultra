"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Check } from "lucide-react";

export default function SubscriptionPage() {
  const { data: status, isLoading, error } = trpc.realtors.subscriptionStatus.useQuery();
  const [email, setEmail] = useState("");
  const initiate = trpc.realtors.initiateSubscription.useMutation({
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Subscription</h1>
      <p className="text-sm text-stone-500 mb-8">Premium listings rank above standard ones in buyer search results.</p>

      {isLoading && <div className="text-sm text-stone-500">Loading\u2026</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Verified") ? "Requires a verified realtor account." : error.message}
        </div>
      )}

      {status && (
        <div className={`rounded-xl p-5 mb-6 border ${status.isActive ? "bg-emerald-50 border-emerald-200" : "bg-stone-50 border-stone-200"}`}>
          <div className="flex items-center gap-2 mb-1">
            {status.isActive && <Sparkles size={16} className="text-emerald-800" />}
            <span className="text-sm font-semibold text-stone-900">
              {status.isActive ? "Premium — active" : "Free plan"}
            </span>
          </div>
          {status.isActive && status.expiresAt && (
            <p className="text-xs text-stone-500">Renews or expires {new Date(status.expiresAt).toLocaleDateString()}</p>
          )}
          {!status.isActive && <p className="text-xs text-stone-500">Your listings appear in standard order.</p>}
        </div>
      )}

      {!status?.isActive && (
        <div className="border border-stone-200 rounded-xl p-5">
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-2xl font-semibold text-stone-900">\u20a615,000</span>
            <span className="text-xs text-stone-500">/ 30 days</span>
          </div>
          <ul className="text-sm text-stone-600 space-y-1.5 mb-5">
            <li className="flex items-center gap-2"><Check size={13} className="text-emerald-700" /> Listings rank above standard placements</li>
            <li className="flex items-center gap-2"><Check size={13} className="text-emerald-700" /> Applies to all your live listings automatically</li>
          </ul>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none mb-3"
          />
          <button
            disabled={initiate.isPending || !email}
            onClick={() => initiate.mutate({ email })}
            className="w-full bg-emerald-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {initiate.isPending ? "Redirecting\u2026" : "Subscribe with Paystack"}
          </button>
          {initiate.error && <p className="text-xs text-red-700 mt-2">{initiate.error.message}</p>}
        </div>
      )}
    </main>
  );
}
