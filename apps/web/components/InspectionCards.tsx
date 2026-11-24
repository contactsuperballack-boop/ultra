"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  INSPECTION_SLOTS,
  INSPECTION_STATUS_LABELS,
  formatInspectionDate,
  kindLabel,
  slotLabel,
  todayInNigeria,
  type InspectionAction,
  type InspectionSlot,
  type InspectionStatus,
} from "@ultra/db/src/inspection";

const ACTION_LABELS: Record<InspectionAction, string> = {
  ACCEPT: "Confirm",
  DECLINE: "Decline",
  RESCHEDULE: "Propose another time",
  CANCEL: "Cancel request",
  ACCEPT_RESCHEDULE: "Accept new time",
  COMPLETE: "Mark completed",
};

const TONES: Record<InspectionStatus, string> = {
  REQUESTED: "bg-amber-50 text-amber-800 border-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  RESCHEDULE_PROPOSED: "bg-sky-50 text-sky-800 border-sky-200",
  DECLINED: "bg-stone-100 text-stone-600 border-stone-200",
  CANCELLED: "bg-stone-100 text-stone-600 border-stone-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

/**
 * Inspection requests for one inquiry thread, with the buttons each side is
 * allowed to press. The server decides which actions are offered (and
 * re-checks them on submit), so this never has to know the rules.
 */
export function InspectionCards({ inquiryId }: { inquiryId: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.inspections.forInquiry.useQuery({ inquiryId });
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState<InspectionSlot>("MORNING");

  const transition = trpc.inspections.transition.useMutation({
    onSuccess: () => {
      setReschedulingId(null);
      setNewDate("");
      utils.inspections.forInquiry.invalidate({ inquiryId });
      utils.inspections.mine.invalidate();
      utils.inquiries.byId.invalidate();
      utils.inquiries.myThreads.invalidate();
      utils.inquiries.forRealtor.invalidate();
    },
  });

  if (!data || data.items.length === 0) return null;
  const tomorrow = (() => {
    const d = new Date(`${todayInNigeria()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 flex flex-col gap-2" aria-label="Inspection requests">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Inspection requests</div>
      {data.items.map((r) => {
        const when = r.scheduledDate ?? r.preferredDate;
        const slot = r.scheduledSlot ?? r.preferredSlot;
        return (
          <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-stone-900">{kindLabel(r.kind)}</div>
                <div className="text-xs text-stone-600">
                  {formatInspectionDate(when)}, {slotLabel(slot).toLowerCase()}
                </div>
                {r.status === "RESCHEDULE_PROPOSED" && r.proposedDate && r.proposedSlot && (
                  <div className="text-xs text-sky-800 mt-1">
                    Proposed instead: {formatInspectionDate(r.proposedDate)}, {slotLabel(r.proposedSlot).toLowerCase()}
                  </div>
                )}
                {r.notes && <div className="text-xs text-stone-500 mt-1">“{r.notes}”</div>}
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${TONES[r.status]}`}>{INSPECTION_STATUS_LABELS[r.status]}</span>
            </div>

            {r.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {r.actions.map((a) =>
                  a === "RESCHEDULE" ? (
                    <button key={a} onClick={() => setReschedulingId(reschedulingId === r.id ? null : r.id)} className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 text-stone-700">
                      {ACTION_LABELS[a]}
                    </button>
                  ) : (
                    <button
                      key={a}
                      disabled={transition.isPending}
                      onClick={() => transition.mutate({ id: r.id, action: a })}
                      className={`text-xs rounded-lg px-3 py-1.5 disabled:opacity-50 ${a === "ACCEPT" || a === "ACCEPT_RESCHEDULE" || a === "COMPLETE" ? "bg-emerald-800 text-white" : "border border-stone-300 text-stone-700"}`}
                    >
                      {ACTION_LABELS[a]}
                    </button>
                  )
                )}
              </div>
            )}

            {reschedulingId === r.id && (
              <div className="flex flex-wrap items-end gap-2 mt-3">
                <input type="date" min={tomorrow} value={newDate} onChange={(e) => setNewDate(e.target.value)} className="border border-stone-300 rounded-lg px-2 py-1.5 text-xs" />
                <select value={newSlot} onChange={(e) => setNewSlot(e.target.value as InspectionSlot)} className="border border-stone-300 rounded-lg px-2 py-1.5 text-xs">
                  {INSPECTION_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button
                  disabled={!newDate || transition.isPending}
                  onClick={() => transition.mutate({ id: r.id, action: "RESCHEDULE", proposedDate: newDate, proposedSlot: newSlot })}
                  className="text-xs bg-emerald-800 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Send proposal
                </button>
              </div>
            )}
          </div>
        );
      })}
      {transition.error && <div role="alert" className="text-xs text-red-700">{transition.error.message}</div>}
    </div>
  );
}
