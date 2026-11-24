# UX backlog (living file)

Last updated with UX batch 1. Statuses are honest: **Done** means the code is written and syntax-checked; nothing here has been run on a device or in a browser by me. See "How to verify" at the bottom.

## Done in batch 1

| # | Problem found in the audit | Fix |
|---|---|---|
| 1 | Search showed only the first 20 results on web and mobile; there was no way to see more | Web: "Show more homes" (infinite query). Mobile: infinite scroll |
| 2 | A search request fired on every keystroke (burns the IP rate limit, flickers) | 350 ms debounce on web and mobile; previous results stay visible while a new search loads |
| 3 | Loading looked like plain "Loading…" text, so the page jumped when results arrived | Card-shaped skeletons (web grid, home, mobile list) |
| 4 | Empty and error states were dead ends | Empty state explains and offers "Clear all filters"; error state has "Try again" (web + mobile); mobile has pull-to-refresh |
| 5 | Search results couldn't be shared or reloaded | Web search text is kept in the address bar (`?query=`) |
| 6 | iOS keyboard covered the message composer, inquiry bar, sign-in fields and the inspection sheet's notes | `KeyboardAvoidingView` on those screens |
| 7 | 59 places used `text-stone-400` for information (about 2.5:1 contrast, fails WCAG AA) | Replaced with `text-stone-500` (about 4.7:1) across web |
| 8 | Phone entry only accepted `+234XXXXXXXXXX`; "0803…" (how most people type) was rejected | `normalizeNigerianPhone` (tested): accepts 0803…, 803…, +234 803…, +2340803…, spaces/dashes |
| 9 | OTP entry had no autofill, no auto-submit, no resend | One-time-code autofill, auto-submit on the 6th digit, resend with a 60 s countdown matching the server cooldown |
| 10 | Every web sign-in landed on `/dashboard/listings`, so buyers ended up on a realtor page | Sign-in returns to where the person was (`?next=`, open-redirect safe, tested) or to a role-appropriate page (buyers go home) |
| 11 | A signed-in buyer opening a realtor page was bounced to the login page | Route guard sends wrong-role users home and signed-out users to login with `next` |
| 12 | Tapping the heart signed-out silently flipped back | Small "Sign in to save homes" hint that returns to the same page |

## Backlog (suggested order)

1. **Real-device QA of batch 1** (see below). Highest priority because none of it has been exercised.
2. **Listing photo experience.** Full-screen swipe viewer with pinch-to-zoom on mobile; keyboard-navigable lightbox on web. Confirm the mobile detail screen has a multi-photo carousel (the code I read showed a single main image).
3. **Empty/loading/error parity.** Saved, Messages, Notifications and the realtor dashboards each have their own ad-hoc states; make them consistent with the search ones.
4. **Success feedback.** A single toast pattern for "inquiry sent", "saved", "inspection requested" (currently inline text in places).
5. **Accessibility pass.** Icon-only buttons need labels on mobile; visible focus rings and a skip link on web; check the amber and emerald-on-white combinations in badges; respect reduced motion in skeleton pulses.
6. **Keyboard handling on remaining mobile screens** with inputs (provider detail, service request forms).
7. **Compact price display** on cards ("₦220M") with exact price on the detail page.
8. **Buyer dashboard:** compare saved homes, private notes, evaluation progress (from the implementation checklist).
9. **Saved searches and alerts** ("tell me about new homes in Guzape under ₦300M").
10. **Dark mode on web** (mobile already has a theme).
11. **Inspection requests:** reminders, calendar export, and a clearer "what happens next" after sending.
12. **Onboarding wheel** on real devices (dashed ring rendering on Android).

## Deliberately not done

- Mortgage stays "Coming Soon" per `docs/PRODUCT_SCOPE.md`; no UX work on the calculator.
- Home Services is included in the supervised Abuja MVP pilot by the 2026-11-23 product-owner update; use `docs/HOME_SERVICES_MVP_PILOT.md` as the current UX scope.
- No visual redesign: this batch fixes behaviour, not branding.

## How to verify batch 1

- **Search:** open `/search`, scroll to the bottom and press "Show more homes"; type quickly and confirm one network request after you pause; reload with `?query=guzape` in the URL.
- **Sign-in (web):** sign in from a listing page after tapping "Sign in to message"; you should land back on that listing. Try `0803…` and `+234 0803…` numbers.
- **Sign-in (mobile):** on iOS and Android, check SMS code autofill and that the keyboard doesn't cover the buttons.
- **Keyboard (iOS):** open a thread and the listing screen with the inquiry bar; the input must stay visible while typing. Also the inspection sheet's notes field.
- **Accessibility:** run Lighthouse or axe on `/`, `/search` and a listing page; contrast warnings on helper text should be gone.
