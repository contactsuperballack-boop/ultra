"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminDevelopmentsPage() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();
  const queue = trpc.admin.developmentQueue.useQuery({ status });
  const review = trpc.admin.reviewDevelopment.useMutation({
    onSuccess: async () => { await utils.admin.developmentQueue.invalidate(); },
  });

  return <main className="max-w-6xl mx-auto px-6 py-10">
    <h1 className="text-2xl font-semibold text-stone-900">Development moderation</h1>
    <p className="text-sm text-stone-500 mt-1 mb-6">Only approved developments can appear on public development pages or discovery results.</p>
    <div className="flex gap-2 mb-6">{(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-2 text-xs border ${status === s ? "bg-stone-900 text-white" : "bg-white"}`}>{s}</button>)}</div>
    {queue.isLoading && <p>Loading developments…</p>}
    {queue.data?.length === 0 && <p className="text-sm text-stone-500">No {status.toLowerCase()} developments.</p>}
    <div className="space-y-4">{queue.data?.map((d) => <article key={d.id} className="border border-stone-200 rounded-xl p-5 bg-white">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-lg">{d.name}</h2><p className="text-sm text-stone-500">{d.area}, {d.city} · {d.realtorProfile.agencyName} · {d.realtorProfile.user.name} ({d.realtorProfile.user.phone})</p></div><span className="text-xs rounded-full bg-stone-100 px-3 py-1 h-fit">{d.status}</span></div>
      <p className="text-sm mt-3 whitespace-pre-wrap">{d.description}</p>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-4 text-stone-600"><div>Architect: {d.architect || "Not supplied"}</div><div>Builder: {d.builder || "Not supplied"}</div><div>Developer: {d.developer || "Not supplied"}</div><div>Completion: {d.completionYear || "Not supplied"}</div></dl>
      <p className="text-xs mt-3">Units linked: {d.listings.length}</p>
      {d.youtubeVideoId && <a className="text-sm underline inline-block mt-2" href={`https://www.youtube.com/watch?v=${d.youtubeVideoId}`} target="_blank" rel="noreferrer">Review development film</a>}
      {status === "PENDING" && <div className="mt-4"><textarea value={notes[d.id] || ""} onChange={(e) => setNotes((v) => ({ ...v, [d.id]: e.target.value }))} placeholder="Review note (required when rejecting)" className="w-full border rounded-lg p-3 text-sm" />
        <div className="flex gap-2 mt-3"><button disabled={review.isPending} onClick={() => review.mutate({ id: d.id, decision: "APPROVED", note: notes[d.id] })} className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-50">Approve</button><button disabled={review.isPending || (notes[d.id] || "").trim().length < 5} onClick={() => review.mutate({ id: d.id, decision: "REJECTED", note: notes[d.id] })} className="rounded-lg bg-red-700 text-white px-4 py-2 text-sm disabled:opacity-50">Reject</button></div>
      </div>}
    </article>)}</div>
  </main>;
}
