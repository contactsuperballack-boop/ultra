"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Check } from "lucide-react";

export default function PartnerProfilePage() {
  const { data: profile, isLoading, refetch } = trpc.providers.myProfile.useQuery();
  const update = trpc.providers.updateProfile.useMutation({ onSuccess: () => refetch() });

  const [bio, setBio] = useState("");
  const [serviceArea, setServiceArea] = useState("Abuja");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile?.bio) setBio(profile.bio);
    if (profile?.serviceArea) setServiceArea(profile.serviceArea);
  }, [profile?.bio, profile?.serviceArea]);

  if (isLoading) return <main className="max-w-lg mx-auto px-6 py-10 text-sm text-stone-500">Loading…</main>;

  if (profile?.verificationStatus !== "VERIFIED") {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Verification required</h1>
        <p className="text-sm text-stone-600 mb-6">You'll be able to set up your public profile once your provider account is verified.</p>
        <a href="/partner/verification" className="text-sm font-semibold text-teal-800 underline">
          Go to verification
        </a>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Your profile</h1>
      <p className="text-sm text-stone-500 mb-8">This is what customers see on your public listing when they're deciding who to book.</p>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">About your business</label>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setSaved(false);
            }}
            rows={5}
            placeholder="Tell customers about your experience, specialties, and how you work."
            className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
          />
          <div className="text-[11px] text-stone-400 mt-1">{bio.length}/1000</div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Service area</label>
          <input
            value={serviceArea}
            onChange={(e) => {
              setServiceArea(e.target.value);
              setSaved(false);
            }}
            placeholder="Abuja"
            className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
          />
        </div>

        <button
          onClick={() => update.mutate({ bio: bio || undefined, serviceArea: serviceArea || undefined }, { onSuccess: () => setSaved(true) })}
          disabled={update.isPending}
          className="w-full bg-teal-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {update.isPending && <Loader2 size={15} className="animate-spin" />}
          {saved && !update.isPending ? (
            <>
              <Check size={15} /> Saved
            </>
          ) : update.isPending ? (
            "Saving…"
          ) : (
            "Save profile"
          )}
        </button>
        {update.error && <p className="text-xs text-red-700">{update.error.message}</p>}

        <a href="/partner/offerings" className="block text-center text-sm font-semibold text-teal-800 underline pt-2">
          Next: add your offerings →
        </a>
      </div>
    </main>
  );
}
