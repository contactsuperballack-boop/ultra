"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@ultra/api";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BookingRequest = RouterOutputs["serviceRequests"]["myRequests"][number];

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  PROPOSAL_PENDING: "bg-violet-100 text-violet-800",
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


  SOLAR: "Solar installations",
  CCTV: "CCTV installations",
  SECURITY_SYSTEMS: "Security systems",
  FURNITURE: "Furniture",
  CLEANING: "Cleaning",
  MOVE_IN: "Move-In",
  PEST_CONTROL: "Pest control",
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
  const acceptProposal = trpc.serviceRequests.acceptProposal.useMutation({ onSuccess: () => utils.serviceRequests.myRequests.invalidate() });
  const declineProposal = trpc.serviceRequests.declineProposal.useMutation({ onSuccess: () => utils.serviceRequests.myRequests.invalidate() });
  const approveMilestone = trpc.serviceRequests.approveMilestone.useMutation({ onSuccess: () => utils.serviceRequests.myRequests.invalidate() });
  const cancelAgreement = trpc.serviceRequests.cancelAgreement.useMutation({ onSuccess: () => utils.serviceRequests.myRequests.invalidate() });

  const active = requests?.find((r: BookingRequest) => r.id === activeId) ?? requests?.[0];

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
                <div className="text-xs text-stone-500">{CATEGORY_LABELS[r.category]} · {r.transactionType === "ONE_TIME" ? "One-time" : r.transactionType === "INSTALLATION_PROJECT" ? `Project · ${r.unitCount} unit(s)` : `Recurring · ${r.requestedFrequency?.toLowerCase()}`}</div>
                {r.siteName && <div className="text-[11px] text-stone-500">{r.siteName}</div>}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-block mt-1 ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-900">{active.providerProfile.businessName}</div>
                <div className="text-xs text-stone-500">
                  {CATEGORY_LABELS[active.category]} · {active.transactionType === "ONE_TIME" ? "One-time" : active.transactionType === "INSTALLATION_PROJECT" ? `Project · ${active.unitCount} unit(s)` : `Recurring · ${active.requestedFrequency?.toLowerCase()}`}
                  {active.siteName ? ` · ${active.siteName}` : ""}
                  {active.agreedPriceNaira ? ` · ₦${Number(active.agreedPriceNaira).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STATUS_STYLES[active.status]}`}>{active.status}</span>
                {(active.status === "REQUESTED" || active.status === "PROPOSAL_PENDING" || (active.status === "ACCEPTED" && active.transactionType !== "RECURRING")) && (
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
            {(active.siteAddress || active.preferredAt || active.scheduledAt) && <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 text-[11px] text-stone-600">{active.siteAddress ? `Service location: ${active.siteAddress}` : ""}{active.preferredAt ? ` · Preferred: ${new Date(active.preferredAt).toLocaleString("en-NG")}` : ""}{active.scheduledAt ? ` · Confirmed: ${new Date(active.scheduledAt).toLocaleString("en-NG")}` : ""}</div>}
            {active.status === "PROPOSAL_PENDING" && active.transactionType === "INSTALLATION_PROJECT" && active.quotes?.find((q) => q.status === "PROPOSED") && (
              <div className="p-3 border-b border-stone-200 bg-violet-50 space-y-2">
                {(() => { const quote = active.quotes.find((q) => q.status === "PROPOSED")!; return <>
                  <div className="text-sm font-semibold text-stone-900">Project quote · ₦{Number(quote.totalPriceNaira).toLocaleString()}</div>
                  <p className="text-xs text-stone-700">{quote.scopeSummary}</p>
                  <p className="text-[11px] text-stone-500">Estimated duration: {quote.estimatedDurationDays} days{quote.validUntil ? ` · Valid until ${new Date(quote.validUntil).toLocaleDateString("en-NG")}` : ""}</p>
                  {quote.milestones.map((m) => <div key={m.id} className="flex justify-between text-xs border-t border-violet-100 py-1"><span>{m.title}</span><span>₦{Number(m.amountNaira).toLocaleString()}</span></div>)}
                </>; })()}
                <div className="flex gap-2"><button disabled={acceptProposal.isPending} onClick={() => acceptProposal.mutate({ serviceRequestId: active.id })} className="bg-teal-800 text-white rounded-lg px-3 py-2 text-xs font-semibold">Accept quote</button><button disabled={declineProposal.isPending} onClick={() => declineProposal.mutate({ serviceRequestId: active.id })} className="border border-stone-300 text-stone-700 rounded-lg px-3 py-2 text-xs font-semibold">Decline</button></div>
              </div>
            )}

            {active.status === "PROPOSAL_PENDING" && active.transactionType === "RECURRING" && active.recurringAgreements?.find((a) => a.status === "PROPOSED") && (
              <div className="p-3 border-b border-stone-200 bg-violet-50 space-y-2">
                {(() => { const agreement = active.recurringAgreements.find((a) => a.status === "PROPOSED")!; return <>
                  <div className="text-sm font-semibold text-stone-900">Recurring service agreement</div>
                  <p className="text-xs text-stone-700">{agreement.serviceScope}</p>
                  <p className="text-xs text-stone-700">{agreement.frequency.toLowerCase()} · ₦{Number(agreement.pricePerVisitNaira).toLocaleString()} per visit</p>
                  <p className="text-[11px] text-stone-500">Starts {new Date(agreement.startAt).toLocaleDateString("en-NG")}{agreement.endAt ? ` · Ends ${new Date(agreement.endAt).toLocaleDateString("en-NG")}` : " · No fixed end date"}</p>
                </>; })()}
                <div className="flex gap-2"><button disabled={acceptProposal.isPending} onClick={() => acceptProposal.mutate({ serviceRequestId: active.id })} className="bg-teal-800 text-white rounded-lg px-3 py-2 text-xs font-semibold">Accept agreement</button><button disabled={declineProposal.isPending} onClick={() => declineProposal.mutate({ serviceRequestId: active.id })} className="border border-stone-300 text-stone-700 rounded-lg px-3 py-2 text-xs font-semibold">Decline</button></div>
              </div>
            )}

            {active.transactionType === "INSTALLATION_PROJECT" && active.quotes?.find((q) => q.status === "ACCEPTED") && (
              <div className="p-3 border-b border-stone-200 space-y-2 max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-stone-800">Project milestones</div>
                {active.quotes.find((q) => q.status === "ACCEPTED")!.milestones.map((m) => <div key={m.id} className="flex items-center justify-between gap-2 text-xs border-t border-stone-100 py-1.5"><span>{m.title} · {m.status}</span>{m.status === "COMPLETED" && <button onClick={() => approveMilestone.mutate({ milestoneId: m.id })} className="text-teal-800 underline">Approve milestone</button>}</div>)}
              </div>
            )}

            {active.transactionType === "RECURRING" && active.recurringAgreements?.[0] && active.recurringAgreements[0].status !== "PROPOSED" && (
              <div className="p-3 border-b border-stone-200 space-y-2">
                <div className="flex items-center justify-between"><div className="text-xs font-semibold text-stone-800">Recurring agreement · {active.recurringAgreements[0].frequency.toLowerCase()} · {active.recurringAgreements[0].status}</div>{active.recurringAgreements[0].status === "ACTIVE" && <button onClick={() => { if (window.confirm("Cancel this recurring service agreement and future scheduled visits?")) cancelAgreement.mutate({ agreementId: active.recurringAgreements[0].id }); }} className="text-xs text-red-700 underline">Cancel agreement</button>}</div>
                <div className="text-xs text-stone-600">₦{Number(active.recurringAgreements[0].pricePerVisitNaira).toLocaleString()} per visit · Next due {new Date(active.recurringAgreements[0].nextServiceAt).toLocaleDateString("en-NG")}</div>
                {active.recurringAgreements[0].occurrences.map((occurrence) => <div key={occurrence.id} className="text-xs border-t border-stone-100 py-1.5">{new Date(occurrence.scheduledAt).toLocaleDateString("en-NG")} · {occurrence.status}{occurrence.finalPriceNaira ? ` · ₦${Number(occurrence.finalPriceNaira).toLocaleString()}` : ""}</div>)}
              </div>
            )}

            {(acceptProposal.error || declineProposal.error || approveMilestone.error || cancelAgreement.error) && <p role="alert" className="px-3 py-2 text-xs text-red-700">{acceptProposal.error?.message || declineProposal.error?.message || approveMilestone.error?.message || cancelAgreement.error?.message}</p>}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                const mine = m.senderId === active.customerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={mine ? { alignSelf: "flex-end", background: "#0B2A5A", color: "#fff" } : { alignSelf: "flex-start", background: "#F6F7F1" }}
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
