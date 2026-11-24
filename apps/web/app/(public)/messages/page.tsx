"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { InspectionCards } from "@/components/InspectionCards";
import { Check } from "lucide-react";

export default function MessagesPage() {
  const utils = trpc.useUtils();
  const { data: threads, isLoading, error } = trpc.inquiries.myThreads.useQuery();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const reply = trpc.inquiries.reply.useMutation({
    // Optimistic send, mirroring the realtor inquiries page — here the
    // optimistic message's senderId must literally BE the buyer's own id
    // (active.buyerId), since this page's "mine" check is the opposite
    // convention (mine = senderId === buyerId, not !== ).
    onMutate: async ({ inquiryId, message }) => {
      await utils.inquiries.myThreads.cancel();
      const previous = utils.inquiries.myThreads.getData();
      utils.inquiries.myThreads.setData(undefined, (old) =>
        old?.map((t) =>
          t.id === inquiryId
            ? { ...t, messages: [...t.messages, { id: `optimistic-${Date.now()}`, inquiryId, senderId: t.buyerId, body: message, createdAt: new Date() }] }
            : t
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.inquiries.myThreads.setData(undefined, context.previous);
    },
    onSuccess: () => setDraft(""),
    onSettled: () => utils.inquiries.myThreads.invalidate(),
  });

  const active = threads?.find((t) => t.id === activeId) ?? threads?.[0];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-6">Messages</h1>

      {isLoading && <div className="text-sm text-stone-500">Loading\u2026</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message === "Sign in required." ? "Sign in to see your messages." : error.message}
        </div>
      )}
      {threads?.length === 0 && <div className="text-sm text-stone-500">Message a realtor from any listing to start a conversation.</div>}

      {threads && threads.length > 0 && active && (
        <div className="flex border border-stone-200 rounded-xl overflow-hidden bg-white" style={{ height: 480 }}>
          <div className="w-72 border-r border-stone-200 overflow-y-auto flex-shrink-0">
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const verified = t.listing.realtorProfile.verificationStatus === "VERIFIED";
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-100 ${(activeId ?? threads[0].id) === t.id ? "bg-emerald-50" : ""}`}
                >
                  <div className="text-sm font-semibold text-stone-900 flex items-center gap-1">
                    {t.listing.realtorProfile.agencyName}
                    {verified && <Check size={11} className="text-amber-500" />}
                  </div>
                  <div className="text-xs text-stone-500">{t.listing.title}</div>
                  {last && <div className="text-xs text-stone-600 mt-1 truncate">{last.senderId === t.buyerId ? "You: " : ""}{last.body}</div>}
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-stone-200">
              <div className="text-sm font-semibold text-stone-900">{active.listing.realtorProfile.agencyName}</div>
              <div className="text-xs text-stone-500">{active.listing.title}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                const mine = m.senderId === active.buyerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={mine ? { alignSelf: "flex-end", background: "#1055EA", color: "#fff" } : { alignSelf: "flex-start", background: "#F6F7F1" }}
                  >
                    {m.body}
                  </div>
                );
              })}
            </div>
            <InspectionCards inquiryId={active.id} />
            <div className="flex gap-2 p-3 border-t border-stone-200">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && draft.trim() && reply.mutate({ inquiryId: active.id, message: draft.trim() })}
                placeholder="Message the realtor\u2026"
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
