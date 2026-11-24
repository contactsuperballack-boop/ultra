# Data Retention & Deletion Policy

Readiness §8: "define document retention and deletion rules" and "define account deletion behavior." This document describes what the system in this repository actually does — see `auth.requestAccountDeletion` (`packages/api/src/routers/auth.ts`) and `User.deactivatedAt` (`packages/db/prisma/schema.prisma`) for the implementation this policy describes. Same standing instruction the rest of this codebase follows for legal-adjacent content: this is a starting draft grounded in the real system, not legal advice, and needs qualified review — same flag already on `/privacy` and `/terms` — before being relied on as a compliance statement (Nigeria's NDPR, not just GDPR-by-analogy, is the relevant framework and hasn't been checked against by a lawyer).

## What "deleting your account" actually does

**Immediately, on request:**
- Every active session is signed out (all refresh tokens revoked) — this takes effect right away, unlike the items below
- `name` is overwritten to "Deleted user"
- The push notification token is cleared
- Saved property bookmarks (`SavedListing`) and saved-search preferences (`SavedSearch`) are deleted because they are private discovery preferences, not another party's transaction history
- Any `LIVE`/`PENDING_REVIEW`/`UNDER_REVIEW` listings the account owns (if a realtor) are set to `REMOVED`, logged the same way an admin removal would be
- Any active offerings the account owns (if a provider) are deactivated

**Within roughly 15 minutes** (the access-token lifetime): any still-valid access token from before deactivation stops being usable for anything requiring a fresh login/refresh check, since `verifyOtp` and `refresh` both reject a deactivated account. A token that hasn't naturally expired yet could, in principle, still authenticate a request in that window — this is a disclosed tradeoff, not an oversight: instant token invalidation would need checking deactivation status on every single request rather than only at login/refresh, which is a real cost this system doesn't pay at MVP scale. Worth revisiting if this policy is ever load-bearing for a real regulatory deadline (NDPR doesn't specify an instant-effect requirement, but "reasonably prompt" is a common standard).

## What is retained, and why

**Retained, not deleted:**
- `Message` / `ServiceMessage` records the deactivated user sent — these live inside another user's `Inquiry`/`ServiceRequest` thread. Deleting them would silently corrupt the other party's own record of a conversation they're entitled to keep.
- `PaymentTransaction` records — financial ledger entries, retained for the same reason a bank retains transaction records after an account closes: audit, dispute resolution, and (once this is a real business) tax/regulatory recordkeeping.
- `VerificationLog` / `ProviderVerificationLog` / `ListingModerationLog` entries — these are the platform's own audit trail of admin decisions, not really "the user's data" in the sense the deletion right is about.
- `phone` — **not** redacted on deletion, a deliberate choice, not an omission. Reasoning: (1) it prevents a bad actor from deactivating and immediately re-registering to shed a bad reputation/restriction while pretending to be new, since `phone` is the unique identity anchor the whole auth system is built on; (2) it's needed if an admin ever needs to investigate a fraud report that involves this account after deactivation. This is exactly the kind of tradeoff that needs real legal sign-off, not just an engineering judgment call — flagged here specifically so it doesn't get missed in review.

**What is genuinely erased:** `name`, `pushToken`, `SavedListing` bookmarks and `SavedSearch` preferences, at present. This is a deliberately minimal first pass, not a complete "right to erasure" implementation — a real NDPR-compliant deletion flow likely needs to go further (e.g. review whether `email`, if set, should be redacted too) once this gets legal review.

## Reactivation

Not self-service. A deactivated account cannot simply log back in — `verifyOtp` explicitly rejects it (see the code comment: "reactivation is a support conversation for now, not a self-service side-effect of a successful OTP check"). If reactivation is ever wanted, it should be a deliberate admin action, not a side effect of the same login flow that created the account in the first place.

## Document retention beyond user accounts

Not yet defined in writing: how long verification documents (ID scans, CAC uploads in the private R2 bucket) are kept after a realtor/provider is rejected or deactivated. Current behavior is indefinite retention — no automated expiry exists. Worth a real retention window (e.g. purge rejected-applicant documents after N months) once this is more than a pilot, since indefinite retention of ID documents is exactly the kind of thing NDPR review is likely to flag.

## Backups

See `docs/OPERATIONS.md`'s backup section for retention windows on database backups — a deleted/deactivated user's pre-deletion data will exist in backups taken before the deletion for as long as those backups are retained, same as any other backup system. This is disclosed here rather than left implicit, since "delete my account" and "delete my data from every backup" are different, and only the former is what this system currently does.
