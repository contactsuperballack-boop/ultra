# ULTRA — Technical Specification
**Required Initial Response, per Development Framework §47**
Status: Draft for review — no further implementation until confirmed (framework §41, Phase 1 rule)

---

## 0. Framework Reconciliation

This spec applies the submitted AI-development framework to ULTRA, cross-checked against two things that already exist and are **not** being re-litigated:

1. **Master Blueprint v2.0** — mission, trust framework, Phase 1 scope (listings marketplace, Abuja-only, off-plan excluded, home services as Phase 2 fast-follow).
2. **The existing scaffold** — Turborepo monorepo, Prisma schema, tRPC API (listings/inquiries/realtors routers), Next.js web app, Expo mobile app. Where a framework requirement is already built, this doc says so instead of re-describing it as new work.

Where the framework's default recommendation conflicts with what's already decided, I've noted the conflict and the resolution rather than silently picking one (framework Rule 8).

---

## A. Product Understanding

ULTRA is a verified property marketplace for Abuja, Nigeria, replacing marketer-dependent, referral-only property discovery with searchable, trust-checked listings. The wedge is **trust**, not inventory — realtors are verified before they can publish, listings are checked against price-band and duplicate signals before going live, and buyer-realtor contact stays in-app. Revenue comes from per-inquiry lead fees and featured placement, not commission-on-close, because deal closure isn't reliably observable by the platform. This is Phase 1 of a longer-term "digital home ecosystem" vision (home services, property management, etc.), but nothing beyond the marketplace is in scope for this build.

## B. User Roles

| Role | Sees | Creates | Edits | Deletes | Manages |
|---|---|---|---|---|---|
| **BUYER** (unauthenticated: browse only; authenticated: full) | Live listings, own inquiries/saved | Inquiries, saved listings | Own profile | Own account | Notification prefs |
| **REALTOR** (requires VERIFIED status to publish) | Own listings + stats, inquiries on own listings | Listings (→ PENDING_REVIEW), replies to inquiries | Own listings, own profile | Own draft/unpublished listings | Own listing status (pause/publish) |
| **ADMIN** | All listings, all realtor applications, flagged content | Verification decisions, moderation actions | Any listing status, any realtor verification status | Any listing (moderation) | Realtor verification queue, flagged-listing queue |
| **SUPER_ADMIN** *(confirmed — split from ADMIN from the start)* | Everything ADMIN sees + system config | Admin accounts | System settings, role assignments | Admin accounts | Platform configuration, price bands |

Every write is re-checked server-side against role + ownership (framework §8) — the tRPC `protectedProcedure` / `verifiedRealtorProcedure` middlewares already implement this pattern; an `adminProcedure` middleware is the one piece not yet built (see §L).

## C. Core Features, Prioritized

**P0 — MVP, blocks launch**
- Phone-OTP registration/login (not yet built)
- Listing search, filter, detail *(built)*
- Realtor KYC application + admin verification queue *(API built, admin UI not built)*
- Listing creation with automatic price-band flagging *(built)*
- Inquiry creation + in-app messaging thread *(API built, mobile/web inbox UI partial)*
- Realtor dashboard: listings table, status management *(built)*
- Admin: verification queue, flagged-listing review *(not built)*

**P1 — needed for a strong initial release, not launch-blocking**
- Saved/favorites *(schema exists, not wired)*
- Push + in-app notifications (new message, verification decision)
- Per-inquiry lead billing via payment provider
- Realtor ratings/reviews *(schema exists, not wired)*
- Basic analytics event tracking

**P2 — post-launch enhancement**
- Featured listing placement / realtor account tiers
- Duplicate-listing detection beyond basic checks
- SMS/email notification channels beyond push
- Map-based search

**P3 — explicitly future phases (Blueprint §13 roadmap)**
- Home services marketplace, "My Home" dashboard, escrow, off-plan reconsideration, Lagos expansion, property manager portal — none of this is designed against in Phase 1; the schema avoids modeling it prematurely.

## D. Key User Journeys

- **Buyer:** Browse (no auth) → view listing → prompted to verify phone → send inquiry → in-app thread with realtor.
- **Realtor onboarding:** Register → phone OTP → submit CAC + ID docs → PENDING_REVIEW → admin approves/rejects → VERIFIED → can publish.
- **Listing publish:** Realtor submits → price-band check (auto) → in-band: PENDING_REVIEW (standard check) → out-of-band: UNDER_REVIEW (admin required) → LIVE.
- **Admin verification:** Queue of PENDING_REVIEW realtors/listings → review documents/flag reason → approve/reject → logged to `VerificationLog` (already modeled).

