"use client";

import { trpc } from "@/lib/trpc";
import { Briefcase, Inbox, CheckCircle2, Wallet, Sparkles } from "lucide-react";

function formatNaira(n: bigint | number) {
  return `\u20a6${Number(n).toLocaleString()}`;
}

export default function PartnerDashboardPage() {
  const { data, isLoading, error } = trpc.providers.dashboardSummary.useQuery();

  if (isLoading) return <main className="max-w-3xl mx-auto px-6 py-10 text-sm text-stone-500">Loading…</main>;

  if (error) {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Verification required</h1>
        <p className="text-sm text-stone-600 mb-6">{error.message}</p>
        <a href="/partner/verification" className="text-sm font-semibold text-teal-800 underline">
          Go to verification
        </a>
      </main>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Active offerings", value: data.activeOfferings, icon: Briefcase },
    { label: "Pending requests", value: data.pendingRequests, icon: Inbox },
    { label: "Completed jobs", value: data.completedJobs, icon: CheckCircle2 },
    { label: "Commission owed", value: formatNaira(data.commissionOwedNaira), icon: Wallet },
  ];

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">{data.businessName}</h1>
      <p className="text-sm text-stone-500 mb-8">Here's where things stand.</p>

      {data.inFreeOnboardingWindow && (
        <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-4 mb-8">
          <Sparkles size={18} className="text-teal-800 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-teal-900">
            You're in your free onboarding period — accept jobs freely, no subscription required, until{" "}
            <strong>{data.freeUntil ? new Date(data.freeUntil).toLocaleDateString() : ""}</strong>. Commission still applies on completed jobs.
          </div>
        </div>
      )}

      {!data.inFreeOnboardingWindow && !data.subscriptionActive && (
        <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <div className="text-sm text-amber-900">
            Your free onboarding period has ended. Subscribe to keep getting boosted in search and stay prioritized for new requests.
          </div>
          <a href="/partner/subscription" className="text-xs font-semibold text-amber-900 underline whitespace-nowrap">
            Subscribe
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="border border-stone-200 rounded-xl p-5">
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center mb-3">
              <c.icon size={16} className="text-teal-800" />
            </div>
            <div className="text-xl font-semibold text-stone-900">{c.value}</div>
            <div className="text-xs text-stone-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 text-sm">
        <a href="/partner/requests" className="font-semibold text-teal-800 underline">
          View job requests
        </a>
        <a href="/partner/offerings" className="font-semibold text-teal-800 underline">
          Manage offerings
        </a>
        <a href="/partner/billing" className="font-semibold text-teal-800 underline">
          Billing
        </a>
      </div>
    </main>
  );
}
