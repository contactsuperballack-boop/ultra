# ULTRA — Current MVP Product Scope

This document records the current product decisions confirmed by the product owner. It supersedes older category descriptions in historical handoff notes where they conflict.

## Product positioning

ULTRA's MVP is a verified property marketplace for Abuja. It supports property discovery, realtor verification, listing moderation, buyer inquiries and inspections. The longer-term direction is a homeowner ecosystem, but not every future capability is part of the MVP launch.

## Product-owner update — Home Services included in MVP pilot (2026-11-23)

The product owner has authorized Home Services as part of the Abuja MVP pilot. The five departments and granular specialty mapping below remain the canonical taxonomy. The feature flag remains off by default and must be enabled explicitly only in approved pilot environments after the migration and integration gates pass.

## Home services — five customer-facing departments

Home services are organized into these five departments:

1. **Smart Home Installations** — solar installations, CCTV installations and security systems.
2. **Luxury** — painting and furniture.
3. **Electrical & Plumbing** — electrical and plumbing services.
4. **Cleaning & Move-In** — cleaning and move-in services.
5. **Fumigation & Pest Control** — fumigation and pest-control services.

These are customer-facing departments. Provider verification and individual offerings use more granular specialties beneath each department. The additive specialty mapping is documented in `docs/SERVICES_TAXONOMY_MIGRATION_PLAN.md`. Do not expose the new taxonomy in production until the migration baseline and integration tests pass; existing provider records must not be silently re-verified.

## Home Services transaction models

Home Services supports one-time jobs, installation projects with provider quotations and customer-approved milestones, and recurring service agreements with per-visit scheduling. Installation-project requests can cover multiple units (up to 500) and require an estate/project name for bulk requests. Recurring agreements accrue commission per completed visit. In-platform customer payment collection, automatic recurring scheduling and multi-provider tenders remain separate future work.

## Mortgage

Mortgage is **Coming Soon** and is not an MVP production feature. ULTRA is not a lender or broker. Do not include simulated mortgage institutions, invented lender partnerships, pre-approval claims, or mock lender offers in production UI or data. Mortgage/financing may be reconsidered in a later phase after a separate product and compliance decision.

## Implementation guardrails

- The monorepo is the single source of truth for production code.
- QuickBuild is a UX and feature reference only; do not wholesale-copy or merge its application.
- Implement web and mobile capabilities natively against the existing shared tRPC API and Prisma data model.
- Preserve verification, moderation, authorization and audit controls when extending features.
- Do not claim an integration is live until it has been configured and tested against the real provider.
