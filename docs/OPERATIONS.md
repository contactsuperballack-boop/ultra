# ULTRA — Production Hardening (Step 7)

Companion to `docs/TECHNICAL_SPEC.md`. Covers what was built this session and what remains a manual step for whoever actually deploys this.

## Rate Limiting

Redis-backed (`packages/api/src/lib/rateLimit.ts`), fixed-window counters, **fails open** on Redis errors — a Redis outage degrades rate limiting rather than taking the API down. This is a disclosed tradeoff: rate limiting here is defense in depth, not the only control (OTP attempts are also capped independently in Postgres via the existing `attempts` column).

| Endpoint | Scope | Limit | Why |
|---|---|---|---|
| `auth.requestOtp` | per phone | 5 / hour | Supplements the existing 60s DB cooldown with a coarser cap |
| `auth.requestOtp` | per IP | 15 / hour | Stops one source cycling through many phone numbers |
| `auth.verifyOtp` | per IP | 20 / hour | The per-code `attempts` counter resets on every new code request — this catches an attacker who just requests fresh codes to dodge that |
| `inquiries.create` (new inquiries only) | per buyer | 20 / day | **This is the one that matters most.** Each new inquiry costs a real realtor real money (the lead fee). Without this, a malicious or careless buyer account could drain a realtor's prepaid balance by spamming inquiries. Follow-up replies in an existing thread are *not* rate-limited here — only the billable event is. |

**Known gap:** no rate limiting yet on `listings.create` (a compromised or malicious realtor account could spam low-quality listings) or on general read traffic (`listings.search` could theoretically be scraped hard). Neither was in the original P0 list; flagged here rather than silently left out.

## Secrets Audit

Pass performed against the full codebase (not delegated, actually read through):

- **No hardcoded secrets found.** Every credential (`JWT_SECRET`, `TERMII_API_KEY`, `PAYSTACK_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN`) is read from `process.env`, never a literal in source.
- **`.env` is gitignored**; `.env.example` contains only placeholders/empty strings, no real values.
- **One real vulnerability found and fixed this session:** `getSmsProvider()` used to fall back to `DevConsoleSmsProvider` (which logs OTP codes to stdout) whenever `TERMII_API_KEY` was unset — including, if someone forgot to set it, in a production deploy. That would have meant real verification codes landing in production server logs, a genuine account-takeover-adjacent risk. Fixed: it now throws instead of falling back, specifically when `NODE_ENV === "production"`. Covered by a real, executed unit test (`packages/api/tests/unit/otp.test.ts`).
- **The `_testOnlyCode` field on `auth.requestOtp`** (added in the testing pass to let integration tests read the OTP) is gated on `NODE_ENV === "test"` specifically, not `!== "production"` — so a staging environment running with `NODE_ENV=development` (a real possibility if someone's env setup is sloppy) does NOT get this backdoor. Worth double-checking your staging env actually sets `NODE_ENV` correctly, since this gate depends on it.
- **Payments have no fake-success path anywhere** (see Technical Spec's Payments Implementation Status) — this was a design decision from Step 5, re-confirmed still true here.
- **Nothing logs a token, password, or API key.** Console output was checked for this specifically — `notify.ts`, the billing-warning log in `inquiries.ts`, and the webhook's "unknown reference" log all log only IDs, never secrets.

## Monitoring

Sentry, wired but genuinely untested (no real DSN available in the environment this was built in):

- `packages/api/src/lib/sentry.ts` — `reportError()` is safe to call unconditionally; without `SENTRY_DSN` it falls back to `console.error`, never silently swallows an error.
- Wired into the tRPC route handler's `onError` — only `INTERNAL_SERVER_ERROR`-class failures get reported; expected 4xx errors (`UNAUTHORIZED`, `BAD_REQUEST`, `TOO_MANY_REQUESTS`) are not noise worth alerting on.
- `apps/mobile/src/lib/sentry.ts` — same no-op-without-DSN philosophy, reads the DSN from `app.config.js`'s `extra.sentryDsn` (which itself comes from the EAS build profile's env — see `eas.json`).
- **Not wired:** performance/APM beyond the flat `tracesSampleRate: 0.1`, source map upload for readable stack traces in production, and any dashboard/alerting rules — those are Sentry project configuration, not application code, and need to happen in the Sentry UI once a real project exists.

## Backup Strategy

This is operational, not code — tied to whichever hosting provider you actually pick (Neon or Supabase, per the Technical Spec's recommendation).

**Database:**
- Both Neon and Supabase offer point-in-time recovery (PITR) on their paid tiers — Neon's free tier gives 24h of history, Supabase's free tier does daily backups only. **For a production launch handling real realtor payments, the paid tier with PITR is not optional** — a day of lost inquiry/payment data is a real business problem, not an inconvenience.
- Recommended retention: 7 days of PITR minimum, 30 days of nightly snapshots if the provider supports it separately.
- Restoration process: both providers support restoring to a new database instance from a point in time via their dashboard — practice this once in a non-production project before you need it for real, so the first time you do a restore isn't during an actual incident.

**Redis:** rate-limit counters are inherently ephemeral and self-healing (they expire on their own) — no backup needed. If Redis is ever used for anything less disposable (session caching, etc.), revisit this.

**File storage (Cloudflare R2):** R2 has 99.999999999% durability by design (S3-compatible object storage) — no separate backup needed for the objects themselves. What's worth backing up separately is the *mapping* (which `ListingPhoto.url` points to which listing), but that's already in Postgres and covered by the database backup above.

**Disaster recovery, in order of what actually breaks the business:**
1. Database loss → restore from PITR (see above). Everything else (API, web, mobile) is stateless and redeployable from the git repo in minutes.
2. Paystack outage → `payments.initiateTopUp` will fail loudly (it already throws clearly, not silently), realtors temporarily can't top up, but existing balances and the app itself keep working.
3. Redis outage → rate limiting fails open (see above) — degraded, not down.
4. Termii outage → OTP sign-in breaks entirely (no fallback SMS provider configured). This is a real single point of failure worth a second provider before you have real user volume depending on it, not before.