Edge cases to design against explicitly in build: realtor submits listing while application still PENDING (should block), buyer inquires on a listing that goes UNDER_REVIEW mid-thread (existing thread stays open, new inquiries blocked), OTP delivery failure (see §J).

## E. Technical Architecture

| Layer | Choice | Note |
|---|---|---|
| Web | Next.js (App Router) + TypeScript + Tailwind | Built |
| Mobile | Expo (React Native) + TypeScript | Built |
| API | **tRPC on Next.js route handlers**, domain-organized routers | Diverges from framework's NestJS default — see reconciliation above |
| Webhooks (payments) | Plain REST route handlers, same Next.js app | New — needed because providers call real HTTP, not RPC |
| Database | PostgreSQL + Prisma | Built |
| Cache / rate limiting / OTP codes | Redis (Upstash) | **Not yet added** — needed for OTP flow, not optional |
| File storage | Cloudflare R2, private bucket + signed URLs for KYC docs, public for listing photos | Partially decided — signed-URL requirement is new and important (KYC docs are sensitive; must not be publicly readable) |
| Auth | Phone OTP (Termii) + short-lived JWT access token + hashed refresh token in DB | Not yet built |
| Monitoring | Sentry (errors), structured logs to provider's log drain | Not yet added |
| Analytics | PostHog | Not yet added |

## F. Database Architecture — Additions to Existing Schema

Already modeled: `User`, `RealtorProfile`, `VerificationLog`, `Listing`, `ListingPhoto`, `SavedListing`, `Inquiry`, `Message`, `Review`.

**New, required for P0/P1:**
- `RefreshToken` (userId, tokenHash, expiresAt, revokedAt) — session management without storing raw tokens
- `OtpCode` (phone, codeHash, expiresAt, attempts) — short-lived, rate-limited
- `Notification` (userId, type, payload, readAt, sentAt) — in-app + push log
- `PaymentTransaction` (inquiryId or realtorProfileId, provider, providerRef, amountNaira, status, idempotencyKey) — P1, per framework §18's explicit rule: never mark paid without provider-verified webhook

No soft-delete on `Listing`/`User` initially — hard status transitions (`REMOVED`, account deactivation flag) are sufficient at this scale and avoid every query needing a `deletedAt: null` filter; revisit if compliance requires retained records.

## G. API Architecture (tRPC routers)

Built: `listings.*`, `inquiries.*`, `realtors.*` (see existing `packages/api/src/routers/`).
Needed: `auth.*` (requestOtp, verifyOtp, refresh, logout), `notifications.*` (list, markRead, updatePreferences), `admin.*` (verification queue, moderation actions — requires new `adminProcedure`), `payments.*` (P1).
REST (non-tRPC): `POST /api/webhooks/payments/[provider]` — signature-verified, idempotent.

## H. Screen Map

**ULTRA APP (mobile, buyer-facing only — realtors use web, per Blueprint §11 rationale):** Search, Listing Detail, Saved, Messages (list + thread), Profile, Phone OTP sign-in.
**ULTRA WEB — public:** Search, Listing Detail, Realtor public profile.
**ULTRA WEB — realtor dashboard:** Overview, Listings (table + create/edit), Inquiries inbox, Verification status/application.
**ULTRA WEB — admin:** Verification queue, Flagged-listing queue, User/realtor list, (P2: analytics dashboard).

## I. Third-Party Services

| Purpose | Choice | Note |
|---|---|---|
| OTP SMS | Termii | Best Nigerian carrier delivery; needs a fallback provider — see §J |
| Payments (lead billing) | **Paystack** *(confirmed)* | Flutterwave as fallback if needed later |
| File storage | Cloudflare R2 | Already decided |
| Email (admin/system, not primary channel) | Resend | Low volume — verification decisions, account recovery |
| Push notifications | Expo Push | Native to the Expo stack already chosen |
| Error monitoring | Sentry | Standard choice, generous free tier |
| Analytics | PostHog | Self-hostable later if needed |
| DB/Redis hosting | Neon/Supabase (Postgres) + Upstash (Redis) | Both have usable free tiers for MVP stage |

## J. Risks

