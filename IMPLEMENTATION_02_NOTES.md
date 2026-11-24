# ULTRA MVP implementation 02 — Home Services pilot

This update starts the Home Services MVP pilot work while retaining the existing Abuja property marketplace.

## Product scope applied

The canonical five departments are taken from `docs/PRODUCT_SCOPE.md`:

1. Smart Home Installations — SOLAR, CCTV, SECURITY_SYSTEMS
2. Luxury — PAINTING, FURNITURE
3. Electrical & Plumbing — ELECTRICAL, PLUMBING
4. Cleaning & Move-In — CLEANING, MOVE_IN
5. Fumigation & Pest Control — FUMIGATION, PEST_CONTROL

Departments are discovery groupings. Provider verification, offerings and service requests continue to store granular specialties. The four legacy enum values remain valid; no existing provider is automatically granted a new specialty.

## Implemented in this slice

- Added seven specialty values to the Prisma `ServiceCategory` enum.
- Added shared department/specialty mapping and unit tests in `packages/db/src/services.ts`.
- Updated provider API validation and department-based discovery filtering.
- Added a fail-closed API middleware for public and provider-facing Home Services procedures. Admin verification and oversight procedures remain available while the feature is disabled.
- Added a separate Home Services feature flag for web, API and mobile, retaining the legacy Phase 2 flag as a compatibility fallback.
- Rebuilt the web Services landing page around the five approved departments.
- Updated web and mobile provider application, discovery and specialty labels.
- Added an admin Service Requests monitoring screen and an admin-only paginated API query.
- Added integration coverage for department discovery, API feature gating and admin-only request monitoring.
- Updated product-scope and pilot documentation.

## Enablement

For an approved pilot environment, configure:

- Web: `NEXT_PUBLIC_HOME_SERVICES_ENABLED=true`
- API: `HOME_SERVICES_ENABLED=true`
- Mobile build: `HOME_SERVICES_ENABLED=true`

All flags default to false. Do not enable production traffic until the migration baseline and integration suite pass.

## Verification performed in this environment

- TypeScript/JavaScript syntax transpilation: 236 files parsed, zero syntax diagnostics.
- Department/specialty mapping runtime assertions: passed.
- Package JSON validation: passed.

## Not yet verified

- Prisma schema validation / generated Prisma client.
- Prisma migration baseline and clean-database migration test.
- Full TypeScript typecheck, lint and Next.js production build.
- Unit and integration test suites against PostgreSQL.
- Web/mobile device flows and real provider integrations.

The environment has Node 22 but no pnpm executable, Docker or installed workspace dependencies. Do not treat syntax parsing as a successful application build. Run the documented clean-install and migration gates on the development machine/CI before merging or enabling the pilot.
