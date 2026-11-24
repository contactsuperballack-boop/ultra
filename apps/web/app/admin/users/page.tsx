"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search, Loader2, User as UserIcon, ShieldOff } from "lucide-react";

function formatNaira(n: bigint | number) {
  return `\u20a6${Number(n).toLocaleString()}`;
}

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Buyer",
  REALTOR: "Realtor",
  PROVIDER: "Provider",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

/**
 * Priority-checklist fix — general admin "find any account" screen,
 * closing the gap flagged by the MVP Product Readiness Audit: admins
 * previously had no way to look up a plain buyer, and even the
 * realtor/provider searches were only reachable from the payments
 * screen for a narrow refund-lookup purpose. This is the standalone
 * screen that purpose was missing.
 */
export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const results = trpc.admin.search.useQuery({ query }, { enabled: query.length >= 2 });
  const detail = trpc.admin.userDetail.useQuery({ userId: selectedUserId! }, { enabled: !!selectedUserId });

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Find an account</h1>
      <p className="text-sm text-stone-500 mb-6">
        Search any user by name or phone number — buyers, realtors, providers, or admins.
      </p>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedUserId(null);
          }}
          placeholder="Name or phone number"
          className="w-full border border-stone-300 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          {results.isLoading && query.length >= 2 && <div className="text-sm text-stone-500">Searching…</div>}
          {results.data && results.data.length === 0 && (
            <div className="text-sm text-stone-500">No accounts match "{query}".</div>
          )}
          <div className="space-y-2">
            {results.data?.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`w-full text-left border rounded-xl px-4 py-3 text-sm ${
                  selectedUserId === u.id ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-900">{u.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                <div className="text-stone-500 text-xs mt-0.5 flex items-center gap-2">
                  {u.phone}
                  {u.deactivatedAt && (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <ShieldOff size={11} /> Deactivated
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selectedUserId && (
            <div className="text-sm text-stone-500 flex flex-col items-center justify-center border border-dashed border-stone-200 rounded-xl py-12">
              <UserIcon size={20} className="mb-2" />
              Select an account to view details
            </div>
          )}
          {detail.isLoading && <div className="text-sm text-stone-500">Loading…</div>}
          {detail.data && (
            <div className="border border-stone-200 rounded-xl p-5 space-y-4">
              <div>
                <div className="font-semibold text-stone-900">{detail.data.name}</div>
                <div className="text-sm text-stone-500">{detail.data.phone} {detail.data.phoneVerified ? "· verified" : "· unverified"}</div>
                {detail.data.email && <div className="text-sm text-stone-500">{detail.data.email}</div>}
                <div className="text-xs text-stone-500 mt-1">
                  Joined {new Date(detail.data.createdAt).toLocaleDateString()} · {ROLE_LABELS[detail.data.role] ?? detail.data.role}
                </div>
                {detail.data.deactivatedAt && (
                  <div className="text-xs text-red-700 mt-1">
                    Deactivated {new Date(detail.data.deactivatedAt).toLocaleDateString()}
                    {detail.data.deactivationReason && ` — ${detail.data.deactivationReason}`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-stone-500 border-t border-stone-100 pt-3">
                <div>{detail.data._count.inquiriesSent} inquiries sent</div>
                <div>{detail.data._count.savedListings} saved listings</div>
                <div>{detail.data._count.serviceRequestsSent} service requests</div>
                <div>{detail.data._count.reportsFiled} reports filed</div>
              </div>

              {detail.data.realtorProfile && (
                <div className="border-t border-stone-100 pt-3 text-sm">
                  <div className="font-medium text-stone-800 mb-1">Realtor profile</div>
                  <div className="text-stone-500">Status: {detail.data.realtorProfile.verificationStatus}</div>
                  <div className="text-stone-500">Balance: {formatNaira(detail.data.realtorProfile.creditBalanceNaira)}</div>
                  {detail.data.realtorProfile.restrictedReason && (
                    <div className="text-red-700 text-xs mt-1">Restricted: {detail.data.realtorProfile.restrictedReason}</div>
                  )}
                </div>
              )}

              {detail.data.providerProfile && (
                <div className="border-t border-stone-100 pt-3 text-sm">
                  <div className="font-medium text-stone-800 mb-1">Provider profile</div>
                  <div className="text-stone-500">Status: {detail.data.providerProfile.verificationStatus}</div>
                  <div className="text-stone-500">Commission owed: {formatNaira(detail.data.providerProfile.commissionOwedNaira)}</div>
                </div>
              )}

              <p className="text-[11px] text-stone-500 border-t border-stone-100 pt-3">
                No account-suspension action exists on this screen yet — this is a lookup tool. Suspending a
                realtor/provider account is still done via their respective verification queue.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
