"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const REASON_LABELS: Record<string, string> = {
  DUPLICATE_LISTING: "Duplicate listing",
  WRONG_PRICE: "Wrong price",
  WRONG_LOCATION: "Wrong location",
  FALSE_PHOTOS: "False photos",
  PROPERTY_UNAVAILABLE: "Property unavailable",
  SUSPECTED_FRAUD: "Suspected fraud",
  HARASSMENT: "Harassment",
  UNAUTHORIZED_LISTING: "Unauthorized listing",
};

export default function AdminReportsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.listings.adminReportsQueue.useInfiniteQuery(
    { status: "OPEN" },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );
  const reports = data?.pages.flatMap((p) => p.items);
  const resolve = trpc.listings.adminResolveReport.useMutation({ onSuccess: () => utils.listings.adminReportsQueue.invalidate() });

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [suspend, setSuspend] = useState<Record<string, boolean>>({});
  const [restrict, setRestrict] = useState<Record<string, boolean>>({});

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Listing Reports</h1>
      <p className="text-sm text-stone-500 mb-6">{reports?.length ?? "—"} open reports loaded</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">{error.message}</div>}
      {reports?.length === 0 && <div className="text-sm text-stone-500">No open reports.</div>}

      <div className="space-y-4">
        {reports?.map((r) => (
          <div key={r.id} className="border border-stone-200 rounded-xl p-5 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-stone-900">{r.listing.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {r.listing.area} · {r.listing.realtorProfile.agencyName} · listing status: {r.listing.status}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  Reported by {r.reporter.name} ({r.reporter.phone})
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-red-100 text-red-800">{REASON_LABELS[r.reason] ?? r.reason}</span>
            </div>
            {r.comment && <p className="text-sm text-stone-700 mt-3 bg-stone-50 rounded-lg p-3">{r.comment}</p>}

            <input
              placeholder="Resolution note (required)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs mt-4 outline-none"
            />

            <div className="flex gap-4 mt-3">
              <label className="flex items-center gap-1.5 text-xs text-stone-600">
                <input type="checkbox" checked={!!suspend[r.id]} onChange={(e) => setSuspend((s) => ({ ...s, [r.id]: e.target.checked }))} />
                Suspend listing immediately
              </label>
              <label className="flex items-center gap-1.5 text-xs text-stone-600">
                <input type="checkbox" checked={!!restrict[r.id]} onChange={(e) => setRestrict((s) => ({ ...s, [r.id]: e.target.checked }))} />
                Restrict realtor from new listings
              </label>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() =>
                  resolve.mutate({
                    reportId: r.id,
                    status: "RESOLVED",
                    resolutionNote: notes[r.id] || "",
                    suspendListing: !!suspend[r.id],
                    restrictRealtor: !!restrict[r.id],
                  })
                }
                disabled={resolve.isPending || !notes[r.id]}
                className="bg-red-700 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Resolve
              </button>
              <button
                onClick={() => resolve.mutate({ reportId: r.id, status: "DISMISSED", resolutionNote: notes[r.id] || "No action needed." })}
                disabled={resolve.isPending || !notes[r.id]}
                className="bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
            {resolve.error && <p className="text-xs text-red-700 mt-2">{resolve.error.message}</p>}
          </div>
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full mt-4 border border-stone-300 text-stone-700 text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
