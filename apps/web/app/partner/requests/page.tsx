"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

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
  const [appointmentAt, setAppointmentAt] = useState("");
  const [quoteScope, setQuoteScope] = useState("");
  const [quoteTotal, setQuoteTotal] = useState("");
  const [quoteDays, setQuoteDays] = useState("14");
  const [milestones, setMilestones] = useState([{ title: "Mobilisation and equipment", amount: "" }]);
  const [agreementScope, setAgreementScope] = useState("");
  const [agreementPrice, setAgreementPrice] = useState("");
  const [agreementFrequency, setAgreementFrequency] = useState<"WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY">("MONTHLY");
  const [agreementStart, setAgreementStart] = useState("");
  const [agreementEnd, setAgreementEnd] = useState("");
  const [nextVisit, setNextVisit] = useState("");

  const respond = trpc.serviceRequests.respond.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const markInProgress = trpc.serviceRequests.markInProgress.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const complete = trpc.serviceRequests.complete.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const proposeQuote = trpc.serviceRequests.proposeQuote.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const proposeAgreement = trpc.serviceRequests.proposeAgreement.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const updateMilestone = trpc.serviceRequests.updateMilestone.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const scheduleOccurrence = trpc.serviceRequests.scheduleOccurrence.useMutation({ onSuccess: () => { utils.serviceRequests.forProvider.invalidate(); setNextVisit(""); } });
  const startOccurrence = trpc.serviceRequests.startOccurrence.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const completeOccurrence = trpc.serviceRequests.completeOccurrence.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
  const cancelAgreement = trpc.serviceRequests.cancelAgreement.useMutation({ onSuccess: () => utils.serviceRequests.forProvider.invalidate() });
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
      <p className="text-sm text-stone-500 mb-6">Respond to one-time jobs, prepare project quotes, and manage recurring service visits.</p>

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
                  setPriceInput(""); setAppointmentAt(""); setQuoteScope(""); setQuoteTotal(""); setMilestones([{ title: "Mobilisation and equipment", amount: "" }]);
                  setAgreementScope(""); setAgreementPrice(""); setAgreementFrequency(r.requestedFrequency ?? "MONTHLY"); setAgreementStart(""); setAgreementEnd(""); setNextVisit("");
                }}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 ${(activeId ?? requests[0].id) === r.id ? "bg-teal-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">{r.customer.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-xs text-stone-500">{CATEGORY_LABELS[r.category]} · {r.transactionType === "ONE_TIME" ? "One-time" : r.transactionType === "INSTALLATION_PROJECT" ? `Project · ${r.unitCount} unit(s)` : `Recurring · ${r.requestedFrequency?.toLowerCase()}`}</div>
                {r.siteName && <div className="text-[11px] text-stone-500 mt-1">{r.siteName}</div>}
                {r.siteAddress && <div className="text-[11px] text-stone-500 mt-1 truncate">{r.siteAddress}</div>}
                {r.preferredAt && <div className="text-[11px] text-stone-500">Preferred: {new Date(r.preferredAt).toLocaleString("en-NG")}</div>}
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

            {(active.siteAddress || active.preferredAt || active.scheduledAt) && <div className="px-3 py-2 bg-stone-50 border-b border-stone-100 text-[11px] text-stone-600">{active.siteAddress ? `Service location: ${active.siteAddress}` : ""}{active.preferredAt ? ` · Customer preferred: ${new Date(active.preferredAt).toLocaleString("en-NG")}` : ""}{active.scheduledAt ? ` · Confirmed: ${new Date(active.scheduledAt).toLocaleString("en-NG")}` : ""}</div>}

            {active.status === "REQUESTED" && active.transactionType === "ONE_TIME" && (
              <div className="p-3 border-b border-stone-200 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
                <input type="number" min="1" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="Agreed price (₦)" className="min-w-0 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
                <label className="text-[10px] text-stone-500">Confirm appointment
                  <input type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} className="block w-full border border-stone-300 rounded-lg px-2 py-2 text-xs" />
                </label>
                <button disabled={respond.isPending || Number(priceInput) <= 0 || (!!active.preferredAt && !appointmentAt)} onClick={() => respond.mutate({ serviceRequestId: active.id, status: "ACCEPTED", agreedPriceNaira: Number(priceInput), ...(appointmentAt ? { scheduledAt: new Date(appointmentAt).toISOString() } : {}) })} className="bg-teal-800 text-white rounded-lg px-3 text-xs font-semibold disabled:opacity-50">Accept</button>
                <button disabled={respond.isPending} onClick={() => respond.mutate({ serviceRequestId: active.id, status: "DECLINED" })} className="border border-stone-300 text-stone-600 rounded-lg px-3 text-xs font-semibold disabled:opacity-50">Decline</button>
              </div>
            )}

            {active.status === "REQUESTED" && active.transactionType !== "ONE_TIME" && (
              <div className="px-3 pt-3">
                <button disabled={respond.isPending} onClick={() => respond.mutate({ serviceRequestId: active.id, status: "DECLINED" })} className="border border-red-200 text-red-700 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Decline request</button>
              </div>
            )}

            {active.status === "REQUESTED" && active.transactionType === "INSTALLATION_PROJECT" && (
              <div className="p-3 border-b border-stone-200 space-y-2 max-h-64 overflow-y-auto">
                <div className="text-xs font-semibold text-stone-800">Installation project quote · {active.unitCount} unit(s)</div>
                <textarea value={quoteScope} onChange={(e) => setQuoteScope(e.target.value)} rows={2} placeholder="Scope, deliverables, inclusions and exclusions (20+ characters)" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-2"><input type="number" min="1" value={quoteTotal} onChange={(e) => { setQuoteTotal(e.target.value); if (milestones.length === 1) setMilestones([{ ...milestones[0], amount: e.target.value }]); }} placeholder="Total quote (₦)" className="border border-stone-300 rounded-lg px-3 py-2 text-xs"/><input type="number" min="1" max="3650" value={quoteDays} onChange={(e) => setQuoteDays(e.target.value)} placeholder="Duration days" className="border border-stone-300 rounded-lg px-3 py-2 text-xs"/></div>
                <div className="text-[11px] font-semibold text-stone-700">Payment / delivery milestones</div>
                {milestones.map((milestone, index) => <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2"><input value={milestone.title} onChange={(e) => setMilestones((items) => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Milestone title" className="border border-stone-300 rounded-lg px-2 py-2 text-xs"/><input type="number" min="1" value={milestone.amount} onChange={(e) => setMilestones((items) => items.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} placeholder="Amount ₦" className="border border-stone-300 rounded-lg px-2 py-2 text-xs"/><button type="button" disabled={milestones.length === 1} onClick={() => setMilestones((items) => items.filter((_, i) => i !== index))} className="text-xs text-red-700 disabled:opacity-30">Remove</button></div>)}
                <button type="button" disabled={milestones.length >= 20} onClick={() => setMilestones((items) => [...items, { title: "", amount: "" }])} className="text-xs text-teal-800 underline">+ Add milestone</button>
                <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-stone-500">Milestones: ₦{milestones.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()} / ₦{(Number(quoteTotal) || 0).toLocaleString()}</span><button disabled={proposeQuote.isPending || quoteScope.trim().length < 20 || Number(quoteTotal) <= 0 || Number(quoteDays) <= 0 || milestones.some((m) => m.title.trim().length < 3 || Number(m.amount) <= 0) || milestones.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) !== Number(quoteTotal)} onClick={() => proposeQuote.mutate({ serviceRequestId: active.id, scopeSummary: quoteScope, totalPriceNaira: Number(quoteTotal), estimatedDurationDays: Number(quoteDays), milestones: milestones.map((m) => ({ title: m.title, amountNaira: Number(m.amount) })) })} className="bg-teal-800 text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">{proposeQuote.isPending ? "Sending…" : "Send formal quote"}</button></div>
                {proposeQuote.error && <p role="alert" className="text-xs text-red-700">{proposeQuote.error.message}</p>}
              </div>
            )}

            {active.status === "REQUESTED" && active.transactionType === "RECURRING" && (
              <div className="p-3 border-b border-stone-200 space-y-2">
                <div className="text-xs font-semibold text-stone-800">Recurring service agreement</div>
                <textarea value={agreementScope} onChange={(e) => setAgreementScope(e.target.value)} rows={2} placeholder="Service scope and what each visit includes" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={active.requestedFrequency ?? agreementFrequency} onChange={(e) => setAgreementFrequency(e.target.value as typeof agreementFrequency)} className="border border-stone-300 rounded-lg px-3 py-2 text-xs"><option value="WEEKLY">Weekly</option><option value="FORTNIGHTLY">Fortnightly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option></select>
                  <input type="number" min="1" value={agreementPrice} onChange={(e) => setAgreementPrice(e.target.value)} placeholder="Price per visit (₦)" className="border border-stone-300 rounded-lg px-3 py-2 text-xs" />
                  <input type="date" value={agreementStart} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setAgreementStart(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-xs" />
                  <input type="date" value={agreementEnd} min={agreementStart || undefined} onChange={(e) => setAgreementEnd(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-xs" />
                </div>
                <button disabled={proposeAgreement.isPending || agreementScope.trim().length < 20 || Number(agreementPrice) <= 0 || !agreementStart || (!!agreementEnd && agreementEnd < agreementStart)} onClick={() => proposeAgreement.mutate({ serviceRequestId: active.id, serviceScope: agreementScope, frequency: active.requestedFrequency ?? agreementFrequency, pricePerVisitNaira: Number(agreementPrice), startAt: new Date(`${agreementStart}T09:00:00+01:00`).toISOString(), ...(agreementEnd ? { endAt: new Date(`${agreementEnd}T17:00:00+01:00`).toISOString() } : {}) })} className="bg-teal-800 text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">{proposeAgreement.isPending ? "Sending…" : "Send agreement proposal"}</button>
                {proposeAgreement.error && <p role="alert" className="text-xs text-red-700">{proposeAgreement.error.message}</p>}
              </div>
            )}

            {active.status === "PROPOSAL_PENDING" && <div className="p-3 border-b border-stone-200 text-xs text-violet-800 bg-violet-50">Proposal sent. Waiting for the customer to review and accept or decline the terms.</div>}

            {active.transactionType === "INSTALLATION_PROJECT" && active.quotes?.find((q) => q.status === "ACCEPTED") && (
              <div className="p-3 border-b border-stone-200 space-y-2 max-h-52 overflow-y-auto">
                <div className="text-xs font-semibold text-stone-800">Accepted project milestones</div>
                {active.quotes.find((q) => q.status === "ACCEPTED")!.milestones.map((milestone) => <div key={milestone.id} className="flex items-center justify-between gap-2 text-xs border-b border-stone-100 py-1.5"><span>{milestone.title} · ₦{Number(milestone.amountNaira).toLocaleString()}</span><span className="text-stone-500">{milestone.status}</span>{(milestone.status === "PENDING" || milestone.status === "IN_PROGRESS") && <button onClick={() => updateMilestone.mutate({ milestoneId: milestone.id, status: milestone.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED" })} className="text-teal-800 underline">{milestone.status === "PENDING" ? "Start" : "Mark complete"}</button>}</div>)}
              </div>
            )}

            {active.transactionType === "RECURRING" && active.recurringAgreements?.[0] && active.recurringAgreements[0].status !== "PROPOSED" && (
              <div className="p-3 border-b border-stone-200 space-y-2">
                <div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-stone-800">Recurring agreement · {active.recurringAgreements[0].frequency.toLowerCase()} · ₦{Number(active.recurringAgreements[0].pricePerVisitNaira).toLocaleString()} per visit · {active.recurringAgreements[0].status}</div>{active.recurringAgreements[0].status === "ACTIVE" && <button onClick={() => { if (window.confirm("Cancel this recurring agreement and its future scheduled visits?")) cancelAgreement.mutate({ agreementId: active.recurringAgreements[0].id }); }} className="text-xs text-red-700 underline">Cancel agreement</button>}</div>
                <div className="text-[11px] text-stone-500">Next due {new Date(active.recurringAgreements[0].nextServiceAt).toLocaleDateString("en-NG")}</div>
                {active.recurringAgreements[0].status === "ACTIVE" && <div className="flex gap-2"><input type="date" value={nextVisit} min={new Date(active.recurringAgreements[0].nextServiceAt).toISOString().slice(0, 10)} onChange={(e) => setNextVisit(e.target.value)} className="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-xs"/><button disabled={!nextVisit || scheduleOccurrence.isPending} onClick={() => scheduleOccurrence.mutate({ agreementId: active.recurringAgreements[0].id, scheduledAt: new Date(`${nextVisit}T09:00:00+01:00`).toISOString() })} className="bg-teal-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Schedule visit</button></div>}
                {active.recurringAgreements[0].occurrences.map((occurrence) => <div key={occurrence.id} className="flex items-center justify-between gap-2 text-xs border-t border-stone-100 py-2"><span>{new Date(occurrence.scheduledAt).toLocaleDateString("en-NG")} · {occurrence.status}</span>{occurrence.status === "SCHEDULED" && active.recurringAgreements[0].status === "ACTIVE" && <button onClick={() => startOccurrence.mutate({ occurrenceId: occurrence.id })} className="text-teal-800 underline">Start visit</button>}{occurrence.status === "IN_PROGRESS" && <button onClick={() => completeOccurrence.mutate({ occurrenceId: occurrence.id })} className="text-teal-800 underline">Complete visit</button>}</div>)}
              </div>
            )}

            {active.status === "ACCEPTED" && active.transactionType !== "RECURRING" && (
              <div className="p-3 border-b border-stone-200 flex gap-2">
                <button
                  disabled={markInProgress.isPending}
                  onClick={() => markInProgress.mutate({ serviceRequestId: active.id })}
                  className="border border-stone-300 text-stone-600 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Mark in progress
                </button>
                <button
                  disabled={complete.isPending || (active.transactionType === "INSTALLATION_PROJECT" && !active.quotes?.find((q) => q.status === "ACCEPTED")?.milestones.every((m) => m.status === "APPROVED"))}
                  onClick={() => complete.mutate({ serviceRequestId: active.id })}
                  className="bg-emerald-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {complete.isPending && <Loader2 size={12} className="animate-spin" />}
                  Mark complete
                </button>
              </div>
            )}

            {active.status === "IN_PROGRESS" && active.transactionType !== "RECURRING" && (
              <div className="p-3 border-b border-stone-200">
                <button
                  disabled={complete.isPending || (active.transactionType === "INSTALLATION_PROJECT" && !active.quotes?.find((q) => q.status === "ACCEPTED")?.milestones.every((m) => m.status === "APPROVED"))}
                  onClick={() => complete.mutate({ serviceRequestId: active.id })}
                  className="bg-emerald-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {complete.isPending && <Loader2 size={12} className="animate-spin" />}
                  Mark complete
                </button>
              </div>
            )}

            {complete.error && <div className="px-3 py-2 text-xs text-red-700">{complete.error.message}</div>}
            {updateMilestone.error && <div className="px-3 py-2 text-xs text-red-700">{updateMilestone.error.message}</div>}
            {scheduleOccurrence.error && <div className="px-3 py-2 text-xs text-red-700">{scheduleOccurrence.error.message}</div>}
            {startOccurrence.error && <div className="px-3 py-2 text-xs text-red-700">{startOccurrence.error.message}</div>}
            {completeOccurrence.error && <div className="px-3 py-2 text-xs text-red-700">{completeOccurrence.error.message}</div>}
            {cancelAgreement.error && <div className="px-3 py-2 text-xs text-red-700">{cancelAgreement.error.message}</div>}
            {respond.error && <div className="px-3 py-2 text-xs text-red-700">{respond.error.message}</div>}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {active.messages.map((m) => {
                const fromCustomer = m.senderId === active.customerId;
                return (
                  <div
                    key={m.id}
                    className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                    style={fromCustomer ? { alignSelf: "flex-start", background: "#F6F7F1" } : { alignSelf: "flex-end", background: "#0B2A5A", color: "#fff" }}
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
