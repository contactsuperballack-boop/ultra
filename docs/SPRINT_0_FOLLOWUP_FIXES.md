# Sprint 0 follow-up fixes

Prepared from the verification report dated 2026-11-15.

## Changes in this working copy

1. Prisma Client generation now runs as the `@ultra/db` postinstall step and before the database package typecheck.
2. Root `build` and `typecheck` scripts generate Prisma Client before invoking Turbo, so generated Prisma enum/type exports are available to downstream packages.
3. The Next.js ESLint configuration disables only `react/no-unescaped-entities`. Literal apostrophes and quotation marks in JSX are valid rendered text; all other inherited Next.js rules remain enabled.
4. The bookings page now gives the `myRequests` result callback an explicit type inferred from `AppRouter`. The web package declares the matching `@trpc/server` type dependency.

## Still required in the user's environment

These edits have not been run through the full toolchain in this environment. After extracting this ZIP, run:

```bash
pnpm install
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm --filter @ultra/web build
pnpm test:unit
```

Then, on an environment with Docker Engine and Docker Compose available:

```bash
pnpm verify:migration
pnpm test:integration
```

The Docker-dependent migration and integration checks remain unverified until they run successfully against the isolated test database. Do not treat this ZIP as a completed Sprint 0 sign-off.

## Pilot-readiness follow-up — 2026-11-23

1. Admin listing review now returns the full public profile payload: all photos/floor plans, project credits, completion year, owner statement and attribution, YouTube film ID, 3D model URL, linked development details, and realtor identity/verification state.
2. The admin listing review screen now displays those details and media before the decision. Approve & Publish is disabled until the reviewer confirms they reviewed the submitted profile and media. Removal remains available without that confirmation.
3. Added an integration test asserting the admin queue returns the profile fields, linked development and all photos, including a floor plan.
4. Added a production guard to the demo database seed script, a dedicated staging seed script, and `docs/SEEDING.md` with environment instructions.

These changes passed TypeScript/TSX syntax transpilation and package JSON parsing in the editing environment. They have **not** passed full typecheck, lint, unit/integration tests or a Next.js build because pnpm/dependencies could not be installed: Corepack could not resolve `registry.npmjs.org`. Do not treat this follow-up as a Sprint 0 sign-off.
