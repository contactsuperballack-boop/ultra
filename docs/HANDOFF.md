# ULTRA — Handoff

**For:** whoever picks this up next (including a future you, after a break)
**As of:** end of this build session · 89 TS/TSX files · 23/23 executable unit tests passing
**Read this first, then `docs/TECHNICAL_SPEC.md` for implementation detail, `docs/AUDIT_REPORT.md` for the last full readiness assessment.**

---

## 1. What This Is

ULTRA is a verified property marketplace for Abuja, Nigeria — realtors list completed buildings, plots, and rentals; buyers browse and message realtors directly; every realtor and listing goes through a trust/verification pipeline before going live. It's Phase 1 of a longer-term "digital home ecosystem" vision (home services, property management, etc. — all correctly out of scope for now). Full product reasoning lives in `Master_Blueprint_Home_Ecosystem.docx`.

**Stack:** Turborepo monorepo — Next.js web app + Expo mobile app, sharing one tRPC API and one Prisma/Postgres schema. Redis for rate limiting, Cloudflare R2 for file storage, Paystack for payments, Termii for SMS OTP, Sentry for monitoring.

## 2. Current State — What Actually Works

Every P0 core feature is built and verified present by direct code inspection (not assumed from memory) as of the last two audit passes:

- **Auth** — phone OTP, JWT + rotating refresh tokens, proactive refresh-on-401 on both platforms.
- **Buyer journey, both platforms** — search/filter, listing detail, save, inquire, message thread with optimistic sending, in-app + push notifications.
- **Realtor journey, web** — apply for verification, create a listing (photos + room tagging + video for completed buildings, images-only for land), view/reply to inquiries, manage billing (top-up) and subscription.
- **Admin** — realtor verification queue, flagged-listing moderation queue, both paginated, both with full audit logging (`VerificationLog`, `ListingModerationLog`).
- **Trust pipeline** — automatic price-band flagging on listing creation (genuinely computed, caught a real bug in its own seed data during testing).
- **Monetization, both mechanisms live simultaneously** — per-inquiry lead fees (realtor-paid, never buyer-paid) and realtor Premium subscriptions (boosts search ranking, checked against live expiry).
- **Legal-adjacent pages** — Privacy Policy and Terms of Service exist, both explicitly marked as drafts pending qualified legal review.
- **Support channel** — email + WhatsApp in the site footer.

**Test coverage:** 23 unit tests actually executed and passing (price-band logic, OTP generation/hardening, Paystack webhook signature verification). Integration and E2E suites are written and structurally reviewed but have never executed — no database or browser exists in the environment this was built in.

## 3. Key Decisions Made (and why)

