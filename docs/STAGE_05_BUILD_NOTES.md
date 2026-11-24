# ULTRA — Stage 05 Build Notes

**Scope:** Home Services transaction workflows.

## Implemented

### Transaction types
`ServiceRequest` now carries an explicit `transactionType`:
- `ONE_TIME`
- `INSTALLATION_PROJECT`
- `RECURRING`

One-time requests retain the existing provider accept/decline and completion path. Providers cannot shortcut a project or recurring request through the one-time `respond` procedure; those request types must use their formal proposal flows.

### One-time appointment and service-location confirmation
- Added `ServiceRequest.preferredAt` for a customer-requested appointment time, separate from the provider-confirmed `scheduledAt`.
- The customer service form collects a service address for all transaction types and an optional preferred appointment for one-time work.
- Preferred appointment values must be in the future. If a customer supplied a preferred time, a provider must enter a confirmed appointment before accepting the one-time request; provider-confirmed times must also be in the future.
- Provider queue, customer bookings and admin monitoring distinguish customer-preferred from provider-confirmed time. Service addresses remain customer-supplied operational context, not verified property addresses.

### Bulk installation-project requests
- Customer service request form supports an installation project, unit count (1–500), estate/project name and optional site address.
- Requests above one unit must be `INSTALLATION_PROJECT` and include a site/project name.
- Site address is customer-supplied context, not a verified property address.
- The request is provider-specific. It is not a multi-provider tender or bidding process.

### Project quotations and milestones
- Verified providers can propose a project scope, total price, estimated duration, optional quote expiry and one or more milestones.
- Milestone amounts must add up exactly to the quote total.
- Customers can accept or decline the proposal.
- A declined proposal returns the request to `REQUESTED`, allowing a revised version; versions are retained.
- Providers advance milestones from `PENDING` to `IN_PROGRESS` to `COMPLETED`.
- Customers approve completed milestones.
- A project cannot be marked complete until every milestone in the accepted quote is approved.
- Project commission is accrued once against the accepted project total when the project is completed.

### Recurring service agreements
- Customer chooses a requested frequency: weekly, fortnightly, monthly or quarterly.
- Verified provider proposes service scope, matching frequency, price per visit, start date and optional end date.
- Customer acceptance activates the agreement. Declined proposal versions are retained and providers can send a new version.
- Providers schedule one outstanding visit at a time. The agreement's next service date advances after each completed visit; monthly/quarterly date arithmetic clamps month-end dates instead of overflowing into the next month.
- Providers start and complete each visit. Each completed visit creates an idempotent commission ledger entry linked to the `ServiceOccurrence` and increments provider commission owed.
- Customer or provider can cancel an active agreement. Future scheduled visits are cancelled; an in-progress visit can still be completed and accounted for.
- There is no automatic scheduler, recurring customer payment collection or auto-generated visit series yet.

### Customer/provider/admin interfaces
- Customer service request form exposes all three transaction types and bulk project details.
- Provider request dashboard supports one-time acceptance, project quote composition with editable milestone rows, recurring agreement proposals, milestone progress, recurring visit scheduling and completion.
- Customer bookings dashboard supports quote/agreement review, accept/decline, milestone approval, recurring agreement status/history and cancellation.
- Admin service-request monitor can filter `PROPOSAL_PENDING` and sees transaction type, unit count and site details.
- Added dedicated notification types for proposal, milestone and recurring visit events.

## Data model additions
- `ServiceTransactionType`, `ServiceFrequency`, `ServiceQuoteStatus`, `ServiceMilestoneStatus`, `RecurringAgreementStatus`, `ServiceOccurrenceStatus`.
- `ServiceRequest` transaction type, unit count, site name/address and requested frequency.
- `ServiceQuote`, `ServiceMilestone`, `RecurringAgreement`, `ServiceOccurrence`.
- `PaymentTransaction.serviceOccurrenceId` optional relation for recurring-visit commission ledger entries.
- `PROPOSAL_PENDING` service request status and dedicated service workflow notification types.

## Tests added
- Bulk request type/site-name validation.
- One-time preferred appointment capture, past-time rejection and provider-confirmed appointment requirement.
- Project quote milestone total reconciliation.
- Customer proposal acceptance.
- Project completion blocked until customer approves all milestones.
- Project commission accrual on completion.
- Recurring proposal acceptance and activation.
- Recurring visit schedule/start/complete.
- Per-visit commission ledger and provider commission balance update.
- Recurring agreement cancellation.

## Explicitly not included
- Customer payments, deposits, refunds, provider payouts and commission settlement changes (Stage 08).
- Automatic recurring scheduling, recurring payment collection and service-visit reminders.
- Multi-provider tenders/bidding for bulk estate requests.
- Service disputes, complaints, evidence attachments and SLA escalation (Stage 09).
- Mobile UI parity for project quotes, milestones and recurring agreements (Stage 10).

## Verification status
- TypeScript/TSX syntax transpilation: 219 workspace source files parsed; zero syntax diagnostics.
- Prisma schema validation/client generation: not run (Prisma CLI/workspace dependencies unavailable in this environment).
- Unit/integration tests: added but not executed (no installed dependencies or test PostgreSQL/Redis runtime available).
- Next.js typecheck/build: not run.
- Migration baseline: not generated. The new enums, models, relations and indexes must be included in the generated baseline before local testing.

Do not describe Stage 05 as fully verified until Prisma generation/migration, unit/integration tests, typecheck and web build pass.
