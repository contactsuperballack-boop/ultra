"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
// Deep import: pure rules (kinds, slots, date window), no Prisma in the browser bundle.
import { INSPECTION_KINDS, INSPECTION_SLOTS, MAX_ADVANCE_DAYS, todayInNigeria, validateInspectionDate, type InspectionKind, type InspectionSlot } from "@ultra/db/src/inspection";

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function InspectionRequestModal({ listingId, agencyName, onClose }: { listingId: string; agencyName: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const pathname = usePathname();
  const today = useMemo(() => todayInNigeria(), []);
  const [kind, setKind] = useState<InspectionKind>("PHYSICAL");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<InspectionSlot>("MORNING");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const request = trpc.inspections.request.useMutation({
    onSuccess: () => {
      utils.inspections.mine.invalidate();
      utils.inquiries.myThreads.invalidate();
    },
  });

  const submit = () => {
    const check = validateInspectionDate(date, today);
    if (!check.ok) return setLocalError(check.reason);
    setLocalError(null);
    request.mutate({ listingId, kind, preferredDate: date, slot, notes: notes.trim() || undefined });
  };

  const signInNeeded = request.error?.message === "Sign in required.";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Request an inspection" className="bg-white w-full max-w-md rounded-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Request an inspection</h2>
            <p className="text-xs text-stone-500 mt-0.5">{agencyName} will confirm, decline or suggest another time.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-stone-500"><X size={18} /></button>
        </div>

        {request.isSuccess ? (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            Request sent. You'll find it, and any reply, in{" "}
            <Link href="/messages" className="font-semibold underline">Messages</Link>.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="text-xs font-semibold text-stone-700 mb-1.5">What would you like to do?</legend>
              <div className="flex flex-col gap-2">
                {INSPECTION_KINDS.map((k) => (
                  <label key={k.value} className={`flex gap-3 items-start border rounded-xl p-3 cursor-pointer ${kind === k.value ? "border-emerald-800 bg-emerald-50" : "border-stone-200"}`}>
                    <input type="radio" name="kind" checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-medium text-stone-900">{k.label}</span>
                      <span className="block text-xs text-stone-500">{k.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-stone-700 mb-1.5">Preferred date</span>
                <input type="date" value={date} min={addDays(today, 1)} max={addDays(today, MAX_ADVANCE_DAYS)} onChange={(e) => setDate(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-stone-700 mb-1.5">Time of day</span>
                <select value={slot} onChange={(e) => setSlot(e.target.value as InspectionSlot)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                  {INSPECTION_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-stone-700 mb-1.5">Anything the realtor should know? (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} placeholder="For example: I'll be bringing my surveyor." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </label>

            {(localError || request.error) && (
              <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {localError ??
                  (signInNeeded ? (
                    <>
                      <Link href={`/auth/login?next=${encodeURIComponent(pathname || "/")}`} className="font-semibold underline">Sign in</Link> to request an inspection.
                    </>
                  ) : (
                    request.error!.message
                  ))}
              </div>
            )}

            <button onClick={submit} disabled={request.isPending || !date} className="bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
              {request.isPending ? "Sending…" : "Send request"}
            </button>
            <p className="text-[11px] text-stone-500 text-center">Your phone number isn't shared. Everything stays in ULTRA Messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
