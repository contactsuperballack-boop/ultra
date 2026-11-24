"use client";

import { Check, ClipboardCheck, FileCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";

/**
 * Readiness §3A: "Do not use one generic verified badge if the underlying
 * checks differ. Display badges with tooltips explaining what was
 * actually checked." Each badge here corresponds to exactly one thing
 * that was actually reviewed — see the schema comments on
 * RealtorProfile.identityVerified/businessVerified and
 * Listing.listingReviewed/ownershipEvidence for what sets each one.
 *
 * Safer wording throughout (Readiness §3E) — "reviewed," never "fully
 * verified" or "trusted," since the platform doesn't independently confirm
 * land title.
 */

function Badge({ icon: Icon, label, tooltip, tone }: { icon: typeof Check; label: string; tooltip: string; tone: "amber" | "teal" | "stone" }) {
  const [open, setOpen] = useState(false);
  const toneClasses = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    teal: "bg-teal-50 text-teal-800 border-teal-200",
    stone: "bg-stone-50 text-stone-500 border-stone-200",
  }[tone];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full border ${toneClasses}`}
      >
        <Icon size={11} /> {label}
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 w-56 bg-stone-900 text-white text-xs rounded-lg p-2.5 shadow-lg">
          {tooltip}
        </div>
      )}
    </div>
  );
}

export function RealtorVerificationBadges({
  identityVerified,
  businessVerified,
}: {
  identityVerified: boolean;
  businessVerified: boolean;
}) {
  if (!identityVerified && !businessVerified) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {identityVerified && (
        <Badge icon={Check} label="Identity reviewed" tone="amber" tooltip="Phone number verified and a government-issued ID was reviewed by ULTRA before this account could publish." />
      )}
      {businessVerified && (
        <Badge icon={FileCheck} label="Business reviewed" tone="amber" tooltip="Business/agency registration details were reviewed and linked to this realtor's identity." />
      )}
    </div>
  );
}

export function ListingVerificationBadges({
  listingReviewed,
  lastReviewedAt,
  ownershipEvidence,
}: {
  listingReviewed: boolean;
  lastReviewedAt: string | Date | null;
  ownershipEvidence: string;
}) {
  const evidenceLabel: Record<string, string> = {
    OWNER_LISTING: "Listed by the property owner",
    AUTHORIZED_AGENT: "Listed by an authorized agent",
    AGENCY_MANDATE: "Listed under an agency mandate",
    DEVELOPER_LISTING: "Listed by the developer",
    LAND_REPRESENTATIVE: "Listed by a land representative",
    PENDING: "Property evidence pending",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {listingReviewed && (
        <Badge
          icon={ClipboardCheck}
          label="Listing reviewed"
          tone="teal"
          tooltip={`Price, location, and photos were checked against ULTRA's listing standards.${lastReviewedAt ? ` Last reviewed ${new Date(lastReviewedAt).toLocaleDateString()}.` : ""}`}
        />
      )}
      {ownershipEvidence === "PENDING" ? (
        <Badge icon={ShieldCheck} label="Evidence pending" tone="stone" tooltip="Ownership or authorization evidence for this listing hasn't been reviewed yet. This does not confirm or deny the listing's legitimacy." />
      ) : (
        <Badge icon={ShieldCheck} label="Evidence reviewed" tone="teal" tooltip={`${evidenceLabel[ownershipEvidence]}. This reflects what ULTRA's admin team was shown, not independent confirmation against a land registry.`} />
      )}
    </div>
  );
}