- **KYC document exposure** — verification documents must be in a private bucket with signed, short-lived URLs, never a public listing-photo-style bucket. Flagged as a hard requirement, not a nice-to-have.
- **OTP deliverability** — SMS delivery in Nigeria varies by carrier/provider; single-provider dependency is a real risk to registration conversion. Recommend a fallback provider path even at MVP, not added later.
- **Two-sided cold start** (already flagged in the Blueprint) — architecture doesn't solve this; it's a go-to-market risk, not a technical one.
- **Realtor willingness to pay for lead fees** — same open question from the Blueprint; payment integration should be built but the fee model itself should stay easy to adjust (config, not hardcoded).
- **tRPC vs. REST tradeoff** — if a future partner integration needs a stable public API (not just internal web/mobile clients), tRPC alone won't serve that well. Mitigation: the webhook precedent already establishes that REST endpoints can live alongside tRPC where needed; a public API would follow the same pattern rather than requiring a rewrite.

## K. MVP Definition

**MVP = the P0 list in §C, full stop.** Phone OTP auth, search/browse/detail, realtor verification (application + admin approval), listing creation with price-band flagging, inquiries + messaging, realtor dashboard, admin verification/moderation queue. Everything in P1 (payments, notifications, reviews) can follow immediately after without blocking a usable launch where the founding team manually handles what P1 would automate.

## L. Development Plan

1. **Auth & sessions** — Redis, OTP flow, JWT + refresh tokens, `adminProcedure` middleware. *(✅ Built.)*
2. **Admin verification & moderation UI** — the queue screens; API mutations already exist. *(✅ Built — see below.)*
3. **Complete the stubbed mobile screens** (Saved, Messages) — APIs already exist, now unblocked by auth. *(✅ Built.)*
4. **Notifications** — in-app + push, tied to message/verification events. *(✅ Built.)*
5. **Payments** — Paystack lead billing, webhook handler, `PaymentTransaction` model. *(✅ Built.)*
6. **Testing pass** — unit (services), integration (API+DB), E2E (register → verify → list → inquire). *(✅ Built — see below for what was actually executed vs. written-but-unverified.)*
7. **Production hardening** — rate limiting, secrets audit, monitoring wiring, backup strategy. *(✅ Built — see `docs/OPERATIONS.md`.)*
8. **Deployment** — staging environment first, then production; document domain/HTTPS/env setup per framework §34. *(✅ Documented — see `docs/DEPLOYMENT.md`. Nothing actually deployed.)*

---

## Auth Implementation Status

**Built:**
- `OtpCode` / `RefreshToken` models, `SUPER_ADMIN` added to `UserRole`
- `auth.requestOtp` / `auth.verifyOtp` / `auth.refresh` / `auth.logout` / `auth.me`
- SMS provider interface with a `TermiiSmsProvider` (real) and `DevConsoleSmsProvider` (logs code to console) — selected automatically based on whether `TERMII_API_KEY` is set, per framework Rule 10 (never fake a working integration)
- `adminProcedure` / `superAdminProcedure` middlewares; `realtors.adminSetVerificationStatus` now actually enforces admin-only access (previously accepted any signed-in user)
- Web: `/auth/login` page, token storage, Authorization header wired into the tRPC client
- Mobile: `SignInScreen`, `SecureStore`-backed session, Profile tab now branches on real session state instead of a static "needs auth" stub

**Explicitly not built yet (next session, per plan step 3+):**
- No refresh-on-401 interceptor on either client — a signed-in session goes stale after 15 minutes until this is added
- No rate limiting beyond the basic OTP resend cooldown/attempt cap (Redis-backed rate limiting is still on the list)
- Realtor `applyForVerification` has no UI form yet — the mutation exists, nobody can submit an application through the UI

## Admin Queue Implementation Status

**Built:**
- `ListingModerationLog` model — every admin approve/remove decision on a listing is logged (actor, from/to status, note), matching the existing `VerificationLog` pattern for realtor decisions. Extends the schema slightly beyond the original P0 list because §22/§46 of the framework both call out audit logging as a hard requirement, not optional polish.
- `realtors.pendingApplications` (admin query) + `/admin/verification` page — approve/reject with an optional note, oldest-first queue
- `listings.flagged` (admin query, covers both `PENDING_REVIEW` and `UNDER_REVIEW`) + `listings.adminSetStatus` (mutation, logged) + `/admin/listings` page — approve-to-LIVE or remove
- `/admin` layout with nav between the two queues

