"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  return num >= 1_000_000 ? `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${num.toLocaleString()}`;
}

const EVIDENCE_OPTIONS = [
  { value: "OWNER_LISTING", label: "Owner listing" },
  { value: "AUTHORIZED_AGENT", label: "Authorized agent" },
  { value: "AGENCY_MANDATE", label: "Agency mandate" },
  { value: "DEVELOPER_LISTING", label: "Developer listing" },
  { value: "LAND_REPRESENTATIVE", label: "Land representative" },
] as const;

export default function FlaggedListingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.listings.flagged.useInfiniteQuery(
      {},
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
  const listings = data?.pages.flatMap((p) => p.items);
  const decide = trpc.listings.adminSetStatus.useMutation({
    onSuccess: () => utils.listings.flagged.invalidate(),
  });
  const [evidence, setEvidence] = useState<Record<string, (typeof EVIDENCE_OPTIONS)[number]["value"]>>({});

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Flagged Listings</h1>
      <p className="text-sm text-stone-500 mb-6">{listings?.length ?? "—"} loaded, awaiting a decision</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Admin") || error.message.includes("Sign in")
            ? "Requires a signed-in ADMIN or SUPER_ADMIN session. Sign in at /auth/login with a seeded admin account."
            : error.message}
        </div>
      )}

      {listings?.length === 0 && <div className="text-sm text-stone-500">Nothing flagged right now.</div>}

      <div className="space-y-4">
        {listings?.map((l) => (
          <div key={l.id} className="border border-stone-200 rounded-xl p-5 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-stone-900">{l.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {l.area} · {formatNaira(l.priceNaira)} · {l.realtorProfile.agencyName}
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-1 rounded-full ${
                  l.status === "UNDER_REVIEW" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {l.status.replace("_", " ")}
              </span>
            </div>

            {l.flagReason && (
              <div className="flex gap-2 items-start mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                {l.flagReason}
              </div>
            )}

            <div className="mt-3">
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                Ownership/authorization evidence (Readiness §3C — optional, but leaving this unset keeps it honestly "pending")
              </label>
              <select
                value={evidence[l.id] ?? ""}
                onChange={(e) => setEvidence((ev) => ({ ...ev, [l.id]: e.target.value as any }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs outline-none"
              >
                <option value="">— not set —</option>
                {EVIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => decide.mutate({ id: l.id, status: "LIVE", ownershipEvidence: evidence[l.id] })}
                disabled={decide.isPending}
                className="bg-emerald-800 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Approve & Publish
              </button>
              <button
                onClick={() => decide.mutate({ id: l.id, status: "REMOVED" })}
                disabled={decide.isPending}
                className="bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
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