| Decision | Chosen | Reasoning |
|---|---|---|
| API architecture | tRPC on Next.js route handlers, not a separate NestJS service | Shared, compile-time-checked types across web/mobile with far less infrastructure than a standalone API service — matters at this team size. REST kept alongside for the one thing that needs it: Paystack webhooks. |
| Phase 1 scope | Listings marketplace, not home services | Founder's direct observation of marketer-dependency in Abuja outweighed the general pattern that services are technically easier to bootstrap. Full comparison in the Blueprint §7. |
| Off-plan listings | Excluded | Developer-default risk + land-title risk are too costly for a platform whose whole value proposition is trust. Reconsider later, not now. |
| Monetization | Lead fees (Option A: never block a buyer over a realtor's balance) **+** realtor subscriptions, live at the same time | You left this genuinely open; built both rather than guessing which one wins, so you can sunset one later once you see real realtor response. |
| Media rules | Plots = images only; completed buildings = images (room-taggable) + one video; both size/type-capped server-side | Your explicit spec, enforced twice (Zod schema + mutation body) so a hand-built request can't bypass the UI. |
| Reviews/ratings | Deferred, post-launch | Your call. Schema exists; zero API/UI, correctly. |
| Support channel | Email + WhatsApp, no ticketing system | Matches "don't over-engineer an early MVP" — your instruction, followed literally. |
| Insufficient lead-fee balance | Buyer's message still goes through; shortfall logged as a failed transaction | Blocking a buyer over a realtor's billing state seemed like the wrong failure mode for a marketplace. Confirmed by you as Option A. |

## 4. Active Constraints (true right now, not hypothetical)

- **Nothing in this codebase has run outside of 23 unit tests.** Not the web app, not the mobile app, not a single integration test, not against a real database. Every other claim of correctness in this project comes from careful code review and cross-referencing — a real and different thing from "it works," and worth remembering every time a doc says something is "built."
- **This build environment has no network access.** Cannot run `pnpm install`, cannot run a dependency vulnerability scan, cannot hit a real Paystack/Termii/R2 endpoint. Everything requiring those has been reviewed by hand instead.
- **One filesystem-wipe incident occurred mid-session** (documented in `TECHNICAL_SPEC.md`). Recovered fully from a saved tarball; disclosed at the time it happened, not after.
- **Admin accounts can only be provisioned via direct database/seed access** — no self-service promotion flow exists.

## 5. Open Tasks

**Genuinely yours, not further engineering:**
- [ ] Run a real dependency vulnerability scan (`pnpm audit` or equivalent) — flagged in three consecutive sessions, still not run, needs a real network connection this environment doesn't have.
- [ ] Qualified legal review of `/privacy` and `/terms` before publishing either.
- [ ] Actually run this — `pnpm install`, `docker compose up`, `pnpm db:migrate && pnpm db:seed`, then the app itself, in Claude Code or your own terminal. This is the single highest-value next step; everything else in this document is secondary to it.

**Small, well-scoped engineering work:**
- [ ] Admin UI for the refund mutation (`payments.adminIssueRefund` exists and is reviewed; no screen calls it).
- [ ] Integration test coverage for the refresh-token concurrency logic specifically (timing-sensitive code, easy to get subtly wrong, currently unverified by execution).

**Deferred by explicit decision, not oversight:**
- Reviews/ratings (post-launch, your call)
- A second SMS provider (Termii is currently a single point of failure — acceptable at MVP volume, not indefinitely)

## 6. Recommendations

1. **Get it running before building anything else.** Every recommendation below assumes the app actually boots. If it doesn't, that's the only finding that matters.
2. **Beta with a small, hand-picked realtor cohort first**, matching the Blueprint's own guidance to hand-review the first 20–50 realtor applications directly rather than trusting an automated pipeline that doesn't have data yet.
3. **Watch the price-band flags closely in the first weeks** — the bands are deliberately rough starting values (see `packages/db/src/priceBand.ts`), meant to be tightened from real listing data, not treated as finished.
4. **Decide the lead-fee vs. subscription question with real data**, not more speculation — both are live; watch which one realtors actually respond to before building anything to phase either out.
5. **Confirm `NODE_ENV` is set correctly in every environment** — several safety behaviors depend on it being accurate (the OTP provider refuses to fall back to console-logging codes in `production`; the `_testOnlyCode` field only ever appears when `NODE_ENV === "test"`).

## 7. Optimization Add-Ons (beyond bug fixes — genuine value-add for later)

Not blockers, not requested yet — things worth knowing exist as options once the core is validated:

- **Analytics event tracking** — nothing currently tracks user_registered, listing_viewed, inquiry_sent, etc. You will want this well before you need it; retrofitting analytics after real usage exists loses the early data forever.
- **Search relevance beyond Premium boosting** — currently sorts by recency + subscription tier only. Once there's real listing volume, consider weighting by response time, verification tenure, or view-to-inquiry conversion.
- **Image optimization/CDN transforms** — R2 currently serves raw uploaded files. Cloudflare Images or a resize-on-request layer would cut bandwidth and load time meaningfully once there's real photo volume.
- **Background job infrastructure** — currently everything runs synchronously in the request/response cycle (price-band checks, notification sends). Fine at current scale; a proper job queue (e.g., BullMQ against the existing Redis) becomes worth it once volume grows, especially for anything touching Paystack or Termii, which can be slow or flaky.
- **Database indexes beyond the current set** — `Listing` and a few other models have basic indexes; revisit with `EXPLAIN ANALYZE` against real query patterns once there's real data volume, not before.
- **A real API-level caching layer** (e.g., short-TTL cache on `listings.search`) once read traffic actually justifies it — premature right now.
- **Multi-device push token support** — currently one token per user; a real fix (a join table instead of a single column) is worth doing before this becomes a support complaint, not before.

---

*This document reflects the state of the code as of this session, verified by direct inspection at time of writing — not a summary of what was claimed along the way. If something here turns out to be wrong once you actually run it, that discrepancy is itself the most useful thing you can report back.*
