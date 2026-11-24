/**
 * Gate B #2 — a server-side transition matrix, checked on every status
 * change rather than trusting "the caller only sent a plausible-looking
 * status." Two separate matrices because realtors and admins are allowed
 * different moves from the same states — a realtor pausing their own LIVE
 * listing to DRAFT is fine; a realtor setting DRAFT straight to LIVE
 * bypasses moderation entirely (Phase 1 trust boundary repair, item 4),
 * which is exactly the bug this whole remediation pass started from.
 */

export type ListingStatusValue =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "LIVE"
  | "UNDER_REVIEW"
  | "SOLD"
  | "RENTED"
  | "REMOVED";

// Realtor self-service, via listings.setStatus. Notably: LIVE never
// appears as a target here — the only way a listing reaches LIVE is
// through admin approval (listings.adminSetStatus), full stop. "DRAFT"
// functions as the realtor's own voluntary pause/delist, kept distinct
// from REMOVED (which stays admin/report-only) so the two meanings never
// get conflated in the moderation queue.
const REALTOR_TRANSITIONS: Record<ListingStatusValue, ListingStatusValue[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: [],
  LIVE: ["SOLD", "RENTED", "DRAFT"],
  UNDER_REVIEW: [],
  SOLD: ["PENDING_REVIEW"], // realtor can resubmit if they marked it sold in error
  RENTED: ["PENDING_REVIEW"],
  REMOVED: [], // only an admin/report action reaches REMOVED, and only an admin can move off it
};

// Admin, via listings.adminSetStatus. Deliberately narrower than "any
// status from any status" — approving TO LIVE only makes sense from a
// state that was actually awaiting a decision; REMOVED is reachable from
// any non-terminal state (a fraud finding can happen at any point).
const ADMIN_TRANSITIONS: Record<ListingStatusValue, ListingStatusValue[]> = {
  DRAFT: ["REMOVED"],
  PENDING_REVIEW: ["LIVE", "REMOVED"],
  LIVE: ["REMOVED"],
  UNDER_REVIEW: ["LIVE", "REMOVED"],
  SOLD: ["REMOVED"],
  RENTED: ["REMOVED"],
  REMOVED: [], // removed is terminal even for an admin through this endpoint — reinstating is a deliberate, separate action worth its own audit trail, not folded into the same mutation
};

export function isValidListingTransition(
  actor: "realtor" | "admin",
  from: ListingStatusValue,
  to: ListingStatusValue
): boolean {
  const matrix = actor === "realtor" ? REALTOR_TRANSITIONS : ADMIN_TRANSITIONS;
  return matrix[from]?.includes(to) ?? false;
}
