"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MapPin, BedDouble, Bath, Ruler, Flag, X, Heart, Share2, CalendarCheck, HelpCircle, ScrollText, Compass, HandCoins, ImageOff } from "lucide-react";
import { RealtorVerificationBadges, ListingVerificationBadges } from "@/components/VerificationBadges";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  if (num >= 1_000_000) return `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  return `\u20a6${num.toLocaleString()}`;
}

const REPORT_REASONS = [
  { value: "DUPLICATE_LISTING", label: "Duplicate listing" },
  { value: "WRONG_PRICE", label: "Wrong price" },
  { value: "WRONG_LOCATION", label: "Wrong location" },
  { value: "FALSE_PHOTOS", label: "False photos" },
  { value: "PROPERTY_UNAVAILABLE", label: "Property unavailable" },
  { value: "SUSPECTED_FRAUD", label: "Suspected fraud" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "UNAUTHORIZED_LISTING", label: "Unauthorized listing" },
] as const;

// Readiness §4C — "a structured inquiry is better than an empty text box
// because it gives the realtor useful context." Each quick action prefills
// a real, specific opening message rather than leaving the buyer to write
// one from scratch.
const QUICK_ACTIONS = [
  { icon: CalendarCheck, label: "Request a viewing", text: "Hi, I'd like to arrange a viewing for this property. What times work?" },
  { icon: HelpCircle, label: "Ask about availability", text: "Hi, is this property still available?" },
  { icon: ScrollText, label: "Ask about ownership", text: "Hi, could you share more about the ownership/title status of this property?" },
  { icon: Compass, label: "Ask for exact location", text: "Hi, could you share the exact location or a pin for this property?" },
  { icon: HandCoins, label: "Ask about negotiation", text: "Hi, is the listed price negotiable?" },
] as const;

// MVP Audit P0-5, fixed Sprint 3 — same underlying gap as ListingCard's
// gradient placeholder, worse here since this is the page a buyer is
// actually deciding on. Hero image + thumbnail strip when there's more
// than one photo; falls back to the gradient only when there's genuinely
// no usable photo (none uploaded, or every one failed to load), matching
// the MVP audit's explicit ask: "display a clear fallback only when a
// listing genuinely has no usable image."
function ListingGallery({ photos, title }: { photos: { url: string }[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const usablePhotos = photos.filter((p) => !failedUrls.has(p.url));
  const active = usablePhotos[Math.min(activeIndex, usablePhotos.length - 1)];

  if (!active) {
    return (
      <div className="h-72 rounded-2xl bg-gradient-to-br from-emerald-800 to-stone-900 mb-6 flex items-center justify-center text-white/40">
        <ImageOff size={28} />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- see
          ListingCard.tsx's comment: plain <img> is deliberate here, not
          next/image, since R2_PUBLIC_BASE_URL can be a custom domain
          next.config.js's remotePatterns doesn't allowlist. */}
      <img
        src={active.url}
        alt={title}
        className="w-full h-72 object-cover rounded-2xl bg-stone-100"
        onError={() => {
          setFailedUrls((prev) => new Set(prev).add(active.url));
          setActiveIndex(0); // re-anchor to whatever's first among the remaining usable photos
        }}
      />
      {usablePhotos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {usablePhotos.map((photo, i) => (
            <button
              key={photo.url}
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                i === activeIndex ? "border-emerald-700" : "border-transparent"
              }`}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"] | null>(null);
  const [comment, setComment] = useState("");
  const report = trpc.listings.report.useMutation();

  if (report.isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-stone-700 mb-4">Thanks — this listing has been sent to our review team.</p>
          <button onClick={onClose} className="text-sm font-semibold text-emerald-800">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-base font-semibold text-stone-900">Report this listing</h2>
          <button onClick={onClose}>
            <X size={18} className="text-stone-400" />
          </button>
        </div>
        <div className="space-y-1.5 mb-4">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg border ${reason === r.value ? "border-red-300 bg-red-50 text-red-900" : "border-stone-200 text-stone-700"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional details…"
          rows={3}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none resize-none mb-3"
        />
        {report.error && <p className="text-xs text-red-700 mb-2">{report.error.message}</p>}
        <button
          disabled={!reason || report.isPending}
          onClick={() => reason && report.mutate({ listingId, reason, comment: comment || undefined })}
          className="w-full bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {report.isPending ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { data: listing, isLoading } = trpc.listings.byId.useQuery({ id: params.id });
  const { data: savedIds } = trpc.savedListings.ids.useQuery();
  const utils = trpc.useUtils();
  const toggleSave = trpc.savedListings.toggle.useMutation({ onSuccess: () => utils.savedListings.ids.invalidate() });
  const inquire = trpc.inquiries.create.useMutation({ onSuccess: () => setSent(true) });

  if (isLoading) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Loading…</div>;
  if (!listing) return <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500 text-sm">Listing not found.</div>;

  const isSaved = savedIds?.includes(listing.id);

  function shareListing() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: listing!.title, url }).catch(() => {});
    } else if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(url);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 pb-28 sm:pb-10">
      <ListingGallery photos={(listing as any).photos ?? []} title={listing.title} />

      <div className="flex justify-between items-start">
        <div>
          <div className="text-3xl font-semibold text-stone-900">
            {formatNaira(listing.priceNaira)}
            {listing.type === "RENT" && <span className="text-sm text-stone-500 font-normal"> /year</span>}
          </div>
          <div className="text-base font-semibold text-stone-900 mt-1">{listing.title}</div>
          <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
            <MapPin size={13} /> {listing.area}, {listing.city}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={shareListing} className="flex items-center gap-1 text-xs text-stone-400 hover:text-emerald-800">
            <Share2 size={15} />
          </button>
          <button onClick={() => toggleSave.mutate({ listingId: listing.id })} className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-600">
            <Heart size={16} className={isSaved ? "fill-red-600 text-red-600" : ""} />
          </button>
          <button onClick={() => setShowReport(true)} className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-700">
            <Flag size={13} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ListingVerificationBadges
          listingReviewed={(listing as any).listingReviewed}
          lastReviewedAt={(listing as any).lastReviewedAt}
          ownershipEvidence={(listing as any).ownershipEvidence}
        />
      </div>

      <div className="flex gap-3 mt-5">
        {listing.bedrooms != null && (
          <div className="flex-1 bg-stone-100 rounded-xl p-3 text-center">
            <BedDouble size={16} className="mx-auto mb-1 text-emerald-800" />
            <div className="text-xs font-mono text-stone-800">{listing.bedrooms} Beds</div>
          </div>
        )}
        {listing.bathrooms != null && (
          <div className="flex-1 bg-stone-100 rounded-xl p-3 text-center">
            <Bath size={16} className="mx-auto mb-1 text-emerald-800" />
            <div className="text-xs font-mono text-stone-800">{listing.bathrooms} Baths</div>
          </div>
        )}
        <div className="flex-1 bg-stone-100 rounded-xl p-3 text-center">
          <Ruler size={16} className="mx-auto mb-1 text-emerald-800" />
          <div className="text-xs font-mono text-stone-800">{listing.sizeSqm}m²</div>
        </div>
      </div>

      <p className="text-sm text-stone-600 leading-relaxed mt-6">{listing.description}</p>

      <div className="mt-6 border border-stone-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-semibold text-sm">
            {listing.realtorProfile.agencyName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">{listing.realtorProfile.agencyName}</div>
            <div className="text-xs text-stone-500">
              {listing.realtorProfile.rating ?? "—"} rating
              {listing.realtorProfile.responseTimeMins != null &&
                ` · Typically replies within ${
                  listing.realtorProfile.responseTimeMins < 60
                    ? `${listing.realtorProfile.responseTimeMins} min`
                    : `${Math.round(listing.realtorProfile.responseTimeMins / 60)} hrs`
                }`}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <RealtorVerificationBadges
            identityVerified={(listing.realtorProfile as any).identityVerified}
            businessVerified={(listing.realtorProfile as any).businessVerified}
          />
        </div>
      </div>

      <div className="mt-6 sticky bottom-4 sm:static bg-white sm:bg-transparent border sm:border-0 border-stone-200 rounded-xl sm:rounded-none p-3 sm:p-0 shadow-lg sm:shadow-none">
        {sent ? (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            Message sent — {listing.realtorProfile.agencyName} typically responds within a few hours.
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setMessage(a.text)}
                  className="flex items-center gap-1.5 text-xs whitespace-nowrap border border-stone-300 text-stone-700 rounded-full px-3 py-1.5 hover:border-emerald-700 hover:text-emerald-800 flex-shrink-0"
                >
                  <a.icon size={12} /> {a.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about this property…"
                className="flex-1 border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
              />
              <button
                disabled={inquire.isPending || message.trim().length < 10}
                onClick={() => inquire.mutate({ listingId: listing.id, message })}
                className="bg-emerald-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
        {inquire.error && (
          <div className="text-xs text-red-700 mt-2">
            {inquire.error.message === "Sign in required."
              ? "Sign in required to message a realtor — auth lands in Phase 3."
              : inquire.error.message}
          </div>
        )}
      </div>

      {showReport && <ReportModal listingId={listing.id} onClose={() => setShowReport(false)} />}
    </main>
  );
}