**Explicitly not built yet:**
- No role-based route guard/redirect on `/admin/*` — pages call the admin-only API and show a "requires admin session" message on `FORBIDDEN`, but a non-admin isn't prevented from *navigating* to the page, only from seeing real data. A proper server-side or middleware-based guard is still needed before this is production-safe.
- No pagination on either queue — fine at seed-data volume, will need it before real usage.

## Mobile Saved/Messages Implementation Status

**Built:**
- `savedListings.list` / `.ids` / `.toggle` (new router) — `.ids` exists specifically so Search/Detail screens can render filled hearts without pulling full listing objects twice
- `SavedStack` (list → detail, reusing `ListingDetailScreen`) replaces the old flat `SavedScreen` stub
- `MessagesStack` (thread list → thread) replaces the old flat stub — both wired to the `inquiries` router that already existed
- Heart/save toggle added to both `SearchScreen` cards and `ListingDetailScreen` — neither had one even in the earlier "real" pass, this closes that gap
- `ListingDetailScreen` now types its route generically (`{ ListingDetail: { id: string } }`) instead of against one specific stack's param list, since it's legitimately pushed from two different stacks now (Search and Saved) — a shared `navigation/types.ts` holds this

**Explicitly not built yet:**
- `ThreadScreen` re-queries `inquiries.myThreads` and finds its thread client-side rather than having a dedicated `inquiries.byId` — reasonable at low thread counts, worth a dedicated endpoint if a user's thread list grows large
- No optimistic UI on save-toggle or send-message — both wait for the round trip before updating, which will feel slow on a poor connection
- Toggling save while signed out fails silently (mutation errors, UI doesn't change) rather than prompting sign-in — small UX gap, not a correctness one

## Open Decisions Needing Confirmation

*(Resolved — see §I and §B above.)*

## Notifications Implementation Status

**Built:**
- `Notification` model, `NotificationType` enum (`NEW_MESSAGE`, `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`), `pushToken` field on `User`
- `notify()` helper (`packages/api/src/lib/notify.ts`) — single entry point that writes the durable in-app row first, then best-effort pushes; every trigger site uses this instead of duplicating the logic
- Trigger sites: new inquiry, existing-thread reply (both branches of `inquiries.create`), `inquiries.reply`, and `realtors.adminSetVerificationStatus` (VERIFIED/REJECTED only — SUSPENDED intentionally not notified, since that's usually a for-cause action where a delayed or absent notification isn't a bug)
- `ExpoPushProvider` — real implementation, no unnecessary secret gate (Expo Push doesn't require server credentials for basic sends, unlike Termii/Paystack)
- `notifications` router: `list`, `unreadCount`, `markRead`, `markAllRead`, `registerPushToken`
- Real in-app surfaces on **both** platforms, not just a backend table nobody sees: mobile `NotificationsScreen` (pushed from a new `ProfileStack`, with an unread badge on the Profile tab entry point) and a web `/notifications` page
- Mobile push registration wired into `SignInScreen` — requests permission and registers the token immediately after successful OTP verify

**Explicitly not built yet:**
- No tab-bar badge (unread count only shows once inside the Profile tab, not as a badge on the tab icon itself)
- Shared-device edge case: Expo push tokens are per-device, not per-user-session — if two different users sign in sequentially on the same physical phone, a push intended for the first user could still arrive on that device after the second user signs in. Acceptable at MVP scale, worth a real fix (deregister token on sign-out) before that becomes a real complaint.

## Payments Implementation Status

**Built:**
- `PaymentTransaction` model, `creditBalanceNaira` on `RealtorProfile`, `PaymentTransactionType`/`PaymentStatus` enums
- **Design decision, not previously specified:** rather than charging a realtor's card in real time on every inquiry (fragile — depends on a saved card authorization existing), realtors prepay into a balance via Paystack; each new inquiry deducts a fixed `LEAD_FEE_NAIRA` (currently `500`, a placeholder figure, not a confirmed price) from that balance server-side
- `packages/api/src/lib/paystack.ts` — `initializeTransaction`, `verifyTransaction`, `verifyWebhookSignature`. **No dev-mock fallback here, unlike OTP** — every method throws clearly without `PAYSTACK_SECRET_KEY` rather than faking a successful payment. This is deliberate, not an oversight: a fake-success path in payments code is a real hazard, an unsent SMS during dev is not.
- `payments` router: `balance`, `myTransactions`, `initiateTopUp` — the mutation only ever creates a `PENDING` transaction and returns a checkout URL; it never marks anything paid
- `/api/webhooks/paystack` — the **only** code path that sets a transaction to `SUCCESS` and credits a balance. Verifies the HMAC-SHA512 signature before trusting the payload, and is idempotent (checks `status === "SUCCESS"` before crediting, so a retried webhook can't double-credit)
- Lead-fee deduction wired into `inquiries.create`'s new-inquiry branch, inside a single Prisma `$transaction` alongside the inquiry/message creation itself

**Explicit product-policy assumption made, not confirmed with you:** if a realtor's balance is insufficient when a new inquiry comes in, the buyer's message still goes through — it is not blocked. The shortfall is recorded as a `FAILED` `PaymentTransaction` (visible in `myTransactions`) rather than silently absorbed or silently blocking the buyer. I made this call because blocking a buyer from reaching a realtor over the realtor's billing state seemed like the wrong failure mode for a marketplace, but it's a real business decision, not an engineering detail — worth explicitly confirming or overriding.

**Explicitly not built yet:**
- No top-up UI on either platform — `payments.initiateTopUp` and `payments.balance` exist and work, nothing calls them from a screen yet
- No refund flow (`REFUND` exists in the enum, no mutation implements it)
- `charge.failed` webhook handling exists but is untested against a real Paystack payload shape — worth verifying against their actual webhook docs once you're testing with real keys

## Testing Implementation Status

Honest distinction, per the standing instruction to always review code: some of this was **actually executed and verified passing** in the sandboxed environment this was built in (zero network access, no database, no browser); the rest was **written carefully but could not be run there** and needs verification against a real environment as its first real check.

**Actually executed, real pass/fail output (17/20 possible tests ran; 3 need a dependency this sandbox couldn't install):**
- `packages/db/tests/unit/priceBand.test.ts` — 8/8 passed. **This test caught a real bug during development**: the seed script's hand-written `flagReason` for the Guzape listing claimed the price was "40% above typical range," but the actual math (₦65M ÷ 1200m² ≈ ₦54,167/m²) is *below* the area's floor, not above its ceiling. Fixed by having the seed call the real `checkPriceBand` function instead of hand-writing a narrative that could drift from the logic — and moved `checkPriceBand` from `packages/api` into `packages/db` in the process, since the original location would have created a circular package dependency (`api` already depends on `db`; seed.ts reaching forward into `api` would have made `db` depend on `api` too).
- `packages/api/tests/unit/otp.test.ts` — 7/7 passed.
- `packages/api/tests/unit/paystack.test.ts` — 5/5 passed, including the actual attack `verifyWebhookSignature` exists to prevent: a tampered payload (e.g. modified amount) correctly fails signature verification.
- `packages/api/tests/unit/tokens.test.ts` — **written, not executed** — requires the `jsonwebtoken` package, which isn't installed in this sandbox (no network access to fetch it). Structurally reviewed by hand instead; should be the first thing run once dependencies are actually installed.

**Written, structurally reviewed, but require infrastructure this sandbox doesn't have (a real Postgres connection, a running dev server, a browser) — none of these have executed even once:**
- `packages/api/tests/integration/*.test.ts` (Vitest) — auth flow (OTP → verify → refresh rotation → protected-route rejection), listings price-band flagging + admin queue ordering, inquiries lead-fee billing (both sufficient- and insufficient-balance paths) + notification side effects, and realtor verification decisions (approve/reject, admin-only enforcement, audit log correctness). Every `caller.X.Y()` call in these files was cross-checked by hand against the actual router definitions — see the review process — but "the call exists" is not the same guarantee as "the test passes."
- `apps/web/tests/e2e/critical-path.spec.ts` (Playwright) — full register → browse → inquire journey, plus a check that public browsing doesn't accidentally require auth. Every selector (`getByPlaceholder`, `getByRole` button names) was checked against the actual page markup, not assumed.
- `docker-compose.yml` (Postgres + separate test Postgres + Redis) and `.github/workflows/ci.yml` (install → lint → typecheck → unit → integration → build, matching framework §33) exist to make the above actually runnable, including in CI — neither has been executed here either.

**The honest takeaway:** the unit test layer is real and verified. The integration and E2E layers are well-structured and internally consistent with the actual codebase, but "written by an AI that checked its own work carefully" is not the same claim as "passing." Their first real run, whenever you do it, is the actual test — not this summary.

## Production Hardening & Deployment Status (Steps 7 & 8)

Full detail in `docs/OPERATIONS.md` and `docs/DEPLOYMENT.md` — summary here.

**Built and reviewed:**
- Redis-backed rate limiting (`lib/rateLimit.ts`) on OTP request/verify (phone + IP scoped) and — the one that actually matters most — new inquiry creation (per-buyer, since each one costs a real realtor real money via the lead fee)
- **A real vulnerability found and fixed during the secrets audit**, not a hypothetical one: `getSmsProvider()` used to silently fall back to logging real OTP codes to server logs if `TERMII_API_KEY` was ever unset — including in a misconfigured production deploy. Now throws instead, gated specifically to `NODE_ENV === "production"`. Covered by 3 new, executed unit tests.
- Sentry wired on both platforms (`reportError()` / `initSentry()`), genuinely inert without a DSN configured — consistent with how every other external integration in this codebase handles being unconfigured (Termii, Paystack)
- Mobile converted from static `app.json` to dynamic `app.config.js` + `eas.json` with three build profiles (development/preview/production), each with distinct bundle IDs and API URLs — this was necessary, not cosmetic: a static config can't read per-environment values at all, so every build would have silently pointed at the same backend regardless of profile
- `docker-compose.yml` extended understanding, `.github/workflows/ci.yml` updated with a Redis service, since rate limiting now makes Redis a hard runtime dependency (the app throws at startup without `REDIS_URL`, not just a soft warning)

**One test-isolation bug caught and fixed before it would have caused a false failure:** `tests/integration/auth.test.ts` reuses the same phone number across several test cases in one file. Redis state isn't wiped by `resetDatabase()`'s Postgres truncation, so the new phone-scoped rate limit (5/hour) would have accumulated across that file's tests and broken a later, unrelated test for the wrong reason. Fixed by adding a Redis reset (scoped only to `ratelimit:*` keys, not a blind flush) to the shared integration test setup. Caught by reading through the existing test suite against the new rate-limiting change before calling it done — not by running it, since running it isn't possible here.

**Explicitly not built:**
- No rate limiting yet on general search traffic — `listings.create` now has one (see below), search doesn't.
- Sentry alert rules, dashboard configuration, and mobile/web store accounts are all manual steps that live outside this codebase entirely — documented in `DEPLOYMENT.md`'s checklist, not something code can set up.

## Post-Audit Remediation Status (this session)

Following the audit's finding that realtors had no usable web UI at all, this session built:

**Built:**
- **Cloudflare R2 file upload — the audit flagged this as entirely missing; it's now real.** `lib/storage.ts` generates presigned PUT URLs (client uploads directly to R2, file bytes never touch the API server), with server-enforced type/size limits — no dev-mock fallback, same philosophy as Paystack: a fake "upload succeeded" is worse than a loud failure.
- **Decision 2 implemented exactly as specified:** `RoomType` enum on `ListingPhoto` (living room/kitchen/bedroom/bathroom/exterior/other), `videoUrl` on `Listing` restricted to SALE/RENT — enforced both in the Zod schema (`.refine()`) and again in the mutation body, so a hand-built request can't smuggle a video onto a LAND listing.
- **The 3 realtor screens the audit called the launch blocker:** `/dashboard/listings/new` (full creation form with photo/video upload, room tagging, type-conditional fields), `/dashboard/verification` (application form, branches correctly on VERIFIED/PENDING_REVIEW/REJECTED status), `/dashboard/inquiries` (two-pane inbox with reply).
- **The web buyer thread view the audit also flagged:** `/messages` — buyers can now actually see replies on web, not just mobile.
- **Decision 1 — subscription system, additive to (not replacing) lead fees:** `SubscriptionTier` enum, `subscriptionExpiresAt` on `RealtorProfile`, `realtors.initiateSubscription`/`subscriptionStatus`, a `/dashboard/subscription` page, and — the part that actually matters — `listings.search` now boosts Premium realtors' listings, checking `subscriptionExpiresAt` against the current time rather than trusting the tier field alone (an expired subscription silently stops boosting, no cron job needed to "turn it off").
- **Rate limit added to `listings.create`** — the audit's own security finding, closed in the same pass rather than deferred again.
- **A public site header/nav and footer with the support channel (Decision 4)** — the audit noted there was no navigation at all connecting the buyer-facing pages to each other; fixed via a Next.js route group so the new header doesn't double up on top of `/dashboard` and `/admin`, which already have their own nav.

**One real bug caught while writing this, not after:** the ID-document upload in the verification form needed to accept PDFs (realistic for scanned IDs), but `lib/storage.ts`'s validation only allowed image types for anything other than video uploads — a real user uploading a PDF would have hit a confusing rejection. Fixed by adding a distinct `verification-doc` type category before the form shipped, not discovered by a user later.

**A second bug caught the same way, in the realtor inbox:** the message-bubble alignment logic initially compared a message's `senderId` against the buyer's *name* instead of their *id* — would have rendered every message on the wrong side of the conversation. Caught on review before use, not after.

**Incident during this session, disclosed in full:** the sandbox environment's filesystem was reset partway through this work, losing the entire working repository. Caught immediately by checking command output rather than assuming success, recovered from the last packaged tarball (end of Step 8), and this session's changes were redone from there. Nothing from Steps 1–8 was lost; only redone work from earlier in this same session was affected, and it was redone identically since the content was still fresh. Flagging this because it happened, not because it changed the outcome.

**Explicitly not built yet (as of that session):**
- Payment top-up UI for the lead-fee balance (separate from the new subscription purchase flow, which IS built) — `payments.initiateTopUp`/`balance` still have no screen calling them.
- Reviews/ratings — confirmed by you as post-launch; still zero code.
- Refresh-on-401, admin route guards — both still open from the audit, not addressed this pass; the realtor-UI gap was the higher priority and took the full session.
- Dependency vulnerability scan — still not run, still requires network access this environment doesn't have.

## Remaining Technical Debt Closed (this session)

**Built:**
- **`/dashboard/billing`** — the payment top-up UI that was still missing. Shows current lead-fee balance, a Paystack top-up form, and full transaction history across all `PaymentTransactionType`s (top-up, lead fee, subscription, refund).
- **Refresh-on-401, both platforms.** Implemented as *proactive* refresh rather than reactive retry-after-401 — the client decodes the JWT's `exp` claim client-side (no signature verification needed for this; the server always re-verifies independently on every real request) and refreshes ahead of a ~60-second buffer before it expires, rather than waiting for a request to fail first. This was a deliberate choice over parsing tRPC's batched HTTP error responses, which is fragile since a single batched request can contain a mix of successful and failed procedure calls. Concurrent requests share one in-flight refresh via a single promise, since the refresh-token rotation in `auth.ts` revokes the previous token on each call — two simultaneous refreshes would race and one would fail.
- **Admin route guard** (`AdminGuard` component, wraps `/admin/*`). Checks `auth.me`'s role client-side and redirects non-admins to `/auth/login` instead of rendering the page and letting the API call fail. This is explicitly a UX improvement, not the security boundary — `adminProcedure`'s server-side check remains the actual enforcement and was never the gap.

**One assumption corrected before it became a real bug:** the mobile refresh helper's first draft decoded the JWT payload using Node's `Buffer` global, which isn't guaranteed present in React Native/Hermes without an explicit polyfill this project doesn't have. Replaced with a small dependency-free base64url decoder before shipping, rather than assuming `Buffer` would work.

**Still open:**
- Reviews/ratings (confirmed post-launch, not touched)
- Dependency vulnerability scan (still blocked on network access)
- General search-traffic rate limiting (only `listings.create` and the auth/inquiry endpoints are limited)
- No tests were added for the refresh-token concurrency logic or the admin guard — both are the kind of timing-sensitive code that's easy to get subtly wrong and hard to verify by reading alone; worth an integration test pass specifically on session refresh before relying on it heavily.

## Audit Findings Closed + Legal Pages Added (this session)

**Root-cause bug found and fixed while implementing the route-guard recommendation, not a pre-existing known issue:** `User.role` was never being promoted from the `BUYER` default anywhere in the codebase — not by `applyForVerification`, not by admin approval. Backend authorization was never actually broken by this (`verifiedRealtorProcedure` correctly checks `RealtorProfile.verificationStatus`, not `role`), but it meant `role` was silently meaningless for every realtor who signed up normally rather than being hand-seeded, and it would have broken the very fix being implemented — role-restricting `/dashboard` to `REALTOR` would have locked out every real realtor, since their role field never actually changes. Fixed at the root: `adminSetVerificationStatus` now promotes `role` to `REALTOR` on approval (only upgrades, never auto-downgrades on rejection/suspension, since a suspended realtor may have legitimate prior buyer activity worth preserving). A new integration test (`realtors.test.ts`) specifically exercises this — deliberately *not* pre-seeding the role on its fixture, unlike every other test in that file, since a pre-seeded fixture would never have caught the original bug.

**Both open findings from the last audit closed:**
- `RouteGuard` (generalizes and replaces the admin-only `AdminGuard`) now protects both `/admin` (role-restricted to ADMIN/SUPER_ADMIN) and `/dashboard` (any signed-in user — deliberately *not* role-restricted, since `/dashboard/verification` is exactly the page a non-realtor visits to become one).
- `createAppQueryClient()` (one shared factory, duplicated identically on both platforms since they're separate packages) sets a custom retry function that skips `UNAUTHORIZED`/`FORBIDDEN` errors instead of TanStack Query's default 3x-retry-with-backoff — closes the "every auth error takes several seconds to show" finding across all 12 previously-affected screens at once, from one change per platform.

**Privacy Policy and Terms of Service pages built** (`/privacy`, `/terms`), linked from the footer. Both are explicitly marked as drafts requiring qualified legal review before publication — per the standing instruction to flag legal-adjacent content rather than present it as advice. Content is grounded in what ULTRA actually does (phone-based identity, in-app messaging to protect the lead-fee model, Paystack for payments, no card data stored, IP addresses used only ephemerally for rate limiting and never persisted) rather than generic boilerplate — but the liability and dispute sections in particular are flagged inline as needing real legal drafting, not just a review pass.

**Explicitly still not done:**
- Dependency vulnerability scan — flagged in three consecutive sessions now (original audit, follow-up audit, this one). Genuinely cannot be run in this environment; needs to happen in yours before beta.
- No admin account self-service provisioning exists — ADMIN/SUPER_ADMIN roles can currently only be set via direct database/seed access, same as before this session. Not in scope for this pass, worth knowing before you need to add a second admin.

## P1/P2 Punch List Closed (this session)

Everything on this list had already-fixed items mixed in with genuinely open ones (findings 1 & 2, refresh-on-401, Redis rate limiting, `applyForVerification` UI, and web top-up UI were all already done before this session started — verified by checking the code before doing anything, not assumed). What was genuinely built this session:

**Built:**
- **Pagination on both admin queues** (`realtors.pendingApplications`, `listings.flagged`) — cursor-based, same pattern as `listings.search`. Both admin pages now use `useInfiniteQuery` with a "Load more" button.
- **`inquiries.byId`** — a dedicated single-thread fetch with a real ownership check (caller must be the buyer or the owning realtor), replacing mobile's `ThreadScreen` re-querying and filtering the entire `myThreads` list.
- **Optimistic UI** for save/unsave (shared `useSaveToggle` hook, mobile) and send-message (mobile `ThreadScreen`, web realtor inquiries, web buyer messages) — all three message-sending surfaces update immediately and roll back on failure, rather than waiting on the round trip.
- **Signed-out save-toggle no longer fails silently** — rolls back the optimistic change and prompts sign-in specifically on an `UNAUTHORIZED` response.
- **Tab-bar unread badge** on mobile's Profile tab, sourced from `notifications.unreadCount`.
- **Push token deregistration on sign-out** (`notifications.deregisterPushToken`) — closes the shared-device edge case where a push meant for one user could arrive after a different user signs in on the same phone.
- **Refund mutation** (`payments.adminIssueRefund`) — records a `REFUND` transaction and decrements the realtor's balance, capped at their current balance rather than going negative. **No admin UI calls this yet** — the mutation is real and reviewed, but flagged honestly as backend-only for now rather than silently left half-done.
- **General rate limiting on `listings.search`/`listings.byId`** (IP-scoped, generous limits tuned for normal browsing vs. scraping).

**Two real bugs caught by review before they shipped, not after:**
1. Changing `pendingApplications`/`listings.flagged` to return `{items, nextCursor}` instead of a flat array broke both existing admin pages, which still expected an array — caught by grepping for every caller of the changed endpoints before considering the change done, not assumed safe.
2. That same check surfaced a **pre-existing, unrelated bug**: three integration test files (`realtors.test.ts`, `listings.test.ts`, `inquiries.test.ts`) still used a `photoUrls: string[]` field that was renamed to `photos: {url, roomType}[]` several sessions ago when the media/video schema was built — meaning those tests would have failed the moment they were actually run, independent of anything done this session. Fixed all 7 occurrences across the three files.

**Explicitly not built:**
- Admin UI for issuing a refund — the mutation exists and is reviewed; no screen calls it.
- Dependency scan — still blocked on network access, still genuinely your task before beta.
