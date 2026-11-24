"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Check, MapPin, BedDouble, Bath, Ruler, Flag, X, Heart, Share2, CalendarCheck, HelpCircle, ScrollText, Compass, HandCoins, ImageOff } from "lucide-react";
import { RealtorVerificationBadges, ListingVerificationBadges } from "@/components/VerificationBadges";
import { featureLabels } from "@ultra/db/src/listingFeatures";
import { inheritedCredits } from "@ultra/db/src/development";
import { ProjectInformation, OwnerStatement, PropertyFilm, LocationMap } from "@/components/ListingProfileSections";
import { ModelViewer } from "@/components/ModelViewer";
import { InspectionRequestModal } from "@/components/InspectionRequestModal";
import { MORTGAGE_ENABLED } from "@/lib/featureFlags";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  if (num >= 1_000_000) return `\u20a6${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  return `\u20a6${num.toLocaleString()}`;
}

const FURNISHING_LABELS: Record<string, string> = { FURNISHED: "Furnished", UNFURNISHED: "Unfurnished", PARTLY_FURNISHED: "Partly furnished" };

// Only fields the listing actually has; bedrooms/bathrooms/size are already
// in the stat tiles above, so they are not repeated here.
function detailRows(l: any): [string, string][] {
  const rows: [string, string][] = [["Type", ({ SALE: "For sale", RENT: "To let", LAND: "Land" } as Record<string, string>)[l.type] ?? l.type]];
  if (l.category) rows.push(["Use", l.category === "COMMERCIAL" ? "Commercial" : "Residential"]);
  if (FURNISHING_LABELS[l.furnishing]) rows.push(["Furnishing", FURNISHING_LABELS[l.furnishing]]);
  if (l.serviceChargeNaira != null) rows.push(["Service charge", `\u20a6${Number(l.serviceChargeNaira).toLocaleString()} / year`]);
  if (l.negotiable) rows.push(["Price", "Negotiable"]);
  if (l.type !== "LAND") rows.push(["Available", l.availableFrom ? new Date(l.availableFrom).toLocaleDateString("en-NG") : "Now"]);
  return rows;
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
const ROOM_LABELS: Record<string, string> = {
  EXTERIOR: "Exterior",
  LIVING_ROOM: "Living room",
  KITCHEN: "Kitchen",
  BEDROOM: "Bedrooms",
  BATHROOM: "Bathrooms",
  FLOOR_PLAN: "Floor plans",
  OTHER: "Other",
};
const ROOM_ORDER = Object.keys(ROOM_LABELS);

function ListingGallery({ photos, title }: { photos: { url: string; roomType?: string | null }[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [category, setCategory] = useState<string>("ALL");
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const working = photos.filter((p) => !failedUrls.has(p.url));
  // Collections only appear when photos are actually tagged; untagged listings keep the simple gallery.
  const present = ROOM_ORDER.filter((k) => working.some((p) => p.roomType === k));
  const usablePhotos = category === "ALL" ? working : working.filter((p) => p.roomType === category);
  const active = usablePhotos[Math.min(activeIndex, usablePhotos.length - 1)];

  if (!working.length) {
    return (
      <div className="h-72 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-900 mb-6 flex items-center justify-center text-white/40">
        <ImageOff size={28} />
      </div>
    );
  }
  if (!active) return null;

  return (
    <div className="mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- see ListingCard.tsx: plain <img> is deliberate (custom R2 domain isn't in remotePatterns). */}
      <img
        src={active.url}
        alt={title}
        className={`w-full h-72 rounded-2xl bg-stone-100 ${active.roomType === "FLOOR_PLAN" ? "object-contain bg-white border border-stone-200" : "object-cover"}`}
        onError={() => {
          setFailedUrls((prev) => new Set(prev).add(active.url));
          setActiveIndex(0);
        }}
      />
      {present.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {["ALL", ...present].map((k) => (
            <button
              key={k}
              onClick={() => { setCategory(k); setActiveIndex(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${category === k ? "bg-emerald-800 text-white border-emerald-800" : "bg-white border-stone-300 text-stone-600"}`}
            >
              {k === "ALL" ? "All photos" : ROOM_LABELS[k]}
            </button>
          ))}
        </div>
      )}
      {usablePhotos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {usablePhotos.map((photo, i) => (
            <button
              key={photo.url}
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${i === activeIndex ? "border-emerald-700" : "border-transparent"}`}
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
            <X size={18} className="text-stone-500" />
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
  const [showInspection, setShowInspection] = useState(false);

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

      {(listing as any).development && (
        <Link href={`/developments/${(listing as any).development.id}`} className="flex items-center justify-between gap-3 mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
          <span className="text-emerald-900">
            Part of <strong>{(listing as any).development.name}</strong>
            {(listing as any).unitNumber ? ` · Unit ${(listing as any).unitNumber}` : ""}
          </span>
          <span className="text-xs font-medium text-emerald-800 whitespace-nowrap">See all units →</span>
        </Link>
      )}

      <div className="flex justify-between items-start">
        <div>
          <div className="text-3xl font-semibold text-stone-900">
            {formatNaira(listing.priceNaira)}
            {listing.type === "RENT" && <span className="text-sm text-stone-500 font-normal"> /{listing.priceFrequency === "PER_MONTH" ? "month" : "year"}</span>}
          </div>
          <div className="text-base font-semibold text-stone-900 mt-1">{listing.title}</div>
          <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
            <MapPin size={13} /> {listing.area}, {listing.city}
          </div>
          {listing.type === "SALE" && MORTGAGE_ENABLED && (
            <a href={`/mortgage?price=${Number(listing.priceNaira)}`} className="inline-block text-xs font-medium text-emerald-800 mt-2">
              Estimate monthly repayment →
            </a>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={shareListing} className="flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-800">
            <Share2 size={15} />
          </button>
          <button onClick={() => toggleSave.mutate({ listingId: listing.id })} className="flex items-center gap-1 text-xs text-stone-500 hover:text-red-600">
            <Heart size={16} className={isSaved ? "fill-red-600 text-red-600" : ""} />
          </button>
          <button onClick={() => setShowReport(true)} className="flex items-center gap-1 text-xs text-stone-500 hover:text-red-700">
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

      {featureLabels((listing as any).features).length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-stone-900 mb-2">Property features</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {featureLabels((listing as any).features).map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm text-stone-600">
                <Check size={14} className="text-emerald-800 shrink-0" /> {label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detailRows(listing).length > 1 && (
        <dl className="mt-6 border border-stone-200 rounded-xl divide-y divide-stone-100 text-sm">
          {detailRows(listing).map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2.5">
              <dt className="text-stone-500">{k}</dt>
              <dd className="text-stone-900 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <ProjectInformation listing={{ ...listing, ...inheritedCredits(listing as any, (listing as any).development) }} />
      <OwnerStatement listing={listing} />
      <PropertyFilm videoId={(listing as any).youtubeVideoId} title={listing.title} />
      {(listing as any).model3dUrl && <ModelViewer url={(listing as any).model3dUrl} title={listing.title} />}
      <LocationMap area={listing.area} city={listing.city} />

      <div className="mt-6 border border-stone-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-semibold text-sm">
            {listing.realtorProfile.agencyName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">{listing.realtorProfile.agencyName}</div>
            {listing.realtorProfile.responseTimeMins != null && (
              <div className="text-xs text-stone-500">
                Typically replies within{" "}
                {listing.realtorProfile.responseTimeMins < 60
                  ? `${listing.realtorProfile.responseTimeMins} min`
                  : `${Math.round(listing.realtorProfile.responseTimeMins / 60)} hrs`}
              </div>
            )}
          </div>
        </div>
        <Link href={`/realtors/${listing.realtorProfile.id}`} className="inline-block text-xs font-medium text-emerald-800 mt-3">
          View profile and listings →
        </Link>
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
            Message sent to {listing.realtorProfile.agencyName}. Replies appear in your Messages.
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
            {inquire.error.message === "Sign in required." ? (
              <>
                <Link href={`/auth/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`} className="font-semibold underline">Sign in</Link> to message this realtor.
              </>
            ) : (
              inquire.error.message
            )}
          </div>
        )}
        <button
          onClick={() => setShowInspection(true)}
          className="mt-3 w-full border border-emerald-800 text-emerald-800 rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-50"
        >
          Request an inspection
        </button>
      </div>

      {showInspection && <InspectionRequestModal listingId={listing.id} agencyName={listing.realtorProfile.agencyName} onClose={() => setShowInspection(false)} />}
      {showReport && <ReportModal listingId={listing.id} onClose={() => setShowReport(false)} />}
    </main>
  );
}
