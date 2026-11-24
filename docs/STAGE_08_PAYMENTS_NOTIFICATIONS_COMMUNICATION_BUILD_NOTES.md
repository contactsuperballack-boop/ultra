# Stage 08 — Payments, Notifications & Communication

## Implemented in this pass

### Payments and financial controls
- Preserved the existing Paystack-backed realtor top-up and provider commission settlement flows.
- Hardened the Paystack webhook: signature validation remains mandatory; successful events must also match the pending ledger amount in kobo and use NGN.
- A payment is claimed with a conditional `PENDING -> SUCCESS` transition inside the same database transaction as the balance/subscription mutation. Duplicate and concurrent webhook deliveries cannot apply the same credit twice.
- Provider commission settlement initiation rejects amounts greater than the currently outstanding balance. The webhook repeats that check atomically before reducing the balance.
- A signed but amount/currency-mismatched event is rejected from financial posting and marked FAILED for manual investigation. It is acknowledged to Paystack to avoid endless retries; the server logs the reference and mismatch.
- Added a cursor-paginated admin ledger view showing the latest transaction references, account, type, amount, note and state for operational reconciliation.
- Existing billing history continues to expose PENDING, SUCCESS and FAILED states. Paystack checkout redirects are not treated as proof of payment.

### Communication
- Added persistent `readAt` state and indexes to property inquiry messages and Home Services messages.
- Added participant-scoped unread counts and mark-thread-read operations for both conversation types.
- Added per-user notification channel preferences. Push delivery now respects the user's push preference; durable in-app notification history is always retained.
- Added a push preference control to the notifications screen.

## Explicitly not represented as complete

- Home Services customer payments, project deposits and milestone collection are **not** being charged through ULTRA in this pass. Current service agreements still describe customer/provider payment as off-platform. The existing `PaymentTransaction` ledger is currently scoped to realtor/provider profiles and is not a customer-order payment ledger.
- No provider payout/withdrawal system has been introduced. Commission settlement is a provider payment to ULTRA, not a payout from ULTRA to the provider.
- Email, SMS and WhatsApp delivery providers are not configured. Preference fields are persisted for future channel rollout, but only existing in-app and push pathways are active. Push is best-effort and not a guaranteed delivery receipt.
- No third-party email/SMS/WhatsApp credentials or production secrets were added.
- No custodial wallet, escrow, split settlement, or escrow-like project fund holding was introduced. Those require a separate legal/compliance and payment-provider design decision.

## Migration

`packages/db/prisma/migrations/20261123130000_stage_08_messaging_preferences/migration.sql`

Adds `readAt` to `Message` and `ServiceMessage`, supporting indexes, and the `NotificationPreference` table. Apply this migration before deploying this code.

## Tests added

`packages/api/tests/integration/stage08.test.ts` covers default/update notification preferences, participant-only inquiry read marking, and rejecting provider commission settlements above the outstanding balance.

## Verification status

- Source syntax, archive integrity, schema validation, typecheck, generated Prisma client, integration tests, Next production build, and staging webhook replay must be reported separately after they are actually run.
- This environment has no workspace dependency installation or PostgreSQL service. The Stage 08 integration tests and database migration have therefore not been executed here.
- Paystack production behavior still requires staging tests using Paystack test keys, signed webhook replay, duplicate event replay, amount mismatch, failed payment, and concurrent delivery cases.

## Release checklist

1. Back up staging database and apply Prisma migration.
2. Regenerate Prisma client and run API/web typechecks.
3. Run full API unit and integration suites.
4. Test Paystack test-mode top-up and commission settlement, including webhook duplicate and mismatch cases.
5. Verify buyer/realtor and customer/provider unread counts with two separate accounts.
6. Confirm push preference is respected on real devices; test token rotation/sign-out.
7. Keep Home Services payments explicitly off-platform until a separately approved customer-payment model is implemented.
