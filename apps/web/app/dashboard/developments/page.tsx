"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { extractYouTubeVideoId } from "@ultra/db/src/youtube";

const field = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-800";

export default function DevelopmentsDashboard() {
  const utils = trpc.useUtils();
  const { data: mine, isLoading, error } = trpc.developments.mine.useQuery();
  const create = trpc.developments.create.useMutation({
    onSuccess: () => {
      utils.developments.mine.invalidate();
      setForm(empty);
    },
  });

  const empty = { name: "", description: "", area: "", architect: "", builder: "", developer: "", completionYear: "", youtubeUrl: "" };
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const youtubeBad = form.youtubeUrl.trim() !== "" && !extractYouTubeVideoId(form.youtubeUrl);
  const valid = form.name.trim().length >= 2 && form.description.trim().length >= 40 && form.area.trim().length >= 2 && !youtubeBad;

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Developments</h1>
        <Link href="/dashboard/listings" className="text-sm text-emerald-800 font-medium">← Listings</Link>
      </div>
      <p className="text-sm text-stone-500 mb-6">Create an estate, complex or tower once, then add each home or unit to it from the new-listing form. Shared details are entered here, not repeated on every unit.</p>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">Only verified realtors can manage developments.</div>}

      <section className="mb-10">
        {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
        {mine && mine.length === 0 && <div className="text-sm text-stone-500">No developments yet.</div>}
        <div className="flex flex-col gap-3">
          {mine?.map((d) => (
            <div key={d.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-stone-900">{d.name}</div>
                <div className="text-xs text-stone-500">{d.area}, {d.city} · {d.unitCount} unit{d.unitCount === 1 ? "" : "s"} ({d.liveCount} live)</div>
                <span className={`inline-flex mt-2 rounded-full px-2 py-1 text-[10px] font-semibold ${d.status === "APPROVED" ? "bg-emerald-50 text-emerald-800" : d.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{d.status === "APPROVED" ? "Approved" : d.status === "REJECTED" ? "Changes required" : "Pending review"}</span>
                {d.moderationNote && <p className="text-xs text-stone-500 mt-1">Review note: {d.moderationNote}</p>}
              </div>
              {d.status === "APPROVED" ? <Link href={`/developments/${d.id}`} className="text-xs font-medium text-emerald-800 whitespace-nowrap">View page →</Link> : <span className="text-xs text-stone-400 whitespace-nowrap">Not public</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-stone-900">New development</h2>
        <input className={field} placeholder="Name" value={form.name} onChange={set("name")} maxLength={80} />
        <input className={field} placeholder="Area (for example Guzape)" value={form.area} onChange={set("area")} maxLength={60} />
        <textarea className={field} rows={4} placeholder="Describe the development (at least 40 characters)" value={form.description} onChange={set("description")} maxLength={2000} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={field} placeholder="Designed by (optional)" value={form.architect} onChange={set("architect")} maxLength={80} />
          <input className={field} placeholder="Built by (optional)" value={form.builder} onChange={set("builder")} maxLength={80} />
          <input className={field} placeholder="Developed by (optional)" value={form.developer} onChange={set("developer")} maxLength={80} />
          <input className={field} type="number" placeholder="Year completed (optional)" value={form.completionYear} onChange={set("completionYear")} min={1950} max={new Date().getFullYear()} />
        </div>
        <div>
          <input className={field} placeholder="YouTube film of the development (optional)" value={form.youtubeUrl} onChange={set("youtubeUrl")} />
          {youtubeBad && <p className="text-[11px] text-red-700 mt-1">That isn't a YouTube link.</p>}
        </div>
        <p className="text-[11px] text-stone-500">Credits are shown as supplied by you and aren't independently verified by ULTRA.</p>
        {create.error && <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{create.error.message}</div>}
        <button
          disabled={!valid || create.isPending}
          onClick={() =>
            create.mutate({
              name: form.name.trim(),
              description: form.description.trim(),
              area: form.area.trim(),
              architect: form.architect.trim() || undefined,
              builder: form.builder.trim() || undefined,
              developer: form.developer.trim() || undefined,
              completionYear: form.completionYear ? Number(form.completionYear) : undefined,
              youtubeUrl: form.youtubeUrl.trim() || undefined,
            })
          }
          className="bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Create development"}
        </button>
      </section>
    </main>
  );
}
