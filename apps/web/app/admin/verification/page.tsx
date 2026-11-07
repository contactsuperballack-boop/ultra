"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

// Remediation (Phase 1 trust boundary repair, item 3): a small button that
// fetches a fresh, short-lived signed URL on click rather than a static
// <a href> pointing at what used to be a permanently public document URL.
function ViewDocumentButton({ realtorProfileId }: { realtorProfileId: string }) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);
  async function view() {
    setLoading(true);
    try {
      const result = await utils.realtors.adminGetVerificationDocUrl.fetch({ realtorProfileId });
      window.open(result.url, "_blank", "noreferrer");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={view} disabled={loading} className="text-xs text-emerald-800 underline mt-1 inline-block disabled:opacity-50">
      {loading ? "Generating link…" : "View ID document"}
    </button>
  );
}

export default function VerificationQueuePage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.realtors.pendingApplications.useInfiniteQuery(
      {},
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
  const applications = data?.pages.flatMap((p) => p.items);
  const decide = trpc.realtors.adminSetVerificationStatus.useMutation({
    onSuccess: () => utils.realtors.pendingApplications.invalidate(),
  });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Realtor Verification Queue</h1>
      <p className="text-sm text-stone-500 mb-6">{applications?.length ?? "—"} pending applications loaded</p>

      {isLoading && <div className="text-sm text-stone-500">Loading\u2026</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Admin") || error.message.includes("Sign in")
            ? "Requires a signed-in ADMIN or SUPER_ADMIN session. Sign in at /auth/login with a seeded admin account."
            : error.message}
        </div>
      )}

      {applications?.length === 0 && <div className="text-sm text-stone-500">No pending applications.</div>}

      <div className="space-y-4">
        {applications?.map((app) => (
          <div key={app.id} className="border border-stone-200 rounded-xl p-5 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-stone-900">{app.agencyName}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {app.user.name} · {app.user.phone}
                </div>
                {app.cacRegistrationNo && (
                  <div className="text-xs text-stone-500 mt-0.5">CAC: {app.cacRegistrationNo}</div>
                )}
                {app.idDocumentUrl ? (
                  <ViewDocumentButton realtorProfileId={app.id} />
                ) : (
                  <div className="text-xs text-amber-700 mt-1">No ID document uploaded</div>
                )}
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-amber-100 text-amber-800">PENDING REVIEW</span>
            </div>

            <input
              placeholder="Optional note (visible in audit log)"
              value={noteDrafts[app.id] ?? ""}
              onChange={(e) => setNoteDrafts((d) => ({ ...d, [app.id]: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs mt-4 outline-none"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => decide.mutate({ realtorProfileId: app.id, status: "VERIFIED", note: noteDrafts[app.id] })}
                disabled={decide.isPending}
                className="bg-emerald-800 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide.mutate({ realtorProfileId: app.id, status: "REJECTED", note: noteDrafts[app.id] })}
                disabled={decide.isPending}
                className="bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Reject
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
          {isFetchingNextPage ? "Loading\u2026" : "Load more"}
        </button>
      )}
    </main>
  );
}
