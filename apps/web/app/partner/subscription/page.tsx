"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Check } from "lucide-react";

export default function PartnerSubscriptionPage() {
  const { data: status, isLoading, error } = trpc.providers.subscriptionStatus.useQuery();
  const [email, setEmail] = useState("");
  const initiate = trpc.providers.initiateSubscription.useMutation({
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Subscription</h1>
      <p className="text-sm text-stone-500 mb-8">Premium providers rank above standard ones in customer search results.</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Verified") ? "Requires a verified provider account." : error.message}
        </div>
      )}

      {status?.inFreeOnboardingWindow && !status.isActive && (
        <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
          <Sparkles size={18} className="text-teal-800 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-teal-900">
            You're still in your free onboarding period, until <strong>{status.freeUntil ? new Date(status.freeUntil).toLocaleDateString() : ""}</strong>.
            You don't need a subscription to accept jobs yet — this is optional early ranking boost.
          </div>
        </div>
      )}

      {status && (
        <div className={`rounded-xl p-5 mb-6 border ${status.isActive ? "bg-teal-50 border-teal-200" : "bg-stone-50 border-stone-200"}`}>
          <div className="flex items-center gap-2 mb-1">
            {status.isActive && <Sparkles size={16} className="text-teal-800" />}
            <span className="text-sm font-semibold text-stone-900">{status.isActive ? "Premium — active" : "Free plan"}</span>
          </div>
          {status.isActive && status.expiresAt && <p className="text-xs text-stone-500">Renews or expires {new Date(status.expiresAt).toLocaleDateString()}</p>}
          {!status.isActive && <p className="text-xs text-stone-500">Your profile appears in standard order.</p>}
        </div>
      )}

      {!status?.isActive && (
        <div className="border border-stone-200 rounded-xl p-5">
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-2xl font-semibold text-stone-900">\u20a610,000</span>
            <span className="text-xs text-stone-500">/ 30 days</span>
          </div>
          <ul className="text-sm text-stone-600 space-y-1.5 mb-5">
            <li className="flex items-center gap-2">
              <Check size={13} className="text-teal-700" /> Ranks above standard providers in search
            </li>
            <li className="flex items-center gap-2">
              <Check size={13} className="text-teal-700" /> Doesn't replace commission — both apply together
            </li>
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
            className="w-full bg-teal-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {initiate.isPending ? "Redirecting…" : "Subscribe with Paystack"}
          </button>
          {initiate.error && <p className="text-xs text-red-700 mt-2">{initiate.error.message}</p>}
        </div>
      )}
    </main>
  );
}
