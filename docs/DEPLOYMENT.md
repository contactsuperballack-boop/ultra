# ULTRA — Deployment Guide (Step 8)

Nothing in this document has been executed — no deploy has actually happened from this codebase. It's written to be followed exactly, not summarized further once you're doing this for real.

## Environments

Three, matching framework §34:

| Environment | Web/API | Database | Purpose |
|---|---|---|---|
| **Development** | `localhost:3000` via `pnpm dev:web` | Local Postgres (`docker compose up`) | Daily development |
| **Staging** | `staging.ultraapp.ng` (Vercel preview or a dedicated staging project) | Separate Neon/Supabase project — never shares data with production | Testing against real infra before it's real users |
| **Production** | `ultraapp.ng` | Production Neon/Supabase project, PITR enabled | Real users, real money |

**Never point staging at the production database.** This sounds obvious; it's also the single most common way a "test" action does real damage. Keep the two `DATABASE_URL`s in genuinely separate secret stores, not just separate lines in the same `.env` file someone could paste from wrong.

## Web + API Deployment (Vercel)

Web and API are the same deployment — recall the Technical Spec's architecture decision: tRPC runs on Next.js route handlers, not a separate NestJS service. So "deploy the API" and "deploy the web app" are one action, not two.

1. Connect the GitHub repo to a Vercel project, root directory `apps/web`.
2. Set the build command to respect the monorepo: Vercel auto-detects Turborepo, but confirm the project's "Root Directory" is `apps/web` and it installs from the repo root (`pnpm install` at the workspace root, not inside `apps/web` alone) — otherwise workspace packages (`@ultra/api`, `@ultra/db`) won't resolve.
3. Environment variables (Vercel dashboard → Settings → Environment Variables), set separately for Preview (staging) and Production:
   - `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `TERMII_API_KEY`, `PAYSTACK_SECRET_KEY`, `SENTRY_DSN` — full list in `.env.example`
   - `NODE_ENV` — Vercel sets this automatically per environment; **do not override it manually**, since `getSmsProvider()`'s production-safety check and `_testOnlyCode`'s test-only gate both depend on this being accurate.
4. Domain + HTTPS: add the custom domain in Vercel's dashboard, point your DNS provider's A/CNAME records at Vercel per their instructions. **HTTPS is automatic** (Vercel provisions and renews Let's Encrypt certificates) — there is no manual certificate step.
5. First deploy will fail if the database schema doesn't exist yet — run the database deployment step below first.

## Database Deployment

1. Create a Neon or Supabase project per environment (staging and production are **separate projects**, not separate databases in one project — cleaner isolation, and a Neon/Supabase outage or mistake in one can't touch the other).
2. Run migrations against it — **`prisma migrate deploy`, never `prisma migrate dev`, outside of local development.** `migrate dev` can prompt for destructive resets; `migrate deploy` only applies pending migrations and never touches existing data.
   ```
   DATABASE_URL="<production-url>" pnpm --filter @ultra/db exec prisma migrate deploy
   ```
3. Do **not** run `pnpm db:seed` against staging or production — the seed script creates fake realtors, a fake buyer, and fake listings. It exists for local development only.
4. Enable PITR (paid tier) on both staging and production — see `docs/OPERATIONS.md`'s backup section for why this isn't optional for production specifically.

## Redis Deployment

Upstash (serverless Redis, pay-per-request — fits a low-traffic MVP better than a provisioned instance) or any Redis-compatible host reachable over TLS. Set `REDIS_URL` per environment. Recall from `lib/redis.ts`: the app throws at startup if this is unset, so this is not optional infrastructure — it's required for the app to boot at all, not just for rate limiting to work well.

## File Storage (Cloudflare R2)

1. Create an R2 bucket per environment (again, separate staging/production buckets — a staging upload test shouldn't appear in production listing photos).
2. Generate R2 API credentials (Cloudflare dashboard → R2 → Manage API Tokens).
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` per environment.
4. **This integration was never actually built** — the schema (`ListingPhoto.url`) and the UI (photo upload dropzone in the realtor dashboard's listing form) both assume a URL exists, but nothing in this codebase uploads a file to R2 yet. This is real, not-yet-done work, not a deployment step you can just "turn on."

## Payments (Paystack) — Per-Environment Setup

1. Paystack gives you separate test and live API keys automatically — no separate "staging account" needed, use test keys for staging, live keys for production.
2. Register the webhook URL in the Paystack dashboard for **each** environment separately: `https://staging.ultraapp.ng/api/webhooks/paystack` and `https://ultraapp.ng/api/webhooks/paystack`. If you only register the production URL, staging's webhook handler will simply never receive events — payments will initialize but never complete, silently, which will look like a bug in the code when it's actually a missing dashboard configuration step.
3. Confirm `PAYSTACK_SECRET_KEY` matches the same test/live mode as the webhook you registered — a live-mode webhook signature will not verify against a test-mode secret key, and vice versa.

## Mobile Deployment (Expo EAS)

Three build profiles already configured in `apps/mobile/eas.json` — `development`, `preview`, `production` — each setting a distinct `APP_VARIANT`, `API_URL`, and `SENTRY_DSN` via `app.config.js`. This is why the static `app.json` was converted to a dynamic config: a static file can't read per-profile environment variables.

1. `eas login`, then `eas init` inside `apps/mobile` — this generates a real EAS project ID, which needs to replace the `REPLACE_WITH_REAL_EAS_PROJECT_ID` placeholder in `app.config.js`.
2. Build: `eas build --profile preview --platform all` for a staging build distributed internally (no App Store review needed — installs via a link), or `--profile production` for a store-bound build.
3. **iOS**: needs an Apple Developer account ($99/year), a real bundle identifier registered in App Store Connect, and signing credentials — EAS can generate and manage these for you (`eas credentials`) rather than requiring manual certificate wrangling.
4. **Android**: needs a Google Play Developer account ($25 one-time), a signing keystore — again, EAS can generate and manage this.
5. **Neither store account exists yet.** This document assumes you'll create them; it does not and cannot create them for you. Framework §35 explicitly calls this out: "do not assume publishing credentials are available" — they are not, here.
6. Submit: `eas submit --profile production --platform ios` / `--platform android`, once a production build exists and store listings (screenshots, descriptions, privacy policy URL) are prepared in App Store Connect / Google Play Console — also not yet done, also not something this codebase can do for you.

## Monitoring Setup (Post-Deploy)

1. Create a Sentry project (one per environment, or one project with environment tagging — either works; separate projects give cleaner alert routing).
2. Set `SENTRY_DSN` in Vercel (web/API) and in `eas.json`'s per-profile env (mobile).
3. Configure alert rules in the Sentry dashboard — the code reports errors, but nobody gets paged without an alert rule pointing somewhere (email, Slack, PagerDuty). This is dashboard configuration, not something `lib/sentry.ts` can set up for you.

## Pre-Launch Checklist

Pulled together from framework §46, scoped to what's actually relevant here:

- [ ] Staging deploy tested end-to-end (register → verify → browse → inquire → admin approve) before production deploy
- [ ] `DATABASE_URL` for production points at a PITR-enabled instance, confirmed by checking the provider dashboard, not assumed
- [ ] Paystack webhook registered for the production URL specifically, tested with a real (small) transaction
- [ ] `TERMII_API_KEY` set in production — confirm by checking that `getSmsProvider()` does NOT throw on a real production request (if it does, that's actually correct behavior telling you the key is missing, not a bug)
- [ ] Sentry alert rule exists and was tested (trigger a real error, confirm someone actually gets notified)
- [ ] R2 file upload integration actually built (see above — it isn't yet)
- [ ] Mobile: store accounts created, credentials generated via `eas credentials`, at least a `preview` build installed and manually tested on a real device before a `production` build is submitted
