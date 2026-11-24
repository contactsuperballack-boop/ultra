"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Info } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-emerald-100 text-emerald-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  DRAFT: "bg-stone-100 text-stone-600",
  SOLD: "bg-stone-800 text-white",
  RENTED: "bg-stone-800 text-white",
  REMOVED: "bg-stone-100 text-stone-500",
};

function formatNaira(n: bigint | number) {
  const num = Number(n);
  return num >= 1_000_000 ? `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${num.toLocaleString()}`;
}

// Mirrors the server-side realtor transition matrix exactly
// (packages/db/src/listingTransitions.ts) — LIVE is deliberately never a
// realtor-selectable target here, same reason it's never a valid input on
// the server: a realtor can pause their own listing instantly, but
// resuming one goes through review again, same as a brand-new listing.
// Building this UI with that rule from the start, rather than the
// self-publish version that existed before the Phase 1 remediation pass.
function actionsFor(status: string, type: string): { label: string; target: "DRAFT" | "SOLD" | "RENTED" | "PENDING_REVIEW" }[] {
  switch (status) {
    case "LIVE":
      return [
        { label: type === "RENT" ? "Mark as rented" : "Mark as sold", target: type === "RENT" ? "RENTED" : "SOLD" },
        { label: "Pause listing", target: "DRAFT" },
      ];
    case "DRAFT":
    case "SOLD":
    case "RENTED":
      return [{ label: "Resubmit for review", target: "PENDING_REVIEW" }];
    default:
      return []; // PENDING_REVIEW, UNDER_REVIEW, REMOVED — nothing a realtor can self-serve from here
  }
}

export default function DashboardListingsPage() {
  const utils = trpc.useUtils();
  const { data: listings, isLoading, error } = trpc.listings.mine.useQuery();
  const setStatus = trpc.listings.setStatus.useMutation({ onSuccess: () => utils.listings.mine.invalidate() });
  const [confirmingPause, setConfirmingPause] = useState<string | null>(null);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Listings</h1>
      <p className="text-sm text-stone-500 mb-6">{listings?.length ?? "—"} total</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message === "Sign in required." || error.message.includes("Verified")
            ? "This view requires a signed-in, verified realtor session."
            : error.message}
        </div>
      )}

      {listings?.map((l) => (
        <div key={l.id} className="border border-stone-200 rounded-xl p-4 mb-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-sm text-stone-900">{l.title}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                {l.area} · {formatNaira(l.priceNaira)} · {l._count.inquiries} leads
              </div>
            </div>
            <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STATUS_STYLES[l.status]}`}>{l.status.replace("_", " ")}</span>
          </div>
          {l.flagReason && (
            <div className="flex gap-2 items-start mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {l.flagReason}
            </div>
          )}

          {confirmingPause === l.id && (
            <div className="flex gap-2 items-start mt-3 bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-700">
              <Info size={14} className="flex-shrink-0 mt-0.5 text-stone-500" />
              Pausing takes this listing down right away. Resuming it later goes through review again, just like a new
              listing — it won't go straight back live.
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {actionsFor(l.status, l.type).map((action) => (
              <button
                key={action.target}
                onClick={() => {
                  if (action.target === "DRAFT" && confirmingPause !== l.id) {
                    setConfirmingPause(l.id);
                    return;
                  }
                  setConfirmingPause(null);
                  setStatus.mutate({ id: l.id, status: action.target });
                }}
                disabled={setStatus.isPending}
                className="text-xs font-semibold border border-stone-300 text-stone-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                {action.target === "DRAFT" && confirmingPause === l.id ? "Confirm pause" : action.label}
              </button>
            ))}
            {confirmingPause === l.id && (
              <button onClick={() => setConfirmingPause(null)} className="text-xs text-stone-500 px-2">
                Cancel
              </button>
            )}
          </div>
          {setStatus.error && <p className="text-xs text-red-700 mt-2">{setStatus.error.message}</p>}
        </div>
      ))}
    </main>
  );
}
