"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin } from "lucide-react";
import { RealtorVerificationBadges } from "@/components/VerificationBadges";
import { ProjectInformation, PropertyFilm } from "@/components/ListingProfileSections";
// Deep import: pure, no Prisma in the browser bundle.
import { youTubeThumbnailUrl } from "@ultra/db/src/youtube";

const naira = (n: number | bigint | null | undefined) => (n == null ? "" : `₦${Number(n).toLocaleString("en-NG")}`);

/**
 * Public development page: the shared facts once (credits, description,
 * film), then every unit that's currently available. Units are ordinary
 * listings, so each has its own page, price and inquiry thread.
 */
export default function DevelopmentPage({ params }: { params: { id: string } }) {
  const { data: dev, isLoading, error } = trpc.developments.byId.useQuery({ id: params.id });

  if (isLoading) return <main className="max-w-4xl mx-auto px-5 py-16 text-sm text-stone-500">Loading…</main>;
  if (error || !dev) return <main className="max-w-4xl mx-auto px-5 py-16 text-sm text-stone-500">This development isn't available.</main>;

  const { summary } = dev;
  const cover = dev.units.find((u) => u.photos[0])?.photos[0]?.url;

  return (
    <main>
      <section className="relative bg-gradient-to-br from-emerald-900 to-brand-ink text-white overflow-hidden">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- see ListingCard.tsx: plain <img> is deliberate
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        )}
        <div className="relative max-w-4xl mx-auto px-5 py-12">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200 mb-2"><Building2 size={14} /> Development</div>
          <h1 className="text-3xl font-semibold">{dev.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-white/70 mt-2"><MapPin size={14} /> {dev.area}, {dev.city}</p>
          <p className="text-sm text-white/80 mt-4">
            {summary.availableCount > 0
              ? `${summary.availableCount} unit${summary.availableCount === 1 ? "" : "s"} available${summary.minPriceNaira != null ? ` · from ${naira(summary.minPriceNaira)}` : ""}`
              : "No units are available right now."}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-5 pb-10">
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-stone-900 mb-2">About this development</h2>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{dev.description}</p>
        </section>

        <ProjectInformation listing={dev} />
        <PropertyFilm videoId={dev.youtubeVideoId} title={dev.name} />

        <section className="mt-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-900">Available units</h2>
            {summary.bedroomOptions.length > 0 && <span className="text-xs text-stone-500">{summary.bedroomOptions.join(", ")}-bedroom</span>}
          </div>
          {dev.units.length === 0 ? (
            <p className="text-sm text-stone-500">Check back soon, or message the developer directly from a unit page once one is listed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dev.units.map((u) => (
                <Link key={u.id} href={`/listings/${u.id}`} className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:border-emerald-800 transition">
                  <div className="h-36 bg-stone-100">
                    {u.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.photos[0].url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-sm font-semibold text-stone-900">Unit {u.unitNumber}</div>
                      <div className="text-sm font-semibold text-emerald-800">{naira(u.priceNaira)}{u.type === "RENT" ? " /yr" : ""}</div>
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {[u.bedrooms != null && `${u.bedrooms} bed`, u.bathrooms != null && `${u.bathrooms} bath`, `${u.sizeSqm} sqm`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 border-t border-stone-200 pt-6">
          <div className="text-xs text-stone-500 mb-1">Developed and listed by</div>
          <Link href={`/realtors/${dev.realtorProfile.id}`} className="text-sm font-semibold text-stone-900 hover:underline">{dev.realtorProfile.agencyName}</Link>
          <div className="mt-2">
            <RealtorVerificationBadges identityVerified={dev.realtorProfile.identityVerified} businessVerified={dev.realtorProfile.businessVerified} />
          </div>
        </section>
      </div>
    </main>
  );
}
