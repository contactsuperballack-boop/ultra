# ULTRA — Pre-Launch Product Audit (Follow-Up)

**Audit date:** Current session, re-audit following realtor-UI remediation and technical-debt closure · **Scope:** full re-inspection, not a memory-based recap of the previous audit · **No code changed during this audit.**

---

## 1. Executive Summary

Every launch-blocking gap from the first audit is now closed and verified present in the codebase, not just claimed. Realtors can create listings (with the room-tagged photo and video rules from Decision 2), apply for verification, and read/reply to inquiries — all through real screens calling real, cross-checked API endpoints. Web buyers can now see replies to their messages. Both new monetization mechanisms from Decision 1 (lead fees and realtor subscriptions) are live simultaneously, with subscriptions genuinely affecting search ranking. Payment top-up, refresh-on-401, and an admin route guard were added in the most recent pass, on top of that.

This re-audit found no regressions — the 23 previously-passing unit tests still pass unchanged. But it did find two new, real issues introduced by this session's own work, not carried over from before: an inconsistency in how the new route-guard pattern was applied, and a systemic React Query configuration gap that adds unnecessary delay to every authentication error across both platforms. Neither is launch-blocking on its own, but both are the kind of thing worth fixing before, not after, real users hit them.

**Status has moved from 🔴 NOT READY to 🟡 NEEDS WORK BEFORE BETA** — a real, verified improvement, not just forward motion.

## 2. What We Have Built (Since Last Audit)

Three realtor screens (`/dashboard/listings/new`, `/dashboard/verification`, `/dashboard/inquiries`), a web buyer thread view (`/messages`), Cloudflare R2 file upload with server-enforced type/size limits, room-tagged photos and video support (video restricted to completed buildings, enforced twice — schema validation and mutation logic), a realtor subscription system that boosts search ranking, a payment top-up page, proactive refresh-on-401 on both platforms, an admin route guard, and public site navigation that didn't exist before (buyers previously had no way to reach `/messages` or `/notifications` from anywhere in the UI).

## 3. What Works

Re-verified by direct inspection this session, not carried forward as an assumption:

