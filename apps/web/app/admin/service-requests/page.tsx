"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const STATUSES = ["ALL", "REQUESTED", "PROPOSAL_PENDING", "ACCEPTED", "DECLINED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  PAINTING: "Painting", PLUMBING: "Plumbing", FUMIGATION: "Fumigation", ELECTRICAL: "Electrical",
  SOLAR: "Solar installations", CCTV: "CCTV installations", SECURITY_SYSTEMS: "Security systems",
  FURNITURE: "Furniture", CLEANING: "Cleaning", MOVE_IN: "Move-In", PEST_CONTROL: "Pest control",
};
const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800", PROPOSAL_PENDING: "bg-violet-100 text-violet-800", ACCEPTED: "bg-blue-100 text-blue-800",
  DECLINED: "bg-stone-100 text-stone-600", IN_PROGRESS: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-emerald-100 text-emerald-800", CANCELLED: "bg-stone-100 text-stone-500",
};
function naira(value: bigint | number | null) { return value == null ? "Not set" : `₦${Number(value).toLocaleString()}`; }

export default function AdminServiceRequestsPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const query = trpc.serviceRequests.adminList.useInfiniteQuery(
    { status: status === "ALL" ? undefined : status, limit: 25 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor, placeholderData: (previous) => previous },
  );
  const requests = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-6 py-10">
      <div className="mb-6"><div className="text-xs tracking-widest text-stone-500 font-mono">HOME SERVICES · OPERATIONS</div><h1 className="text-2xl font-semibold text-stone-900 mt-1">Service requests</h1><p className="text-sm text-stone-500 mt-1">Monitor customer requests and provider responses during the supervised Abuja pilot.</p></div>
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUSES.map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === item ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-600"}`}>{item === "ALL" ? "All requests" : item.replaceAll("_", " ")}</button>)}
      </div>
      {query.isLoading && <p className="text-sm text-stone-500">Loading service requests…</p>}
      {query.error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
      {!query.isLoading && requests.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">No service requests in this view.</div>}
      <div className="space-y-3">
        {requests.map((item) => <article key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-stone-900">{item.offering?.title ?? CATEGORY_LABELS[item.category] ?? item.category}</div><div className="text-xs text-stone-500 mt-1">{CATEGORY_LABELS[item.category] ?? item.category} · {item.transactionType.replaceAll("_", " ")} · {item.unitCount} unit(s) · {new Date(item.createdAt).toLocaleString()}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-mono ${STATUS_STYLES[item.status] ?? "bg-stone-100 text-stone-600"}`}>{item.status.replaceAll("_", " ")}</span></div>
          {item.siteName && <p className="text-xs text-stone-600 mt-2">Project: {item.siteName}{item.siteAddress ? ` · ${item.siteAddress}` : ""}</p>}
          {item.requestedFrequency && <p className="text-xs text-stone-600 mt-2">Requested frequency: {item.requestedFrequency.toLowerCase()}</p>}
          {item.note && <p className="text-sm text-stone-700 mt-3 whitespace-pre-wrap">{item.note}</p>}
          <div className="grid sm:grid-cols-2 gap-4 border-t border-stone-100 mt-4 pt-4 text-xs">
            <div><div className="font-semibold text-stone-800 mb-1">Customer</div><div className="text-stone-600">{item.customer.name} · {item.customer.phone}</div></div>
            <div><div className="font-semibold text-stone-800 mb-1">Provider</div><div className="text-stone-600">{item.providerProfile.businessName} · {item.providerProfile.serviceArea}</div><div className="text-stone-500 mt-0.5">{item.providerProfile.user.name} · {item.providerProfile.user.phone}</div></div>
          </div>
          <div className="flex flex-wrap gap-5 mt-4 text-xs text-stone-600"><span>Agreed price: <strong className="text-stone-900">{naira(item.agreedPriceNaira)}</strong></span><span>Commission recorded: <strong className="text-stone-900">{naira(item.commissionNaira)}</strong></span>{item.preferredAt && <span>Preferred: <strong className="text-stone-900">{new Date(item.preferredAt).toLocaleString()}</strong></span>}{item.scheduledAt && <span>Confirmed: <strong className="text-stone-900">{new Date(item.scheduledAt).toLocaleString()}</strong></span>}</div>
        </article>)}
      </div>
      {query.hasNextPage && <button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="mt-6 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50">{query.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
    </main>
  );
}
