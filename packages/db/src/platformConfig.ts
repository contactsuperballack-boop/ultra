import type { PrismaClient } from "@prisma/client";

/**
 * Gate B #6 — reads the single-row PlatformConfig, creating it with the
 * original hardcoded defaults (LEAD_FEE_NAIRA=500, COMMISSION_RATE_BPS=10%)
 * on first read if it doesn't exist yet. `upsert` rather than a separate
 * seed step so this works correctly even against a database that hasn't
 * been re-seeded since this table was added.
 */
export async function getPlatformConfig(db: PrismaClient) {
  return db.platformConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

/**
 * Billing-state labels for display — Gate B #6's "clearly labeled as
 * charged, accrued, unpaid, or collected." Deliberately NOT a change to
 * PaymentStatus (PENDING/SUCCESS/FAILED) itself, which is the payment
 * gateway's actual state machine and shouldn't be muddied with
 * presentation concerns — this is a pure mapping function for the UI
 * layer, computed from (type, status), not stored.
 */
export function billingStateLabel(type: string, status: string): string {
  if (status === "PENDING") return "Pending";
  if (status === "FAILED") return "Failed";
  // status === "SUCCESS" — but SUCCESS means something different per type,
  // which is exactly the ambiguity this function exists to resolve.
  switch (type) {
    case "LEAD_FEE":
      return "Charged"; // deducted from realtor's prepaid balance
    case "COMMISSION":
      return "Accrued"; // added to what the provider owes — not yet collected
    case "COMMISSION_SETTLEMENT":
      return "Collected"; // provider actually paid this down via Paystack
    case "TOPUP":
      return "Collected"; // realtor actually paid this in via Paystack
    case "SUBSCRIPTION":
      return "Collected";
    case "REFUND":
      return "Refunded";
    case "MANUAL_ADJUSTMENT":
      return "Adjusted";
    default:
      return status;
  }
}

/**
 * Deliberately no "isUnpaid" per-transaction flag: whether a specific
 * COMMISSION row has since been paid down isn't tracked (settlements
 * reduce the aggregate ProviderProfile.commissionOwedNaira, not a
 * specific-transaction link — there's no FIFO/matching between which
 * settlement paid down which accrual). "Unpaid" is accurately answered
 * by that aggregate balance, not by inspecting individual ledger rows —
 * a function here claiming otherwise would be wrong the moment a
 * provider partially settles. Surface commissionOwedNaira directly
 * instead (see providers.dashboardSummary / payments.commissionOwed).
 */
