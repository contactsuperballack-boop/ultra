"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { INSPECTION_STATUS_LABELS, formatInspectionDate, kindLabel, slotLabel } from "@ultra/db/src/inspection";

const ACTION_LABELS: Record<string, string> = { CANCEL: "Cancel request", ACCEPT_RESCHEDULE: "Accept new time" };

export default function MyInspectionsPage() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading, error } = trpc.inspections.mine.useQuery();
  const transition = trpc.inspections.transition.useMutation({ onSuccess: () => { utils.inspections.mine.invalidate(); utils.inquiries.myThreads.invalidate(); utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); } });

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-7">
        <p className="text-[11px] tracking-widest text-stone-500 font-mono mb-1">BUYER ACTIVITY</p>
        <h1 className="text-3xl font-semibold text-stone-900">My inspections</h1>
        <p className="text-sm text-stone-500 mt-2">Track property visits, virtual viewings and title-review requests.</p>
      </div>
      {isLoading && <p className="text-sm text-stone-500">Loading inspection requests…</p>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error.message.includes("Sign in") ? <>Please <Link className="font-semibold underline" href="/auth/login?next=%2Fmy-inspections">sign in</Link> to view your requests.</> : error.message}</div>}
      {requests && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <CalendarCheck size={24} className="mx-auto text-stone-400 mb-3" />
          <h2 className="font-semibold text-stone-800">No inspection requests yet</h2>
          <p className="text-sm text-stone-500 mt-1 mb-4">Request a visit, virtual viewing or title review from a property page.</p>
          <Link href="/search" className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Find a property</Link>
        </div>
      )}
      <div className="space-y-3">
        {requests?.map((request) => {
          const date = request.scheduledDate ?? request.proposedDate ?? request.preferredDate;
          const slot = request.scheduledSlot ?? request.proposedSlot ?? request.preferredSlot;
          return (
            <article key={request.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/listings/${request.listing.id}`} className="font-semibold text-stone-900 hover:text-emerald-800">{request.listing.title}</Link>
                  <p className="text-xs text-stone-500 mt-1">{request.listing.area}, {request.listing.city}</p>
                  <p className="text-xs text-stone-600 mt-2">{kindLabel(request.kind)} · {formatInspectionDate(date)} · {slotLabel(slot)}</p>
                  {request.status === "RESCHEDULE_PROPOSED" && request.proposedDate && request.proposedSlot && <p className="text-xs text-sky-800 mt-2">The realtor proposed {formatInspectionDate(request.proposedDate)}, {slotLabel(request.proposedSlot).toLowerCase()}.</p>}
                </div>
                <span className="text-[11px] font-medium px-2 py-1 rounded-full border border-stone-200 bg-stone-50 text-stone-700 whitespace-nowrap">{INSPECTION_STATUS_LABELS[request.status]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {request.actions.map((action) => (
                  <button key={action} disabled={transition.isPending} onClick={() => transition.mutate({ id: request.id, action })} className={`text-xs rounded-lg px-3 py-2 disabled:opacity-50 ${action === "ACCEPT_RESCHEDULE" ? "bg-emerald-800 text-white" : "border border-stone-300 text-stone-700"}`}>
                    {ACTION_LABELS[action] ?? action}
                  </button>
                ))}
                <Link href="/messages" className="text-xs font-semibold text-emerald-800 underline ml-auto">Open messages</Link>
              </div>
            </article>
          );
        })}
      </div>
      {transition.error && <p role="alert" className="text-xs text-red-700 mt-4">{transition.error.message}</p>}
    </main>
  );
}
