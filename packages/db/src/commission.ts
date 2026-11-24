/**
 * Extracted from routers/serviceRequests.ts so it can be unit tested without
 * a database — see tests/unit/commission.test.ts. Mirrors priceBand.ts's
 * pattern (pure function, business figure lives at the top as a named
 * constant, not buried in the router).
 *
 * Business figure, not a confirmed rate — same caveat as LEAD_FEE_NAIRA and
 * SUBSCRIPTION_PRICE_NAIRA elsewhere in this codebase: a reasonable
 * placeholder to build against, worth revisiting with real job-price data
 * before it touches real providers' money at volume.
 */
export const COMMISSION_RATE_BPS = 1000; // 1000 basis points = 10%

/**
 * Computes commission in Naira from an agreed job price, rounding down to
 * avoid ever billing a fraction of a kobo. Returns 0 (not an error) for a
 * non-positive price — the caller decides whether that's a valid state to
 * be completing a job in; this function only does the arithmetic.
 */
export function calculateCommissionNaira(agreedPriceNaira: bigint, rateBps: number = COMMISSION_RATE_BPS): bigint {
  if (agreedPriceNaira <= 0n) return 0n;
  if (rateBps <= 0) return 0n;
  return (agreedPriceNaira * BigInt(rateBps)) / 10_000n;
}

/**
 * Grace-period check: a provider's ServiceRequest visibility/eligibility to
 * receive new requests requires either an active subscription OR still
 * being inside their free-onboarding window. Commission itself is NOT
 * gated by this — it accrues on every completed job regardless, per the
 * explicit product decision that the grace period waives the subscription
 * requirement only, not the commission.
 */
export function isWithinFreeOnboardingWindow(freeUntil: Date | null, now: Date = new Date()): boolean {
  if (!freeUntil) return false;
  return freeUntil > now;
}
