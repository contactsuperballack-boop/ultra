"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MapPin, BedDouble, Bath, Ruler, Heart, Check, ImageOff } from "lucide-react";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  if (num >= 1_000_000) return `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  return `\u20a6${num.toLocaleString()}`;
}

function freshnessLabel(publishedAt: string | Date | null): string | null {
  if (!publishedAt) return null;
  const days = Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "New today";
  if (days <= 3) return `${days}d ago`;
  if (days <= 14) return `${Math.floor(days / 7)}w ago`;
  return null; // Readiness §4B lists freshness as a signal, not a stale-listing shamer — omit once it stops being useful info
}

const TYPE_LABELS: Record<string, string> = { SALE: "For Sale", RENT: "For Rent", LAND: "Land" };

export interface ListingCardData {
  id: string;
  title: string;
  area: string;
  city: string;
  type: string;
  priceNaira: bigint | number;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number;
  publishedAt: string | Date | null;
  realtorProfile: { agencyName: string; verificationStatus: string };
  // MVP Audit P0-5, fixed Sprint 3: this field was always present on the
  // API response (listings.search already includes it), just never
  // declared in this type or read by this component — the gradient below
  // rendered unconditionally regardless of whether real photos existed.
  photos?: { url: string }[];
}

/** Shared across the home search grid and the saved-listings page — one card definition, not two drifting copies. */
export function ListingCard({ listing, savedIds }: { listing: ListingCardData; savedIds?: string[] }) {
  const utils = trpc.useUtils();
  const toggleSave = trpc.savedListings.toggle.useMutation({
    onMutate: async () => {
      await utils.savedListings.ids.cancel();
      const prev = utils.savedListings.ids.getData();
      utils.savedListings.ids.setData(undefined, (old) =>
        old?.includes(listing.id) ? old.filter((id) => id !== listing.id) : [...(old ?? []), listing.id]
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.savedListings.ids.setData(undefined, context.prev);
    },
    onSettled: () => utils.savedListings.ids.invalidate(),
  });

  const isSaved = savedIds?.includes(listing.id);
  const fresh = freshnessLabel(listing.publishedAt);
  // Two independent reasons to fall back to the gradient placeholder:
  // genuinely no photo on this listing, or a photo URL that 404s/fails to
  // load (a dead R2 link, a moved bucket, etc.) — the second case is why
  // this is state and not just a `listing.photos?.length` check.
  const firstPhotoUrl = listing.photos?.[0]?.url;
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = firstPhotoUrl && !imageFailed;

  return (
    <div className="relative block border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/listings/${listing.id}`}>
        <div className="h-36 relative bg-gradient-to-br from-emerald-800 to-stone-900">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- plain
            // <img>, matching this codebase's existing convention
            // (dashboard/listings/new's own photo previews), and
            // deliberately not next/image: R2_PUBLIC_BASE_URL is
            // operator-configurable to any custom domain, but
            // next.config.js's remotePatterns only allowlists *.r2.dev —
            // next/image would silently reject a custom domain's photos.
            <img
              src={firstPhotoUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <ImageOff size={22} />
            </div>
          )}
          <span className="absolute top-2 left-2 text-[10px] font-mono px-2 py-1 rounded-full bg-white/90 text-stone-800">
            {TYPE_LABELS[listing.type] ?? listing.type}
          </span>
          {fresh && (
            <span className="absolute top-2 right-2 text-[10px] font-mono px-2 py-1 rounded-full bg-emerald-800/90 text-white">{fresh}</span>
          )}
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          toggleSave.mutate({ listingId: listing.id });
        }}
        className="absolute top-32 right-2 w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
        aria-label={isSaved ? "Unsave listing" : "Save listing"}
      >
        <Heart size={15} className={isSaved ? "fill-red-600 text-red-600" : "text-stone-400"} />
      </button>

      <Link href={`/listings/${listing.id}`}>
        <div className="p-4">
          <div className="text-lg font-semibold text-stone-900">
            {formatNaira(listing.priceNaira)}
            {listing.type === "RENT" && <span className="text-xs text-stone-500 font-normal"> /year</span>}
          </div>
          <div className="text-sm font-semibold text-stone-900 mt-1 line-clamp-1">{listing.title}</div>
          <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
            <MapPin size={11} /> {listing.area}, {listing.city}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
              {listing.bedrooms != null && (
                <span className="flex items-center gap-1">
                  <BedDouble size={12} /> {listing.bedrooms}
                </span>
              )}
              {listing.bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath size={12} /> {listing.bathrooms}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Ruler size={12} /> {listing.sizeSqm}m\u00b2
              </span>
            </div>
            {listing.realtorProfile.verificationStatus === "VERIFIED" && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white flex-shrink-0" title="Identity-verified realtor">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="text-[11px] text-stone-400 mt-1.5 truncate">{listing.realtorProfile.agencyName}</div>
        </div>
      </Link>
    </div>
  );
}
