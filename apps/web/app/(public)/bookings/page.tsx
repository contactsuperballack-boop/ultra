"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  DECLINED: "bg-stone-100 text-stone-500",
  IN_PROGRESS: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-stone-100 text-stone-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  PAINTING: "Painting",
  PLUMBING: "Plumbing",
  FUMIGATION: "Fumigation",
  ELECTRICAL: "Electrical",
};

export default function MyBookingsPage() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading, error } = trpc.serviceRequests.myRequests.useQuery();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const cancel = trpc.serviceRequests.cancel.useMutation({ onSuccess: () => utils.serviceRequests.myRequests.invalidate() });
  const reply = trpc.serviceRequests.reply.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.serviceRequests.myRequests.invalidate();
    },
  });

  const active = requests?.find((r) => r.id === activeId) ?? requests?.[0];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-6">Your bookings</h1>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message === "Sign in required." ? "Sign in to see your bookings." : error.message}
        </div>
      )}
      {requests?.length === 0 && <div className="text-sm text-stone-500">Request a provider from the Services page to start a booking.</div>}

      {requests && requests.length > 0 && active && (
        <div className="flex border border-stone-200 rounded-xl overflow-hidden bg-white" style={{ height: 520 }}>
          <div className="w-72 border-r border-stone-200 overflow-y-auto flex-shrink-0">
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 ${(activeId ?? requests[0].id) === r.id ? "bg-teal-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900 flex items-center gap-1">
                    {r.providerProfile.businessName}
                    <Check size={11} className="text-amber-500" />
                  </span>
                </div>
                <div className="text-xs text-stone-500">{CATEGORY_LABELS[r.category]}</div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-block mt-1 ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-900">{active.providerProfile.businessName}</div>
                <div className="text-xs text-stone-500">
                  {CATEGORY_LABELS[active.category]}
                  {active.agreedPriceNaira ? ` · \u20a6${Number(active.agreedPriceNaira).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STATUS_STYLES[active.status]}`}>{active.status}</span>
                {(active.status === "REQUESTED" || active.status === "ACCEPTED") && (
                  <button
                    onClick={() => cancel.mutate({ serviceRequestId: active.id })}
                    disabled={cancel.isPending}
                    className="text-xs text-red-700 border border-red-200 rounded-lg px-2 py-1 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                const mine = m.senderId === active.customerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={mine ? { alignSelf: "flex-end", background: "#134E4A", color: "#fff" } : { alignSelf: "flex-start", background: "#F6F7F1" }}
                  >
                    {m.body}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 p-3 border-t border-stone-200">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && draft.trim() && reply.mutate({ serviceRequestId: active.id, message: draft.trim() })}
                placeholder="Message the provider…"
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                disabled={reply.isPending || !draft.trim()}
                onClick={() => reply.mutate({ serviceRequestId: active.id, message: draft.trim() })}
                className="bg-teal-800 text-white rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
