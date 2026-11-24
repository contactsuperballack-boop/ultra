# ULTRA — Stage 07 Dashboard Build Notes

**Scope:** Buyer, realtor, agency and Home Services provider dashboards.
**Base:** Stage 05 source archive. Stage 06 (AI Studio) intentionally skipped as requested.

## Implemented

### Buyer dashboard
- New authenticated route: `/buyer/dashboard`.
- Server-side `dashboards.buyerOverview` summary is scoped to the authenticated user.
- Summary counts: live saved properties, saved searches, property enquiries, inspection requests, unread notifications and Home Services requests (only when the Home Services API feature flag is enabled).
- Recent saved properties, enquiries and inspection activity are returned using limited, explicit projections.
- Account page now links directly to the buyer dashboard.
- Dashboard links to the existing saved properties, saved searches, messages, inspections, notifications and bookings screens.

### Realtor dashboard
- New `/dashboard` overview backed by `dashboards.realtorOverview`.
- Requires a currently verified realtor profile at the API boundary.
- Displays listing counts by lifecycle status, total/live/pending/under-review inventory, developments, enquiries, inspections, unread notifications, credit balance and subscription state.
- Recent listing and enquiry summaries use explicit projections and are scoped to the signed-in realtor profile.
- Existing listing, development, inquiry, verification, billing and subscription workflows remain in place.

### Agency dashboard
- New `/agency/dashboard` workspace and navigation.
- Uses the existing `RealtorProfile.agencyName` and its associated inventory/activity as an agency-level overview.
- Explicitly describes the scope as one verified agency login/account.
- No agency/team model currently exists in the database. Agent invitations, multi-user membership, staff roles, shared ownership, assignment and team-level access controls are not represented as implemented features.

### Home Services provider dashboard
- Expanded existing `/partner/dashboard` summary.
- Additional workload metrics: proposal-pending requests, active jobs, total requests and active recurring agreements.
- Added recent service request activity and upcoming scheduled recurring visits.
- Added provider rating display when a rating exists, commission-owed balance and navigation to relevant operational screens.
- Existing provider verification, profile, offering, request, billing and subscription routes remain unchanged.
- Provider metrics remain protected by the verified-provider procedure and Home Services feature gate.

## API and security
- Added `packages/api/src/routers/dashboards.ts` and registered it in `appRouter`.
- Buyer summary uses `protectedProcedure`; realtor summary uses `verifiedRealtorProcedure`.
- Provider dashboard remains on `homeServicesVerifiedProviderProcedure`.
- All aggregate queries are scoped by the authenticated user's profile ID or user ID.
- Returned records use explicit `select` projections and small recent-item limits; private KYC documents and internal provider commission fields are not included in buyer/realtor summary payloads.

## Tests added
- Buyer dashboard counts and saved-property data are scoped to the authenticated buyer.
- Realtor dashboard returns only the signed-in realtor's profile and portfolio.
- Unverified accounts cannot access realtor dashboard metrics.
- Provider dashboard summary reflects the provider's own active offering and incoming request.

## Not included / deferred
- Agency/team management requires a dedicated Agency, AgencyMembership and staff-permission data model, plus onboarding and invitation flows.
- Agent-to-listing assignment and agency-wide ownership/commission reporting are not implemented.
- Dashboard charts and historical trend analytics are deferred to Stage 09.
- Mobile dashboard parity is deferred to Stage 10.
- Payment settlement and service-provider payout information remain subject to Stage 08; the provider dashboard only displays the existing commission-owed balance, not cash earnings or payouts.
- No unsupported claim of completed property sales or service revenue is shown.

## Verification status
- TypeScript/TSX syntax transpilation: 226 source files parsed; zero syntax diagnostics.
- Package manifest and archive checks: pending final packaging pass.
- Prisma schema validation/client generation: not run (dependencies/Prisma CLI unavailable in this environment).
- API/web typecheck, lint, unit/integration tests, Next.js build and browser E2E: not run.
- Database migration baseline: not generated/applied; Stage 03/04/05 schema changes still need to be included in the local migration workflow.

Do not describe Stage 07 as runtime-verified or production-ready until the migration, typecheck, test, build and browser verification gates pass.
