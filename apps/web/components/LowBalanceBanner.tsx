"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";

function formatNaira(n: bigint | number) {
  return `\u20a6${Number(n).toLocaleString()}`;
}

/**
 * Priority-checklist fix (MVP Product Readiness Audit — "the billing
 * state is now correctly modeled server-side [Sprint 2], but there's no
 * evidence of a realtor-facing 'your balance is low, top up' prompt —
 * only an admin-facing failed-fee queue"). The insufficient-balance fix
 * made the failure state observable to admins; this makes it actionable
 * by the realtor who's actually losing leads over it.
 *
 * Both queries fail silently into "show nothing" rather than an error
 * banner: `payments.balance` is verifiedRealtorProcedure-gated, so this
 * component renders inside dashboard/layout.tsx for EVERY dashboard page
 * including /dashboard/verification, which an unverified realtor-to-be
 * legitimately visits before they have a RealtorProfile at all — a
 * FORBIDDEN error there is expected, not a bug, and shouldn't surface as
 * a scary banner during onboarding.
 */
export function LowBalanceBanner() {
  const balance = trpc.payments.balance.useQuery(undefined, { retry: false });
  const pricing = trpc.payments.currentPricing.useQuery();

  if (balance.isError || !balance.data || !pricing.data) return null;

  const current = balance.data.creditBalanceNaira;
  const leadFee = pricing.data.leadFeeNaira;
  // "Low" means: can't cover even one more inquiry at the current price.
  // Deliberately not a softer warning threshold (e.g. "below 3x the fee")
  // — the audit's own framing was specifically about inquiries that
  // FAIL to bill, not a general savings nudge, so the bar here matches
  // the actual failure condition in inquiries.ts exactly.
  if (current >= leadFee) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertTriangle size={15} className="flex-shrink-0" />
        <span>
          Your balance ({formatNaira(current)}) is below the current lead fee ({formatNaira(leadFee)}). New buyer
          inquiries are still reaching you, but the fee won't be collected until you top up.
        </span>
      </div>
      <Link href="/dashboard/billing" className="text-amber-900 font-semibold underline whitespace-nowrap ml-4">
        Top up
      </Link>
    </div>
  );
}
