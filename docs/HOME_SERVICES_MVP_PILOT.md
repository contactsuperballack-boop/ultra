# Home Services — MVP pilot scope

Status: **included in the ULTRA Abuja MVP pilot by product-owner decision (2026-11-23).** This updates the earlier readiness assessment that deferred all Home Services. It does not switch the feature on automatically in production.

## Customer-facing departments and granular specialties

1. **Smart Home Installations** — solar installations, CCTV installations and security systems (`SOLAR`, `CCTV`, `SECURITY_SYSTEMS`).
2. **Luxury** — painting and furniture (`PAINTING`, `FURNITURE`).
3. **Electrical & Plumbing** — electrical and plumbing services (`ELECTRICAL`, `PLUMBING`).
4. **Cleaning & Move-In** — cleaning and move-in services (`CLEANING`, `MOVE_IN`).
5. **Fumigation & Pest Control** — fumigation and pest-control services (`FUMIGATION`, `PEST_CONTROL`).

These are customer-facing departments. Provider verification, offerings and requests use granular specialties. Existing legacy categories remain valid and are mapped into their matching department; existing provider records are not automatically re-verified.

## Pilot workflow

The first pilot is Abuja-only. Providers apply with specific specialties and are manually reviewed. Approved providers create offerings, customers browse provider profiles, submit service requests and coordinate through in-app messages. Admins can monitor the service-request lifecycle in the admin console.

The service transaction workflow now supports three types:

- **One-time service:** customer requests a single job; provider accepts or declines and records an agreed price; completion accrues the existing commission.
- **Installation project / quotation:** customer submits scope and, where relevant, multiple units and an estate/site name. Provider sends a formal quote with a milestone breakdown. Milestone amounts must reconcile to the quote total. Customer accepts or declines; provider advances milestones; customer approves completed milestones; the project can close only after all milestones are approved. Commission accrues on the final project value when the project is completed.
- **Recurring service agreement:** customer requests a preferred frequency. Provider proposes scope, frequency, price per visit and start/end dates. The customer must accept before the agreement becomes active. Provider schedules one visit at a time; each completed visit accrues commission against that visit's final price. The customer or provider can cancel the agreement; future scheduled visits are cancelled with it.

Bulk installation is supported as a provider-specific installation-project request for up to 500 units. Requests above one unit require an estate/project name; an optional site address and job brief can be supplied. This is not yet a multi-provider tender or bidding marketplace. Recurring visits are scheduled manually by the provider; there is no automatic recurrence scheduler or recurring payment collection yet.

Real customer payment activation remains subject to the separate payment/idempotency stage and business verification. The current service workflow does not collect the full service price in-platform; the commission ledger records provider commission accrual when a job/project or recurring visit is marked complete.

## Trust and operational boundaries

- Provider verification wording must describe the actual checks completed; it is not a guarantee of workmanship, safety or outcome.
- Company biographies, portfolios, equipment and videos remain provider-supplied unless a specific item is independently checked.
- Smart Home Installations includes solar, CCTV and security-system installation services. Physical guarding/security workforce operations are not part of this MVP service workflow; a future guarding marketplace requires separate partner, licensing and liability review.
- Bulk estate requests and recurring agreements are now represented by explicit request/quote/agreement/occurrence records. A bulk request is currently one provider-specific project request, not a multi-provider tender. Recurring visits require manual provider scheduling; automatic scheduling and recurring payments remain out of scope.
- Customers and providers agree job scope, price and off-platform payment directly. ULTRA's service commission follows the existing provider completion workflow; pilot financial operations must be documented and monitored.

## Feature flags

- Web: `NEXT_PUBLIC_HOME_SERVICES_ENABLED=true`
- API and mobile builds: `HOME_SERVICES_ENABLED=true`
- All three boundaries default to disabled when unset. The API also rejects direct tRPC calls while disabled; admin provider review and request oversight remain available. Legacy `NEXT_PUBLIC_PHASE2_ENABLED` / `PHASE2_ENABLED` remains a backwards-compatible fallback.
- Enable only in development/staging until migrations, service integration tests, provider onboarding and trust-wording review pass. Production pilot activation requires an explicit release decision.

## Data compatibility

The legacy `PAINTING`, `PLUMBING`, `FUMIGATION` and `ELECTRICAL` enum values remain valid. New specialty values are additive: `SOLAR`, `CCTV`, `SECURITY_SYSTEMS`, `FURNITURE`, `CLEANING`, `MOVE_IN` and `PEST_CONTROL`. No production data is rewritten by this change.
