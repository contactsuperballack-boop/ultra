"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { AlertTriangle, Bookmark, CalendarCheck, Heart, LayoutDashboard } from "lucide-react";

export default function AccountPage() {
  const { data: me } = trpc.auth.me.useQuery();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const deleteAccount = trpc.auth.requestAccountDeletion.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        window.location.href = "/";
      }
    },
  });

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Account</h1>
      {me && <p className="text-sm text-stone-500 mb-8">Signed in as {me.phone}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Link href="/buyer/dashboard" className="border border-stone-200 rounded-xl bg-white p-4 hover:border-emerald-300">
          <LayoutDashboard size={18} className="text-emerald-800 mb-2" />
          <div className="text-sm font-semibold text-stone-900">Buyer dashboard</div>
          <p className="text-xs text-stone-500 mt-1">Your activity overview</p>
        </Link>
        <Link href="/saved-properties" className="border border-stone-200 rounded-xl bg-white p-4 hover:border-emerald-300">
          <Heart size={18} className="text-emerald-800 mb-2" />
          <div className="text-sm font-semibold text-stone-900">Saved properties</div>
          <p className="text-xs text-stone-500 mt-1">Your property shortlist</p>
        </Link>
        <Link href="/saved-searches" className="border border-stone-200 rounded-xl bg-white p-4 hover:border-emerald-300">
          <Bookmark size={18} className="text-emerald-800 mb-2" />
          <div className="text-sm font-semibold text-stone-900">Saved searches</div>
          <p className="text-xs text-stone-500 mt-1">Manage property alerts</p>
        </Link>
        <Link href="/my-inspections" className="border border-stone-200 rounded-xl bg-white p-4 hover:border-emerald-300">
          <CalendarCheck size={18} className="text-emerald-800 mb-2" />
          <div className="text-sm font-semibold text-stone-900">My inspections</div>
          <p className="text-xs text-stone-500 mt-1">Track viewing requests</p>
        </Link>
      </section>

      <div className="border border-red-200 rounded-xl p-5 bg-red-50">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={18} className="text-red-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-900">Delete account</div>
            <p className="text-xs text-red-800 mt-1">
              Your name and push token will be cleared, saved properties and search alerts deleted, all sessions signed out, and any live listings or offerings
              taken down. Messages and transaction history tied to other users' accounts are retained, since they're
              legitimately part of someone else's record too — see our{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>{" "}
              for the full explanation.
            </p>
          </div>
        </div>

        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-red-700 underline">
            I want to delete my account
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional — tell us why you're leaving"
              rows={2}
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm outline-none resize-none bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => deleteAccount.mutate({ reason: reason || undefined })}
                disabled={deleteAccount.isPending}
                className="bg-red-700 text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {deleteAccount.isPending ? "Deleting…" : "Confirm deletion"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-sm text-stone-500 px-4">
                Cancel
              </button>
            </div>
            {deleteAccount.error && <p className="text-xs text-red-700">{deleteAccount.error.message}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
