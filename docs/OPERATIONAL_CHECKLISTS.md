# Operational Checklists

Readiness §6: "these can be internal checklists rather than a complex support system" — this document, not a ticketing platform. Every reference below points at a real field, mutation, or threshold that actually exists in the codebase as of this session, not a description of a system that doesn't exist yet.

---

## Realtor verification

**Required documents:** government-issued ID (JPEG/PNG/PDF, max 10MB — `UPLOAD_LIMITS.MAX_DOC_BYTES`), agency name, CAC registration number (optional — its absence doesn't block approval, but speeds review).

**Review checklist** (`/admin/verification`):
- [ ] ID document is legible and appears genuine (photo, not a screenshot of a screenshot)
- [ ] Agency name isn't already associated with a different, currently-verified account (a real duplicate-account signal the UI doesn't automate — check manually until it's worth building)
- [ ] If CAC number provided, it's a plausible format (`RC-` prefix, digits)

**Approval:** sets `identityVerified` + `businessVerified` both true (Sprint 6) — this is an honest statement that the same review just checked both, not two separate passes. Also promotes `User.role` to `REALTOR` and logs to `VerificationLog`.

**Rejection:** always include a note — it's what the realtor sees on their pending/rejected screen (`/dashboard/verification`). "Document unclear, please resubmit a clearer photo" is actionable; "Rejected" alone is not.

**Escalation:** anything that looks like a fabricated document (not just a low-quality one) goes to a second admin before rejecting, not just resolved unilaterally — this system doesn't have a formal second-review queue, so this is a "talk to a colleague first" rule, not a workflow.

**Renewal:** not currently time-boxed — `verifiedAt` is set once and doesn't expire. Worth a periodic re-check (e.g. annually) once volume justifies building it; a manual spot-check in the meantime.

---

## Provider verification (Phase 2)

Same shape as realtor verification (`/admin/provider-verification`), with two differences:
- Categories (Painting/Plumbing/Fumigation/Electrical) are selected by the provider at application and **cannot be added later without contacting support** — `createOffering` rejects a category the provider isn't verified for. If a provider needs an additional category, that's a manual DB/admin action for now, not a self-service flow.
- Approval also sets `freeUntil` (60 days from approval) — the provider can accept jobs commission-only, no subscription required, until that date. This is set once, on first approval only; re-approving after a prior suspension does not grant a second free window (see the code comment in `providers.adminSetVerificationStatus`).

---

## Listing moderation

**Acceptable photos:** JPEG/PNG/WebP, max 5MB each, up to 10 per listing (`UPLOAD_LIMITS`). Clear and well-lit — no explicit automated check for this yet, human judgment call.

**Pricing rules:** `checkPriceBand()` (`packages/db/src/priceBand.ts`) flags a listing automatically if its price falls outside the band for its area. **These bands are deliberately rough starting values**, per the handoff — tighten them from real listing data over time, don't treat them as finished. A flagged listing isn't necessarily wrong; it's a prompt to look closer, same as every other flag in this system.

**Location checks:** `area` is free text (Abuja neighborhood names) — no gazetteer validation yet. Obviously wrong areas ("Lagos," "London") should be caught on review; a systematic area-name allowlist is a reasonable future addition once real listing volume shows what variants actually get submitted.

**Duplicate checks:** `detectDuplicateSignals()` (Sprint 6) runs automatically on every `listings.create` call and routes anything scoring ≥30 (`DUPLICATE_REVIEW_THRESHOLD`) to `UNDER_REVIEW` with the specific matched signals in `flagReason`. Read the flag reason before deciding — it names exactly which signal fired (same address+price, phone reuse, cross-type reuse, image-hash match, or title similarity) and against which listing IDs.

**Land listing checks:** no video allowed (enforced at the API layer, not just the UI — a hand-built request can't bypass this). `landSizeUnit` is a display label only; don't assume it implies a specific sqm conversion.

**Ownership evidence:** set explicitly on approval (`ownershipEvidence` — owner listing / authorized agent / agency mandate / developer listing / land representative), visible on the admin flagged-listings screen. Leaving it at the default `PENDING` is honest if you genuinely don't know — don't guess a category to make the badge look more complete than the review actually was.

**Expired listing policy:** not automated — no cron job marks a stale `LIVE` listing as anything else. A manual periodic sweep (e.g. anything `LIVE` with no `updatedAt` change in 90+ days gets a "still available?" check) is a reasonable interim process; automating it is a Priority 2 item, not urgent at current volume.

---

## Reports and fraud

**Response time target:** open reports (`/admin/reports`) should get a first look within 24 hours — reporting is a trust signal, and a report that sits for a week teaches users not to bother reporting.

**Temporary suspension:** available directly from the report-resolution screen (`suspendListing: true` on `adminResolveReport`) — sets the listing to `REMOVED` and logs it. No separate "temporary" state exists yet; a suspended listing needs to be manually restored (change status back) if the report turns out to be unfounded, not automatically reinstated after a cooldown.

**Realtor restriction:** also available from the same screen (`restrictRealtor: true`) — sets `restrictedAt`/`restrictedReason`, enforced server-side in `listings.create` (a restricted realtor's create calls are rejected with the reason shown). This is a lighter action than full verification suspension; use it when the pattern is "several reports against this realtor," not "this one listing was wrong."

**Evidence collection:** the report's `comment` field plus the listing's own state at report time (price, photos, flagReason if any) is what you have — there's no separate evidence-attachment flow. Screenshot anything time-sensitive (e.g. a listing that gets edited after being reported) outside the system if it might matter for a dispute later.

**Appeal process:** not built. A realtor whose listing was suspended or who was restricted has no self-service appeal screen — this is a manual, off-platform conversation for now (email/WhatsApp per the support section below).

**Permanent removal:** reserve for confirmed fraud (fabricated ownership, confirmed duplicate-plot scam pattern) or repeated unresolved reports after a restriction was already tried and ignored — not a first response to a single report.

---

## Payments

**Failed top-up/settlement handling:** a `PaymentTransaction` stuck in `PENDING` for more than ~1 hour past Paystack's normal callback window likely means the webhook never fired or failed — check Paystack's own dashboard for the transaction's real status before assuming it's simply slow. Do not manually mark a `PENDING` transaction `SUCCESS` without confirming against Paystack directly; that's exactly the kind of shortcut the webhook's signature verification exists to prevent.

**Refund approval:** use `/admin/payments` (Refund tab) — amounts are automatically capped at what's actually outstanding (a realtor's `creditBalanceNaira`, a provider's `commissionOwedNaira`), so there's no risk of a refund request accidentally creating a negative balance. Always fill in the reason field; it's permanently attached to the ledger entry.

**Manual adjustments** (the `MANUAL_ADJUSTMENT` type, distinct from a refund): use when correcting a platform-side error (wrong commission calculated, a credit that should have been applied and wasn't) — not as a substitute for a refund when the situation actually is a refund. The direction (credit/debit) is explicit in the UI specifically so a mistake here can't silently flip which way money moves.

**Duplicate payment handling:** the webhook is idempotent by design (checks `status === "SUCCESS"` before crediting, keyed on Paystack's reference) — a genuinely duplicated webhook fire should be a no-op, not a double-credit. If a realtor/provider reports being charged twice for what looks like one action, check `myTransactions`/`myProviderTransactions` for two distinct `providerRef` values before assuming the idempotency guard failed; two legitimate, separate actions (e.g. two top-ups close together) will correctly show as two transactions.

**Charge disputes:** same principle as evidence collection above — the ledger entry itself (amount, type, timestamp, note) is the record. There's no separate dispute-tracking flow; handle case-by-case via the manual-adjustment/refund tools once you've confirmed what actually happened.

---

## Support

**Buyer complaint categories:** map to the existing `ReportReason` enum where a listing is involved (duplicate, wrong price/location, false photos, unavailable, suspected fraud, unauthorized listing) — use "harassment" for anything about a realtor's conduct rather than the listing itself. Anything not listing-related (account issues, general confusion) doesn't have a structured category yet; log it manually.

**Realtor complaint categories:** lead-fee billing disputes, verification rejection questions, listing rejection/flag questions. Route billing disputes to the payments checklist above before responding.

**"Why can't I republish my listing myself?"** — a real, expected question, not an edge case. Before the Phase 1 remediation pass, a realtor could pause a `LIVE` listing and instantly resume it themselves. That behavior is gone on purpose: it was the same self-service path that let a realtor bypass moderation entirely and publish a brand-new listing straight to `LIVE` with no review at all — closing the second necessarily closed the first, since they were the same code path. The correct answer to give a realtor who asks: pausing (Live → Draft) is still instant and self-service; resuming now goes through the same review queue as a new listing (Live → Draft → Pending Review → admin approval), same as new listings.
- If they're asking because they made an honest mistake pausing a listing they wanted to keep live: apologize for the friction, explain it's a trust/security requirement, and flag their resubmission for expedited review if the listing was already previously approved and nothing about it changed.
- If they're pushing back hard or asking repeatedly how to get around it: that pattern itself is worth noting on the account — it's exactly the profile of someone who'd have used the old self-publish hole.

**Response targets:** no formal SLA yet at this scale — a same-business-day acknowledgment (even just "we're looking into it") is a reasonable floor; Readiness §6 explicitly says internal checklists are fine for a launch this size, not a full support system.

**Escalation contact:** whoever's on the founding team handling verification/moderation this week — no dedicated support role exists yet. Document who that is somewhere more durable than this file once it's more than one person.

**Closure rules:** a complaint is closed when the underlying action is actually taken (report resolved, refund applied, verification decision made) and the person who raised it has been told — not when it's simply been looked at.
