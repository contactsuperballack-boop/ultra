"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, MapPin, User } from "lucide-react";
// Deep import: pure helper, no Prisma in the browser bundle.
import { youTubeEmbedUrl } from "@ultra/db/src/youtube";

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

const PRICE_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed price",
  HOURLY: "Per hour",
  QUOTE: "Quote on request",
};

function formatNaira(n: bigint | number | null) {
  if (n === null || n === undefined) return "—";
  return `\u20a6${Number(n).toLocaleString()}`;
}

export default function ProviderDetailPage({ params }: { params: { id: string } }) {
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [transactionType, setTransactionType] = useState<"ONE_TIME" | "INSTALLATION_PROJECT" | "RECURRING">("ONE_TIME");
  const [unitCount, setUnitCount] = useState(1);
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [frequency, setFrequency] = useState<"WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY">("MONTHLY");
  const [sent, setSent] = useState(false);
  const { data: provider, isLoading } = trpc.providers.byId.useQuery({ id: params.id });
  const request = trpc.serviceRequests.create.useMutation({ onSuccess: () => setSent(true) });

  if (isLoading) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Loading…</div>;
  if (!provider) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Provider not found.</div>;

  const selectedOffering = provider.offerings.find((o: any) => o.id === selectedOfferingId) ?? provider.offerings[0];

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-semibold text-xl flex-shrink-0">
          {provider.businessName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            {provider.businessName}
            {provider.verificationStatus === "VERIFIED" && (
              <span title="Verified provider" className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
            <MapPin size={13} className="text-emerald-800" /> {provider.serviceArea}
            {provider.operatingSince ? ` · Since ${provider.operatingSince}` : ""}
          </div>
        </div>
      </div>

      {provider.bio && <p className="text-sm text-stone-600 leading-relaxed mb-6">{provider.bio}</p>}

      {provider.contactName && (
        <div className="flex items-center gap-2 text-sm text-stone-700 mb-5">
          <User size={15} className="text-emerald-800" />
          <span>Contact person: <strong>{provider.contactName}</strong>{provider.contactRole ? `, ${provider.contactRole}` : ""}</span>
        </div>
      )}

      {provider.specialties?.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-stone-900 mb-2">Specialties</div>
          <div className="flex flex-wrap gap-2">
            {provider.specialties.map((s: string) => (
              <span key={s} className="px-3 py-1 rounded-full bg-stone-50 border border-stone-200 text-xs font-medium text-stone-700">{s}</span>
            ))}
          </div>
        </div>
      )}

      {provider.equipment?.length > 0 && (
        <p className="text-xs text-stone-500 mb-5"><span className="font-semibold text-stone-700">Equipment: </span>{provider.equipment.join(" · ")}</p>
      )}

      {provider.proofVideoIds?.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-stone-900 mb-2">Project proof</div>
          <div className={`grid gap-3 ${provider.proofVideoIds.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {provider.proofVideoIds.map((id: string) => (
              <div key={id} className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-stone-200">
                <iframe
                  src={youTubeEmbedUrl(id)}
                  title={`${provider.businessName} project video`}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-stone-500 mb-6">Company details and videos are supplied by the provider and aren't independently verified by ULTRA.</p>

      <div className="text-sm font-semibold text-stone-900 mb-3">Offerings</div>
      <div className="space-y-2 mb-6">
        {provider.offerings.map((o: any) => (
          <button
            key={o.id}
            onClick={() => {
              setSelectedOfferingId(o.id);
              setSent(false);
            }}
            className={`w-full text-left border rounded-xl p-4 ${
              (selectedOfferingId ?? provider.offerings[0]?.id) === o.id ? "border-teal-700 bg-teal-50" : "border-stone-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-semibold text-stone-900">{o.title}</div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">{CATEGORY_LABELS[o.category]}</span>
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {o.priceNaira ? formatNaira(o.priceNaira) : PRICE_TYPE_LABELS[o.priceType]}
                {o.priceType === "HOURLY" && o.priceNaira && <span className="text-xs text-stone-500 font-normal">/hr</span>}
              </div>
            </div>
            <p className="text-xs text-stone-600 mt-1.5">{o.description}</p>
          </button>
        ))}
      </div>

      {provider.offerings.length === 0 && (
        <div className="text-sm text-stone-500 text-center py-10 border border-dashed border-stone-300 rounded-xl mb-6">
          This provider hasn't added any offerings yet.
        </div>
      )}

      {provider.offerings.length > 0 && (
        <div>
          {sent ? (
            <div className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-xl p-4">
              Request sent — {provider.businessName} will respond in-app with a price and schedule.
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-stone-900 mb-2">How would you like to engage this provider?</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {[
                  ["ONE_TIME", "One-time service", "A single job or callout"],
                  ["INSTALLATION_PROJECT", "Installation project", "Quoted scope, milestones or multiple units"],
                  ["RECURRING", "Recurring service", "Ongoing scheduled service"],
                ].map(([value, title, hint]) => (
                  <button key={value} type="button" onClick={() => setTransactionType(value as typeof transactionType)} className={`text-left rounded-xl border p-3 ${transactionType === value ? "border-teal-700 bg-teal-50" : "border-stone-200 bg-white"}`}>
                    <div className="text-xs font-semibold text-stone-900">{title}</div><div className="text-[11px] text-stone-500 mt-1">{hint}</div>
                  </button>
                ))}
              </div>
              {transactionType === "INSTALLATION_PROJECT" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label className="text-xs text-stone-600">Number of units
                    <input type="number" min={1} max={500} value={unitCount} onChange={(e) => setUnitCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label className="text-xs text-stone-600">Estate / project name {unitCount > 1 ? "*" : "(optional)"}
                    <input value={siteName} onChange={(e) => setSiteName(e.target.value)} maxLength={120} placeholder="e.g. Greenview Estate" className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <label className="text-xs text-stone-600">Service location / address
                  <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} maxLength={240} placeholder="Area, estate or street address" className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                </label>
                {transactionType === "ONE_TIME" && <label className="text-xs text-stone-600">Preferred appointment (optional)
                  <input type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                </label>}
              </div>
              {transactionType === "RECURRING" && (
                <label className="block text-xs text-stone-600 mb-3">Preferred service frequency
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="WEEKLY">Weekly</option><option value="FORTNIGHTLY">Every two weeks</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option>
                  </select>
                </label>
              )}
              <div className="text-xs font-semibold text-stone-700 mb-1">Describe the job or service scope</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={transactionType === "INSTALLATION_PROJECT" ? "Describe the site, units, scope, materials or installation requirements…" : transactionType === "RECURRING" ? "Describe the ongoing service, site requirements and preferred start date…" : "e.g. 3-bedroom flat, need full interior repaint"} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
              <div className="flex items-center justify-between gap-3 mt-3">
                <p className="text-[11px] text-stone-500">{transactionType === "ONE_TIME" ? "The provider will accept or decline and confirm the price." : transactionType === "INSTALLATION_PROJECT" ? "The provider will send a written quote with milestones for your approval." : "The provider will propose an agreement with price per visit and service frequency."}</p>
                <button
                  disabled={request.isPending || note.trim().length < 10 || !selectedOffering || (transactionType === "INSTALLATION_PROJECT" && unitCount > 1 && siteName.trim().length < 2)}
                  onClick={() => request.mutate({
                    providerProfileId: provider.id,
                    offeringId: selectedOffering?.id,
                    category: selectedOffering?.category,
                    transactionType,
                    ...(transactionType === "INSTALLATION_PROJECT" ? { unitCount, siteName: siteName.trim() || undefined } : {}),
                    ...(siteAddress.trim() ? { siteAddress: siteAddress.trim() } : {}),
                    ...(transactionType === "ONE_TIME" && preferredAt ? { preferredAt: new Date(preferredAt).toISOString() } : {}),
                    ...(transactionType === "RECURRING" ? { requestedFrequency: frequency } : {}),
                    note,
                  })}
                  className="shrink-0 bg-teal-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {request.isPending ? "Sending…" : "Request service"}
                </button>
              </div>
            </>
          )}
          {request.error && (
            <div className="text-xs text-red-700 mt-2">
              {request.error.message === "Sign in required." ? "Sign in required to request a provider." : request.error.message}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
