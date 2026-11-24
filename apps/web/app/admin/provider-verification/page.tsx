"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

// Remediation (Phase 1 trust boundary repair, item 3) — mirrors the
// realtor admin verification page's ViewDocumentButton exactly.
function ViewDocumentButton({ providerProfileId }: { providerProfileId: string }) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);
  async function view() {
    setLoading(true);
    try {
      const result = await utils.providers.adminGetVerificationDocUrl.fetch({ providerProfileId });
      window.open(result.url, "_blank", "noreferrer");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={view} disabled={loading} className="text-xs text-teal-800 underline mt-1 inline-block disabled:opacity-50">
      {loading ? "Generating link…" : "View ID document"}
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  PAINTING: "Painting",
  PLUMBING: "Plumbing",
  FUMIGATION: "Fumigation",
  ELECTRICAL: "Electrical",


  SOLAR: "Solar installations",
  CCTV: "CCTV installations",
  SECURITY_SYSTEMS: "Security systems",
  FURNITURE: "Furniture",
  CLEANING: "Cleaning",
  MOVE_IN: "Move-In",
  PEST_CONTROL: "Pest control",
};

export default function ProviderVerificationQueuePage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.providers.pendingApplications.useInfiniteQuery({}, { getNextPageParam: (lastPage) => lastPage.nextCursor });
  const applications = data?.pages.flatMap((p) => p.items);
  const decide = trpc.providers.adminSetVerificationStatus.useMutation({
    onSuccess: () => utils.providers.pendingApplications.invalidate(),
  });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Provider Verification Queue</h1>
      <p className="text-sm text-stone-500 mb-6">{applications?.length ?? "—"} pending applications loaded</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
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
                <div className="font-semibold text-stone-900">{app.businessName}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {app.user.name} · {app.user.phone}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{app.categories.map((c: string) => CATEGORY_LABELS[c] ?? c).join(", ")}</div>
                {app.cacRegistrationNo && <div className="text-xs text-stone-500 mt-0.5">CAC: {app.cacRegistrationNo}</div>}
                {app.idDocumentUrl ? (
                  <ViewDocumentButton providerProfileId={app.id} />
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
                onClick={() => decide.mutate({ providerProfileId: app.id, status: "VERIFIED", note: noteDrafts[app.id] })}
                disabled={decide.isPending}
                className="bg-teal-800 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide.mutate({ providerProfileId: app.id, status: "REJECTED", note: noteDrafts[app.id] })}
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
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
