# ULTRA — Project Handoff

**As of:** end of this build engagement · **For:** whoever picks this up next, including a future you after a break

This is the one document meant to stand on its own — read this first. Everything else in `docs/` and this file's own references go deeper on a specific topic; this file is the map.

*(There's an older `docs/HANDOFF.md` from a much earlier point in this project's history — it's kept for context but this file supersedes it. If the two ever seem to disagree, trust this one.)*

---

## 1. What ULTRA Is

ULTRA is a verified property marketplace for Abuja, Nigeria. Realtors list completed buildings, plots of land, and rentals; buyers browse and message realtors directly, entirely in-app; every realtor and every listing goes through a trust/verification pipeline before it's visible to the public. Phase 2 extends the same trust infrastructure to home services (painting, plumbing, fumigation, electrical) — customers browse verified providers and book jobs the same way.

**Mission:** simplify every stage of property ownership through trusted technology.

**North Star:** become the platform homeowners continue using long after purchasing a property — not a listings app, but the beginning of a longer relationship (search → buy → move → maintain → improve → sell again).

**What ULTRA is *not*, on purpose:** not a Zestimate-style valuation engine, not a mortgage lender, not an escrow service for full-price transactions, not (yet) anything beyond Abuja. Each of these is a deliberate exclusion, not an oversight — see §4.

---

## 2. Why Abuja, Why Now

Real estate in Abuja is growing, but discovery hasn't modernized with it. Realtors and agencies compete mainly through large street-marketer teams, not digital reach. Buyers rely on WhatsApp forwards, Instagram posts, and word of mouth rather than trusted search. That gap — not a housing shortage — is the opening.

Nigerian real estate also carries well-documented fraud risk: fake agents, unverifiable ownership claims, duplicate sales of the same plot. This is why verification is treated as core infrastructure here, not a bolt-on feature added once volume justifies it. An unverified listing that turns out fraudulent does more lasting damage to trust than a slow month of growth ever would.

The founding thesis for choosing a **listings marketplace** over the technically-easier **home-services** wedge: direct founder observation of the marketer-dependency problem in Abuja outweighed the general pattern that services are easier to cold-start. Full comparison lives in the Blueprint, §7 — Phase 2 (services) was always the planned fast-follow, not a distant future line, because it reuses the same verification infrastructure being built for Phase 1.

---

## 3. Research That Shaped Real Decisions

Zillow's own documented failure modes were checked against ULTRA's actual choices mid-build (`docs/ZILLOW_ANALYSIS.md` has the full detail). The short version, because it validates several decisions that might otherwise look overly conservative:

- **Zillow Offers lost $880M+ and shut down in 2021** — the root cause repeatedly cited was taking on financial exposure faster than the underlying pricing model's real accuracy justified. ULTRA's exclusion of off-plan listings and its refusal to take commission-on-close are the same lesson, applied in advance: never take on exposure to an outcome you can't independently verify.
- **The Zestimate's most-cited consumer complaint is showing one confident number instead of a range.** ULTRA's price-band check (`checkPriceBand()`) does the opposite by design — it flags a range for human review, never asserts a single "true" price. The same logic is why the trust framework uses four separate verification badges instead of one generic "VERIFIED" checkmark (§7 below).
- **Zillow's own documented rental-scam pattern** — a real listing's photos reused under a different contact/type — is specifically checked for in ULTRA's duplicate-detection logic, not just prevented incidentally by architecture.

---

## 4. Scope — What's In, What's Deliberately Out

**Phase 1 (in scope):** Abuja only. Completed residential and commercial buildings, plots of land, rentals. Realtor/agency onboarding with identity and business verification. Listing submission → verification review → publication. Buyer search, discovery, in-app inquiry. A minimal admin console.

**Phase 1 (explicitly excluded, not forgotten):** off-plan/pre-construction (developer-default and land-title risk too costly before verification infrastructure is mature — Blueprint §7), mortgage/insurance/financial services, property-manager tooling, investment/valuation features, a "My Home" post-purchase dashboard. All of these remain part of the long-term vision (Blueprint §6's eight-phase homeowner lifecycle) — sequenced behind proof that the marketplace's trust and monetization model actually works, not cancelled.

**Phase 2 (in scope, built this engagement):** home services — painting, plumbing, fumigation, electrical, exactly these four categories and no others for now. Provider onboarding/verification mirrors the realtor pattern exactly. Customer discovery and booking flow exists on both web and (as of this session) mobile.

**Monetization, deliberately not the obvious choice:** Phase 1 charges a per-inquiry lead fee, not commission-on-close — the platform cannot reliably observe whether or when a sale actually closes, so that's not the basis for revenue. Phase 2 charges commission on job completion (something the platform *can* observe, since the provider self-reports it) plus optional provider subscriptions for search-ranking boost. Both mechanisms are live simultaneously on purpose — nobody guessed which one realtors/providers would prefer, so both were built and the decision gets made from real data.

---

## 5. Technical Architecture

**Stack:** TypeScript monorepo (pnpm + Turborepo). `@ultra/db` (Prisma + PostgreSQL, single shared schema for both phases). `@ultra/api` (tRPC — shared, compile-time-checked types across web and mobile, chosen over a separate NestJS service for team-size reasons; REST kept alongside for the one thing that genuinely needs it, Paystack webhooks). Next.js web app (buyer-facing public pages, realtor dashboard, partner/provider dashboard, admin console). Expo/React Native mobile app (buyer + customer-facing only — realtors and providers use web, a deliberate choice since photo-heavy listing management suits a larger screen).

**Why this matters for anyone extending it:** the schema is genuinely shared — a change to `Listing` or `ProviderProfile` affects both apps' generated types immediately, which is the whole point of the tRPC choice, but also means a careless schema edit has a wide blast radius. Always run `pnpm typecheck` across the whole monorepo after a schema change, not just the package you were editing.

**Data model highlights worth knowing before touching them:**
- `PaymentTransaction` is a shared ledger for both realtor lead-fee billing and provider commission billing — exactly one of `realtorProfileId`/`providerProfileId` is set per row, enforced at the application layer (Prisma can't express an XOR constraint declaratively).
- `PlatformConfig` is a deliberate single-row table (`id` always `"default"`) holding the lead fee and commission rate — genuinely admin-editable via `/admin/settings`, not just moved into a table that still needs direct DB access to change.
- `AnalyticsEvent.userId` has **no foreign key** on purpose — a deleted account's historical events survive as an anonymous-looking record, matching `docs/DATA_RETENTION.md`'s own reasoning, rather than cascade-deleting.

---

## 6. What Has Been Built

### Phase 1 — Property Marketplace
- Phone-OTP auth (Termii in production, console-log fallback in dev — never fakes a working integration in production), JWT access tokens + rotating refresh tokens with a real concurrency fix (two simultaneous refresh calls no longer both succeed and fork a session)
- Listing search/filter/detail, realtor dashboard (create/edit listings, inquiry inbox with derived status labels, billing, subscription), a guided multi-step verification onboarding wizard with save-and-resume
- Automatic price-band flagging on listing creation, plus deterministic duplicate-listing detection (same-address+price matches, the Zillow-documented listing-hijacking pattern, reused phone numbers across accounts, title similarity) — routes to admin review, never auto-rejects
- Admin: realtor verification queue, flagged-listing moderation queue, listing reports queue with suspend/restrict actions, payment corrections screen (refunds + manual ledger adjustments, both sides of the marketplace), platform pricing settings
- Server-side listing status transition matrix — a realtor can pause their own listing instantly but **cannot** self-publish to `LIVE`; only admin approval reaches that state (this closed a real security hole — see §8)
- Four-level verification badges (identity / business / listing reviewed / property evidence) instead of one generic "VERIFIED" checkmark
- Reporting & escalation: report button on every listing, admin resolution with suspend/restrict actions

### Phase 2 — Home Services
- Provider onboarding mirroring the realtor pattern exactly (verification, categories restricted to the four launch trades, offerings with FIXED/HOURLY/QUOTE pricing)
- Customer discovery and booking on **both web and mobile** (mobile Services flow was built this engagement — Phase 2 was web-only before)
- Commission accrual on job completion (10% default, configurable), a 60-day free-onboarding window that waives the *subscription* requirement without waiving commission, provider billing/settlement via Paystack

### Trust, Security, and Data Integrity (the remediation pass)
A dedicated audit found and fixed several serious issues, verified against actual code before any fix was applied, not assumed from a description:
- A public endpoint (`listings.byId`, later also found independently in `providers.byId`/`search` and again in `realtors.byId`) was leaking realtor/provider financial balances and KYC document URLs to any unauthenticated caller. Closed with one shared safe-projection constant reused everywhere, rather than a per-endpoint judgment call each time — and the fact that this pattern was found **three separate times in three separate sweeps** is itself the honest lesson: treat any "trust boundary audit" as provisional until a real static-analysis tool has run, not as a closed question.
- `inquiries.reply` had no participant check at all — any signed-in user could inject a message into a stranger's conversation. Fixed, with a regression test.
- KYC documents were never actually private despite the original spec's explicit requirement — stored in the same publicly-readable bucket as listing photos. Fixed with a genuinely separate bucket and short-lived signed read URLs, admin-only.
- Two real concurrency races (a service job's completion could be double-billed; two simultaneous session refreshes could both succeed) — both fixed with atomic conditional database updates, not just documented as known risks.
- A DB-level unique constraint plus race handling on `Inquiry` so a buyer double-clicking "send" can't create two billable leads from one action.
- Lead fee and commission rate moved from hardcoded constants to a genuinely admin-editable config, with billing states (charged/accrued/collected/unpaid) clearly labeled instead of one ambiguous `SUCCESS` status.

### Account Lifecycle & Compliance
- Account deletion — soft-deactivation, immediate session revocation, PII redaction, automatic takedown of a deactivated realtor/provider's live listings/offerings, explicit blocking of silent reactivation via login. This was **completely missing** before this engagement, not partially built.
- `docs/DATA_RETENTION.md` — written against the actual implementation, including deliberately disclosed tradeoffs (why phone numbers are retained, why token invalidation isn't instant).
- Draft Privacy Policy and Terms of Service, explicitly marked as needing qualified legal review.

### Analytics
- `AnalyticsEvent` tracking wired at the six points that back the Blueprint's own success metrics (registration, listing views, searches, inquiries, service requests, job completions), with a durable-first, best-effort-external-push pattern so first-party data is never lost even without a PostHog key configured.

### Mobile App Redesign
- Full theme system (light/dark/"match device," genuinely wired into every screen — not just the visible ones) and a font-selection feature, both sampled and built from the actual provided brand assets, not approximated by eye
- The five-category navigation (For Sale / Land / For Rent / Mortgage / Services) exactly as specified, with "Mortgage" honestly marked as reserved space rather than a dead button pretending to work
- A real onboarding screen, app icon, and splash screen generated from the provided logo (auto-cropped and color-keyed, not the raw asset stretched into place)
- `ListingDetailScreen` rebuilt with real photo rendering, verified-badge overlay, share, expandable sections; a genuinely new `RealtorProfileScreen` that didn't exist before

### Testing
57 unit tests, all passing, covering price-band logic, commission math, duplicate detection, the listing-status transition matrix, OTP hardening, Paystack webhook signature verification, and analytics provider selection. A substantial integration test suite (ownership boundaries, concurrency fixes, the full account-deletion contract, analytics event firing) is written and structurally cross-checked against the actual routers by hand — **none of it has ever executed**, because no Postgres has ever been available in any environment this was built in.

---

## 7. What Has NOT Been Built — By Category, Not Hidden

**Never executed, the umbrella gap under everything else:** no `pnpm install` has ever run. No migration has ever applied to a real database. No Paystack/Termii/R2 sandbox test has happened. No real device has run the mobile app. Every fix and every test in this project was verified by hand-reasoning and unit tests, not by running the system end to end. `docs/MIGRATION_GUIDE.md` and `scripts/verify-migration.sh` exist specifically to make this the very first thing done on a real machine.

**Infrastructure/ops — needs a real environment, not more code:** staging environment, real alerting, an actually-performed backup-restore drill, a dependency/SAST scan (no network access has ever existed in any build session).

**Legal — needs a lawyer:** Privacy Policy, Terms of Service, and the data retention policy are explicit drafts.

**Known, disclosed product gaps:**
- Reviews/ratings — deferred by product decision, not an oversight; schema exists, zero UI either side
- Saved-search alerts, map-based search — identified as high-leverage, not built
- Image-hash duplicate detection — the schema field exists (`ListingPhoto.contentHash`), nothing populates it yet (needs client-side perceptual hashing before upload)
- A full trust-language audit across every UI string ("verified"/"trusted"/"approved") — only newly-written copy follows the safer wording from `docs/OPERATIONAL_CHECKLISTS.md`; older strings haven't been swept
- No mobile app for realtors/providers themselves — the customer/buyer-facing side is now on both platforms; the professional-facing dashboards remain web-only, a deliberate choice pending real Phase 2 usage data before investing in a second client
- A second SMS provider — Termii is a single point of failure, acceptable at current volume, not indefinitely
- No background job infrastructure — notifications and price-band checks run synchronously inline with the request that triggers them; fine at pilot scale, a real cost once volume grows
- Analytics — instrumented, but has never actually captured a real event, since nothing has run

**A business question, not an engineering one:** whether realtors/providers will actually pay for lead fees and commission is the Blueprint's own explicitly flagged open question. No amount of further building answers it — only real usage data does.

---

## 8. Suggestions, Recommendations, and Honest Inferences

**Run the system before doing anything else.** Every recommendation below assumes it boots. If it doesn't, that's the only finding that matters, and no other item on this list is worth prioritizing over it.

**Treat every "security sweep" as provisional, including this engagement's own.** The same public-data leak pattern was found independently three times across three different passes in this codebase — not because the fixes were wrong, but because a manual sweep is bounded by what the reviewer thought to check. A real dependency/SAST scan is not optional polish; it's the thing that would have caught this faster.

**The commission/lead-fee dual monetization model is a genuine experiment, not a hedge.** Watch real data early — which one realtors/providers actually respond to — rather than letting both run indefinitely out of indecision. The Blueprint's own instinct (build both, decide from data) was correct; the follow-through requires actually looking at the data once it exists.

**Beta in the sequence the Blueprint already lays out, not all at once:** internal validation → supervised realtor beta (10–20 hand-picked realtors, matching the founding team's own instinct to hand-review the first cohort directly) → a separate, later-gated provider pilot (Phase 2 should stay labeled internally as a pilot until it clears the same bar Phase 1 is held to, particularly around payment idempotency) → buyer beta → limited public launch. `EXECUTION_PLAN.md` has the full stage-by-stage gating criteria.

**Analytics is the one item where delay is irreversible.** Everything else on this list can be fixed after the fact; usage data from before instrumentation existed cannot be recovered. It's built now — the next step is confirming it actually fires in a real environment, then leaving it alone.

**Don't let the mobile Partner App question get decided by default.** The backend is already app-agnostic — `providers.*` and `serviceRequests.*` don't care what client calls them — so a provider-facing mobile app is additive whenever it's built, not a rebuild. The right trigger is real Phase 2 web-pilot usage data showing field-trade providers actually want a mobile-first experience, not a speculative build now.

**A few small, concrete follow-ups worth doing in the same spirit as this engagement's own fixes**, since they were found but not chased to completion:
- Add rate limiting to any newly-built endpoint by default, not as an afterthought — this was the single most common gap found across three different review passes
- The `Text.render` font-injection technique in the mobile app is a known, working pattern but has never been confirmed against the actual installed React Native version by running it — verify this specifically, since a broken version of it would fail silently (text would just render in the default font, not throw an error)
- Revisit the price bands in `packages/db/src/priceBand.ts` — they're deliberately rough starting values, meant to be tightened from real listing data, not treated as finished

---

## 9. Immediate Next Steps, In Order

1. `pnpm install`, then `pnpm verify:migration` (runs the full empty-DB/seeded-DB migration check against a disposable Postgres — see `docs/MIGRATION_GUIDE.md`)
2. Run the actual test suites for real: `pnpm --filter @ultra/db test`, `pnpm --filter @ultra/api test:unit`, then the integration suite once a real database is reachable
3. Boot both apps (`pnpm dev:web`, `pnpm dev:mobile`) against seeded data and click through the critical path by hand: register → verify phone → (realtor) apply for verification → admin approves → create a listing → admin approves → buyer finds and messages it → realtor replies → lead fee charged
4. Do the same for Phase 2: provider registers → verifies → adds an offering → customer books → provider accepts and completes → commission accrues
5. Confirm the analytics events actually land in the `AnalyticsEvent` table (or PostHog, if configured) during the above
6. Only then: staging environment, legal review, dependency scan, and the supervised-beta sequence in §8

---

## 10. Document Index

Everything below lives in this repository and goes deeper than this file on its specific topic:

| Document | What it covers |
|---|---|
| `Master_Blueprint_Home_Ecosystem.docx` | The permanent product vision, mission, and the full eight-phase homeowner lifecycle |
| `ULTRA_Technical_Spec.pdf` | The original technical decisions and framework reconciliation |
| `EXECUTION_PLAN.md` | Sprint-by-sprint plan with a live progress log — what's done, what's blocked, and why |
| `docs/MVP_REVIEW.md` | A dedicated security/efficiency/regression review with specific file-and-line findings |
| `docs/ZILLOW_ANALYSIS.md` | What Zillow does well, where it's failed, and which ULTRA decisions that validates |
| `docs/DATA_RETENTION.md` | Account deletion behavior and data retention policy, with tradeoffs disclosed |
| `docs/OPERATIONAL_CHECKLISTS.md` | Real, actionable checklists for verification, moderation, fraud, payments, and support |
| `docs/MIGRATION_GUIDE.md` + `scripts/verify-migration.sh` | The exact procedure for proving the database migration works, for real |

---

## A closing note on how to read this project's own confidence

Nearly every "built" claim in this codebase — going back to the very first build session — has been deliberately distinguished from "verified by running." That distinction is not defensive hedging; it's the most useful thing this handoff can hand you. Trust the reasoning, re-run the tests, and treat the first real execution of this system — on your machine, against a real database — as the actual test. Everything before that point, including everything in this document, is careful preparation for that moment, not a substitute for it.
