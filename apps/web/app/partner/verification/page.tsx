"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/upload";
import { Check, Upload, Loader2 } from "lucide-react";

const DEPARTMENTS = [
  { label: "Smart Home Installations", items: [{ value: "SOLAR", label: "Solar installations" }, { value: "CCTV", label: "CCTV installations" }, { value: "SECURITY_SYSTEMS", label: "Security systems" }] },
  { label: "Luxury", items: [{ value: "PAINTING", label: "Painting" }, { value: "FURNITURE", label: "Furniture" }] },
  { label: "Electrical & Plumbing", items: [{ value: "ELECTRICAL", label: "Electrical" }, { value: "PLUMBING", label: "Plumbing" }] },
  { label: "Cleaning & Move-In", items: [{ value: "CLEANING", label: "Cleaning" }, { value: "MOVE_IN", label: "Move-In" }] },
  { label: "Fumigation & Pest Control", items: [{ value: "FUMIGATION", label: "Fumigation" }, { value: "PEST_CONTROL", label: "Pest control" }] },
] as const;
const CATEGORIES = DEPARTMENTS.flatMap((department) => department.items);

export default function PartnerVerificationPage() {
  const { data: profile, isLoading, refetch } = trpc.providers.myProfile.useQuery();
  const presignDoc = trpc.uploads.presignVerificationDoc.useMutation();
  const apply = trpc.providers.applyForVerification.useMutation({ onSuccess: () => refetch() });

  const [businessName, setBusinessName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [cacRegistrationNo, setCacRegistrationNo] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(value: string) {
    setCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  async function handleSubmit() {
    if (!idDoc) {
      setError("An identity document is required.");
      return;
    }
    if (categories.length === 0) {
      setError("Select at least one service category.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // Remediation (Phase 1 trust boundary repair, item 3) — store the
      // R2 object key, not a public URL. No fetchable URL exists for a
      // verification doc anymore; reading it back requires an admin
      // calling providers.adminGetVerificationDocUrl.
      const { key: idDocumentUrl } = await uploadFile(idDoc, (input) => presignDoc.mutateAsync(input));
      await apply.mutateAsync({
        businessName,
        categories: categories as (typeof CATEGORIES)[number]["value"][],
        cacRegistrationNo: cacRegistrationNo || undefined,
        idDocumentUrl,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <main className="max-w-lg mx-auto px-6 py-10 text-sm text-stone-500">Loading…</main>;

  if (profile?.verificationStatus === "VERIFIED") {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-5">
          <Check size={24} className="text-teal-800" />
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">You're verified</h1>
        <p className="text-sm text-stone-600 mb-6">
          Next, set up your public profile and add your offerings so customers can find and book you.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/partner/profile" className="text-sm font-semibold text-teal-800 underline">
            Create profile
          </a>
          <a href="/partner/offerings" className="text-sm font-semibold text-teal-800 underline">
            Add offerings
          </a>
        </div>
      </main>
    );
  }

  if (profile?.verificationStatus === "PENDING_REVIEW") {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Application under review</h1>
        <p className="text-sm text-stone-600">
          Submitted as <strong>{profile.businessName}</strong>. Our team hand-reviews the first cohort of applications directly — most decisions land within a few business days.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Provider verification</h1>
      <p className="text-sm text-stone-500 mb-8">Verification is required before you can add offerings or receive job requests.</p>

      {profile?.verificationStatus === "REJECTED" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 mb-6">
          Your previous application wasn't approved. You can submit a new one below.
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Business name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Chinedu Electricals"
            className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Service specialties</label>
          <p className="text-xs text-stone-500 mb-3">Select only the specific specialties your business can provide. ULTRA will review your submitted details before approval.</p>
          <div className="space-y-4">
            {DEPARTMENTS.map((department) => (
              <fieldset key={department.label}>
                <legend className="text-xs font-semibold text-stone-800 mb-2">{department.label}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {department.items.map((cat) => (
                    <label key={cat.value} className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm cursor-pointer ${categories.includes(cat.value) ? "border-teal-700 bg-teal-50 text-teal-900" : "border-stone-300 text-stone-700"}`}>
                      <input type="checkbox" checked={categories.includes(cat.value)} onChange={() => toggleCategory(cat.value)} className="hidden" />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">CAC registration number (optional)</label>
          <input
            value={cacRegistrationNo}
            onChange={(e) => setCacRegistrationNo(e.target.value)}
            placeholder="RC-1234567"
            className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Identity document</label>
          {idDoc ? (
            <div className="flex items-center gap-3 border border-stone-200 rounded-xl p-3">
              <span className="text-xs text-stone-700 flex-1 truncate">{idDoc.name}</span>
              <button onClick={() => setIdDoc(null)} className="text-xs text-stone-500">
                Remove
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-stone-300 rounded-xl p-4 flex items-center gap-3 cursor-pointer text-stone-500">
              <Upload size={16} />
              <span className="text-xs">A government-issued ID (JPEG, PNG, or PDF)</span>
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={uploading || !businessName || !idDoc || categories.length === 0}
          className="w-full bg-teal-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 size={15} className="animate-spin" />}
          {uploading ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </main>
  );
}