- **All three realtor screens exist and call real procedures** — confirmed by grepping every `trpc.X.Y` call in the new pages against the actual registered routers, not just checking the files exist.
- **The web buyer thread view exists and is reachable** — `/messages` is real, and the new `SiteHeader` links to it for signed-in users.
- **Media rules match Decision 2 exactly**: `LAND` listings cannot carry a `videoUrl` (enforced in both the Zod schema and the mutation body — a hand-built request can't bypass the UI to smuggle one through), photos support room tagging, everything is size/type capped server-side via presigned R2 URLs.
- **Subscription ranking is real, not cosmetic** — `listings.search` checks `subscriptionExpiresAt` against the current time before boosting, so a lapsed subscription silently stops boosting without needing a background job.
- **23/23 previously-passing unit tests still pass**, re-executed this session, confirming no regression from the media/subscription/billing changes.
- **No secrets, no TODO/FIXME markers, nothing hardcoded** — re-checked directly, not assumed unchanged.

## 4. What Does Not Work

Nothing from the original "does not work" list remains broken. This section is genuinely short now, which is itself worth noting plainly rather than padding out.

## 5. What Is Incomplete — New Findings This Session

**Finding 1 — Route-guard pattern applied inconsistently.** `AdminGuard` was built and correctly wraps `/admin/*`, redirecting non-admins instead of showing an inline error. The same reasoning applies equally to `/dashboard/*` (realtor routes) — an unauthenticated user can currently fill out the entire listing-creation form, including uploading photos, before discovering at submit time that they were never signed in. `/dashboard/layout.tsx` has no guard at all; it's a static nav wrapper. This is a real gap in this session's own work, not a leftover from before — the fix was built once and not extended to the second place it obviously applied.

**Finding 2 — Every auth-gated query on both platforms silently retries 3 times before showing an error.** `new QueryClient()` on both web and mobile uses TanStack Query's default retry behavior — 3 attempts with exponential backoff — for *any* failed query, including `UNAUTHORIZED`/`FORBIDDEN` errors that will never succeed on retry. Confirmed by checking the actual `QueryClient` construction (no custom `retry` function) and finding 12 total screens/pages across both platforms (7 web, 5 mobile) that query protected or verified-realtor procedures without a page-level override. The practical effect: every "sign in required" or "verified realtor account required" message a user sees is delayed by several seconds while React Query silently retries a request that was never going to succeed. This wasn't caught in the original audit because the affected pages mostly didn't exist yet when that audit was written — it's a consequence of this session's own build-out, surfacing now because there's finally enough surface area for the pattern to matter.

## 6. What Is Unnecessary

Still nothing to remove. The build has stayed disciplined — no speculative features, no unused abstractions.

## 7. What Is Missing

Unchanged from the last audit's remaining list, re-confirmed present-tense by direct inspection rather than assumed:

1. **Reviews/ratings** — confirmed by you as post-launch. Zero code, as expected. Not a gap; a deliberate decision holding.
2. **Dependency vulnerability scan** — still not run. Still blocked on this environment having no network access to run `pnpm audit`. This has now gone unverified across two full audit passes — worth actually running yourself before beta, not deferring a third time.
3. **General search-traffic rate limiting** — only `listings.create` and the auth/inquiry endpoints are limited. `listings.search` and `listings.byId` remain unlimited.
4. **Web search filters** (price range, bedroom count) — mobile lost these in an earlier rebuild and never regained them; web never had them. Both platforms currently filter only by type and (on web) a verified-only toggle.

## 8. Security Risks

| Risk | Severity | Status |
|---|---|---|
| Auth-gated queries retry 3x before failing (Finding 2) | Low | New this session — not a security hole, but worth fixing as a UX/efficiency issue before it compounds at real traffic volume |
| `/dashboard/*` has no client-side route guard (Finding 1) | Low | Server-side enforcement (`verifiedRealtorProcedure`) is correct and was never the actual gap — this is UX-only, same category as the admin guard fix, just not yet extended here |
| Dependency vulnerabilities | Unknown | Still genuinely unverified — not "probably fine," actually unchecked |
| Everything from the previous audit's security section | — | All previously fixed items re-confirmed still fixed (OTP production fallback, webhook signature verification, no hardcoded secrets) |

## 9. Technical Debt

| Issue | Severity | Effort | Timing |
|---|---|---|---|
| Extend route guard to `/dashboard/*` | Low | Small — reuse the `AdminGuard` pattern, generalize it to accept an allowed-role list | Before beta |
| Configure `QueryClient` default retry to skip `UNAUTHORIZED`/`FORBIDDEN` | Low | Small — one config change in both `providers.tsx` and mobile's `App.tsx`, fixes all 12 affected screens at once | Before beta |
| Dependency audit | Unknown severity until run | Small (just needs to actually happen) | Before beta |
| General rate limiting on search | Low | Small | Post-beta is acceptable |
| Web/mobile search filter parity | Low | Small | Post-launch is fine |

## 10. UX Problems

- The two new findings above are both UX problems before they're anything else — a slow error message and a form that lets you fill it out before telling you it won't work.
- No new accessibility audit was performed this session; the gap flagged in the original audit remains open and unaudited either way.

## 11. Business Risks

Materially reduced since the last audit — the core hypothesis (realtors adopting the platform) can now actually be tested, which was the single largest business risk previously identified. The two new findings in this report are polish-level, not existential.

## 12. Product Decisions Required

None new. All four from the previous audit were resolved by you; none of this session's findings require a business decision — both are engineering fixes with an obvious correct answer (extend an existing pattern; configure a default).

## 13. Recommendations

| Recommendation | Reason | Priority | Timing |
|---|---|---|---|
| Generalize `AdminGuard` into a role-aware guard, apply to `/dashboard/*` | Finding 1 | P1 | Before beta |
| Set a global `QueryClient` retry function that skips auth errors | Finding 2 — affects 12 screens at once with one fix | P1 | Before beta |
| Run a real dependency vulnerability scan | Two audits in a row have flagged this as unverified | P1 | Before beta |
| Add integration test coverage for the refresh-token concurrency logic | Flagged as untested when it was built; still true | P2 | Before beta if time allows, otherwise early post-beta |
| Restore price/bedroom search filters on both platforms | Minor UX regression from an earlier rebuild | P3 | Post-launch |

## 14. Pre-Beta Requirements

- [ ] Route guard extended to `/dashboard/*`
- [ ] `QueryClient` retry behavior fixed on both platforms
- [ ] Dependency scan actually run, results reviewed
- [ ] Everything from the previous audit's pre-beta checklist (already satisfied, re-confirmed this session)

## 15. Pre-Launch Requirements

Unchanged from the previous audit's list — nothing this session's findings add to that list, since both new findings are pre-beta scoped, not pre-launch-specific.

## 16. Do Not Build

Unchanged. Reviews/ratings, a second SMS provider, API versioning, and Phase 2 features all remain correctly out of scope for the reasons already given.

## 17. Post-MVP Roadmap

**NOW:** The two findings in this report — both small, both fixable in under an hour of real engineering time each.
**NEXT:** Dependency scan, refresh-logic test coverage, general rate limiting.
**LATER:** Search filter parity, reviews/ratings, everything else already queued from the last audit.

## 18. Final Readiness Status

# 🟢 READY FOR LIMITED BETA

Both findings from this report's own re-audit are now closed, verified by direct inspection: the route guard extends to `/dashboard`, and the retry-delay issue is fixed on both platforms via one shared `QueryClient` factory each. Privacy Policy and Terms of Service pages exist, clearly marked as drafts pending qualified legal review rather than presented as finished legal documents. A support channel is live in the site footer.

**One thing surfaced while closing these that's worth knowing about, not just noting in passing:** fixing the route guard required first finding and fixing a real root-cause bug — `User.role` was never being promoted from `BUYER` to `REALTOR` anywhere in the app, for any real signup. It didn't break backend authorization (which correctly checks verification status, not role), but it would have broken the very guard fix being built. Fixed at the source, with a regression test that specifically avoids the fixture pattern that let the original bug go unnoticed.

**What keeps this at beta rather than full launch-ready:** the dependency vulnerability scan has now been flagged in three consecutive audits and still hasn't run — that's the one item in this entire process that's genuinely on you, not on further engineering work, since this environment has no network access to run it. Legal review of the privacy/terms drafts is the other real gate before public launch. Neither blocks a small, hand-held beta with realtors you personally onboard.
