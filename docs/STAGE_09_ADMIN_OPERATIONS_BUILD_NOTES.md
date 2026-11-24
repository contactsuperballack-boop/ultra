# Stage 09 — Admin Operations, Analytics & Support

## Delivered in this build

### Admin command centre
- Added `/admin` as the admin landing page and operational overview.
- Live counts for users, new users, listings, pending listing/development reviews, enquiries, inspections, Home Services requests, open reports and active support tickets.
- Payment ledger aggregation by transaction status with transaction count and gross recorded amount. The UI explicitly does not label these amounts as net revenue, cash settlement or payout balances.
- Status breakdowns for account roles, listing lifecycle, inspections, service requests and support tickets.
- Analytics event counts for the existing first-party event taxonomy and a recent admin audit feed.
- Metrics use live database queries; there is no synthetic/sample data or extrapolated KPI.

### Support desk
- Added customer support tickets with categories for account, listing, payment, inspection, Home Services, safety/fraud and other issues.
- Customers can create a ticket, view their own cases and reply while a case is active. Creation is limited to 3 tickets per user per hour and replies to 15 per user per 10 minutes (Redis rate limiter; fails open if Redis is unavailable, matching the existing platform policy).
- Admins can triage status and priority, assign a case to an active administrator, send customer-visible replies, add internal-only notes, and resolve/close with a required resolution note.
- Customer-facing queries filter internal notes; admin queue can view both.
- Admin changes are written to `AdminAuditLog` with actor, target, prior state and change metadata.
- Ticket ownership is enforced on customer reads/replies; admin endpoints require `adminProcedure`.

### Navigation
- Added an admin overview and support desk entry to the admin navigation.
- Added a signed-in Help & Support link and `/support` customer interface.

## Database changes

New models: `SupportTicket`, `SupportTicketMessage`.
New enums: `SupportTicketStatus`, `SupportTicketPriority`, `SupportTicketCategory`.

Migration: `packages/db/prisma/migrations/20261123140000_stage_09_admin_operations_support/migration.sql`.

The assigned administrator is stored as a scalar ID rather than a foreign key, so support history is retained if an admin account is later demoted or deactivated. Requester and message author relations are retained with restrictive deletion semantics.

## Operational / analytics boundaries

- Current dashboard event metrics are based on the existing `AnalyticsEvent` taxonomy (`user_registered`, `listing_viewed`, `search_performed`, `inquiry_sent`, `service_request_created`, `job_completed`). These counts are not automatically a full conversion funnel: event properties and identity/session stitching need further validation before conversion rates or cohort attribution are reported.
- Payment aggregates are sums of transaction ledger rows by status; they are not accounting statements and must not be interpreted as net revenue, cleared bank funds, refunds settled, or provider payouts.
- Home Services operational counts are database counts. Feature flags still govern user-facing access.
- Email, SMS, WhatsApp and push delivery-provider integrations are not added in this stage. Ticket replies are persisted in the support thread; outbound notification delivery is a separate integration.
- No automated SLA timers, escalation scheduler, canned replies, attachments, or multi-team routing are included yet.

## Verification

Source syntax parsing and archive integrity checks are performed for this build. The full Prisma validation/client generation, migration application, TypeScript typecheck, integration suite, Next.js production build, browser E2E and staging verification require the project dependencies, PostgreSQL and Redis services. Do not describe the build as production-ready until those release gates pass.

## Deployment sequence

1. Back up the target database and confirm it is the intended environment.
2. Apply migrations with the repository's Prisma migration workflow.
3. Regenerate Prisma Client and run API/web typechecks.
4. Run the integration suite against a dedicated test database and Redis instance.
5. Verify customer ticket isolation, internal-note visibility, admin role gates, assignment, resolution audit, and dashboard counts in staging.
6. Confirm existing admin roles and support ownership processes before enabling the pilot.
