# ULTRA — Monorepo

Verified property marketplace for Abuja. **ULTRA WEB** (Next.js) and **ULTRA APP** (Expo/React Native) share one Prisma database and one tRPC API contract, so there's a single source of truth for data shapes across both clients.

This codebase was scaffolded in a sandboxed environment with no network access — nothing here has been `npm install`'d or run yet. It's structurally complete and ready to run in a real dev environment (Claude Code, or your own terminal). Treat this README as the handoff doc.

## What's actually wired end-to-end vs. stubbed

**Wired (real schema → real API → real UI, on both platforms):**
- Public listing search & filtering (`listings.search`)
- Listing detail + send an inquiry (`listings.byId`, `inquiries.create`)
- Realtor dashboard listings table, including live price-band flagging (`listings.mine`)
- Realtor listing creation with automatic price-band check (`listings.create`) — logic lives in `packages/api/src/routers/listings.ts`

**Schema exists, API exists, UI does not yet (marked `TODO` in each file):**
- Saved listings screen (mobile) — needs a `savedListings` router
- Messages/inquiry threads screen (mobile) — `inquiries.myThreads` / `.reply` are implemented, screen isn't built
- Realtor inquiries inbox (web) — same story, web-side screen not built yet

**Not started — Phase 3 blocker for most "signed-in" features:**
- Phone-OTP authentication. Every `protectedProcedure` and `verifiedRealtorProcedure` will currently reject every request, correctly, because there's no session yet. This is why the dashboard and inquiry screens show an auth-required message when you run them.

## Setup (in a real environment)

```bash
# 1. Install pnpm if you don't have it
npm install -g pnpm

# 2. Install dependencies
pnpm install

# 3. Set up your database (Supabase/Neon/Railway free tier all work fine for dev)
cp .env.example .env
# edit .env with your DATABASE_URL

# 4. Push the schema and seed dev data
pnpm db:generate
pnpm --filter @ultra/db exec prisma migrate dev --name init
pnpm db:seed

# 5. Run the web app
pnpm dev:web
# → http://localhost:3000

# 6. Run the mobile app (separate terminal)
pnpm dev:mobile
# → scan the QR with Expo Go, or press i / a for simulator
```

The seed script creates one verified realtor, one buyer, and six listings (one deliberately over the Guzape price band, to demonstrate the flagging logic live).

## Architecture notes

- **`packages/db`** — Prisma schema is the source of truth for the data model. It's modeled directly against Master Blueprint v2.0 §8–10, not generic CRUD — see the comments in `schema.prisma`.
- **`packages/api`** — tRPC routers. Both web and mobile import `AppRouter`'s type from here, so a change to an endpoint's input/output shape is a compile error in both clients immediately, not a runtime surprise.
- **`apps/web`** — Next.js App Router. Server-rendering the public search page is a deliberate choice for SEO — organic listing discovery is part of the point.
- **`apps/mobile`** — Expo, React Navigation. Same tRPC client pattern as web.

## Immediate next steps, in order

1. Get this running locally (steps above) against a free Postgres instance
2. Phone-OTP auth — this unblocks the dashboard, inquiries, saved listings, and profile screens all at once
3. Finish the three stubbed mobile screens now that their APIs exist
4. Realtor onboarding UI (the `realtors.applyForVerification` mutation exists; there's no form for it yet)
5. Admin review queue UI for `realtors.adminSetVerificationStatus`
