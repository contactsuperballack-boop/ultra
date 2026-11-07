"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

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

export default function PartnerRequestsPage() {
  const utils = trpc.useUtils();
  // MVP review — was an unpaginated findMany, same fix pattern as the
  // realtor inquiries inbox.
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.serviceRequests.forProvider.useInfiniteQuery({}, { getNextPageParam: (lastPage) => lastPage.nextCursor });
  const requests = data?.pages.flatMap((p) => p.items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [priceInput, setPriceInput] = useState("");

  const respond = trpc.serviceRequests.respond.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const markInProgress = trpc.serviceRequests.markInProgress.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const complete = trpc.serviceRequests.complete.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const reply = trpc.serviceRequests.reply.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.serviceRequests.forProvider.invalidate();
    },
  });

  const active = requests?.find((r) => r.id === activeId) ?? requests?.[0];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Job requests</h1>
      <p className="text-sm text-stone-500 mb-6">Accept or decline new requests, and mark jobs complete once finished.</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Verified") ? "Requires a verified provider account." : error.message}
        </div>
      )}
      {requests?.length === 0 && <div className="text-sm text-stone-500">No requests yet — they'll show up here as customers book you.</div>}

      {requests && requests.length > 0 && active && (
        <div className="flex gap-0 border border-stone-200 rounded-xl overflow-hidden bg-white" style={{ height: 520 }}>
          <div className="w-72 border-r border-stone-200 overflow-y-auto flex-shrink-0">
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setActiveId(r.id);
                  setPriceInput("");
                }}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 ${(activeId ?? requests[0].id) === r.id ? "bg-teal-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">{r.customer.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-xs text-stone-500">{CATEGORY_LABELS[r.category]}</div>
                <div className="text-xs text-stone-600 mt-1 truncate">{r.note}</div>
              </button>
            ))}
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full text-center text-xs font-semibold text-teal-800 py-3 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-900">{active.customer.name}</div>
                <div className="text-xs text-stone-500">
                  {CATEGORY_LABELS[active.category]}
                  {active.agreedPriceNaira ? ` · \u20a6${Number(active.agreedPriceNaira).toLocaleString()}` : ""}
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STATUS_STYLES[active.status]}`}>{active.status}</span>
            </div>

            {active.status === "REQUESTED" && (
              <div className="p-3 border-b border-stone-200 flex gap-2">
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Agreed price (\u20a6)"
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
                />
                <button
                  disabled={respond.isPending || !priceInput}
                  onClick={() => respond.mutate({ serviceRequestId: active.id, status: "ACCEPTED", agreedPriceNaira: Number(priceInput) })}
                  className="bg-teal-800 text-white rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ serviceRequestId: active.id, status: "DECLINED" })}
                  className="border border-stone-300 text-stone-600 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {active.status === "ACCEPTED" && (
              <div className="p-3 border-b border-stone-200 flex gap-2">
                <button
                  disabled={markInProgress.isPending}
                  onClick={() => markInProgress.mutate({ serviceRequestId: active.id })}
                  className="border border-stone-300 text-stone-600 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Mark in progress
                </button>
                <button
                  disabled={complete.isPending}
                  onClick={() => complete.mutate({ serviceRequestId: active.id })}
                  className="bg-emerald-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {complete.isPending && <Loader2 size={12} className="animate-spin" />}
                  Mark complete
                </button>
              </div>
            )}

            {active.status === "IN_PROGRESS" && (
              <div className="p-3 border-b border-stone-200">
                <button
                  disabled={complete.isPending}
                  onClick={() => complete.mutate({ serviceRequestId: active.id })}
                  className="bg-emerald-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {complete.isPending && <Loader2 size={12} className="animate-spin" />}
                  Mark complete
                </button>
              </div>
            )}

            {complete.error && <div className="px-3 py-2 text-xs text-red-700">{complete.error.message}</div>}
            {respond.error && <div className="px-3 py-2 text-xs text-red-700">{respond.error.message}</div>}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                const fromCustomer = m.senderId === active.customerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={fromCustomer ? { alignSelf: "flex-start", background: "#F6F7F1" } : { alignSelf: "flex-end", background: "#134E4A", color: "#fff" }}
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
                placeholder="Reply…"
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
