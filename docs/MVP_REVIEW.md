# MVP Review — Optimization, Security, Efficiency, Regressions

Every item below was checked against the actual code this session (line numbers and file paths given where relevant), not recalled from general knowledge of what SaaS marketplaces usually need. Severity is ranked by real impact given ULTRA's current pilot scale, not by category.

---

## 1. A real regression, found while writing this review — **FIXED**

**`inquiries.create`'s LIVE-only check ran before its existing-thread check.** Fixed: the existing-thread lookup now runs first, and only a genuinely *new* inquiry requires the listing to be `LIVE`. An existing thread stays open regardless of what happens to the listing afterward, matching the Technical Spec's explicit edge case. Regression tests added (`remediation.test.ts`): one confirming an existing thread survives the listing leaving `LIVE`, one confirming a *new* inquiry still correctly can't start on a non-LIVE listing.

---

## 2. Security — what's genuinely still open

| Gap | Where | Why it matters |
|---|---|---|
| ~~No rate limit on `inquiries.reply` / `serviceRequests.reply`~~ | **FIXED** — both now limited (100/hour per user), plus `respond`/`markInProgress`/`complete` (100/day per provider) | — |
| **This session's security sweep was manual, not exhaustive** | Flagged explicitly in `EXECUTION_PLAN.md`'s appendix | I checked every router I could find touching `realtorProfile`/`providerProfile`, but "every router I could find" is not the same guarantee as a real static-analysis pass. This is exactly what Sprint 4's still-blocked dependency/SAST scan is for — don't treat the manual sweep as the final word. |
| **`phone` is retained, unredacted, on account deletion** | `docs/DATA_RETENTION.md` | Disclosed and reasoned through, not an oversight — but it's a real tradeoff a lawyer should weigh in on before this is presented as NDPR-compliant. |
| **Verification document retention has no expiry** | Same doc | Rejected applicants' ID scans sit in the private bucket indefinitely. No automated purge exists. |
| **Access tokens remain valid for their full ~15 minutes after account deactivation** | `docs/DATA_RETENTION.md`, `auth.ts` | Disclosed tradeoff, not a bug — but worth knowing precisely, not assuming instant effect. |

**What's already solid, worth not re-litigating:** KYC documents are now genuinely private (separate bucket, signed reads, admin-only); the two concurrency races (service completion, refresh-token rotation) are fixed with real atomic guards, not just documented as known issues; every ownership boundary I could find has an explicit test.

---

## 3. Efficiency — concrete, not speculative

| Gap | Where | Impact |
|---|---|---|
| ~~No pagination on `inquiries.forRealtor` / `serviceRequests.forProvider`~~ | **FIXED** — both cursor-paginated, matching the admin queue pattern; realtor inbox's optimistic-send logic updated to use `setInfiniteData` correctly | — |
| ~~`notifications.list` hard-capped at 50~~ | **FIXED** — cursor-paginated on both web (a "Load more" button) and mobile (`FlatList`'s native `onEndReached`) | — |
| **Duplicate-detection query cost scales with listings-per-area** | `listings.create`, `duplicateDetection.ts` | Fine at Abuja-neighborhood granularity today. Worth an index/volume check once any single `area` string accumulates hundreds of listings — the query itself (`WHERE area = ? AND status != REMOVED`) is already indexed (`@@index([area])`), so this is a "watch it," not a current problem. |
| **No caching layer anywhere** | Whole API | Deliberate, disclosed choice from earlier in this build ("premature right now") — restated here so it doesn't get silently forgotten as a real backlog item once `listings.search`/`providers.search` see real read traffic. |
| **`notify()` runs synchronously inline with the request** | `lib/notify.ts`, called from every message/status-change mutation | A slow push-provider call currently adds latency to the user-facing request that triggered it. Background job infrastructure (BullMQ against the existing Redis, already flagged in the handoff) is the real fix — not urgent at pilot scale, worth prioritizing before Phase 2's job-completion notifications see real volume. |

---

## 4. Optimization opportunities (not gaps, just genuine upside)

- **`providers.dashboardSummary` runs 4 separate queries via `Promise.all`.** Correct and not slow, but could collapse into fewer round-trips with a single aggregation query once this endpoint is called more than once per page load.
- **Saved-search alerts** are now implemented in Stage 04 (in-app notifications plus best-effort push on approved publication). **Map-based search** remains unbuilt pending a privacy-safe coordinate capture and map-provider decision.
- **Analytics event tracking** is still entirely absent. Every session note that's touched this has flagged it the same way: retrofitting after real usage exists loses the early data permanently. This is the one item on this whole list I'd actively push to prioritize sooner rather than later, precisely because delay is irreversible in a way most of the others aren't.

---

## 5. Hardening — beyond what's already done

- **The listing-status transition matrix (Sprint 1 remediation) is a real, deliberate friction tradeoff, not a pure improvement — now addressed on both the support and product side, not left as a code comment nobody using the app will read.** Before: a realtor could pause and directly republish their own listing. Now: resuming a paused (`DRAFT`) listing requires resubmitting to `PENDING_REVIEW` and waiting for another admin pass — closing the self-publish security hole necessarily added review latency to a previously-instant realtor action. **Closed two ways:** (1) `docs/OPERATIONAL_CHECKLISTS.md` now has a direct "why can't I republish myself" support script; (2) there was actually no UI at all for pausing/resuming a listing before this pass (`dashboard/listings/page.tsx` was read-only) — built one from scratch with the correct transition rules baked in and inline copy explaining the pause/resume asymmetry right where a realtor would hit it, rather than only documenting the restriction after the fact.
- **`updateOffering`'s stricter post-update validation** (Gate B #5 fix) will now reject a request that used to silently succeed into a broken state (`priceType=FIXED, priceNaira=null`). This is strictly a correctness fix, but any client code that was relying on the old permissive behavior (none currently does, verified) would need updating.
- **The minimum-message-length bump (3→10 characters) on `inquiries.create`/`serviceRequests.create`** could, in principle, reject a legitimate very-short first message. In practice "Is this available?" is 21 characters, and nothing in the actual UI's quick-action templates falls under 10 — checked, none do — so this is a theoretical rather than real regression risk, but worth knowing it's there if a future UI change adds a shorter quick-action.

---

## 6. Overall recommendations, prioritized

1. **Fix the inquiries.create ordering bug (§1)** — small, precise, closes a real gap against the project's own written spec.
2. **Add rate limiting to the reply/response endpoints (§2)** — cheap, mirrors a pattern already established everywhere else in this codebase.
3. **Run the actual migration verification script and the real critical-path test** — still the single highest-value next step, unchanged from every prior status update this session. Everything else in this document is secondary to actually running this system for the first time.
4. **Get a second reviewer (human or a fresh AI pass with different context) on the security surface** before real users' KYC documents and money touch this — explicitly flagged, not assumed away, at the end of the last handoff and worth repeating here.
5. **Prioritize analytics event tracking before Stage 2/2b beta traffic starts** — the one item on this list where delay is irreversible, everything else can be fixed after the fact.
6. **Treat the pause/republish friction (§5) as a support-documentation item, not a code fix** — the security tradeoff is correct; the right response is explaining it clearly to realtors, not reopening the hole.
