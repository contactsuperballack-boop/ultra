"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/upload";
import { Check, Upload, Loader2, ChevronLeft, Clock, ShieldCheck, Building2, FileText } from "lucide-react";

// Readiness §4D — a guided, resumable multi-step flow rather than one long
// form. The realtor should never wonder what's missing, whether it's being
// reviewed, why it was rejected, or what to do next — each of those is an
// explicit screen state below, not an afterthought.

const STEPS = ["identity", "business", "review"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = { identity: "Identity", business: "Business", review: "Review & Submit" };

const DRAFT_KEY = "ultra_realtor_onboarding_draft";

interface Draft {
  agencyName: string;
  cacRegistrationNo: string;
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return { agencyName: "", cacRegistrationNo: "" };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : { agencyName: "", cacRegistrationNo: "" };
  } catch {
    return { agencyName: "", cacRegistrationNo: "" };
  }
}

function ProgressBar({ current }: { current: Step }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2 flex-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
              i < currentIndex ? "bg-emerald-800 text-white" : i === currentIndex ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-800" : "bg-stone-100 text-stone-400"
            }`}
          >
            {i < currentIndex ? <Check size={13} /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${i === currentIndex ? "text-stone-900" : "text-stone-400"}`}>{STEP_LABELS[step]}</span>
          {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < currentIndex ? "bg-emerald-800" : "bg-stone-200"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function VerificationPage() {
  const { data: profile, isLoading, refetch } = trpc.realtors.myProfile.useQuery();
  const presignDoc = trpc.uploads.presignVerificationDoc.useMutation();
  const apply = trpc.realtors.applyForVerification.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
      refetch();
    },
  });

  const [step, setStep] = useState<Step>("identity");
  const [agencyName, setAgencyName] = useState("");
  const [cacRegistrationNo, setCacRegistrationNo] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save-and-resume: a draft of the text fields persists across visits —
  // the file itself can't be restored from localStorage (browsers don't
  // allow that), so re-attaching the document is the one thing a resumed
  // session still needs, called out explicitly below rather than silently.
  useEffect(() => {
    const draft = loadDraft();
    setAgencyName(draft.agencyName);
    setCacRegistrationNo(draft.cacRegistrationNo);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ agencyName, cacRegistrationNo }));
    }
  }, [agencyName, cacRegistrationNo]);

  async function handleSubmit() {
    if (!idDoc) {
      setError("An identity document is required.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // Remediation (Phase 1 trust boundary repair, item 3) — store the
      // R2 object key, not a public URL. Reading it back requires an
      // admin calling realtors.adminGetVerificationDocUrl.
      const { key: idDocumentUrl } = await uploadFile(idDoc, (input) => presignDoc.mutateAsync(input));
      await apply.mutateAsync({ agencyName, cacRegistrationNo: cacRegistrationNo || undefined, idDocumentUrl });
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
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <Check size={24} className="text-emerald-800" />
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">You're verified</h1>
        <p className="text-sm text-stone-600">Your listings carry the verified seal and rank higher in search results.</p>
      </main>
    );
  }

  if (profile?.verificationStatus === "PENDING_REVIEW") {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <Clock size={22} className="text-amber-800" />
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Application under review</h1>
        <p className="text-sm text-stone-600 mb-4">
          Submitted as <strong>{profile.agencyName}</strong>.
        </p>
        <div className="text-left bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-600 space-y-1.5">
          <div className="flex justify-between">
            <span>Submitted</span>
            <span className="font-mono">{profile.createdAt ? new Date(profile.createdAt as any).toLocaleDateString() : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Expected review time</span>
            <span className="font-mono">1–3 business days</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="font-mono">Awaiting admin review</span>
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-4">Our team hand-reviews the first cohort of applications directly, rather than an automated pipeline.</p>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Realtor verification</h1>
      <p className="text-sm text-stone-500 mb-6">Verification is required before you can publish listings.</p>

      {profile?.verificationStatus === "REJECTED" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 mb-6">
          <div className="font-semibold mb-1">Your previous application wasn't approved</div>
          <p className="text-xs">You can submit a new one below — the process only takes a few minutes.</p>
        </div>
      )}

      <ProgressBar current={step} />

      {step === "identity" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <ShieldCheck size={18} className="text-emerald-800 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-stone-600">
              <div className="font-semibold text-stone-900 mb-1">What you'll need</div>
              A government-issued ID (national ID, driver's license, international passport, or voter's card). Accepted formats:
              JPEG, PNG, or PDF, up to 10MB.
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Identity document</label>
            {idDoc ? (
              <div className="flex items-center gap-3 border border-stone-200 rounded-xl p-3">
                <span className="text-xs text-stone-700 flex-1 truncate">{idDoc.name}</span>
                <button onClick={() => setIdDoc(null)} className="text-xs text-stone-400">
                  Remove
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-stone-300 rounded-xl p-4 flex items-center gap-3 cursor-pointer text-stone-400">
                <Upload size={16} />
                <span className="text-xs">Upload a government-issued ID</span>
                <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          <button
            onClick={() => setStep("business")}
            disabled={!idDoc}
            className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === "business" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <Building2 size={18} className="text-emerald-800 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-stone-600">
              <div className="font-semibold text-stone-900 mb-1">Business details</div>
              CAC registration is optional but speeds up review — it's the strongest signal we can check.
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Agency name</label>
            <input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Adaeze Okafor Realty"
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
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
          <div className="flex gap-2">
            <button onClick={() => setStep("identity")} className="flex items-center gap-1 text-sm font-semibold text-stone-500 px-4">
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!agencyName}
              className="flex-1 bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <FileText size={18} className="text-emerald-800 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-stone-600">
              <div className="font-semibold text-stone-900 mb-1">Review before submitting</div>
              Once submitted, this goes to our team's review queue — expect a decision within 1–3 business days.
            </div>
          </div>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-stone-500">Agency name</span>
              <span className="text-stone-900 font-medium">{agencyName}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-stone-500">CAC registration</span>
              <span className="text-stone-900 font-medium">{cacRegistrationNo || "Not provided"}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-stone-500">Identity document</span>
              <span className="text-stone-900 font-medium truncate max-w-[160px]">{idDoc?.name}</span>
            </div>
          </div>

          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={() => setStep("business")} className="flex items-center gap-1 text-sm font-semibold text-stone-500 px-4">
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="flex-1 bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 size={15} className="animate-spin" />}
              {uploading ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
