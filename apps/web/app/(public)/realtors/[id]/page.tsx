"use client";

import { trpc } from "@/lib/trpc";
import { ShieldCheck, Calendar, Home, Clock } from "lucide-react";
import { RealtorVerificationBadges } from "@/components/VerificationBadges";
import { ListingCard } from "@/components/ListingCard";

// Public realtor profile. Shows only what the platform can stand behind:
// verification status, tenure, live listings and measured reply time.
// No rating, no "deals closed" and no phone number — enquiries go through
// a listing so conversations (and lead fees) stay in the app.
export default function RealtorProfilePage({ params }: { params: { id: string } }) {
  const { data: profile, isLoading, error } = trpc.realtors.byId.useQuery({ id: params.id });
  const { data: savedIds } = trpc.savedListings.ids.useQuery();

  if (isLoading) return <main className="max-w-4xl mx-auto px-5 py-16 text-sm text-stone-500">Loading…</main>;
  if (error || !profile) return <main className="max-w-4xl mx-auto px-5 py-16 text-sm text-stone-500">This realtor profile isn't available.</main>;

  const verified = profile.verificationStatus === "VERIFIED";
  const since = new Date(profile.createdAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
  const mins = profile.responseTimeMins;
  const stats = [
    { Icon: Calendar, value: since, label: "On ULTRA since" },
    { Icon: Home, value: String(profile.listings.length), label: "Live listings" },
    ...(mins != null ? [{ Icon: Clock, value: mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} hrs`, label: "Typical reply" }] : []),
  ];

  return (
    <main>
      <section className="bg-gradient-to-br from-emerald-900 to-brand-ink text-white">
        <div className="max-w-4xl mx-auto px-5 py-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-semibold shrink-0">
            {profile.agencyName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            {verified && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200 mb-1">
                <ShieldCheck size={14} /> Verified realtor
              </div>
            )}
            <h1 className="text-2xl font-semibold">{profile.agencyName}</h1>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="bg-white border border-stone-200 rounded-2xl grid divide-x divide-stone-200" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map(({ Icon, value, label }) => (
            <div key={label} className="py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-stone-900">
                <Icon size={14} className="text-emerald-800" /> {value}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <RealtorVerificationBadges identityVerified={profile.identityVerified} businessVerified={profile.businessVerified} />
        </div>

        <h2 className="text-lg font-semibold text-stone-900 mt-10 mb-3">Listings</h2>
        {profile.listings.length === 0 ? (
          <p className="text-sm text-stone-500">No live listings from this realtor right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profile.listings.map((l: any) => (
              <ListingCard key={l.id} listing={{ ...l, realtorProfile: { agencyName: profile.agencyName, verificationStatus: profile.verificationStatus } }} savedIds={savedIds} />
            ))}
          </div>
        )}

        <p className="text-xs text-stone-500 mt-10">To contact this realtor, send an inquiry from any of their listings. Conversations stay in the app.</p>
      </div>
    </main>
  );
}
