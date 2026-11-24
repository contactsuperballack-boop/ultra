"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Image as ImageIcon, FileText, ExternalLink } from "lucide-react";
import { ModelViewer } from "@/components/ModelViewer";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  return num >= 1_000_000 ? `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${num.toLocaleString()}`;
}

const EVIDENCE_OPTIONS = [
  { value: "OWNER_LISTING", label: "Owner listing" },
  { value: "AUTHORIZED_AGENT", label: "Authorized agent" },
  { value: "AGENCY_MANDATE", label: "Agency mandate" },
  { value: "DEVELOPER_LISTING", label: "Developer listing" },
  { value: "LAND_REPRESENTATIVE", label: "Land representative" },
] as const;

export default function FlaggedListingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.listings.flagged.useInfiniteQuery(
      {},
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
  const listings = data?.pages.flatMap((p) => p.items);
  const decide = trpc.listings.adminSetStatus.useMutation({
    onSuccess: () => utils.listings.flagged.invalidate(),
  });
  const [evidence, setEvidence] = useState<Record<string, (typeof EVIDENCE_OPTIONS)[number]["value"]>>({});
  const [mediaReviewed, setMediaReviewed] = useState<Record<string, boolean>>({});

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Flagged Listings</h1>
      <p className="text-sm text-stone-500 mb-6">{listings?.length ?? "—"} loaded, awaiting a decision</p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message.includes("Admin") || error.message.includes("Sign in")
            ? "Requires a signed-in ADMIN or SUPER_ADMIN session. Sign in at /auth/login with a seeded admin account."
            : error.message}
        </div>
      )}

      {listings?.length === 0 && <div className="text-sm text-stone-500">Nothing flagged right now.</div>}

      <div className="space-y-4">
        {listings?.map((l) => (
          <div key={l.id} className="border border-stone-200 rounded-xl p-5 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-stone-900">{l.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {l.area} · {formatNaira(l.priceNaira)} · {l.realtorProfile.agencyName}
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-1 rounded-full ${
                  l.status === "UNDER_REVIEW" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {l.status.replace("_", " ")}
              </span>
            </div>

            {l.flagReason && (
              <div className="flex gap-2 items-start mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                {l.flagReason}
              </div>
            )}

            <section className="mt-4 border-t border-stone-100 pt-4 space-y-3">
              <h2 className="text-sm font-semibold text-stone-900">Public profile review</h2>
              <p className="text-[11px] text-stone-500">Review the complete information and media that will be visible to buyers before approving this listing.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div><span className="text-stone-500">Property type</span><div className="font-medium">{l.type} · {l.category ?? "Land"}</div></div>
                <div><span className="text-stone-500">Size</span><div className="font-medium">{l.sizeSqm.toLocaleString()} sqm</div></div>
                <div><span className="text-stone-500">Bedrooms / bathrooms</span><div className="font-medium">{l.bedrooms ?? "—"} / {l.bathrooms ?? "—"}</div></div>
                <div><span className="text-stone-500">Architect</span><div className="font-medium">{l.architect ?? "Not supplied"}</div></div>
                <div><span className="text-stone-500">Builder</span><div className="font-medium">{l.builder ?? "Not supplied"}</div></div>
                <div><span className="text-stone-500">Developer</span><div className="font-medium">{l.developer ?? "Not supplied"}</div></div>
                <div><span className="text-stone-500">Completion year</span><div className="font-medium">{l.completionYear ?? "Not supplied"}</div></div>
                <div><span className="text-stone-500">Submitted by</span><div className="font-medium">{l.realtorProfile.user.name} · {l.realtorProfile.agencyName}</div></div>
                <div><span className="text-stone-500">Realtor verification</span><div className="font-medium">{l.realtorProfile.verificationStatus}</div></div>
              </div>
              <div className="text-xs text-stone-700 bg-stone-50 rounded-lg p-3 whitespace-pre-line">{l.description}</div>

              {l.ownerStatement && (
                <div className="border border-stone-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-stone-800 mb-1">Statement from {l.statementAuthorRole === "OWNER" ? "the owner" : l.statementAuthorRole === "DEVELOPER" ? "the developer" : "an authorised representative"}</div>
                  <p className="text-xs text-stone-700 whitespace-pre-line">{l.ownerStatement}</p>
                  <p className="text-[11px] text-stone-500 mt-2">{l.statementAuthorName ?? "Name not supplied"} · Submitted by the listing realtor; not independently verified by ULTRA.</p>
                </div>
              )}

              {l.development && (
                <div className="border border-stone-200 rounded-lg p-3 text-xs">
                  <div className="font-semibold text-stone-800">Linked development: {l.development.name}</div>
                  <p className="text-stone-600 mt-1">{l.development.description}</p>
                  <p className="text-stone-500 mt-1">{l.development.area}, {l.development.city}</p>
                  <p className="text-stone-500">Architect: {l.development.architect ?? "—"} · Builder: {l.development.builder ?? "—"} · Developer: {l.development.developer ?? "—"} · Completion: {l.development.completionYear ?? "—"}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-stone-800 mb-2 flex items-center gap-1"><ImageIcon size={13}/> All submitted photos and floor plans ({l.photos.length})</h3>
                {l.photos.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {l.photos.map((photo) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                        <img src={photo.url} alt={`${l.title} ${photo.roomType ?? "property"}`} className="w-full h-28 object-cover" loading="lazy" />
                        <span className="block px-2 py-1 text-[10px] text-stone-600">{photo.roomType === "FLOOR_PLAN" ? "Floor plan" : (photo.roomType ?? "Uncategorised").replaceAll("_", " ")} · Open <ExternalLink className="inline" size={10}/></span>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-xs text-amber-700">No photos supplied.</p>}
              </div>

              {l.youtubeVideoId && (
                <div>
                  <h3 className="text-xs font-semibold text-stone-800 mb-2">Submitted YouTube property film</h3>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-stone-900">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${l.youtubeVideoId}?rel=0`}
                      title={`${l.title} — submitted property film`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
              {l.model3dUrl && <div><h3 className="text-xs font-semibold text-stone-800 mb-2">Submitted 3D model</h3><ModelViewer url={l.model3dUrl} title={l.title} /></div>}

              <label className="flex items-start gap-2 text-xs text-stone-700 border border-amber-200 bg-amber-50 rounded-lg p-3">
                <input type="checkbox" checked={!!mediaReviewed[l.id]} onChange={(e) => setMediaReviewed((v) => ({ ...v, [l.id]: e.target.checked }))} className="mt-0.5" />
                <span>I've reviewed the submitted profile details and all available media, and checked the ownership/authorisation information supplied for this listing. I understand approval publishes it to buyers.</span>
              </label>
            </section>

            <div className="mt-3">
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                Ownership/authorization evidence (Readiness §3C — optional, but leaving this unset keeps it honestly "pending")
              </label>
              <select
                value={evidence[l.id] ?? ""}
                onChange={(e) => setEvidence((ev) => ({ ...ev, [l.id]: e.target.value as any }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs outline-none"
              >
                <option value="">— not set —</option>
                {EVIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => decide.mutate({ id: l.id, status: "LIVE", ownershipEvidence: evidence[l.id] })}
                disabled={decide.isPending || !mediaReviewed[l.id]}
                className="bg-emerald-800 text-white text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Approve & Publish
              </button>
              <button
                onClick={() => decide.mutate({ id: l.id, status: "REMOVED" })}
                disabled={decide.isPending}
                className="bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full mt-4 border border-stone-300 text-stone-700 text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
