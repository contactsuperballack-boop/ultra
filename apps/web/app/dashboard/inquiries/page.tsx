"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

// Readiness §4F — status labels derived from data already on the thread,
// not new schema. "Viewing requested/scheduled" would need a tracked field
// this schema doesn't have yet (a buyer's quick-action message is just
// text, not a structured event) — the four states below are the ones
// honestly derivable right now, not a partial implementation dressed up
// as the full list.
function deriveThreadStatus(thread: { listing: { status: string }; messages: { senderId: string; createdAt: string | Date }[]; buyerId: string }) {
  if (thread.listing.status !== "LIVE") return { label: "Property no longer available", tone: "stone" as const };

  const last = thread.messages[thread.messages.length - 1];
  if (!last) return { label: "New inquiry", tone: "amber" as const };

  const fromBuyer = last.senderId === thread.buyerId;
  if (!fromBuyer) {
    const hoursSince = (Date.now() - new Date(last.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince > 48) return { label: "Buyer not responsive", tone: "stone" as const };
    return { label: "Realtor replied", tone: "teal" as const };
  }
  return thread.messages.length === 1 ? { label: "New inquiry", tone: "amber" as const } : { label: "Awaiting your reply", tone: "red" as const };
}

const TONE_CLASSES = {
  amber: "bg-amber-100 text-amber-800",
  teal: "bg-teal-100 text-teal-800",
  red: "bg-red-100 text-red-800",
  stone: "bg-stone-100 text-stone-500",
};

export default function RealtorInquiriesPage() {
  const utils = trpc.useUtils();
  // MVP review — this was an unpaginated findMany, the same gap the admin
  // queues already learned to fix. Converted to useInfiniteQuery, same
  // pattern as every admin queue page in this codebase.
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.inquiries.forRealtor.useInfiniteQuery({}, { getNextPageParam: (lastPage) => lastPage.nextCursor });
  const threads = data?.pages.flatMap((p) => p.items);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const reply = trpc.inquiries.reply.useMutation({
    // Optimistic send — updates the cached forRealtor pages immediately
    // rather than waiting for the round trip. setInfiniteData (not
    // setData) is the correct tRPC API for a paginated query's cache —
    // it walks every loaded page, not just a single flat array. The
    // optimistic message's senderId just needs to NOT equal
    // active.buyerId for the bubble to render on the correct (realtor's)
    // side — the exact realtor userId isn't needed for that, since the
    // render check is `=== buyerId`.
    onMutate: async ({ inquiryId, message }) => {
      await utils.inquiries.forRealtor.cancel();
      const previous = utils.inquiries.forRealtor.getInfiniteData();
      utils.inquiries.forRealtor.setInfiniteData({}, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((t) =>
              t.id === inquiryId
                ? { ...t, messages: [...t.messages, { id: `optimistic-${Date.now()}`, inquiryId, senderId: "optimistic-realtor", body: message, createdAt: new Date() }] }
                : t
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.inquiries.forRealtor.setInfiniteData({}, context.previous);
    },
    onSuccess: () => setDraft(""),
    onSettled: () => utils.inquiries.forRealtor.invalidate(),
  });

  const active = threads?.find((t) => t.id === activeId) ?? threads?.[0];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Inquiries</h1>
      <p className="text-sm text-stone-500 mb-6">Responding quickly keeps your realtor rating high.</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Verified") ? "Requires a verified realtor account." : error.message}
        </div>
      )}
      {threads?.length === 0 && <div className="text-sm text-stone-500">No inquiries yet — they'll show up here as buyers message you.</div>}

      {threads && threads.length > 0 && active && (
        <div className="flex gap-0 border border-stone-200 rounded-xl overflow-hidden bg-white" style={{ height: 480 }}>
          <div className="w-72 border-r border-stone-200 overflow-y-auto flex-shrink-0">
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const status = deriveThreadStatus(t as any);
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-100 ${(activeId ?? threads[0].id) === t.id ? "bg-emerald-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-stone-900">{t.buyer.name}</div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full whitespace-nowrap ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
                  </div>
                  <div className="text-xs text-stone-500">{t.listing.title}, {t.listing.area}</div>
                  {last && <div className="text-xs text-stone-600 mt-1 truncate">{last.body}</div>}
                </button>
              );
            })}
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full text-center text-xs font-semibold text-emerald-800 py-3 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-900">{active.buyer.name}</div>
                <div className="text-xs text-stone-500">{active.listing.title}, {active.listing.area}</div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${TONE_CLASSES[deriveThreadStatus(active as any).tone]}`}>
                {deriveThreadStatus(active as any).label}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                // Compare against buyerId (a real id), not buyer.name — a
                // name-based comparison would never distinguish sides
                // correctly. buyerId is a plain scalar on Inquiry, present
                // regardless of what's in `include`.
                const fromBuyer = m.senderId === active.buyerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={fromBuyer ? { alignSelf: "flex-start", background: "#F6F7F1" } : { alignSelf: "flex-end", background: "#1F4D3A", color: "#fff" }}
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
                onKeyDown={(e) => e.key === "Enter" && draft.trim() && reply.mutate({ inquiryId: active.id, message: draft.trim() })}
                placeholder="Reply…"
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                disabled={reply.isPending || !draft.trim()}
                onClick={() => reply.mutate({ inquiryId: active.id, message: draft.trim() })}
                className="bg-emerald-800 text-white rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
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
