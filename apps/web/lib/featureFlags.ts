/**
 * Home Services is included in the MVP pilot, but fails closed by default.
 * Set NEXT_PUBLIC_HOME_SERVICES_ENABLED=true only in an approved pilot
 * environment. The legacy Phase 2 variable remains a compatibility fallback.
 */
export const HOME_SERVICES_ENABLED =
  process.env.NEXT_PUBLIC_HOME_SERVICES_ENABLED === "true" || process.env.NEXT_PUBLIC_PHASE2_ENABLED === "true";
// Backwards-compatible alias for existing provider/booking routes.
export const PHASE2_ENABLED = HOME_SERVICES_ENABLED;

/**
 * Mortgage is "Coming Soon" and not an MVP production feature
 * (docs/PRODUCT_SCOPE.md). ULTRA is not a lender or broker, so while this is
 * off the Mortgage tab shows a coming-soon page and no repayment calculator,
 * listing link or footer link is reachable. The calculator code is kept so
 * it can be switched on if the owner reconsiders in a later phase. Fails
 * closed: unset means off.
 */
export const MORTGAGE_ENABLED = process.env.NEXT_PUBLIC_MORTGAGE_ENABLED === "true";
